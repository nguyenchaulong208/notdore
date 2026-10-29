/* NotDore Admin — giao diện local, không phụ thuộc thư viện ngoài. */

const state = {
  meta: null,
  version: "",
  tables: [],
  schemas: [],
  tableWarnings: [],
  tableError: null,
  currentTable: null,
  columns: [],
  primaryKey: [],
  primaryKeyGuessed: false,
  rows: [],
  total: null,
  limit: 50,
  offset: 0,
  order: "",
  search: "",
  dataError: null,
  loading: false,
  loadSeq: 0,
  lastSqlResult: null,
  view: "data",
};

const els = {};
let modalState = null;
let searchTimer = 0;

const MAX_CONFIG_BYTES = 256 * 1024;

const SQL_EXAMPLES = {
  provinces: `select code, name, slug, type_code
from public.communes
where level_code = 'province'
order by name;`,
  summary: `select province_name, resolution_number,
       communes_before, communes_after, wards_after,
       special_zones_after, not_applied, total_units_after, communes_delta
from public.communes
order by province_name;`,
  counts: `select level_code, type_code, count(*) as total
from public.communes
group by level_code, type_code
order by level_code, type_code;`,
  tables: `select table_schema, table_name, table_type
from information_schema.tables
where table_schema not in ('pg_catalog', 'information_schema')
order by table_schema, table_name;`,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "htmlFor") node.htmlFor = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key === "on") {
      for (const [event, handler] of Object.entries(value)) {
        node.addEventListener(event, handler);
      }
    } else if (key in node) {
      try {
        node[key] = value;
      } catch {
        node.setAttribute(key, value);
      }
    } else {
      node.setAttribute(key, value);
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  if (children === undefined || children === null || children === false) return;
  if (Array.isArray(children)) {
    for (const child of children) appendChildren(node, child);
    return;
  }
  node.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
}

function truncate(value, max = 160) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return new Intl.NumberFormat("vi-VN").format(n);
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "";
  return n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(2)} s`;
}

function quoteIdent(name) {
  return `"${String(name).replaceAll('"', '""')}"`;
}

function tableKey(table) {
  return table ? `${table.schema}.${table.name}` : "";
}

function defaultOrderClient(table) {
  if (!table) return "";
  for (const name of ["name", "province_name", "code", "slug"]) {
    if (table.columns?.some((column) => column.name === name)) return `${name}.asc`;
  }
  if (table.primaryKey?.length) return `${table.primaryKey[0]}.asc`;
  if (table.columns?.length) return `${table.columns[0].name}.asc`;
  return "";
}

function isBooleanType(type) {
  return /bool/i.test(type || "");
}

function isJsonType(type) {
  return /json/i.test(type || "");
}

function isArrayType(type) {
  return /array|\[\]/i.test(type || "");
}

function isNumericType(type) {
  return /int|numeric|decimal|real|double|float|serial|money|number/i.test(type || "");
}

function isLongTextType(type) {
  return /json|array|text|bytea/i.test(type || "");
}

function isTextType(type) {
  return /char|text|string|uuid|citext|name/i.test(type || "") && !isJsonType(type) && !isArrayType(type);
}

function formatError(err) {
  const parts = [String(err?.message || err || "Lỗi không xác định")];
  if (err?.details) {
    parts.push(typeof err.details === "string" ? err.details : JSON.stringify(err.details, null, 2));
  }
  if (err?.hint) parts.push(`Gợi ý: ${err.hint}`);
  return truncate(parts.join("\n\n"), 8000);
}

function showNotice(container, text, type = "info") {
  if (!container) return;
  if (!text) {
    container.className = "notice hidden";
    container.textContent = "";
    return;
  }
  container.className = `notice notice-${type}`;
  container.textContent = text;
}

function hideNotice(container) {
  if (!container) return;
  container.classList.add("hidden");
  container.textContent = "";
}

function toast(message, type = "info", timeout = 4200) {
  if (!els.toastRoot) return;
  const node = el("div", { class: `toast toast-${type}`, text: message });
  els.toastRoot.appendChild(node);
  window.setTimeout(() => {
    node.style.opacity = "0";
    node.style.transform = "translateY(4px)";
    node.style.transition = "opacity .15s ease, transform .15s ease";
    window.setTimeout(() => node.remove(), 180);
  }, timeout);
}

async function api(path, { method = "GET", body, rawBody } = {}) {
  const headers = {
    Accept: "application/json",
    "X-Admin-Request": "1",
  };

  let payload;
  if (rawBody !== undefined) {
    // Gửi nguyên File/Blob lên server local, không đọc nội dung trong JS.
    headers["Content-Type"] = rawBody?.type || "text/plain; charset=utf-8";
    payload = rawBody;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: payload,
    });
  } catch (err) {
    throw new Error(`Không kết nối được server admin: ${err.message}`);
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || `HTTP ${response.status}` };
  }

  if (!response.ok) {
    const error = new Error(data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = data?.code || "";
    error.details = data?.details || null;
    error.hint = data?.hint || "";
    error.payload = data;
    throw error;
  }

  return data;
}

function cacheElements() {
  const ids = [
    "statusCard",
    "btnRefreshTables",
    "schemaFilter",
    "tableSearch",
    "tableList",
    "btnChooseConfig",
    "configFile",
    "btnReloadConfig",
    "breadcrumb",
    "tableSubtitle",
    "tabData",
    "tabSql",
    "globalNotice",
    "viewData",
    "viewSql",
    "btnInsert",
    "btnRefreshRows",
    "searchInput",
    "pageSize",
    "dataNotice",
    "dataTable",
    "dataHead",
    "dataBody",
    "dataEmpty",
    "rowInfo",
    "btnPrev",
    "btnNext",
    "pageInfo",
    "sqlModeNotice",
    "sqlEditor",
    "sqlFile",
    "sqlFileInfo",
    "btnCopySql",
    "btnClearSql",
    "btnRunSql",
    "btnExample",
    "sqlReadOnly",
    "sqlResultMeta",
    "sqlError",
    "sqlResult",
    "btnDownloadResult",
    "modalRoot",
    "toastRoot",
  ];
  const missing = [];
  for (const id of ids) {
    els[id] = document.getElementById(id);
    if (!els[id]) missing.push(id);
  }
  if (missing.length) {
    console.warn("[admin] Thiếu phần tử giao diện:", missing);
  }
}

