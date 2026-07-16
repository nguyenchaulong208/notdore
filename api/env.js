export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  const url = process.env.SUPABASE_URL || "https://thmvaufuaxfoflyndrcq.supabase.co";
  const key = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRobXZhdWZ1YXhmb2ZseW5kcmNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjY2NzMsImV4cCI6MjA5OTY0MjY3M30.aHbFvIVjSzTItZWfbwkAGgIkTqoX9sOc-gl4gCFu2hg";

  res.status(200).json({
    url,
    key
  });
}
