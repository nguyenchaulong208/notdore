/**
 * dia-gioi.js — công cụ tra cứu địa giới hành chính sau sáp nhập 2025.
 *
 * Dữ liệu:
 *   - NotDoreDB.getAdminDivisions(): 63 -> 34 đơn vị cấp tỉnh
 *   - NotDoreDB.getCommunes():       3.321 xã / phường / đặc khu
 *
 * Ba chế độ xem:
 *   - history:  63 đơn vị cũ -> 34 đơn vị hiện tại; chuyển được sang cấp xã
 *               (đã có tên trước 01/07/2025 cho 127 đơn vị giữ nguyên)
 *   - units:    34 đơn vị hiện tại dạng bảng cuộn (kèm đơn vị cũ hợp thành)
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
    historyLevel: 'province',
    direction: 'before-to-current',
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

  const addressContains = (query, name) => {
    const haystack = normalize(query);
    const normalizedName = normalize(name);
    const shortName = normalizedName.replace(/^(tinh|thanh pho|thu do|xa|phuong|dac khu)\s+/, '');
    return [normalizedName, shortName]
      .some((term) => term.length >= 3 && haystack.includes(term));
  };

  const parseLookupQuery = (value) => {
    const raw = String(value ?? '').trim();
    const colon = raw.indexOf(':');
    if (colon >= 0) {
      const prefix = normalize(raw.slice(0, colon));
      const beforePrefixes = ['cu', 'truoc', 'old', 'before'];
      const currentPrefixes = ['moi', 'sau', 'new', 'current'];
      if (beforePrefixes.includes(prefix)) {
        return { query: raw.slice(colon + 1).trim(), direction: 'before-to-current' };
      }
      if (currentPrefixes.includes(prefix)) {
        return { query: raw.slice(colon + 1).trim(), direction: 'current-to-before' };
      }
    }

    const normalizedQuery = normalize(raw);
    if (!normalizedQuery) return { query: '', direction: 'before-to-current' };
    const queryWords = ` ${normalizedQuery.replace(/[^a-z0-9]+/g, ' ')} `;
    const matchesBefore = (state.data?.history || [])
      .some((h) => addressContains(raw, h.oldName));
    const matchesCurrent = (state.data?.provinces || [])
      .some((p) => addressContains(raw, p.name));
    const containsFullCurrentName = (state.data?.provinces || [])
      .some((p) => normalize(p.name).length > 3 && normalizedQuery.includes(normalize(p.name)));
    const containsDistrict = / (quan|huyen|thi xa|thi tran) /.test(queryWords);
    const containsCurrentCommune = / (xa|phuong|dac khu) /.test(queryWords);

    let direction = 'before-to-current';
    if (containsFullCurrentName) direction = 'current-to-before';
    else if (containsDistrict && matchesBefore) direction = 'before-to-current';
    else if (containsCurrentCommune && matchesCurrent) direction = 'current-to-before';
    else if (matchesCurrent && !matchesBefore) direction = 'current-to-before';

    return { query: raw, direction };
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
    const province = state.data.provinces.find((x) => x.code === h.newCode);
    if (state.region !== 'all') {
      if (!province || province.region !== state.region) return false;
    }
    if (state.type !== 'all') {
      const type = state.direction === 'current-to-before' ? province?.type : h.oldType;
      if (type !== state.type) return false;
    }

    const matchesBeforeAddress = state.q && state.data.history
      .some((item) => addressContains(state.q, item.oldName));
    const matchesCurrentAddress = state.q && state.data.provinces
      .some((item) => addressContains(state.q, item.name));
    const addressSide = state.direction === 'current-to-before'
      ? (matchesCurrentAddress ? 'current' : matchesBeforeAddress ? 'before' : null)
      : (matchesBeforeAddress ? 'before' : matchesCurrentAddress ? 'current' : null);

    if (addressSide === 'before') return addressContains(state.q, h.oldName);
    if (addressSide === 'current') {
      return addressContains(state.q, h.newName) || addressContains(state.q, province?.name);
    }

    const textMatches = matches(
      [h.oldName, h.oldType, h.newName, h.newCode, h.note].join(' '),
      state.q,
    );
    return textMatches;
  }).sort((a, b) =>
    (state.direction === 'current-to-before'
      ? scoreName(b.newName, state.q) - scoreName(a.newName, state.q)
      : scoreName(b.oldName, state.q) - scoreName(a.oldName, state.q)) ||
    a.oldName.localeCompare(b.oldName, 'vi')
  );

  const renderHistory = () => {
    const isCommune = state.historyLevel === 'commune';
    const provinceWrap = $('dg-history-province-wrap');
    const communeWrap = $('dg-history-commune-wrap');
    if (provinceWrap) provinceWrap.hidden = isCommune;
    if (communeWrap) communeWrap.hidden = !isCommune;
    document.querySelectorAll('[data-dg-history-commune-filter]').forEach((el) => {
      el.hidden = !isCommune;
    });
    const communeNote = $('dg-history-commune-note');
    if (communeNote) communeNote.hidden = !isCommune;
    const communeCount = $('dg-history-commune-count');
    if (communeCount) communeCount.hidden = !isCommune;

    if (isCommune) {
      loadCommunes();
      renderHistoryCommunes();
      return;
    }

    const rows = filterHistory();
    const body = $('dg-history-body');
    if (!body) return;

    const beforeHeading = $('dg-history-before-heading');
    const currentHeading = $('dg-history-current-heading');
    const count = $('dg-count');
    const reverse = state.direction === 'current-to-before';
    if (beforeHeading) beforeHeading.textContent = reverse ? 'Hiện tại' : 'Trước 01/07/2025';
    if (currentHeading) currentHeading.textContent = reverse ? 'Trước 01/07/2025' : 'Hiện tại';

    if (!rows.length) {
      if (count) count.textContent = '0 đơn vị';
      body.innerHTML = `<tr><td colspan="5" class="nd-empty-cell">
        <i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy đơn vị phù hợp.
      </td></tr>`;
      return;
    }

    if (reverse) {
      const groups = new Map();
      rows.forEach((h) => {
        const province = state.data.provinces.find((p) => p.code === h.newCode);
        if (province) groups.set(province.code, province);
      });
      const list = [...groups.values()].sort((a, b) =>
        scoreName(b.name, state.q) - scoreName(a.name, state.q) ||
        a.name.localeCompare(b.name, 'vi')
      );
      if (count) count.textContent = `${list.length} / ${state.data.provinces.length} đơn vị hiện tại`;

      body.innerHTML = list.map((province) => {
        const predecessors = state.data.history
          .filter((h) => h.newCode === province.code)
          .sort((a, b) => a.oldName.localeCompare(b.oldName, 'vi'));
        const status = province.changed
          ? 'Có sáp nhập'
          : province.renamedFrom ? 'Đổi tên' : 'Giữ nguyên';

        return `
          <tr>
            <td data-label="Hiện tại">
              <button type="button" class="nd-link" data-code="${esc(province.code)}">${esc(province.name)}</button>
            </td>
            <td data-label="Loại">${typeLabel(province.type)}</td>
            <td class="nd-arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></td>
            <td data-label="Trước sáp nhập">
              <div class="nd-unit-from">
                ${predecessors.map((h) => `<span title="${esc(h.oldType)}">${esc(h.oldName)}</span>`).join('')}
              </div>
            </td>
            <td data-label="Trạng thái">
              <span class="nd-pill ${province.changed ? 'nd-pill--merge' : 'nd-pill--keep'}">${esc(status)}</span>
            </td>
          </tr>`;
      }).join('');
      return;
    }

    if (count) count.textContent = `${rows.length} / ${state.data.history.length} đơn vị`;
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

  /* ── Bảng 34 đơn vị hiện tại ─────────────────────────────────────── */

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

    host.innerHTML = `<div class="nd-table-wrap nd-table-wrap--scroll">
      <table class="nd-table nd-table--units">
        <caption class="visually-hidden">34 đơn vị hành chính cấp tỉnh hiện tại</caption>
        <thead>
          <tr>
            <th scope="col">Mã</th>
            <th scope="col">Tỉnh / Thành phố</th>
            <th scope="col">Loại</th>
            <th scope="col">Vùng</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Đơn vị hợp thành</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((p) => {
            const mergedFrom = p.mergedFrom || [];
            const status = p.changed
              ? 'Có sáp nhập'
              : p.renamedFrom ? 'Đổi tên' : 'Giữ nguyên';
            return `
              <tr>
                <td data-label="Mã">${esc(p.code)}</td>
                <td data-label="Tỉnh / Thành phố">
                  <button type="button" class="nd-link" data-code="${esc(p.code)}">${esc(p.name)}</button>
                  ${p.renamedFrom ? `<small class="nd-note">Tên cũ: ${esc(p.renamedFrom)}</small>` : ''}
                </td>
                <td data-label="Loại">${typeLabel(p.type)}</td>
                <td data-label="Vùng">${esc(p.region || '—')}</td>
                <td data-label="Trạng thái">
                  <span class="nd-pill ${p.changed ? 'nd-pill--merge' : 'nd-pill--keep'}">${esc(status)}</span>
                </td>
                <td data-label="Đơn vị hợp thành">
                  ${p.changed
                    ? mergedFrom.map((m) => `<span class="nd-pill nd-pill--soft">${esc(m)}</span>`).join(' ')
                    : '<span class="nd-muted">—</span>'}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  };

  /* ── Bảng xã / phường / đặc khu ──────────────────────────────────── */

  const populateCommuneProvinceFilter = () => {
    const selects = ['dg-commune-province', 'dg-history-commune-province']
      .map((id) => $(id))
      .filter(Boolean);
    if (!selects.length) return;

    const current = state.communeProvince;
    const provinces = [...(state.data?.provinces || [])]
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    const options = '<option value="all">Tất cả</option>' + provinces.map((p) =>
      `<option value="${esc(p.code)}">${esc(p.name)}</option>`
    ).join('');

    selects.forEach((select) => {
      select.innerHTML = options;
      select.value = current && [...select.options].some((o) => o.value === current)
        ? current
        : 'all';
    });
    state.communeProvince = selects[0].value;
  };

  const syncCommuneFilters = () => {
    ['dg-commune-province', 'dg-history-commune-province'].forEach((id) => {
      const select = $(id);
      if (select) select.value = state.communeProvince;
    });
    ['dg-commune-type', 'dg-history-commune-type'].forEach((id) => {
      const select = $(id);
      if (select) select.value = state.communeType;
    });
  };

  const filterCommunes = () => {
    const all = state.communes?.communes || [];
    const query = state.q;
    const normalizedQuery = normalize(query);
    const queryWords = ` ${normalizedQuery.replace(/[^a-z0-9]+/g, ' ')} `;
    const containsDistrict = / (quan|huyen|thi xa|thi tran) /.test(queryWords);
    const oldProvinceCodes = new Set(query
      ? state.data.history
        .filter((h) => addressContains(query, h.oldName))
        .map((h) => h.newCode)
      : []);
    const matchedCommuneCodes = new Set(query
      ? all.filter((c) => {
        const names = [
          c.name,
          c.shortCodename?.replace(/_/g, ' '),
          ...(c.beforeNames || []),
        ].filter(Boolean);
        const exactCurrentName = names.some((name) => {
          const fullName = normalize(name);
          return fullName.length > 3 && normalizedQuery.includes(fullName);
        });
        if (exactCurrentName) {
          return !containsDistrict || state.direction === 'current-to-before';
        }

        const shortNameMatch = names.some((name) => addressContains(query, name));
        return shortNameMatch &&
          (state.direction === 'current-to-before' || oldProvinceCodes.size === 0);
      }).map((c) => c.code)
      : []);
    const matchedProvinceCodes = new Set(query ? [
      ...state.data.provinces
        .filter((p) => [p.name, p.renamedFrom, ...(p.mergedFrom || [])]
          .some((name) => addressContains(query, name)))
        .map((p) => p.code),
      ...state.data.history
        .filter((h) => addressContains(query, h.oldName))
        .map((h) => h.newCode),
    ] : []);

    return all.filter((c) => {
      if (state.communeProvince !== 'all' && c.provinceCode !== state.communeProvince) return false;
      if (state.communeType !== 'all' && c.type !== state.communeType) return false;
      if (!query) return true;
      if (matchedCommuneCodes.size) {
        return matchedCommuneCodes.has(c.code) &&
          (!matchedProvinceCodes.size || matchedProvinceCodes.has(c.provinceCode));
      }
      if (matchedProvinceCodes.size) return matchedProvinceCodes.has(c.provinceCode);
      return matches(
        [
          c.name,
          c.typeLabel,
          c.provinceName,
          c.code,
          c.shortCodename,
          ...(c.beforeNames || []),
          c.beforeProvinceName,
        ].join(' '),
        query,
      );
    }).sort((a, b) =>
      scoreName(b.name, query) - scoreName(a.name, query) ||
      a.name.localeCompare(b.name, 'vi')
    );
  };

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
    const shown = rows;

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
      const label = state.communes.source === 'none'
        ? 'chưa có dữ liệu'
        : sourceLabel(state.communes);
      const withHistory = all.filter((commune) => commune.beforeNames?.length).length;
      source.innerHTML = `Nguồn cấp xã: <strong>${esc(label)}</strong> ` +
        `· ${esc(state.communes.meta?.effectiveFrom || '01/07/2025')} ` +
        `· Đã đối chiếu ${withHistory}/${all.length} đơn vị giữ nguyên; ` +
        `các đơn vị còn lại chưa có tên trước sắp xếp. ` +
        `Cấp huyện không còn từ 01/07/2025.`;
    }
  };

  const beforeNamesHtml = (commune) => {
    if (!commune.beforeNames?.length) {
      return '<span class="nd-muted">Chưa có dữ liệu</span>';
    }
    return commune.beforeNames
      .map((name) => `<span class="nd-pill nd-pill--soft">${esc(name)}</span>`)
      .join(' ');
  };

  const communeStatus = (commune) => {
    if (commune.changed === false) return { label: 'Giữ nguyên', cls: 'nd-pill--keep' };
    if (commune.beforeNames?.length) return { label: 'Sáp nhập / đổi tên', cls: 'nd-pill--merge' };
    return { label: 'Chưa đối chiếu', cls: 'nd-pill--soft' };
  };

  const renderHistoryCommunes = () => {
    const body = $('dg-history-commune-body');
    if (!body) return;

    const count = $('dg-history-commune-count');
    const note = $('dg-history-commune-note');
    const reverse = state.direction === 'current-to-before';
    const beforeHeading = $('dg-history-commune-before-heading');
    const currentHeading = $('dg-history-commune-current-heading');
    if (beforeHeading) beforeHeading.textContent = reverse ? 'Hiện tại' : 'Trước 01/07/2025';
    if (currentHeading) currentHeading.textContent = reverse ? 'Trước 01/07/2025' : 'Hiện tại';

    if (state.communesError) {
      if (count) count.textContent = '0 đơn vị';
      body.innerHTML = `<tr><td colspan="5" class="nd-empty-cell">
        <i class="fas fa-triangle-exclamation me-2"></i>Không tải được dữ liệu cấp xã.
      </td></tr>`;
      if (note) note.hidden = false;
      return;
    }

    if (!state.communes) {
      if (count) count.textContent = 'Đang tải…';
      body.innerHTML = `<tr><td colspan="5" class="nd-empty-cell">
        <i class="fas fa-spinner fa-spin me-2"></i>Đang tải dữ liệu cấp xã.
      </td></tr>`;
      return;
    }

    const all = state.communes.communes || [];
    const rows = filterCommunes();

    if (count) {
      count.textContent = rows.length === all.length
        ? `${all.length} xã, phường, đặc khu`
        : `${rows.length} kết quả`;
    }

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="5" class="nd-empty-cell">
        <i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy xã/phường phù hợp.
      </td></tr>`;
    } else {
      body.innerHTML = rows.map((commune) => {
        const before = beforeNamesHtml(commune);
        const current = `<strong>${esc(commune.name)}</strong>
          <small class="nd-note">${esc(commune.typeLabel || commune.type || '')} · ${esc(commune.code)}</small>`;
        const province = commune.provinceCode
          ? `<button type="button" class="nd-link" data-code="${esc(commune.provinceCode)}">${esc(commune.provinceName || '—')}</button>`
          : esc(commune.provinceName || '—');
        const status = communeStatus(commune);
        const beforeLabel = reverse ? 'Hiện tại' : 'Trước 01/07/2025';
        const currentLabel = reverse ? 'Trước 01/07/2025' : 'Hiện tại';

        return `
          <tr>
            <td data-label="${beforeLabel}">${reverse ? current : before}</td>
            <td class="nd-arrow" aria-hidden="true"><i class="fas fa-arrow-right"></i></td>
            <td data-label="${currentLabel}">${reverse ? before : current}</td>
            <td data-label="Tỉnh / Thành phố">${province}</td>
            <td data-label="Trạng thái">
              <span class="nd-pill ${status.cls}">${esc(status.label)}</span>
              ${commune.note ? `<small class="nd-note">${esc(commune.note)}</small>` : ''}
            </td>
          </tr>`;
      }).join('');
    }

    if (note) {
      note.hidden = false;
      const withHistory = all.filter((commune) => commune.beforeNames?.length).length;
      const label = state.communes.source === 'none' ? 'chưa có dữ liệu' : sourceLabel(state.communes);
      note.innerHTML = withHistory
        ? `Đã có dữ liệu trước sáp nhập cho <strong>${withHistory}/${all.length}</strong> đơn vị cấp xã.
           Nguồn: <strong>${esc(label)}</strong> · Hiệu lực ${esc(state.communes.meta?.effectiveFrom || '01/07/2025')}.`
        : `Dữ liệu đối chiếu lịch sử cấp xã chưa có. Bảng hiển thị ${all.length.toLocaleString('vi-VN')} đơn vị
           hiện hành và sẽ tự điền cột “Trước 01/07/2025” khi dữ liệu cũ được bổ sung.
           Nguồn hiện tại: <strong>${esc(label)}</strong>.`;
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
      if (state.tab === 'history' && state.historyLevel === 'commune') {
        renderHistoryCommunes();
      } else {
        renderCommunes();
      }
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
        syncCommuneFilters();
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

    const historyLevel = $('dg-history-level');
    if (historyLevel) historyLevel.value = state.historyLevel;

    // Các bộ lọc vùng/loại tỉnh không áp dụng cho bảng cấp xã.
    const communeMode = tab === 'communes' || (tab === 'history' && state.historyLevel === 'commune');
    document.querySelectorAll('[data-dg-province-only]').forEach((el) => {
      el.hidden = communeMode;
    });
    updateSearchPlaceholder();

    renderCurrent();
    if (tab === 'communes') loadCommunes();
  };

  const renderCurrent = () => {
    if (state.tab === 'history') renderHistory();
    else if (state.tab === 'units') renderUnits();
    else if (state.tab === 'communes') renderCommunes();
  };

  const updateSearchPlaceholder = () => {
    const search = $('dg-search');
    if (!search) return;
    if (state.tab === 'communes') {
      search.placeholder = 'Tỉnh cũ để lọc xã/phường hiện hành, hoặc tìm địa chỉ mới…';
    } else if (state.tab === 'history' && state.historyLevel === 'commune') {
      search.placeholder = 'Tên xã/phường hiện tại hoặc tỉnh cũ; thêm cũ: / mới: nếu cần…';
    } else {
      search.placeholder = 'Địa chỉ cũ hoặc mới; thêm cũ: / mới: nếu cần…';
    }
  };

  const bind = () => {
    populateCommuneProvinceFilter();
    syncCommuneFilters();

    document.querySelectorAll('[data-dg-tab]').forEach((btn) => {
      btn.addEventListener('click', () => setTab(btn.dataset.dgTab));
    });

    const search = $('dg-search');
    let timer;
    search.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const parsed = parseLookupQuery(search.value);
        state.q = parsed.query;
        state.direction = parsed.direction;
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

    $('dg-history-level').addEventListener('change', (e) => {
      state.historyLevel = e.target.value;
      setTab('history');
    });

    const handleCommuneProvince = (e) => {
      state.communeProvince = e.target.value;
      syncCommuneFilters();
      renderCurrent();
    };
    const handleCommuneType = (e) => {
      state.communeType = e.target.value;
      syncCommuneFilters();
      renderCurrent();
    };
    ['dg-commune-province', 'dg-history-commune-province'].forEach((id) => {
      const select = $(id);
      if (select) select.addEventListener('change', handleCommuneProvince);
    });
    ['dg-commune-type', 'dg-history-commune-type'].forEach((id) => {
      const select = $(id);
      if (select) select.addEventListener('change', handleCommuneType);
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
      syncCommuneFilters();

      const params = new URLSearchParams(location.search);
      const q = params.get('q') || '';
      if (q) {
        const parsed = parseLookupQuery(q);
        state.q = parsed.query;
        state.direction = parsed.direction;
        $('dg-search').value = q;
      }
      if (params.get('level') === 'commune') state.historyLevel = 'commune';
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
