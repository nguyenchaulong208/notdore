/**
 * db.js — lớp truy cập dữ liệu duy nhất cho frontend.
 *
 * Thứ tự ưu tiên:
 *   1. Supabase (nếu config.js có supabaseUrl + supabaseAnonKey và đã nạp supabase-js)
 *   2. File JSON tĩnh trong assets/data/ (fallback, cũng là nguồn seed)
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
    const local = await fetchJSON('assets/data/tools.json');

    if (!isSupabaseReady()) return { ...local, source: 'local' };

    try {
      const sb = getClient();
      const [cats, tools] = await Promise.all([
        sb.from('tool_categories').select('*').order('sort_order'),
        sb.from('tools').select('*').order('sort_order'),
      ]);
      if (cats.error) throw cats.error;
      if (tools.error) throw tools.error;
      if (!tools.data?.length) throw new Error('Bảng tools rỗng');

      return {
        version: local.version ?? 1,
        categories: cats.data.map((c) => ({
          id: c.id, name: c.name, description: c.description,
          icon: c.icon, sortOrder: c.sort_order,
        })),
        tools: tools.data.map(mapTool),
        external: local.external ?? [],
        source: 'supabase',
      };
    } catch (err) {
      console.warn('[db] Supabase lỗi, dùng dữ liệu tĩnh:', err.message || err);
      return { ...local, source: 'local', degraded: true };
    }
  });

  /* ── Địa giới hành chính ──────────────────────────────────────────── */
  const getAdminDivisions = () => memo('admin', async () => {
    const local = await fetchJSON('assets/data/admin-merger.json');

    if (!isSupabaseReady()) return { ...local, source: 'local' };

    try {
      const sb = getClient();
      const [units, history] = await Promise.all([
        sb.from('admin_units').select('*').order('name'),
        sb.from('admin_unit_history').select('*').order('old_name'),
      ]);
      if (units.error) throw units.error;
      if (history.error) throw history.error;
      if (!units.data?.length) throw new Error('Bảng admin_units rỗng');

      const changedCodes = new Set(history.data.filter((h) => h.changed).map((h) => h.new_code));
      const renamed = new Map(
        history.data.filter((h) => !h.changed).map((h) => [h.new_code, h.old_name])
      );

      const provinces = units.data.map((row) => {
        const p = mapProvince(row, changedCodes);
        const old = renamed.get(p.code);
        // Chỉ coi là "đổi tên" khi tên cũ khác tên mới (bỏ tiền tố loại đơn vị)
        p.renamedFrom = old && !p.name.toLowerCase().includes(old.toLowerCase()) ? old : null;
        return p;
      });

      return {
        meta: { ...local.meta, stats: computeStats(provinces, history.data) },
        provinces,
        history: history.data.map((h) => ({
          oldName: h.old_name, oldType: h.old_type, newCode: h.new_code,
          newName: provinces.find((p) => p.code === h.new_code)?.name ?? null,
          changed: Boolean(h.changed), note: h.note,
        })),
        source: 'supabase',
      };
    } catch (err) {
      console.warn('[db] Supabase lỗi, dùng dữ liệu tĩnh:', err.message || err);
      return { ...local, source: 'local', degraded: true };
    }
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
    /** Tiện ích dùng chung cho các trang */
    util: {
      escapeHtml: (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
      /** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu */
      normalize: (s) => String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim(),
      /** Tách thành các từ đã bỏ dấu: "Hoá đơn VAT" -> ["hoa","don","vat"] */
      tokenize: (s) => String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
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
