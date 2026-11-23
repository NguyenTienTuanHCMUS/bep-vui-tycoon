import { handler, body, send, redis, rateLimit, cleanUsername, verifyPassword, makeToken, HttpError } from './_lib.js';

// POST /api/login  { username, password }  ->  { token, username }
export default handler(['POST'], async (req, res) => {
  await rateLimit(req, 'login', 20);
  const b = body(req);
  const username = cleanUsername(b.username);
  const raw = await redis('GET', `user:${username}`);
  const user = raw ? JSON.parse(raw) : null;
  if (!user || typeof b.password !== 'string' || !verifyPassword(b.password, user.salt, user.hash)) {
    throw new HttpError(401, 'Sai tên đăng nhập hoặc mật khẩu.');
  }
  send(res, 200, { token: makeToken(username), username });
});
