import { handler, body, send, redis, requireUser, MAX_SAVE_BYTES, HttpError } from './_lib.js';

// GET  /api/save            -> { data, updatedAt } | { data: null }
// POST /api/save  { data }  -> { ok, updatedAt }
export default handler(['GET', 'POST'], async (req, res) => {
  const username = requireUser(req);
  const key = `save:${username}`;

  if (req.method === 'GET') {
    const raw = await redis('GET', key);
    return send(res, 200, raw ? JSON.parse(raw) : { data: null });
  }

  const { data } = body(req);
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpError(400, 'Dữ liệu lưu không hợp lệ.');
  const record = JSON.stringify({ data, updatedAt: Date.now() });
  if (Buffer.byteLength(record) > MAX_SAVE_BYTES) throw new HttpError(413, 'Dữ liệu lưu quá lớn.');
  await redis('SET', key, record);
  send(res, 200, { ok: true, updatedAt: JSON.parse(record).updatedAt });
});
