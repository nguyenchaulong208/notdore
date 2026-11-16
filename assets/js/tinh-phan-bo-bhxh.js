/* tinh-phan-bo-bhxh.js — tính & phân bổ mức đóng bảo hiểm (BHXH/BHYT/BHTN)
 *
 * Tỷ lệ theo quy định hiện hành:
 *   NSDLD 21,5% = BHXH 17,5% + BHYT 3% + BHTN 1%
 *   NLD   10,5% = BHXH 8%   + BHYT 1,5% + BHTN 1%
 */
(function () {
  'use strict';

  var EMP_RATES = [
    { label: 'BHXH', rate: 17.5, display: '17,50%' },
    { label: 'BHYT', rate: 3,    display: '3%' },
    { label: 'BHTN', rate: 1,    display: '1%' }
  ];

  var NLD_RATES = [
    { label: 'BHXH', rate: 8,    display: '8%' },
    { label: 'BHYT', rate: 1.5,  display: '1,50%' },
    { label: 'BHTN', rate: 1,    display: '1%' }
  ];

  var EMP_TOTAL_RATE = 21.5;
  var NLD_TOTAL_RATE = 10.5;
  var TOTAL_RATE = EMP_TOTAL_RATE + NLD_TOTAL_RATE; // 32%

  var els = {
    modes: document.querySelectorAll('.nd-calc-mode'),
    inputs: document.getElementsByName('calc-mode'),
    input: document.getElementById('bhxh-input'),
    label: document.getElementById('calc-label'),
    hint: document.querySelector('.nd-calc-hint'),
    error: document.getElementById('calc-error'),
    run: document.getElementById('calc-run'),
    reset: document.getElementById('calc-reset'),
    result: document.getElementById('calc-result'),
    base: document.getElementById('out-base'),
    total: document.getElementById('out-total'),
    empBody: document.getElementById('out-emp-body'),
    nldBody: document.getElementById('out-nld-body'),
    empTotal: document.getElementById('out-emp-total'),
    nldTotal: document.getElementById('out-nld-total'),
    grand: document.getElementById('out-grand'),
    copy: document.getElementById('calc-copy'),
    exportBtn: document.getElementById('calc-export'),
    copied: document.getElementById('calc-copied')
  };

  var current = null;

  function fmt(n) {
    var neg = n < 0;
    var s = String(Math.round(Math.abs(n)));
    var out = '';
    while (s.length > 3) {
      out = '.' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return (neg ? '-' : '') + s + out;
  }

  function digitsOf(str) {
    var d = String(str || '').replace(/[^\d]/g, '');
    return d ? d : null;
  }

  function rowsHtml(rates, base) {
    var html = '';
    for (var i = 0; i < rates.length; i++) {
      var r = rates[i];
      var amount = Math.round((base * r.rate) / 100);
      html += '<tr><td>' + r.label + '</td><td>' + r.display + '</td>' +
              '<td class="nd-calc-amt">' + fmt(amount) + '</td></tr>';
    }
    return html;
  }

  function mode() {
    for (var i = 0; i < els.inputs.length; i++) {
      if (els.inputs[i].checked) return els.inputs[i].value;
    }
    return 'salary';
  }

  function setMode(mode) {
    for (var i = 0; i < els.modes.length; i++) {
      var input = els.modes[i].querySelector('input');
      var on = input.value === mode;
      els.modes[i].classList.toggle('is-active', on);
      input.checked = on;
    }
    var salary = mode === 'salary';
    els.label.textContent = salary ? 'Mức lương đóng bảo hiểm' : 'Tổng số tiền đã đóng';
    els.input.placeholder = salary ? 'VD: 191.500.000' : 'VD: 61.280.000';
    els.hint.textContent = salary
      ? 'Có thể nhập kèm dấu chấm, dấu phẩy hoặc khoảng trắng (VD: 191.500.000).'
      : 'Nhập tổng tiền bảo hiểm thực nộp (VD: 61.280.000); công cụ sẽ tính ngược mức lương.';
    hideError();
  }

  function showError(msg) {
    els.error.textContent = msg;
    els.error.hidden = false;
  }

  function hideError() {
    els.error.hidden = true;
  }

  function calculate() {
    var raw = digitsOf(els.input.value);
    if (!raw) {
      showError('Vui lòng nhập số tiền.');
      els.result.hidden = true;
      return;
    }

    var value = parseInt(raw, 10);
    if (!(value > 0)) {
      showError('Vui lòng nhập một số tiền hợp lệ (lớn hơn 0).');
      els.result.hidden = true;
      return;
    }

    var salary = mode() === 'salary';
    var base = salary ? value : value / (TOTAL_RATE / 100);

    var empAmounts = [];
    var empSum = 0;
    for (var i = 0; i < EMP_RATES.length; i++) {
      var a = Math.round((base * EMP_RATES[i].rate) / 100);
      empAmounts.push(a);
      empSum += a;
    }

    var nldAmounts = [];
    var nldSum = 0;
    for (var j = 0; j < NLD_RATES.length; j++) {
      var b = Math.round((base * NLD_RATES[j].rate) / 100);
      nldAmounts.push(b);
      nldSum += b;
    }

    current = {
      base: base,
      empRates: EMP_RATES,
      empAmounts: empAmounts,
      empSum: empSum,
      nldRates: NLD_RATES,
      nldAmounts: nldAmounts,
      nldSum: nldSum,
      grand: empSum + nldSum
    };

    render(current);
    hideError();
  }

  function render(data) {
    els.base.textContent = fmt(data.base);
    els.total.textContent = fmt(data.grand);
    els.empBody.innerHTML = rowsHtml(data.empRates, data.base);
    els.nldBody.innerHTML = rowsHtml(data.nldRates, data.base);
    els.empTotal.textContent = fmt(data.empSum);
    els.nldTotal.textContent = fmt(data.nldSum);
    els.grand.textContent = fmt(data.grand);
    els.result.hidden = false;

    var top = els.result.getBoundingClientRect().top + window.pageYOffset - 120;
    if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: 'smooth' });
  }

  function buildText(data) {
    var lines = [];
    lines.push('PHÂN BỔ TIỀN BẢO HIỂM');
    lines.push('======================');
    lines.push('Mức lương đóng bảo hiểm: ' + fmt(data.base) + ' VNĐ');
    lines.push('Tổng số tiền đã đóng: ' + fmt(data.grand) + ' VNĐ (' + TOTAL_RATE + '%)');
    lines.push('');
    lines.push('NSDLD - Ngườời sử dụng lao động (' + EMP_TOTAL_RATE + '%)');
    for (var i = 0; i < data.empRates.length; i++) {
      lines.push('  ' + data.empRates[i].label.padEnd(6, ' ') + data.empRates[i].display.padStart(8, ' ') +
                 '  ' + fmt(data.empAmounts[i]) + ' VNĐ');
    }
    lines.push('  Tổng NSDLD: ' + fmt(data.empSum) + ' VNĐ');
    lines.push('');
    lines.push('NLD - Ngườời lao động (' + NLD_TOTAL_RATE + '%)');
    for (var j = 0; j < data.nldRates.length; j++) {
      lines.push('  ' + data.nldRates[j].label.padEnd(6, ' ') + data.nldRates[j].display.padStart(8, ' ') +
                 '  ' + fmt(data.nldAmounts[j]) + ' VNĐ');
    }
    lines.push('  Tổng NLD: ' + fmt(data.nldSum) + ' VNĐ');
    lines.push('');
    lines.push('TỔNG PHẢI NỘP: ' + fmt(data.grand) + ' VNĐ');
    return lines.join('\n');
  }

  function flashCopied(msg) {
    els.copied.textContent = msg;
    window.setTimeout(function () { els.copied.textContent = ''; }, 2200);
  }

  function copyResult() {
    if (!current) return;
    var text = buildText(current);
    var done = function () { flashCopied('Đã sao chép kết quả.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  function exportTxt() {
    if (!current) return;
    var blob = new Blob([buildText(current)], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'phan-bo-bao-hiem.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flashCopied('Đã xuất file.');
  }

  function init() {
    if (!els.run) return;

    for (var i = 0; i < els.modes.length; i++) {
      els.modes[i].addEventListener('click', function () {
        var input = this.querySelector('input');
        if (!input.checked) { input.checked = true; setMode(input.value); }
      });
    }

    els.input.addEventListener('input', function () {
      var d = digitsOf(els.input.value);
      if (d === null) { els.input.value = ''; return; }
      els.input.value = fmt(parseInt(d, 10));
      els.input.setSelectionRange(els.input.value.length, els.input.value.length);
      hideError();
    });

    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); calculate(); }
    });

    els.run.addEventListener('click', calculate);
    els.copy.addEventListener('click', copyResult);
    els.exportBtn.addEventListener('click', exportTxt);

    els.reset.addEventListener('click', function () {
      els.input.value = '';
      els.result.hidden = true;
      current = null;
      hideError();
      els.input.focus();
    });

    setMode('salary');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
