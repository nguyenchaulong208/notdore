# -*- coding: utf-8 -*-
"""Update dia-gioi.js to show before/after merger names."""

with open('assets/js/dia-gioi.js', 'r', encoding='utf-8') as f:
    content = f.read()

# --- 1. Update renderCommunes to show beforeNames ---
old_render = '''    if (!rows.length) {
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
    }'''

new_render = '''    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="4" class="nd-empty-cell">
        <i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy xã/phường phù hợp.
      </td></tr>`;
    } else {
      body.innerHTML = shown.map((c) => {
        let beforeHtml = '<span class="nd-muted">Chưa có dữ liệu trước sáp nhập</span>';
        if (c.beforeNames && c.beforeNames.length > 0) {
          beforeHtml = c.beforeNames.map((n) =>
            `<span class="nd-pill nd-pill--soft">${esc(n)}</span>`
          ).join(' ');
        }
        return `
        <tr>
          <td data-label="Xã / phường / đặc khu"><strong>${esc(c.name)}</strong></td>
          <td data-label="Loại"><span class="nd-pill nd-pill--soft">${esc(c.typeLabel || c.type || '—')}</span></td>
          <td data-label="Tỉnh / Thành phố">
            ${c.provinceCode
              ? `<button type="button" class="nd-link" data-code="${esc(c.provinceCode)}">${esc(c.provinceName || '—')}</button>`
              : esc(c.provinceName || '—')}
          </td>
          <td data-label="Mã">${esc(c.code)}</td>
          <td class="nd-before-wrap">${beforeHtml}</td>
        </tr>`;
      }).join('');
    }'''

content = content.replace(old_render, new_render)

# --- 2. Add source note with data availability ---
old_css = '''      source.innerHTML = `Nguồn cấp xã: <strong>${esc(label)}</strong> ` +
        `· ${esc(state.communes.meta?.effectiveFrom || '01/07/2025')} ` +
        `· Đã đối chiếu ${withHistory}/${all.length} đơn vị giữ nguyên; ` +
        `các đơn vị còn lại chưa có tên trước sắp xếp. ` +
        `Cấp huyện không còn từ 01/07/2025.`;'''

new_css = '''      const withHistory = all.filter((commune) => commune.beforeNames?.length).length;
      const missingData = all.length - withHistory;
      source.innerHTML = `Nguồn cấp xã: <strong>${esc(label)}</strong> ` +
        `· ${esc(state.communes.meta?.effectiveFrom || '01/07/2025')} ` +
        `· Đã đối chiếu ${withHistory}/${all.length} đơn vị giữ nguyên; ` +
        `${missingData > 0 ? \`còn ${missingData} đơn vị chưa có tên trước sắp xếp\` : 'tất cả đã đối chiếu tên cũ'} ` +
        `· Cấp huyện không còn từ 01/07/2025.`;

      // Add CSS for the new before/after column
      const style = document.createElement('style');
      style.textContent = `
        .nd-before-wrap { width: 180px; min-width: 140px; text-align: left; }
        .nd-before-wrap .nd-pill { font-size: 12px; padding: 2px 6px; }
        .nd-before-wrap .nd-muted { font-size: 12px; color: #666; }
        .nd-table-wrap--scroll .nd-before-wrap { overflow: visible; }`;
      document.head.appendChild(style);'''

content = content.replace(old_css, new_css)

# --- 3. Update placeholder ---
old_ph = '''    if (state.tab === 'communes') {
      search.placeholder = 'Tỉnh cũ để lọc xã/phường hiện hành, hoặc tìm địa chỉ mới…';
    } else if (state.tab === 'history' && state.historyLevel === 'commune') {
      search.placeholder = 'Tên xã/phường hiện tại hoặc tỉnh cũ; thêm cũ: / mới: nếu cần…';
    } else {
      search.placeholder = 'Địa chỉ cũ hoặc mới; thêm cũ: / mới: nếu cần…';
    }'''

new_ph = '''    if (state.tab === 'communes') {
      search.placeholder = 'Tên xã/phường trước 01/07/2025 hoặc hiện hành (ví dụ: Đầm Dơi, Cà Mau…)';
    } else if (state.tab === 'history' && state.historyLevel === 'commune') {
      search.placeholder = 'Tên xã/phường hiện tại hoặc tỉnh cũ; thêm cũ:/mới: nếu cần chỉ rõ chiều';
    } else {
      search.placeholder = 'Địa chỉ cũ hoặc mới; thêm cũ:/mới: nếu cần…';
    }'''

content = content.replace(old_ph, new_ph)

# --- 4. Fix the renderCommunes to remove the duplicate "shown" variable ---
# (already handled above)

with open('assets/js/dia-gioi.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated assets/js/dia-gioi.js successfully")
