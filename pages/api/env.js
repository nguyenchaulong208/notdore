export default function handler(req, res) {
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_ANON_KEY || '';

  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).json({ url, key });
}
