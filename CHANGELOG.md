# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), version theo [SemVer](https://semver.org/lang/vi/).

## [Unreleased]

## [2.0.0] - 2026-10-14

### Sửa lỗi — server sập / quá tải
- **Một gói tin sai dạng làm sập cả server** (vd. `create` với dữ liệu `null` → `TypeError: Cannot destructure property 'name' of null` → tiến trình Node thoát, mọi phòng mất). Mọi sự kiện socket giờ đi qua hàm bọc `on()` (bắt lỗi + chuẩn hóa dữ liệu + giới hạn tần suất: chat 5 tin/5s, hành động 20/2s); thêm `uncaughtException` / `unhandledRejection` ghi log rồi chạy tiếp; gói từ client tối đa 64KB; gửi trạng thái trong đồng hồ bot / hết giờ cũng được bọc lỗi. Đã kiểm chứng: cùng chuỗi gói lỗi, bản cũ thoát, bản mới vẫn phục vụ người khác.
- **Gói trạng thái nhỏ lại**: nhật ký chiếm ~70% mỗi gói và bị gửi lại toàn bộ mỗi lần cập nhật. Server chỉ gửi 80 dòng cuối, client gộp theo `gameId` (`mergeLog`). Thử tải 10 phòng × 8 người: gói trung bình 27.9 → 19.8KB, lớn nhất 52 → 28KB, CPU 12% → 10%. Nén WebSocket bật được bằng `WS_COMPRESS=1` (tốn CPU — máy chủ yếu để tắt).
- **Phòng bỏ dở được dọn**: không còn người thật nào kết nối trong 10 phút → xóa phòng và mọi đồng hồ (`deleteRoom`).

### Thay đổi — dễ chơi hơn, gọn 1 màn hình (phản hồi người chơi)
- **Nút Rời phòng luôn thấy** trên điện thoại dọc / ngang (ghim mép phải thanh trên cùng; trước bị đẩy ra ngoài, phải vuốt / xoay ngang).
- **Bảng lượt kiểu bảng chọn nhân vật**: tới lượt mình, bảng lớn bật lên với mỗi việc là 1 thẻ lớn — Bước 1: Lấy vàng / Rút bài (💡 thẻ nên chọn), Bước 2: Xây công trình (đóng bảng để kéo lá), kỹ năng nhân vật (kèm mô tả), Thu thuế theo màu (nói rõ +1 mỗi công trình màu gì), công trình hỗ trợ (chỉ hiện khi dùng được); nút "Kết thúc lượt" lớn. Thanh điều khiển nhỏ chỉ còn "☰ Hành động" (mở lại bảng) + "Kết thúc lượt". Trước đây là ô nhỏ nhiều nút na ná nhau ("Thu 1 vàng" của kỹ năng Tu viện trưởng lẫn "Thu +1 vàng" thu thuế), khó nhìn.
- **Kéo lá lên bàn để xây** (chuột & cảm ứng): nhấn lá đang sáng, kéo lên khỏi khay, thả → xây; có lá "ma" theo tay và nhãn "Thả lên bàn để xây · giá". Bấm như cũ vẫn xây được. Trước đây trên điện thoại phải chạm 2 lần đúng lá trong quạt bài chồng nhau → hay chạm nhầm lá bên cạnh, "bấm chục lần".
- **Thành phố người chơi đưa lên**: màn rộng — cột phải có tab **Thành phố** / **Nhật ký**, mặc định đóng cả hai (bấm tab mở, bấm lại đóng); màn hẹp — nút 🏰 / 📜 trên bàn 3D mở bảng trượt từ dưới (thành phố vuốt ngang từng người). Chạm bảng tên người chơi trên bàn 3D → mở thành phố người đó. Trước đây danh sách nằm dưới bàn 3D, không ai cuộn xuống xem.
- **Nhật ký thu gọn mặc định** (tab / bảng trượt, mở khi cần); chat vẫn là nút + khung bật ra.
- **Tới lượt mình rõ hơn**: dải "Lượt của bạn" nền vàng, viền sáng nhấp 3 lần, ghi đúng 1 việc cần làm ("Bước 1: chọn Lấy vàng hoặc Rút bài…", "Bước 2: kéo lá sáng lên bàn để xây…"); điện thoại rung nhẹ khi tới lượt chơi / lượt chọn nhân vật.
- **Bớt thông tin trên điện thoại dọc**: ô thông tin của mình còn 1 hàng; thanh vòng chơi thấp hơn; nhóm nút bàn 3D thành 1 hàng trên bàn (trước nằm góc dưới, bị khay bài che).
- Xem trước / kiểm tra: view `uxtest` (bảng trượt, mở thành phố từ bảng tên, kéo xây / kéo ít không xây), `sheetcities`, `sheetlog`.

### Thêm — chế độ "Luật rừng NNHP"
- Phòng chờ → Bộ nhân vật → **🌲 Luật rừng NNHP**: **mỗi vòng** rút lại bộ nhân vật (mỗi số ngẫu nhiên 1 trong 3, luôn hợp lệ với số người) thay vì cố định cả ván; bộ giữ bí mật như chế độ ngẫu nhiên, kiến thức vòng trước bị xóa (`Game.rerollCast`, `opts.reshuffle`). Nhật ký báo "🌲 Luật rừng NNHP — bộ nhân vật vòng này đã được rút lại"; huy hiệu 🌲 trên thanh vòng chơi. Client nhớ bộ nhân vật từng vòng (`ui.castByRound`, `withCast`) để nhật ký / xem lại vòng cũ hiện đúng tên.
- Test: unit test mới; test quét rò rỉ nhân vật chạy cả chế độ này; mô phỏng: 1/4 số ván dùng Luật rừng.

