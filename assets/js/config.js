/**
 * config.js — cấu hình công khai của site.
 *
 * Điền supabaseUrl + supabaseAnonKey để đọc dữ liệu từ Supabase.
 * Anon key là khoá công khai (chỉ đọc nhờ RLS) — KHÔNG đặt service_role key ở đây.
 * Để trống cả hai => site tự đọc từ assets/data/*.json (chế độ tĩnh, không cần DB).
 */
window.NOTDORE_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Hiển thị ở phần liên hệ
  email: "nguyenchaulong.data208@gmail.com",
  siteName: "NotDore",
};
