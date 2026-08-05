-- Ví dụ dữ liệu. Chạy sau migration_add_tools.sql và thay các URL bằng URL thật.

INSERT INTO categories (category_name, description) VALUES
  ('Excel & VBA', 'Công thức, macro và Power Query'),
  ('Python', 'Script hỗ trợ tự động hóa'),
  ('AI Templates', 'Mẫu prompt và quy trình AI'),
  ('Tài liệu tham khảo', 'Kho tài nguyên bên ngoài')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO external_sources (source_name, source_type, base_url) VALUES
  ('YouTube', 'video', 'https://www.youtube.com'),
  ('Google Drive', 'cloud', 'https://drive.google.com'),
  ('OneDrive', 'cloud', 'https://onedrive.live.com'),
  ('GitHub', 'repo', 'https://github.com')
ON CONFLICT DO NOTHING;

-- Thêm tool trước, lấy tool_id/category_id/source_id sinh ra rồi thêm tool_links.
-- URL YouTube cần dùng định dạng https://www.youtube.com/embed/VIDEO_ID để được nhúng.
-- URL Google Drive/OneDrive/GitHub sẽ hiển thị nút mở nguồn ngoài.
