// UI glue for allocate-import-cost.html (moved from inline script)
document.addEventListener('DOMContentLoaded', () => {
    const itemsTbody = document.querySelector('#itemsTable tbody');
    const costsTbody = document.querySelector('#costsTable tbody');
    const addItemBtn = document.getElementById('addItem');
    const addCostBtn = document.getElementById('addCost');
    const btnProcess = document.getElementById('btnProcess');
    const btnClear = document.getElementById('btnClear');
    const btnExport = document.getElementById('btnExport');
    const errorBox = document.getElementById('errorBox');
    const resultsWrap = document.getElementById('results');
    const resultTableBody = document.querySelector('#resultTable tbody');
    const resultSummary = document.getElementById('resultSummary');

    function mkItemRow(data = {}){
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input class="form-control form-control-sm" data-field="itemId" value="${data.itemId||''}"></td>
            <td><input class="form-control form-control-sm" data-field="itemName" value="${data.itemName||''}"></td>
            <td><input class="form-control form-control-sm" data-field="quantity" type="number" step="1" value="${data.quantity!=null?data.quantity:''}"></td>
            <td><input class="form-control form-control-sm" data-field="weight" type="number" step="0.01" value="${data.weight!=null?data.weight:''}"></td>
            <td><input class="form-control form-control-sm" data-field="basePrice" type="number" step="0.01" value="${data.basePrice!=null?data.basePrice:''}"></td>
            <td>
                <select class="form-select form-select-sm" data-field="currency">
                    <option value="VND" ${!data.currency||data.currency==='VND'?'selected':''}>VND</option>
                    <option value="USD" ${data.currency==='USD'?'selected':''}>USD</option>
                    <option value="EUR" ${data.currency==='EUR'?'selected':''}>EUR</option>
                </select>
            </td>
            <td><button class="btn btn-sm btn-outline-danger btn-remove"><i class="fas fa-times"></i></button></td>
        `;
        itemsTbody.appendChild(tr);
    }

    function mkCostRow(data = {}){
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input class="form-control form-control-sm" data-field="costId" value="${data.costId||''}"></td>
            <td><input class="form-control form-control-sm" data-field="costType" value="${data.costType||''}"></td>
            <td><input class="form-control form-control-sm" data-field="amount" type="number" step="0.01" value="${data.amount!=null?data.amount:''}"></td>
            <td>
                <select class="form-select form-select-sm" data-field="currency">
                    <option value="VND" ${!data.currency||data.currency==='VND'?'selected':''}>VND</option>
                    <option value="USD" ${data.currency==='USD'?'selected':''}>USD</option>
                    <option value="EUR" ${data.currency==='EUR'?'selected':''}>EUR</option>
                </select>
            </td>
            <td>
                <select class="form-select form-select-sm" data-field="allocationMethod">
                    <option value="value" ${!data.allocationMethod||data.allocationMethod==='value'?'selected':''}>Theo giá trị</option>
                    <option value="quantity" ${data.allocationMethod==='quantity'?'selected':''}>Theo số lượng</option>
                    <option value="weight" ${data.allocationMethod==='weight'?'selected':''}>Theo trọng lượng</option>
                    <option value="equal" ${data.allocationMethod==='equal'?'selected':''}>Bằng nhau</option>
                    <option value="custom" ${data.allocationMethod==='custom'?'selected':''}>Tùy chỉnh</option>
                </select>
            </td>
            <td><button class="btn btn-sm btn-outline-danger btn-remove"><i class="fas fa-times"></i></button></td>
        `;
        costsTbody.appendChild(tr);
    }

    // sample rows
    mkItemRow({ itemId:'A', itemName:'Hàng A', quantity:10, weight:2.5, basePrice:5, currency:'USD' });
    mkItemRow({ itemId:'B', itemName:'Hàng B', quantity:5, weight:1.2, basePrice:8, currency:'USD' });
    mkItemRow({ itemId:'C', itemName:'Hàng C', quantity:20, weight:0.5, basePrice:20000, currency:'VND' });
    mkCostRow({ costId:'C1', costType:'Cước', amount:100, currency:'USD', allocationMethod:'value' });
    mkCostRow({ costId:'C2', costType:'Phí bảo hiểm', amount:2000000, currency:'VND', allocationMethod:'weight' });

    // remove buttons via delegation
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove');
        if (!btn) return;
        const row = btn.closest('tr');
        if (row && row.parentNode) row.parentNode.removeChild(row);
    });

    addItemBtn.addEventListener('click', (e) => { e.preventDefault(); mkItemRow(); });
    addCostBtn.addEventListener('click', (e) => { e.preventDefault(); mkCostRow(); });
    document.getElementById('clearItems').addEventListener('click', () => { itemsTbody.innerHTML = ''; });
    document.getElementById('clearCosts').addEventListener('click', () => { costsTbody.innerHTML = ''; });

    function readForm(){
        const lotInfo = {
            lotCode: document.getElementById('lotCode').value.trim(),
            importDate: document.getElementById('importDate').value,
            exchangeRate: document.getElementById('exchangeRate').value ? Number(document.getElementById('exchangeRate').value) : null
        };
        const items = [];
        Array.from(itemsTbody.querySelectorAll('tr')).forEach(tr=>{
            const obj = {};
            const inputs = tr.querySelectorAll('[data-field]');
            inputs.forEach(inp=>{ const k=inp.getAttribute('data-field'); obj[k]=inp.value; });
            items.push(obj);
        });
        const costs = [];
        Array.from(costsTbody.querySelectorAll('tr')).forEach(tr=>{
            const obj = {}; const inputs = tr.querySelectorAll('[data-field]'); inputs.forEach(inp=>{ const k=inp.getAttribute('data-field'); obj[k]=inp.value; }); costs.push(obj);
        });
        const options = {
            defaultAllocationMethod: document.getElementById('defaultMethod').value,
            roundingMethod: Number(document.getElementById('rounding').value),
            handleRoundingDiff: document.getElementById('roundDiff').value
        };
        return { lotInfo, items, costs, options };
    }

    function showErrors(errs){
        errorBox.style.display='block';
        errorBox.innerHTML = errs.map(e=>`<div>${e.field?e.field+': ':''}${e.message}</div>`).join('');
    }
    function clearErrors(){ errorBox.style.display='none'; errorBox.innerHTML=''; }

    btnProcess.addEventListener('click',(e)=>{
        e.preventDefault(); clearErrors(); resultsWrap.style.display='none'; resultTableBody.innerHTML=''; resultSummary.innerHTML=''; btnExport.disabled=true;
        const {lotInfo, items, costs, options} = readForm();
        try{
            const res = window.AllocModule.calculateImportCostAllocation({lotInfo, items, costs, options});
            if(!res || res.valid===false){ if(res && res.errors) showErrors(res.errors); else showErrors([{message:'Không thể xử lý'}]); return; }
            resultsWrap.style.display='block';
            res.items.forEach(it=>{
                const tr=document.createElement('tr');
                const allocSum = it.allocatedCosts.reduce((s,a)=>s+(a.allocatedAmount||0),0);
                tr.innerHTML = `<td>${it.itemId||''}</td><td>${it.itemName||''}</td><td>${it.quantity}</td><td>${(it.basePriceVND||0).toLocaleString('vi-VN')}</td><td>${allocSum.toLocaleString('vi-VN')}</td><td>${(it.totalImportCost||0).toLocaleString('vi-VN')}</td><td>${(it.unitImportCost||0).toLocaleString('vi-VN')}</td>`;
                resultTableBody.appendChild(tr);
            });
            resultSummary.innerHTML = `<div>Tổng chi phí: <strong>${res.summary.totalCost.toLocaleString('vi-VN')}</strong> — Tổng phân bổ: <strong>${res.summary.totalAllocated.toLocaleString('vi-VN')}</strong> — Sai số làm tròn: <strong>${res.summary.roundingDiff.toLocaleString('vi-VN')}</strong></div>`;
            btnExport.disabled=false;
        }catch(err){ showErrors([{message:err.message}]); console.error(err); }
    });

    btnClear.addEventListener('click',(e)=>{ e.preventDefault(); document.getElementById('lotCode').value=''; document.getElementById('importDate').value=''; document.getElementById('exchangeRate').value=''; itemsTbody.innerHTML=''; costsTbody.innerHTML=''; resultTableBody.innerHTML=''; resultsWrap.style.display='none'; clearErrors(); });

    btnExport.addEventListener('click',(e)=>{ e.preventDefault(); const rows = []; const headers = ['Mã','Tên','Số lượng','Giá gốc (VND)','Chi phí phân bổ (VND)','Tổng chi phí nhập (VND)','Đơn giá nhập (VND)']; rows.push(headers.join(',')); Array.from(resultTableBody.querySelectorAll('tr')).forEach(tr=>{ const cols=Array.from(tr.children).map(td=>`"${td.textContent.replace(/"/g,'""')}"`); rows.push(cols.join(',')); }); const csv = rows.join('\n'); const blob = new Blob([csv],{type:'text/csv'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='allocation_result.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); });

});
