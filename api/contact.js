/**
 * Vercel Serverless Function: /api/contact
 *
 * Gửi liên hệ từ website qua Resend (KHÔNG hiển thị email cá nhân).
 * Yêu cầu biến môi trường: RESEND_API_KEY
 * Tùy chọn: CONTACT_TO_EMAIL, RESEND_FROM_EMAIL
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { name, email, subject, message } = req.body || {};

  if (!name || !email || !message) {
    res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Email không hợp lệ' });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Chưa cấu hình RESEND_API_KEY' });
    return;
  }

  const toEmail = process.env.CONTACT_TO_EMAIL || 'nguyenchaulong.data208@gmail.com';
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'NotDore <onboarding@resend.dev>';

  const subjectLine = `Liên hệ từ ${name}${subject ? ' — ' + subject : ''}`;
  const safe = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `
    <h2>Liên hệ mới từ website NotDore</h2>
    <p><strong>Họ tên:</strong> ${safe(name)}</p>
    <p><strong>Email:</strong> ${safe(email)}</p>
    <p><strong>Chủ đề:</strong> ${subject ? safe(subject) : '—'}</p>
    <hr>
    <p><strong>Nội dung:</strong></p>
    <p>${safe(message).replace(/\n/g, '<br>')}</p>
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
        reply_to: email,
        subject: subjectLine,
        html,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[api/contact] Resend error:', err);
      res.status(500).json({ error: 'Gửi email thất bại' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[api/contact] Error:', err);
    res.status(500).json({ error: 'Lỗi server' });
  }
}
