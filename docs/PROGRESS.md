# Tiến độ dự án — Citadels Online

> File bàn giao giữa các phiên làm việc. **Đọc file này đầu tiên khi tiếp tục.**
> Cập nhật lần cuối: 2026-10-10 (phiên 2: đồ họa 3D).

## Trạng thái nhanh

- Game **chơi được trọn vẹn**: 2–7 người, phòng chơi, bot, chat, luật cổ điển đầy đủ.
- Version `1.1.0`; các thay đổi sau đó nằm trong mục `[Unreleased]` của `CHANGELOG.md`.
- Test: `npm test` → 9 unit test + 1200 ván bot mô phỏng, **tất cả pass**.
- ⚠️ **Git đã `init` (nhánh `main`) nhưng CHƯA có commit nào.** Phiên 2 người dùng chọn "không commit" trước khi làm 3D. Vẫn nên đề xuất commit khi họ hài lòng với giao diện 3D.
- Bản sao lưu `public/` trước khi làm 3D chỉ nằm trong thư mục tạm của phiên 2 (sẽ mất) — nếu cần quay lại bản 2D cũ thì chỉ còn cách tắt 3D bằng nút "Tắt 3D".

## Cách chạy

Node 18 chỉ có trong WSL (Ubuntu-24.04), Windows không có Node.

```bash
cd ~/game
npm start                 # http://localhost:3000
BOT_DELAY=5 npm start     # bot chơi siêu nhanh khi test
npm test                  # unit test + mô phỏng
```

Từ PowerShell: `wsl -d Ubuntu-24.04 -- bash -lc "cd ~/game && npm test"`.
Lỗi `EADDRINUSE` = server cũ còn chạy → `pkill -f "node server/index.js"`.
Sửa code server phải khởi động lại server; sửa client thì chỉ cần Ctrl+F5.

## Đã làm (theo thứ tự)

1. **Engine + server + client cơ bản** — luật cổ điển (8 nhân vật, 65 lá, 11 công trình tím), chọn nhân vật đúng theo số người, server quyết định mọi thứ, ẩn thông tin bí mật, bot, phòng chơi, chat, bot chơi thay khi có người rời.
2. **Giao diện v2** — icon game-icons.net (`public/icons.js`, sinh bằng `npm run icons`), lá bài có hình minh họa, thẻ nhân vật, thông báo lớn khi nhân vật lộ diện, hiệu ứng vàng/công trình, bục vinh danh. Font tiêu đề Playfair Display (Cinzel không có dấu tiếng Việt).
3. **Tốc độ bot** — Chậm/Vừa/Nhanh (2.6s / 1.7s / 0.9s), đổi được khi đang chơi.
4. **SDLC cho Claude Code** — `CLAUDE.md`, 6 agent (`.claude/agents/`), skill `/sdlc`, `/hotfix`, `/release`, `citadels-rules`; `test/` dùng `node:test`.
5. **Rõ ràng lượt chơi** — thanh tiến trình vòng (giai đoạn, thứ tự chọn, trạng thái 8 nhân vật + tóm tắt việc đã làm), bước ①→④ trong lượt của mình, diễn biến trực tiếp lượt người khác. Server ghi `history` (sự kiện từng lượt) và `lastRound`.
6. **Tên bot tiếng Anh** (Arthur, Merlin, Elena, Robin, Isabel, Edmund, Grace).
7. **Sửa chữ bị cắt** trên lá công trình (lá tự cao theo nội dung).
8. **Kiểm tra lộ nhân vật** — user nghi bị lộ; đã quét 600 ván: server KHÔNG lộ. Nguyên nhân gây nhầm là panel tóm tắt vòng trước → đã đổi thành "Xem lại vòng X · đã kết thúc", thu gọn mặc định. Thêm test quét rò rỉ cố định.
9. **Nhật ký có cấu trúc** — server `addLog(text, tone, extra)` với tone `round|reveal|info|gain|build|attack|crown|finish|muted`, `**...**` để nhấn mạnh; client nhóm theo vòng → lượt, tô màu theo tone, bộ lọc "Quan trọng".
10. **Nút "Luật chơi & mẹo"** — cửa sổ 4 tab (Luật chơi, Nhân vật, Công trình, Mẹo chơi); dữ liệu công trình lấy từ endpoint `/cards.json`.
11. **Đồ họa 3D (phiên 2)** — người dùng chọn "kết hợp cả hai":
    - Đợt 1 — `public/city3d.js` (Three.js 0.160): bàn tròn, khu đất mỗi người, 28 mẫu nhà low-poly (object `BUILD`), bóng đổ, OrbitControls, nhãn tên CSS2D đặt trước mỗi khu đất, nhà mọc/lún có bụi, khu đất người đang chơi phát sáng, vương miện bay, Lãnh chúa bấm nhà 3D để phá (raycast), nút bật/tắt 3D (localStorage `citadels-3d`).
    - Đợt 2 — hiệu ứng 2.5D trong `app.js`/`style.css`: lá bài nghiêng theo chuột + vệt sáng (`.tilt`), nhân vật lật 3D khi lộ diện (`.flipcard`), đồng xu bay (`flyCoins`), nút nổi khối.
    - Công cụ xem trước lưu vào repo: `npm run preview` + `scripts/preview/shoot.ps1`.
