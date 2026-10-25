# Đồng bộ FE với Figma đã duyệt ngày 25/10/2026

## Mục tiêu
Hoàn thiện các màn mới cho 5 vai trò trên main c5aa79a, kể cả khi backend chưa có endpoint tương ứng.

## Phạm vi
- Giữ các API, route và dữ liệu thật hiện có; bổ sung route/màn đối soát, quá hạn, hoàn cọc, chính sách, lịch sử và phản hồi.
- Các luồng mới chưa có BE chỉ dùng dữ liệu mẫu khi chủ động chạy `npm run dev:demo`; có nhãn mô phỏng. API thường không fallback thành công.
- Dùng UI/token hiện có; bố cục thẻ từng khách, thao tác bên phải; chi tiết nhãn trên giá trị.
- Cập nhật bản đồ, hợp đồng API dự kiến, kiểm thử và bàn giao ZIP/patch. Không commit/push/PR/merge.

## Nguồn
Figma SX8EvOf1TJkxfMl90bZsGN: 828:10226, 938:11237, 928:10905 và các nhóm Main đã duyệt trong cuộc trò chuyện.
Quyết định người dùng: hết hạn/yêu cầu trả kho thành công thì QR tắt; khấu trừ 5% cọc gốc/ngày, tối đa 100%, sau 20 ngày nhân viên đưa đồ ra ngoài.

## Kiểm chứng
check:structure, npm test, test:business, test:render, build, init --fe-only, trình duyệt desktop/mobile với mock. Không xác nhận SQL Server/PayOS thật hoặc BE chưa triển khai. Không nâng feature sang passing thay thành viên phụ trách.
