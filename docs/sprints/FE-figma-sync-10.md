# Figma–FE Batch10 — Phiên 7,29/10/2026 (Việt Nam)

Tiếp checkpoint Batch09 trên main c1a9b05b67a96972cbf44d039b9acb4e15307781. Gói tải lại có SHA25645698710691ba1348db454770a132b25754082ce88524ea1727149e6dedd688e;143 file khớp source trước sửa. Đọc lại quy định, quyết định và sprint04–09. F40 active/F41 blocked giữ nguyên. Không sửa BE/schema/Figma, không commit/push/PR/merge.

Sửa Modal giữ focus qua rerender, stack bàn phím/Escape/focus/backdrop, lọc Tab control disabled/ẩn, giữ khóa cuộn và khôi phục trigger; giới hạn chiều cao modal. Sửa field date/select Xuất báo cáo co đúng cột tại768px. Thêm playwright.batch10.config.js, test:batch10 và fixture chỉ dùng test/dev, không thêm dependency.

Thực thi Chromium Headless Shell156.0.8078.73:45/45 test mới ở1440/768/390 và14/14 auth-support hiện có; tổng59 ca browser với demo/stub. Có25 route/5 role, sticky/overflow, drawer/popup, lỗi/retry/session, scope FE, atomic không fallback, file input và CSV download. Hai test trên UI.jsx gốc Batch09 tái hiện lỗi, bản sửa đã qua kiểm cuối. FE155/business9/workflow12/SSR173, structure/build/diff đạt; còn warning chunk>500kB. Chi tiết bằng chứng: docs/verification/FE-batch10-browser-2026-10-29.md.

Chưa tích hợp API .NET/SQL Server/PayOS/thiết bị thật: API5151connection refused, môi trường không có runtime/backend/DB cấu hình phù hợp. Atomic role-change, scheduled policy metadata và các API đề xuất/evidence/enforcement consent của các batch trước vẫn blocked theo BACKEND-TODO. Không giả demo/SSR thành tích hợp thật, không tuyên bố hoàn tất hệ thống hay đủ điều kiện merge.

Đã xác minh quan hệ checkpoint04→09 từ patch có thật, nên bàn giao chuỗi7 phiên để thành viên tự review/commit lần lượt; phiên1 kế thừa Batch01–03. Gói10 có incremental sau09 hoặc cumulative từ main, không áp chồng cả hai. Hướng dẫn review/kiểm thử/Git/PowerShell và mô tả từng phiên ở gói bàn giao; chỉ áp chuỗi khi code đúng checkpoint và tree sạch.
