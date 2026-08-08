// api/contact.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, message } = req.body || {};

  if (!email || !message) {
    return res.status(400).json({ error: "Thiếu email hoặc nội dung" });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Email không hợp lệ" });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        // Dùng domain đã verify trên Resend, vd: "NotDore <contact@notdore.io.vn>"
        // Trước khi verify domain, có thể dùng "onboarding@resend.dev" để test
        from: "NotDore <onboarding@resend.dev>",
        to: ["nguyenchaulong208@gmail.com"],
        reply_to: email,
        subject: `[Liên hệ NotDore] Tin nhắn mới từ ${email}`,
        html: `
          <p><strong>Email người gửi:</strong> ${escapeHtml(email)}</p>
          <p><strong>Nội dung:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
        `,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(502).json({ error: "Gửi email thất bại" });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error("Contact form error:", err);
    return res.status(500).json({ error: "Lỗi máy chủ" });
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}