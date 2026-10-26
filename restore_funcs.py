#!/usr/bin/env python3
"""Restore missing functions in dia-gioi.js."""

with open('assets/js/dia-gioi.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the position after bind function
bind_pos = content.find('const bind = () => {')
bind_end = content.find('};', bind_pos)

if bind_pos == -1 or bind_end == -1:
    print('ERROR: Could not find bind function boundaries')
    exit(1)

# Prepare the new functions to insert
new_funcs = '''
  const typeLabel = (t) => esc(t || '—');

  const sourceLabel = (data) => data.source === 'supabase'
    ? 'Supabase'
    : data.degraded ? 'JSON tĩnh (Supabase lỗi)' : 'JSON tĩnh';

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
           hiện hành và sẽ tự điền cột "Trước 01/07/2025" khi dữ liệu cũ được bổ sung.
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
'''

# Insert the new functions after bind
new_content = content[:bind_end + 1] + new_funcs + content[bind_end + 1:]

with open('assets/js/dia-gioi.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Added missing functions successfully')
PYEOF