// Server chạy thử ở máy cá nhân: node dev-server.js  ->  http://localhost:3000
// Không cần Redis: khi không có biến môi trường, dữ liệu lưu tạm trong RAM (mất khi tắt server).
import http from 'node:http';
import { readFile } from 'node:fs/promises';

const PORT = Number(process.env.PORT) || 3000;
const ROUTES = ['login', 'register', 'save', 'config'];

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const m = url.pathname.match(/^\/api\/([a-z]+)$/);
  if (m && ROUTES.includes(m[1])) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    req.body = raw;
    const mod = await import(`./api/${m[1]}.js`);
    return mod.default(req, res);
  }
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(await readFile(new URL('./index.html', import.meta.url)));
  }
  res.statusCode = 404; res.end('Not found');
}).listen(PORT, () => console.log(`Bếp Vui Tycoon: http://localhost:${PORT}`));