async function loadMeta() {
  try {
    const data = await api("/api/meta");
    state.meta = data.config;
    state.version = data.version || "";
  } catch (err) {
    state.meta = null;
    state.version = "";
    renderStatusError(err);
    showNotice(
      els.globalNotice,
      `Không tải được cấu hình từ server admin.\n${formatError(err)}`,
      "error"
    );
    renderSqlModeNotice();
    resetDataView("Không kết nối được admin", "Kiểm tra terminal rồi bấm Tải lại cấu hình.");
    renderTableList();
    return;
  }

  renderStatus();
  renderGlobalNotice();
  renderSqlModeNotice();

  if (!state.meta.tablesEnabled) {
    state.currentTable = null;
    state.tables = [];
    state.schemas = [];
    state.tableError = null;
    state.tableWarnings = [];
    populateSchemaFilter();
    renderTableList();
    resetDataView(
      "Chưa bật trình duyệt bảng",
      "Cần SUPABASE_SERVICE_ROLE_KEY trong admin/supabase.txt để xem/sửa bảng."
    );
  }
}

async function loadConfigFile(file) {
  if (!file) return;
  if (file.size > MAX_CONFIG_BYTES) {
    toast("File cấu hình quá lớn (tối đa 256 KB).", "error", 6000);
    return;
  }

  try {
    toast(`Đang nạp ${file.name}...`, "info", 1800);
    const data = await api("/api/config", { method: "POST", rawBody: file });
    state.meta = data.config;
    state.version = data.version || state.version;

    renderStatus();
    renderGlobalNotice();
    renderSqlModeNotice();

    if (state.meta?.tablesEnabled) {
      await loadTables(true);
    } else {
      state.currentTable = null;
      state.tables = [];
      state.schemas = [];
      state.tableError = null;
      state.tableWarnings = [];
      populateSchemaFilter();
      renderTableList();
      resetDataView(
        "Chưa bật trình duyệt bảng",
        "Cần SUPABASE_SERVICE_ROLE_KEY trong file cấu hình để xem/sửa bảng."
      );
    }

    toast(
      `Đã nạp ${file.name} vào ${data.config?.configFile || "file cấu hình"}.`,
      "success",
      6000
    );
  } catch (err) {
    toast(`Không nạp được file cấu hình: ${formatError(err)}`, "error", 8000);
  }
}

function statusLine(label, value, { code = false } = {}) {
  const valueNode = code
    ? el("code", { text: value })
    : el("span", { text: value });
  return el("div", { class: "status-row status-detail" }, [
    el("span", { class: "status-label", text: label }),
    valueNode,
  ]);
}

function renderStatus() {
  if (!els.statusCard) return;
  const meta = state.meta;

  if (!meta) {
    els.statusCard.replaceChildren(
      el("div", { class: "status-row" }, [
        el("span", { class: "dot dot-error" }),
        el("strong", { text: "Không tải được cấu hình" }),
      ]),
      el("div", { class: "status-row status-detail", text: "Kiểm tra server admin hoặc bấm Tải lại cấu hình." })
    );
    return;
  }

  if (!meta.configured) {
    els.statusCard.replaceChildren(
      el("div", { class: "status-row" }, [
        el("span", { class: "dot dot-error" }),
        el("strong", { text: "Chưa cấu hình" }),
      ]),
      el("div", { class: "status-row status-detail", text: "Bấm Chọn file key .txt hoặc tạo admin/supabase.txt từ file ví dụ." }),
      statusLine("File", meta.configFile, { code: true })
    );
    return;
  }

  const healthy = meta.tablesEnabled && meta.sqlEnabled;
  const dotClass = healthy ? "dot-ok" : "dot-warn";
  const roleLabel = {
    service_role: "service_role (toàn quyền)",
    secret: "secret key (toàn quyền)",
    anon: "anon (bị RLS giới hạn)",
    unknown: "không xác định",
    none: "chưa có",
  }[meta.apiKeyRole] || meta.apiKeyRole;

  const sqlLabel = {
    "management-api": "PAT / Management API",
    psql: "psql / DATABASE_URL",
    none: "tắt",
  }[meta.sqlMode] || meta.sqlMode;

  els.statusCard.replaceChildren(
    el("div", { class: "status-row" }, [
      el("span", { class: `dot ${dotClass}` }),
      el("strong", { text: meta.tablesEnabled ? "Đã kết nối" : "Đã cấu hình" }),
    ]),
    statusLine("Project", meta.projectRef || meta.url || (meta.sqlMode === "psql" ? "psql" : "?")),
    statusLine("Key", roleLabel),
    statusLine("SQL", sqlLabel),
    statusLine("File", meta.configFile, { code: true })
  );
}

function renderStatusError(err) {
  if (!els.statusCard) return;
  els.statusCard.replaceChildren(
    el("div", { class: "status-row" }, [
      el("span", { class: "dot dot-error" }),
      el("strong", { text: "Lỗi kết nối admin" }),
    ]),
    el("div", { class: "status-row status-detail", text: truncate(formatError(err), 240) })
  );
}

function renderGlobalNotice() {
  const meta = state.meta;
  if (!meta) return;

  if (!meta.configured) {
    const configFile = meta.configFile || "admin/supabase.txt";
    showNotice(
      els.globalNotice,
      [
        "Chưa cấu hình Supabase.",
        `Tạo file: ${configFile}`,
        "",
        "Nội dung tối thiểu:",
        "SUPABASE_URL=https://<project-ref>.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY=<service-role-key>",
        "",
        "Muốn chạy SQL/import ngay trong admin, thêm:",
        "SUPABASE_ACCESS_TOKEN=sbp_...",
        "",
        'Bấm "Chọn file key .txt" để nạp file, hoặc tạo file thủ công rồi bấm "Tải lại cấu hình".',
      ].join("\n"),
      "error"
    );
    return;
  }

  const warnings = [...(meta.warnings || []), ...(state.tableWarnings || [])];
  if (warnings.length > 0) {
    showNotice(els.globalNotice, warnings.join("\n"), "warn");
  } else {
    hideNotice(els.globalNotice);
  }
}

function renderSqlModeNotice() {
  const meta = state.meta;
  if (!meta) {
    showNotice(els.sqlModeNotice, "Chưa tải được cấu hình.", "warn");
    els.btnRunSql.disabled = true;
    return;
  }

  if (meta.sqlEnabled) {
    const method = meta.sqlMode === "psql" ? "psql (DATABASE_URL)" : "Management API (PAT)";
    showNotice(
      els.sqlModeNotice,
      `Đang bật chạy SQL qua ${method}. Script có thể thay đổi dữ liệu, hãy kiểm tra trước khi chạy.`,
      "info"
    );
    els.btnRunSql.disabled = false;
  } else {
    showNotice(
      els.sqlModeNotice,
      [
        "Chưa bật chạy SQL trong admin.",
        "Thêm SUPABASE_ACCESS_TOKEN (token dạng sbp_...) vào admin/supabase.txt để chạy trực tiếp.",
        "Nếu chưa có PAT, bạn vẫn có thể dán SQL vào Supabase Dashboard → SQL Editor.",
      ].join("\n"),
      "warn"
    );
    els.btnRunSql.disabled = true;
  }
}

