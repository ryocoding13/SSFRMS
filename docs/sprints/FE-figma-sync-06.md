# Figma–FE Batch06 — Phiên 3, 28/10/2026

## Nền và phạm vi

Tiếp nguyên source Batch05 trên main c1a9b05b67a96972cbf44d039b9acb4e15307781. Đọc lại AGENTS, DECISIONS, feature_list, progress, FRONTEND-MAP, BACKEND-TODO. F40 active/F41 blocked giữ nguyên. Không sửa backend/schema/Figma; không commit/push/PR/merge.

Đối chiếu design context và screenshot trực tiếp D30-13 `1052:13092`, D30-18 `1076:11700`, D30-18b `1076:11827`. Dùng shared UI, font/token, bố cục 2 cột và popup hiện có; không lấy ảnh minh họa biên bản hay tiền/ngày trên Figma làm dữ liệu thật.

## Đã làm

- Khách `units/:id/damage`: xem hạng mục/ảnh biên bản, chọn đồng ý khấu trừ / đề nghị khắc phục / khiếu nại. Ban đầu chưa chọn; đề nghị/khiếu nại cần nội dung. Đính kèm tối đa 5 JPG/PNG, 5 MB/ảnh, kiểm signature trước gửi. Sau gửi xem lại nội dung, chờ cơ sở; không gửi lặp.
- Manager `manager/damage-responses`: danh sách theo cơ sở, chi tiết biên bản/phản hồi, đồng ý cho khắc phục với hạn tương lai hoặc từ chối bắt buộc lý do. Ngày nhập theo giờ Việt Nam và kiểm ngày không tồn tại.
- Khách được cho phép mới báo khắc phục xong, trước hạn; nội dung bắt buộc, ảnh tuỳ chọn. Manager `manager/damage-inspections`: chỉ kiểm khi khách đã báo xong, đạt/chưa đạt đều cần ghi chú. Đạt bỏ đúng khoản khấu trừ này; chưa đạt giữ khấu trừ. Không thu ngoài cọc, không xác nhận đã hoàn tiền hoặc mở QR/PIN.
- Nối điểm vào từ chi tiết kho/tiến độ trả kho và danh sách hợp đồng manager. ID không tồn tại hoặc khác owner/cơ sở hiển thị rỗng, không chọn hồ sơ khác thay thế.
- Pure state machine kiểm role/owner/facility/version/stage/OPEN. Chặn bấm lặp; popup confirm/success/failure dùng chung; lỗi giữ nội dung/tệp. Xung đột/mất mạng/acknowledgement sai buộc tải lại trước gửi tiếp. Request cũ không cập nhật màn/tài khoản mới.
- API adapter dùng endpoint **đề xuất**, không có trên main hiện tại. GET/POST 404/405 báo chưa hỗ trợ, không fallback demo thành công. Receipt phải đúng hồ sơ, owner/cơ sở, version mới và trạng thái mong đợi; PASS cần server trả deduction=0.
- Mô phỏng opt-in có nhãn, lưu hồ sơ riêng và chỉ lưu metadata ảnh, không đồng bộ quyết toán thật. Có seed chờ phản hồi và chờ kiểm tra để kiểm UI; số tiền là preview của từng kịch bản độc lập, không cộng thành quyết toán hợp đồng. Đọc lại version sau kiểm ảnh trước ghi để tránh ghi đè thay đổi xảy ra trong thời gian đọc tệp.
- ReturnPhotoInput được thêm label/required tuỳ chọn; mặc định luồng trả kho vẫn bắt buộc ảnh kho trống.

## Kiểm chứng

- `TZ=Asia/Ho_Chi_Minh npm test`: 122/122, gồm 12 test mới về phân quyền, stage/version/deadline, ảnh, khấu trừ và API receipt/404/clean payload.
- Business 9/9; workflows 12/12; SSR 136 lượt route/scenario + assertions về radio chưa chọn, owner/cơ sở, không gửi lặp và form manager.
- Structure/build/init.sh --fe-only/git diff --check PASS. Patch after-batch05 và main kiểm apply/byte-match với source cuối trên bản export sạch.
- Chưa kiểm browser/visual thực thi, thao tác focus/file picker/reload/cross-tab trên browser; chưa API .NET thật/SQL Server/PayOS. SSR và request stub không thay browser/backend QA. Môi trường trước tải Chromium lỗi archive. Build còn cảnh báo chunk >500KB.

## Backend và điểm tiếp tục

Đọc BACKEND-TODO mục Batch06: server cần triển khai lưu hồ sơ/action/evidence/version, kiểm quyền và bảo đảm transaction khi bỏ deduction; T05/T06/M07 không được chốt khi phản hồi/khắc phục chưa xử lý. FE không thể bảo vệ server hoặc xác nhận việc bỏ deduction thật khi API chưa tồn tại. Luồng hoàn cọc chính thức vẫn là hai bước riêng.

Đã thêm FE cho 3 màn/nhánh D30-13/18/18b; còn 3 màn/nhánh chưa có FE trong danh mục ban đầu: D30-10/16/16b (sự cố cơ sở). Còn 4 phiên: Batch07 sự cố, Batch08 nhân viên/manager, Batch09 vận hành/admin, Batch10 browser/tích hợp.

Bàn giao `after-batch05.patch` cho nền đã có Batch05; hoặc `main.patch` gộp 01–06 cho main c1a9b05. Chỉ áp một patch. Patch cần review/kiểm tích hợp trước khi thành viên tự commit/push/PR/merge.
