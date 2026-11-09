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
      <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:1rem; display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
        <div style="flex:1; min-width:200px;">
          <div style="display:flex; align-items:center; gap:.5rem; margin-bottom:.2rem;">
            <span style="font-weight:600; color:var(--text-primary);">${esc(l.name)}</span>
            <span class="nd-pill nd-pill--soft" style="font-size:.7rem;">${esc(l.type)}</span>
          </div>
          ${l.note ? `<div style="font-size:.8rem; color:var(--text-muted); margin-bottom:.3rem;">${esc(l.note)}</div>` : ''}
          <a href="${esc(l.url)}" target="_blank" rel="noopener" style="font-size:.82rem; color:var(--accent-purple); word-break:break-all;">${esc(l.url)}</a>
        </div>
        <div style="display:flex; gap:.4rem;">
          <a href="${esc(l.url)}" target="_blank" rel="noopener" class="btn-primary-nd" style="padding:.35rem .7rem; font-size:.8rem;">
            <i class="fas fa-external-link-alt"></i> Mở
          </a>
          <button class="copy-url" data-url="${esc(l.url)}" style="background:none; border:1px solid var(--border); border-radius:8px; padding:.35rem .6rem; cursor:pointer; color:var(--text-secondary); font-size:.8rem;" title="Copy URL">
            <i class="fas fa-copy"></i>
          </button>
        </div>
      </div>
    `).join('');

    host.querySelectorAll('.copy-url').forEach(btn => {
      btn.addEventListener('click', (e) => {
        navigator.clipboard.writeText(e.currentTarget.dataset.url).then(() => {
          e.currentTarget.innerHTML = '<i class="fas fa-check" style="color:var(--accent-green);"></i>';
          setTimeout(() => { e.currentTarget.innerHTML = '<i class="fas fa-copy"></i>'; }, 1500);
        });
      });
    });
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