---
name: release
description: Chuẩn bị phát hành phiên bản mới — chạy test, kiểm tra server, cập nhật CHANGELOG/version/README, soạn commit & PR. Dùng khi người dùng gọi /release hoặc muốn "chốt phiên bản", "release", "chuẩn bị deploy".
argument-hint: "[patch|minor|major]"
disable-model-invocation: true
---

# Release — Citadels Online

Mức tăng version yêu cầu: **$ARGUMENTS** (bỏ trống → tự suy ra từ thay đổi).

Giao agent `release-manager` chạy checklist phát hành, truyền kèm:
- mức tăng version ở trên,
- danh sách đặc tả trong `docs/specs/` có trạng thái chưa phải `Done`,
- `git log` / `git status` hiện tại.

Sau đó trình bày cho người dùng: checklist ✔/✘, version mới, nội dung CHANGELOG, commit message + mô tả PR đề xuất. Nếu checklist có mục ✘ → dừng, báo lý do, không đề xuất commit.

Chỉ thực hiện `git commit`, `git tag`, `git push` hoặc tạo PR khi người dùng đồng ý rõ ràng.

## Gợi ý deploy (khi người dùng hỏi)

Cần nền tảng hỗ trợ WebSocket và tiến trình Node chạy lâu: Render, Railway, Fly.io, VPS (pm2 + nginx). Phòng chơi lưu in-memory → chỉ chạy 1 instance; restart sẽ mất phòng đang chơi.
