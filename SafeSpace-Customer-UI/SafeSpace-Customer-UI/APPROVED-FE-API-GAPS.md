# Hợp đồng BE cần bổ sung — không phải API đã triển khai

> Cập nhật 07/11/2026: các resource dưới đây đều đã có trên BE (`overdue-cases`, `deposit-refunds`, `counter-renewals`, `support/inquiries`, `rental-policy`). Đã bỏ `discrepancies` (D42 gỡ báo cáo sai lệch) và `damage-cases` (D48 gỡ màn hư hỏng cũ). Phần còn lại giữ làm lịch sử hợp đồng FE–BE.

## Bổ sung 30/10/2026 — F43 / D35

Giữ API/cờ T05/T07/T08/T13 của PR #55 trên main efc0c40. Phần mới:

- Reset: POST `/api/auth/password-reset/request` `{email}` → `{message,retryAfterSeconds,expiresInSeconds}`; POST `/confirm` cùng prefix `{email,code,newPassword}` → `{message}`. Anonymous; 400 input/mã, 429 + Retry-After khi giới hạn IP, 503 khi SMTP/cấu hình lỗi. Mã 6 số/10 phút/1 lần/5 lần sai; gửi lại ≥60 giây, tối đa 5 thư/tài khoản/giờ. Chỉ lưu HMAC; không trả/log OTP. Đổi xong đóng phiên cũ. SMTP qua MailKit/TLS cần cấu hình của nhóm.
- T06: không Debt, tổng trừ ≤cọc; PAID đúng phần bù cọc, CANCELLED phần miễn và audit RETURN_FEE_WAIVED. Không giữ phí trả kho PENDING/FAILED sau chốt; không sửa RENT/RENEWAL hoặc tự quét hợp đồng đã đóng.
- Route T05 cũ `/api/staff/returns/{inspectionId}/inspection` dùng cùng service chuẩn ops. Cần damageFee, cleaningRequired rõ ràng; items/walls/keys/proposal, damageItem/feeReason/photos theo điều kiện của route chuẩn. Không âm thầm hoàn tất khi thiếu phí/ảnh.
- T19: GET `/api/support/inquiries` trả mảng, GET `/{id}` trả item. CUSTOMER của mình; STAFF/MANAGER đúng phân công hiện hành, không yêu cầu hợp đồng. POST `/api/support/inquiries/actions` CREATE_INQUIRY `{facilityId,title,description,clientRequestId}` hoặc REPLY_INQUIRY `{id,note,close,expectedVersion,clientRequestId}`; phải có action trong body. POST trực tiếp `/api/support/inquiries` cũng tạo mới.
- T19 response `{item}` gồm id TV-0001, ownerId, facilityId, customer, title, description, status, version, createdAt, responses `[{by,text,at,authorId}]`. clientRequestId UUID không rỗng bắt buộc; expectedVersion bắt buộc khi reply. Cùng UUID/nội dung trả kết quả cũ, khác nội dung/version cũ 409; sai phạm vi 404, quyền/phân công 403, thiếu phiên 401, input 400. Title 1–100, nội dung 1–1000, trim server. OPEN → WAITING_CUSTOMER khi cơ sở trả lời → OPEN khi khách trả lời; chỉ cơ sở đóng CLOSED khi trả lời. Closed không ghi tiếp. Cơ sở inactive không nhận yêu cầu mới.
- Migration mới `20261030150136_AddMaiPasswordResetInquiriesAndFeeWaiver`: 3 bảng reset/inquiries/replies và thêm CANCELLED cho payment. Không sửa migration cũ, không tạo lại AddRefundEvidenceAndIncidents.
- Chưa nghiệm thu SQL Server nhóm/hộp thư thật. Chi tiết: `docs/mai-completion-2026-10-30.md`, `docs/password-reset-email.md`.


FE đã có adapter; 404/405 hiện thông báo chưa hỗ trợ. Cần BE review schema, quyền, dữ liệu và giao dịch trước tích hợp. Không dùng localStorage để quyết toán thật.

| Resource | GET dự kiến | POST action |
|---|---|---|
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