### Thay đổi — cỡ giao diện, tự kết thúc lượt, máy tính bảng
- **Màn lớn tự thu nhỏ** (giống zoom trình duyệt ~75% trên Full HD): CSS `zoom` = 1440 / bề rộng màn (0.72–1, chỉ từ 1021px), khung trang dùng hết bề ngang. Mọi chỗ đo rồi đặt vị trí chia cho `UIZ` (khay bài, kéo lá, xu bay, độ rộng quạt, tooltip 3D); chiều cao theo màn hình dùng `--vh100` thay `vh` (vh bị zoom làm co). Ai đang zoom trình duyệt 75% nên đưa về 100%.
- **Tự kết thúc lượt** khi đã làm hết việc làm được (đã nhận tài nguyên, xây đủ / không còn lá xây được, kỹ năng đã dùng hoặc không có mục tiêu, Hoàng đế đã trao vương miện, đã chọn thu thuế vàng/lá, công trình hỗ trợ đã dùng): thanh điều khiển báo "Đã xong lượt — tự kết thúc…" kèm thanh đếm 1.6 giây, nút "Ở lại" để hủy / "Kết thúc ngay". Còn việc thì không tự kết thúc — vừa làm xong 1 việc (vd. kéo lá xây) mà vẫn còn việc → bảng lượt tự mở lại (`turnLeft`, `autoTurn`). Kiểm tra: view `autoendtest`.
- **Máy tính bảng dọc (601–1020px)**: thanh trên cùng 1 dòng, "Rời phòng" ghim phải; dải "đang chơi" không còn đè nhóm nút Thành phố / Nhật ký. **Điện thoại xoay ngang**: bảng lượt 3 thẻ / hàng, vừa 1 màn.
- **Vào ván / đổi màn luôn về đầu trang** (trước: bấm "Bắt đầu" ở cuối phòng chờ → màn chơi mở lưng chừng). Kiểm tra: view `scrolltest`.
- **Danh sách Thành phố ở cột phải** (hẹp 300px): tên + nhân vật / hàng số liệu / hàng công trình — trước bị ép 1 hàng, tên cắt còn "Bot …", số đè lên chữ.
- **Tìm trong luật**: tab đang mở lên đầu kết quả, bấm tab khi đang tìm = đổi ưu tiên (giữ từ khóa); giãn khoảng cách tab / ô tìm / kết quả.
- Đã chạy test giao diện ở 390×844, 844×390 (điện thoại), 820×1180, 1180×820 (iPad, giả lập cảm ứng), 1366, 1530, 1920 (máy tính).

### Thêm — tìm kiếm trong "Luật chơi & mẹo"
- Ô tìm dưới các tab: tìm cùng lúc cả 4 tab (Luật chơi, Nhân vật, Công trình, Mẹo chơi), **không cần gõ dấu** ("thu thue" ra "Thu thuế", "ke trom" ra "Kẻ trộm"), kết quả gom theo tab kèm ngữ cảnh (mục luật / màu công trình), từ khớp tô sáng. Gõ tới đâu cập nhật tới đó (chỉ vẽ lại phần kết quả, ô nhập giữ con trỏ); Esc xóa từ khóa, Esc lần nữa đóng cửa sổ; bấm tab để thoát tìm. Kiểm tra: view `searchtest`; ảnh: `rulessearch`.

### Thêm — đổi avatar
- 24 avatar vẽ từ icon nhân vật + "chữ cái đầu tên". Đổi ở trang chủ (nút cạnh ô tên) hoặc phòng chờ (bấm avatar của mình); lưu trên máy (`citadels-avatar`), gửi server (`create` / `join` / `setAvatar`) để mọi người cùng thấy. Server chỉ nhận tên trong danh sách (chặn chèn HTML). Xem trước: view `avatarpick`, `avatartest`, `lobbyjungle`.

### Thay đổi — font không chân
- Bỏ Playfair Display (tiêu đề) và Cinzel (chữ "Citadels", số) — toàn bộ dùng **Be Vietnam Pro** (không chân, đủ dấu tiếng Việt); `--display` / `--brand` vẫn giữ để chỉnh 1 chỗ.

