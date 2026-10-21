/**
 * dia-gioi.js — công cụ tra cứu địa giới hành chính sau sáp nhập 2025.
 *
 * Dữ liệu:
 *   - NotDoreDB.getAdminDivisions(): 63 -> 34 đơn vị cấp tỉnh
 *   - NotDoreDB.getCommunes():       3.321 xã / phường / đặc khu
 *
 * Ba chế độ xem:
 *   - history:  63 đơn vị cũ -> 34 đơn vị hiện tại
 *   - units:    34 đơn vị hiện tại (kèm các đơn vị cũ hợp thành)
 *   - communes: tra cứu xã / phường / đặc khu (không có cấp huyện từ 01/07/2025)
 */
(function () {
  'use strict';

  const DB = window.NotDoreDB;
  const { escapeHtml: esc, matches, normalize, formatNumber } = DB.util;

  const state = {
    data: null,
    communes: null,
    communesLoading: false,
    communesError: null,
    tab: 'history',
    q: '',
    region: 'all',
    type: 'all',
    onlyChanged: false,
    communeProvince: 'all',
    communeType: 'all',
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

  const sourceLabel = (data) => data.source === 'supabase'
    ? 'Supabase'
    : data.degraded ? 'JSON tĩnh (Supabase lỗi)' : 'JSON tĩnh';

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

    const communeStats = state.communes?.meta?.stats;
    if (communeStats?.total) {
      items.push({
        value: communeStats.total,
        label: 'xã / phường / đặc khu',
        icon: 'fa-location-dot',
      });
    }

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

  /* ── Bảng xã / phường / đặc khu ──────────────────────────────────── */

  const populateCommuneProvinceFilter = () => {
    const select = $('dg-commune-province');
    if (!select) return;
    const current = state.communeProvince;
    const provinces = [...(state.data?.provinces || [])]
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

    select.innerHTML = '<option value="all">Tất cả</option>' + provinces.map((p) =>
      `<option value="${esc(p.code)}">${esc(p.name)}</option>`
    ).join('');

    select.value = current && [...select.options].some((o) => o.value === current)
      ? current
      : 'all';
    state.communeProvince = select.value;
  };

  const filterCommunes = () => (state.communes?.communes || []).filter((c) => {
    if (state.communeProvince !== 'all' && c.provinceCode !== state.communeProvince) return false;
    if (state.communeType !== 'all' && c.type !== state.communeType) return false;
    return matches(
      [c.name, c.typeLabel, c.provinceName, c.code, c.shortCodename].join(' '),
      state.q,
    );
  }).sort((a, b) =>
    scoreName(b.name, state.q) - scoreName(a.name, state.q) ||
    a.name.localeCompare(b.name, 'vi')
  );

  const renderCommunes = () => {
    const body = $('dg-commune-body');
    if (!body) return;

    if (state.communesError) {
      body.innerHTML = `<tr><td colspan="4" class="nd-empty-cell">
        <i class="fas fa-triangle-exclamation me-2"></i>Không tải được dữ liệu cấp xã.
      </td></tr>`;
      const source = $('dg-commune-source');
      if (source) source.textContent = 'Chưa tải được dữ liệu cấp xã.';
      return;
    }

    if (!state.communes) {
      body.innerHTML = `<tr><td colspan="4" class="nd-empty-cell">
        <i class="fas fa-spinner fa-spin me-2"></i>Đang tải dữ liệu cấp xã.
      </td></tr>`;
      return;
    }

    const all = state.communes.communes || [];
    const count = $('dg-commune-count');
    const source = $('dg-commune-source');

    if (!all.length) {
      if (count) count.textContent = '0 đơn vị';
      body.innerHTML = `<tr><td colspan="4" class="nd-empty-cell">
        <i class="fas fa-circle-info me-2"></i>Chưa có dữ liệu cấp xã. Hãy chạy seed hoặc kiểm tra file JSON.
      </td></tr>`;
      if (source) source.textContent = 'Chưa có dữ liệu cấp xã.';
      return;
    }

    const rows = filterCommunes();
    const limit = (!state.q && state.communeProvince === 'all') ? 300 : 1000;
    const shown = rows.slice(0, limit);

    if (count) {
      count.textContent = rows.length === all.length
        ? `${all.length} xã, phường, đặc khu`
        : `${rows.length} kết quả`;
    }

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" class="nd-empty-cell">
        <i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy xã/phường phù hợp.
      </td></tr>`;
    } else {
      body.innerHTML = shown.map((c) => `
        <tr>
          <td data-label="Xã / phường / đặc khu"><strong>${esc(c.name)}</strong></td>
          <td data-label="Loại"><span class="nd-pill nd-pill--soft">${esc(c.typeLabel || c.type || '—')}</span></td>
          <td data-label="Tỉnh / Thành phố">
            ${c.provinceCode
              ? `<button type="button" class="nd-link" data-code="${esc(c.provinceCode)}">${esc(c.provinceName || '—')}</button>`
              : esc(c.provinceName || '—')}
          </td>
          <td data-label="Mã">${esc(c.code)}</td>
        </tr>`).join('');
    }

    if (source) {
      const hidden = rows.length - shown.length;
      const label = state.communes.source === 'none'
        ? 'chưa có dữ liệu'
        : sourceLabel(state.communes);
      source.innerHTML = `Nguồn cấp xã: <strong>${esc(label)}</strong> ` +
        `· ${esc(state.communes.meta?.effectiveFrom || '01/07/2025')} ` +
        `· Cấp huyện không còn từ 01/07/2025.` +
        (hidden > 0 ? ` Đang hiển thị ${shown.length}/${rows.length}; chọn tỉnh hoặc tìm kiếm để thu hẹp.` : '');
    }
  };

  const loadCommunes = async () => {
    if (state.communes || state.communesLoading) return;
    state.communesLoading = true;
    state.communesError = null;
    renderCommunes();

    try {
      state.communes = await DB.getCommunes();
    } catch (err) {
      console.error(err);
      state.communesError = err;
    } finally {
      state.communesLoading = false;
      if (state.communes) renderStats();
      renderCommunes();
    }
  };

  /* ── Modal chi tiết ──────────────────────────────────────────────── */

  const openUnit = (code) => {
    const p = state.data.provinces.find((x) => x.code === code);
    const modalEl = $('dg-modal');
    if (!p || !modalEl) return;

    const communeCount = state.communes?.communes
      ? state.communes.communes.filter((c) => c.provinceCode === p.code).length
      : null;

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
      <h6 class="nd-detail-heading">Cấp xã / phường</h6>
      <p class="nd-detail-from">
        <button type="button" class="anime-btn anime-btn--outline anime-btn--sm" id="dg-open-communes">
          <i class="fas fa-location-dot me-1" aria-hidden="true"></i>
          Xem xã/phường${communeCount !== null ? ` (${communeCount})` : ''}
        </button>
      </p>
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

    const openCommunesBtn = $('dg-open-communes');
    if (openCommunesBtn) {
      openCommunesBtn.addEventListener('click', () => {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        state.communeProvince = p.code;
        populateCommuneProvinceFilter();
        const select = $('dg-commune-province');
        if (select) select.value = p.code;
        state.communeProvince = select?.value || p.code;
        setTab('communes');
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
        trong bộ máy hành chính. 63 đơn vị cấp tỉnh được sắp xếp lại còn 34 đơn vị, với 3.321 xã,
        phường và đặc khu. Công cụ này đối chiếu tên cũ và tên hiện tại ở <strong>cấp tỉnh</strong>,
        đồng thời cho tra cứu <strong>cấp xã/phường/đặc khu</strong>; không có cấp huyện.
      </p>

      <h3 class="nd-subheading">Căn cứ pháp lý & nguồn dữ liệu</h3>
      <ul class="nd-source-list">
        ${(meta.sources || []).map((s) => `<li>${esc(s)}</li>`).join('')}
      </ul>

      <h3 class="nd-subheading">Lưu ý khi sử dụng</h3>
      <ul class="nd-source-list">
        ${(meta.notes || []).map((s) => `<li>${esc(s)}</li>`).join('')}
        <li>Danh sách cấp xã được đối chiếu tổng số với 34 Nghị quyết UBTVQH15; nguồn tên/mã tham khảo provinces.open-api.vn.</li>
        <li>Không có cấp huyện sau 01/07/2025; không dùng dữ liệu này thay cho văn bản pháp luật gốc.</li>
      </ul>

      <p class="nd-note">
        Hiệu lực dữ liệu: ${esc(meta.effectiveFrom || '-')} · Cập nhật: ${esc(meta.generated || '-')} ·
        Nguồn đang dùng: ${esc(sourceLabel(state.data))}.
      </p>

      <div class="nd-meta-actions">
        <a class="anime-btn anime-btn--outline anime-btn--sm"
           href="${esc(new URL('assets/data/admin-merger.json', DB.ROOT).href)}" download>
          <i class="fas fa-download me-1" aria-hidden="true"></i>Tải dữ liệu cấp tỉnh
        </a>
        <a class="anime-btn anime-btn--outline anime-btn--sm"
           href="${esc(new URL('assets/data/admin-communes.json', DB.ROOT).href)}" download>
          <i class="fas fa-download me-1" aria-hidden="true"></i>Tải dữ liệu cấp xã
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
    $('dg-panel-communes').hidden = tab !== 'communes';
    $('dg-panel-meta').hidden = tab !== 'meta';

    // Các bộ lọc vùng/loại tỉnh không áp dụng cho bảng cấp xã.
    document.querySelectorAll('[data-dg-province-only]').forEach((el) => {
      el.hidden = tab === 'communes';
    });

    const search = $('dg-search');
    if (search) {
      search.placeholder = tab === 'communes'
        ? 'Tên xã/phường, tỉnh/thành phố, mã...'
        : 'Tên đơn vị cũ hoặc mới, mã (vd 79), vùng.';
    }

    renderCurrent();
    if (tab === 'communes') loadCommunes();
  };

  const renderCurrent = () => {
    if (state.tab === 'history') renderHistory();
    else if (state.tab === 'units') renderUnits();
    else if (state.tab === 'communes') renderCommunes();
  };

  const bind = () => {
    populateCommuneProvinceFilter();

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

    $('dg-commune-province').addEventListener('change', (e) => {
      state.communeProvince = e.target.value;
      renderCurrent();
    });

    $('dg-commune-type').addEventListener('change', (e) => {
      state.communeType = e.target.value;
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
      populateCommuneProvinceFilter();

      const params = new URLSearchParams(location.search);
      const q = params.get('q') || '';
      if (q) {
        state.q = q;
        $('dg-search').value = q;
      }
      const tabParam = params.get('tab');
      setTab(['units', 'communes', 'meta'].includes(tabParam) ? tabParam : 'history');

      const ma = params.get('ma');
      if (ma) openUnit(ma);

      const badge = $('dg-source');
      if (badge) badge.textContent = sourceLabel(state.data);
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
