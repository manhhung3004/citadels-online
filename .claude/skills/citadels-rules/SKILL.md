---
name: citadels-rules
description: Luật chơi Citadels (bản 2016) như được cài đặt trong dự án này — nhân vật, cách chọn nhân vật theo số người, lượt chơi, công trình tím, tính điểm, các điểm đơn giản hóa. Dùng khi phân tích, thiết kế, code, test hoặc review bất cứ thứ gì liên quan luật chơi, hoặc khi người dùng hỏi về luật.
user-invocable: false
---

# Luật Citadels trong dự án

Nguồn sự thật là code `server/game.js` + `server/cards.js`. Tài liệu này tóm tắt để tra cứu nhanh; nếu lệch với code, tin code và báo lại sự sai lệch.

## Chuẩn bị
- 2–7 người. Mỗi người 2 vàng, 4 lá công trình. Vương miện (👑) trao ngẫu nhiên.
- Chồng bài 68 lá: 54 lá thường (Vàng/Quý tộc 12, Xanh dương/Tôn giáo 11, Xanh lá/Thương mại 20, Đỏ/Quân sự 11) + 14 công trình tím rút ngẫu nhiên từ kho 24 loại (`UNIQUES` trong `server/cards.js`, `UNIQUE_PER_GAME`).
- Kết thúc khi có người có `citySize` ≥ `target` (mặc định **7** theo bản 2016; phòng chọn được 8). `citySize` = số công trình, Đài kỷ niệm tính là 2. Chơi hết vòng đó.

## Chọn nhân vật (mỗi vòng, bắt đầu từ người giữ 👑)
- Luôn úp 1 lá ngẫu nhiên ra ngoài.
- Bộ nhân vật do chủ phòng chọn (`options.chars`, kiểm tra bằng `castProblem` trong `cards.js`): mỗi số 1–8 một nhân vật, số 9 tùy chọn (cần ≥ 4 người; bắt buộc khi 8 người). Hoàng hậu cần ≥ 5 người; Hoàng đế không dùng khi 2 người. Engine: `Game.cast` (số → key), `maxRank` (8 hoặc 9).
- Lật ngửa loại thêm (8 nhân vật): 4 người → 2 lá; 5 người → 1 lá; 6–7 người → 0. (9 nhân vật): 4 → 3; 5 → 2; 6 → 1; 7–8 → 0. **Nhân vật số 4 không bao giờ bị lật ngửa.**
- 2 người: A chọn 1 → B chọn 1 + úp bỏ 1 → A chọn 1 + úp bỏ 1 → B chọn 1 + úp bỏ 1. Mỗi người 2 nhân vật.
- 3 người: chọn vòng tròn 2 lượt, mỗi người 2 nhân vật; lá cuối bỏ.
- 7–8 người: người chọn cuối (chỉ còn 1 lá) được chọn giữa lá còn lại và lá úp ban đầu.

## Lượt chơi (gọi nhân vật 1 → 8, hoặc 9)
1. Nhân vật không ai chọn / bị ám sát → bỏ qua (bị ám sát chỉ lộ diện cuối vòng).
2. Khi lộ diện: nếu là mục tiêu của Kẻ trộm → toàn bộ vàng chuyển cho Kẻ trộm.
3. Hành động bắt buộc: **lấy 2 vàng** (Mỏ vàng: 3) HOẶC **rút 2 lá giữ 1** (Đài thiên văn: rút 3; Thư viện: giữ tất cả).
4. Xây tối đa 1 công trình (Kiến trúc sư: 3; Chuồng ngựa không tính) sau khi đã hành động; trả vàng = giá (Xưởng thủ công: tím khác −1); không trùng tên trừ khi có Mỏ đá; Kho bí mật không xây được; Đài kỷ niệm chỉ xây khi < 5 công trình. Quy tắc nằm ở `Game.buildBlock` / `buildCost`.
5. Kỹ năng nhân vật dùng 1 lần, bất kỳ lúc nào trong lượt. Thu thuế: tự động khi kết thúc lượt nếu quên. Cuối lượt: Nhà tế bần (+1 vàng nếu hết vàng), Công viên (+2 lá nếu hết bài).