### Thêm — giới hạn thời gian: chờ quá 90 giây thì mất lượt
- Mỗi lượt chơi và mỗi lần chọn / bỏ nhân vật của người thật có **90 giây** (cố định, bot không bị tính giờ). Hết giờ khi đang chọn nhân vật → chọn / bỏ ngẫu nhiên 1 lá; hết giờ trong lượt → **mất lượt**: không nhận tài nguyên, không thu theo màu, không xây (`Game.timeout(pi)`). Việc dở dang được xử lý mặc định để không mất bài, không kẹt ván: giữ lá vừa rút, Nhà tiên tri trả đủ bài, Thầy phép không lấy lá, thư đe dọa coi như từ chối, Hoàng đế trao vương miện ngẫu nhiên (không nhận cống), bị yểm bùa → Phù thủy tiếp quản như thường. Nhật ký ghi "⏳ … hết giờ — mất lượt".
- Server giữ đồng hồ (`syncTimer` trong `server/index.js`, chỉ đặt lại khi sang bước mới), gửi số ms còn lại (`room.deadlineIn`) — client tự tính theo đồng hồ máy mình nên không lệch giờ. `TURN_TIME` (giây) ghi đè khi test.
- Viên đồng hồ đếm ngược nổi ở mép trên (vòng tròn + số giây + tên người đang chơi; điện thoại: chỉ vòng + số ở góc phải); 10 giây cuối chuyển đỏ, nhấp sáng, có tiếng tích tắc nếu là lượt mình; ai hết giờ có tiếng chuông trầm. Thêm dòng này vào phần luật.
- Kiểm tra: 5 unit test mới (`test/characters.test.js`), mô phỏng 1400 ván nay có ~4% bước hết giờ ngẫu nhiên (không mất bài / vàng, ván luôn kết thúc), xem trước view `clock`, `clockurgent`, `clocktest`.

### Thêm — mở bài trên tay khi khay đang thu gọn
- Khay bài đang thu gọn (cuộn khỏi bàn 3D): bấm viên "Bài trên tay ▲" → khay trượt lên ngay tại chỗ, không cuộn trang; quạt bài nâng hẳn lên để đọc tên & giá, nền phía sau tối mờ cho dễ nhìn. Bấm viên lần nữa (▼), chạm ra ngoài khay hoặc Esc → thu lại; cuộn về bàn 3D → khay về bình thường, lần sau cuộn đi lại tự thu gọn (`ui.trayOpen`, `body.tray-peek`). Trước đây bấm viên chỉ cuộn trang về bàn. Xem trước: view `traypeek`; kiểm tra: view `traymin`.

## [1.2.0] - 2026-10-12

### Hiệu năng — mượt hơn, đỡ nóng máy (nhất là điện thoại)
- Bàn 3D: chỉ vẽ dồn 60 khung/giây khi cảnh thật sự đổi (nhà mọc / lún / dời, vương miện đổi chủ) hoặc đang xoay / phóng; trước đây mỗi lần giao diện vẽ lại (rất thường xuyên khi bot chơi) đều bắt bàn vẽ hết tốc lực 1.6 giây. Đứng yên: 20 khung/giây (điện thoại 12), trước là 30–70. Đo bằng view xem trước `perf`: máy tính 38 → 19 (đứng yên), 70 → 19 (giao diện vẽ lại).
- Bàn 3D: bóng đổ chỉ tính lại khi nhà thay đổi (`shadowMap.autoUpdate = false`), vương miện không đổ bóng; nhãn tên chỉ cập nhật khi camera / nội dung đổi; không xin GPU rời (`powerPreference`) — laptop 2 card không bật card rời; điện thoại dùng bóng PCF thường; quả cầu lơ lửng không duyệt cây mỗi khung; giải phóng vật liệu của bụi.
- Bỏ mọi `backdrop-filter` (khung "Lượt của bạn" nằm trên canvas 3D phải làm mờ lại mỗi khung hình 3D; thanh trên cùng làm mờ khi cuộn) — nền các khung vốn đã gần đặc nên nhìn gần như không đổi.
- Bỏ `background-attachment: fixed` (Android vẽ lại cả màn mỗi lần cuộn) → lớp nền cố định `body::before`.
- Hình nền thành phố (trang chủ / phòng chờ) thành tĩnh: trước đây ~40 sao + ~cửa sổ nhấp nháy nằm trong SVG toàn màn có `drop-shadow` → vẽ lại cả màn 60 lần/giây. Giờ chỉ 14 sao HTML riêng đổi opacity (GPU làm).
- Nhịp sáng (nhân vật đang chơi, ô công trình mục tiêu, viền đang nói, chấm chờ) đổi opacity / transform của lớp `::after` thay vì animate `box-shadow` / `outline` (vẽ lại mỗi khung).
- Hệ điều hành bật "giảm chuyển động" → tắt animation lặp.
- Đang trong thoại ở màn ≤ 1500px: nút trên thanh trên cùng chỉ còn icon để thanh không xuống 2 dòng.

### Thêm — âm thanh
- Hiệu ứng âm thanh tổng hợp bằng Web Audio (`public/sfx.js`, `window.Sfx`), không cần file âm thanh: chuông khi đến lượt bạn, lật bài khi nhân vật khác lộ diện, tù và khi sang vòng mới, búa khi xây, nhát chém khi bị tấn công (ám sát / trộm / phá), xu leng keng khi vàng của bạn tăng / giảm, kèn khi trao vương miện / đủ công trình / kết thúc ván, tiếng "ting" khi có tin nhắn mới, tiếng "tách" nhẹ khi bấm nút. Âm sắc mềm: chuông FM + sóng sin / tam giác (không dùng sóng vuông / răng cưa), đường bao lên tuyến tính – tắt dần theo hàm mũ (không "tách" đầu / cuối nốt), mọi tiếng theo giọng Rê như nhạc nền, lọc bớt dải cao + vang nhẹ; tiếng quan trọng (đến lượt, vòng mới, tấn công, vương miện, thắng) làm nhạc nền nhỏ đi 1 giây.
- Nhạc nền trung cổ tự sáng tác bằng Web Audio (giọng D thứ: pad hợp âm, bass, đàn hạc rải, đàn lute giai điệu ngẫu nhiên nên không lặp y hệt, trống da, vang nhẹ). Phát ở mọi màn sau lần chạm đầu tiên; nhỏ lại khi đang trong thoại; dừng hẳn khi ẩn tab (không tốn CPU).
- Nút 🎵 (nhạc nền) và 🔊 / 🔇 (hiệu ứng) bật / tắt riêng, ở trang chủ và thanh trên cùng (phòng chờ & trong ván); lựa chọn được lưu trên trình duyệt. iOS / Android: tiếng chỉ phát sau lần chạm đầu tiên (luật của trình duyệt). Xem trước: view `sfx`.
- Bỏ dòng "bản fan làm để chơi cùng bạn bè" ở chân trang.