async function loadTables(force = false) {
  if (!state.meta?.tablesEnabled) {
    renderTableList();
    return;
  }

  if (els.tableList) {
    els.tableList.replaceChildren(el("div", { class: "empty-small", text: "Đang tải danh sách bảng..." }));
  }

  state.tableError = null;
  try {
    const data = await api(`/api/tables${force ? "?refresh=1" : ""}`);
    const currentKey = tableKey(state.currentTable);
    state.tables = Array.isArray(data.tables) ? data.tables : [];
    state.schemas = Array.isArray(data.schemas) ? data.schemas : [];
    state.tableWarnings = Array.isArray(data.warnings) ? data.warnings : [];

    populateSchemaFilter();
    renderGlobalNotice();

    if (currentKey) {
      const found = state.tables.find((table) => tableKey(table) === currentKey);
      if (found) {
        state.currentTable = found;
        state.columns = found.columns || [];
        state.primaryKey = found.primaryKey || [];
        state.primaryKeyGuessed = Boolean(found.primaryKeyGuessed);
        updateTableHeader();
      } else {
        state.currentTable = null;
        resetDataView("Bảng không còn tồn tại", "Chọn bảng khác ở cột bên trái.");
      }
    }

    renderTableList();

    if (state.tableWarnings.length > 0) {
      toast(state.tableWarnings[0], "warn", 6500);
    }

    if (!state.currentTable) {
      const preferred =
        state.tables.find((table) => table.schema === "public" && table.name === "communes") ||
        state.tables.find((table) => table.schema === "public" && !table.isSystem) ||
        state.tables[0];
      if (preferred) {
        await selectTable(preferred, { silent: true, switchToData: false });
      } else {
        resetDataView("Không có bảng", "Database chưa có bảng nào hoặc key không có quyền đọc.");
      }
    } else if (force) {
      await loadRows();
    }
  } catch (err) {
    state.tableError = formatError(err);
    state.tables = [];
    state.schemas = [];
    state.tableWarnings = [];
    state.currentTable = null;
    populateSchemaFilter();
    renderTableList();
    resetDataView("Không tải được danh sách bảng", "Xem thông báo lỗi phía trên.");
    showNotice(els.dataNotice, state.tableError, "error");
    toast("Không tải được danh sách bảng.", "error");
  }
}

function populateSchemaFilter() {
  if (!els.schemaFilter) return;
  const current = els.schemaFilter.value;
  const options = [el("option", { value: "", text: "Tất cả schema" })];
  for (const schema of state.schemas) {
    options.push(el("option", { value: schema, text: schema }));
  }
  els.schemaFilter.replaceChildren(...options);
  if (current && state.schemas.includes(current)) {
    els.schemaFilter.value = current;
  }
}

function renderTableList() {
  if (!els.tableList) return;
  els.tableList.replaceChildren();

  if (!state.meta) {
    els.tableList.appendChild(el("div", { class: "empty-small", text: "Đang tải cấu hình..." }));
    return;
  }

  if (!state.meta.tablesEnabled) {
    els.tableList.appendChild(
      el("div", {
        class: "empty-small",
        text: "Chưa bật trình duyệt bảng. Cần service_role key trong admin/supabase.txt.",
      })
    );
    return;
  }

  if (state.tableError) {
    els.tableList.appendChild(el("div", { class: "empty-small", text: state.tableError }));
    return;
  }

  if (state.tables.length === 0) {
    els.tableList.appendChild(el("div", { class: "empty-small", text: "Không có bảng nào." }));
    return;
  }

  const schemaFilter = els.schemaFilter?.value || "";
  const search = (els.tableSearch?.value || "").trim().toLowerCase();
  const filtered = state.tables.filter((table) => {
    if (schemaFilter && table.schema !== schemaFilter) return false;
    if (!search) return true;
    return `${table.schema}.${table.name}`.toLowerCase().includes(search);
  });

  if (filtered.length === 0) {
    els.tableList.appendChild(el("div", { class: "empty-small", text: "Không tìm thấy bảng phù hợp." }));
    return;
  }

  const groups = new Map();
  for (const table of filtered) {
    if (!groups.has(table.schema)) groups.set(table.schema, []);
    groups.get(table.schema).push(table);
  }

  const schemas = [...groups.keys()].sort((a, b) => {
    if (a === "public") return -1;
    if (b === "public") return 1;
    return a.localeCompare(b);
  });

  for (const schema of schemas) {
    const group = el("div", { class: "schema-group" });
    const title = el("div", { class: "schema-group-title" }, [el("span", { text: schema })]);
    if (["auth", "storage", "realtime", "vault"].includes(schema)) {
      title.appendChild(el("span", { class: "system-tag", text: "system" }));
    }
    group.appendChild(title);

    for (const table of groups.get(schema)) {
      const active = tableKey(table) === tableKey(state.currentTable);
      const button = el("button", {
        class: `table-item${active ? " active" : ""}`,
        type: "button",
        title: `${table.schema}.${table.name}`,
        on: {
          click: () => {
            void selectTable(table);
          },
        },
      }, [
        el("span", { class: "table-icon", text: table.kind === "view" ? "◫" : "▦" }),
        el("span", { class: "table-name", text: table.name }),
      ]);
      if (!table.primaryKey?.length) {
        button.appendChild(el("span", { class: "pk-warning", text: "!", title: "Không có khóa chính" }));
      }
      group.appendChild(button);
    }
    els.tableList.appendChild(group);
  }
}

async function selectTable(table, { silent = false, switchToData = true } = {}) {
  if (!table) return;
  state.currentTable = table;
  state.columns = table.columns || [];
  state.primaryKey = table.primaryKey || [];
  state.primaryKeyGuessed = Boolean(table.primaryKeyGuessed);
  state.rows = [];
  state.total = null;
  state.offset = 0;
  state.search = "";
  state.order = defaultOrderClient(table);
  state.dataError = null;
  state.tableWarnings = state.tableWarnings || [];

  if (els.searchInput) els.searchInput.value = "";
  updateTableHeader();

  renderTableList();
  if (!silent && switchToData) switchView("data");

  await loadRows();
}

function updateTableHeader() {
  const table = state.currentTable;
  if (!table) {
    els.breadcrumb.textContent = "Chọn một bảng để bắt đầu";
    els.tableSubtitle.textContent = "";
    return;
  }
  els.breadcrumb.textContent = `${table.schema}.${table.name}`;
  const pk = table.primaryKey?.length ? table.primaryKey.join(", ") : "không có";
  els.tableSubtitle.textContent = `${table.kind === "view" ? "View" : "Table"} · ${table.columns?.length || 0} cột · Khóa chính: ${pk}${
    table.primaryKeyGuessed ? " (ước đoán)" : ""
  }`;
}

