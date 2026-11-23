import { send } from './_lib.js';

// GET /api/config -> thông tin công khai để trình duyệt kết nối Supabase Realtime (chơi chung).
// "anon key" của Supabase vốn được thiết kế để công khai trên trình duyệt.
export default function config(req, res) {
  send(res, 200, {
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
  });
}
