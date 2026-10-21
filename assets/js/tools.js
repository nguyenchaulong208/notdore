/**
 * tools.js — trang chủ: render danh mục công cụ + thư viện link ngoài.
 * Phụ thuộc: assets/js/db.js (NotDoreDB), assets/js/config.js
 */
(function () {
  'use strict';

  const DB = window.NotDoreDB;
  const { escapeHtml: esc, matches } = DB.util;

  const STATUS_LABEL = { ready: '', beta: 'Beta', soon: 'Sắp có' };

  const state = { catalog: null, categoryId: 'all', q: '' };

  /* ── Render ──────────────────────────────────────────────────────── */

  const matchesQuery = (tool, q) =>
    matches([tool.name, tool.description, ...(tool.tags || [])].join(' '), q);

  const resolveUrl = (url) => new URL(url, DB.ROOT).href;

  const renderCard = (tool) => {
    const soon = tool.status === 'soon';
    const href = tool.externalUrl || (tool.url ? resolveUrl(tool.url) : null);
    const tag = soon ? 'div' : 'a';
    const attrs = soon || !href
      ? 'aria-disabled="true"'
      : `href="${esc(href)}"${tool.externalUrl ? ' target="_blank" rel="noopener noreferrer"' : ''}`;

    const badge = STATUS_LABEL[tool.status]
      ? `<span class="nd-badge ${soon ? 'nd-badge--soon' : 'nd-badge--beta'}">${STATUS_LABEL[tool.status]}</span>`
      : '';

    return `
      <${tag} class="nd-tool-card${soon ? ' is-soon' : ''}" ${attrs}>
        <span class="nd-tool-icon"><i class="fas ${esc(tool.icon || 'fa-cube')}" aria-hidden="true"></i></span>
        <span class="nd-tool-body">
          <span class="nd-tool-head">
            <span class="nd-tool-name">${esc(tool.name)}</span>${badge}
          </span>
          <span class="nd-tool-desc">${esc(tool.description || '')}</span>
          ${(tool.tags || []).length
            ? `<span class="nd-tool-tags">${tool.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</span>`
            : ''}
        </span>
        ${soon ? '' : '<span class="nd-tool-go" aria-hidden="true"><i class="fas fa-arrow-right"></i></span>'}
      </${tag}>`;
  };

  const renderCategoryTabs = () => {
    const host = document.getElementById('tool-tabs');
    if (!host) return;

    const cats = state.catalog.categories || [];
    host.innerHTML = [
      { id: 'all', name: 'Tất cả', icon: 'fa-border-all' },
      ...cats,
    ].map((c) => `
      <li class="nav-item">
        <button type="button" class="nav-link${state.categoryId === c.id ? ' active' : ''}"
          data-cat="${esc(c.id)}" aria-pressed="${state.categoryId === c.id}">
          ${c.icon ? `<i class="fas ${esc(c.icon)} me-1" aria-hidden="true"></i>` : ''}${esc(c.name)}
        </button>
      </li>`).join('');
  };

  const renderTools = () => {
    const host = document.getElementById('tools-content');
    if (!host) return;

    const list = (state.catalog.tools || [])
      .filter((t) => state.categoryId === 'all' || t.categoryId === state.categoryId)
      .filter((t) => matchesQuery(t, state.q))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'vi'));

    const counter = document.getElementById('tool-count');
    if (counter) counter.textContent = `${list.length} công cụ`;

    host.innerHTML = list.length
      ? `<div class="nd-grid">${list.map(renderCard).join('')}</div>`
      : `<p class="nd-empty"><i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy công cụ phù hợp${state.q ? ` với “${esc(state.q)}”` : ''}.</p>`;
  };

  const renderLibrary = () => {
    const host = document.getElementById('library-grid');
    if (!host) return;

    const items = state.catalog.external || [];
    const groups = [...new Set(items.map((i) => i.group))];

    host.innerHTML = groups.map((g) => `
      <div class="nd-lib-group">
        <h3 class="nd-lib-title">${esc(g)}</h3>
        <ul class="nd-lib-list">
          ${items.filter((i) => i.group === g).map((i) => `
            <li>
              <a href="${esc(i.url)}" target="_blank" rel="noopener noreferrer">
                <i class="fas ${esc(i.icon || 'fa-link')}" aria-hidden="true"></i>
                <span>
                  <strong>${esc(i.name)}</strong>
                  <small>${esc(i.note || '')}</small>
                </span>
              </a>
            </li>`).join('')}
        </ul>
      </div>`).join('');
  };

  /* ── Sự kiện ─────────────────────────────────────────────────────── */

  const bind = () => {
    const tabs = document.getElementById('tool-tabs');
    if (tabs) {
      tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-cat]');
        if (!btn) return;
        state.categoryId = btn.dataset.cat;
        renderCategoryTabs();
        renderTools();
      });
    }

    const input = document.getElementById('tool-search');
    if (input) {
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          state.q = input.value;
          renderTools();
        }, 120);
      });
    }
  };

  /* ── Khởi động ───────────────────────────────────────────────────── */

  const fail = (err) => {
    console.error(err);
    const host = document.getElementById('tools-content');
    if (host) {
      host.innerHTML = `<p class="nd-empty nd-empty--error">
        <i class="fas fa-triangle-exclamation me-2"></i>Không tải được danh sách công cụ. Vui lòng thử lại sau.
      </p>`;
    }
  };

  const init = async () => {
    try {
      state.catalog = await DB.getCatalog();

      // Cho phép chia sẻ link tìm kiếm: /?q=dia%20gioi
      const q = new URLSearchParams(location.search).get('q');
      if (q) {
        state.q = q;
        const input = document.getElementById('tool-search');
        if (input) input.value = q;
      }

      renderCategoryTabs();
      renderTools();
      renderLibrary();
      bind();

      const note = document.getElementById('data-source');
      if (note) {
        note.textContent = state.catalog.source === 'supabase'
          ? 'Dữ liệu: Supabase'
          : 'Dữ liệu: JSON tĩnh';
      }
    } catch (err) {
      fail(err);
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
