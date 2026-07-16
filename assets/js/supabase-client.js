const SUPABASE = {
  url: "https://thmvaufuaxfoflyndrcq.supabase.co",
  key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobXZhdWZ1YXhmb2ZseW5kcmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjY2NzMsImV4cCI6MjA5OTY0MjY3M30.aHbFvIVjSzTItZWfbwkAGgIkTqoX9sOc-gl4gCFu2hg",

  async init() {
    // HTML thuần: không cần fetch env
    return true;
  },

  headers() {
    return {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
    };
  },

  async query(table, params = {}) {
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