12. **Bảng chọn nhân vật bật lên + quạt bài** — `renderPicker()` (cửa sổ khi tới lượt chọn, `ui.pickerHidden` để tạm ẩn, hiệu ứng chia bài chỉ chạy 1 lần theo `ui.pickKey`); `renderHand()` giờ là khay cố định ở đáy màn hình (`.hand-tray .fan`, biến CSS `--rot/--arc/--ov` tính trong JS). Sửa lỗi nhãn 3D nhân đôi khi dựng lại bàn (phải gỡ `labelEl` thủ công). Preview: view `relayout` kiểm tra số nhãn.
13. **Ô thông tin của mình + lượt của mình dạng cửa sổ + nhật ký lớn** — `renderMeHud()` (góc dưới trái: nhân vật, cảnh báo bị ám sát/trộm, vàng/bài/công trình, 5 màu, trạng thái lượt); `renderTurnPopup()` (cửa sổ Nhận tài nguyên / chọn lá giữ / mục tiêu kỹ năng; `ui.turnPopupHidden`, `ui.abilityPopup`) + `renderDock()` (thanh điều khiển góc dưới phải). Khung hành động trên cùng giờ luôn là dải 1 dòng (`.action.slim`). Đã THỬ noti góc phải rồi BỎ theo yêu cầu (rối mắt) → thay bằng nhật ký to hơn, cột phải sticky, dòng mới sáng lên (`log[].id` từ server, `ui.freshFrom`). Preview views mới: `myturn keep ability dock logfresh`.
14. **Ô thông tin vào cột phải, chat thành nút** — màn ≥1021px: `renderMeHud` nằm trong `.side` (dưới nhật ký), khay bài `.hand-tray { right: 414px }` chỉ phủ cột chính, `has-dock` chừa chỗ thanh điều khiển; màn hẹp: ô thông tin vẫn nằm trong khay bài. Chat: `chatButton()` (badge chưa đọc theo `chat[].at` / `ui.chatSeenAt`) + `renderChatPop()`; phòng chờ vẫn hiện chat đầy đủ. Preview: `chat`, `chatbadge`.
15. **Bảng người chơi gọn + khay bài có khung** — `renderPlayer` thành hàng `.prow` (ô công trình nhỏ `.mt`); khay bài là khung bo góc cùng chất liệu; `placeTray()` đặt khay theo vị trí đo thật của `.main` (bố cục căn giữa tối đa 1600px).
16. **LUẬT CITADELS 2016** — target mặc định 7; `cards.js`: `DISTRICTS` (54 lá thường) + `UNIQUES` (kho 24 loại tím), `buildDeck(uniqueKeys?)` rút ngẫu nhiên `UNIQUE_PER_GAME`=14; `Game`: `citySize` (Đài kỷ niệm = 2), `buildCost` (Xưởng), `buildBlock` (Kho bí mật, Mỏ đá, Đài kỷ niệm, thiếu vàng), Chuồng ngựa không tính lượt xây, Mỏ vàng, Thư viện giữ tất cả, Phòng thí nghiệm +2, Nhà tế bần/Công viên cuối lượt, `scoreOf().extras` (điểm thưởng tím). Bỏ Nghĩa địa/Đại học. View mới: `players[].citySize`, `costs` (giá & lý do cho lá trên tay), `uniqueKeys`. `/cards.json` → `{ base, uniques, uniquePerGame }`. 15 unit test (6 test luật 2016). Chưa cài: nhân vật số 9 / bộ nhân vật thay thế, 6 công trình tím cần thao tác đặc biệt.
17. **Hover chống giật + lá bài phong cách 2016 (tự vẽ, KHÔNG dùng tranh gốc — bản quyền)** — app.js: `sceneSvg(key, color)` dựng cảnh SVG (trời theo màu, đồi/tháp sinh theo key, công trình tô gradient), gradient chung chèn 1 lần bằng `ensureSceneDefs()`; `cardHtml` có chồng xu giá `.cost/.cc`, dải tên `.banner`, ngọc màu `.gem`; `charCard(r, act, {off, desc, style})` khung vòm + số lớn `.c-rank`. Hover: lớp `.hov` do JS quản lý (`updateHov`, quạt bài chọn lá theo `offsetLeft`, lá khác giữ theo vị trí gốc), `restoreHov()` sau mỗi `render()` (lớp `.snap` tắt transition 2 frame); mọi phần tử trỏ được cần `data-k` ổn định. Hiệu ứng xuất hiện (`ENTER_SEL`) chỉ chạy lần đầu. KHÔNG dùng `:hover` để transform phần tử.
18. **27 nhân vật bản 2016 + số 9 + 8 người** (theo luật thegioiboardgame.vn) — `cards.js`: `CHARACTERS` theo key (rank, color, income), `BASE_CAST`, `castProblem(keys, n)`. `game.js` viết lại: `this.cast` {rank→key}, `maxRank`, lượt = `newTurn()` có `key`; kỹ năng switch theo `t.key`; Phù thủy (`bewitched`, `witchPi`, `afterResources()` → tiếp quản), Thẩm phán (`warrants`, tịch thu trong `placeDistrict`), Kẻ tống tiền (`threats`, action `threat`), Thầy phép (`t.peek`, action `wizardTake`), Nhà tiên tri (`t.seerGive`, action `give`), Hoàng đế (`giveCrown`, bắt buộc trước endTurn), Hồng y (`buildInfo().borrow`), Người thu thuế (`taxPool`), Nghệ sĩ (`card.beauty`, `value()`). `index.js`: `options.chars`, `maxPlayers` 8 khi có số 9. Client: `CHARS` lấy từ `g.cast`; `SKILL`/`TILE_MODE`/`MODE_HINT`, `abilityPopup()`, `skillMarks()` + `skillTile()`, `renderCastPicker()`, `charMarks()`, `CHAR_TIPS`. Preview: `lobby2 alt threat peek`. 30 unit test + 1400 ván mô phỏng + e2e 3 bộ nhân vật đều pass. Bộ nhân vật mặc định ngẫu nhiên mỗi ván (`options.castMode`, `randomCast`) và bí mật (`opts.secretCast`: mỗi người chỉ biết nhân vật đã thấy khi chọn / được nêu tên qua `charName` → `publicRanks`; mọi log dùng `charName` nên tự công khai số đó). Preview: `secret`. Đơn giản hóa (ghi trong README): Thẩm phán tự tịch thu, Hồng y tự chọn người mượn & lá trả, Hoàng đế bị ám sát tự trao vương miện cho người kế bên.

