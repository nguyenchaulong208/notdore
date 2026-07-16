export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    res.status(200).send(`
console.warn('[NotDore] SUPABASE_URL ho\u1eb7c SUPABASE_ANON_KEY ch\u01b0a \u0111\u01b0\u1ee3c c\u1ea5u h\u00ecnh trong Vercel Environment Variables');
window.SUPABASE_URL = "";
window.SUPABASE_ANON_KEY = "";
`);
    return;
  }

  res.send(`
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`);
}