### Thay đổi — đồng bộ phòng chờ & màn chơi
- Phòng chờ dùng chung thanh trên cùng với màn chơi (`renderTopbar()`): Luật chơi, Thoại, Trò chuyện, ngôn ngữ, Rời phòng luôn cùng vị trí, cùng kiểu. Bỏ khung chat lớn và khung "Xem luật đầy đủ" ở phòng chờ — chat là nút có số tin chưa đọc + khung bật ra như trong ván.
- Rời phòng: 1 kiểu duy nhất ở mọi nơi — bấm 2 lần (lần 1 nút chuyển đỏ "Bấm lần nữa để rời", tự trở lại sau 3 giây, `ui.leaveArmed`); bỏ hộp `confirm()` của trình duyệt khi đang chơi (tooltip vẫn báo bot sẽ chơi thay). Nút không còn nằm cạnh "Bắt đầu chơi".
- Điện thoại: nút Bắt đầu / Thêm bot ở phòng chờ giãn hết chiều ngang. Xem trước: view `lobbyleave`, `lobbychat`.
- Khay bài trên tay tự thu gọn khi cuộn khỏi bàn 3D (chỉ còn nút "Bài trên tay", chạm để cuộn về bàn), mở lại khi cuộn về; tới lượt mình thì luôn mở (`updateTray()`, `body.tray-min`). Khay không còn che dòng ghi công, bỏ khoảng trống thừa cuối trang. Bàn 3D giữ sẵn chiều cao khi Three.js chưa tải xong (tránh trang nhảy). Xem trước: view `traymin`.

### Thay đổi — tối ưu điện thoại (iOS Safari / Android Chrome)
- Chạm lá bài trong quạt: lần 1 nâng lên phóng to để đọc, lần 2 mới xây / chọn; chạm ra ngoài thì hạ bài (trước đây chạm 1 lần là xây ngay). Màn cảm ứng: quạt bài mặc định hạ thấp, chỉ ló giá + tên, không che bàn 3D.
- Bàn 3D trên màn cảm ứng: vuốt dọc cuộn trang (trước đây bàn chặn cuộn), vuốt ngang xoay bàn, chụm 2 ngón phóng to (`zoomBy()`), chạm vào nhà để xem tên & mô tả.
- Điện thoại dọc: thanh trên cùng 1 dòng (logo, mã phòng, vòng + nút icon; thừa thì vuốt ngang); thanh điều khiển lượt gọn 1 hàng; bảng chọn nhân vật 3 lá / hàng (thấy đủ 6 lá trong 1 màn).
- Điện thoại xoay ngang: bố cục riêng (`max-height: 500px`) — thanh nhân vật thấp gọn, quạt bài thu nhỏ 0.68 (`LANDSCAPE_PHONE`), thanh điều khiển lượt nằm góc phải cạnh quạt bài, bàn 3D cao theo màn hình.
- iOS/Android: `viewport-fit=cover` + vùng an toàn (tai thỏ, thanh home), chiều cao theo `svh/dvh` (thanh địa chỉ Safari), ô nhập 16px (không tự phóng to), tắt kéo-để-tải-lại giữa ván, bỏ viền xanh khi chạm, `touch-action: manipulation`, tiền tố `-webkit-backdrop-filter` (Safari ≤ 17), màu dự phòng khi trình duyệt chưa có `color-mix()`, thẻ meta thêm vào màn hình chính (`theme-color`, `apple-mobile-web-app-*`).
- Công cụ: `shoot.ps1 -Touch` (giả lập màn cảm ứng); view kiểm tra `touchtap` (tiêu đề `TOUCHTEST true,true,true,true`).

