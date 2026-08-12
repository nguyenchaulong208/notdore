/**
 * merge-wizard-step1-upload.js
 * Chỉ render UI + đọc/ghi state. Việc đọc file/parse header uỷ quyền cho worker qua state.callWorker.
 */
(function (global) {
  'use strict';

  const { state, util, profile } = global.MW;

  const dropzone = document.getElementById('mw-dropzone');
  const fileInput = document.getElementById('mw-file-input');
  const browseBtn = document.getElementById('mw-btn-browse');
  const fileListEl = document.getElementById('mw-file-list');
  const addTemplateBtn = document.getElementById('mw-btn-add-template-file');
  const loadProfileBtn = document.getElementById('mw-btn-load-profile');
  const profileInput = document.getElementById('mw-profile-input');
  const nextBtn = document.getElementById('mw-btn-next');

  if (!dropzone) return; // trang khác không có wizard này thì bỏ qua

  const matchBadgeHtml = (match) => {
    if (!match) return '';
    const config = {
      auto: ['bg-success', `Khớp cấu trúc đã lưu (${Math.round(match.similarity * 100)}%)`],
      confirm: ['bg-warning text-dark', `Gần khớp — xác nhận ở Bước 3 (${Math.round(match.similarity * 100)}%)`],
      new: ['bg-secondary', 'Cấu trúc mới'],
    };
    const [cls, label] = config[match.action] || config.new;
    return `<span class="badge ${cls} mt-1">${label}</span>`;
  };

  const renderFileList = () => {
    const files = state.get().files;
    fileListEl.innerHTML = files
      .map(
        (f) => `
      <div class="col-12 col-sm-6 col-lg-4" data-file-id="${f.id}">
        <div class="mw-file-card">
          <div class="d-flex justify-content-between align-items-start">
            <div class="mw-file-card__name" title="${util.escapeHtml(f.fileName)}">
              <i class="fa-solid fa-file-excel text-success me-1"></i>${util.escapeHtml(f.fileName)}
            </div>
            <button type="button" class="mw-file-card__remove" data-remove="${f.id}" aria-label="Xoá file">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="mw-file-card__meta">
            ${f.sheets.length} sheet · ${util.formatFileSize(f.size)}
            ${f.isExtraTemplate ? '<span class="badge bg-info text-dark ms-1">Template phụ</span>' : ''}
          </div>
          ${matchBadgeHtml(f.profileMatch)}
        </div>
      </div>`
      )
      .join('');

    nextBtn.disabled = !state.canProceed(1);
  };

  const addOneFile = async (rawFile, opts = {}) => {
    const arrayBuffer = await util.readFileAsArrayBuffer(rawFile);
    const meta = await state.callWorker('parseFile', { arrayBuffer, fileName: rawFile.name });
    const file = state.addFile(meta, rawFile);
    file.isExtraTemplate = !!opts.isExtraTemplate;

    if (state.get().profile) {
      await profile.matchFileAgainstProfile(file);
    }
    return file;
  };

  const handleFiles = async (fileList, opts) => {
    if (!fileList || !fileList.length) return;
    try {
      for (const rawFile of Array.from(fileList)) {
        await addOneFile(rawFile, opts);
      }
      renderFileList();
    } catch (err) {
      alert(`Lỗi khi đọc file: ${err.message}`);
    }
  };

  // ===== Sự kiện chọn/kéo-thả file =====
  browseBtn.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('click', (e) => {
    if (e.target === dropzone) fileInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
    })
  );
  dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

  // ===== "+ Thêm file khác làm template" =====
  addTemplateBtn.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.addEventListener('change', () => handleFiles(input.files, { isExtraTemplate: true }));
    input.click();
  });

  // ===== "Tải cấu trúc đã lưu" =====
  loadProfileBtn.addEventListener('click', () => profileInput.click());
  profileInput.addEventListener('change', async () => {
    const rawFile = profileInput.files[0];
    profileInput.value = '';
    if (!rawFile) return;
    try {
      await profile.loadProfileFromFile(rawFile);
      // nếu đã có file upload trước khi tải cấu trúc, áp match lại cho toàn bộ
      for (const f of state.get().files) {
        await profile.matchFileAgainstProfile(f);
      }
      renderFileList();
    } catch (err) {
      alert(err.message);
    }
  });

  // ===== Xoá file =====
  fileListEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) state.removeFile(btn.dataset.remove);
  });

  state.on('files-change', renderFileList);
  renderFileList();
})(window);
