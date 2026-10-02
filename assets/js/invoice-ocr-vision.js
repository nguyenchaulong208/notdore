/**
 * invoice-ocr-vision.js
 * Calls NVIDIA NIM API (OpenAI-compatible) DIRECTLY from the browser,
 * using the user's own API key — the image and the key never touch
 * NotDore's server. Each user consumes their own quota instead of
 * sharing one.
 *
 * The key is stored only in the browser's localStorage.
 */
(function (global) {
  'use strict';
  const ns = (global.IOCR = global.IOCR || {});

  const STORAGE_KEY = 'iocr_ai_settings_v1';
  const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
  const NVIDIA_DEFAULT_MODEL = 'z-ai/glm-5.3-flash';

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

  // ---- shared prompt ----

  const PROMPT = `Bạn đang xem ảnh chụp một trong các loại chứng từ tiếng Việt sau. Hãy xác định đúng loại rồi trích xuất chính xác 9 trường thông tin.

LOẠI 1 — "Phiếu báo tra cứu hóa đơn" (biên nhận của cảng/kho/logistics):
- icon hoặc tiêu đề thường có từ "PHIẾU BÁO", "TRA CỨU HÓA ĐƠN", "BÁO TRA CỨU"
- ngay: giá trị sau nhãn "Ngày:" hoặc dòng ngày/giờ in ngay dưới tiêu đề
- soHoaDon: giá trị sau nhãn "Số hóa đơn:" hoặc "Số:"
- maTraCuu: giá trị sau nhãn "Mã tra cứu:" (thường là mã hash 32-40 ký tự, in cuối trang)
- soTien: giá trị sau nhãn "Số tiền:" hoặc "Số tiền thanh toán:"
- maSoThue: giá trị sau nhãn "Mã Số Thuế:" hoặc "MST:" — thường là 10 ký tự, bỏ trống nếu không có
- khachHang: TÊN công ty/đơn vị (giá trị sau nhãn "Khách Hàng:" hoặc "Tên đơn vị:"), KHÔNG lấy mã số
- diaChi: giá trị sau nhãn "Địa Chỉ:" — có thể xuống dòng, gộp thành 1 chuỗi
- link: URL tra cứu in ở cuối phiếu (thường chứa "tax.gov.vn" hoặc "tra-cuu")

LOẠI 2 — "Hóa đơn giá trị gia tăng" (hóa đơn điện tử, vd MISA meInvoice):
- tiêu đề "HÓA ĐƠN GIÁ TRỊ GIA TĂNG" hoặc "HÓA ĐƠN ĐIỆN TỬ"
- Có 2 khối: bên BÁN (đầu trang, letterhead) và bên MUA (dưới "Họ tên người mua hàng")
- CHỈ lấy thông tin bên MÀU cho các trường sau:
  - ngay: ngày trên hóa đơn (dưới tiêu đề), định dạng "dd/mm/yyyy" — KHÔNG lấy ngày của hóa đơn khác (vd "Thay thế cho hóa đơn... ngày...")
  - soHoaDon: giá trị sau nhãn "Số:" — KHÔNG phải "Số tài khoản", "Số tiền", "Số lượng"
  - maTraCuu: giá trị sau nhãn "Mã tra cứu:" — thường ở cuối trang, cạnh "Tra cứu tại Website"
  - soTien: giá trị sau nhãn "Tổng tiền thanh toán:" hoặc "Tổng cộng:"
  - maSoThue: MST của BỘ PHẬN MUA (trong khối "Họ tên người mua hàng"), KHÔNG phải MST bên bán ở đầu trang
  - khachHang: TÊN bên mua (sau nhãn "Tên đơn vị:" trong khối bên mua), KHÔNG phải tên bên bán
  - diaChi: ĐỊA CHỈ bên mua (sau nhãn "Địa chỉ:" trong khối bên mua)
  - link: URL tra cứu cuối trang (thường chứa "tax.gov.vn" hoặc "meinvoice")

LOẠI 3 — "Hóa đơn mua hàng thông thường" (hóa đơn không phải điện tử, vd hóa đơn xi mách, hóa đơn kho Tổng):
- KHÔNG có tiêu đề "Phiếu báo tra cứu" và KHÔNG có "HÓA ĐƠN GIÁ TRỊ GIA TĂNG"
- Các trường có thể khác layout, model cần đọc và suy luận
- Nếu không tìm thấy trường nào, trả về "" cho trường đó

QUY TẮC CHUNG:
- Trả về "loai" là chuỗi tiếng Việt ngắn: "Phiếu báo tra cứu", "Hóa đơn GTGT", hoặc "Hóa đơn thông thường"
- Ngày luôn dd/mm/yyyy (vd "13/08/2025")
- soTien: chuỗi số nguyên, không dấu, không khoảng trắng, không chữ ('1050000')
- Nếu không tìm thấy trường → trả về "" (không được suy đoán)
- raw_text: chép toàn bộ chữ đọc được trên ảnh, giữ nguyên dấu tiếng Việt, đúng thứ tự xuất hiện
- KHÔNG thêm bất kỳ chữ nào khác vào JSON, KHÔNG dùng markdown code fence.`;

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
      // Trả về response giả để caller xử lý như HTTP error, tránh ném ngoại lệ làm lose thông tin status
      const fakeRes = {
        ok: false,
        status: 0,
        statusText: 'Network Error',
        text: () => Promise.resolve(`Không gửi được yêu cầu tới ${provider} — ${networkErr.message || networkErr}`),
        headers: new Headers(),
      };
      console.warn(`[safeFetch] ${provider} network error: ${networkErr.message || networkErr}`);
      return fakeRes;
    }
  }

  function mapHttpError(status, bodyText, provider) {
    if (status === 429) {
      return `${provider} báo hết quota (rate limit) — thử lại sau, hoặc nâng cấp plan để bỏ giới hạn.`;
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

  // ---- NVIDIA NIM API (OpenAI-compatible) ----

  async function callNvidia(apiKey, base64, mimeType, model) {
    const url = `${NVIDIA_BASE_URL}/chat/completions`;
    const usedModel = model || NVIDIA_DEFAULT_MODEL;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await safeFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: usedModel,
          temperature: 0,
          max_tokens: 4096,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: PROMPT + '\n\nTrả lời DUY NHẤT bằng một object JSON hợp lệ đúng các khóa: raw_text, loai, ngay, soHoaDon, maTraCuu, soTien, maSoThue, khachHang, diaChi, link. Không thêm chữ nào khác, không dùng markdown code fence.',
              },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${base64}` },
              },
            ],
          }],
        }),
      }, 'NVIDIA');

      if (res.ok) {
        const data = await res.json();
        let textOut = data?.choices?.[0]?.message?.content;
        if (!textOut) throw new Error('NVIDIA không trả về nội dung hợp lệ.');
        textOut = textOut.trim()
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/```\s*$/i, '');
        try {
          return JSON.parse(textOut);
        } catch {
          throw new Error('NVIDIA trả về nội dung không đúng định dạng JSON mong đợi.');
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
          console.warn(`NVIDIA ${status} — chờ ${delayMs}ms rồi thử lại (lần ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(r => setTimeout(r, delayMs));
          continue;
        }
      }
      throw new Error(mapHttpError(status, body, 'NVIDIA'));
    }
    throw new Error('NVIDIA không phản hồi sau nhiều lần thử lại.');
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

    const parsed = await callNvidia(settings.apiKey, base64, mimeType, settings.model);

    return { fields: mapResultToFields(parsed), text: parsed.raw_text || '' };
  }

  ns.Vision = { getSettings, saveSettings, clearSettings, recognizeImage };
})(window);
