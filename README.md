# 🍳 Bếp Vui Tycoon

Game quản lý nhà hàng chạy trên trình duyệt (HTML5 Canvas). Người chơi có thể chơi ngay ở chế độ khách
(lưu trên trình duyệt) hoặc đăng nhập để lưu tiến trình lên máy chủ.

## Cấu trúc

| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ game (HTML + CSS + JS) |
| `api/register.js` | `POST /api/register` – tạo tài khoản |
| `api/login.js` | `POST /api/login` – đăng nhập, trả về token |
| `api/save.js` | `GET/POST /api/save` – đọc / ghi tiến trình |
| `api/config.js` | `GET /api/config` – trả địa chỉ & anon key Supabase cho phần chơi chung |
| `api/_lib.js` | Mã hoá mật khẩu (scrypt), token ký HMAC, kết nối Upstash Redis |
| `dev-server.js` | Server chạy thử ở máy (không cần Vercel, không cần Redis) |

Không cần cài thư viện npm nào.

## Deploy lên Vercel

1. Đưa thư mục này lên một repo GitHub.
2. Vào <https://vercel.com/new>, chọn **Import** repo đó → bấm **Deploy** (không cần chỉnh cấu hình build).
3. Tạo cơ sở dữ liệu: trong project trên Vercel → tab **Storage** → **Create Database** →
   chọn **Upstash for Redis** (gói Free) → **Connect** vào project.
   Vercel sẽ tự thêm biến `KV_REST_API_URL` và `KV_REST_API_TOKEN`.
4. Thêm khoá bí mật để ký token: **Settings → Environment Variables** → thêm
   `AUTH_SECRET` = một chuỗi ngẫu nhiên dài (ví dụ tạo bằng lệnh PowerShell bên dưới).
5. Vào tab **Deployments** → **Redeploy** để biến môi trường có hiệu lực.

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RNGCryptoServiceProvider]::new().GetBytes($b); [Convert]::ToBase64String($b)
```

> Có thể dùng Vercel CLI thay cho bước 1–2: `npm i -g vercel` rồi chạy `vercel` trong thư mục này.

## Chơi chung (co-op tối đa 4 đầu bếp)

Máy của người tạo phòng (chủ phòng) chạy toàn bộ nhà hàng; máy bạn bè gửi thao tác (di chuyển, Space, E, click)
lên và nhận lại trạng thái khoảng 10 lần/giây qua **Supabase Realtime (Broadcast)**. Không cần bảng dữ liệu nào.

Cài đặt (một lần):

1. Tạo project miễn phí tại <https://supabase.com> (đặt vùng gần người chơi, ví dụ Singapore).
2. Vào **Project Settings → API**, chép **Project URL** và khoá **anon public**.
3. Trên Vercel: **Settings → Environment Variables**, thêm
   `SUPABASE_URL` = Project URL, `SUPABASE_ANON_KEY` = anon key → **Redeploy**.
4. Nếu project Supabase đã tắt truy cập công khai cho Realtime
   (**Realtime → Settings → "Allow public access"**), hãy bật lại.

Cách chơi: bấm **👥 Chơi chung → Tạo phòng**, gửi mã 5 ký tự cho bạn bè; bạn bè bấm **Vào phòng** và nhập mã.

Lưu ý:
- Chủ phòng phải để tab game mở ở phía trước (trình duyệt làm chậm tab bị ẩn).
- Tiền kiếm được thuộc về nhà hàng của chủ phòng; tiến trình riêng của người vào phòng được giữ nguyên
  và quay lại khi rời phòng.
- Chỉ chủ phòng được mua đồ trong Cửa hàng.
- Gói miễn phí của Supabase giới hạn khoảng 100 tin nhắn/giây và 2 triệu tin nhắn/tháng cho cả project.
  Một phòng 2 người dùng khoảng 20–30 tin/giây, phòng 4 người khoảng 60–100 tin/giây,
  nên gói miễn phí hợp với vài phòng nhỏ chơi cùng lúc.

## Chạy thử ở máy

Cần Node.js 18 trở lên (<https://nodejs.org>).

```powershell
node dev-server.js
```

Mở <http://localhost:3000>. Ở chế độ này tài khoản và bản lưu nằm trong RAM, tắt server là mất.
Muốn dùng Redis thật thì đặt biến `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `AUTH_SECRET` trước khi chạy.

Mở trực tiếp `index.html` (không qua server) vẫn chơi được ở chế độ khách, chỉ không đăng nhập được.

Chơi chung khi chạy ở `localhost` mà chưa cấu hình Supabase: game tự dùng kênh nội bộ của trình duyệt,
mở 2 tab cùng địa chỉ là chơi chung được (chỉ để thử, không qua mạng).
Không có Node.js thì có thể dùng Python để thử phần chơi chung (không có đăng nhập):

```powershell
python -m http.server 8000
```

## Cách lưu tiến trình

- **Khách:** lưu `localStorage` mỗi 5 giây.
- **Đã đăng nhập:** lưu trên máy + gửi lên máy chủ khoảng 15 giây/lần khi có thay đổi, ngay khi mua đồ,
  và khi đóng tab. Mở game trên máy khác sẽ tải bản lưu mới nhất.
- **Tạo tài khoản mới** sẽ mang theo tiến trình đang chơi ở chế độ khách.
- **Đăng nhập** vào tài khoản đã có sẽ dùng bản lưu của tài khoản đó.

## Bảo mật

- Mật khẩu được băm bằng scrypt + salt riêng, không lưu dạng gốc.
- Token đăng nhập ký HMAC-SHA256, hết hạn sau 30 ngày.
- Giới hạn số lần thử đăng nhập / đăng ký theo IP mỗi phút.
- Game tính toán ở trình duyệt nên người chơi rành kỹ thuật vẫn có thể sửa số tiền của chính mình;
  điều này chỉ ảnh hưởng tới tài khoản của họ.
