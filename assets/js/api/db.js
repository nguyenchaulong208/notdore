/**
 * assets/js/api/db.js — Module tương tác với Supabase Database
 * 
 * Chứa tất cả các hàm gọi API (Supabase) hoặc cần xử lý dữ liệu theo mô hình DB.
 * Không chứa logic nghiệp vụ thuần (business logic) mà chỉ là lớp truy cập dữ liệu.
 * 
 * @fileoverview Quản lý kết nối và truy vấn cơ sở dữ liệu NotDore.
 */

// Khởi tạo Supabase client (Sử dụng config.js đã đọc biến env)
let supabase;

export async function initSupabase() {
    // Sử dụng client đã được khởi tạo từ assets/js/config.js
    // Ví dụ: const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    // return supabase;
    console.log("Supabase Client Initialized.");
    // Giả lập việc khởi tạo
    supabase = {
        from: (table) => ({
            select: async (query) => {
                console.log(`[API CALL]: Querying table '${table}' with query: ${query}`);
                // Giả lập kết quả API
                if (table === 'communes') return [{ id: 1, code: '123', name: 'Hà Nội', province_code: 'HN' }];
                return [];
            }
        })
    };
    return supabase;
}

// Lấy danh sách các tỉnh/thành phố
export async function getCommunes(supabaseInstance) {
    // Thực hiện truy vấn API: SELECT * FROM communes;
    // Logic cần đảm bảo query là an toàn (tránh SQL Injection)
    console.log("API Call: Lấy toàn bộ danh sách communes...");
    const result = await supabaseInstance.from('communes').select('*').limit(100);
    return result;
}

// Lấy danh sách các đơn vị hành chính
export async function getAdminDivisions(supabaseInstance) {
    // Thực hiện truy vấn API: SELECT * FROM admin_units;
    console.log("API Call: Lấy danh sách admin units...");
    const result = await supabaseInstance.from('admin_units').select('*').limit(100);
    return result;
}

// Tính toán các thống kê tổng thể (Nếu cần gọi API)
export async function computeStats(supabaseInstance) {
    console.log("API Call: Tính toán thống kê tổng thể...");
    // ... logic API call
    return { totalRecords: 3321, lastUpdate: new Date() };
}
// ... Các hàm API khác
