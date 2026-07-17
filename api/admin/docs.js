/**
 * api/admin/docs.js — Admin API: đọc và cập nhật văn bản
 *
 * GET  /api/admin/docs           → tất cả văn bản + tags + file
 * PATCH /api/admin/docs/:id      → cập nhật issued_date, expiry_date, status, tags
 *
 * Chỉ được mount khi chạy local (xem localOnly middleware trong server.js).
 */
import { supabase } from '../../lib/supabase.js';

// Kiểm tra schema: có cột issued_date chưa?
let schemaChecked = false;
let hasNewColumns = false;

async function checkSchema() {
  if (schemaChecked) return;
  schemaChecked = true;
  try {
    const { error } = await supabase
      .from('documents')
      .select('issued_date')
      .limit(1);
    hasNewColumns = !error;
  } catch {
    hasNewColumns = false;
  }
}

// GET /api/admin/docs
export async function listDocs(req, res) {
  await checkSchema();

  try {
    const selectFields = hasNewColumns
      ? 'id, code, title, description, issued_date, expiry_date, status, created_at'
      : 'id, code, title, description, created_at';

    const [docsResult, filesResult, tagMapResult, tagsResult] = await Promise.all([
      supabase.from('documents').select(selectFields).order('created_at', { ascending: false }),
      supabase.from('document_files').select('document_id, drive_view_url, drive_download_url, mime_type'),
      supabase.from('document_tag_map').select('document_id, tag_id'),
      supabase.from('document_tags').select('id, name, label'),
    ]);

    if (docsResult.error) throw docsResult.error;

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
      hasNewColumns,
      allTags: tagsResult.data || [],
    });
  } catch (err) {
    console.error('[admin/docs] GET error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/admin/docs/:id
export async function updateDoc(req, res) {
  await checkSchema();

  const { id } = req.params;
  const { issued_date, expiry_date, status, tags, drive_view_url, drive_download_url, mime_type } = req.body;

  try {
    // Cập nhật bảng documents
    if (hasNewColumns) {
      const patch = {};
      if (issued_date  !== undefined) patch.issued_date  = issued_date  || null;
      if (expiry_date  !== undefined) patch.expiry_date  = expiry_date  || null;
      if (status       !== undefined) patch.status       = status;

      if (Object.keys(patch).length) {
        const { error } = await supabase.from('documents').update(patch).eq('id', id);
        if (error) throw error;
      }
    }

    // Cập nhật tags nếu được gửi
    if (Array.isArray(tags)) {
      // Lấy tag IDs theo tên
      const { data: tagRows, error: tagErr } = await supabase
        .from('document_tags')
        .select('id, name')
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

    // Cập nhật file nếu được gửi
    if (drive_view_url !== undefined || drive_download_url !== undefined) {
      const { data: existing } = await supabase
        .from('document_files')
        .select('id')
        .eq('document_id', id)
        .limit(1)
        .single();

      const fileData = {
        drive_view_url:     drive_view_url     || null,
        drive_download_url: drive_download_url || null,
        mime_type:          mime_type || 'application/pdf',
      };

      if (existing) {
        await supabase.from('document_files').update(fileData).eq('id', existing.id);
      } else if (drive_view_url || drive_download_url) {
        await supabase.from('document_files').insert({ ...fileData, document_id: id });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/docs] PATCH error:', err.message);
    res.status(500).json({ error: err.message });
  }
}
