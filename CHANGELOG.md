# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), version theo [SemVer](https://semver.org/lang/vi/).

## [Unreleased]

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

## [1.1.0] - 2026-10-09

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
