/**
 * api/admin/docs.js — Admin API: đọc và cập nhật văn bản
 *
 * GET   /api/admin/docs           → tất cả văn bản + tags + file
 * PATCH /api/admin/docs/:id       → cập nhật issued_date, expiry_date, status, tags, file
 *
 * Chỉ được mount khi chạy local (xem localOnly middleware trong server.js).
 */
import { supabase } from '../../lib/supabase.js';

const VALID_STATUS = ['hieu_luc', 'het_hieu_luc', 'chua_hieu_luc'];
const VALID_DRIVE_TYPE = ['google', 'onedrive'];

// GET /api/admin/docs
export async function listDocs(req, res) {
  try {
    const selectFields =
      'id|code|title|description|issued_date|expiry_date|status|created_at|updated_at';

    const [docsResult, filesResult, tagMapResult, tagsResult] = await Promise.all([
      supabase.from('documents').select(selectFields).order('created_at', { ascending: false }),
      supabase
        .from('document_files')
        .select('id|document_id|drive_type|drive_file_id|drive_view_url|drive_download_url|mime_type|size|uploaded_at'),
      supabase.from('document_tag_map').select('document_id| tag_id'),
      supabase.from('document_tags').select('id| name| label'),
    ]);

    if (docsResult.error) throw docsResult.error;
    if (filesResult.error) throw filesResult.error;
    if (tagMapResult.error) throw tagMapResult.error;
    if (tagsResult.error) throw tagsResult.error;

    // Index: file theo document_id
    const fileByDoc = {};
    for (const f of filesResult.data || []) fileByDoc[f.document_id] = f;

    // Index: tags theo id
    const tagById = {};
    for (const t of tagsResult.data || []) tagById[t.id] = t;

    // Group tag_id per document_id
    const tagsByDoc = {};
    for (const m of tagMapResult.data || []) {
      if (!tagsByDoc[m.document_id]) tagsByDoc[m.document_id] = [];
      const tag = tagById[m.tag_id];
      if (tag) tagsByDoc[m.document_id].push(tag);
    }

    const docs = (docsResult.data || []).map(d => ({
      ...d,
      file: fileByDoc[d.id] ?? null,
      tags: tagsByDoc[d.id] ?? [],
    }));

    res.json({
      docs,
      total: docs.length,
      allTags: tagsResult.data || [],
    });
  } catch (err) {
    console.error('[admin/docs] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/docs/:id
export async function updateDoc(req, res) {
  const { id } = req.params;
  const {
    issued_date,
    expiry_date,
    status,
    tags,
    drive_type,
    drive_file_id,
    drive_view_url,
    drive_download_url,
    mime_type,
    size,
  } = req.body;

  try {
    // Validate status theo CHECK constraint của DB
    if (status !== undefined && status !== null && !VALID_STATUS.includes(status)) {
      return res.status(400).json({
        error: `status không hợp lệ. Chỉ chấp nhận: ${VALID_STATUS.join('| ')}`,
      });
    }

    // Validate drive_type theo CHECK constraint của DB
    if (drive_type !== undefined && drive_type !== null && !VALID_DRIVE_TYPE.includes(drive_type)) {
      return res.status(400).json({
        error: `drive_type không hợp lệ. Chỉ chấp nhận: ${VALID_DRIVE_TYPE.join('| ')}`,
      });
    }

    // Cập nhật bảng documents
    const patch = {};
    if (issued_date !== undefined) patch.issued_date = issued_date || null;
    if (expiry_date !== undefined) patch.expiry_date = expiry_date || null;
    if (status !== undefined) patch.status = status;

    if (Object.keys(patch).length) {
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from('documents').update(patch).eq('id', id);
      if (error) throw error;
    }

    // Cập nhật tags nếu được gửi
    if (Array.isArray(tags)) {
      // Lấy tag IDs theo tên
      const { data: tagRows, error: tagErr } = await supabase
        .from('document_tags')
        .select('id| name')
        .in('name', tags.length ? tags : ['__none__']);
      if (tagErr) throw tagErr;

      // Xoá mapping cũ
      const { error: delErr } = await supabase
        .from('document_tag_map')
        .delete()
        .eq('document_id', id);
      if (delErr) throw delErr;

      // Chèn mapping mới
      if (tagRows?.length) {
        const inserts = tagRows.map(t => ({ document_id: id, tag_id: t.id }));
        const { error: insErr } = await supabase.from('document_tag_map').insert(inserts);
        if (insErr) throw insErr;
      }
    }

    // Cập nhật file nếu được gửi (drive_file_id là NOT NULL trong schema,
    // nên chỉ insert mới khi có drive_file_id; nếu chỉ update file đã tồn tại
    // thì không bắt buộc phải gửi lại drive_file_id)
    const hasFilePayload =
      drive_type !== undefined ||
      drive_file_id !== undefined ||
      drive_view_url !== undefined ||
      drive_download_url !== undefined ||
      mime_type !== undefined ||
      size !== undefined;

    if (hasFilePayload) {
      const { data: existing, error: findErr } = await supabase
        .from('document_files')
        .select('id')
        .eq('document_id', id)
        .limit(1)
        .maybeSingle();
      if (findErr) throw findErr;

      if (existing) {
        // Update: chỉ set field nào được gửi lên
        const fileData = {};
        if (drive_type !== undefined) fileData.drive_type = drive_type || null;
        if (drive_file_id !== undefined) fileData.drive_file_id = drive_file_id;
        if (drive_view_url !== undefined) fileData.drive_view_url = drive_view_url || null;
        if (drive_download_url !== undefined) fileData.drive_download_url = drive_download_url || null;
        if (mime_type !== undefined) fileData.mime_type = mime_type || 'application/pdf';
        if (size !== undefined) fileData.size = size || null;

        if (Object.keys(fileData).length) {
          const { error: updErr } = await supabase
            .from('document_files')
            .update(fileData)
            .eq('id', existing.id);
          if (updErr) throw updErr;
        }
      } else if (drive_file_id) {
        // Insert mới: bắt buộc phải có drive_file_id vì cột NOT NULL
        const { error: insErr } = await supabase.from('document_files').insert({
          document_id: id,
          drive_type: drive_type || null,
          drive_file_id,
          drive_view_url: drive_view_url || null,
          drive_download_url: drive_download_url || null,
          mime_type: mime_type || 'application/pdf',
          size: size || null,
        });
        if (insErr) throw insErr;
      } else {
        // Chưa có file cũ và cũng không gửi drive_file_id → không thể insert
        return res.status(400).json({
          error: 'drive_file_id là bắt buộc khi tạo mới document_files',
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/docs] PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
}