function setDataBusy(busy) {
  state.loading = busy;
  const hasTable = Boolean(state.currentTable);
  if (els.btnInsert) els.btnInsert.disabled = busy || !hasTable;
  if (els.btnRefreshRows) els.btnRefreshRows.disabled = busy || !hasTable;
  if (els.pageSize) els.pageSize.disabled = busy || !hasTable;
  updatePager();
}

async function loadRows() {
  const table = state.currentTable;
  if (!table) {
    resetDataView("Chọn một bảng", "Danh sách bảng ở cột bên trái.");
    return;
  }

  const seq = ++state.loadSeq;
  state.dataError = null;
  setDataBusy(true);
  if (els.rowInfo) els.rowInfo.textContent = "Đang tải...";

  try {
    const params = new URLSearchParams({
      schema: table.schema,
      table: table.name,
      limit: String(state.limit),
      offset: String(state.offset),
    });
    if (state.order) params.set("order", state.order);
    if (state.search) params.set("q", state.search);

    const data = await api(`/api/table?${params.toString()}`);
    if (seq !== state.loadSeq) return;

    state.rows = Array.isArray(data.rows) ? data.rows : [];
    state.total = Number.isFinite(data.total) ? data.total : null;
    state.offset = Number.isFinite(data.offset) ? data.offset : state.offset;
    state.order = data.order || state.order;
    if (Array.isArray(data.columns)) state.columns = data.columns;
    if (Array.isArray(data.primaryKey)) state.primaryKey = data.primaryKey;
    state.primaryKeyGuessed = Boolean(data.primaryKeyGuessed);
    state.currentTable = {
      ...state.currentTable,
      columns: state.columns,
      primaryKey: state.primaryKey,
      primaryKeyGuessed: state.primaryKeyGuessed,
    };

    renderDataTable();
    renderDataNotice();
  } catch (err) {
    if (seq !== state.loadSeq) return;
    state.rows = [];
    state.total = null;
    state.dataError = formatError(err);
    renderDataTable();
    renderDataNotice();
    toast("Không tải được dữ liệu bảng.", "error");
  } finally {
    if (seq === state.loadSeq) setDataBusy(false);
  }
}

function renderDataNotice() {
  if (!els.dataNotice) return;
  if (state.dataError) {
    showNotice(els.dataNotice, state.dataError, "error");
    return;
  }

  const messages = [];
  let severity = "info";

  if (!state.currentTable && state.tableWarnings.length > 0) {
    messages.push(...state.tableWarnings);
    severity = "warn";
  }

  const table = state.currentTable;
  if (table) {
    if (table.isSystem) {
      messages.push("Đây là bảng thuộc schema hệ thống. Thao tác có thể ảnh hưởng đăng nhập, storage hoặc dịch vụ Supabase.");
      severity = "warn";
    }
    if (table.kind === "view") {
      messages.push("Đây là view. PostgreSQL có thể từ chối thao tác thêm/sửa/xóa trên view.");
      if (severity !== "warn") severity = "info";
    }
    if (!table.primaryKey?.length) {
      messages.push(
        "Bảng không có khóa chính. Khi sửa/xóa, admin sẽ dùng toàn bộ cột của dòng làm điều kiện; nếu dữ liệu trùng, có thể ảnh hưởng nhiều dòng."
      );
      severity = "warn";
    } else if (table.primaryKeyGuessed) {
      messages.push(
        "Khóa chính đang được ước đoán từ cột id qua PostgREST OpenAPI. Kiểm tra kỹ trước khi sửa/xóa."
      );
      severity = "warn";
    }
  }

  if (messages.length > 0) {
    showNotice(els.dataNotice, messages.join("\n"), severity);
  } else {
    hideNotice(els.dataNotice);
  }
}

function renderDataTable() {
  const table = state.currentTable;
  if (!table) {
    resetDataView("Chọn một bảng", "Danh sách bảng ở cột bên trái.");
    return;
  }

  const columns = state.columns || table.columns || [];
  const primaryKey = new Set(state.primaryKey || table.primaryKey || []);

  els.dataHead.replaceChildren();
  els.dataBody.replaceChildren();

  if (state.rows.length === 0) {
    els.dataTable.classList.add("hidden");
    els.dataEmpty.classList.remove("hidden");
    setEmptyMessage("Chưa có dữ liệu", "Bảng này chưa có dòng nào hoặc bộ lọc không khớp.");
    updatePager();
    return;
  }

  const headRow = el("tr");
  for (const column of columns) {
    const isActive = state.order === `${column.name}.asc` || state.order === `${column.name}.desc`;
    const direction = state.order === `${column.name}.asc` ? "↑" : state.order === `${column.name}.desc` ? "↓" : "";
    const button = el("button", {
      class: "th-button",
      type: "button",
      title: `${column.type}${column.nullable ? " · nullable" : ""}`,
      on: {
        click: () => {
          state.order = isActive
            ? `${column.name}.${state.order.endsWith(".asc") ? "desc" : "asc"}`
            : `${column.name}.asc`;
          state.offset = 0;
          void loadRows();
        },
      },
    }, [
      el("span", { text: column.name }),
      primaryKey.has(column.name) ? el("span", { class: "pk-mark", text: "PK" }) : null,
      direction ? el("span", { class: "sort-mark", text: direction }) : null,
    ]);
    headRow.appendChild(el("th", {}, button));
  }
  headRow.appendChild(el("th", { class: "actions-head", text: "Thao tác" }));
  els.dataHead.appendChild(headRow);

  const fragment = document.createDocumentFragment();
  for (const row of state.rows) {
    const tr = el("tr", {
      title: "Bấm để xem/sửa dòng",
      on: {
        click: () => openRowModal("edit", row),
      },
    });
    for (const column of columns) {
      tr.appendChild(el("td", {}, renderCell(row[column.name], column)));
    }

    const editButton = el("button", {
      class: "btn btn-small",
      type: "button",
      text: "Sửa",
      on: {
        click: (event) => {
          event.stopPropagation();
          openRowModal("edit", row);
        },
      },
    });
    const deleteButton = el("button", {
      class: "btn btn-small btn-danger",
      type: "button",
      text: "Xóa",
      on: {
        click: (event) => {
          event.stopPropagation();
          void deleteRow(table, row);
        },
      },
    });
    tr.appendChild(el("td", {}, el("div", { class: "row-actions" }, [editButton, deleteButton])));
    fragment.appendChild(tr);
  }

  els.dataBody.appendChild(fragment);
  els.dataTable.classList.remove("hidden");
  els.dataEmpty.classList.add("hidden");
  updatePager();
}

