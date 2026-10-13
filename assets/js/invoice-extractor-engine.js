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
  const SYSTEM_PROMPT = `Bạn là trợ lý trích xuất dữ liệu từ hóa đơn/biên lai điện tử Việt Nam (VAT invoice, biên lai thu phí, phiếu thu...).
Với mỗi tài liệu được cung cấp (đã được đánh số theo thứ tự file), hãy trả về MỘT đối tượng JSON trong một mảng JSON duy nhất, đúng thứ tự file đưa vào.
Chỉ trả về JSON hợp lệ, KHÔNG có markdown, KHÔNG có giải thích, KHÔNG có \`\`\`.
Nếu nhận được ảnh (thay vì text), vui lòng đọc ảnh và trích xuất tương tự.
Schema mỗi đối tượng:
{
 "file_index": number (số thứ tự file, bắt đầu từ 1),
 "loai_chung_tu": string (vd: "Hóa đơn GTGT", "Biên lai thu phí"),
 "ky_hieu": string|null,
 "so": string|null,
 "ngay": string|null (định dạng dd/mm/yyyy),
 "don_vi_ban": string|null,
 "mst_ban": string|null,
 "don_vi_mua": string|null,
 "mst_mua": string|null,
 "noi_dung": string|null (tóm tắt ngắn gọn hàng hóa/dịch vụ, nếu nhiều dòng thì nối bằng dấu ";"),
 "tien_truoc_thue": number|null (số nguyên, không dấu phân cách),
 "thue_suat": string|null (vd: "8%"),
 "tien_thue": number|null (số nguyên),
 "tong_tien": number|null (số nguyên),
 "hinh_thuc_tt": string|null
}
Nếu tài liệu không có trường nào thì để null. Không được bỏ sót file nào, số phần tử JSON phải bằng số file được cung cấp.`;

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
      const parsed = parseModelJson(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      if (arr.length !== group.length) {
        throw new Error(`Model trả về ${arr.length} kết quả cho ${group.length} file đã gửi.`);
      }
      group.forEach((sf, i) => {
        const rec = arr.find(r => r.file_index === i + 1) || arr[i] || {};
        setResult(sf.sf, rec, '');
        sf.sf.status = 'ok'; sf.sf.note = '';
      });
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