19. **Thoại theo phòng** (phiên 4) — `public/voice.js` (WebRTC mesh, Socket.IO bắt tay), `server/index.js` (`voice:join|leave|mute|signal`, `voice:peers`, `/ice.json`, `members[].voice`), UI `voiceCtl()` + huy hiệu `voiceBadge()` trên avatar + `updateVoiceDom()`. Đã kiểm tra: Edge headless 2 người với micro giả (`--use-fake-device-for-media-stream`, chạy thật bằng `--remote-debugging-port`, đọc kết quả qua `/json` title) — nối, nghe được, tắt mic, nối lại, rời thoại, rời phòng đều OK; script socket kiểm tra chặn tín hiệu khác phòng/giả danh/gói lớn. Chưa thử: điện thoại thật (iOS Safari), mạng 4G cần TURN.

20. **Skill bên thứ ba + giao diện 3D ít chữ** (phiên 4) — xem `.claude/skills/THIRD_PARTY.md` và `docs/design/2026-10-10-giao-dien-3d.md`. `renderStage()` (bàn 3D là sân khấu, `--stage-h`), `renderCallOrder()` → `.rail/.tok` + `ui.tokInfo`, `renderMeHud` chỉ icon + số, `City3D.update(g, { label })`, chất lượng 3D thích ứng (`lowEnd`, `measure()`, `kick()`/`busyUntil` → 30 FPS khi đứng yên). Người dùng chưa xem bản này — cần phản hồi (nhật ký vẫn nhiều chữ; có thể rút gọn tiếp).

21. **Tối ưu điện thoại iOS/Android** (phiên 5) — xem mục đầu `[Unreleased]` trong CHANGELOG. Chạm 2 bước cho quạt bài, bàn 3D cho cuộn trang + chụm phóng to, bố cục dọc/ngang, vùng an toàn, svh/dvh, ô nhập 16px. Đã kiểm tra bằng Edge giả lập cảm ứng (`shoot.ps1 -Touch`, view `touchtap`); **chưa thử trên máy thật** — cần người dùng thử iPhone (Safari) và Android (Chrome), nhất là chụm 2 ngón trên bàn 3D và thoại.