function renderCell(value, column) {
  const span = el("span");
  if (value === null || value === undefined) {
    span.className = "cell-null";
    span.textContent = "NULL";
    return span;
  }
  if (typeof value === "boolean") {
    span.className = "cell-bool";
    span.textContent = String(value);
    return span;
  }
  if (typeof value === "number") {
    span.className = "cell-number";
    span.textContent = String(value);
    return span;
  }
  if (typeof value === "object") {
    const text = JSON.stringify(value);
    span.className = "cell-json";
    span.textContent = truncate(text, 140);
    span.title = text;
    return span;
  }

  const text = String(value);
  span.textContent = truncate(text, 140);
  span.title = text;
  if (isJsonType(column.type)) span.className = "cell-json";
  else if (/uuid/i.test(column.type || "")) span.className = "cell-mono";
  else if (isNumericType(column.type)) span.className = "cell-number";
  return span;
}

function updatePager() {
  const total = state.total;
  const count = state.rows.length;
  const offset = state.offset;
  const limit = state.limit;
  const busy = state.loading;

  if (els.rowInfo) {
    if (!state.currentTable) {
      els.rowInfo.textContent = "Chưa có dữ liệu";
    } else if (busy && count === 0) {
      els.rowInfo.textContent = "Đang tải...";
    } else if (count === 0) {
      els.rowInfo.textContent = "0 dòng";
    } else {
      const start = offset + 1;
      const end = offset + count;
      els.rowInfo.textContent =
        total === null
          ? `${formatNumber(start)}–${formatNumber(end)}`
          : `${formatNumber(start)}–${formatNumber(end)} / ${formatNumber(total)} dòng`;
    }
  }

  const page = Math.floor(offset / limit) + 1;
  const pages = total !== null ? Math.max(1, Math.ceil(total / limit)) : null;
  if (els.pageInfo) {
    els.pageInfo.textContent = pages ? `Trang ${page} / ${pages}` : `Trang ${page}`;
  }

  if (els.btnPrev) els.btnPrev.disabled = busy || offset <= 0 || !state.currentTable;
  if (els.btnNext) {
    const atEnd = total !== null ? offset + limit >= total : count < limit;
    els.btnNext.disabled = busy || atEnd || !state.currentTable;
  }
}

function setEmptyMessage(title, subtitle) {
  if (!els.dataEmpty) return;
  els.dataEmpty.replaceChildren(
    el("strong", { text: title }),
    el("span", { text: subtitle })
  );
}

function resetDataView(title = "Chọn một bảng", subtitle = "Danh sách bảng ở cột bên trái.") {
  state.loadSeq += 1;
  state.rows = [];
  state.total = null;
  state.loading = false;
  if (els.dataHead) els.dataHead.replaceChildren();
  if (els.dataBody) els.dataBody.replaceChildren();
  if (els.dataTable) els.dataTable.classList.add("hidden");
  if (els.dataEmpty) {
    els.dataEmpty.classList.remove("hidden");
    setEmptyMessage(title, subtitle);
  }
  if (els.rowInfo) els.rowInfo.textContent = "Chưa có dữ liệu";
  if (els.pageInfo) els.pageInfo.textContent = "Trang 1";
  if (els.btnPrev) els.btnPrev.disabled = true;
  if (els.btnNext) els.btnNext.disabled = true;
  if (els.btnInsert) els.btnInsert.disabled = true;
  if (els.btnRefreshRows) els.btnRefreshRows.disabled = true;
  if (els.pageSize) els.pageSize.disabled = true;
  hideNotice(els.dataNotice);
  if (els.breadcrumb && !state.currentTable) {
    els.breadcrumb.textContent = "Chọn một bảng để bắt đầu";
    els.tableSubtitle.textContent = "";
  }
}

function switchView(view) {
  state.view = view;
  const isData = view === "data";
  els.viewData.classList.toggle("hidden", !isData);
  els.viewSql.classList.toggle("hidden", isData);
  els.tabData.classList.toggle("active", isData);
  els.tabSql.classList.toggle("active", !isData);
}

function fieldId(columnName) {
  return `field-${String(columnName).replace(/[^A-Za-z0-9_-]/g, "_")}`;
}