## Nhân vật
| # | Tên | Kỹ năng |
|---|-----|---------|
| 1 | Sát thủ | Ám sát nhân vật 2–8; nhân vật đó mất lượt. |
| 2 | Kẻ trộm | Nhắm nhân vật 3–8 (trừ nhân vật bị ám sát); lấy hết vàng khi họ lộ diện. |
| 3 | Pháp sư | Đổi toàn bộ bài với 1 người, HOẶC bỏ N lá xuống đáy chồng và rút N lá. |
| 4 | Vua | Nhận 👑 ngay khi lộ diện (bị ám sát vẫn nhận cuối vòng). +1 vàng/công trình vàng. |
| 5 | Giám mục | Lãnh chúa không phá được công trình của người này (trừ khi Giám mục bị ám sát). +1 vàng/công trình xanh dương. |
| 6 | Thương gia | +1 vàng khi lộ diện. +1 vàng/công trình xanh lá. |
| 7 | Kiến trúc sư | +2 lá khi lộ diện. Xây tối đa 3. |
| 8 | Lãnh chúa | +1 vàng/công trình đỏ. Phá 1 công trình: trả (giá − 1); không phá được thành phố đã hoàn thành, Thành lũy, hay công trình của Giám mục. |

### Nhân vật thay thế (bản 2016) — kỹ năng switch theo `turn.key` trong `Game.ability`
| # | Tên (key) | Kỹ năng / cách cài |
|---|-----|---------|
| 1 | Phù thủy (witch) | Sau khi nhận tài nguyên, yểm 1 nhân vật rồi kết thúc lượt. Nhân vật đó: chủ chỉ nhận tài nguyên (`turn.bewitched`), sau đó Phù thủy chơi tiếp (`turn.witched`, `afterResources`). Vua/Nguyên lão bị yểm: chủ vẫn nhận 👑. |
| 1 | Thẩm phán (magistrate) | 3 lệnh bắt (`warrants.ranks`), 1 có chữ ký (chỉ Thẩm phán thấy). Công trình đầu tiên nhân vật bị lệnh thật xây → tự tịch thu, hoàn vàng (đơn giản hóa: luôn tịch thu khi được). |
| 2 | Gián điệp (spy) | Chọn người + màu; mỗi lá đúng màu: lấy 1 vàng (nếu còn) + rút 1 lá; Gián điệp thấy bài (`turn.spied`). |
| 2 | Kẻ tống tiền (blackmailer) | 2 thư (`threats`), 1 thật. Người bị đe dọa nhận tài nguyên xong phải `threat {pay}`: trả nửa vàng, hoặc từ chối (thật → mất hết). Không nhắm số 1/bị ám sát/bị yểm. |
| 3 | Thầy phép (wizard) | Xem bài 1 người (`turn.peek`), `wizardTake {cardId, build}`: lấy về tay hoặc xây ngay (không tính giới hạn, được trùng tên cả lượt). |
| 3 | Nhà tiên tri (seer) | Lấy ngẫu nhiên 1 lá mỗi người, rồi `give` trả mỗi người 1 lá (`turn.seerGive`). Xây tối đa 2. |
| 4 | Hoàng đế (emperor) | +1 vàng/vàng. Bắt buộc trao 👑 cho người khác (không phải người đang giữ); họ đưa 1 vàng (hết vàng → 1 lá). Bị ám sát: cuối vòng tự trao cho người kế bên, không nhận gì. |
| 4 | Nguyên lão (patrician) | Nhận 👑 như Vua. Thu thuế bằng **lá bài**. |
| 5 | Tu viện trưởng (abbot) | Thu thuế chọn vàng/bài (`income {gold}`). Kỹ năng: người giàu nhất đưa 1 vàng (nếu mình không giàu nhất). |
| 5 | Hồng y (cardinal) | Thu thuế bằng lá. Thiếu vàng xây → lấy từ người giàu nhất đủ vàng, trả bằng các lá rẻ nhất (`buildInfo().borrow`). |
| 6 | Nhà giả kim (alchemist) | Cuối lượt hoàn lại vàng đã trả để xây (`turn.spent`). |
| 6 | Lái buôn (trader) | +1 vàng/xanh lá; xây xanh lá không tính giới hạn. |
| 7 | Nhà hàng hải (navigator) | +4 vàng hoặc +4 lá; không được xây (`maxBuilds` 0). |
| 7 | Học giả (scholar) | Rút 7 giữ 1, xáo phần còn lại vào chồng (`turn.shuffleRest`). Xây tối đa 2. |
| 8 | Nhà ngoại giao (diplomat) | +1 vàng/đỏ. Đổi công trình (`swapCost`): trả chênh lệch (+Tường thành lớn); không với thành phố đã hoàn thành của người khác, Giám mục, Thành lũy, không tạo trùng tên. |
| 8 | Thống chế (marshal) | +1 vàng/đỏ. Lấy công trình giá ≤ 3 của người khác, trả giá cho chủ (`seizeCost`). |
| 9 | Hoàng hậu (queen) | Ngồi cạnh người cầm số 4: +3 vàng (số 4 bị ám sát → nhận cuối vòng). |
| 9 | Nghệ sĩ (artist) | Trang trí ≤ 2 công trình của mình: 1 vàng/công trình, `card.beauty` = +1 giá trị (`Game.value`). |
| 9 | Người thu thuế (taxcollector) | Mỗi lần xây, chủ công trình nộp 1 vàng vào `taxPool` (trừ Người thu thuế đã lộ diện); lộ diện → lấy hết. |

