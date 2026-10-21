/**
 * library.js — trang thư viện: render link ngoài theo nhóm.
 * Không trộn công cụ của NotDore vào trang này.
 * Phụ thuộc: assets/js/db.js (NotDoreDB), assets/js/config.js
 */
(function () {
  'use strict';

  const DB = window.NotDoreDB;
  const { escapeHtml: esc } = DB.util;

  const $ = (id) => document.getElementById(id);

  const render = (catalog) => {
    const host = $('lib-catalog');
    if (!host) return;

    const external = catalog.external || [];
    const groups = [...new Set(external.map((e) => e.group))];

    if (!groups.length) {
      host.innerHTML = '<p class="nd-empty">Thư viện đang trống.</p>';
      return;
    }

    host.innerHTML = groups.map((group, i) => {
      const list = external.filter((e) => e.group === group);

      return `
        <section class="nd-cat-block" aria-labelledby="lib-cat-${i}">
          <header class="nd-cat-head">
            <h2 id="lib-cat-${i}">${esc(group)}</h2>
            <span>${String(list.length).padStart(2, '0')}</span>
          </header>
          <ul class="nd-cat-list">
            ${list.map((e) => `
              <li>
                <a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">
                  <span>
                    <strong>${esc(e.name)}</strong>
                    ${e.note ? `<small>${esc(e.note)}</small>` : ''}
                  </span>
                  <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i>
                </a>
              </li>`).join('')}
          </ul>
        </section>`;
    }).join('');

    // Các mục do JS render sau khi tải dữ liệu, nên trình duyệt không tự cuộn
    // tới anchor (#lib-cat-N) nếu chỉ dựa vào hash ban đầu. Cuộn lại sau render.
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      const target = document.getElementById(hash);
      if (target) target.scrollIntoView({ block: 'start' });
    }
  };

  const init = async () => {
    try {
      const catalog = await DB.getCatalog();
      render(catalog);
    } catch (err) {
      console.error(err);
      const host = $('lib-catalog');
      if (host) {
        host.innerHTML = `<p class="nd-empty">
          <i class="fas fa-triangle-exclamation me-2" aria-hidden="true"></i>
          Không tải được thư viện. Vui lòng thử lại sau.
        </p>`;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
