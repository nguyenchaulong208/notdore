async function loadUploadedFiles() {
    try {
        const res = await fetch("/admin/files");
        const files = await res.json();

        const indicators = document.querySelector("#quotes-carousel .carousel-indicators");
        const inner = document.querySelector("#quotes-carousel .carousel-inner");

        if (!indicators || !inner) return;

        indicators.innerHTML = "";
        inner.innerHTML = "";

        files.forEach((file, index) => {
            // Indicator
            indicators.innerHTML += `
                <button type="button" data-bs-target="#quotes-carousel" data-bs-slide-to="${index}"
                    class="${index === 0 ? 'active' : ''}" aria-label="Slide ${index + 1}"></button>
            `;

            // Carousel item
            inner.innerHTML += `
                <div class="carousel-item ${index === 0 ? 'active' : ''}">
                    <blockquote class="quote p-4 theme-bg-light">
                        <b>${file.file_type.toUpperCase()}</b> — ${file.file_url}<br>
                        <a href="/${file.file_url}" target="_blank">Xem file</a>
                    </blockquote>
                    <div class="source row gx-md-3 gy-3 gy-md-0 align-items-center">
                        <div class="col-12 col-md-auto text-center text-md-start">
                            <img class="source-profile" src="assets/images/profiles/profile-1.png" alt="image">
                        </div>
                        <div class="col source-info text-center text-md-start">
                            <div class="source-name">Tài liệu #${file.document_id}</div>
                            <div class="soure-title">${file.file_type} file</div>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (err) {
        console.error("Không thể load danh sách file:", err);
    }
}

// Tự động chạy khi trang load
document.addEventListener("DOMContentLoaded", loadUploadedFiles);