### Thay đổi — giao diện 3D, ít chữ (docs/design/2026-10-10-giao-dien-3d.md)
- Bàn 3D thành sân khấu chính: cao gần hết màn hình (`--stage-h`), dải hành động và nút ↺ / 3D nổi trên bàn; bỏ tiêu đề và dòng gợi ý của khung 3D (`renderStage()` thay `renderBoard3d()`).
- Thanh nhân vật 1→9 thành hàng đồng xu nổi khối trên rãnh gỗ (`.rail` / `.tok`): trạng thái bằng icon (✓ ▶ 💀 ✕ –), dấu nhắm (💀 🦹 🧙 📜 ✉️, phát sáng nếu là thật); sự kiện chi tiết trong tooltip và bảng bật ra khi chạm (`ui.tokInfo`).
- Thanh vòng: chỉ còn "Chọn › Gọi 1→8", giải thích chuyển vào nút `?`. Thứ tự chọn: ✔ / ✋ / ⏳ thay chữ.
- Ô thông tin của mình: bỏ mô tả kỹ năng và nhãn chữ (chỉ icon + số), trạng thái rút gọn (⭐ Lượt bạn, ⏳ 2, ✔), câu đầy đủ trong tooltip.
- Nhãn người chơi trên bàn 3D: icon vàng · bài · công trình + đồng xu nhân vật đã lộ (`opts.label` do app.js dựng).
- Nhật ký mặc định "Quan trọng", bỏ dòng "Không có thay đổi đáng kể". Bảng người chơi đổi tên "Thành phố", bỏ gợi ý.
- Chất liệu: panel gỗ có cạnh dày, nút lún khi bấm, huy hiệu đồng xu có vành đồng thau (token `--walnut --oak --brass --slab --wood`).
- Hiệu năng 3D: điện thoại / màn cảm ứng bắt đầu ở pixel ratio 1.25, bóng 1024, tắt khử răng cưa; đo FPS lúc đầu, máy yếu (< 40 FPS) tự hạ chất lượng; đứng yên thì vẽ 30 khung/giây; nhãn chỉ cập nhật khi nội dung đổi.
- Xem trước: view `tokinfo`.
- Đổi tông nền nâu → xanh đêm phối đồng thau (nền tách khỏi lá bài & bàn gỗ; nền cảnh 3D cùng tông). Lá nhân vật trong bảng chọn cao bằng nhau kể cả khi xuống 2 hàng (`equalCards()`).
- Hình nền trang chủ & phòng chờ: thành phố trung cổ về đêm tự vẽ bằng SVG (trăng, sao lấp lánh, 3 lớp tháp/lâu đài, cửa sổ thắp đèn) — `ensureBackdrop()`, dựng 1 lần ngoài `#app`, ẩn khi đang chơi.
- Sửa: nhóm nút thoại bị cạnh dày của nút tràn đè lên viền khung.
- Sửa: trang chủ — dòng ghi công icon luôn ở đáy màn hình; mở "Tóm tắt nhanh" không còn kéo logo/tiêu đề bên trái tụt xuống (2 cột căn mép trên). Xem trước: view `homesum`.
- Sửa: nhật ký luôn cuộn tới dòng mới nhất khi có sự kiện mới (trước đây chỉ cuộn nếu đang ở sát đáy); không có sự kiện mới thì giữ nguyên chỗ đang xem thay vì nhảy về đầu (`ui.logSeenId`). Xem trước / kiểm tra: view `logscroll` (tiêu đề trang `LOGTEST true,true,true`).

### Thêm — skill cho Claude Code
- 29 skill bên thứ ba trong `.claude/skills/` (frontend-design, design, ui-ux-pro-max, tailwind-design-system, claude-md-improver, superpowers) + lệnh `/revise-claude-md`; nguồn & giấy phép ở `.claude/skills/THIRD_PARTY.md`.

## [1.1.0] - 2026-10-09

### Thêm — thoại theo phòng (voice chat)
- Nút **Thoại** ở phòng chờ và thanh trên cùng: vào kênh thoại của phòng, tắt/bật micro (phím **M**), tắt loa, rời thoại; số người đang trong thoại hiện trên nút.
- Huy hiệu micro trên avatar (phòng chờ, bảng người chơi): xanh = đang trong thoại, đỏ = tắt micro; bấm vào huy hiệu người khác để tắt tiếng riêng họ (chỉ ở máy mình). Viền xanh nhấp nháy quanh avatar người đang nói. Huy hiệu nhấp nháy vàng = đang nối, xám = không nối được.
- Kỹ thuật: WebRTC nối trực tiếp từng cặp (mesh, tối đa 8 người), Socket.IO chỉ chuyển tín hiệu bắt tay (`voice:join|leave|mute|signal`, `voice:peers`), âm thanh không đi qua server. Người vào sau gửi offer. Tự vào lại thoại khi socket nối lại; tự tắt khi rời phòng / bị mời ra / bot thay chỗ. `members[].voice`: `null | 'on' | 'muted'`.
- Máy chủ ICE ở `/ice.json`: STUN công khai của Google; TURN tùy chọn qua biến môi trường `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` (xem docs/DEPLOY.md).
- Cần HTTPS hoặc localhost (quy định của trình duyệt về micro).

### Thay đổi — giao diện co giãn theo thiết bị
- Thanh trên cùng bớt chữ dần theo bề rộng (≤1500px: chỉ icon + số; ≤1180px: nút chỉ còn icon, có tooltip); điện thoại ẩn mục tiêu & tốc độ bot, gọn 2 dòng.
- Laptop màn thấp (≤820px chiều cao): thu gọn thanh gọi nhân vật, bàn 3D 360px, nhật ký theo chiều cao màn hình, ô thông tin & thanh điều khiển gọn hơn.
- Màn hẹp (≤1020px): ô thông tin của mình nằm trong trang (dưới dải hành động) thay vì nổi đè lên khay bài.
- Điện thoại: thanh gọi nhân vật & thứ tự chọn thành 1 hàng vuốt ngang; phòng chờ 2 cột ghế, tùy chọn xếp dọc; cửa sổ lượt/chọn gọn hơn.
- Màn hình cảm ứng: quạt bài luôn nâng (không có rê chuột).
- Sửa: khay bài lúc tới lượt mình bị đẩy cao 70px (chiều cao tối thiểu cũ).
- Công cụ: `scripts/preview/device.html` + `shoot.ps1 -Device 390x844` để chụp đúng kích thước điện thoại/laptop.

