/**
 * invoice-ocr-vision.js
 * Calls a vision-capable AI API (Gemini or DeepSeek) DIRECTLY from the
 * browser, using the user's own API key — the image and the key never
 * touch NotDore's server. Each user consumes their own free-tier quota
 * instead of sharing one, which is the whole point: this tool may get
 * many concurrent users, and a single shared key's free-tier limit
 * (~1000 req/day) would bottleneck everyone.
 *
 * The key is stored only in the browser's localStorage.
 */
(function (global) {
  'use strict';
  const ns = (global.IOCR = global.IOCR || {});

  const STORAGE_KEY = 'iocr_ai_settings_v1';
  const GEMINI_MODEL = 'gemini-flash-latest'; // Google's floating alias — always the current Flash model
  const DEEPSEEK_MODEL = 'deepseek-v4-flash-vision-exp'; // experimental as of 2026 — flagged as such in the UI

  // ---- settings storage ----

  function getSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function clearSettings() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // ---- shared prompt (both providers get the same instructions) ----

  const PROMPT = `Bạn đang xem ảnh chụp một trong hai loại chứng từ tiếng Việt sau. Hãy xác định đúng loại rồi trích xuất chính xác 8 trường thông tin.

LOẠI 1 — "Phiếu báo tra cứu hóa đơn" (biên nhận của cảng/kho/logistics):
- ngay: giá trị sau nhãn "Ngày:", hoặc dòng ngày/giờ in ngay dưới tiêu đề nếu không có nhãn
- soHoaDon: giá trị sau nhãn "Số hóa đơn:"
- maTraCuu: giá trị sau nhãn "Mã tra cứu:"
- soTien: giá trị sau nhãn "Số tiền:"
- maSoThue: giá trị sau nhãn "Mã Số Thuế:" hoặc "MST:" (bỏ trống nếu phiếu không có trường này)
- khachHang: giá trị sau nhãn "Khách Hàng:" hoặc "Tên đơn vị:" — CHÚ Ý: khác với "Mã khách hàng" (là 1 mã số, không phải tên công ty, không lấy vào đây)
- diaChi: giá trị sau nhãn "Địa Chỉ:", có thể xuống dòng, gộp thành 1 chuỗi
- link: đường link tra cứu (URL) in ở cuối phiếu

LOẠI 2 — "Hóa đơn giá trị gia tăng" (hóa đơn điện tử, vd MISA meInvoice):
Đây là 2 khối thông tin: bên BÁN (ở đầu trang, dưới dạng letterhead) và bên MUA (dưới mục "Họ tên người mua hàng"). CHỈ lấy thông tin của bên MUA cho các trường bên dưới:
- ngay: ngày ghi trên hóa đơn (ngay dưới dòng tiêu đề "HÓA ĐƠN GIÁ TRỊ GIA TĂNG"), định dạng "Ngày X tháng Y năm Z" — KHÔNG lấy ngày của 1 hóa đơn khác được nhắc tới (vd dòng "Thay thế cho hóa đơn ... ngày X")
- soHoaDon: giá trị sau nhãn "Số:" (số hóa đơn, KHÔNG phải "Số tài khoản", "Số tiền", "Số lượng")
- maTraCuu: giá trị sau nhãn "Mã tra cứu:" (thường ở cuối trang, cùng dòng với "Tra cứu tại Website")
- soTien: giá trị sau nhãn "Tổng tiền thanh toán:"
- maSoThue: mã số thuế của bên MUA (trong khối "Họ tên người mua hàng"), KHÔNG phải MST của bên bán ở đầu trang
- khachHang: giá trị sau nhãn "Tên đơn vị:" trong khối bên mua
- diaChi: giá trị sau nhãn "Địa chỉ:" trong khối bên mua (không phải địa chỉ bên bán)
- link: đường link tra cứu (URL) ở cuối trang

QUY TẮC CHUNG:
- Ngày luôn trả về theo định dạng dd/mm/yyyy.
- soTien trả về dạng chuỗi số nguyên, chỉ chứa chữ số (bỏ hết dấu chấm/phẩy/khoảng trắng), ví dụ "1050000".
- Nếu ảnh không có trường nào đó, hoặc không đọc rõ, trả về chuỗi rỗng "" cho trường đó — KHÔNG suy đoán hay bịa thông tin.
- raw_text: chép lại toàn bộ chữ đọc được trên ảnh theo đúng thứ tự xuất hiện, giữ nguyên dấu tiếng Việt, dùng để đối chiếu khi cần.`;

  const RESPONSE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      raw_text: { type: 'STRING' },
      ngay: { type: 'STRING' },
      soHoaDon: { type: 'STRING' },
      maTraCuu: { type: 'STRING' },
      soTien: { type: 'STRING' },
      maSoThue: { type: 'STRING' },
      khachHang: { type: 'STRING' },
      diaChi: { type: 'STRING' },
      link: { type: 'STRING' },
    },
    required: ['raw_text', 'ngay', 'soHoaDon', 'maTraCuu', 'soTien', 'maSoThue', 'khachHang', 'diaChi', 'link'],
  };

  // ---- helpers ----

  const MAX_LONG_EDGE = 2000; // downscale before sending: keeps requests
                              // fast and avoids any edge-case size/tile
                              // limits on the provider side; text stays
                              // perfectly legible well below this size.

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Không đọc được ảnh (file có thể bị hỏng hoặc không đúng định dạng).'));
      img.src = dataUrl;
    });
  }

  async function downscaleIfNeeded(blob) {
    const dataUrl = await blobToDataUrl(blob);
    const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!match) throw new Error('Không đọc được dữ liệu ảnh.');
    const [, mimeType] = match;

    // HEIC/HEIF (common on iPhone photos) can't be decoded by <img> in most
    // browsers — surface a clear message instead of a confusing failure.
    if (/heic|heif/i.test(mimeType)) {
      throw new Error('Ảnh định dạng HEIC/HEIF chưa được hỗ trợ — vui lòng đổi máy ảnh/điện thoại sang chụp JPG/PNG, hoặc chuyển đổi file trước khi tải lên.');
    }

    let img;
    try {
      img = await loadImage(dataUrl);
    } catch {
      // fall back to sending the original bytes untouched if decoding for
      // resize fails for any reason — better to try than to hard-fail here
      return { base64: match[2], mimeType };
    }

    if (Math.max(img.width, img.height) <= MAX_LONG_EDGE) {
      return { base64: match[2], mimeType };
    }

    const ratio = MAX_LONG_EDGE / Math.max(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * ratio);
    canvas.height = Math.round(img.height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    // Dùng toBlob (async, không block UI thread) thay vì toDataURL (sync, blocking)
    const resizedBlob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Không tạo được blob từ canvas.'));
      }, 'image/jpeg', 0.88);
    });
    const resizedDataUrl = await blobToDataUrl(resizedBlob);
    const resizedMatch = /^data:([^;]+);base64,(.+)$/.exec(resizedDataUrl);
    return { base64: resizedMatch[2], mimeType: 'image/jpeg' };
  }

  async function safeFetch(url, options, provider) {
    try {
      return await fetch(url, options);
    } catch (networkErr) {
      throw new Error(
        `Không gửi được yêu cầu tới ${provider} — có thể do mất mạng, bị trình chặn quảng cáo/CORS chặn, ` +
        `hoặc ${provider} tạm thời không phản hồi. Chi tiết: ${networkErr.message || networkErr}`
      );
    }
  }

  function mapHttpError(status, bodyText, provider) {
    if (status === 429) {
      return `${provider} báo hết quota miễn phí cho hôm nay (rate limit) — thử lại sau, hoặc bật billing để bỏ giới hạn.`;
    }
    if (status === 401 || status === 403) {
      return `API key ${provider} không hợp lệ hoặc không có quyền truy cập — kiểm tra lại trong phần Cài đặt AI.`;
    }
    if (status === 413) {
      return `Ảnh quá lớn đối với ${provider} — thử chụp lại với độ phân giải thấp hơn.`;
    }
    return `${provider} lỗi HTTP ${status}: ${(bodyText || '').slice(0, 300)}`;
  }

  function cleanUrl(u) {
    if (!u) return u;
    u = u.replace(/^(https?):\s+\/\//, '$1://');
    return u.replace(/[.,;:)\]\-]+$/, '');
  }

  function mapResultToFields(parsed) {
    const fields = {
      ngay: '', soHoaDon: '', maTraCuu: '', soTien: '', soTienRaw: '',
      maSoThue: '', khachHang: '', diaChi: '', link: '',
    };
    for (const k of ['ngay', 'soHoaDon', 'maTraCuu', 'maSoThue', 'khachHang', 'diaChi', 'link']) {
      fields[k] = (parsed[k] == null ? '' : String(parsed[k])).trim();
    }
    const digits = (parsed.soTien == null ? '' : String(parsed.soTien)).replace(/[^\d]/g, '');
    fields.soTienRaw = parsed.soTien == null ? '' : String(parsed.soTien);
    fields.soTien = digits ? parseInt(digits, 10) : '';
    fields.link = cleanUrl(fields.link);
    return fields;
  }

  // ---- Gemini ----

  async function callGemini(apiKey, base64, mimeType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await safeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          }],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        }),
      }, 'Gemini');
      if (res.ok) {
        const data = await res.json();
        const candidate = data?.candidates?.[0];
        const textOut = candidate?.content?.parts?.[0]?.text;
        if (!textOut) {
          const reason = candidate?.finishReason;
          if (reason && reason !== 'STOP') {
            throw new Error(`Gemini từ chối xử lý ảnh này (finishReason: ${reason}) — thử ảnh khác hoặc chụp lại rõ hơn.`);
          }
          throw new Error('Gemini không trả về nội dung hợp lệ (phản hồi rỗng).');
        }
        try {
          return JSON.parse(textOut);
        } catch {
          throw new Error('Gemini trả về nội dung không đúng định dạng JSON mong đợi.');
        }
      }
      // Xử lý lỗi HTTP
      const body = await res.text().catch(() => '');
      const status = res.status;
      if (status === 503 || status === 502 || status === 504 || status === 429) {
        if (attempt < maxRetries) {
          const delayMs = status === 429
            ? Math.min(2000 * Math.pow(2, attempt), 30000)  // 429: back off ngắn hơn, tối đa 30s
            : Math.min(1000 * Math.pow(2, attempt), 15000);
          console.warn(`Gemini ${status} — chờ ${delayMs}ms rồi thử lại (lần ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }
      throw new Error(mapHttpError(status, body, 'Gemini'));
    }
    throw new Error('Gemini không phản hồi sau nhiều lần thử lại.');
  }

  // ---- DeepSeek (experimental vision model, OpenAI-compatible schema) ----

  async function callDeepSeek(apiKey, base64, mimeType) {
    const url = 'https://api.deepseek.com/chat/completions';
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await safeFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          temperature: 0,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: PROMPT + '\n\nTrả lời DUY NHẤT bằng một object JSON hợp lệ đúng các khóa: raw_text, ngay, soHoaDon, maTraCuu, soTien, maSoThue, khachHang, diaChi, link. Không thêm chữ nào khác, không dùng markdown code fence.' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          }],
        }),
      }, 'DeepSeek');
      if (res.ok) {
        const data = await res.json();
        let textOut = data?.choices?.[0]?.message?.content;
        if (!textOut) throw new Error('DeepSeek không trả về nội dung hợp lệ.');
        textOut = textOut.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '');
        try {
          return JSON.parse(textOut);
        } catch {
          throw new Error('DeepSeek trả về nội dung không đúng định dạng JSON mong đợi.');
        }
      }
      // Xử lý lỗi HTTP
      const body = await res.text().catch(() => '');
      const status = res.status;
      if (status === 503 || status === 502 || status === 504 || status === 429) {
        if (attempt < maxRetries) {
          const delayMs = status === 429
            ? Math.min(2000 * Math.pow(2, attempt), 30000)
            : Math.min(1000 * Math.pow(2, attempt), 15000);
          console.warn(`DeepSeek ${status} — chờ ${delayMs}ms rồi thử lại (lần ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }
      throw new Error(mapHttpError(status, body, 'DeepSeek'));
    }
    throw new Error('DeepSeek không phản hồi sau nhiều lần thử lại.');
  }

  // ---- public entry point ----

  async function recognizeImage(blob) {
    const settings = getSettings();
    if (!settings || !settings.apiKey) {
      const err = new Error('Chưa cấu hình API key AI.');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const { base64, mimeType } = await downscaleIfNeeded(blob);

    const parsed = settings.provider === 'deepseek'
      ? await callDeepSeek(settings.apiKey, base64, mimeType)
      : await callGemini(settings.apiKey, base64, mimeType);

    return { fields: mapResultToFields(parsed), text: parsed.raw_text || '' };
  }

  ns.Vision = { getSettings, saveSettings, clearSettings, recognizeImage };
})(window);
