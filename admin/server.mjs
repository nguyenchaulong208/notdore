/**
 * NotDore Admin — server local để xem/sửa/xoá dữ liệu Supabase và chạy SQL.
 *
 * Chạy:
 *   node admin/server.mjs
 *   npm run admin
 *
 * Cấu hình: admin/supabase.txt (xem admin/supabase.example.txt).
 *
 * Server chỉ bind 127.0.0.1 và giữ toàn bộ key ở phía server. Không có key nào
 * được gửi xuống trình duyệt.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { spawn } from "node:child_process";

const ADMIN_ROOT = resolve(import.meta.dirname);
const PUBLIC_ROOT = resolve(ADMIN_ROOT, "public");
const CONFIG_PATH = resolve(process.env.ADMIN_CONFIG || join(ADMIN_ROOT, "supabase.txt"));
const HOST = process.env.ADMIN_HOST || "127.0.0.1";
const PORT = Number(process.env.ADMIN_PORT || process.env.PORT || 8787);
const MAX_BODY = 10 * 1024 * 1024;
const VERSION = "1.0.0";
const SCHEMA_CACHE_MS = 30_000;

const SYSTEM_SCHEMAS = new Set([
  "auth",
  "storage",
  "realtime",
  "vault",
  "graphql",
  "graphql_public",
  "extensions",
]);

const EXCLUDED_SCHEMAS = new Set([
  "pg_catalog",
  "information_schema",
  "pg_toast",
  "extensions",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".sql": "text/plain; charset=utf-8",
};

class HttpError extends Error {
  constructor(status, message, details = null, code = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.details = details;
    this.code = code;
  }
}

class ConfigError extends Error {
  constructor(message, missing = []) {
    super(message);
    this.name = "ConfigError";
    this.missing = missing;
  }
}

let schemaCache = { key: "", at: 0, value: null };

const json = (res, status, payload, extraHeaders = {}) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  res.end(body);
};

const errorResponse = (res, err) => {
  const status = err instanceof HttpError ? err.status : 500;
  const payload = {
    ok: false,
    error: err?.message || "Lỗi không xác định",
  };
  if (err instanceof HttpError && err.code) payload.code = err.code;
  if (err instanceof HttpError && err.details) payload.details = err.details;
  if (!(err instanceof HttpError)) {
    console.error("[admin] unexpected error:", err);
  }
  json(res, status, payload);
};

const first = (map, keys) => {
  for (const key of keys) {
    const value = map.get(key);
    if (value && value.trim()) return value.trim();
  }
  return "";
};

const stripQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const looksLikeUrl = (value) => /^https?:\/\//i.test(value);
const looksLikeDbUrl = (value) => /^postgres(ql)?:\/\//i.test(value);
const looksLikeProjectRef = (value) => /^[a-z0-9]{10,30}$/i.test(value);
const isPlaceholderValue = (value) =>
  !value ||
  /^(your[-_ ]|sbp_your|changeme|replace[-_ ]?me|\.\.\.$)/i.test(value) ||
  /[<>]/.test(value) ||
  /your[-_ ]?project[-_ ]?ref/i.test(value);

const decodeJwtRole = (token) => {
  if (!token || !token.startsWith("eyJ")) return "unknown";
  try {
    const payload = token.split(".")[1];
    if (!payload) return "unknown";
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role || data.user_role || "unknown";
  } catch {
    return "unknown";
  }
};

const isJwt = (token) => Boolean(token && token.startsWith("eyJ"));

const inferProjectRef = (url) => {
  if (!url) return "";
  const match = /^https?:\/\/([a-z0-9-]+)\.supabase\.co/i.exec(url);
  return match ? match[1] : "";
};

const parseConfigText = (text) => {
  const values = new Map();
  const loose = [];
  const lines = String(text || "").split(/\r?\n/);

  for (let raw of lines) {
    let line = raw.replace(/^\uFEFF/, "").trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;
    line = line.replace(/^export\s+/i, "");

    const eq = line.indexOf("=");
    if (eq > 0) {
      const key = line
        .slice(0, eq)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "_");
      const value = stripQuotes(line.slice(eq + 1).trim());
      if (key) values.set(key, value);
    } else {
      loose.push(line);
    }
  }

  let url = first(values, [
    "SUPABASE_URL",
    "SUPABASE_PROJECT_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "PUBLIC_SUPABASE_URL",
    "NUXT_PUBLIC_SUPABASE_URL",
    "REACT_APP_SUPABASE_URL",
  ]);
  let apiKey = first(values, [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SERVICE_ROLE_KEY",
    "SUPABASE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ANON_KEY",
    "SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "VITE_SUPABASE_ANON_KEY",
  ]);
  let accessToken = first(values, [
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_PAT",
    "ACCESS_TOKEN",
    "SUPABASE_MANAGEMENT_TOKEN",
  ]);
  let projectRef = first(values, [
    "SUPABASE_PROJECT_REF",
    "PROJECT_REF",
    "SUPABASE_REF",
  ]);
  let databaseUrl = first(values, [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "SUPABASE_DATABASE_URL",
  ]);

  for (const value of loose) {
    if (looksLikeDbUrl(value) && !databaseUrl) {
      databaseUrl = value;
    } else if (looksLikeUrl(value) && !url) {
      url = value;
    } else if (looksLikeProjectRef(value) && !url && !projectRef) {
      projectRef = value;
    } else if (!apiKey && !accessToken) {
      apiKey = value;
    } else if (!accessToken) {
      accessToken = value;
    }
  }

  if (isPlaceholderValue(url)) url = "";
  if (isPlaceholderValue(apiKey)) apiKey = "";
  if (isPlaceholderValue(accessToken)) accessToken = "";
  if (isPlaceholderValue(databaseUrl)) databaseUrl = "";

  // Hỗ trợ trường hợp người dùng chỉ dán một token dạng sbp_ vào file.
  if (apiKey.startsWith("sbp_") && !accessToken) {
    accessToken = apiKey;
    apiKey = "";
  }

  url = url.replace(/\/+$/, "");
  if (!projectRef) projectRef = inferProjectRef(url);
  if (!url && projectRef) url = `https://${projectRef}.supabase.co`;

  const apiKeyRole = apiKey ? (apiKey.startsWith("sb_secret_") ? "secret" : decodeJwtRole(apiKey)) : "none";
  const hasApiKey = Boolean(apiKey);
  const hasPat = Boolean(accessToken);
  const hasDatabaseUrl = Boolean(databaseUrl);
  const managementReady = hasPat && Boolean(projectRef);
  const sqlMode = managementReady ? "management-api" : hasDatabaseUrl ? "psql" : "none";
  const sqlEnabled = Boolean(managementReady || hasDatabaseUrl);

  const missing = [];
  if (!url && !hasDatabaseUrl) missing.push("SUPABASE_URL");

  const warnings = [];
  if (!hasApiKey && !hasPat && !hasDatabaseUrl) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY hoặc SUPABASE_ACCESS_TOKEN");
  }
  if (apiKeyRole === "anon") {
    warnings.push(
      "Đang dùng anon/publishable key: PostgREST sẽ bị RLS giới hạn, không phù hợp để sửa/xoá dữ liệu."
    );
  }
  if (hasPat && !projectRef) {
    if (!hasDatabaseUrl) missing.push("SUPABASE_URL hoặc SUPABASE_PROJECT_REF");
    warnings.push(
      "Có SUPABASE_ACCESS_TOKEN nhưng chưa xác định được project ref. Thêm SUPABASE_URL hoặc SUPABASE_PROJECT_REF để chạy SQL qua Management API."
    );
  } else if (!hasPat && !hasDatabaseUrl) {
    warnings.push(
      "Chưa có SUPABASE_ACCESS_TOKEN (PAT) hoặc DATABASE_URL: trình duyệt bảng vẫn dùng được, nhưng chạy SQL/import sẽ bị tắt."
    );
  }
  if (hasPat && !hasApiKey) {
    warnings.push(
      "Chỉ có PAT, chưa có service_role key: có thể chạy SQL nhưng chưa bật trình duyệt/sửa bảng qua PostgREST."
    );
  }
  if (hasApiKey && !hasPat && !hasDatabaseUrl) {
    warnings.push(
      "Muốn import file SQL ngay trong admin, thêm SUPABASE_ACCESS_TOKEN (sbp_...) vào admin/supabase.txt."
    );
  }
  if (hasDatabaseUrl && !url) {
    warnings.push(
      "Chỉ có DATABASE_URL: admin chạy SQL qua psql nhưng không duyệt/sửa bảng qua PostgREST. Thêm SUPABASE_URL + service_role key nếu cần CRUD."
    );
  }

  return {
    url,
    apiKey,
    accessToken,
    projectRef,
    databaseUrl,
    apiKeyRole,
    hasApiKey,
    hasPat,
    hasDatabaseUrl,
    configured: Boolean((url && hasApiKey) || managementReady || hasDatabaseUrl),
    tablesEnabled: Boolean(url && hasApiKey),
    sqlMode,
    sqlEnabled,
    missing,
    warnings,
    configFile: CONFIG_PATH,
  };
};

const readConfig = async () => {
  let text = "";
  try {
    text = await readFile(CONFIG_PATH, "utf8");
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
  return parseConfigText(text);
};

const publicConfig = (config) => ({
  configured: config.configured,
  url: config.url,
  projectRef: config.projectRef,
  hasApiKey: config.hasApiKey,
  hasPat: config.hasPat,
  hasDatabaseUrl: config.hasDatabaseUrl,
  apiKeyRole: config.apiKeyRole,
  tablesEnabled: config.tablesEnabled,
  sqlMode: config.sqlMode,
  sqlEnabled: config.sqlEnabled,
  configFile: config.configFile,
  missing: config.missing,
  warnings: config.warnings,
});

const readBody = (req, limit = MAX_BODY) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let finished = false;

    req.on("data", (chunk) => {
      if (finished) return;
      size += chunk.length;
      if (size > limit) {
        finished = true;
        reject(new HttpError(413, `Dữ liệu gửi lên quá lớn (tối đa ${Math.round(limit / 1024 / 1024)} MB).`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (finished) return;
      finished = true;
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (err) => {
      if (finished) return;
      finished = true;
      reject(err);
    });
  });

const readJson = async (req) => {
  const text = await readBody(req);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Body không phải JSON hợp lệ.");
  }
};

const supabaseHeaders = (config, schema = "public", extra = {}) => {
  const headers = {
    apikey: config.apiKey,
    Accept: "application/json",
    ...extra,
  };
  if (isJwt(config.apiKey)) headers.Authorization = `Bearer ${config.apiKey}`;
  if (schema && schema !== "public") {
    headers["Accept-Profile"] = schema;
    headers["Content-Profile"] = schema;
  }
  return headers;
};

const parseSupabaseError = (data, fallback) => {
  if (data && typeof data === "object") {
    return (
      data.message ||
      data.error_description ||
      data.error ||
      data.hint ||
      data.details ||
      fallback
    );
  }
  if (typeof data === "string" && data.trim()) return data.trim().slice(0, 1000);
  return fallback;
};

const postgrestRequest = async (
  config,
  table,
  { method = "GET", searchParams = null, body, prefer = null } = {}
) => {
  if (!config.hasApiKey) {
    throw new HttpError(
      501,
      "Chưa cấu hình SUPABASE_SERVICE_ROLE_KEY nên không thể xem/sửa bảng qua PostgREST.",
      null,
      "POSTGREST_DISABLED"
    );
  }

  const url = new URL(`${config.url}/rest/v1/${encodeURIComponent(table.name)}`);
  if (searchParams) {
    for (const [key, value] of searchParams) url.searchParams.append(key, value);
  }

  const headers = supabaseHeaders(config, table.schema);
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new HttpError(502, `Không kết nối được Supabase: ${err.message}`);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new HttpError(
      res.status,
      parseSupabaseError(data, `Supabase trả về HTTP ${res.status}.`),
      data
    );
  }

  return { res, data, text };
};

const runManagementQuery = async (config, sql, { readOnly = false } = {}) => {
  if (!config.hasPat) {
    throw new HttpError(
      501,
      "Chưa cấu hình SUPABASE_ACCESS_TOKEN (personal access token dạng sbp_...).",
      null,
      "SQL_NOT_CONFIGURED"
    );
  }
  if (!config.projectRef) {
    throw new HttpError(400, "Không xác định được Supabase project ref từ URL.");
  }

  const started = Date.now();
  let res;
  try {
    res = await fetch(
      `https://api.supabase.com/v1/projects/${config.projectRef}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: sql,
          ...(readOnly ? { read_only: true } : {}),
        }),
        signal: AbortSignal.timeout(120_000),
      }
    );
  } catch (err) {
    throw new HttpError(502, `Không kết nối được Supabase Management API: ${err.message}`);
  }

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new HttpError(
      res.status,
      parseSupabaseError(data, `Management API trả về HTTP ${res.status}.`),
      data
    );
  }

  return {
    data,
    status: res.status,
    durationMs: Date.now() - started,
  };
};

const runPsql = (databaseUrl, sql, { readOnly = false } = {}) =>
  new Promise((resolve, reject) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let settled = false;

    let child;
    try {
      child = spawn(
        "psql",
        [databaseUrl, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", "-w", "-f", "-"],
        { stdio: ["pipe", "pipe", "pipe"], windowsHide: true }
      );
    } catch (err) {
      reject(
        new HttpError(
          501,
          "Không chạy được psql. Hãy cài PostgreSQL client hoặc dùng SUPABASE_ACCESS_TOKEN.",
          err.message,
          "PSQL_NOT_AVAILABLE"
        )
      );
      return;
    }

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      if (err.code === "ENOENT") {
        reject(
          new HttpError(
            501,
            "Không tìm thấy psql trong PATH. Hãy dùng SUPABASE_ACCESS_TOKEN hoặc cài PostgreSQL client.",
            null,
            "PSQL_NOT_AVAILABLE"
          )
        );
      } else {
        reject(new HttpError(502, `Lỗi chạy psql: ${err.message}`));
      }
    });

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      if (code === 0) {
        resolve({
          output: stdout,
          stderr,
          durationMs: Date.now() - started,
        });
      } else {
        reject(
          new HttpError(
            400,
            "psql báo lỗi khi chạy SQL.",
            (stderr || stdout || "").trim().slice(0, 8000),
            "PSQL_ERROR"
          )
        );
      }
    });

    if (!child.stdin) {
      settled = true;
      reject(
        new HttpError(
          501,
          "Không mở được stdin cho psql. Hãy dùng SUPABASE_ACCESS_TOKEN hoặc cài PostgreSQL client.",
          null,
          "PSQL_NOT_AVAILABLE"
        )
      );
      return;
    }

    child.stdin.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(
        new HttpError(
          502,
          `Không ghi được SQL vào psql: ${err.message}`,
          null,
          "PSQL_STDIN_ERROR"
        )
      );
    });

    try {
      child.stdin.end(`${readOnly ? "set default_transaction_read_only = on;\n" : ""}${sql}`);
    } catch (err) {
      if (!settled) {
        settled = true;
        reject(
          new HttpError(
            501,
            "Không chạy được psql. Hãy cài PostgreSQL client hoặc dùng SUPABASE_ACCESS_TOKEN.",
            err.message,
            "PSQL_NOT_AVAILABLE"
          )
        );
      }
    }
  });

const normalizeColumns = (columns) => {
  let list = columns;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((col, index) => ({
      name: String(col.name),
      type: String(col.type || "text"),
      nullable: col.nullable !== false,
      default: col.default ?? null,
      isIdentity: Boolean(col.isIdentity),
      generated: Boolean(col.generated),
      position: Number(col.position || index + 1),
    }))
    .sort((a, b) => a.position - b.position);
};

const introspectViaManagement = async (config) => {
  const columnsSql = `
    select
      c.table_schema as schema,
      c.table_name as name,
      t.table_type as table_type,
      jsonb_agg(
        jsonb_build_object(
          'name', c.column_name,
          'type', case
            when c.data_type = 'USER-DEFINED' then c.udt_name
            when c.data_type = 'ARRAY' then c.udt_name
            else c.data_type
          end,
          'nullable', c.is_nullable = 'YES',
          'default', c.column_default,
          'isIdentity', c.is_identity = 'YES',
          'generated', c.is_generated = 'ALWAYS',
          'position', c.ordinal_position
        )
        order by c.ordinal_position
      ) as columns
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema not in ('pg_catalog', 'information_schema', 'pg_toast', 'extensions')
      and c.table_schema not like 'pg_temp_%'
      and t.table_type in ('BASE TABLE', 'VIEW')
    group by c.table_schema, c.table_name, t.table_type
    order by
      case when c.table_schema = 'public' then 0 else 1 end,
      c.table_schema,
      c.table_name
  `;

  const primaryKeySql = `
    select
      tc.table_schema as schema,
      tc.table_name as name,
      kcu.column_name as column_name,
      kcu.ordinal_position as position
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_schema = tc.constraint_schema
     and kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
     and kcu.table_name = tc.table_name
    where tc.constraint_type = 'PRIMARY KEY'
      and tc.table_schema not in ('pg_catalog', 'information_schema', 'pg_toast', 'extensions')
      and tc.table_schema not like 'pg_temp_%'
    order by tc.table_schema, tc.table_name, kcu.ordinal_position
  `;

  const [columnResult, pkResult] = await Promise.all([
    runManagementQuery(config, columnsSql, { readOnly: true }),
    runManagementQuery(config, primaryKeySql, { readOnly: true }),
  ]);

  const pkMap = new Map();
  for (const row of Array.isArray(pkResult.data) ? pkResult.data : []) {
    const key = `${row.schema}.${row.name}`;
    if (!pkMap.has(key)) pkMap.set(key, []);
    pkMap.get(key).push({ name: row.column_name, position: Number(row.position) });
  }
  for (const list of pkMap.values()) {
    list.sort((a, b) => a.position - b.position);
  }

  const tables = (Array.isArray(columnResult.data) ? columnResult.data : [])
    .map((row) => {
      const key = `${row.schema}.${row.name}`;
      const columns = normalizeColumns(row.columns);
      return {
        schema: row.schema,
        name: row.name,
        kind: row.table_type === "VIEW" ? "view" : "table",
        isSystem: SYSTEM_SCHEMAS.has(row.schema),
        columns,
        primaryKey: (pkMap.get(key) || []).map((item) => item.name),
        primaryKeyGuessed: false,
      };
    })
    .filter((table) => table.columns.length > 0);

  return { tables, source: "management-api", warnings: [] };
};

const postgrestType = (prop) => {
  if (!prop) return "text";
  if (prop.$ref) return "text";
  if (prop.format) return String(prop.format);
  if (prop.type === "array") return "array";
  if (prop.type) return String(prop.type);
  return "text";
};

const introspectViaPostgrest = async (config) => {
  if (!config.hasApiKey) {
    throw new HttpError(
      501,
      "Chưa cấu hình service_role key để đọc danh sách bảng.",
      null,
      "POSTGREST_DISABLED"
    );
  }

  let res;
  try {
    res = await fetch(`${config.url}/rest/v1/`, {
      headers: supabaseHeaders(config),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw new HttpError(502, `Không đọc được PostgREST OpenAPI: ${err.message}`);
  }

  const text = await res.text();
  let spec = null;
  try {
    spec = text ? JSON.parse(text) : null;
  } catch {
    spec = null;
  }
  if (!res.ok || !spec) {
    throw new HttpError(
      res.status || 502,
      parseSupabaseError(spec, "Không đọc được PostgREST OpenAPI."),
      spec
    );
  }

  const paths = spec.paths && typeof spec.paths === "object" ? spec.paths : {};
  const definitions =
    spec.definitions && typeof spec.definitions === "object" ? spec.definitions : {};

  const tables = [];
  for (const path of Object.keys(paths)) {
    if (!path.startsWith("/") || path === "/" || path.startsWith("/rpc/")) continue;
    const name = path.slice(1);
    if (!name || name.includes("/")) continue;

    const definition =
      definitions[name] ||
      definitions[`public.${name}`] ||
      Object.entries(definitions).find(([key]) => key.endsWith(`.${name}`))?.[1];
    if (!definition || definition.type !== "object") continue;

    const required = new Set(Array.isArray(definition.required) ? definition.required : []);
    const properties =
      definition.properties && typeof definition.properties === "object"
        ? definition.properties
        : {};

    const primaryKey = [];
    let primaryKeyGuessed = false;

    for (const [columnName, prop] of Object.entries(properties)) {
      const description = String(prop?.description || "");
      if (description.includes("<pk/>")) primaryKey.push(columnName);
    }

    const columns = Object.entries(properties).map(([columnName, prop], index) => ({
      name: columnName,
      type: postgrestType(prop),
      nullable: !required.has(columnName),
      default: null,
      isIdentity: false,
      generated: false,
      position: index + 1,
    }));

    if (primaryKey.length === 0 && properties.id) {
      primaryKey.push("id");
      primaryKeyGuessed = true;
    }

    tables.push({
      schema: "public",
      name,
      kind: "table",
      isSystem: false,
      columns,
      primaryKey,
      primaryKeyGuessed,
    });
  }

  tables.sort((a, b) => a.name.localeCompare(b.name));
  return {
    tables,
    source: "postgrest",
    warnings: [
      "Đang đọc danh sách bảng qua PostgREST OpenAPI. Chỉ các schema được expose mới hiển thị; thêm PAT để thấy đầy đủ schema và khóa chính chính xác.",
    ],
  };
};

const loadSchema = async (config, { force = false } = {}) => {
  if (!config.hasApiKey) {
    throw new HttpError(
      501,
      "Chưa cấu hình service_role key nên không thể mở trình duyệt bảng.",
      null,
      "TABLES_DISABLED"
    );
  }

  const cacheKey = `${config.url}|${Boolean(config.hasApiKey)}|${Boolean(config.hasPat)}`;
  if (!force && schemaCache.key === cacheKey && Date.now() - schemaCache.at < SCHEMA_CACHE_MS) {
    return schemaCache.value;
  }

  let result;
  if (config.hasPat) {
    try {
      result = await introspectViaManagement(config);
    } catch (err) {
      console.warn("[admin] PAT introspection failed, falling back to PostgREST:", err.message);
      result = await introspectViaPostgrest(config);
      result.warnings = [
        `Không đọc được schema qua Management API (${err.message}); đã fallback sang PostgREST.`,
        ...result.warnings,
      ];
    }
  } else {
    result = await introspectViaPostgrest(config);
  }

  const schemas = [...new Set(result.tables.map((table) => table.schema))].sort((a, b) => {
    if (a === "public") return -1;
    if (b === "public") return 1;
    return a.localeCompare(b);
  });

  schemaCache = {
    key: cacheKey,
    at: Date.now(),
    value: { ...result, schemas, cachedAt: new Date().toISOString() },
  };
  return schemaCache.value;
};

const findTable = async (config, schemaName, tableName, { force = false } = {}) => {
  const schema = await loadSchema(config, { force });
  const table = schema.tables.find(
    (item) => item.schema === schemaName && item.name === tableName
  );
  if (!table) {
    throw new HttpError(404, `Không tìm thấy bảng ${schemaName}.${tableName}.`);
  }
  return table;
};

const parseInteger = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const isTextColumn = (column) =>
  /char|text|string|uuid|citext|name/i.test(column.type) && !/json/i.test(column.type);

const safeIdentifier = (name) => /^[A-Za-z_][A-Za-z0-9_$]*$/.test(name);

const sanitizeSearch = (value) =>
  String(value || "")
    .trim()
    .replace(/[(),*]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 200);

const quoteFilterValue = (value) => {
  const text = String(value);
  if (text === "") return '""';
  if (/[,"()\\]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
  }
  return text;
};

const buildFilters = (table, keys) => {
  if (!keys || typeof keys !== "object" || Array.isArray(keys)) {
    throw new HttpError(400, "Thiếu object keys để xác định dòng.");
  }

  const params = new URLSearchParams();
  for (const [columnName, value] of Object.entries(keys)) {
    const column = table.columns.find((item) => item.name === columnName);
    if (!column) {
      throw new HttpError(400, `Cột không tồn tại: ${columnName}`);
    }
    if (value === null || value === undefined) {
      params.append(columnName, "is.null");
    } else if (typeof value === "number" || typeof value === "boolean") {
      params.append(columnName, `eq.${value}`);
    } else if (typeof value === "object") {
      params.append(columnName, `eq.${quoteFilterValue(JSON.stringify(value))}`);
    } else {
      params.append(columnName, `eq.${quoteFilterValue(value)}`);
    }
  }

  if (![...params.keys()].length) {
    throw new HttpError(400, "Không có khóa nào để xác định dòng.");
  }
  return params;
};

const sanitizeValues = (table, values) => {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new HttpError(400, "Thiếu object values.");
  }

  const clean = {};
  for (const [columnName, value] of Object.entries(values)) {
    const column = table.columns.find((item) => item.name === columnName);
    if (!column) {
      throw new HttpError(400, `Cột không tồn tại: ${columnName}`);
    }
    if (column.isIdentity || column.generated) {
      throw new HttpError(
        400,
        `Cột ${columnName} là identity/generated, không thể ghi trực tiếp.`
      );
    }
    clean[columnName] = value;
  }

  if (Object.keys(clean).length === 0) {
    throw new HttpError(400, "Không có trường nào để ghi.");
  }
  return clean;
};

const parseOrder = (table, order) => {
  if (!order) return null;
  const match = /^([A-Za-z_][A-Za-z0-9_$]*)\.(asc|desc)$/i.exec(order);
  if (!match) return null;
  if (!table.columns.some((column) => column.name === match[1])) return null;
  return `${match[1]}.${match[2].toLowerCase()}`;
};

const defaultOrder = (table) => {
  const preferred = ["name", "province_name", "code", "slug"];
  for (const name of preferred) {
    if (table.columns.some((column) => column.name === name)) return `${name}.asc`;
  }
  if (table.primaryKey.length > 0) return `${table.primaryKey[0]}.asc`;
  if (table.columns.length > 0) return `${table.columns[0].name}.asc`;
  return null;
};

const parseContentRange = (value) => {
  const match = /(?:^|\/)(\d+|\*)$/.exec(String(value || ""));
  if (!match || match[1] === "*") return null;
  const total = Number(match[1]);
  return Number.isFinite(total) ? total : null;
};

const getTableParams = (url) => {
  const schema = url.searchParams.get("schema") || "public";
  const table = url.searchParams.get("table") || "";
  if (!table) throw new HttpError(400, "Thiếu tham số table.");
  return { schema, table };
};

const listTables = async (config, url) => {
  const force = url.searchParams.get("refresh") === "1";
  if (force) schemaCache = { key: "", at: 0, value: null };
  const schema = await loadSchema(config, { force });
  return {
    ok: true,
    source: schema.source,
    tables: schema.tables,
    schemas: schema.schemas,
    warnings: schema.warnings,
    cachedAt: schema.cachedAt,
  };
};

const getRows = async (config, url) => {
  const { schema, table } = getTableParams(url);
  const tableInfo = await findTable(config, schema, table);
  const limit = parseInteger(url.searchParams.get("limit"), 50, 1, 500);
  const offset = parseInteger(url.searchParams.get("offset"), 0, 0, 10_000_000);
  const order = parseOrder(tableInfo, url.searchParams.get("order")) || defaultOrder(tableInfo);
  const search = sanitizeSearch(url.searchParams.get("q"));

  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (order) params.set("order", order);

  if (search) {
    const textColumns = tableInfo.columns.filter(
      (column) => isTextColumn(column) && safeIdentifier(column.name)
    );
    if (textColumns.length > 0) {
      params.set(
        "or",
        `(${textColumns
          .map((column) => `${column.name}.ilike.*${search}*`)
          .join(",")})`
      );
    }
  }

  const { res, data } = await postgrestRequest(config, tableInfo, {
    searchParams: params,
    prefer: "count=exact",
  });

  const rows = Array.isArray(data) ? data : [];
  return {
    ok: true,
    schema,
    table,
    rows,
    columns: tableInfo.columns,
    primaryKey: tableInfo.primaryKey,
    primaryKeyGuessed: tableInfo.primaryKeyGuessed,
    total: parseContentRange(res.headers.get("content-range")),
    limit,
    offset,
    order,
    search,
  };
};

const insertRow = async (config, body) => {
  const { schema, table } = body;
  if (!table) throw new HttpError(400, "Thiếu table.");
  const tableInfo = await findTable(config, schema || "public", table);
  const values = sanitizeValues(tableInfo, body.values);
  const { data } = await postgrestRequest(config, tableInfo, {
    method: "POST",
    body: [values],
    prefer: "return=representation",
  });
  return { ok: true, rows: Array.isArray(data) ? data : [] };
};

const updateRow = async (config, body) => {
  const { schema, table } = body;
  if (!table) throw new HttpError(400, "Thiếu table.");
  const tableInfo = await findTable(config, schema || "public", table);
  const values = sanitizeValues(tableInfo, body.values);
  const filters = buildFilters(tableInfo, body.keys);
  const { data } = await postgrestRequest(config, tableInfo, {
    method: "PATCH",
    searchParams: filters,
    body: values,
    prefer: "return=representation",
  });
  return { ok: true, rows: Array.isArray(data) ? data : [] };
};

const deleteRow = async (config, body) => {
  const { schema, table } = body;
  if (!table) throw new HttpError(400, "Thiếu table.");
  const tableInfo = await findTable(config, schema || "public", table);
  const filters = buildFilters(tableInfo, body.keys);
  const { data } = await postgrestRequest(config, tableInfo, {
    method: "DELETE",
    searchParams: filters,
    prefer: "return=representation",
  });
  return { ok: true, rows: Array.isArray(data) ? data : [] };
};

const runSql = async (config, body) => {
  const sql = String(body.sql || "").replace(/^\uFEFF/, "");
  if (!sql.trim()) throw new HttpError(400, "SQL đang trống.");
  if (Buffer.byteLength(sql, "utf8") > MAX_BODY) {
    throw new HttpError(413, "File SQL quá lớn (tối đa 10 MB).");
  }
  if (body.confirm !== "RUN_SQL") {
    throw new HttpError(400, "Thiếu xác nhận chạy SQL (confirm: 'RUN_SQL').");
  }

  const readOnly = Boolean(body.readOnly);

  if (config.hasPat && config.projectRef) {
    const result = await runManagementQuery(config, sql, { readOnly });
    return {
      ok: true,
      method: "management-api",
      durationMs: result.durationMs,
      rows: Array.isArray(result.data) ? result.data : [],
      raw: result.data,
    };
  }

  if (config.hasDatabaseUrl) {
    const result = await runPsql(config.databaseUrl, sql, { readOnly });
    return {
      ok: true,
      method: "psql",
      durationMs: result.durationMs,
      rows: [],
      output: result.output,
      stderr: result.stderr,
    };
  }

  throw new HttpError(
    501,
    "Chưa cấu hình SUPABASE_ACCESS_TOKEN (PAT) hoặc DATABASE_URL nên không thể chạy SQL.",
    {
      hint:
        "Tạo personal access token tại https://supabase.com/dashboard/account/tokens rồi thêm dòng SUPABASE_ACCESS_TOKEN=sbp_... vào admin/supabase.txt. Nếu chưa có PAT, bạn vẫn có thể sao chép SQL và dán vào Supabase SQL Editor.",
    },
    "SQL_NOT_CONFIGURED"
  );
};

const serveStatic = async (res, pathname) => {
  let targetPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(PUBLIC_ROOT, targetPath));
  if (!filePath.startsWith(PUBLIC_ROOT + sep) && filePath !== PUBLIC_ROOT) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  let target = filePath;
  try {
    const info = await stat(target);
    if (info.isDirectory()) target = join(target, "index.html");
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>Không tìm thấy trang.</p>");
    return;
  }

  let body;
  try {
    body = await readFile(target);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404</h1><p>Không tìm thấy trang.</p>");
    return;
  }

  const ext = extname(target).toLowerCase();
  const headers = {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
  };
  if (ext === ".html") {
    headers["Content-Security-Policy"] =
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
  }
  res.writeHead(200, headers);
  res.end(body);
};

const checkHost = (req, res) => {
  const raw = String(req.headers.host || "").trim().toLowerCase();
  if (!raw) {
    json(res, 400, { ok: false, error: "Thiếu Host header." });
    return false;
  }

  let hostname = raw;
  if (raw.startsWith("[")) {
    const end = raw.indexOf("]");
    hostname = end >= 0 ? raw.slice(0, end + 1) : raw;
  } else {
    hostname = raw.split(":")[0];
  }

  const allowed = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
  if (HOST && HOST !== "0.0.0.0" && HOST !== "::") {
    allowed.add(String(HOST).toLowerCase());
  }

  if (!allowed.has(hostname)) {
    json(res, 403, {
      ok: false,
      error: "Host không được phép. Hãy mở admin qua 127.0.0.1 hoặc localhost.",
    });
    return false;
  }
  return true;
};

const checkOrigin = (req, res) => {
  const origin = req.headers.origin;
  if (!origin) return true;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    json(res, 403, { ok: false, error: "Origin không hợp lệ." });
    return false;
  }
  const allowed = new Set([
    req.headers.host,
    `127.0.0.1:${PORT}`,
    `localhost:${PORT}`,
    `[::1]:${PORT}`,
  ]);
  if (!allowed.has(originHost)) {
    json(res, 403, { ok: false, error: "Origin không được phép." });
    return false;
  }
  return true;
};

const server = createServer(async (req, res) => {
  const started = Date.now();
  let pathname = "/";

  try {
    const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${PORT}`}`);
    pathname = decodeURIComponent(url.pathname);

    if (!checkHost(req, res)) return;

    if (req.method === "OPTIONS") {
      res.writeHead(204, { Allow: "GET,POST,PATCH,DELETE,OPTIONS" });
      res.end();
      return;
    }

    if (pathname === "/api/health") {
      json(res, 200, { ok: true, version: VERSION, time: new Date().toISOString() });
      return;
    }

    if (!pathname.startsWith("/api/")) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        res.writeHead(405, { Allow: "GET,HEAD" }).end("Method Not Allowed");
        return;
      }
      await serveStatic(res, pathname);
      return;
    }

    if (!checkOrigin(req, res)) return;
    if (!req.headers["x-admin-request"]) {
      json(res, 400, {
        ok: false,
        error: "Thiếu header X-Admin-Request. Hãy mở admin qua server local.",
      });
      return;
    }

    const config = await readConfig();

    if (pathname === "/api/meta" && req.method === "GET") {
      json(res, 200, {
        ok: true,
        version: VERSION,
        config: publicConfig(config),
      });
      return;
    }

    if (pathname === "/api/tables" && req.method === "GET") {
      const result = await listTables(config, url);
      json(res, 200, { ...result, config: publicConfig(config) });
      return;
    }

    if (pathname === "/api/table" && req.method === "GET") {
      const result = await getRows(config, url);
      json(res, 200, result);
      return;
    }

    if (pathname === "/api/table" && req.method === "POST") {
      const body = await readJson(req);
      const result = await insertRow(config, body);
      json(res, 200, result);
      return;
    }

    if (pathname === "/api/table" && req.method === "PATCH") {
      const body = await readJson(req);
      const result = await updateRow(config, body);
      json(res, 200, result);
      return;
    }

    if (pathname === "/api/table" && req.method === "DELETE") {
      const body = await readJson(req);
      const result = await deleteRow(config, body);
      json(res, 200, result);
      return;
    }

    if (pathname === "/api/sql" && req.method === "POST") {
      const body = await readJson(req);
      const result = await runSql(config, body);
      json(res, 200, result);
      return;
    }

    json(res, 404, { ok: false, error: "API không tồn tại." });
  } catch (err) {
    errorResponse(res, err);
  } finally {
    if (pathname.startsWith("/api/")) {
      const status = res.statusCode || 500;
      console.log(
        `[admin] ${req.method} ${pathname} -> ${status} (${Date.now() - started}ms)`
      );
    }
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n[admin] Cổng ${PORT} đang được dùng. Đổi cổng bằng ADMIN_PORT=...`);
  } else {
    console.error("[admin] server error:", err);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, async () => {
  const config = await readConfig();
  console.log("");
  console.log("  NotDore Admin");
  console.log(`  → http://${HOST}:${PORT}`);
  console.log(`  Config: ${CONFIG_PATH}`);
  console.log(
    `  Chế độ: ${config.hasApiKey ? "CRUD" : "không CRUD"}${
      config.sqlEnabled ? ` + SQL (${config.sqlMode})` : " + SQL tắt"
    }`
  );
  if (!config.configured) {
    console.log("  Chưa cấu hình. Tạo admin/supabase.txt từ admin/supabase.example.txt.");
  }
  console.log("");
});

const shutdown = () => {
  console.log("\n[admin] Đang dừng server...");
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
