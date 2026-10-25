# Hợp đồng BE cần bổ sung — không phải API đã triển khai

FE đã có adapter; 404/405 hiện thông báo chưa hỗ trợ. Cần BE review schema, quyền, dữ liệu và giao dịch trước tích hợp. Không dùng localStorage để quyết toán thật.

| Resource | GET dự kiến | POST action |
|---|---|---|
| discrepancies | /api/ops/discrepancies | REPORT_DISCREPANCY, RESOLVE_DISCREPANCY |
| overdue | /api/ops/overdue-cases | ASSIGN_REMOVAL, RECORD_REMOVAL |
| depositRefunds | /api/ops/deposit-refunds | CONFIRM_DEPOSIT_REFUND |
| counterRenewals | /api/ops/counter-renewals | COLLECT_RENEWAL |
| inquiries | /api/support/inquiries | CREATE_INQUIRY, REPLY_INQUIRY |
| policy | /api/rental-policy | SAVE_RENTAL_POLICY |

POST gửi tới `<GET-path>/actions`, JSON `{action, ...payload}`, trả JSON xác nhận; sau đó FE GET lại. GET danh sách trả mảng trực tiếp; policy trả object `{rate,sections,version,updatedAt}`. Thuộc tính đầy đủ và payload tham khảo `src/features/facility-operations/workflows/workflowModel.js` (fixture/model FE), và các Page gọi `run` trong cùng feature. ID hồ sơ hiện là string. Cần thống nhất DTO thật trước mở API.

Máy chủ phải lọc cơ sở của staff/manager và owner của khách, tự tính tiền theo hợp đồng, kiểm tra transition và chống ghi nhận lặp. Giá trị/role từ FE không là nguồn tin cậy. POST hoàn tiền cần transactionRef; POST biên bản cần id, performedAt, inventory, location, unitStatus (INSPECTION/MAINTENANCE). Hoàn tiền ở đây ghi nhận chuyển khoản thủ công, không gọi ngân hàng.

- POST /api/auth/password-reset/request `{email}`: trả thông báo chung; không lộ tồn tại tài khoản. BE cần gửi email, rate limit, mã có TTL/số lượt thử. `demoCode` chỉ tồn tại trong mock.
- POST /api/auth/password-reset/confirm `{email,code,newPassword}`: mã một lần, kiểm tra TTL, hash mật khẩu, xem xét thu hồi phiên cũ.
- POST /api/renewals/{id}/counter-payment: khách chọn tại quầy cho yêu cầu APPROVED thuộc mình; chưa ghi nhận đã thu/chưa đổi ngày. Mock đã có endpoint; BE thật chưa xác nhận hỗ trợ.
- Chính sách mới: trừ 5% cọc BAN ĐẦU mỗi ngày trễ, cap100%, ngày20 đưa đồ ra ngoài. Ledger FE là bản xem trước, không thay settlement BE. Cần thống nhất ngày hiệu lực/phiên bản và cập nhật BE riêng, không tự áp lại hợp đồng cũ. D27 cũ khác cơ sở tính.
- QR/PIN đã phát cần BE từ chối ngay sau REQUEST_RETURN thành công hoặc hết hạn. FE đã khóa nút/call; chưa chứng minh credential cũ bị backend/thiết bị từ chối. Không có màn thu hồi thủ công.
- Các API giá cơ sở, trạng thái chính sách, báo cáo CSV tái sử dụng businessApi hiện có; vẫn cần kiểm tra với BE thật trước dùng sản xuất.
- GET policy là công khai; POST chỉ OPERATIONS. Chính sách fallback khi GET chưa hỗ trợ được gắn nhãn tài liệu tham khảo, không khẳng định là phiên bản đang áp dụng.
