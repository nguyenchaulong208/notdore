/**
 * invoice-extractor-engine.js
 * Nghiệp vụ trích xuất hóa đơn qua LM Studio: cấu hình, load model,
 * xử lý nhóm file, gọi API, parse kết quả, quản lý kết quả.
 * Không phụ thuộc DOM — chỉ dùng abstraction từ utils và nhận
 * element IDs từ caller.
 */
(function (global, utils) {
  'use strict';

  if (!utils) {
    console.error('InvoiceExtractorEngine: InvoiceExtractorUtils không tải được');
    return;
  }

  const {
    renderPdfPageAsDataUrl,
    renderImageFileAsDataUrl,
    buildDynamicBatches,
    runPool,
    parseModelJson,
    updateProgress,
  } = utils;

  // ---- SYSTEM PROMPT ----
  // Schema chuẩn hóa để trích xuất hóa đơn bán hàng & biên lai thu phí VN
  const SYSTEM_PROMPT = `BẠN LÀ TRỢ LÍ TRÍCH XUẤT DỮ LIỆU HÓA ĐƠN - BIÊN LÃI ĐIỆN TỬ VIỆT NAM.
Mỗi tài liệu (image/png/png/scan hóa đơn, text PDF, HTML...) hãy trích xuất RẤT ĐẶC ĐIỂM:
loại chứ từ, số chứng từ, ngày lập, tên người mua, MST người mua, đơn vị bán, MST bán,
đơn vị mua, MST mua, nội dung hàng hóa/dịch vụ, tiền trước thuế, thuế suất, tiền thuế,
tổng tiền, hình thức thanh toán.

QUY TẮC TRẢ LỜI:
1. Đúng 1 mảng JSON (Array), bắt đầu bằng [ và kết thúc bằng ], KHÔNG markdown, KHÔNG giải thích.
2. Mỗi phần tử = 1 tài liệu. Số phần tử phải bằng số tài liệu gửi.
3. file_index: bắt đầu từ 1, theo thứ tự tài liệu.
4. Dùng null (không để undefined, không rỗng) khi dữ liệu không có.
5. Số tiền (tien_truoc_thue, tien_thue, tong_tien): chỉ số, loại số. Loại bỏ dấu , và chữ.
6. ngay: dd/mm/yyyy. Nếu mạch không rõ, để null.
7. Hình thức thanh toán: "Tiền mặt", "Chuyển khoản", "Visa/Mastercard", "COD", null.

VÍ DỤ (không sao chép; dùng để hình dung định dạng mảng):
[
  {
    "file_index": 1,
    "loai_chung_tu": "Hóa đơn GTGT",
    "ky_hieu": "1234567890",
    "so": "240001234567",
    "ngay": "01/01/2026",
    "don_vi_ban": "Cổ phần",
    "mst_ban": "0101010101",
    "don_vi_mua": "Cổ phần",
    "mst_mua": "0202020202",
    "noi_dung": "Ván chữ s, khoảng 50 m×1.2m, chất liệu gỗ; Hàng rào thép, ~10m; khác",
    "tien_truoc_thue": 5000000,
    "thue_suat": "8%",
    "tien_thue": 400000,
    "tong_tien": 5400000,
    "hinh_thuc_tt": "Chuyển khoản"
  },
  {
    "file_index": 2,
    "loai_chung_tu": "Biên lai thu phí",
    "ky_hieu": null,
    "so": "BL-2026-001",
    "ngay": "05/01/2026",
    "don_vi_ban": null,
    "mst_ban": null,
    "don_vi_mua": "Cá nhân",
    "mst_mua": "1234567890",
    "noi_dung": "Thu phí chào hẹn sự kiện",
    "tien_truoc_thue": 0,
    "thue_suat": null,
    "tien_thue": 0,
    "tong_tien": 150000,
    "hinh_thuc_tt": "Tiền mặt"
  }
]

KHÔNG BAO GIỜ để thiếu bất kỳ file nào. Số phần tử của mảng phải bằng số file gốc.`;

  // ---- API call ----
  async function callLMStudio(base, model, userMessages, batchLen, timeoutMs) {
    if (timeoutMs === undefined) timeoutMs = 180000;
    const maxTokens = Math.min(8000, 500 + (batchLen || 1) * 700);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: maxTokens,
          messages: userMessages,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const choice = data.choices?.[0];
      const finishReason = choice?.finish_reason;
      const content = choice?.message?.content || '';
      if (finishReason === 'length') throw new Error('Phản hồi bị cắt do chạm giới hạn token — sẽ tự chia nhỏ lô và thử lại.');
      return content;
    } finally {
      clearTimeout(timer);
    }
  }

  // ---- Xử lý 1 nhóm file ----
  async function processFileGroup(group, callApiFn) {
    // group: mảng {sf, text, imageDataUrl}
    // callApiFn: hàm(base, model, messages, batchLen, timeoutMs) => raw string
    try {
      const userMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: group.map((it, idx) => {
          const header = `--- FILE ${idx + 1}: ${it.sf.file.name} ---\n`;
          if (it.imageDataUrl) {
            return [
              { type: 'text', text: header + '[Đây là ảnh chụp hóa đơn/biên lai. Vui lòng đọc và trích xuất thông tin theo schema JSON yêu cầu.]\n' },
              { type: 'image_url', image_url: { url: it.imageDataUrl } },
            ];
          }
          return { type: 'text', text: header + (it.text || '') + '\n' };
        }) },
      ];
      const base = document.getElementById('baseUrl').value.replace(/\/$/, '');
      const model = document.getElementById('modelInput').value.trim() || document.getElementById('modelSelect').value;
      const timeoutSec = parseInt(document.getElementById('timeoutSec').value) || 180;
      const raw = await callApiFn(base, model, userMessages, group.length, timeoutSec * 1000);
      const parsed = parseModelJson(raw, {
        file_index: 'number',
        loai_chung_tu: 'string',
        ky_hieu: 'string|null',
        so: 'string|null',
        ngay: 'string|null',
        don_vi_ban: 'string|null',
        mst_ban: 'string|null',
        don_vi_mua: 'string|null',
        mst_mua: 'string|null',
        noi_dung: 'string|null',
        tien_truoc_thue: 'number|null',
        thue_suat: 'string|null',
        tien_thue: 'number|null',
        tong_tien: 'number|null',
        hinh_thuc_tt: 'string|null',
      });
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      if (arr.length !== group.length) {
        // Nếu số phần tử không khớp, thử map trực tiếp theo thứ tự
        const arr2 = Array.isArray(parsed) ? parsed : [parsed];
        if (arr2.length === group.length) {
          group.forEach((sf, i) => {
            setResult(sf.sf, arr2[i] || {}, `Số kết quả không khớp (bản sao ${i + 1})`);
            sf.sf.status = 'ok'; sf.sf.note = '';
          });
        } else {
          throw new Error(`Model trả về ${arr2.length} kết quả cho ${group.length} file đã gửi.`);
        }
      } else {
        group.forEach((sf, i) => {
          const rec = arr.find(r => r.file_index === i + 1) || arr[i] || {};
          setResult(sf.sf, rec, '');
          sf.sf.status = 'ok'; sf.sf.note = '';
        });
      }
    } catch (err) {
      if (group.length === 1) {
        const sf = group[0].sf;
        setResult(sf, {}, err.message);
        sf.status = 'err'; sf.note = err.message;
      } else {
        const mid = Math.ceil(group.length / 2);
        await processFileGroup(group.slice(0, mid), callApiFn);
        await processFileGroup(group.slice(mid), callApiFn);
      }
    }
    renderFileList();
    refreshResultsFromMap();
  }

  // ---- Khai báo các hàm sẽ được implement bởi app.js (tham chiếu từ DOM) ----
  let _renderFileList, _refreshResultsFromMap, _setResult, _selectedFiles;

  function mountDOMInteractions(opts) {
    _renderFileList = opts.renderFileList;
    _refreshResultsFromMap = opts.refreshResultsFromMap;
    _setResult = opts.setResult;
    _selectedFiles = opts.selectedFiles;
  }

  // Đọc giá trị config từ DOM
  function getConfig() {
    return {
      baseUrl: document.getElementById('baseUrl').value.replace(/\/$/, ''),
      model: document.getElementById('modelInput').value.trim() || document.getElementById('modelSelect').value,
      batchSize: Math.min(Math.max(parseInt(document.getElementById('batchSize').value) || 5, 1), 10),
      timeoutSec: parseInt(document.getElementById('timeoutSec').value) || 180,
      maxChars: Math.max(parseInt(document.getElementById('maxChars').value) || 6000, 1000),
      concurrency: Math.min(Math.max(parseInt(document.getElementById('concurrency').value) || 1, 1), 6),
    };
  }

  // Load model list từ LM Studio
  async function loadModels(modelSelect, modelStatusEl) {
    modelStatusEl.className = 'small mt-1 text-muted';
    modelStatusEl.textContent = 'Đang tải...';
    const base = getConfig().baseUrl;
    try {
      const res = await fetch(`${base}/models`);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} ${body ? '- ' + body.slice(0, 200) : ''}`);
      }
      const data = await res.json();
      const list = data.data || [];
      modelSelect.innerHTML = '<option value="">-- chọn model --</option>';
      list.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id; opt.textContent = m.id;
        modelSelect.appendChild(opt);
      });
      if (list.length === 0) {
        modelStatusEl.className = 'small mt-1 text-warning';
        modelStatusEl.textContent = 'Kết nối OK nhưng LM Studio chưa load model nào (Load một model trong tab Local Server rồi tải lại).';
      } else {
        modelStatusEl.className = 'small mt-1 text-success';
        modelStatusEl.textContent = `Đã tải ${list.length} model.`;
      }
    } catch (err) {
      modelStatusEl.className = 'small mt-1 text-danger';
      modelStatusEl.textContent = 'Lỗi: ' + err.message + ' — Kiểm tra: (1) Local Server trong LM Studio đang bật (đèn xanh), (2) đã Load một model, (3) mục Settings > "Enable CORS" trong LM Studio đang bật, (4) Base URL đúng cổng (mặc định 1234).';
      console.error('loadModels error:', err);
    }
  }

  // Xử lý 1 file individual (public để app.js gọi trước khi batching)
  async function processSingleImageFile(sf, renderImageFileAsDataUrlFn) {
    try {
      sf.imageDataUrl = await renderImageFileAsDataUrlFn(sf.file);
      sf.status = 'pending';
    } catch (err) {
      sf.status = 'err';
      sf.note = 'Lỗi đọc ảnh: ' + err.message;
      _setResult(sf, {}, sf.note);
    }
    _renderFileList();
    _refreshResultsFromMap();
    return sf;
  }

  global.InvoiceExtractorEngine = {
    SYSTEM_PROMPT,
    callLMStudio,
    processFileGroup,
    mountDOMInteractions,
    getConfig,
    loadModels,
    processSingleImageFile,
  };
})(window, window.InvoiceExtractorUtils);
