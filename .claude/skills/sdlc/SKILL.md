---
name: sdlc
description: Chạy trọn quy trình SDLC cho một tính năng/thay đổi — Requirements → Design → Implement → Test → Review → Release — bằng các agent chuyên trách, có cổng duyệt của người dùng. Dùng khi người dùng gọi /sdlc hoặc yêu cầu làm tính năng mới "theo quy trình", "chuẩn SDLC".
argument-hint: <mô tả tính năng hoặc thay đổi>
---

# Quy trình SDLC — Citadels Online

Yêu cầu: **$ARGUMENTS**

Bạn là người điều phối. Mỗi giai đoạn giao cho đúng agent trong `.claude/agents/`, truyền đủ ngữ cảnh (đường dẫn đặc tả/thiết kế, kết quả giai đoạn trước) vì agent không thấy cuộc trò chuyện này. Báo tiến độ ngắn gọn cho người dùng sau mỗi giai đoạn. Mọi trao đổi bằng tiếng Việt.

Nếu yêu cầu là sửa một lỗi nhỏ đã rõ nguyên nhân, đề xuất dùng `/hotfix` thay vì quy trình đầy đủ.

## 1. Requirements — agent `business-analyst`

Giao yêu cầu nguyên văn. Nhận về `docs/specs/NNN-<slug>.md` + câu hỏi mở.
- Có câu hỏi mở thật sự cần người dùng quyết → hỏi người dùng (AskUserQuestion), cập nhật đặc tả rồi mới đi tiếp.

## 2. Design — agent `solution-architect`

Giao đường dẫn đặc tả. Nhận về `docs/design/NNN-<slug>.md`.

### 🚦 Cổng duyệt #1
Trình bày cho người dùng: tóm tắt đặc tả (user stories + AC) và thiết kế (file thay đổi, rủi ro). **Chờ người dùng đồng ý** trước khi viết code. Nếu người dùng yêu cầu sửa → quay lại bước 1 hoặc 2.

## 3. Implement — agent `developer`

Nếu đang ở nhánh `main` và repo đã có commit, tạo nhánh `feat/<slug>` trước (tạo nhánh là an toàn; KHÔNG commit). Giao đặc tả + thiết kế. Nhận về danh sách file đã sửa và kết quả `npm test`.

## 4. Test — agent `qa-engineer`

Giao đặc tả + thiết kế + danh sách file đã sửa. Nhận về bảng truy vết AC → test → PASS/FAIL.
- Có FAIL do bug sản phẩm → giao lại `developer` kèm test đang fail và cách tái hiện, rồi chạy lại QA. Tối đa 2 vòng; quá 2 vòng thì dừng và báo người dùng.

## 5. Review — agent `code-reviewer`

Giao đặc tả, thiết kế, danh sách file. Nhận APPROVE / REQUEST CHANGES.
- REQUEST CHANGES với mục Critical/Major → `developer` sửa → `qa-engineer` chạy lại test → `code-reviewer` review lại. Tối đa 2 vòng.
- Mục Minor: liệt kê cho người dùng, không bắt buộc sửa.

Có thể chạy song song review với skill có sẵn `/security-review` nếu thay đổi đụng tới socket/input người dùng.

## 6. Release — agent `release-manager`

Cập nhật CHANGELOG, version, README; chuẩn bị commit message + mô tả PR.

### 🚦 Cổng duyệt #2
Trình bày kết quả cuối: tính năng làm gì, AC nào đã đạt (kèm kết quả test thật), phát hiện review còn lại, version mới, commit message đề xuất. **Chỉ commit/push/tạo PR khi người dùng đồng ý rõ ràng.**

## Nguyên tắc

- Không bỏ qua giai đoạn nào trừ khi người dùng yêu cầu. Nếu bỏ qua, nói rõ đã bỏ qua gì.
- Báo cáo trung thực: test fail thì nói fail, kèm output.
- Giữ phạm vi: ý tưởng mới phát sinh ghi vào mục "Đề xuất sau" thay vì làm luôn.