### Thay đổi — quạt bài
- Bỏ khung nền phía sau quạt bài. Bài trên tay mặc định hạ thấp (chỉ ló phần đầu lá: giá, tên, tranh); trỏ chuột vào quạt bài thì cả quạt nâng lên, lá đang trỏ nhô cao như trước (biến CSS `--drop`).

### Thêm — chuyển ngôn ngữ Tiếng Việt ⇄ English
- Nút **🌐 EN / VI** ở trang chủ, phòng chờ và thanh trên cùng khi chơi; trình duyệt nhớ lựa chọn (`localStorage` `citadels-lang`). Tiếng Việt vẫn là mặc định.
- Server gửi song ngữ: mỗi dòng nhật ký có `text` (vi) + `en`; tóm tắt lượt `events` + `eventsEn`; lỗi luật `GameError.en`; `errorMsg` gửi `{ vi, en }`. Tên & mô tả tiếng Anh chính thức bản 2016 cho 27 nhân vật và 41 loại công trình (`nameEn`, `descEn`; `cardsData()` cho `/cards.json`).
- Client dịch toàn bộ giao diện, cửa sổ kỹ năng, bảng điểm, trang Luật chơi (luật, nhân vật, công trình, mẹo) và tooltip/nhãn bàn 3D. Bộ nhân vật bí mật không lộ cả tên tiếng Anh (có test).
- Trang xem trước: `?lang=en`.

### Sửa lỗi
- Phù thủy chơi thay Kẻ trộm: vàng trộm được trả nhầm cho chủ lá Kẻ trộm, và nếu người đó cũng là người bị trộm thì mất sạch vàng. Giờ vàng về tay người dùng kỹ năng (`robberPi`), không bao giờ tự trộm của mình (có test). Mô phỏng in nhật ký quanh bước lỗi khi phát hiện vàng biến mất.

### Thêm — đủ 27 nhân vật bản 2016 + nhân vật số 9 + chơi 8 người
- Bộ nhân vật mặc định **ngẫu nhiên mỗi ván**: mỗi lần bắt đầu (kể cả "Chơi ván mới"), server rút 1 trong 3 nhân vật cho mỗi số (`randomCast`; số 9 có thể có hoặc không, luôn có khi 8 người). Bộ ngẫu nhiên được **giữ bí mật**: phòng chờ chỉ hiện 9 lá úp "?", không báo trong nhật ký (`opts.secretCast`); bộ tự chọn thì báo ở dòng nhật ký đầu ván. Trong ván, mỗi người chỉ thấy tên nhân vật mình đã gặp trong bảng chọn hoặc đã được nêu tên công khai (lật ngửa, được gọi, bị nhắm…); số khác hiện "Số N · ?" — lọc ở server (`viewFor` gửi `cast[r] = null`; `Game.publicRanks`, `seen`, `markSeen`). Test quét toàn ván đảm bảo không lộ tên. Mô tả Thành lũy / Tường thành lớn ghi "nhân vật số 8" thay vì tên riêng. Chủ phòng có thể chuyển sang "Tự chọn" (`options.castMode`), có nút "Bộ cơ bản" / "Rút thử 1 bộ" và cảnh báo khi bộ không hợp lệ với số người.
- 18 nhân vật thay thế: Phù thủy, Thẩm phán, Gián điệp, Kẻ tống tiền, Thầy phép, Nhà tiên tri, Hoàng đế, Nguyên lão, Tu viện trưởng, Hồng y, Nhà giả kim, Lái buôn, Nhà hàng hải, Học giả, Nhà ngoại giao, Thống chế. Nhân vật số 9: Hoàng hậu, Nghệ sĩ, Người thu thuế (kho thuế hiện trên thanh trên cùng).
- Chơi tối đa 8 người khi có nhân vật số 9; số lá lật ngửa theo bảng 9 nhân vật (4 người: 3, 5: 2, 6: 1); 7–8 người: người chọn cuối được lấy lá úp.
- Cửa sổ kỹ năng mới: chọn nhiều nhân vật + lệnh/thư thật, chọn người + màu (Gián điệp), xem bài & lấy/xây (Thầy phép), trả bài (Nhà tiên tri), trả tiền/từ chối thư đe dọa, chọn công trình để đổi (Nhà ngoại giao). Lấy / đổi / trang trí công trình bấm trực tiếp trên ô công trình hoặc nhà 3D.
- Thanh gọi nhân vật 1 → 9 hiện dấu hiệu công khai: bị ám sát, bị nhắm trộm, bị yểm bùa, lệnh bắt, thư đe dọa (lá thật chỉ người đặt thấy). Ô thông tin của mình cảnh báo tương ứng.
- Trang Luật chơi: tab Nhân vật liệt kê đủ 27 nhân vật kèm mẹo, đánh dấu nhân vật trong ván; bảng lá lật ngửa cho 8/9 nhân vật.
- Bot chơi được mọi nhân vật; mô phỏng 1400 ván (2–8 người, bộ nhân vật ngẫu nhiên, kiểm tra đủ 27 nhân vật); 15 unit test mới (`test/characters.test.js`).
- Engine: `Game.cast` (số → nhân vật), `maxRank`, `buildInfo()` (giá/lý do/Hồng y mượn vàng/Lái buôn…), `castProblem()` trong `cards.js`; hành động mới `threat`, `wizardTake`, `give`; `/cards.json` có `characters`, `baseCast`.

