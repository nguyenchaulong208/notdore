-- Ví dụ dữ liệu bài viết. Chạy sau migration_add_articles.sql.
-- Thay URL, slug và nội dung bằng dữ liệu thật.

INSERT INTO article_categories (category_name, description) VALUES
  ('Thuế - Kế toán', 'Bài viết phân tích về thuế và kế toán'),
  ('Nhân sự - BHXH', 'Chính sách lao động, bảo hiểm xã hội'),
  ('Hải quan - Xuất nhập khẩu', 'Quy định hải quan và thương mại quốc tế')
ON CONFLICT (category_name) DO NOTHING;

-- content: nội dung markdown/HTML nhập tay (có thể để trống nếu dùng content_url).
-- content_url: URL markdown raw (ví dụ raw.githubusercontent.com) — dùng khi content trống.
-- original_url: bắt buộc — link truy cập bài viết gốc (nguồn sưu tầm).
INSERT INTO articles
  (title, slug, category_id, summary, thumbnail_url, content, content_url, original_url, original_source, published_at)
VALUES
  (
    'Nghị định 163/2017/NĐ-CP và điều kiện kinh doanh logistics',
    'nghi-dinh-163-2017-logistics',
    (SELECT category_id FROM article_categories WHERE category_name = 'Hải quan - Xuất nhập khẩu'),
    'Tổng hợp các điểm cần lưu ý về điều kiện kinh doanh dịch vụ logistics.',
    NULL,
    '## Nội dung\n\nĐây là **bài viết mẫu**. Thay bằng nội dung markdown thật.',
    NULL,
    'https://vbpl.vn/TW/Pages/vbpq-toanvan.aspx?ItemID=137944',
    'vbpl.vn',
    '2024-12-19'
  )
ON CONFLICT (slug) DO NOTHING;
