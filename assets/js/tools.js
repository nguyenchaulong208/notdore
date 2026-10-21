/**
 * tools.js — trang chủ: lưới công cụ + danh mục bên phải + câu nói hay.
 *
 * Dữ liệu: NotDoreDB.getCatalog() — Supabase hoặc assets/data/tools.json.
 * Giới hạn hiển thị: 4 cột, tối đa 20 block (4x5) — MAX_TILES.
 * Danh mục bên phải: nhóm công cụ nội bộ + nhóm link ngoài (trỏ về thư viện).
 * Câu nói hay: mảng tĩnh, đổi theo ngày hoặc bằng nút ↻; không phụ thuộc catalog.
 */
(function () {
  'use strict';

  const DB = window.NotDoreDB;
  const { escapeHtml: esc, matches } = DB.util;

  const $ = (id) => document.getElementById(id);

  const MAX_TILES = 20;

  /* Câu nói hay: dữ liệu tĩnh, không phụ thuộc catalog. */
  const QUOTES = [
    { text: 'Có công mài sắt, có ngày nên kim.', author: 'Tục ngữ Việt Nam' },
    { text: 'Đi một ngày đàng, học một sàng khôn.', author: 'Tục ngữ Việt Nam' },
    { text: 'Cái khó ló cái khôn.', author: 'Tục ngữ Việt Nam' },
    { text: 'Lửa thử vàng, gian nan thử sức.', author: 'Tục ngữ Việt Nam' },
    { text: 'Thì giờ là vàng bạc.', author: 'Tục ngữ Việt Nam' },
    { text: 'Muốn đi nhanh thì đi một mình, muốn đi xa thì đi cùng nhau.', author: 'Tục ngữ châu Phi' },
    { text: 'Học, học nữa, học mãi.', author: 'V. I. Lê-nin' },
    { text: 'Không có việc gì khó, chỉ sợ lòng không bền.', author: 'Hồ Chí Minh' },
    { text: 'Mỗi ngày một chút, rồi sẽ đến đích.', author: 'Khuyết danh' },
    { text: 'Công cụ tốt không làm thay bạn, nhưng giúp bạn làm tốt hơn.', author: 'NotDore' },
    { text: 'Việc nhỏ làm gọn, ngày dài nhẹ tênh.', author: 'NotDore' },
    { text: 'Một công cụ nhỏ, một ngày nhẹ hơn.', author: 'NotDore' },
  ];

  let quoteIndex = 0;

  const state = {
    all: [],
    q: '',
  };

  const hostOf = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  };

  const chipHtml = (chip) => `
    <a class="nd-chip" href="${esc(chip.href)}">
      ${esc(chip.name)}<span class="nd-chip-count">${esc(String(chip.count))}</span>
    </a>`;

  const cardHtml = (item) => {
    const ext = item.external;
    const tags = (item.tags || []).slice(0, 2);
    const meta = ext
      ? `<span class="nd-tool-domain">${esc(hostOf(item.url))}</span>`
      : tags.map((t) => `<span class="nd-tool-tag">${esc(t)}</span>`).join(' ');

    return `
      <a class="nd-tool-card ${ext ? 'nd-tool-card--ext' : 'nd-tool-card--int'}"
         href="${esc(item.url)}"
         ${ext ? 'target="_blank" rel="noopener noreferrer"' : ''}>
        <span class="nd-tool-top">
          <span class="nd-tool-icon"><i class="fas ${esc(item.icon)}" aria-hidden="true"></i></span>
          <span class="nd-tool-badge ${ext ? 'nd-tool-badge--ext' : ''}">${ext ? 'Bên ngoài' : 'Nội bộ'}</span>
        </span>
        <h2 class="nd-tool-name">${esc(item.name)}</h2>
        <p class="nd-tool-desc">${esc(item.description || '')}</p>
        <span class="nd-tool-foot">
          <span class="nd-tool-meta">${meta}</span>
          <span class="nd-tool-go" aria-hidden="true">
            <i class="fas ${ext ? 'fa-arrow-up-right-from-square' : 'fa-arrow-right'}"></i>
          </span>
        </span>
      </a>`;
  };

  const render = () => {
    const grid = $('tools-grid');
    const sub = $('tools-sub');
    const note = $('tools-note');
    if (!grid) return;

    const q = state.q.trim();
    const filtered = q
      ? state.all.filter((x) => matches(
          [x.name, x.description, ...(x.tags || []), x.group || ''].join(' '),
          q,
        ))
      : state.all;

    const shown = filtered.slice(0, MAX_TILES);

    grid.innerHTML = shown.length
      ? shown.map(cardHtml).join('')
      : `<p class="nd-empty">
           <i class="fas fa-magnifying-glass me-2" aria-hidden="true"></i>
           Không tìm thấy công cụ phù hợp.
         </p>`;

    if (sub) {
      const internal = state.all.filter((x) => !x.external).length;
      const external = state.all.filter((x) => x.external).length;
      sub.textContent = q
        ? `${filtered.length} kết quả cho “${q}”`
        : `${state.all.length} công cụ · ${internal} nội bộ · ${external} bên ngoài`;
    }

    if (note) {
      const hiddenCount = Math.max(0, filtered.length - MAX_TILES);
      note.hidden = hiddenCount === 0;
      note.textContent = hiddenCount
        ? `Đang hiển thị ${MAX_TILES} / ${filtered.length} công cụ. Dùng ô tìm kiếm để thu hẹp.`
        : '';
    }
  };

  const renderSidebar = (catalog) => {
    const tools = catalog.tools || [];
    const categories = catalog.categories || [];
    const external = catalog.external || [];

    const intHost = $('side-internal');
    if (intHost) {
      const chips = categories
        .map((c) => {
          const list = tools.filter((t) => t.categoryId === c.id);
          return {
            name: c.name,
            count: list.length,
            href: list[0] ? list[0].url : '#cong-cu',
          };
        })
        .filter((c) => c.count > 0);

      intHost.innerHTML = chips.length
        ? chips.map(chipHtml).join('')
        : '<span class="nd-chip nd-chip--muted">Chưa có danh mục</span>';
    }

    const internalLink = $('side-internal-link');
    if (internalLink) {
      internalLink.href = tools[0] ? tools[0].url : '#cong-cu';
    }

    const extHost = $('side-external');
    if (extHost) {
      const groups = [...new Set(external.map((e) => e.group))];
      const chips = groups.map((group, i) => ({
        name: group,
        count: external.filter((e) => e.group === group).length,
        href: `thu-vien.html#lib-cat-${i}`,
      }));

      extHost.innerHTML = chips.length
        ? chips.map(chipHtml).join('')
        : '<span class="nd-chip nd-chip--muted">Thư viện đang trống</span>';
    }
  };

  /* Hiển thị câu nói hiện tại và chạy lại hiệu ứng mờ dần. */
  const renderQuote = () => {
    const box = $('quote-box');
    const text = $('quote-text');
    const author = $('quote-author');
    if (!box || !text || !author) return;

    const quote = QUOTES[quoteIndex];
    if (!quote) return;

    text.textContent = quote.text;
    author.textContent = `— ${quote.author}`;

    box.classList.remove('nd-quote--in');
    void box.offsetWidth;
    box.classList.add('nd-quote--in');
  };

  const initQuote = () => {
    if (!QUOTES.length || !$('quote-box')) return;

    /* Mỗi ngày mở trang sẽ thấy cùng một câu; nút ↻ đổi ngẫu nhiên. */
    const day = Math.floor(Date.now() / 86400000);
    quoteIndex = day % QUOTES.length;
    renderQuote();

    const btn = $('quote-refresh');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (QUOTES.length < 2) return;

      let next = quoteIndex;
      while (next === quoteIndex) {
        next = Math.floor(Math.random() * QUOTES.length);
      }
      quoteIndex = next;
      renderQuote();
    });
  };

  const bind = () => {
    const input = $('tool-search');
    if (!input) return;

    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = input.value;
        render();
      }, 90);
    });
  };

  const init = async () => {
    initQuote();

    try {
      const catalog = await DB.getCatalog();

      const internal = (catalog.tools || []).map((t) => ({
        name: t.name,
        description: t.description,
        icon: t.icon || 'fa-toolbox',
        url: t.url,
        tags: t.tags || [],
        external: false,
      }));

      const external = (catalog.external || []).map((e) => ({
        name: e.name,
        description: e.note || '',
        icon: e.icon || 'fa-arrow-up-right-from-square',
        url: e.url,
        tags: [],
        group: e.group,
        external: true,
      }));

      state.all = [...internal, ...external];
      render();
      renderSidebar(catalog);
      bind();
    } catch (err) {
      console.error(err);
      const grid = $('tools-grid');
      if (grid) {
        grid.innerHTML = `<p class="nd-empty">
          <i class="fas fa-triangle-exclamation me-2" aria-hidden="true"></i>
          Không tải được danh sách công cụ. Vui lòng thử lại sau.
        </p>`;
      }
      const sub = $('tools-sub');
      if (sub) sub.textContent = 'Lỗi dữ liệu';

      const intHost = $('side-internal');
      if (intHost) intHost.innerHTML = '<span class="nd-chip nd-chip--muted">Không tải được</span>';
      const extHost = $('side-external');
      if (extHost) extHost.innerHTML = '<span class="nd-chip nd-chip--muted">Không tải được</span>';
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
