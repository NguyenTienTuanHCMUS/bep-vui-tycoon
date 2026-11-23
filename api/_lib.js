// Thư viện dùng chung cho các API (file bắt đầu bằng "_" nên Vercel không coi là route).
import crypto from 'node:crypto';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const IS_VERCEL = !!process.env.VERCEL;
const SECRET = process.env.AUTH_SECRET || (IS_VERCEL ? null : 'dev-only-secret');
const TOKEN_DAYS = 30;
export const MAX_SAVE_BYTES = 20000;

/* ---------- Redis qua REST API của Upstash (không cần thư viện) ---------- */
const mem = new Map(); // chỉ dùng khi chạy local không có Redis
function memRedis([cmd, key, ...args]) {
  switch (cmd.toUpperCase()) {
    case 'GET': return mem.has(key) ? mem.get(key) : null;
    case 'SET':
      if (args.includes('NX') && mem.has(key)) return null;
      mem.set(key, String(args[0])); return 'OK';
    case 'INCR': { const v = (Number(mem.get(key)) || 0) + 1; mem.set(key, String(v)); return v; }
    case 'EXPIRE': return 1;
    default: throw new Error('Lệnh không hỗ trợ: ' + cmd);
  }
}
export async function redis(...cmd) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    if (IS_VERCEL) throw new HttpError(500, 'Máy chủ chưa cấu hình cơ sở dữ liệu (Upstash Redis).');
    return memRedis(cmd);
  }
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}

/* ---------- HTTP helpers ---------- */
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
export function body(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') { try { return JSON.parse(b); } catch { throw new HttpError(400, 'Dữ liệu gửi lên không hợp lệ.'); } }
  return b;
}
export function handler(methods, fn) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) throw new HttpError(405, 'Method not allowed');
      if (!SECRET) throw new HttpError(500, 'Máy chủ chưa cấu hình AUTH_SECRET.');
      await fn(req, res);
    } catch (e) {
      const status = e.status || 500;
      if (status === 500) console.error(e);
      send(res, status, { error: status === 500 && !e.status ? 'Lỗi máy chủ, thử lại sau.' : e.message });
    }
  };
}

/* ---------- Giới hạn số lần thử (chống dò mật khẩu) ---------- */
export async function rateLimit(req, name, max) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip').split(',')[0].trim();
  const key = `rl:${name}:${ip}:${Math.floor(Date.now() / 60000)}`;
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, 120);
  if (n > max) throw new HttpError(429, 'Bạn thử quá nhiều lần, đợi 1 phút rồi thử lại.');
}

/* ---------- Tài khoản ---------- */
export function cleanUsername(u) {
  const name = String(u || '').trim().toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(name)) throw new HttpError(400, 'Tên đăng nhập 3–20 ký tự, chỉ gồm chữ thường không dấu, số và dấu _.');
  return name;
}
export function checkPassword(p) {
  if (typeof p !== 'string' || p.length < 6 || p.length > 100) throw new HttpError(400, 'Mật khẩu cần từ 6 đến 100 ký tự.');
  return p;
}
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
export function verifyPassword(password, salt, hash) {
  const a = Buffer.from(hashPassword(password, salt).hash, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Token (HMAC-SHA256, hết hạn sau 30 ngày) ---------- */
const b64 = s => Buffer.from(s).toString('base64url');
const sign = data => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
export function makeToken(username) {
  const payload = b64(JSON.stringify({ u: username, exp: Date.now() + TOKEN_DAYS * 864e5 }));
  return payload + '.' + sign(payload);
}
export function requireUser(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer (.+)$/);
  if (!m) throw new HttpError(401, 'Chưa đăng nhập.');
  const [payload, sig] = m[1].split('.');
  if (!payload || !sig) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.');
  const expected = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.');
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new HttpError(401, 'Phiên đăng nhập không hợp lệ.'); }
  if (!data.u || !(data.exp > Date.now())) throw new HttpError(401, 'Phiên đăng nhập đã hết hạn, hãy đăng nhập lại.');
  return data.u;
}
