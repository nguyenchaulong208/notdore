/* contact.js — gửi liên hệ qua /api/contact (Resend), không hiển thị email cá nhân */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var status = document.getElementById('ct-status');
  var submitBtn = form.querySelector('button[type="submit"]');

  function show(msg, ok) {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle('is-ok', ok);
    status.classList.toggle('is-err', !ok);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      subject: form.subject.value.trim(),
      message: form.message.value.trim(),
    };

    if (!data.name || !data.email || !data.message) {
      show('Vui lòng điền đầy đủ họ tên, email và nội dung.', false);
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang gửi…';
    show('Đang gửi…', true);

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (r) {
        return r.json().then(function (d) { return { ok: r.ok, d: d }; });
      })
      .then(function (res) {
        if (res.ok && res.d.success) {
          show('Cảm ơn bạn! Tin nhắn đã được gửi. Chúng tôi sẽ phản hồi trong vòng 48 giờ làm việc.', true);
          form.reset();
        } else {
          show(res.d.error || 'Gửi thất bại, vui lòng thử lại.', false);
        }
      })
      .catch(function () {
        show('Lỗi kết nối, vui lòng thử lại.', false);
      })
      .then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Gửi tin nhắn';
      });
  });
})();
