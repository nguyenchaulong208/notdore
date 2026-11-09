// Check browser support
  if (!('showDirectoryPicker' in window)) {
    document.getElementById('support-notice').style.display = 'block';
  }

  // State
  let sourceDirHandle = null;
  let destDirHandle = null;
  let allFiles = []; // { name, path, size, handle, selected }
  let selectedFiles = new Set();

  const $ = (id) => document.getElementById(id);

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Recursively collect files
  async function collectFiles(dirHandle, basePath = '') {
    const files = [];
    for await (const [name, handle] of dirHandle.entries()) {
      const path = basePath ? `${basePath}/${name}` : name;
      if (handle.kind === 'file') {
        const file = await handle.getFile();
        files.push({ name, path, size: file.size, handle, selected: false });
      } else if (handle.kind === 'directory') {
        const subFiles = await collectFiles(handle, path);
        files.push(...subFiles);
      }
    }
    return files;
  }

  // Step 1: Pick source
  $('pick-source').addEventListener('click', async () => {
    try {
      sourceDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      allFiles = await collectFiles(sourceDirHandle);
      selectedFiles.clear();

      $('source-path').textContent = sourceDirHandle.name;
      $('source-count').textContent = allFiles.length;
      $('source-info').style.display = 'block';

      renderFileList();
      $('step2').style.display = 'block';
      $('step3').style.display = 'block';
    } catch (e) {
      if (e.name !== 'AbortError') alert('Lỗi: ' + e.message);
    }
  });

  // Render file list
  function renderFileList() {
    const tbody = $('file-tbody');
    tbody.innerHTML = allFiles.map((f, i) => {
      const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '';
      return `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:.5rem .8rem; text-align:center;">
            <input type="checkbox" class="file-check" data-index="${i}" ${f.selected ? 'checked' : ''}>
          </td>
          <td style="padding:.5rem .8rem; color:var(--text-primary); font-size:.82rem;">${f.name}</td>
          <td style="padding:.5rem .8rem; color:var(--text-muted); font-size:.8rem;">${dir || '—'}</td>
          <td style="padding:.5rem .8rem; color:var(--text-muted); font-size:.8rem;">${formatSize(f.size)}</td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.file-check').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        allFiles[idx].selected = e.target.checked;
        updateSelectedCount();
      });
    });
    updateSelectedCount();
  }

  function updateSelectedCount() {
    const count = allFiles.filter(f => f.selected).length;
    $('selected-count').textContent = `${count} đã chọn`;
    $('move-count').textContent = count;
    if (count > 0 && destDirHandle) {
      $('step4').style.display = 'block';
    } else {
      $('step4').style.display = 'none';
    }
  }

  // Select/deselect all
  $('select-all').addEventListener('click', () => {
    allFiles.forEach(f => f.selected = true);
    renderFileList();
  });
  $('deselect-all').addEventListener('click', () => {
    allFiles.forEach(f => f.selected = false);
    renderFileList();
  });
  $('check-all').addEventListener('change', (e) => {
    allFiles.forEach(f => f.selected = e.target.checked);
    renderFileList();
  });

  // Step 3: Pick destination
  $('pick-dest').addEventListener('click', async () => {
    try {
      destDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      $('dest-path').textContent = destDirHandle.name;
      $('dest-info').style.display = 'block';
      updateSelectedCount();
    } catch (e) {
      if (e.name !== 'AbortError') alert('Lỗi: ' + e.message);
    }
  });

  // Step 4: Execute move
  $('execute-move').addEventListener('click', async () => {
    const toMove = allFiles.filter(f => f.selected);
    if (!toMove.length || !destDirHandle) return;

    $('progress-wrap').style.display = 'block';
    $('step4').style.display = 'none';
    const log = $('move-log');
    log.innerHTML = '';
    let done = 0;
    const total = toMove.length;

    for (const f of toMove) {
      try {
        // Read file content
        const file = await f.handle.getFile();
        const content = await file.arrayBuffer();

        // Create in destination
        const newHandle = await destDirHandle.getFileHandle(f.name, { create: true });
        const writable = await newHandle.createWritable();
        await writable.write(content);
        await writable.close();

        // Remove from source
        try {
          await sourceDirHandle.removeEntry(f.name, { recursive: false });
        } catch (e) {
          // If file is in subfolder, need to navigate
          const parts = f.path.split('/');
          if (parts.length > 1) {
            // Try removing from parent
            let parentDir = sourceDirHandle;
            for (let i = 0; i < parts.length - 1; i++) {
              parentDir = await parentDir.getDirectoryHandle(parts[i]);
            }
            await parentDir.removeEntry(parts[parts.length - 1]);
          }
        }

        done++;
        log.innerHTML += `<div style="color:var(--accent-green);"><i class="fas fa-check me-1"></i>${f.name}</div>`;
      } catch (e) {
        log.innerHTML += `<div style="color:var(--accent-red);"><i class="fas fa-times me-1"></i>${f.name} — ${e.message}</div>`;
      }
      $('progress-text').textContent = `${done}/${total}`;
      $('progress-bar').style.width = `${(done / total) * 100}%`;
    }

    $('progress-wrap').style.display = 'none';
    $('result-wrap').style.display = 'block';
    $('result-text').textContent = `Đã di chuyển ${done}/${total} file thành công.`;
  });

  // Reset
  $('reset-btn').addEventListener('click', () => {
    sourceDirHandle = null;
    destDirHandle = null;
    allFiles = [];
    selectedFiles.clear();
    $('source-info').style.display = 'none';
    $('dest-info').style.display = 'none';
    $('step2').style.display = 'none';
    $('step3').style.display = 'none';
    $('step4').style.display = 'none';
    $('result-wrap').style.display = 'none';
    $('file-tbody').innerHTML = '';
  });