import { handler, body, send, redis, rateLimit, cleanUsername, checkPassword, hashPassword, makeToken, HttpError } from './_lib.js';

// POST /api/register  { username, password }  ->  { token, username }
export default handler(['POST'], async (req, res) => {
  await rateLimit(req, 'register', 10);
  const b = body(req);
  const username = cleanUsername(b.username);
  const password = checkPassword(b.password);
  const user = { ...hashPassword(password), createdAt: Date.now() };
  const ok = await redis('SET', `user:${username}`, JSON.stringify(user), 'NX');
  if (ok !== 'OK') throw new HttpError(409, 'Tên đăng nhập này đã có người dùng.');
  send(res, 200, { token: makeToken(username), username });
});
