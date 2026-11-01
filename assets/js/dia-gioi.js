/**
 /** dia-gioi.js — Tra cứu địa giới hành chính (card view, single view) */
 (function () {
   'use strict';

   const DB = window.NotDoreDB;
   const { escapeHtml: esc, matches } = DB.util;

   const state = {
     communes: null,
     communesLoading: false,
     communesError: null,
     mode: 'after',
     q: '',
     province: 'all',
     type: 'all',
     page: 1,
     pageSize: 15,
     };

   const $ = (id) => document.getElementById(id);
   const TYPE_LABELS = { xa: 'Xã', phuong: 'Phường', dac_ku: 'Đặc khu' };
   const allCommunes = () => state.communes?.communes || [];

   const filterCommunes = () => {
     const q = state.q.trim();
     return allCommunes().filter((c) => {
       if (state.province !== 'all' && c.provinceCode !== state.province) return false;
       if (state.type !== 'all' && c.type !== state.type) return false;
       if (!q) return true;
       const text = [c.name, c.code, c.provinceName, ...(c.beforeNames || [])].join(' ');
       return matches(text, q);
     });
   };

   const renderAfterCards = () => {
     const host = $('dg-card-grid');
     if (!host) return;
     const all = filterCommunes();
     const total = all.length;
     const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
     if (state.page > totalPages) state.page = totalPages;
     if (state.page < 1) state.page = 1;
     const start = (state.page - 1) * state.pageSize;
     const rows = all.slice(start, start + state.pageSize);
     const countEl = $('dg-count');
     if (countEl) countEl.textContent = `${total} đơn vị`;
     if (!total) { host.innerHTML = '<p class="nd-empty"><i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy đơn vị phù hợp.</p>'; renderPagination(totalPages); return; }
     host.innerHTML = rows.map((c) => {
       const before = (c.beforeNames || []).length ? c.beforeNames.map((n) => `<span class="nd-pill nd-pill--soft">${esc(n)}</span>`).join(' ') : '<span class="nd-muted">Chưa có dữ liệu</span>';
       const status = c.changed === false ? '<span class="nd-pill nd-pill--keep">Giữ nguyên</span>' : (c.beforeNames?.length ? '<span class="nd-pill nd-pill--merge">Sáp nhập</span>' : '<span class="nd-pill nd-pill--soft">Chưa đối chiếu</span>');
       return `<div class="nd-unit-card" data-code="${esc(c.code)}" data-action="detail" style="cursor:pointer;"><div class="nd-unit-top"><span class="nd-unit-code">${esc(c.code)}</span>${status}</div><div class="nd-unit-name">${esc(c.name)}</div><div class="nd-unit-meta">${esc(TYPE_LABELS[c.type] || c.type)} · ${esc(c.provinceName || '—')}</div><div class="nd-unit-from" style="margin-top:.5rem;"><small style="color:var(--text-muted);font-size:.75rem;">Trước:</small>${before}</div></div>`;
     }).join('');
     host.querySelectorAll('[data-action="detail"]').forEach((el) => { el.addEventListener('click', () => openDetail(el.dataset.code)); });
     renderPagination(totalPages);
   };

   const renderBeforeCards = () => {
     const host = $('dg-card-grid');
     if (!host) return;
     const beforeMap = new Map();
     allCommunes().forEach((c) => { (c.beforeNames || []).forEach((name) => { if (!beforeMap.has(name)) beforeMap.set(name, []); beforeMap.get(name).push(c); }); });
     let items = [...beforeMap.entries()];
     const q = state.q.trim();
     if (q) items = items.filter(([name]) => matches(name, q));
     if (state.province !== 'all') items = items.filter(([, targets]) => targets.some((t) => t.provinceCode === state.province));
     if (state.type !== 'all') items = items.filter(([, targets]) => targets.some((t) => t.type === state.type));
     const total = items.length;
     const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
     if (state.page > totalPages) state.page = totalPages;
     if (state.page < 1) state.page = 1;
     const start = (state.page - 1) * state.pageSize;
     const pageItems = items.slice(start, start + state.pageSize);
     const countEl = $('dg-count');
     if (countEl) countEl.textContent = `${total} tên cũ`;
     if (!total) { host.innerHTML = '<p class="nd-empty"><i class="fas fa-magnifying-glass me-2"></i>Không tìm thấy đơn vị phù hợp.</p>'; renderPagination(totalPages); return; }
     host.innerHTML = pageItems.map(([name, targets]) => {
       const targetNames = targets.map((t) => esc(t.name)).join(', ');
       const province = targets[0]?.provinceName || '—';
       return `<div class="nd-unit-card" data-name="${esc(name)}" data-action="detail-before" style="cursor:pointer;"><div class="nd-unit-top"><span class="nd-unit-code">Cũ</span><span class="nd-pill nd-pill--merge">Sáp nhập</span></div><div class="nd-unit-name">${esc(name)}</div><div class="nd-unit-meta">${esc(province)}</div><div class="nd-unit-from" style="margin-top:.5rem;"><small style="color:var(--text-muted);font-size:.75rem;">Sau:</small><span class="nd-pill nd-pill--soft">${esc(targetNames)}</span></div></div>`;
     }).join('');
     host.querySelectorAll('[data-action="detail-before"]').forEach((el) => {
       el.addEventListener('click', () => { const name = el.dataset.name; const targets = beforeMap.get(name) || []; openDetailBefore(name, targets); });
     });
     renderPagination(totalPages);
     };

   const renderPagination = (totalPages) => {
    const host = $('dg-pagination');
    if (!host) return;
    if (totalPages <= 1) { host.innerHTML = ''; return; }
    const btns = [];
    for (let i = 1; i <= totalPages; i++) {
      const active = i === state.page;
      btns.push(`<button type="button" data-page="${i}" style="padding:.4rem .8rem;border:1px solid ${active ? 'var(--accent-purple)' : 'var(--border)'};border-radius:var(--radius-sm);background:${active ? 'var(--accent-purple)' : 'var(--bg-card)'};color:${active ? '#fff' : 'var(--text-secondary)'};cursor:pointer;font-weight:${active ? '700' : '400'};">${i}</button>`);
    }
    host.innerHTML = btns.join('');
    host.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.page = parseInt(btn.dataset.page, 10);
        renderCards();
      });
    });
  };

  const renderCards = () => { if (state.mode === 'after') renderAfterCards(); else renderBeforeCards(); };

   const openDetail = (code) => {
     const c = allCommunes().find((x) => x.code === code);
     if (!c) return;
     const modalEl = $('dg-modal');
     if (!modalEl) return;
     const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
     $('dg-modal-title').textContent = `${c.name} (${c.code})`;
     const before = (c.beforeNames || []).length ? c.beforeNames.map((n) => `<span class="nd-pill nd-pill--soft" style="margin:.2rem;">${esc(n)}</span>`).join(' ') : 'Chưa có dữ liệu';
     const status = c.changed === false ? 'Giữ nguyên' : (c.beforeNames?.length ? 'Sáp nhập / đổi tên' : 'Chưa đối chiếu');
     $('dg-modal-body').innerHTML = `<div style="display:grid;gap:1rem;"><div><strong>Loại:</strong> ${esc(TYPE_LABELS[c.type] || c.type)}</div><div><strong>Tỉnh/TP:</strong> ${esc(c.provinceName || '—')}</div><div><strong>Mã:</strong> ${esc(c.code)}</div><div><strong>Trước sáp nhập:</strong><br>${before}</div><div><strong>Trạng thái:</strong> ${esc(status)}</div>${c.note ? `<div><strong>Ghi chú:</strong> ${esc(c.note)}</div>` : ''}</div>`;
     modal.show();
   };

   const openDetailBefore = (name, targets) => {
     const modalEl = $('dg-modal');
     if (!modalEl) return;
     const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
     $('dg-modal-title').textContent = name;
     const targetList = targets.map((t) => `<li><strong>${esc(t.name)}</strong> (${esc(t.code)}) — ${esc(t.provinceName || '—')}</li>`).join('');
     $('dg-modal-body').innerHTML = `<div style="display:grid;gap:1rem;"><div><strong>Tên trước sáp nhập:</strong> ${esc(name)}</div><div><strong>Sau sáp nhập thuộc:</strong><ul style="margin:.5rem 0 0 1.5rem;">${targetList}</ul></div></div>`;
     modal.show();
   };

   const populateProvinceFilter = () => {
     const select = $('dg-commune-province');
     if (!select) return;
     const provinces = [...new Set(allCommunes().map((c) => c.provinceCode))].map((code) => { const c = allCommunes().find((x) => x.provinceCode === code); return { code, name: c?.provinceName || code }; }).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
     const current = select.value;
     select.innerHTML = '<option value="all">Tất cả</option>' + provinces.map((p) => `<option value="${esc(p.code)}">${esc(p.name)}</option>`).join('');
     if ([...select.options].some((o) => o.value === current)) select.value = current;
   };

   const renderStats = () => {
     const host = $('dg-stats');
     if (!host) return;
     const all = allCommunes();
     const withHistory = all.filter((c) => c.beforeNames?.length).length;
     const items = [{ value: all.length, label: 'xã / phường / đặc khu', icon: 'fa-location-dot' }, { value: withHistory, label: 'đơn vị có dữ liệu trước sáp nhập', icon: 'fa-right-left' }, { value: all.length - withHistory, label: 'giữ nguyên', icon: 'fa-lock' }];
     host.innerHTML = items.map((i) => `<div class="nd-stat"><i class="fas ${i.icon}" aria-hidden="true"></i><strong>${i.value.toLocaleString('vi-VN')}</strong><span>${esc(i.label)}</span></div>`).join('');
   };

   document.querySelectorAll('.nd-mode-btn').forEach((btn) => {
     btn.addEventListener('click', () => {
       state.mode = btn.dataset.mode;
       state.page = 1;
       document.querySelectorAll('.nd-mode-btn').forEach((b) => {
         const active = b.dataset.mode === state.mode;
         b.classList.toggle('active', active);
         b.style.background = active ? 'var(--accent-purple)' : 'var(--bg-card)';
         b.style.color = active ? '#fff' : 'var(--text-secondary)';
         b.style.borderColor = active ? 'var(--accent-purple)' : 'var(--border)';
       });
       renderCards();
     });
   });

   const search = $('dg-search');
   let timer;
   if (search) { search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { state.q = search.value; state.page = 1; renderCards(); }, 120); }); }

   const provSelect = $('dg-commune-province');
   if (provSelect) { provSelect.addEventListener('change', (e) => { state.province = e.target.value; state.page = 1; renderCards(); }); }

   const typeSelect = $('dg-commune-type');
   if (typeSelect) { typeSelect.addEventListener('change', (e) => { state.type = e.target.value; state.page = 1; renderCards(); }); }

   const init = async () => {
     try {
       state.communes = await DB.getCommunes();
       renderStats();
       populateProvinceFilter();
       renderCards();
       const badge = $('dg-source');
       if (badge) badge.textContent = state.communes.source === 'supabase' ? 'Supabase' : 'JSON tĩnh';
     } catch (err) {
       console.error(err);
       const host = $('dg-card-grid');
       if (host) host.innerHTML = '<p class="nd-empty"><i class="fas fa-triangle-exclamation me-2"></i>Không tải được dữ liệu.</p>';
     }
   };

   document.addEventListener('DOMContentLoaded', init);
 })();
