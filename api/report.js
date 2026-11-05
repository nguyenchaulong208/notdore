/**
 * Vercel Serverless Function: /api/report
 *
 * Gửi báo cáo sai thông tin qua Resend.
 * Yêu cầu biến môi trường: RESEND_API_KEY, REPORT_TO_EMAIL (optional, default: nguyenchaulong.data208@gmail.com)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { code, name, province, type, beforeNames, description, correctInfo } = req.body || {};

  if (!code || !name) {
    res.status(400).json({ error: 'Thiếu thông tin card' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Chưa cấu hình RESEND_API_KEY' });
    return;
  }

  const toEmail = process.env.REPORT_TO_EMAIL || 'nguyenchaulong.data208@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'NotDore <onboarding@resend.dev>';

  const subject = `Báo sai thông tin: ${name} (${code})`;
  const html = `
    <h2>Báo sai thông tin</h2>
    <p><strong>Mã:</strong> ${code}</p>
    <p><strong>Tên:</strong> ${name}</p>
    <p><strong>Tỉnh/TP:</strong> ${province || '—'}</p>
    <p><strong>Loại:</strong> ${type || '—'}</p>
    <p><strong>Trước sáp nhập:</strong> ${(beforeNames || []).join(', ') || 'Chưa có dữ liệu'}</p>
    <hr>
    <p><strong>Mô tả sai:</strong></p>
    <p>${description || '[Không cung cấp]'}</p>
    <p><strong>Thông tin đúng (nếu biết):</strong></p>
    <p>${correctInfo || '[Không cung cấp]'}</p>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[api/report] Resend error:', err);
      res.status(500).json({ error: 'Gửi email thất bại' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[api/report] Error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
}