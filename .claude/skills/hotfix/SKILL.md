---
name: hotfix
description: Quy trình sửa lỗi nhanh nhưng vẫn chuẩn — tái hiện bằng test fail → sửa → xác nhận → review → changelog. Dùng khi người dùng báo bug, dán lỗi/stack trace, hoặc gọi /hotfix.
argument-hint: <mô tả lỗi hoặc stack trace>
---

# Hotfix — Citadels Online

Lỗi: **$ARGUMENTS**

Mọi trao đổi bằng tiếng Việt. Node chạy trong WSL: `wsl -d Ubuntu-24.04 -- bash -lc "cd ~/game && <lệnh>"`.

1. **Chẩn đoán** — đọc code liên quan, xác định nguyên nhân gốc (không chỉ triệu chứng). Nếu lỗi là do môi trường (cổng bị chiếm, thiếu `npm install`...), xử lý môi trường và dừng ở đây — không cần sửa code.
2. **Tái hiện** — giao agent `qa-engineer` viết test trong `test/` tái hiện lỗi; xác nhận test đang FAIL vì đúng lý do.
3. **Sửa** — giao agent `developer`: sửa nhỏ nhất có thể, không refactor kèm theo. Test tái hiện phải chuyển PASS và `npm test` pass toàn bộ.
4. **Review** — giao agent `code-reviewer` review riêng phần sửa (tập trung: sửa đúng nguyên nhân gốc? có hồi quy?).
5. **Ghi nhận** — thêm mục `### Sửa lỗi` vào `CHANGELOG.md` (tạo file nếu chưa có), tăng version patch trong `package.json`.

Báo cáo: nguyên nhân gốc (1–2 câu), file đã sửa, test đã thêm, output `npm test` thật. Chỉ commit khi người dùng yêu cầu.
