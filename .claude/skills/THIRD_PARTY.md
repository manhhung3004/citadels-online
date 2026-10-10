# Skill bên thứ ba

Các skill dưới đây được chép nguyên bản từ nguồn gốc (đã rà soát nội dung trước khi thêm). Skill riêng của dự án: `sdlc`, `hotfix`, `release`, `citadels-rules`.

| Skill | Nguồn | Giấy phép |
|---|---|---|
| `frontend-design` | [anthropics/claude-code](https://github.com/anthropics/claude-code/tree/main/plugins/frontend-design) | Anthropic Commercial Terms |
| `design-critique`, `design-system`, `accessibility-review`, `ux-copy`, `design-handoff`, `user-research`, `research-synthesis` | [anthropics/knowledge-work-plugins/design](https://github.com/anthropics/knowledge-work-plugins/tree/main/design) | Apache-2.0 |
| `tailwind-design-system` | [wshobson/agents](https://github.com/wshobson/agents/tree/main/plugins/frontend-mobile-development/skills/tailwind-design-system) | MIT |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | MIT |
| `claude-md-improver` + lệnh `/revise-claude-md` | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/claude-md-management) | Apache-2.0 |
| `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`, `dispatching-parallel-agents`, `subagent-driven-development`, `using-git-worktrees`, `finishing-a-development-branch`, `writing-skills`, `using-superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | MIT |

Đã chỉnh / bỏ khi chép:

- `ui-ux-pro-max`: đổi `${CLAUDE_PLUGIN_ROOT}/.claude/skills/...` thành đường dẫn trong dự án và `python` → `python3` (WSL); bỏ `scripts/tests`.
- Không chép `diagnosing-superpowers` (gom nhật ký phiên để gửi issue lên GitHub của tác giả).
- Không chép các skill khác của ui-ux-pro-max (banner, brand, slides, logo, font chữ) — không liên quan tới game.

Lưu ý khi áp dụng cho dự án này: client là HTML/CSS/JS thuần, **không có Tailwind / build step** (xem `CLAUDE.md`).
Các skill Tailwind/shadcn chỉ dùng phần nguyên tắc (token màu, thang khoảng cách, trạng thái), viết lại bằng CSS biến ở `:root`.
Cập nhật: chạy lại cách tải trong lịch sử phiên hoặc tải tay từ các link trên.
