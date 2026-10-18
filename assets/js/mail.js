(function () {
  const form = document.getElementById("contactForm");
  if (!form) return;

  const status = document.getElementById("formStatus");
  const submitBtn = form.querySelector(".btn-submit");
  const originalHTML = submitBtn ? submitBtn.innerHTML : "";
  let submitting = false;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    if (submitting) return;

    const email = document.getElementById("semail").value.trim();
    const message = document.getElementById("smessage").value.trim();

    if (!email || !message) return;

    submitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Đang gửi...";
    }
    if (status) {
      status.textContent = "";
      status.className = "col-12 text-center small anime-form-status";
    }

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gửi thất bại");

      if (status) {
        status.textContent = "Đã gửi thành công. Cảm ơn bạn!";
        status.className = "col-12 text-center small text-success";
      }
      form.reset();
    } catch (err) {
      if (status) {
        status.textContent = "Gửi thất bại, vui lòng thử lại sau.";
        status.className = "col-12 text-center small text-danger";
      }
      console.error(err);
    } finally {
      submitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHTML;
      }
    }
  });
})();