## Điểm cần nhớ khi sửa code

- Mọi hành động: `Game.act()` → thêm cả `botAction` (nếu bot cần) → `renderAction` → case `data-act` trong click handler.
- Mỗi hành động có ý nghĩa nên gọi cả `addLog(...)` (nhật ký) và `note(...)` (tóm tắt lượt trên thanh tiến trình).
- `viewFor()` là ranh giới bảo mật; test `không bao giờ lộ nhân vật...` sẽ bắt lỗi rò rỉ.
- Client vẽ lại toàn bộ `#app` mỗi lần nhận state; trạng thái UI cục bộ nằm trong object `ui` (mode, logOpen, logFilter, rulesOpen...). Cửa sổ luật chơi vẽ riêng vào `#modal`, overlay thông báo vào `#overlay`.
- Đơn giản hóa so với luật giấy: Nghĩa địa tự động, Kiến trúc sư nhận 2 lá đầu lượt, bài bỏ xuống đáy chồng.

## Công cụ kiểm tra giao diện (đã lưu trong repo)

1. Trong WSL: `npm run preview` → sinh `scripts/preview/states.js` từ engine thật rồi phục vụ http://localhost:3200/preview.html.
2. Trên Windows: `.\scripts\preview\shoot.ps1 -Views turn,draft,gallery` → ảnh ở `%TEMP%\citadels-shots\`.
   - View: `turn draft wait end purple gallery lobby home fx warlord rules-rules rules-chars rules-districts rules-tips`.
   - `-Query '?only3d&h=900'` chỉ hiện khung 3D phóng to (soi mô hình nhà). `fx` = giả lập lá bài đang nghiêng + nhân vật vừa lộ diện.
3. Lưu ý: Edge headless dùng `--disable-gpu` vẫn chạy WebGL (SwiftShader). Không dùng `scrollIntoView` khi chụp (ảnh bị đen). Điện thoại: nhúng iframe rộng 390px.
4. Test socket thật (e2e) cần `socket.io-client` trong `/tmp/e2edeps` — WSL khởi động lại sẽ mất, cài lại bằng `npm i socket.io-client@4.7.5` trong thư mục đó.

## Việc tiếp theo (gợi ý, theo ưu tiên)

0a. **Song ngữ VI/EN** (xem CHANGELOG và quy ước trong CLAUDE.md): server gửi `text`+`en`, `events`+`eventsEn`, `{vi,en}` lỗi; client `tx()`. Thêm chữ mới nhớ viết cả tiếng Anh. Cần người dùng đọc thử bản tiếng Anh.
0. Người dùng **chơi thử bộ nhân vật 2016** (chọn ở phòng chờ) và phản hồi; cân nhắc cho Thẩm phán / Hồng y / Hoàng đế bị ám sát tự chọn thay vì tự động. Còn thiếu 6 công trình tím 2016 (Hang trộm, Giàn giáo, Kho vũ khí, Nghĩa trang, Bảo tàng, Nhà hát).
1. Người dùng **chơi thử bản 3D** và phản hồi (góc camera, kích thước nhà, hiệu năng máy yếu).
2. **Commit lần đầu** khi người dùng hài lòng, rồi chốt `[Unreleased]` thành `1.2.0` (`/release minor`).
3. Ý tưởng 3D tiếp: camera tự bay tới thành phố người đang chơi; hiệu ứng ám sát/trộm trong cảnh 3D; trời ngày/đêm theo vòng; mô hình chi tiết hơn cho công trình tím.
4. Kiểm tra trên điện thoại thật: khung 3D (cảm ứng xoay/zoom), overlay thông báo, cửa sổ luật chơi.
4. Nghĩa địa: hỏi người chơi có muốn trả 1 vàng không (hiện tự động).
5. Âm thanh / rung nhẹ khi đến lượt mình.
6. Chơi qua Internet: deploy (Render/Railway/Fly.io/VPS — cần WebSocket, 1 instance vì phòng lưu trong RAM), hoặc tạm `cloudflared tunnel --url http://localhost:3000`.
7. Bot thông minh hơn (đoán nhân vật, nhắm người dẫn đầu).
8. Lưu phòng ra file/Redis để restart server không mất ván.

## Sở thích của người dùng (rút ra từ các phiên)

- Giao tiếp và toàn bộ giao diện bằng **tiếng Việt**.
- Rất quan tâm **giao diện đẹp và dễ hiểu**: phải biết rõ đang lượt ai, làm gì, điều gì thay đổi.
- Muốn quy trình phát triển chuẩn (SDLC) với agent/skill của Claude Code.
