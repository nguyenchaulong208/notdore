/**
 * assets/js/util/tinh-phan-bo-bhxh.js — Module Công cụ BHXH (Utility)
 * 
 * Chỉ chứa logic toán học và hiển thị kết quả, không gọi API.
 * Các hàm đã được tách ra khỏi giao diện HTML.
 */

// --- Hằng số và Tỷ lệ (Không thay đổi) ---
export const EMP_RATES = [
    { label: 'BHXH', rate: 17.5, display: '17,50%' },
    { label: 'BHYT', rate: 3, display: '3%' },
    { label: 'BHTN', rate: 1, display: '1%' }
];

export const NLD_RATES = [
    { label: 'BHXH', rate: 8, display: '8%' },
    { label: 'BHYT', rate: 1.5, display: '1,50%' },
    { label: 'BHTN', rate: 1, display: '1%' }
];

export const EMP_TOTAL_RATE = 21.5;
export const NLD_TOTAL_RATE = 10.5;
export const TOTAL_RATE = EMP_TOTAL_RATE + NLD_TOTAL_RATE; // 32%


// --- Các hàm Utility ---

/** Định dạng số tiền (thêm dấu chấm hàng nghìn) */
export function fmt(n) {
    var neg = n < 0;
    var s = String(Math.round(Math.abs(n)));
    var out = '';
    while (s.length > 3) {
      out = '.' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return (neg ? '-' : '') + s + out;
}

/** Trích xuất số chỉ là chữ số */
export function digitsOf(str) {
    var d = String(str || '').replace(/[^\\d]/g, '');
    return d ? d : null;
}

/** Tỷ lệ dạng "25,50%" */
export function pct(v) {
    return v.toFixed(2).replace('.', ',') + '%';
}

// --- Logic Tính toán ---

/**
 * Tính toán toàn bộ dữ liệu phân bổ BHXH
 * @param {number} baseValue - Mức lương hoặc Tổng tiền.
 * @returns {object} Object chứa các giá trị trung gian và tổng cộng.
 */
export function calculateBHXH(baseValue) {
    var base = baseValue;
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

    return {
        base: base,
        empRates: EMP_RATES,
        empAmounts: empAmounts,
        empSum: empSum,
        nldRates: NLD_RATES,
        nldAmounts: nldAmounts,
        nldSum: nldSum,
        grand: empSum + nldSum
    };
}

/** Tạo HTML bảng tổng hợp theo loại bảo hiểm */
export function summaryRowsHtml(data) {
    var html = '';
    for (var i = 0; i < data.empRates.length; i++) {
        var label = data.empRates[i].label;
        var empRate = data.empRates[i].rate;
        var nldRate = data.nldRates[i].rate;
        var empAmt = data.empAmounts[i];
        var nldAmt = data.nldAmounts[i];
        var total = empAmt + nldAmt;

        html += '<tr><td>' + label + '</td>' +\n              '<td>' + pct(empRate) + '</td>' +\n              '<td class=\"nd-calc-amt\">' + fmt(empAmt) + '</td>' +\n              '<td>' + pct(nldRate) + '</td>' +\n              '<td class=\"nd-calc-amt\">' + fmt(nldAmt) + '</td>' +\n              '<td>' + pct(empRate + nldRate) + '</td>' +\n              '<td>' + fmt(total) + '</td></tr>';
    }
    return html;
}
