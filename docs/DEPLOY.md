# Đưa game lên Internet

Không cần domain, server hay IP public. Có 2 cách:

| | Cách 1 — Cloudflare Quick Tunnel | Cách 2 — Render.com |
|---|---|---|
| Thời gian làm | ~2 phút | ~15 phút (lần đầu) |
| Game chạy ở đâu | Máy của bạn (phải bật trong lúc chơi) | Máy chủ của Render |
| Link | Đổi mỗi lần chạy (`https://xxxx.trycloudflare.com`) | Cố định (`https://<tên>.onrender.com`) |
| Chi phí | Miễn phí, không cần tài khoản | Miễn phí, cần tài khoản GitHub + Render |
| Hạn chế | Tắt máy / tắt terminal là mất link | Ngủ sau 15 phút không ai vào; lần vào đầu chờ 30–50 giây; ván đang chơi mất khi server ngủ/khởi động lại |

Cả hai cách đều chạy được Socket.IO (WebSocket) và bàn 3D.

---

## Cách 1 — Cloudflare Quick Tunnel (chơi ngay từ máy mình)

Cloudflare tạo một đường hầm từ Internet vào `localhost:3000` trên máy bạn và cấp một link HTTPS tạm thời.

### Cài đặt (chỉ làm 1 lần, trong WSL)

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o ~/cloudflared
chmod +x ~/cloudflared
~/cloudflared --version   # kiểm tra đã chạy được
```

> Trên Windows (không dùng WSL) có thể cài bằng `winget install Cloudflare.cloudflared` rồi chạy lệnh `cloudflared` y hệt bên dưới.

### Mỗi lần muốn chơi

Mở **2 terminal WSL**:

```bash
# Terminal 1 — chạy game
cd ~/game && npm start
# → "Citadels server chạy tại http://localhost:3000"
```

```bash
# Terminal 2 — mở đường hầm
~/cloudflared tunnel --url http://localhost:3000
```

Terminal 2 sẽ in ra một khung có dòng dạng:

```
Your quick Tunnel has been created! Visit it at:
https://random-words-1234.trycloudflare.com
```

Gửi link đó cho bạn bè. Tạo phòng như bình thường rồi bấm **Sao chép link mời** — link mời sẽ tự dùng địa chỉ `trycloudflare.com`.

### Dừng

Bấm `Ctrl+C` ở cả 2 terminal. Link cũ hết hiệu lực; lần sau chạy lại sẽ có link mới.

### Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `Cổng 3000 đang bị chiếm` khi `npm start` | `fuser -k 3000/tcp` rồi chạy lại (hoặc `PORT=3001 npm start` và tunnel tới `http://localhost:3001`) |
| Link báo lỗi 502 / 1033 | Terminal 1 chưa chạy hoặc đã tắt — chạy lại `npm start` |
| Bạn bè vào được nhưng bị "Mất kết nối" liên tục | Mạng chặn WebSocket; thử mạng khác (4G) — Socket.IO sẽ tự chuyển sang long-polling nếu cần |
| Máy ngủ / tắt WSL | Link chết; tắt chế độ ngủ của máy trong lúc chơi |

---

## Cách 2 — Render.com (link cố định)

Repo đã có sẵn những gì Render cần:

- `package.json`: `npm start` chạy `node server/index.js`, `engines.node >= 18`.
- Server đọc cổng từ biến môi trường `PORT` (Render tự đặt).
- `render.yaml`: cấu hình dịch vụ web gói miễn phí (Render đọc file này khi tạo bằng *Blueprint*).

### Bước 1 — Đưa code lên GitHub

1. Tạo tài khoản tại <https://github.com> (nếu chưa có).
2. Bấm **New repository** → đặt tên, ví dụ `citadels-online` → chọn **Private** hoặc **Public** → **không** tick "Add a README" → **Create repository**.
3. Trong WSL, tại thư mục game:

```bash
# Chỉ làm 1 lần trên máy: khai báo tên & email cho commit (dùng email GitHub của bạn)
git config --global user.name "Tên của bạn"
git config --global user.email "email-github@example.com"

cd ~/game
git add -A
git commit -m "Citadels Online: phiên bản đầu tiên"
git branch -M main
git remote add origin https://github.com/<tên-github-của-bạn>/citadels-online.git
git push -u origin main
```

Khi `git push` hỏi mật khẩu: GitHub không nhận mật khẩu tài khoản nữa — tạo **Personal access token** tại
GitHub → Settings → Developer settings → Personal access tokens → *Tokens (classic)* → Generate (tick quyền `repo`),
rồi dán token vào chỗ hỏi mật khẩu. (Hoặc cài GitHub CLI: `gh auth login`.)

### Bước 2 — Tạo dịch vụ trên Render

1. Vào <https://render.com> → **Get Started** → đăng nhập bằng GitHub.
2. Chọn **New +** → **Blueprint** → chọn repo `citadels-online` → Render đọc `render.yaml` → **Apply**.
   - (Hoặc **New +** → **Web Service** → chọn repo, điền: Runtime **Node**, Build `npm install`, Start `npm start`, Instance **Free**.)
3. Chờ build ~2–3 phút. Khi trạng thái là **Live**, link nằm ở đầu trang: `https://citadels-online-xxxx.onrender.com`.

### Bước 3 — Cập nhật phiên bản mới

Mỗi khi sửa code xong:

```bash
git add -A && git commit -m "mô tả thay đổi" && git push
```

Render tự build và deploy lại (mất ~2 phút; các ván đang chơi sẽ bị mất khi server khởi động lại).

### Lưu ý gói miễn phí

- Server **ngủ sau 15 phút** không có ai truy cập. Người đầu tiên vào lại phải chờ 30–50 giây.
- Phòng chơi lưu trong bộ nhớ: server ngủ / deploy lại = mất các phòng đang chơi. Nên deploy khi không có ai đang chơi.
- Chỉ chạy **1 instance** (phòng lưu trong RAM của 1 tiến trình) — không bật scale nhiều instance.
- Mỗi tháng gói miễn phí có giới hạn giờ chạy; chơi giữa bạn bè thường không chạm tới.
