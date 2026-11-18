/**
 * assets/js/api/dia-gioi-api.js — Module API: Xử lý logic Địa giới hành chính
 * 
 * Các hàm này đều phải gọi API (Supabase) hoặc tương tác với dữ liệu lớn.
 */

import { getCommunes } from './db.js';

/**
 * Tải toàn bộ danh sách địa giới hành chính từ API.
 * @param {object} supabaseInstance - Supabase client instance.
 * @returns {Promise<Array>} Danh sách các đơn vị hành chính.
 */
export async function loadCommunes(supabaseInstance) {
    return getCommunes(supabaseInstance);
}

/**
 * Tìm kiếm địa giới hành chính theo tiêu chí qua API.
 * @param {object} supabaseInstance - Supabase client instance.
 * @param {string} query - Từ khóa tìm kiếm.
 * @returns {Promise<Array>} Kết quả tìm kiếm.
 */
export async function searchCommunes(supabaseInstance, query) {
    // Ví dụ: API Call: SELECT * FROM communes WHERE name ILIKE '%' || ? || '%'
    console.log(`[API CALL]: Search communes for "${query}"`);
    // return await supabaseInstance.from('communes').select('*').filter('name', 'ilike', `%${query}%`);
    return []; // Giả lập
}
