# Figma–FE Batch05 — Phiên 2, 28/10/2026

## Nền và phạm vi

Main đọc lại c1a9b05b67a96972cbf44d039b9acb4e15307781, tiếp toàn bộ source Batch04 chưa commit. Đã đọc AGENTS/DECISIONS/feature_list/progress/BACKEND-TODO và target code; F40 active/F41 blocked giữ nguyên. Không sửa backend/schema/Figma; không commit/push/PR/merge.

Dùng design context + screenshot trực tiếp: C04a `1095:12148`, C15b `1079:12031`, C15 `1047:12344`. Reuse UI/Photo/token/font trong repo; ảnh cơ sở/ảnh kho đúng mapping D06, file thật có bytes. Không chép số tiền, tên khách, mốc ngày hay version minh họa từ Figma.

## Đã làm

- C03b tạo đơn → `checkout/:id/confirm` (C04a). Tóm tắt thông tin/tiền từ đơn, đọc chính sách bằng tab riêng, checkbox ban đầu chưa chọn, lưu bằng action provider rồi mới mở C04. Double-click đang lưu bị chặn; rời màn/đổi đơn không điều hướng muộn từ request cũ.
- API T20 hiện có: đọc lại policy trước POST, kiểm bản hiện hành không đổi; gửi policyVersion số và accepted=true. Kiểm consentId/customerId/version/server timestamp/channel. Lỗi/thiếu acknowledgement không mở thanh toán. Không tự POST khi trang mở.
- Guard cả provider QR và trả tại quầy. Mở URL C04 trực tiếp khi thiếu consent quay lại C04a. LocalProvider cũng chặn direct service/action; demo lưu snapshot policy theo version.
- C15/C15b: 2 tab, chọn hợp đồng/hồ sơ gia hạn, đọc đúng version cũ bằng endpoint đang có. Chặn stale response khi đổi nguồn/version; không dùng policy mặc định để che API lỗi. Lỗi có retry, thiếu evidence báo rõ, user chưa đăng nhập/chưa hợp đồng/ID lạ có trạng thái riêng.
- Bằng chứng gia hạn có trên RenewalDto được hiển thị riêng. `policyConsent` ban đầu trên contract còn thiếu DTO server: FE hỗ trợ field optional nhưng hiện không giả dữ liệu. Cache server acknowledgement theo đơn chỉ phục vụ checkout; không nâng thành evidence gốc của hợp đồng.
- C15b không dùng câu trên Figma mâu thuẫn phạm vi D32. Chỉ thể hiện nội dung đã đồng ý và ghi rõ phạm vi áp dụng theo quy định đang hiệu lực. Không thay đổi chính sách nghiệp vụ.
- Mock T20 opt-in có current/version/consent DTO, kiểm owner/version/accepted và server timestamp; không thêm fallback API thật thành mock thành công.

## Kiểm chứng

- `TZ=Asia/Ho_Chi_Minh npm test`: 110/110 (7 test mới: policy đổi, evidence sai/thiếu, snapshot, mapper/cache, DTO và HTTP mock owner/version/server time).
- Business 9/9; workflows 12/12; structure PASS; SSR 122 route + assertions và gọi LocalProvider thật qua test probe (thiếu consent QR/quầy bị chặn, policy đổi buộc xác nhận lại).
- Build PASS; init.sh --fe-only PASS; git diff --check PASS; patch after-batch04 và gộp main apply/byte-match trên bản export sạch.
- Chưa kiểm browser/visual thực thi, focus/file picker/click, API .NET thật/SQL Server/PayOS/thu quầy thật. Môi trường trước không tải được Chromium; không thay SSR cho browser QA. Build còn chunk >500KB.
- Bộ HTTP mock chỉ kiểm giao diện/hợp đồng DTO; không phải bằng chứng backend thực đã bảo vệ giao dịch bằng consent.

## Blocker cần BE xử lý

`BACKEND-TODO.md` mục Batch05: đọc lại consent gốc trên Reservation/Contract; server kiểm consent trước PayOS/thu tiền mặt; idempotency/retry; dữ liệu version/seed/SQL Server. Main hiện ghi consent nhưng chưa có đầy đủ read/enforcement kể trên. Không khẳng định T20 toàn luồng đã xong.

## Điểm tiếp tục

Đã có giao diện cho C04a/C15b; C15b evidence gốc còn blocked bởi BE. Còn 6 màn/nhánh chưa có FE trong danh mục cũ: D30-13/18/18b và D30-10/16/16b. Phiên tiếp theo Batch06 là hư hỏng/khắc phục; không làm lại C04a từ đầu. Còn 5 phiên trong kế hoạch 7 phiên, gồm phiên kiểm browser/tích hợp cuối.

Bàn giao một patch `after-batch04.patch` khi đã có Batch04; hoặc `main.patch` gộp 01–05 trên main c1a9b05. Chỉ dùng một patch và kiểm trước khi áp dụng.
