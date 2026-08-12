/**
 * merge-wizard-profile.js
 * Lưu/tải cấu trúc ghép (Merge Profile .json) — 100% client-side, không lưu server.
 * Nhận diện file mới theo header signature (mục 6.3 kế hoạch) qua worker.matchProfile.
 */
(function (global) {
  'use strict';

  const { state } = global.MW;

  // ===== Xuất JSON =====
  const buildProfileJson = () => {
    const data = state.get();
    if (!data.targetSchema) throw new Error('Chưa có Target Schema — chọn template ở Bước 2 trước.');

    return {
      profileVersion: '1.0',
      createdAt: new Date().toISOString(),
      toolName: 'notdore-excel-merge',
      targetSchema: data.targetSchema,
      sourceProfiles: state.getSourceFiles().map((f) => {
        const sheet = state.getSelectedSheet(f);
        return {
          signature: sheet.signature, // { headerList, headerHash } — do worker sinh lúc parseFile
          sheetName: sheet.sheetName,
          headerRowIndex: sheet.headerRowIndex,
          columnMapping: f.columnMapping || [],
        };
      }),
    };
  };

  const downloadJson = (obj, fileName) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const saveProfileToFile = () => {
    const profile = buildProfileJson();
    const stamp = new Date().toISOString().slice(0, 10);
    downloadJson(profile, `notdore-merge-profile-${stamp}.json`);
    return profile;
  };

  // ===== Nhập JSON =====
  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const validateProfileShape = (json) => {
    if (!json || typeof json !== 'object') return false;
    if (json.toolName !== 'notdore-excel-merge') return false;
    if (!json.targetSchema || !Array.isArray(json.targetSchema.columns)) return false;
    if (!Array.isArray(json.sourceProfiles)) return false;
    return true;
  };

  const loadProfileFromFile = async (rawFile) => {
    const text = await readFileAsText(rawFile);
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      throw new Error('File cấu trúc không phải JSON hợp lệ.');
    }
    if (!validateProfileShape(json)) {
      throw new Error('File cấu trúc không đúng định dạng Merge Profile của NotDore.');
    }
    state.set({ profile: json });
    global.MW.state.emit('profile-loaded', json);
    return json;
  };

  /**
   * So khớp header 1 file vừa upload với profile đang áp dụng (nếu có).
   * -> { action: 'auto'|'confirm'|'new', similarity, profileIndex, sourceProfile }
   * action === 'auto'    -> áp thẳng columnMapping + headerRowIndex, có thể nhảy tới Step 4
   * action === 'confirm' -> áp tạm mapping nhưng vẫn dừng ở Step 3 để người dùng xác nhận
   * action === 'new'     -> không áp gì, người dùng tự map từ đầu
   */
  const matchFileAgainstProfile = async (file) => {
    const data = state.get();
    if (!data.profile) return null;

    const sheet = state.getSelectedSheet(file);
    const result = await state.callWorker('matchProfile', {
      profile: data.profile,
      newHeaderList: sheet.headers,
    });

    file.profileMatch = result;

    if (result.action === 'auto' || result.action === 'confirm') {
      file.columnMapping = result.sourceProfile.columnMapping;
      // headerRowIndex của profile áp cho sheet đang chọn nếu file thật sự cùng cấu trúc
      sheet.headerRowIndex = result.sourceProfile.headerRowIndex;
    }
    return result;
  };

  global.MW = global.MW || {};
  global.MW.profile = { buildProfileJson, saveProfileToFile, loadProfileFromFile, matchFileAgainstProfile };
})(window);
