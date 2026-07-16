const SUPABASE = {
  url: '',
  key: '',

  async init() {
    if (this.url) return;
    try {
      const res = await fetch('/api/env');
      const text = await res.text();
      const matchUrl = text.match(/window\.SUPABASE_URL\s*=\s*"([^"]*)"/);
      const matchKey = text.match(/window\.SUPABASE_ANON_KEY\s*=\s*"([^"]*)"/);
      this.url = matchUrl ? matchUrl[1] : '';
      this.key = matchKey ? matchKey[1] : '';
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
