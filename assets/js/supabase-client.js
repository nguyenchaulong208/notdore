const SUPABASE = {
  url: '',
  key: '',

  async init() {
    if (this.url) return;

    try {
      const res = await fetch('/api/env');
      const cfg = await res.json();

      this.url = cfg.url || '';
      this.key = cfg.key || '';

      if (!this.url || !this.key) {
        console.warn('[NotDore] Không lấy được SUPABASE_URL hoặc SUPABASE_ANON_KEY từ API env.');
      }
    } catch (e) {
      console.error('Không thể load Supabase config:', e);
    }
  },

  headers() {
    return {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
    };
  },

  async query(table, params = {}) {
    if (!this.url) throw new Error('Supabase chưa được khởi tạo');

    const query = new URLSearchParams();

    if (params.select) query.set('select', params.select);
    if (params.eq) query.set(params.eq[0], `eq.${params.eq[1]}`);
    if (params.in) query.set(params.in[0], `in.(${params.in[1].join(',')})`);
    if (params.single) query.set('limit', '1');

    const qs = query.toString();

    const res = await fetch(`${this.url}/rest/v1/${table}${qs ? '?' + qs : ''}`, {
      headers: this.headers(),
    });

    const data = await res.json();
    return params.single ? data[0] || null : data;
  },
};
