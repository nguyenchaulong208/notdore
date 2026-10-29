/**
 * db.js — lớp truy cập dữ liệu duy nhất cho frontend.
 *
 * Thứ tự ưu tiên:
 *   1. Supabase (nếu config.js có supabaseUrl + supabaseAnonKey và đã nạp supabase-js)
 *   2. Supabase REST API (nguồn dữ liệu chính).
 *   - public.communes: 3,321 đơn vị (xã/phường/đặc khu)
 *   - public.admin_unit_history: 317 bản ghi beforeNames
 *   - public.admin_units: 34 đơn vị cấp tỉnh
 *
 * Mọi hàm trả về CÙNG một cấu trúc dù dữ liệu đến từ đâu, nên phần render
 * không cần biết nguồn. Kết quả được cache trong bộ nhớ cho mỗi lần tải trang.
 */
(function (global) {
  'use strict';

  const cfg = global.NOTDORE_CONFIG || {};
  const SCRIPT = document.currentScript;
  const ROOT = new URL('../../', SCRIPT ? SCRIPT.src : location.href);

  const cache = new Map();
  let client = null;

  const memo = (key, producer) => {
    if (!cache.has(key)) cache.set(key, Promise.resolve().then(producer));
    return cache.get(key);
  };

  const isSupabaseReady = () => Boolean(
    cfg.supabaseUrl && cfg.supabaseAnonKey && global.supabase && global.supabase.createClient
  );

  let warnedMissingSdk = false;

  /** Chờ config.js nạp xong /api/config trước khi quyết định dùng Supabase. */
  const ensureConfig = async () => {
    if (global.NOTDORE_CONFIG_READY) {
      try {
        await global.NOTDORE_CONFIG_READY;
      } catch {
        // config.js đã ghi log; tiếp tục với JSON tĩnh.
      }
    }

    if (cfg.supabaseUrl && cfg.supabaseAnonKey && !global.supabase && !warnedMissingSdk) {
      warnedMissingSdk = true;
      console.warn('[db] Đã cấu hình Supabase nhưng chưa nạp supabase-js.');
    }
    return cfg;
  };

  const getClient = () => {
    if (!client) client = global.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    return client;
  };

  const fetchJSON = async (path) => {
    const res = await fetch(new URL(path, ROOT), { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Không tải được ${path} (HTTP ${res.status})`);
    return res.json();
  };

  /** Chuẩn hoá row Supabase -> shape dùng chung với JSON */
  const mapTool = (row) => ({
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    url: row.url,
    externalUrl: row.external_url,
    tags: row.tags || [],
    status: row.status || 'ready',
    featured: Boolean(row.featured),
    sortOrder: row.sort_order ?? 0,
  });

  const COMMUNE_TYPE_LABELS = {
    xa: 'Xã',
    phuong: 'Phường',
    dac_ku: 'Đặc khu',
  };

  /**
   * Chuẩn hoá record cấp xã từ Supabase hoặc JSON.
   *
   * Cơ sở dữ liệu mới: public.communes
   * Cột: code, name, province_code, province_name, level_code,
   *       before_names, before_names_str, status, source, note
   *
   * Giao diện đọc sẵn các trường tuỳ chọn sau:
   *   - beforeNames / before_names / before.names: tên xã/phường cũ
   *   - beforeProvinceName / before.province_name: tỉnh cũ (nếu khác tỉnh hiện tại)
   *   - changed: true/false nếu đã xác định được trạng thái
   */
  const normalizeCommune = (commune) => {
    const before = commune.before && typeof commune.before === 'object'
      ? commune.before
      : {};
    const rawBefore = commune.beforeNames
      ?? commune.before_names
      ?? before.names
      ?? before.name
      ?? [];
    const beforeNames = (Array.isArray(rawBefore) ? rawBefore : [rawBefore])
      .filter(Boolean)
      .map((name) => String(name));

    let changed = commune.changed;
    if (changed === 'true') changed = true;
    if (changed === 'false') changed = false;

    return {
      ...commune,
      typeLabel: commune.typeLabel || COMMUNE_TYPE_LABELS[commune.type] || commune.type || null,
      beforeNames,
      beforeProvinceName: commune.beforeProvinceName
        || commune.before_province_name
        || before.province_name
        || before.provinceName
        || null,
      changed: changed ?? (beforeNames.length ? true : null),
    };
  };

  const mapCommune = (row) => {
    return normalizeCommune({
      code: row.code,
      name: row.name,
      type: row.level_code,
      typeLabel: COMMUNE_TYPE_LABELS[row.level_code] || row.level_code,
      provinceCode: row.province_code,
      provinceName: row.province_name,
      parentId: null,
      beforeNames: Array.isArray(row.before_names)
        ? row.before_names
        : (row.before_names_str ? row.before_names_str.split(', ').filter(Boolean) : null),
      beforeProvinceName: null,
      changed: row.status === 'merged' ? true : (row.status === 'unchanged' ? false : null),
      note: row.note || null,
    });
  };

  const computeCommuneStats = (rows) => ({
    total: rows.length,
    xa: rows.filter((row) => row.level_code === 'xa').length,
    phuong: rows.filter((row) => row.level_code === 'phuong').length,
    dac_ku: rows.filter((row) => row.level_code === 'dac_ku').length,
  });

  const mapProvince = (row, changedCodes) => ({
    code: row.code,
    name: row.name,
    type: row.type,
    region: row.region,
    centrallyRun: Boolean(row.centrally_run),
    capital: row.capital,
    population: row.population,
    areaKm2: row.area_km2 === null ? null : Number(row.area_km2),
    mergedFrom: row.merged_from ? String(row.merged_from).split(',').map((s) => s.trim()).filter(Boolean) : [],
    changed: changedCodes ? changedCodes.has(row.code) : null,
    renamedFrom: null,
    note: row.note,
    predecessorsRaw: null,
  });

  /* ── Catalog: danh mục + công cụ + link ngoài ─────────────────────── */
  const getCatalog = () => memo('catalog', async () => {
    await ensureConfig();

    if (!isSupabaseReady()) {
      throw new Error('Supabase chưa được cấu hình');
    }

    const sb = getClient();
    const [cats, tools] = await Promise.all([
      sb.from('tool_categories').select('*').order('sort_order'),
      sb.from('tools').select('*').order('sort_order'),
    ]);
    if (cats.error) throw cats.error;
    if (tools.error) throw tools.error;
    if (!tools.data?.length) throw new Error('Bảng tools rỗng');

    return {
      version: 1,
      categories: cats.data.map((c) => ({
        id: c.id, name: c.name, description: c.description,
        icon: c.icon, sortOrder: c.sort_order,
      })),
      tools: tools.data.map(mapTool),
      external: [
        { name: 'Google Sheets', url: 'https://sheets.google.com', group: 'Bảng tính', note: 'Bảng tính cộng tác, có QUERY/IMPORTDATA mạnh.', icon: 'fa-table' },
        { name: 'Excel Online', url: 'https://www.office.com/launch/excel', group: 'Bảng tính', note: 'Bản web của Excel, mở file lớn nhanh.', icon: 'fa-file-excel' },
        { name: 'Power BI', url: 'https://app.powerbi.com', group: 'Bi & Báo cáo', note: 'Dashboard tương tác, xuất bản web.', icon: 'fa-chart-bar' },
        { name: 'Supabase', url: 'https://supabase.com', group: 'Cơ sở dữ liệu', note: 'Backend-as-a-service, PostgreSQL + API.', icon: 'fa-database' },
        { name: 'Vercel', url: 'https://vercel.com', group: 'Triển khai', note: 'Deploy static site nhanh.', icon: 'fa-cloud-upload-alt' },
        { name: 'GitHub', url: 'https://github.com', group: 'Mã nguồn', note: 'Quản lý code, CI/CD.', icon: 'fa-code-branch' },
      ],
      source: 'supabase',
    };
  }),

getAdminDivisions = () => memo('admin', async () => {
    await ensureConfig();

    if (!isSupabaseReady()) {
      throw new Error('Supabase chưa được cấu hình');
    }

    const sb = getClient();
    const [units, history] = await Promise.all([
      sb.from('admin_units').select('*'),
      sb.from('admin_unit_history').select('*'),
    ]);
    if (units.error) throw units.error;
    if (history.error) throw history.error;

    const provinces = (units.data || []).map((u) => ({
      code: u.code,
      name: u.name,
      type: u.type_code,
      region: u.region || '',
      merged: u.changed || false,
      renamedFrom: null,
    }));

    const renamed = new Map();
    for (const h of history.data || []) {
      if (h.old_name && h.old_name !== h.new_code) {
        renamed.set(h.new_code, h.old_name);
      }
    }

    const provincesWithRename = provinces.map((p) => {
      const old = renamed.get(p.code);
      p.renamedFrom = old && !p.name.toLowerCase().includes(old.toLowerCase()) ? old : null;
      return p;
    });

    const computeStats = (provinces, history) => ({
      before: history.length,
      after: provinces.length,
      merged: provinces.filter((p) => p.merged).length,
      unchanged: provinces.filter((p) => !p.merged).length,
    });

    return {
      meta: { stats: computeStats(provincesWithRename, history.data || []) },
      provinces: provincesWithRename,
      history: (history.data || []).map((h) => ({
        oldName: h.old_name, oldType: h.old_type, newCode: h.new_code,
        newName: provinces.find((p) => p.code === h.new_code)?.name ?? null,
        changed: Boolean(h.changed), note: h.note,
      })),
      source: 'supabase',
    };
  }),

getCommunes = () => memo('communes', async () => {
    await ensureConfig();

    // Supabase là nguồn chính. Chỉ tải JSON khi chưa cấu hình Supabase
    // hoặc khi truy vấn Supabase thất bại.
    if (isSupabaseReady()) {
      try {
        const sb = getClient();
        const pageSize = 1000;
        const rows = [];

        // Cơ sở dữ liệu mới: public.communes (3,321 đơn vị)
        // Cột: code, name, province_code, province_name, level_code,
        //       before_names, before_names_str, status, source, note
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await sb
            .from('communes')
            .select('code,name,province_code,province_name,level_code,before_names,before_names_str,status,source,note')
            .order('province_code')
            .order('code')
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data?.length) break;
          rows.push(...data);
          if (data.length < pageSize) break;
        }

        if (!rows.length) throw new Error('Bảng communes chưa có dữ liệu cấp xã');

        return {
          meta: {
            title: 'Danh sách xã, phường, đặc khu',
            effectiveFrom: '2025-07-01',
            stats: computeCommuneStats(rows),
          },
          provinces: [],
          communes: rows.map(mapCommune),
          source: 'supabase',
        };
      } catch (err) {
        console.error('[db] Supabase lỗi khi tải cấp xã:', err.message || err);
        throw err;
      }
    }

    throw new Error('Supabase chưa được cấu hình');
  });

  const computeStats = (provinces, history) => ({
    before: history.length,
    after: provinces.length,
    unchanged: history.filter((h) => !h.changed).length,
    merged: history.filter((h) => h.changed).length,
    mergedUnits: provinces.filter((p) => p.changed).length,
  });

  global.NotDoreDB = {
    ROOT,
    isSupabaseReady,
    getCatalog,
    getAdminDivisions,
    getCommunes,
    /** Tiện ích dùng chung cho các trang */
    util: {
      escapeHtml: (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
      /** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu */
      normalize: (s) => String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim(),
      /** Tách thành các từ đã bỏ dấu: "Hoá đơn VAT" -> ["hoa","don","vat"] */
      tokenize: (s) => String(s ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
      /**
       * So khớp theo TỪ, tránh lỗi "hoa" khớp "hoặc".
       * - Một từ khoá: khớp tiền tố (gõ "dia" ra "địa giới").
       * - Nhiều từ khoá: các từ trước phải khớp chính xác, từ cuối được phép khớp tiền tố.
       */
      matches: (text, q) => {
        const qw = global.NotDoreDB.util.tokenize(q);
        if (!qw.length) return true;
        const words = global.NotDoreDB.util.tokenize(text);
        return qw.every((w, i) => {
          const last = i === qw.length - 1;
          return words.some((x) => (last ? x.startsWith(w) : x === w));
        });
      },
      formatNumber: (n) => (n === null || n === undefined || n === '')
        ? '—'
        : new Intl.NumberFormat('vi-VN').format(n),
    },
  };
})(window);