function fieldValueForDisplay(column, value) {
  if (value === null || value === undefined) return "";
  if (isJsonType(column.type) || isArrayType(column.type)) {
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  if (isBooleanType(column.type)) return value ? "true" : "false";
  return String(value);
}

function renderModalField(column, mode, row, primaryKey) {
  const isPk = primaryKey.includes(column.name);
  const readOnly = Boolean(column.generated || column.isIdentity || (mode === "edit" && isPk));
  const raw = row ? row[column.name] : undefined;
  const isNull = row ? raw === null || raw === undefined : false;
  const id = fieldId(column.name);
  const full = isJsonType(column.type) || isArrayType(column.type) ||
    /metadata|description|content|note|address/i.test(column.name);

  const labelChildren = [
    el("span", { text: column.name }),
    el("span", { class: "type", text: column.type }),
  ];
  if (isPk) labelChildren.push(el("span", { class: "pk", text: "PK" }));
  if (!column.nullable) labelChildren.push(el("span", { class: "required", text: "*" }));

  const label = el("label", { class: "field-label", htmlFor: id }, labelChildren);

  let input;
  if (isBooleanType(column.type)) {
    input = el("select", { class: "field-select", id, disabled: readOnly }, [
      el("option", { value: "", text: "— chọn —" }),
      el("option", { value: "true", text: "true" }),
      el("option", { value: "false", text: "false" }),
    ]);
    input.value = fieldValueForDisplay(column, raw);
  } else if (isJsonType(column.type) || isArrayType(column.type) || isLongTextType(column.type)) {
    input = el("textarea", {
      class: `field-textarea${isJsonType(column.type) || isArrayType(column.type) ? " field-json" : ""}`,
      id,
      disabled: readOnly,
      spellcheck: false,
    });
    input.value = fieldValueForDisplay(column, raw);
  } else if (isNumericType(column.type)) {
    input = el("input", {
      class: "field-input",
      id,
      type: "number",
      step: "any",
      disabled: readOnly,
      spellcheck: false,
    });
    input.value = fieldValueForDisplay(column, raw);
  } else {
    input = el("input", {
      class: "field-input",
      id,
      type: "text",
      disabled: readOnly,
      spellcheck: false,
    });
    input.value = fieldValueForDisplay(column, raw);
  }

  if (readOnly) {
    input.placeholder = column.generated ? "(generated)" : column.isIdentity ? "(identity)" : "(khóa chính)";
  }

  const field = el("div", { class: `field${full ? " field-full" : ""}` });
  field.dataset.dirty = "0";
  field.dataset.column = column.name;

  const markDirty = () => {
    field.dataset.dirty = "1";
  };
  input.addEventListener("input", markDirty);
  input.addEventListener("change", markDirty);

  let nullToggle = null;
  if (column.nullable && !readOnly) {
    nullToggle = el("input", { type: "checkbox" });
    nullToggle.checked = isNull;
    if (isNull) input.disabled = true;

    nullToggle.addEventListener("change", () => {
      markDirty();
      if (nullToggle.checked) {
        input.dataset.savedValue = input.value;
        input.value = "";
        input.disabled = true;
      } else {
        input.disabled = false;
        input.value = input.dataset.savedValue ?? "";
      }
    });
  }

  const helpLeft = [];
  if (column.generated) helpLeft.push("tự động sinh");
  else if (column.isIdentity) helpLeft.push("identity");
  else if (mode === "edit" && isPk) helpLeft.push("khóa chính không sửa");
  if (column.default) helpLeft.push(`mặc định: ${truncate(column.default, 70)}`);

  const help = el("div", { class: "field-help" }, [
    el("span", { text: helpLeft.join(" · ") }),
    nullToggle ? el("label", { class: "null-toggle" }, [nullToggle, " NULL"]) : null,
  ]);

  field.append(label, input, help);

  return {
    column,
    field,
    input,
    nullToggle,
    readOnly,
  };
}

function openRowModal(mode, row = null) {
  const table = state.currentTable;
  if (!table) {
    toast("Chọn một bảng trước.", "warn");
    return;
  }
  if (modalState) modalState.close();

  const primaryKey = state.primaryKey?.length ? state.primaryKey : table.primaryKey || [];
  const overlay = el("div", { class: "modal-overlay" });
  const form = el("form", { class: "modal" });
  const errorBox = el("div", { class: "modal-error hidden" });
  const body = el("div", { class: "modal-body" });
  const grid = el("div", { class: "form-grid" });
  const fields = [];

  for (const column of state.columns.length ? state.columns : table.columns) {
    const rendered = renderModalField(column, mode, row, primaryKey);
    fields.push(rendered);
    grid.appendChild(rendered.field);
  }
  body.append(errorBox, grid);

  const title = el("h2", { text: mode === "edit" ? "Sửa dòng" : "Thêm dòng" });
  const subtitle = el("p", {
    text: `${table.schema}.${table.name}${table.kind === "view" ? " · view (thao tác ghi có thể bị từ chối)" : ""}`,
  });
  const closeButton = el("button", {
    class: "modal-close",
    type: "button",
    title: "Đóng",
    text: "×",
  });

  const head = el("div", { class: "modal-head" }, [
    el("div", {}, [title, subtitle]),
    closeButton,
  ]);

  const left = el("div", { class: "modal-foot-left" });
  const right = el("div", { class: "modal-foot-right" });
  const cancelButton = el("button", { class: "btn", type: "button", text: "Hủy" });
  const saveButton = el("button", {
    class: "btn btn-primary",
    type: "submit",
    text: mode === "edit" ? "Lưu thay đổi" : "Thêm dòng",
  });

  if (mode === "edit") {
    const copyButton = el("button", { class: "btn", type: "button", text: "Sao chép JSON" });
    copyButton.addEventListener("click", () => {
      void copyText(JSON.stringify(row, null, 2)).then(
        () => toast("Đã sao chép JSON của dòng.", "success"),
        (err) => toast(formatError(err), "error")
      );
    });
    const deleteButton = el("button", { class: "btn btn-danger", type: "button", text: "Xóa dòng" });
    left.append(deleteButton, copyButton);
    deleteButton.addEventListener("click", async () => {
      deleteButton.disabled = true;
      try {
        const deleted = await deleteRow(table, row);
        if (deleted) close();
      } finally {
        deleteButton.disabled = false;
      }
    });
  }

  right.append(cancelButton, saveButton);
  const foot = el("div", { class: "modal-foot" }, [left, right]);
  form.append(head, body, foot);
  overlay.appendChild(form);
  els.modalRoot.replaceChildren(overlay);
  document.body.style.overflow = "hidden";

  const previousFocus = document.activeElement;
  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };
  document.addEventListener("keydown", onKeyDown);

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    overlay.remove();
    document.body.style.overflow = "";
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
    if (modalState?.overlay === overlay) modalState = null;
  };

  modalState = { overlay, form, fields, close, table, mode, row, errorBox, saveButton };

  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });
  closeButton.addEventListener("click", close);
  cancelButton.addEventListener("click", close);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.classList.add("hidden");
    errorBox.textContent = "";
    saveButton.disabled = true;
    const originalText = saveButton.textContent;
    saveButton.textContent = "Đang lưu...";

    try {
      const values = collectFormValues();
      const keys = mode === "edit" ? getRowKeys(table, row) : null;

      if (mode === "edit" && !table.primaryKey?.length) {
        if (!window.confirm(
          "Bảng này không có khóa chính. Admin sẽ dùng toàn bộ cột của dòng làm điều kiện cập nhật.\n\n" +
          "Nếu dữ liệu không duy nhất, có thể cập nhật nhiều dòng. Tiếp tục?"
        )) {
          return;
        }
      }

      if (mode === "edit") {
        await api("/api/table", {
          method: "PATCH",
          body: { schema: table.schema, table: table.name, keys, values },
        });
        toast("Đã cập nhật dòng.", "success");
      } else {
        await api("/api/table", {
          method: "POST",
          body: { schema: table.schema, table: table.name, values },
        });
        state.offset = 0;
        toast("Đã thêm dòng.", "success");
      }

      close();
      await loadRows();
    } catch (err) {
      errorBox.textContent = formatError(err);
      errorBox.classList.remove("hidden");
      body.scrollTop = 0;
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  });

  const firstInput = form.querySelector("input:not([type=checkbox]):not(:disabled), textarea:not(:disabled), select:not(:disabled)");
  window.setTimeout(() => firstInput?.focus(), 0);
}

