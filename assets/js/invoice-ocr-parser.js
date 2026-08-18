/**
 * invoice-ocr-parser.js
 * Pure logic module: parses raw OCR text from "Phiếu báo tra cứu hóa đơn"
 * receipts into structured fields. No DOM dependency — safe to unit test.
 *
 * Exposes: window.IOCR.Parser.parseFields(rawText) -> {
 *   ngay, soHoaDon, maTraCuu, soTien, soTienRaw, maSoThue,
 *   khachHang, diaChi, link, rawText
 * }
 */
(function (global) {
  'use strict';

  const ns = (global.IOCR = global.IOCR || {});

  // ---- helpers -------------------------------------------------------

  function stripDiacritics(str) {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  function normLabel(str) {
    return stripDiacritics(str)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function isSeparatorLine(line) {
    const t = line.trim();
    if (!t) return true;
    // lines made mostly of dots/dashes/underscores used as visual separators
    return /^[.\-_·•\s]{3,}$/.test(t);
  }

  function isSectionEndLine(lineNorm) {
    // lines that signal "end of address / customer block"
    return (
      lineNorm.startsWith('quykhachvuilong') ||
      lineNorm.startsWith('quykhachvuilongtracuu') ||
      lineNorm.startsWith('hotline') ||
      lineNorm.startsWith('hotro') ||
      lineNorm.startsWith('vuilongquet')
    );
  }

  // Label definitions, in normalized (no-diacritics, lowercase, no punctuation) form.
  // Order matters: more specific patterns first.
  const LABELS = [
    { key: 'soHoaDon', patterns: ['sohoadon', 'sohoadon'] },
    { key: 'maTraCuu', patterns: ['matracuu'] },
    { key: 'soTien', patterns: ['sotien'] },
    { key: 'maSoThue', patterns: ['masothue', 'mst'] },
    { key: 'khachHang', patterns: ['khachhang', 'tendonvi'] },
    { key: 'diaChi', patterns: ['diachi'] },
    { key: 'ngay', patterns: ['ngay'] }, // keep last: "ngay" is a common substring
  ];

  function findLabelKey(lineNorm) {
    for (const { key, patterns } of LABELS) {
      for (const p of patterns) {
        if (lineNorm.startsWith(p)) return key;
      }
    }
    return null;
  }

  // Multi-line fields: keep appending following lines until another label,
  // a separator line, or a section-end marker is hit.
  const MULTILINE_KEYS = new Set(['khachHang', 'diaChi']);

  function valueAfterColon(line) {
    const idx = line.indexOf(':');
    if (idx === -1) return '';
    return line.slice(idx + 1).trim();
  }

  // dd/mm/yyyy optionally followed by HH:MM(:SS)
  const DATE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?\b/;
  const URL_RE = /https?:\/\/[^\s"'<>]+/i;

  function parseAmount(valueStr) {
    if (!valueStr) return { raw: '', number: null };
    // pull out the numeric-looking chunk (digits, dots, commas)
    const m = valueStr.match(/[\d][\d.,\s]*\d|\d/);
    const raw = m ? m[0].trim() : valueStr.trim();
    const digitsOnly = raw.replace(/[^\d]/g, '');
    const number = digitsOnly ? parseInt(digitsOnly, 10) : null;
    return { raw, number };
  }

  function cleanTrailingUrlPunct(url) {
    return url.replace(/[.,;:)\]]+$/, '');
  }

  // ---- main parse ------------------------------------------------------

  function parseFields(rawText) {
    const text = (rawText || '').replace(/\r/g, '');
    const lines = text.split('\n').map((l) => l.trim());

    const result = {
      ngay: '',
      soHoaDon: '',
      maTraCuu: '',
      soTien: '',
      soTienRaw: '',
      maSoThue: '',
      khachHang: '',
      diaChi: '',
      link: '',
      rawText: text,
    };

    let currentMultilineKey = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        currentMultilineKey = null;
        continue;
      }

      const lineNorm = normLabel(line);

      if (isSectionEndLine(lineNorm)) {
        currentMultilineKey = null;
        continue;
      }

      if (isSeparatorLine(line)) {
        currentMultilineKey = null;
        continue;
      }

      const key = findLabelKey(lineNorm);

      if (key) {
        const val = valueAfterColon(line);
        if (key === 'soTien') {
          const { raw, number } = parseAmount(val);
          result.soTienRaw = raw;
          result.soTien = number !== null ? number : '';
        } else if (!result[key]) {
          result[key] = val;
        } else if (MULTILINE_KEYS.has(key)) {
          result[key] = (result[key] + ' ' + val).trim();
        }
        currentMultilineKey = MULTILINE_KEYS.has(key) ? key : null;
        continue;
      }

      // No label on this line: either a continuation of a multi-line field,
      // or (near the top, before any label) a bare date line.
      if (currentMultilineKey) {
        result[currentMultilineKey] = (result[currentMultilineKey] + ' ' + line).trim();
        continue;
      }

      if (!result.ngay) {
        const dm = line.match(DATE_RE);
        if (dm) {
          result.ngay = dm[2] ? `${dm[1]} ${dm[2]}` : dm[1];
        }
      }
    }

    // Fallback: if "ngay" label existed but value was empty, try scanning whole text
    if (!result.ngay) {
      const dm = text.match(DATE_RE);
      if (dm) result.ngay = dm[2] ? `${dm[1]} ${dm[2]}` : dm[1];
    }

    // Link: search whole raw text for first URL
    const um = text.match(URL_RE);
    if (um) result.link = cleanTrailingUrlPunct(um[0]);

    return result;
  }

  ns.Parser = {
    parseFields,
    parseAmount,
    stripDiacritics,
    normLabel,
  };
})(window);
