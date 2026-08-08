(function () {
  const form = document.getElementById("contactForm");
  const status = document.getElementById("formStatus");
  const submitBtn = form.querySelector(".btn-submit");

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("semail").value.trim();
    const message = document.getElementById("smessage").value.trim();

    if (!email || !message) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Đang gửi...";
    status.textContent = "";
    status.className = "col-12 text-center small";

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, message }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Gửi thất bại");

      status.textContent = "Đã gửi thành công. Cảm ơn bạn!";
      status.className = "col-12 text-center small text-success";
      form.reset();
    } catch (err) {
      status.textContent = "Gửi thất bại, vui lòng thử lại sau.";
      status.className = "col-12 text-center small text-danger";
      console.error(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Send";
    }
  });
})();