# Backend hồ sơ tài khoản và phản hồi hỗ trợ

Bản này tách hai luồng C13 và S05/C12 từ phần Ngọc Mai trên nền main fc83c3aed71f50bb97b43afa9319264638222e7b. Phạm vi gồm API, DTO, xử lý nghiệp vụ và test. Không kèm frontend, phí trả kho S04/M07, huỷ đơn C14, chính sách phí hay migration mới.

## C13

- GET và PUT `/api/auth/profile` đọc và sửa người dùng từ claim của phiên hiện tại.
- Tên sau khi trim cần từ 2 đến 100 ký tự; tên sai trả HTTP 400.
- POST `/api/auth/change-password` kiểm tra mật khẩu hiện tại bằng BCrypt, mật khẩu mới có ít nhất 8 ký tự và khác mật khẩu hiện tại. Sai mật khẩu hiện tại trả HTTP 400, không làm frontend hiểu thành hết phiên.
- Không nhận userId do client tự chọn để cập nhật hồ sơ tài khoản khác.

## S05 và C12

- POST `/api/tickets/` kiểm hợp đồng thuộc khách, ô kho khớp hợp đồng, tiêu đề, mô tả và mức ưu tiên trước khi lưu.
- Các mã giao diện ACCESS, ITEMS, SCHEDULE được ánh xạ vào mã SQL Server hiện có. ACCESS_CODE và ACCESS_CARD đều tiếp tục hợp lệ; ưu tiên trống dùng NORMAL.
- GET `/api/staff/board` đọc ticket theo cơ sở của hợp đồng, kể cả ticket cũ thiếu UnitId. Nếu dữ liệu cũ có liên kết ô sai thì hợp đồng quyết định phạm vi cơ sở.
- Board trả trạng thái IN_PROGRESS cho ASSIGNED, WAITING_CUSTOMER cho RESOLVED và DONE cho trạng thái đã đóng. Ghi chú dùng staff, text, at để khớp màn hình đang có.
- POST `/api/staff/tickets/{id}/responses` dùng chung xử lý kiểm tra cơ sở, trạng thái, ghi nội dung và audit. API tương thích `/api/ops` cũng xác định cơ sở theo hợp đồng.
- GET `/api/tickets/{id}` trả responses gồm message, staffName, createdAt, chỉ cho chủ ticket đọc. Chỉ lấy nhật ký TICKET_RESPONSE của đúng ticket, bỏ qua bản ghi JSON cũ bị hỏng.

## Kiểm chứng

Build backend và 34 test đạt trên .NET SDK 10.0.402. Trong đó 15 test đã có ở main và 19 trường hợp AuthSupport mới. Database trong test là SQLite, sử dụng check constraint từ model hiện có.

Các kiểm tra bao phủ mật khẩu cũ bị từ chối sau đổi, tên được lưu đúng tài khoản, chủ đề ticket hợp lệ, dữ liệu cũ thiếu/sai UnitId, trạng thái RESOLVED, tên trường ghi chú, phản hồi theo thứ tự và từ chối tài khoản thuộc cơ sở khác.

Người dùng đã báo kiểm thử thủ công C13 và S05/C12 đạt trên máy Windows trước khi tách nhánh. Bản tách riêng này vẫn cần nhóm chạy lại trên SQL Server của nhóm trước khi merge. Không đưa cấu hình riêng vào commit; không chạy reset database. Không cần cập nhật schema cho hai luồng này.

Frontend, thư viện và luồng tiền được giữ ở phiên bản main. Những sửa giao diện đang nằm trong thư mục làm việc của người dùng tiếp tục được giữ riêng ở đó.