### Thay đổi lớn — chuyển sang luật Citadels 2016
- Hoàn thành thành phố ở **7 công trình** (mặc định; phòng vẫn chọn được 8 cho ván dài).
- Công trình tím theo bản 2016: kho 24 loại, mỗi ván rút ngẫu nhiên 14 loại vào chồng bài (54 lá thường + 14). Bỏ Nghĩa địa, Đại học. Thêm: Chuồng ngựa, Tượng đài, Đại giáo đường, Đài kỷ niệm, Nhà tế bần, Kho bạc hoàng gia, Phòng bản đồ, Giếng ước, Tháp ngà, Điện Capitol, Mỏ đá, Xưởng thủ công, Mỏ vàng, Công viên, Kho bí mật.
- Chỉnh theo 2016: Phòng thí nghiệm +2 vàng; Thư viện giữ tất cả lá rút; Đài thiên văn giá 4; Khu phố ma (đổi tên) tính màu bất kỳ, bỏ điều kiện vòng cuối; Chiến trường đổi tên Doanh trại.
- Tính điểm thêm cột "Công trình tím" (Cổng Rồng, Kho bạc, Phòng bản đồ, Tượng đài, Giếng ước, Tháp ngà, Đại giáo đường, Capitol, Kho bí mật).
- Server tính sẵn giá xây thực tế & lý do không xây được cho từng lá trên tay (`view.costs`); bot dùng chung `Game.buildBlock`.
- Chưa cài 6 công trình 2016 cần thao tác đặc biệt: Hang trộm, Giàn giáo, Kho vũ khí, Nghĩa trang, Bảo tàng, Nhà hát. Nhân vật dùng bộ 8 nhân vật cơ bản của bản 2016 (kỹ năng giống bản cổ điển); chưa có nhân vật số 9 và các bộ nhân vật thay thế.

### Thêm
- Thanh tiến trình vòng: giai đoạn hiện tại (Chọn nhân vật / Gọi nhân vật 1→8), thứ tự lượt chọn, trạng thái từng nhân vật và tóm tắt việc đã làm trong lượt.
- Lượt của người khác: hiện trực tiếp từng việc họ vừa làm. Lượt của mình: các bước ① Nhận tài nguyên → ② Kỹ năng → ③ Xây → ④ Kết thúc, có đánh dấu.
- Bảng "Tóm tắt vòng trước" khi chọn nhân vật vòng mới.
- Nhãn trên thẻ người chơi cho biết người đó đang làm gì ("Đang chọn nhân vật", "Đang chơi · Kẻ trộm").
- Nhật ký nhóm theo vòng (vòng cũ thu gọn kèm tóm tắt số lần xây/tấn công) và theo lượt nhân vật; tô màu theo loại sự kiện (tấn công, nhận thêm, xây, vương miện, hoàn thành), nhấn mạnh số tiền và đối tượng bị ảnh hưởng; bộ lọc "Quan trọng".
- Nút "Luật chơi & mẹo": cửa sổ 4 tab — luật đầy đủ, 8 nhân vật, toàn bộ công trình, mẹo chơi chung & theo nhân vật.
- Endpoint `/cards.json` cung cấp dữ liệu công trình cho trang luật chơi.
- **Vương quốc 3D** (Three.js): bàn tròn với thành phố của mọi người chơi; 28 mẫu nhà low-poly riêng cho từng loại công trình, ánh sáng & đổ bóng, xoay/phóng to camera; nhà mới mọc lên kèm bụi, nhà bị phá lún xuống; khu đất người đang chơi phát sáng; vương miện vàng bay trên thành phố người giữ; Lãnh chúa bấm thẳng vào nhà 3D để phá. Nút bật/tắt 3D (ghi nhớ trên trình duyệt).
- Hiệu ứng 2.5D: lá bài nghiêng theo chuột kèm vệt sáng, nhân vật lật 3D khi lộ diện, đồng xu bay khi vàng thay đổi (bị trộm: xu bay từ nạn nhân sang Kẻ trộm), nút bấm nổi khối.
- `npm run preview` + `scripts/preview/`: xem trước và chụp ảnh giao diện với trạng thái mẫu.
- Phụ thuộc mới: `three@0.160`.
- Bảng chọn nhân vật bật lên giữa màn hình chỉ khi tới lượt mình (lá nhân vật được chia ra kèm hiệu ứng lật; có nút tạm ẩn để xem bàn). Khi chưa tới lượt chỉ còn 1 dòng chờ.
- Bảng người chơi gọn: mỗi người 1 hàng (tên, nhân vật đã lộ diện, vàng · bài · công trình + thanh tiến độ), thành phố hiển thị bằng ô vuông nhỏ có màu/icon/giá (rê chuột xem chi tiết); Lãnh chúa vẫn bấm ô nhỏ để phá.
- Ô thông tin của mình chuyển vào cột phải (dưới nhật ký); trò chuyện khi đang chơi thu thành nút 💬 trên thanh trên cùng, có số tin chưa đọc, bấm mới mở khung chat. Khay bài chỉ chiếm cột chính, không che cột phải.
- (trước đó) Ô thông tin của mình cố định góc dưới trái: nhân vật vòng này (kèm cảnh báo bị ám sát / bị nhắm trộm), vàng, số lá bài, số công trình + thanh tiến độ, 5 ô màu đã có (thưởng +3), trạng thái lượt ("Lượt bạn: số 8 · đang gọi số 2"). Màn hẹp: thu thành 1 hàng phía trên quạt bài.
- Lượt của người khác: khung hành động thu thành 1 dải trạng thái mỏng (việc vừa làm tô màu theo loại).
- Lượt của mình làm lại giống bảng chọn nhân vật: cửa sổ "Nhận tài nguyên" với 2 lá lựa chọn lớn (kèm gợi ý nên chọn gì), cửa sổ chọn lá giữ sau khi rút, cửa sổ chọn mục tiêu kỹ năng (Sát thủ / Kẻ trộm / Pháp sư) dạng thẻ; nút điều khiển (kỹ năng, thu thuế, Phòng thí nghiệm, Lò rèn, Kết thúc lượt) gom vào thanh góc dưới phải cạnh quạt bài.
- Nhật ký to & rõ hơn: cột phải rộng hơn, cố định khi cuộn, chữ lớn hơn; dòng mới sáng lên vài giây. Mỗi dòng nhật ký có `id` tăng dần từ server.
- Bài trên tay xòe hình quạt ở mép dưới màn hình như cầm bài thật: rê chuột tới lá nào lá đó nhô lên, phóng to, sáng lên, các lá khác tối đi; lá xây được có viền vàng.

