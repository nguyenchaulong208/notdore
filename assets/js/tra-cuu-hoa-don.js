const $ = (id) => document.getElementById(id);
  let INVOICE_LINKS = [];
  let currentFilter = 'all';

  async function loadData() {
    // Try Supabase first
    try {
      const cfg = window.NOTDORE_CONFIG || {};
      if (cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase) {
        const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
        const { data, error } = await client.from('invoice_links').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length) {
          INVOICE_LINKS = data.map(d => ({ name: d.name, type: d.type, url: d.url, note: d.note }));
          initFilterTypes();
          renderLinks();
          return;
        }
      }
    } catch (e) {
      console.info('Supabase not available, falling back to JSON:', e.message);
    }

    // Fallback to local JSON
    try {
      const res = await fetch('../assets/data/invoice-links.json');
      INVOICE_LINKS = await res.json();
    } catch (e) {
      INVOICE_LINKS = [];
    }
    initFilterTypes();
    renderLinks();
  }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function renderLinks() {
    const q = ($('search-input').value || '').toLowerCase().trim();
    const filtered = INVOICE_LINKS.filter(l => {
      if (currentFilter !== 'all' && l.type !== currentFilter) return false;
      if (!q) return true;
      return [l.name, l.type, l.url, l.note].join(' ').toLowerCase().includes(q);
    });

    const host = $('link-list');
    const empty = $('empty-state');

    if (!filtered.length) { host.innerHTML = ''; empty.style.display = 'block'; return; }
    empty.style.display = 'none';

    host.innerHTML = filtered.map(l => `
      <a class="nd-tool-card nd-tool-card--int" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
        <span class="nd-tool-top">
          <span class="nd-tool-icon"><i class="fas fa-file-invoice" aria-hidden="true"></i></span>
          <span class="nd-tool-badge">${esc(l.type)}</span>
        </span>
        <h2 class="nd-tool-name">${esc(l.name)}</h2>
        <p class="nd-tool-desc">${esc(l.note || '')}</p>
        <span class="nd-tool-foot">
          <span class="nd-tool-meta">${esc(l.url.replace(/^https?:\/\//, '').split('/')[0])}</span>
          <span class="nd-tool-go" aria-hidden="true">
            <i class="fas fa-arrow-up-right-from-square"></i>
          </span>
        </span>
      </a>
    `).join('');
  }

  function initFilterTypes() {
    const types = [...new Set(INVOICE_LINKS.map(l => l.type))].sort();
    const sel = $('filter-type');
    types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      sel.appendChild(opt);
    });
  }

  $('search-input').addEventListener('input', renderLinks);
  $('filter-type').addEventListener('change', (e) => { currentFilter = e.target.value; renderLinks(); });

  // Wait for config to load
  if (window.NOTDORE_CONFIG_READY) {
    window.NOTDORE_CONFIG_READY.then(() => loadData());
  } else {
    loadData();
  }