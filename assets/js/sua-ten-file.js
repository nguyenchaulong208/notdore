// ============================================================
  // State
  // ============================================================
  let files = []; // { id, file, originalName, newName, size }

  const $ = (id) => document.getElementById(id);
  const dropZone = $('drop-zone');
  const fileInput = $('file-input');
  const fileListWrap = $('file-list-wrap');
  const fileTbody = $('file-tbody');
  const fileCount = $('file-count');
  const bulkControls = $('bulk-controls');

  // ============================================================
  // File handling
  // ============================================================
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function addFiles(newFiles) {
    Array.from(newFiles).forEach(f => {
      files.push({
        id: Date.now() + Math.random(),
        file: f,
        originalName: f.name,
        newName: f.name,
        size: f.size
      });
    });
    renderFileList();
    if (files.length > 0) {
      bulkControls.style.display = 'block';
      fileListWrap.style.display = 'block';
    }
  }

  function renderFileList() {
    fileCount.textContent = files.length;
    fileTbody.innerHTML = files.map((f, i) => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:.5rem .8rem; color:var(--text-muted);">${i + 1}</td>
        <td style="padding:.5rem .8rem; color:var(--text-secondary); font-size:.82rem; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${f.originalName}">${f.originalName}</td>
        <td style="padding:.5rem .8rem;">
          <input type="text" value="${f.newName}" data-id="${f.id}" class="rename-input"
                 style="width:100%; padding:.35rem .5rem; border:1px solid var(--border); border-radius:6px; font-size:.85rem; background:var(--bg-input); color:var(--text-primary);">
        </td>
        <td style="padding:.5rem .8rem; color:var(--text-muted); font-size:.8rem;">${formatSize(f.size)}</td>
        <td style="padding:.5rem .8rem; text-align:center;">
          <button class="remove-file" data-id="${f.id}" style="background:none; border:none; cursor:pointer; color:var(--accent-red); font-size:.9rem;">
            <i class="fas fa-times"></i>
          </button>
        </td>
      </tr>
    `).join('');

    // Attach input listeners
    fileTbody.querySelectorAll('.rename-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const id = parseFloat(e.target.dataset.id);
        const f = files.find(x => x.id === id);
        if (f) f.newName = e.target.value;
      });
    });
    fileTbody.querySelectorAll('.remove-file').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseFloat(e.currentTarget.dataset.id);
        files = files.filter(x => x.id !== id);
        renderFileList();
        if (files.length === 0) {
          bulkControls.style.display = 'none';
          fileListWrap.style.display = 'none';
        }
      });
    });
  }

  // ============================================================
  // Bulk rename operations
  // ============================================================
  function applyBulkRename() {
    const prefix = $('bulk-prefix').value;
    const suffix = $('bulk-suffix').value;
    const start = parseInt($('bulk-start').value) || 1;
    files.forEach((f, i) => {
      const ext = f.originalName.includes('.') ? '.' + f.originalName.split('.').pop() : '';
      const baseName = f.originalName.replace(/\.[^.]+$/, '');
      f.newName = `${prefix}${baseName}${suffix}_${start + i}${ext}`;
    });
    renderFileList();
  }

  function applyLowercase() {
    files.forEach(f => { f.newName = f.newName.toLowerCase(); });
    renderFileList();
  }

  function applyUppercase() {
    files.forEach(f => { f.newName = f.newName.toUpperCase(); });
    renderFileList();
  }

  function applyRemoveSpaces() {
    files.forEach(f => { f.newName = f.newName.replace(/\s+/g, ''); });
    renderFileList();
  }

  function applyReplace() {
    const find = $('replace-find').value;
    const replace = $('replace-with').value;
    if (!find) return;
    files.forEach(f => { f.newName = f.newName.split(find).join(replace); });
    renderFileList();
  }

  function resetNames() {
    files.forEach(f => { f.newName = f.originalName; });
    renderFileList();
  }

  // ============================================================
  // Download as ZIP
  // ============================================================
  async function downloadAll() {
    if (!files.length) return;
    const btn = $('download-all');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Đang tạo ZIP...';

    try {
      const zip = new JSZip();
      for (const f of files) {
        const name = f.newName.trim() || f.originalName;
        zip.file(name, f.file);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'renamed_files.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Lỗi tạo ZIP: ' + e.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-download me-1"></i> Tải về (ZIP)';
    }
  }

  // ============================================================
  // Event listeners
  // ============================================================
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent-purple)'; dropZone.style.background = 'var(--bg-card-hover)'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = 'var(--border)'; dropZone.style.background = 'var(--bg-card)'; });
  dropZone.addEventListener('drop', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--border)'; dropZone.style.background = 'var(--bg-card)'; addFiles(e.dataTransfer.files); });
  fileInput.addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });

  $('bulk-apply').addEventListener('click', applyBulkRename);
  $('bulk-lowercase').addEventListener('click', applyLowercase);
  $('bulk-uppercase').addEventListener('click', applyUppercase);
  $('bulk-remove-spaces').addEventListener('click', applyRemoveSpaces);
  $('bulk-reset').addEventListener('click', resetNames);
  $('download-all').addEventListener('click', downloadAll);

  // Replace panel toggle
  $('bulk-replace').addEventListener('click', () => {
    const panel = $('replace-panel');
    panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
  });
  $('replace-apply').addEventListener('click', applyReplace);