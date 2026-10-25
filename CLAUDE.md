# 🚨 MANDATORY PRE-FLIGHT PROTOCOL — BẮT BUỘC TRƯỚC KHI CODE

**CRITICAL INSTRUCTION FOR ALL AI AGENTS:** You are **STRICTLY FORBIDDEN** from writing, modifying, or suggesting any code until you complete the Pre-Flight Check below using file-reading tools.

## Step 1 — Mandatory Context Loading
Before answering any implementation, bug-fixing, or business-logic task, you **MUST** open and read with tools in the current turn:
1. `DECISIONS.md`: latest business rules, especially D21, D26, D27, subsequent replacements and Out-of-Scope items.
2. `feature_list.json`: exact related feature IDs and current states. Read the actual IDs present; do not assume the list stops at F38.
3. `progress.md`: recent changes and evidence, to avoid breaking completed flows.
4. `SafeSpace-Customer-UI/SafeSpace-Customer-UI/BACKEND-TODO.md` when touching API/backend: exact JSON contracts and endpoints. This is the actual repository path of `BACKEND-TODO.md`.
Also open existing target files before claiming their paths or modifying them. For new files, verify the parent directory and label them as new.

## Step 2 — Mandatory Output Receipt
At the very beginning of the first user-facing response after reading, before explanations or code, output this block filled with real evidence:

> **[PRE-FLIGHT CHECK]**
> - **Files Read:** (Exact repository paths opened with tools in this turn.)
> - **Active Decisions Applied:** (Specific IDs and relevant rules; account for newer decisions that replace older ones.)
> - **Related Feature ID:** (Actual IDs and current states from feature_list.json; for process-only documentation, say not applicable and do not invent a feature.)
> - **Files to Modify:** (Verified exact paths; explicitly mark proposed new files.)

**STOP RULE:** If `DECISIONS.md` has not been read with a tool in the current turn, **STOP IMMEDIATELY** and read it first. Prior chat memory, earlier-session reads, guessed paths, line numbers or business rules do not satisfy this check. Do not claim to have read a missing or unreadable file; report the blocker.

## 🚫 Anti-Rationalization Table
| Nếu AI định nghĩ rằng… | Quy tắc bắt buộc phản bác lại |
| --- | --- |
| “Task nhỏ, sửa UI chút thôi không cần đọc DECISIONS.md.” | **SAI.** UI gắn với nghiệp vụ, D26 bỏ bàn giao kích hoạt, D27 và các quyết định thay thế quy định cọc/hoàn tiền. Bắt buộc đọc. |
| “Tôi nhớ nội dung từ các câu chat trước rồi.” | **SAI.** File có thể vừa được cập nhật; bắt buộc đọc lại bằng tool trong lượt hiện tại. |
| “Build/test SQLite pass nghĩa là hoàn thành 100%.” | **SAI.** Không xác nhận hoàn thành toàn bộ khi chưa kiểm SQL Server thật và luồng API thực tế; ghi rõ môi trường, giới hạn và phần chưa kiểm chứng. |
| “Plan cũ có bàn giao kích hoạt nên tôi code lại.” | **SAI.** Tài liệu cũ mâu thuẫn với quyết định mới có hiệu lực không được dùng để khôi phục luồng đã bỏ. |
| “Tự in receipt là đủ, không cần đọc file.” | **SAI.** Receipt chỉ ghi bằng chứng thực sự đọc được qua tool; không được bịa ID, trạng thái hoặc đường dẫn. |

Yêu cầu này bổ sung các quy định dưới đây, không thay quy định bảo vệ dữ liệu, kiểm thử, nhánh riêng hoặc việc thành viên tự commit/push/PR/merge. Quyết định mới được người dùng chốt phải ghi mục thay thế trong DECISIONS.md trước khi triển khai; không xoá lịch sử hoặc tự suy ra nghiệp vụ.

---

# CLAUDE.md

Hướng dẫn cho Claude Code. Toàn bộ quy tắc nằm trong `AGENTS.md` để dùng chung với Cursor, Copilot, Codex.

@AGENTS.md