### Thay đổi — giao diện lá bài phong cách 2016
- Lá công trình: tranh cảnh vẽ bằng SVG (bầu trời theo màu: hoàng hôn vàng / chạng vạng xanh / buổi sáng / khói lửa đỏ / đêm tím, đồi & thành phố xa riêng cho từng lá), chồng đồng xu thể hiện giá, dải tên giấy da, ngọc màu loại công trình.
- Lá nhân vật: chân dung trong khung vòm có tia sáng, số thứ tự lớn góc trái, ngọc màu (Vua, Giám mục, Thương gia, Lãnh chúa). Minh họa tự vẽ, không dùng tranh gốc của bản 2016.

### Sửa lỗi
- Lá bài / thẻ nhân vật / thẻ lựa chọn bị giật khi rê chuột: không còn dùng `:hover` cho hiệu ứng nhô lên (lá rời khỏi con trỏ → hover bật/tắt liên tục); quạt bài chọn lá theo vị trí ngang cố định; độ nghiêng tính theo vị trí gốc; giữ nguyên trạng thái trỏ khi giao diện vẽ lại; hiệu ứng xuất hiện (cửa sổ, thanh lượt, chat) không chạy lại mỗi lần cập nhật; nút không còn dịch lên khi trỏ.
- Nhãn tên trên bàn 3D bị nhân đôi khi bàn được dựng lại (bắt đầu ván mới / người chơi thay đổi).

### Thay đổi
- Tên bot đổi sang tiếng Anh (Bot Arthur, Bot Merlin, ...).
- Panel xem lại vòng trước thu gọn mặc định, ghi rõ "đã kết thúc" để không bị nhầm là nhân vật của vòng hiện tại.

### Sửa lỗi
- Mô tả dài trên lá công trình bị cắt chữ: lá bài giờ tự cao theo nội dung.
- Thêm test quét toàn bộ ván để đảm bảo không bao giờ lộ nhân vật chưa được gọi.
- Khay bài che đen một phần ô thông tin ở cột phải trên màn hình rộng (bố cục căn giữa): khay bài giờ được đặt theo vị trí đo thật của cột chính (`placeTray`).

### Thêm
- Hình minh họa cho 8 nhân vật và 28 loại công trình (icon game-icons.net, CC BY 3.0, lưu cục bộ trong `public/icons.js`).
- Thông báo lớn giữa màn hình khi sang vòng mới, khi nhân vật lộ diện và khi kết thúc game.
- Hiệu ứng: số vàng tăng/giảm, công trình mới xây xuất hiện, bục vinh danh khi kết thúc.
- Tùy chọn tốc độ bot (Chậm / Vừa / Nhanh), chủ phòng đổi được cả khi đang chơi.
- Unit test luật chơi (`test/`, chạy bằng `node:test`) và quy trình SDLC với agent/skill trong `.claude/`.

### Thay đổi
- Thiết kế lại toàn bộ giao diện: trang chủ, phòng chờ, bàn chơi, lá bài, thẻ nhân vật.
- Bot chơi chậm hơn (mặc định ~1.7 giây mỗi bước, chờ lâu hơn khi nhân vật vừa lộ diện).
- Font tiêu đề chuyển sang Playfair Display để hiển thị đúng tiếng Việt có dấu.
- Server báo lỗi dễ hiểu khi cổng đã bị chiếm.

## [1.0.0] - 2026-10-09

### Thêm
- Phiên bản đầu tiên: chơi Citadels online 2–7 người, phòng chơi, bot, chat, luật cổ điển đầy đủ.
