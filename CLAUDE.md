# Citadels Online

Web chơi board game Citadels online nhiều người (2–7), có bot. Node.js + Express + Socket.IO, client HTML/CSS/JS thuần (không build step).

**Bắt đầu phiên mới: đọc `docs/PROGRESS.md`** (tiến độ, việc dang dở, việc tiếp theo). Cuối phiên: cập nhật lại file đó.

## Lệnh

- `npm start` — chạy server tại http://localhost:3000 (`PORT=3001 npm start` để đổi cổng)
- `npm test` — mô phỏng 1200 ván toàn bot (2–7 người) để kiểm tra luật; PHẢI pass trước khi merge
- `BOT_DELAY=5 npm start` — bot chơi siêu nhanh, dùng khi test thủ công / e2e; `TURN_TIME=5` — giới hạn mỗi lượt 5 giây thay vì 90 (test hết giờ)
- `node scripts/fetch-icons.js` — tải lại icon vào `public/icons.js` (sửa map `ICONS` trong script khi cần thêm icon)
- `npm run preview` — server xem trước giao diện với trạng thái mẫu (http://localhost:3200/preview.html#turn); chụp ảnh từ Windows bằng `scripts/preview/shoot.ps1` (`-Device 390x844` cho điện thoại, `-Device 1366x768` cho laptop; `-Query "?lang=en"` cho tiếng Anh; `-Touch` giả lập màn cảm ứng như iOS/Android; `-Device 844x390 -Touch` cho điện thoại xoay ngang). Luôn tự chụp & xem ảnh sau khi sửa giao diện, cả màn rộng lẫn điện thoại.
- Node chạy trong WSL (Ubuntu-24.04); Windows không có Node. Từ PowerShell: `wsl -d Ubuntu-24.04 -- bash -lc "cd ~/game && npm test"`

## Kiến trúc

- `server/game.js` — engine luật chơi, class `Game`. **Nguồn sự thật duy nhất.** Mọi hành động đi qua `act(playerIndex, action)`; lỗi luật ném `GameError` (thông điệp tiếng Việt, hiện cho người chơi). `viewFor(playerId)` trả trạng thái đã ẩn thông tin bí mật.
- `server/cards.js` — dữ liệu nhân vật & công trình (key, tên, giá, màu, mô tả).
- `server/bot.js` — `botAction(game, pi)` trả 1 hành động hợp lệ hoặc null. Mọi hành động bot phải hợp lệ với engine.
- `server/index.js` — phòng chơi (in-memory `rooms`), sự kiện socket, lập lịch bot theo `room.options.botSpeed`. Đồng hồ lượt: `syncTimer()` (gọi trong `broadcast`) đặt 90 giây cho mỗi bước của người thật, hết giờ gọi `Game.timeout(pi)` (chọn nhân vật ngẫu nhiên / mất lượt, xử lý mặc định việc dở dang); client nhận `room.deadlineIn` và vẽ `renderClock()` / `tickClock()`.
- `server/simulate.js` — test bất biến: không mất bài, không âm vàng, game luôn kết thúc.
- `public/app.js` — client: nhận `state`, vẽ lại toàn bộ bằng template string, sự kiện qua `data-act`. `public/style.css` — theme tối trung cổ, token màu ở `:root`. `public/icons.js` — sinh tự động, không sửa tay.
- `public/voice.js` — thoại theo phòng (`window.Voice`): WebRTC mesh, người vào sau gửi offer; server chỉ chuyển `voice:signal` giữa người cùng phòng đang trong thoại, trạng thái ở `members[].voice` (`null|'on'|'muted'`). Viền "đang nói" cập nhật bằng `updateVoiceDom()` (không vẽ lại cả trang). TURN tùy chọn qua env `TURN_URLS/TURN_USERNAME/TURN_CREDENTIAL` → `/ice.json`. Preview: view `voice`, `voicelobby`.
- `public/sfx.js` — âm thanh (`window.Sfx.play(name)`): tổng hợp bằng Web Audio trong object `SOUNDS` (thêm tiếng mới → thêm hàm vào đó), không dùng file âm thanh. app.js phát tiếng ở `announce()` (vòng mới / lộ diện / kết thúc), `sfxFor()` (tone của dòng nhật ký mới + vàng của mình), `sfxChat()`. Nhạc nền cũng trong file này: bộ lập lịch đặt nốt trước 0.4s, vòng hợp âm `PROG`, giai điệu ngẫu nhiên theo `SCALE`; app.js gọi `Sfx.music(want, duck)` mỗi lần `render()`. Nút `data-act="music"` / `data-act="sfx"` (`sfxBtn()`), lưu ở localStorage. Preview: view `sfx`.
- Giao diện 3D ít chữ (`docs/design/2026-10-10-giao-dien-3d.md`): thông tin hiện bằng icon + số, câu dài để trong `title` (tooltip) hoặc bảng bật ra khi chạm (điện thoại không có tooltip). Panel dùng token chất liệu `--wood`, `--slab`; không thêm đoạn giải thích cố định trên màn chơi.
- `public/city3d.js` — ES module Three.js (`window.City3D`): bàn tròn, mỗi người 1 khu đất, mỗi loại công trình 1 mẫu nhà low-poly dựng bằng code trong object `BUILD` (thêm công trình mới → thêm hàm dựng). Canvas được giữ nguyên qua các lần vẽ lại: `sync3d()` trong app.js chuyển nó vào `#board-slot`. Three.js phục vụ từ `node_modules` qua `/vendor/three` + importmap trong `index.html`.

## Quy ước

- Song ngữ: tiếng Việt (mặc định) + tiếng Anh. Client: `tx(vi, en)`, `cName/cDesc` (thẻ có `nameEn/descEn`), `chName(r)`; server: `addLog(vi, en, tone)`, `note(vi, en)`, `fail(vi, en?)` (câu cố định tra bảng `FAIL_EN`), tên nhân vật trong log dùng `charName`/`charNameEn` (cả hai đều đánh dấu số đó là công khai). Mọi chữ mới phải có cả 2 ngôn ngữ.
- Toàn bộ text tiếng Việt hiển thị cho người chơi phải **có dấu**. Font tiêu đề `var(--display)` (Playfair Display); `var(--brand)` (Cinzel) KHÔNG có dấu tiếng Việt — chỉ dùng cho chữ "Citadels" và số.
- Server-authoritative: client không bao giờ tự quyết định luật; chỉ gửi ý định `{ type, ... }`.
- Không lộ thông tin bí mật trong `viewFor`: bài trên tay người khác, nhân vật chưa lộ diện, lá úp, bài vừa rút của người khác.
- Thêm loại hành động mới: thêm vào `Game.act` switch + `botAction` (nếu bot cần) + UI trong `renderAction` + case trong click handler.
- Điện thoại: không dựa vào rê chuột (`title`, `:hover`) cho thông tin quan trọng; chiều cao dùng `svh/dvh` kèm `vh` dự phòng; phần tử cố định mép màn hình cộng `env(safe-area-inset-*)`. Quạt bài trên màn cảm ứng: chạm 1 = xem, chạm 2 = làm (listener `click` capture trong app.js).
- Hiệu năng (điện thoại hay nóng máy): animation lặp vô hạn chỉ đổi `opacity` / `transform` (glow thì đặt ở `::after` rồi đổi opacity) — không animate `box-shadow`, `filter`, `outline`, không animate phần tử trong SVG lớn; không dùng `backdrop-filter`, `background-attachment: fixed`. Bàn 3D: `update()` chỉ `kick()` + tính lại bóng khi cảnh thật sự đổi; đo bằng view xem trước `perf` (`renderer.info.render.frame`).
- Comment ngắn bằng tiếng Việt, theo mật độ hiện có. Không thêm dependency khi chưa cần.
- Icon từ game-icons.net (CC BY 3.0) — giữ dòng ghi công ở footer.

## Quy trình phát triển (SDLC)

Dùng skill `/sdlc <yêu cầu>` để chạy trọn quy trình với các agent trong `.claude/agents/`. Tài liệu sinh ra nằm ở `docs/`:
`docs/specs/` (yêu cầu) → `docs/design/` (thiết kế) → code + test → review → `CHANGELOG.md`.