## Công trình tím
Hỗ trợ: Chuồng ngựa · Thành lũy (không bị phá) · Đài thiên văn (rút 3) · Đài kỷ niệm · Nhà tế bần · Phòng thí nghiệm (bỏ 1 lá → +2 vàng/lượt) · Lò rèn (2 vàng → 3 lá/lượt) · Mỏ đá · Xưởng thủ công · Thư viện · Trường phép thuật (màu bất kỳ khi thu thuế) · Tường thành lớn (phá công trình khác của chủ nó tốn thêm 1) · Mỏ vàng · Công viên.
Tính điểm cuối game: Khu phố ma (màu bất kỳ) · Tượng đài (+5 nếu giữ vương miện) · Đại giáo đường (+1/công trình giá lẻ) · Kho bạc hoàng gia (+1/vàng) · Phòng bản đồ (+1/lá trên tay) · Giếng ước (+1/công trình tím) · Tháp ngà (+5 nếu là công trình tím duy nhất) · Điện Capitol (+3 nếu ≥3 cùng màu) · Cổng Rồng (+2) · Kho bí mật (+3 nếu còn trên tay, không xây được).
Chưa cài: Hang trộm, Giàn giáo, Kho vũ khí, Nghĩa trang, Bảo tàng, Nhà hát.

## Tính điểm
Tổng giá công trình · +3 đủ 5 màu · điểm thưởng công trình tím (`scoreOf().extras`) · +4 người hoàn thành đầu tiên · +2 người hoàn thành khác. Hòa điểm: ai có nhân vật số lớn nhất (không bị ám sát) ở vòng cuối thắng.

## Điểm đơn giản hóa so với bản giấy
- Kiến trúc sư nhận 2 lá ngay đầu lượt.
- Bài bỏ/bị phá đặt xuống đáy chồng (không xáo lại).
- Thông tin công khai trong log: mục tiêu của Sát thủ và Kẻ trộm (theo nhân vật, như khi đọc to ở bàn thật).

## Chế độ bộ nhân vật (phòng chờ)
- 🎲 Ngẫu nhiên mỗi ván (mặc định, bí mật) · ✋ Tự chọn (công khai) · 🌲 **Luật rừng NNHP**: mỗi vòng rút lại bộ nhân vật (mỗi số ngẫu nhiên 1 trong 3, `randomCast` nên luôn hợp lệ với số người), bí mật; đầu mỗi vòng quên kiến thức vòng trước (`publicRanks`, `seen`). Kho thuế giữ qua các vòng kể cả vòng không có Người thu thuế.

## Luật thêm của bản online: giới hạn thời gian
- Mỗi bước của người thật (1 lần chọn / bỏ nhân vật, 1 lượt chơi) có 90 giây (`TURN_TIME` ghi đè khi test); bot không bị tính giờ.
- Hết giờ (`Game.timeout(pi)`): đang chọn nhân vật → chọn / bỏ ngẫu nhiên; trong lượt → mất lượt (không tài nguyên, không thu theo màu, không xây). Việc dở dang: giữ lá vừa rút, Tiên tri trả đủ bài, Thầy phép không lấy lá, thư đe dọa coi như từ chối, Hoàng đế trao vương miện ngẫu nhiên không nhận cống, bị yểm bùa → Phù thủy tiếp quản. Hiệu ứng tự động (thưởng Thương gia / Kiến trúc sư, kho thuế, cuối lượt như Nhà tế bần) vẫn diễn ra.