function parseFieldValue(column, raw) {
  if (raw === "") {
    if (isTextType(column.type)) return "";
    return null;
  }
  if (isBooleanType(column.type)) {
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  }
  if (isJsonType(column.type) || isArrayType(column.type)) {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error(`Cột "${column.name}" không phải JSON hợp lệ.`);
    }
  }
  if (isNumericType(column.type)) {
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Cột "${column.name}" không phải số hợp lệ.`);
    return n;
  }
  return raw;
}

function collectFormValues() {
  if (!modalState) throw new Error("Không có form đang mở.");
  const { mode, fields } = modalState;
  const values = {};

  for (const item of fields) {
    const { column, field, input, nullToggle, readOnly } = item;
    if (readOnly) continue;
    if (mode === "edit" && field.dataset.dirty !== "1") continue;

    if (nullToggle?.checked) {
      values[column.name] = null;
      continue;
    }

    const raw = input.value;
    if (raw === "" && mode === "insert") {
      if (field.dataset.dirty === "1" && isTextType(column.type)) {
        values[column.name] = "";
        continue;
      }
      if (!column.nullable && !column.default && !column.isIdentity && !column.generated) {
        throw new Error(`Cột "${column.name}" là bắt buộc và chưa có giá trị.`);
      }
      continue;
    }

    const parsed = parseFieldValue(column, raw);
    if (parsed === null && !column.nullable) {
      throw new Error(`Cột "${column.name}" không cho phép NULL.`);
    }
    values[column.name] = parsed;
  }

  if (Object.keys(values).length === 0) {
    throw new Error("Chưa có thay đổi nào để lưu.");
  }
  return values;
}

function getRowKeys(table, row) {
  if (!row) return {};
  const keys = {};

  if (table.primaryKey?.length) {
    for (const name of table.primaryKey) {
      if (row[name] === undefined) return getAllRowKeys(table, row);
      keys[name] = row[name];
    }
    return keys;
  }

  return getAllRowKeys(table, row);
}

function getAllRowKeys(table, row) {
  const keys = {};
  for (const column of table.columns || []) {
    if (row[column.name] !== undefined) keys[column.name] = row[column.name];
  }
  return keys;
}

function rowLabel(table, row) {
  const pk = table.primaryKey || [];
  if (pk.length) {
    return pk.map((name) => `${name}=${String(row[name])}`).join(", ");
  }
  return "dòng đã chọn";
}

async function deleteRow(table, row) {
  const keys = getRowKeys(table, row);
  if (!Object.keys(keys).length) {
    toast("Không xác định được khóa của dòng.", "error");
    return false;
  }

  if (!table.primaryKey?.length) {
    const ok = window.confirm(
      `Bảng ${table.schema}.${table.name} không có khóa chính.\n\n` +
      "Admin sẽ dùng toàn bộ cột của dòng làm điều kiện xóa. Nếu dữ liệu không duy nhất, có thể xóa nhiều dòng. Tiếp tục?"
    );
    if (!ok) return false;
  }

  if (!window.confirm(`Xóa ${rowLabel(table, row)} khỏi ${table.schema}.${table.name}?\n\nThao tác không thể hoàn tác.`)) {
    return false;
  }

  try {
    await api("/api/table", {
      method: "DELETE",
      body: { schema: table.schema, table: table.name, keys },
    });
    if (state.rows.length === 1 && state.offset > 0) {
      state.offset = Math.max(0, state.offset - state.limit);
    }
    toast("Đã xóa dòng.", "success");
    await loadRows();
    return true;
  } catch (err) {
    toast(formatError(err), "error", 7000);
    return false;
  }
}

async function runSql() {
  if (!state.meta?.sqlEnabled) {
    showSqlError(new Error("Chạy SQL chưa được bật. Thêm SUPABASE_ACCESS_TOKEN hoặc DATABASE_URL vào admin/supabase.txt."));
    switchView("sql");
    return;
  }

  const sql = els.sqlEditor.value;
  if (!sql.trim()) {
    toast("SQL đang trống.", "warn");
    els.sqlEditor.focus();
    return;
  }

  const readOnly = els.sqlReadOnly.checked;
  const target = state.meta.url || "Supabase";
  const ok = window.confirm(
    `Chạy SQL trên ${target}?\n\n` +
    `${readOnly ? "Chế độ: CHỈ ĐỌC." : "Chế độ: CÓ THỂ GHI/XÓA."}\n\n` +
    "Thao tác này có thể không hoàn tác. Tiếp tục?"
  );
  if (!ok) return;

  const originalText = els.btnRunSql.textContent;
  els.btnRunSql.disabled = true;
  els.btnRunSql.textContent = "Đang chạy...";
  els.sqlError.classList.add("hidden");
  els.sqlError.textContent = "";
  els.sqlResultMeta.textContent = "Đang chạy SQL...";
  els.sqlResult.classList.add("muted");
  els.sqlResult.textContent = "Đang chờ Supabase trả kết quả...";
  els.btnDownloadResult.disabled = true;

  try {
    const data = await api("/api/sql", {
      method: "POST",
      body: { sql, readOnly, confirm: "RUN_SQL" },
    });
    renderSqlResult(data);
    if (data.method === "psql") {
      toast("SQL đã chạy xong qua psql.", "success");
    } else {
      toast("SQL đã chạy xong.", "success");
    }
  } catch (err) {
    showSqlError(err);
    toast("SQL báo lỗi.", "error", 6500);
  } finally {
    els.btnRunSql.disabled = !state.meta?.sqlEnabled;
    els.btnRunSql.textContent = originalText;
  }
}

function renderSqlResult(data) {
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const methodLabel = data.method === "psql" ? "psql" : "Management API";
  const metaParts = [methodLabel];
  if (data.durationMs !== undefined) metaParts.push(formatDuration(data.durationMs));
  if (rows.length > 0) metaParts.push(`${formatNumber(rows.length)} dòng`);
  els.sqlResultMeta.textContent = metaParts.join(" · ");
  els.sqlResult.classList.remove("muted");
  els.sqlResult.replaceChildren();
  els.sqlError.classList.add("hidden");
  els.sqlError.textContent = "";
  els.btnDownloadResult.disabled = false;
  state.lastSqlResult = data;

  if (data.method === "psql") {
    const output = String(data.output || "").trim();
    if (output) {
      els.sqlResult.appendChild(el("pre", { class: "result-pre", text: output }));
    } else {
      els.sqlResult.appendChild(el("div", { class: "result-meta", text: "Thành công. psql không trả về output." }));
    }
    return;
  }

  if (rows.length > 0) {
    const normalized = rows.map((row) =>
      row && typeof row === "object" && !Array.isArray(row) ? row : { value: row }
    );
    const keys = [];
    const seen = new Set();
    for (const row of normalized.slice(0, 200)) {
      for (const key of Object.keys(row)) {
        if (!seen.has(key)) {
          seen.add(key);
          keys.push(key);
        }
      }
    }

    const table = el("table", { class: "result-table" });
    const thead = el("thead");
    const headRow = el("tr");
    for (const key of keys) headRow.appendChild(el("th", { text: key }));
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = el("tbody");
    for (const row of normalized.slice(0, 300)) {
      const tr = el("tr");
      for (const key of keys) {
        const value = row[key];
        const text = value === null || value === undefined
          ? "NULL"
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value);
        const td = el("td", { text: text, title: text });
        if (value === null || value === undefined) td.className = "cell-null";
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    els.sqlResult.appendChild(table);

    if (rows.length > 300) {
      els.sqlResult.appendChild(
        el("div", { class: "result-meta", text: `Chỉ hiển thị 300/${formatNumber(rows.length)} dòng đầu. Bấm Tải JSON để lấy đầy đủ.` })
      );
    }
    return;
  }

  const raw = data.raw;
  const hasRaw =
    raw !== null &&
    raw !== undefined &&
    !(Array.isArray(raw) && raw.length === 0) &&
    !(typeof raw === "object" && !Array.isArray(raw) && Object.keys(raw).length === 0) &&
    !(typeof raw === "string" && !raw.trim());

  if (hasRaw) {
    els.sqlResult.appendChild(
      el("pre", { class: "result-pre", text: typeof raw === "string" ? raw : JSON.stringify(raw, null, 2) })
    );
  } else {
    els.sqlResult.appendChild(el("div", { class: "result-meta", text: "Thành công. Không có dòng dữ liệu trả về." }));
  }
}

function showSqlError(err) {
  els.sqlError.classList.remove("hidden");
  const parts = [formatError(err)];
  if (err?.code === "SQL_NOT_CONFIGURED") {
    const ref = state.meta?.projectRef;
    const url = ref
      ? `https://supabase.com/dashboard/project/${encodeURIComponent(ref)}/sql/new`
      : "https://supabase.com/dashboard";
    parts.push(`Có thể dán SQL vào SQL Editor: ${url}`);
  }
  els.sqlError.textContent = parts.join("\n\n");
  els.sqlResultMeta.textContent = "Lỗi";
  els.sqlResult.classList.add("muted");
  els.sqlResult.textContent = "Chưa có kết quả.";
  els.btnDownloadResult.disabled = true;
  state.lastSqlResult = null;
}

