/**
 * invoice-ocr-vat-parser.js
 * Parses "Hóa đơn giá trị gia tăng" (VAT invoice, e.g. MISA meInvoice) text
 * extracted directly from a real PDF's text layer (via pdf.js) — never OCR,
 * so diacritics are always correct. Ported 1:1 from the Python version that
 * was tested against real extracted text from two sample PDFs.
 */
(function (global) {
  'use strict';
  const ns = (global.IOCR = global.IOCR || {});

  const URL_RE = /https?:\s?\/\/[^\s"'<>]+/i;

  function cleanUrl(u) {
    u = u.replace(/^(https?):\s+\/\//, '$1://');
    return u.replace(/[.,;:)\]\-]+$/, '');
  }

  const HEADING_VAT_INVOICE_RE = /H[ÓOóo]A\s*Đ[ƠOơo]N\s*GI[ÁAáa]\s*TR[ỊIịi]\s*GIA\s*T[ĂAăa]NG/;

  function isVatInvoice(text) {
    return HEADING_VAT_INVOICE_RE.test(text || '');
  }

  function emptyFields() {
    return {
      ngay: '', soHoaDon: '', maTraCuu: '', soTien: '', soTienRaw: '',
      maSoThue: '', khachHang: '', diaChi: '', link: '',
    };
  }

  function parseAmountString(raw) {
    if (!raw) return ['', null];
    const digits = raw.replace(/[^\d]/g, '');
    return [raw.trim(), digits ? parseInt(digits, 10) : null];
  }

  function parseVatInvoice(rawText) {
    const text = (rawText || '').replace(/\r/g, '');
    const result = emptyFields();

    // Ngày: right after "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" — not some other
    // "ngày ... tháng ... năm ..." mention (e.g. a replaced-invoice
    // reference). \s* not \s+: real PDF text can merge words with zero
    // spaces ("Ngày30tháng05năm2026").
    const heading = HEADING_VAT_INVOICE_RE.exec(text);
    const searchFrom = heading ? heading.index + heading[0].length : 0;
    const dateMatch = /[Nn]g[àaày]y\s*(\d{1,2})\s*th[áa]ng\s*(\d{1,2})\s*n[ăa]m\s*(\d{4})/.exec(
      text.slice(searchFrom, searchFrom + 300)
    );
    if (dateMatch) {
      const d = dateMatch[1].padStart(2, '0');
      const m = dateMatch[2].padStart(2, '0');
      result.ngay = `${d}/${m}/${dateMatch[3]}`;
    }

    // Số hóa đơn: "Số" immediately followed by ":" then digits — excludes
    // "Số tiền:", "Số tài khoản:", "Số hộ chiếu:" (extra word before ":").
    const soMatch = /\bS[ốoO]\s*:\s*(\d{3,12})\b/.exec(text);
    if (soMatch) result.soHoaDon = soMatch[1];

    // Mã tra cứu + Link
    const mtcMatch = /M[aã]\s*tra\s*c[ứu]u\s*:?\s*([A-Za-z0-9]{6,16})/.exec(text);
    if (mtcMatch) result.maTraCuu = mtcMatch[1].toUpperCase();
    const urlMatch = URL_RE.exec(text);
    if (urlMatch) result.link = cleanUrl(urlMatch[0]);

    // Số tiền: "Tổng tiền thanh toán: 529.200"
    const amountMatch = /T[ổo]ng\s*ti[ềe]n\s*thanh\s*to[áa]n\s*:\s*([\d.,\s]+)/.exec(text);
    if (amountMatch) {
      const [raw, number] = parseAmountString(amountMatch[1]);
      result.soTienRaw = raw;
      result.soTien = number !== null ? number : '';
    }

    // Buyer block: everything after "Họ tên người mua hàng" describes the
    // counterparty being invoiced — that's what Khách hàng / Mã số thuế /
    // Địa chỉ mean here, not the seller letterhead earlier in the file.
    const buyerMatch = /H[ọo]\s*t[êe]n\s*ng[ưu][ờo]i\s*mua\s*h[àa]ng/.exec(text);
    const window_ = buyerMatch ? text.slice(buyerMatch.index + buyerMatch[0].length, buyerMatch.index + buyerMatch[0].length + 700) : '';

    const companyMatch = /T[êe]n\s*đ[ơo]n\s*v[ịi]\s*:\s*([^\n]+)/.exec(window_);
    if (companyMatch) result.khachHang = companyMatch[1].trim();

    const taxMatch = /M[aã]\s*s[ốo]\s*thu[ếe]\s*:\s*(\d[\d\s]{8,14}\d)/.exec(window_);
    if (taxMatch) result.maSoThue = taxMatch[1].replace(/\s/g, '');

    const addressMatch = /Đ[ịi]a\s*ch[ỉi]\s*:\s*([\s\S]+?)(?=\n[^\n:]{2,25}:|\nCăn\s*cước|\nHình\s*thức|$)/.exec(window_);
    if (addressMatch) {
      const addr = addressMatch[1].replace(/\n/g, ' ').trim();
      result.diaChi = addr.replace(/\s{2,}/g, ' ');
    }

    return result;
  }

  ns.VatParser = { isVatInvoice, parseVatInvoice, emptyFields };
})(window);
