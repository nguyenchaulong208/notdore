# NotDore – Kho Văn Bản Pháp Luật

Nền tảng lưu trữ và tra cứu văn bản pháp luật về kế toán, thuế và bảo hiểm xã hội. Xây dựng bởi Theodore.

## Stack

| Lớp        | Công nghệ                                        |
|------------|--------------------------------------------------|
| Frontend   | HTML5, Bootstrap 5, FontAwesome, DevBook template |
| Backend    | Vercel Serverless Functions (Node.js 18+, ESM)   |
| Database   | Supabase (PostgreSQL)                            |
| Hosting    | Vercel (static frontend + `/api/` functions)     |

## Cấu trúc dự án

```
/
├── index.html          # Trang chủ
├── category.html       # Trang danh mục văn bản (nhận ?cat=vat|tncn|tndn|bhxh)
├── api/
│   └── category.js     # Serverless function: lấy danh sách văn bản từ Supabase
├── assets/
│   ├── css/theme.css
│   ├── js/main.js      # Smooth scroll
│   ├── fontawesome/
│   └── plugins/        # Bootstrap, Popper, Smoothscroll
├── vercel.json         # Security headers
└── package.json        # type: "module", @supabase/supabase-js
```

## Biến môi trường (Vercel)

| Tên                | Mô tả                            |
|--------------------|----------------------------------|
| `SUPABASE_URL`     | URL dự án Supabase               |
| `SUPABASE_ANON_KEY`| Anon/public key của Supabase     |

Cấu hình tại: Vercel Dashboard → Project → Settings → Environment Variables.

## Supabase schema (tối thiểu)

```sql
-- Bảng văn bản
documents (id, code, title, issued_date, file_url)

-- Bảng tag
document_tags (id, name)  -- name: 'thue-gtgt' | 'thue-tncn' | 'thue-tndn' | 'bhxh'

-- Bảng mapping nhiều-nhiều
document_tag_map (document_id, tag_id)
```

## Chạy trên Vercel

Vercel tự nhận diện `/api/*.js` là Serverless Functions. Deploy bằng cách push lên GitHub và kết nối repo với Vercel.

## User preferences

- Ngôn ngữ giao tiếp: Tiếng Việt
- Giữ nguyên cấu trúc thư mục và stack hiện tại khi phát triển thêm tính năng
- Không thêm framework frontend (React/Vue) trừ khi được yêu cầu rõ ràng
