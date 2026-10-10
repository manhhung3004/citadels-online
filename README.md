# 🏰 Citadels Online

Web chơi board game **Citadels** (luật bản 2016, 27 nhân vật) online cho 2–8 người, có bot chơi thay.

## Chạy

```bash
npm install
npm start          # http://localhost:3000  (đổi cổng: PORT=8080 npm start)
npm test           # unit test luật chơi + mô phỏng 1200 ván toàn bot
npm run icons      # tải lại icon vào public/icons.js
npm run preview    # xem trước giao diện với trạng thái mẫu: http://localhost:3200/preview.html#turn
```

Bạn bè trong cùng mạng LAN truy cập `http://<IP-máy-bạn>:3000`. Để chơi qua Internet xem **[docs/DEPLOY.md](docs/DEPLOY.md)**:
Cloudflare Quick Tunnel (chơi ngay từ máy mình) hoặc Render.com (link cố định, miễn phí, có sẵn `render.yaml`).

## Cách chơi

1. Nhập tên → **Tạo phòng** → gửi link mời (hoặc mã 4 ký tự) cho bạn bè.
2. Chủ phòng có thể **thêm bot**, chọn mục tiêu 7 hoặc 8 công trình, **bộ nhân vật** (mặc định ngẫu nhiên mỗi ván: mỗi số rút 1 trong 3 nhân vật; hoặc tự chọn) và **tốc độ bot** (Chậm/Vừa/Nhanh — đổi được cả khi đang chơi), rồi **Bắt đầu**.
3. Mỗi tab trình duyệt là một người chơi riêng — tải lại trang vẫn giữ chỗ. Người rời phòng giữa ván sẽ được bot chơi thay.

## Luật đã cài đặt (Citadels bản 2016)

- 27 nhân vật: mỗi số 1–8 có 3 lựa chọn, thêm số 9 tùy chọn.
  - 1: Sát thủ / Phù thủy / Thẩm phán
  - 2: Kẻ trộm / Gián điệp / Kẻ tống tiền
  - 3: Pháp sư / Thầy phép / Nhà tiên tri
  - 4: Vua / Hoàng đế / Nguyên lão
  - 5: Giám mục / Tu viện trưởng / Hồng y
  - 6: Thương gia / Nhà giả kim / Lái buôn
  - 7: Kiến trúc sư / Nhà hàng hải / Học giả
  - 8: Lãnh chúa / Nhà ngoại giao / Thống chế
  - 9: Hoàng hậu / Nghệ sĩ / Người thu thuế
- Chơi 8 người khi có nhân vật số 9. Hoàng hậu cần từ 5 người. Hoàng đế không dùng khi chơi 2 người.
- Chọn nhân vật đúng luật theo số người (lá úp/lá lật cho 8 hoặc 9 nhân vật; 2–3 người mỗi người 2 nhân vật; 7–8 người, người chọn cuối được lấy lá úp).
- Hoàn thành thành phố ở **7 công trình** (phòng có thể chọn 8).
- Chồng bài: 54 công trình thường + **14 công trình tím rút ngẫu nhiên** từ kho 24 loại của bản 2016
  (xem đầy đủ trong nút "Luật chơi & mẹo" → tab Công trình).
- Tính điểm: giá công trình, +3 đủ 5 màu, +4 hoàn thành đầu tiên, +2 hoàn thành sau, cộng điểm thưởng công trình tím.
- Chưa có: 6 công trình tím cần thao tác đặc biệt (Hang trộm, Giàn giáo, Kho vũ khí, Nghĩa trang, Bảo tàng, Nhà hát).
- Đơn giản hóa: Thẩm phán luôn tịch thu khi được; Hồng y tự chọn người cho mượn vàng (giàu nhất) và trả bằng các lá rẻ nhất;
  Hoàng đế bị ám sát thì vương miện tự trao cho người kế bên; người nhận vương miện của Hoàng đế tự đưa vàng (hết vàng thì 1 lá ngẫu nhiên).

## Cấu trúc

- `server/game.js` — engine luật chơi (server quyết định mọi thứ, client chỉ thấy thông tin được phép).
- `server/bot.js` — AI bot đơn giản.
- `server/index.js` — Express + Socket.IO, quản lý phòng (lưu trong bộ nhớ).
- `public/` — giao diện (HTML/CSS/JS thuần). Icon từ [game-icons.net](https://game-icons.net) (CC BY 3.0).
- `test/` — unit test (`node:test`).

## Phát triển với Claude Code (quy trình SDLC)

Dự án có sẵn agent và skill trong `.claude/`:

| Lệnh | Việc |
|---|---|
| `/sdlc <yêu cầu>` | Trọn quy trình: đặc tả → thiết kế → **(bạn duyệt)** → code → test → review → release → **(bạn duyệt commit)** |
| `/hotfix <lỗi>` | Sửa lỗi: tái hiện bằng test fail → sửa → review → changelog |
| `/release [patch\|minor\|major]` | Chốt phiên bản: test, CHANGELOG, version, commit/PR đề xuất |

Agent: `business-analyst`, `solution-architect`, `developer`, `qa-engineer`, `code-reviewer`, `release-manager`.
Skill `citadels-rules` tự nạp khi công việc liên quan luật chơi. Tài liệu sinh ra ở `docs/specs/`, `docs/design/`, `CHANGELOG.md`.
# citadels-online
