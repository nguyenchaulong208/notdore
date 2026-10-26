#!/usr/bin/env python3
"""Add missing openUnit function and fix brace issues."""

with open('assets/js/dia-gioi.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the position of renderMeta
render_meta_pos = content.find('const renderMeta = () => {')

if render_meta_pos == -1:
    print('ERROR: renderMeta not found')
    exit(1)

# Find the end of the bind function (last '};' before renderMeta)
bind_end = content.rfind('};', 0, render_meta_pos)
if bind_end == -1:
    print('ERROR: Could not find end of bind function')
    exit(1)

# Add the missing openUnit function
open_unit_func = """
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
"""

new_content = content[:bind_end + 1] + open_unit_func + content[render_meta_pos:]

with open('assets/js/dia-gioi.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print('Added missing openUnit function')
