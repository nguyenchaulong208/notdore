/**
 * dia-gioi.js — công cụ tra cứu địa giới hành chính (cấp tỉnh) trước/sau sáp nhập 2025.
 *
 * Dữ liệu: NotDoreDB.getAdminDivisions() — Supabase hoặc assets/data/admin-merger.json.
 * Hai chế độ xem:
 *   - history: 63 đơn vị cũ -> 34 đơn vị hiện tại
 *   - units:   34 đơn vị hiện tại (kèm các đơn vị cũ hợp thành)
 */
(function () {
  'use strict';

  const DB = window.NotDoreDB;
  const { escapeHtml: esc, matches, normalize, formatNumber } = DB.util;

  const state = {
    data: null,
    tab: 'history',
    q: '',
    region: 'all',
    type: 'all',
    onlyChanged: false,
  };

  const $ = (id) => document.getElementById(id);

  /** Ưu tiên kết quả khớp tên hơn là khớp phần ghi chú */
  const scoreName = (name, q) => {
    if (!q) return 1;
    const n = normalize(name);
    const k = normalize(q);
    if (n === k) return 4;
    if (n.startsWith(k)) return 3;
    if (n.includes(k)) return 2;
    return 1;
  };

  const typeLabel = (t) => esc(t || '—');

  /* ── Thống kê ────────────────────────────────────────────────────── */

  const renderStats = () => {
    const { meta } = state.data;
    const s = meta.stats || {};
    const host = $('dg-stats');
    if (!host) return;

    const items = [
      { value: s.before ?? '—', label: 'đơn vị trước sáp nhập', icon: 'fa-layer-group' },
      { value: s.after ?? '—', label: 'đơn vị hiện tại', icon: 'fa-map-location-dot' },
      { value: s.merged ?? '—', label: 'đơn vị cũ thuộc diện sáp nhập', icon: 'fa-code-merge' },
      { value: s.unchanged ?? '—', label: 'giữ nguyên', icon: 'fa-lock' },
    ];

    host.innerHTML = items.map((i) => `
      <div class="nd-stat">
        <i class="fas ${i.icon}" aria-hidden="true"></i>
        <strong>${esc(i.value)}</strong>
        <span>${esc(i.label)}</span>
      </div>`).join('');
  };

  /* ── Bảng 63 -> 34 ───────────────────────────────────────────────── */

  const filterHistory = () => (state.data.history || []).filter((h) => {
    if (state.onlyChanged && !h.changed) return false;
    if (state.region !== 'all') {
      const p = state.data.provinces.find((x) => x.code === h.newCode);
      if (!p || p.region !== state.region) return false;
    }
    return matches([h.oldName, h.oldType, h.newName, h.newCode, h.note].join(' '), state.q);
  }).sort((a, b) =>
    scoreName(b.oldName, state.q) - scoreName(a.oldName, state.q) ||
    a.oldName.localeCompare(b.oldName, 'vi')
  );

  const renderHistory = () => {
    const rows = filterHistory();
    const body = $('dg-history-body');
    if (!body) return;

    $('dg-count').textContent = `${rows.length} / ${state.data.history.length} đơn vị`;

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="5" class="nd-empty-cell">
        <i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy đơn vị phù hợp.
      </td></tr>`;
      return;
    }

    body.innerHTML = rows.map((h) => `
      <tr>
        <td data-label="Trước sáp nhập"><strong>${esc(h.oldName)}</strong></td>
        <td data-label="Loại">${typeLabel(h.oldType)}</td>
        <td class="nd-arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></td>
        <td data-label="Hiện tại">
          <button type="button" class="nd-link" data-code="${esc(h.newCode)}">${esc(h.newName || '—')}</button>
        </td>
        <td data-label="Ghi chú">
          <span class="nd-pill ${h.changed ? 'nd-pill--merge' : 'nd-pill--keep'}">${esc(h.changed ? 'Sáp nhập' : 'Giữ nguyên')}</span>
          <small class="nd-note">${esc(h.note || '')}</small>
        </td>
      </tr>`).join('');
  };

  /* ── Thẻ 34 đơn vị hiện tại ──────────────────────────────────────── */

  const filterUnits = () => (state.data.provinces || []).filter((p) => {
    if (state.region !== 'all' && p.region !== state.region) return false;
    if (state.type !== 'all' && p.type !== state.type) return false;
    if (state.onlyChanged && !p.changed) return false;
    return matches([p.name, p.code, p.type, p.region, (p.mergedFrom || []).join(' ')].join(' '), state.q);
  }).sort((a, b) =>
    scoreName(b.name, state.q) - scoreName(a.name, state.q) ||
    a.name.localeCompare(b.name, 'vi')
  );

  const renderUnits = () => {
    const host = $('dg-units');
    if (!host) return;

    const list = filterUnits();
    $('dg-count').textContent = `${list.length} / ${state.data.provinces.length} đơn vị`;

    if (!list.length) {
      host.innerHTML = `<p class="nd-empty"><i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy đơn vị phù hợp.</p>`;
      return;
    }

    host.innerHTML = `<div class="nd-grid">${list.map((p) => `
      <button type="button" class="nd-unit-card" data-code="${esc(p.code)}">
        <span class="nd-unit-top">
          <span class="nd-unit-code">${esc(p.code)}</span>
          <span class="nd-pill ${p.changed ? 'nd-pill--merge' : 'nd-pill--keep'}">
            ${p.changed ? `${p.mergedFrom.length} đơn vị hợp thành` : 'Giữ nguyên'}
          </span>
        </span>
        <span class="nd-unit-name">${esc(p.name)}</span>
        <span class="nd-unit-meta">${typeLabel(p.type)} · ${esc(p.region || '—')}</span>
        ${p.changed
          ? `<span class="nd-unit-from">${p.mergedFrom.map((m) => `<span>${esc(m)}</span>`).join('')}</span>`
          : ''}
      </button>`).join('')}</div>`;
  };

  /* ── Modal chi tiết ──────────────────────────────────────────────── */

  const openUnit = (code) => {
    const p = state.data.provinces.find((x) => x.code === code);
    const modalEl = $('dg-modal');
    if (!p || !modalEl) return;

    $('dg-modal-title').textContent = p.name;
    $('dg-modal-body').innerHTML = `
      <dl class="nd-detail">
        <div><dt>Mã đơn vị</dt><dd>${esc(p.code)}</dd></div>
        <div><dt>Loại</dt><dd>${typeLabel(p.type)}</dd></div>
        <div><dt>Vùng</dt><dd>${esc(p.region || '—')}</dd></div>
        <div><dt>Trực thuộc Trung ương</dt><dd>${p.centrallyRun ? 'Có' : 'Không'}</dd></div>
        <div><dt>Trung tâm hành chính</dt><dd>${esc(p.capital || 'Giữ nguyên')}</dd></div>
        <div><dt>Dân số</dt><dd>${formatNumber(p.population)}</dd></div>
        <div><dt>Diện tích</dt><dd>${p.areaKm2 ? `${formatNumber(p.areaKm2)} km²` : '—'}</dd></div>
      </dl>
      ${p.changed
        ? `<h6 class="nd-detail-heading">Đơn vị hợp thành</h6>
           <p class="nd-detail-from">${(p.mergedFrom || []).map((m) => `<span class="nd-pill nd-pill--soft">${esc(m)}</span>`).join(' ')}</p>`
        : ''}
      ${p.renamedFrom ? `<p class="nd-note">Tên cũ: ${esc(p.renamedFrom)}</p>` : ''}
      ${p.predecessorsRaw ? `<h6 class="nd-detail-heading">Mô tả từ nguồn</h6><p class="nd-note">${esc(p.predecessorsRaw)}</p>` : ''}
      ${p.note ? `<div class="nd-warn"><i class="fas fa-circle-info me-2"></i>${esc(p.note)}</div>` : ''}
      <div class="nd-modal-actions">
        <button type="button" class="anime-btn anime-btn--outline anime-btn--sm" id="dg-copy">
          <i class="fas fa-link me-1" aria-hidden="true"></i><span id="dg-copy-label">Sao chép liên kết</span>
        </button>
      </div>
    `;

    const copyBtn = $('dg-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const url = new URL(location.href);
        url.search = `?ma=${encodeURIComponent(p.code)}`;
        url.hash = '';
        const label = $('dg-copy-label');
        try {
          await navigator.clipboard.writeText(url.href);
          label.textContent = 'Đã chép ✓';
        } catch {
          window.prompt('Sao chép liên kết:', url.href);
        }
        setTimeout(() => { label.textContent = 'Sao chép liên kết'; }, 1600);
      });
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  };

  /* ── Nguồn & ghi chú ─────────────────────────────────────────────── */

  const renderMeta = () => {
    const host = $('dg-meta');
    if (!host) return;
    const { meta } = state.data;

    host.innerHTML = `
      <h3 class="nd-subheading">Bối cảnh</h3>
      <p class="nd-meta-text">
        Từ 01/07/2025, chính quyền địa phương được tổ chức theo 2 cấp (tỉnh – xã); cấp huyện không còn
        trong bộ máy hành chính. 63 đơn vị cấp tỉnh được sắp xếp lại còn 34 đơn vị. Công cụ này đối chiếu
        tên cũ và tên hiện tại ở <strong>cấp tỉnh</strong>; chưa bao gồm cấp xã/phường.
      </p>

      <h3 class="nd-subheading">Căn cứ pháp lý & nguồn dữ liệu</h3>
      <ul class="nd-source-list">
        ${(meta.sources || []).map((s) => `<li>${esc(s)}</li>`).join('')}
      </ul>

      <h3 class="nd-subheading">Lưu ý khi sử dụng</h3>
      <ul class="nd-source-list">
        ${(meta.notes || []).map((s) => `<li>${esc(s)}</li>`).join('')}
      </ul>

      <p class="nd-note">
        Hiệu lực dữ liệu: ${esc(meta.effectiveFrom || '—')} · Cập nhật: ${esc(meta.generated || '—')} ·
        Nguồn đang dùng: ${state.data.source === 'supabase' ? 'Supabase' : 'JSON tĩnh'}.
      </p>

      <div class="nd-meta-actions">
        <a class="anime-btn anime-btn--outline anime-btn--sm"
           href="${esc(new URL('assets/data/admin-merger.json', DB.ROOT).href)}" download>
          <i class="fas fa-download me-1" aria-hidden="true"></i>Tải dữ liệu JSON
        </a>
      </div>`;
  };

  /* ── Điều khiển ──────────────────────────────────────────────────── */

  const setTab = (tab) => {
    state.tab = tab;
    document.querySelectorAll('[data-dg-tab]').forEach((btn) => {
      const on = btn.dataset.dgTab === tab;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-selected', String(on));
    });
    $('dg-panel-history').hidden = tab !== 'history';
    $('dg-panel-units').hidden = tab !== 'units';
    $('dg-panel-meta').hidden = tab !== 'meta';
    renderCurrent();
  };

  const renderCurrent = () => {
    if (state.tab === 'history') renderHistory();
    else if (state.tab === 'units') renderUnits();
  };

  const bind = () => {
    document.querySelectorAll('[data-dg-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.dataset.dgTab));
    });

    const search = $('dg-search');
    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.q = search.value;
        renderCurrent();
      }, 120);
    });

    $('dg-region').addEventListener('change', (e) => {
      state.region = e.target.value;
      renderCurrent();
    });

    $('dg-type').addEventListener('change', (e) => {
      state.type = e.target.value;
      renderCurrent();
    });

    $('dg-only-changed').addEventListener('change', (e) => {
      state.onlyChanged = e.target.checked;
      renderCurrent();
    });

    // Mở modal khi bấm vào đơn vị (bảng hoặc thẻ)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-code]');
      if (target && target.dataset.code) openUnit(target.dataset.code);
    });
  };

  /* ── Khởi động ───────────────────────────────────────────────────── */

  const init = async () => {
    try {
      state.data = await DB.getAdminDivisions();
      renderStats();
      renderMeta();
      bind();

      const params = new URLSearchParams(location.search);
      const q = params.get('q') || '';
      if (q) {
        state.q = q;
        $('dg-search').value = q;
      }
      const tabParam = params.get('tab');
      setTab(['units', 'meta'].includes(tabParam) ? tabParam : 'history');

      const ma = params.get('ma');
      if (ma) openUnit(ma);

      const badge = $('dg-source');
      if (badge) badge.textContent = state.data.source === 'supabase' ? 'Supabase' : 'JSON tĩnh';
    } catch (err) {
      console.error(err);
      const host = $('dg-history-body');
      if (host) {
        host.innerHTML = `<tr><td colspan="5" class="nd-empty-cell">
          <i class="fas fa-triangle-exclamation me-2"></i>Không tải được dữ liệu địa giới.
        </td></tr>`;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
