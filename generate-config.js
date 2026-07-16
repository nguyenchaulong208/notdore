const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  Thiếu SUPABASE_URL hoặc SUPABASE_ANON_KEY trong Environment Variables');
}

const content = `// File này được tự động sinh ra khi build trên Vercel — KHÔNG sửa tay, KHÔNG commit lên Git
window.SUPABASE_URL = "${SUPABASE_URL}";
window.SUPABASE_ANON_KEY = "${SUPABASE_ANON_KEY}";
`;

fs.writeFileSync('assets/js/config.js', content);
console.log('✅ Đã sinh assets/js/config.js');