async function loadSqlFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    toast("File SQL quá lớn (tối đa 10 MB).", "error");
    return;
  }
  try {
    const text = await file.text();
    els.sqlEditor.value = text;
    els.sqlFileInfo.textContent = `${file.name} · ${formatBytes(file.size)}`;
    switchView("sql");
    els.sqlEditor.scrollTop = 0;
    els.sqlEditor.focus();
    if (!/\.sql$/i.test(file.name)) {
      toast("File không có đuôi .sql — vẫn nạp vào editor, hãy kiểm tra nội dung.", "warn", 5500);
    } else {
      toast("Đã nạp file SQL vào editor.", "success");
    }
  } catch (err) {
    toast(`Không đọc được file: ${err.message}`, "error");
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = el("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

function downloadSqlResult() {
  if (!state.lastSqlResult) return;
  const blob = new Blob([JSON.stringify(state.lastSqlResult, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = el("a", {
    href: url,
    download: `notdore-sql-result-${Date.now()}.json`,
  });
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindEvents() {
  for (const tab of $$(".tab")) {
    tab.addEventListener("click", () => switchView(tab.dataset.view || "data"));
  }

  els.btnChooseConfig.addEventListener("click", () => {
    els.configFile.click();
  });

  els.configFile.addEventListener("change", () => {
    const file = els.configFile.files?.[0];
    els.configFile.value = "";
    if (file) void loadConfigFile(file);
  });

  els.btnReloadConfig.addEventListener("click", async () => {
    await loadMeta();
    if (state.meta?.tablesEnabled) await loadTables(true);
    toast("Đã tải lại cấu hình.", "success");
  });

  els.btnRefreshTables.addEventListener("click", async () => {
    await loadTables(true);
    toast("Đã tải lại danh sách bảng.", "success");
  });

  els.schemaFilter.addEventListener("change", renderTableList);
  els.tableSearch.addEventListener("input", renderTableList);

  els.btnInsert.addEventListener("click", () => openRowModal("insert"));
  els.btnRefreshRows.addEventListener("click", () => {
    if (state.currentTable) void loadRows();
  });

  els.searchInput.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      state.search = els.searchInput.value.trim();
      state.offset = 0;
      if (state.currentTable) void loadRows();
    }, 350);
  });

  els.pageSize.addEventListener("change", () => {
    state.limit = Number(els.pageSize.value) || 50;
    state.offset = 0;
    if (state.currentTable) void loadRows();
  });

  els.btnPrev.addEventListener("click", () => {
    if (!state.currentTable || state.loading) return;
    state.offset = Math.max(0, state.offset - state.limit);
    void loadRows();
  });

  els.btnNext.addEventListener("click", () => {
    if (!state.currentTable || state.loading) return;
    const atEnd = state.total !== null ? state.offset + state.limit >= state.total : state.rows.length < state.limit;
    if (atEnd) return;
    state.offset += state.limit;
    void loadRows();
  });

  els.btnRunSql.addEventListener("click", () => void runSql());
  els.btnClearSql.addEventListener("click", () => {
    if (els.sqlEditor.value.trim() && !window.confirm("Xóa nội dung SQL đang soạn?")) return;
    els.sqlEditor.value = "";
    els.sqlFileInfo.textContent = "";
    els.sqlEditor.focus();
  });
  els.btnCopySql.addEventListener("click", () => {
    if (!els.sqlEditor.value) {
      toast("SQL đang trống.", "warn");
      return;
    }
    void copyText(els.sqlEditor.value).then(
      () => toast("Đã sao chép SQL.", "success"),
      (err) => toast(`Không sao chép được: ${err.message}`, "error")
    );
  });
  els.btnExample.addEventListener("click", () => {
    const table = state.currentTable;
    els.sqlEditor.value = table
      ? `select *\nfrom ${quoteIdent(table.schema)}.${quoteIdent(table.name)}\nlimit 50;`
      : "select *\nfrom public.communes\nlimit 50;";
    switchView("sql");
    els.sqlEditor.focus();
  });

  els.btnDownloadResult.addEventListener("click", downloadSqlResult);

  els.sqlFile.addEventListener("change", () => {
    const file = els.sqlFile.files?.[0];
    els.sqlFile.value = "";
    if (file) void loadSqlFile(file);
  });

  els.sqlEditor.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void runSql();
    }
  });

  els.sqlEditor.addEventListener("dragover", (event) => {
    event.preventDefault();
    els.sqlEditor.classList.add("dragover");
  });
  els.sqlEditor.addEventListener("dragleave", () => {
    els.sqlEditor.classList.remove("dragover");
  });
  els.sqlEditor.addEventListener("drop", (event) => {
    event.preventDefault();
    els.sqlEditor.classList.remove("dragover");
    const file = event.dataTransfer?.files?.[0];
    if (file) void loadSqlFile(file);
  });

  for (const chip of $$("[data-example]")) {
    chip.addEventListener("click", () => {
      const sql = SQL_EXAMPLES[chip.dataset.example];
      if (!sql) return;
      els.sqlEditor.value = sql;
      switchView("sql");
      els.sqlEditor.focus();
    });
  }
}

async function init() {
  cacheElements();
  bindEvents();
  switchView("data");
  resetDataView();
  await loadMeta();
  if (state.meta?.tablesEnabled) {
    await loadTables();
  }
  if (window.location.hash === "#sql") switchView("sql");
}

void init();
