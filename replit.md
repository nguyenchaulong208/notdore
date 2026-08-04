# NotDore

Nền tảng hỗ trợ kế toán – thuế – nhân sự: kho tài liệu pháp luật, công cụ làm việc (Excel, Python, AI Templates), và hệ thống quản lý nội dung nội bộ.

## Stack

- **Runtime**: Node.js 24 (ES Modules)
- **Backend**: Express (`server.js`) — phục vụ static files + API handlers
- **Database**: Supabase (PostgreSQL)
- **Frontend**: HTML + Bootstrap 5 + FontAwesome (không có build step)
- **Deploy**: Vercel (serverless functions trong `/api/`) hoặc Replit (dùng `server.js`)

## Chạy trên Replit

```
npm start
```

Server khởi động tại cổng 5000. Yêu cầu hai secrets:
- `SUPABASE_URL` — URL project Supabase (Settings → API)
- `SUPABASE_ANON_KEY` — anon/public key Supabase

## Cấu trúc thư mục

```
server.js           Express server (Replit)
lib/supabase.js     Supabase client singleton (lazy init)
api/
  documents.js      GET /api/documents — tất cả văn bản
  category.js       GET /api/category?cat=vat|tncn|tndn|bhxh
  tools.js          GET /api/tools — danh mục + công cụ
  admin/docs.js     GET|PATCH /api/admin/docs (local-only)
assets/
  js/
    utils.js        Tiện ích dùng chung (esc, formatDate, isHttp, ...)
    index.js        Logic trang chủ
    tools.js        Logic trang công cụ
    tool-detail.js  Logic trang chi tiết công cụ
    main.js         Smooth scroll
    admin-*.js      Logic trang admin (local-only)
  css/
    theme.css       Theme chính (DevBook)
    tools.css       Style trang công cụ
db/                 Migration SQL scripts
```

## Admin tool

Truy cập `/admin` chỉ từ localhost. Dùng để tạo SQL INSERT cho văn bản và công cụ — không ghi trực tiếp vào DB.

## User preferences

- Không dùng build tool / bundler — tất cả JS là vanilla browser script
- Giữ nguyên cấu trúc thư mục hiện tại
- Ưu tiên code ngắn gọn, không comment thừa
