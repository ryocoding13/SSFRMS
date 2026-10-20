# Kiểm tra bản sửa thanh toán và trạng thái ô kho

Nguồn main: 242f70158d4299da4c5206181ba52389461b0fa3. Xem D23–D24. Gói này không triển khai thanh toán gia hạn, phí trả kho, phản hồi ticket hay tự động hoàn tiền.

## Thay đổi API

- POST `/api/reservations/{id}/pay-at-facility`: JWT chủ đơn, đơn chưa thanh toán/còn hạn; trả 200 sau khi chuyển PENDING_AT_FACILITY. Nếu PayOS huỷ link thất bại thì trả 400 và giữ phương thức cũ. Gọi lại cùng lựa chọn trả 200.
- POST `/api/staff/payments/{id}/confirm`: JWT STAFF/MANAGER đúng cơ sở, xác nhận đã thu tiền mặt. Chỉ nhận đơn AT_FACILITY chưa hết hạn; gọi lại cùng khoản đã thu trả 200, không thêm tiền. `/api/ops/payments/{id}/confirm` dùng chung xử lý.
- POST `/api/manager/allocations/{id}`: đơn đã thu đủ hoặc chờ thu tại kho, ô đúng cơ sở/loại/còn trống. Tạo đúng một hợp đồng nháp; gắn khoản thu có sẵn. `/api/ops/allocations/{id}` dùng chung xử lý.
- PUT `/api/staff/units/{id}/status`: `{ "status": "MAINTENANCE", "reason": "Sửa cửa" }`. Lý do bắt buộc, chỉ chuyển trạng thái vận hành thủ công, ghi lịch sử. Khoá ô qua API manager cũng đi qua quy tắc này.
- ReservationDto và ReservationDetailDto thêm `paymentMethod`. PaymentDto.ContractId có thể null trước khi phân bổ; các endpoint trả thanh toán của hợp đồng vẫn gắn hợp đồng như trước.
- Chữ ký webhook được kiểm bằng SDK PayOS 2.1.0; không có API bỏ qua chữ ký. Fake gateway chỉ nằm trong project test, không đăng ký ở chương trình chạy thật.

## Chạy kiểm chứng

Từ thư mục có StorageProject.slnx:

```powershell
dotnet restore
dotnet build StorageProject.slnx -m:1
dotnet test StorageProject.slnx -m:1
dotnet run --project StorageProject.Api --launch-profile http
```

BE tự chạy migration mới ReservationPaymentIntegrity khi khởi động. Không reset database. Cần .NET SDK 10, SQL Server, tài khoản có quyền cập nhật schema và connection string đúng trên máy bạn. Các cảnh báo NU1902/NU1903 về dependency đã tồn tại từ bản nguồn, không được coi là build error.

Ở terminal khác:

```powershell
cd SafeSpace-Customer-UI\SafeSpace-Customer-UI
npm ci
npm test
npm run test:render
npm run test:business
npm run build
npm run dev
```

## Kịch bản bắt buộc trên SQL Server và PayOS thật

1. Tạo đơn, tạo QR PayOS. Kiểm số tiền bằng tiền thuê + cọc trong DB. Đổi amount trong request tạo QR phải bị từ chối.
2. Trả đúng tiền. Sau webhook: đơn CONFIRMED, bảng payments có RENT + DEPOSIT (bỏ qua dòng giá trị 0), chưa tự gán ô. Gửi lại chính thông báo có chữ ký đó: không thêm payments và không thêm phân bổ.
3. Gửi chữ ký sai, đúng chữ ký nhưng sai tiền hoặc orderCode không có: không xác nhận, không ghi payments. Muốn kiểm sai tiền có chữ ký hợp lệ phải dùng giao dịch test/fixture hợp lệ, không sửa payload đã ký rồi coi đó là kiểm số tiền.
4. Quản lý phân bổ đúng loại kho ở M05: có một assignment, một hợp đồng DRAFT. PaymentId trước và sau phân bổ giữ nguyên. Bấm lại không tạo hợp đồng/thu thêm; chọn ô khác khi đã phân bổ bị chặn.
5. Đơn khác chọn trả tại kho: link PayOS cũ phải được huỷ/không tồn tại; đăng nhập lại hoặc trình duyệt khác vẫn thấy chọn trả tại kho. S09 chỉ hiện đơn chờ thu tại kho. M05 phân bổ được, nhưng S03 không bàn giao khi chưa thu tiền.
6. Nhân viên thực thu và xác nhận S09; bấm hai lần: chỉ hai khoản RENT/DEPOSIT, tổng đúng. Xác minh khách rồi bàn giao được.
7. Kiểm PayOS thanh toán đến muộn sau khi chọn/trả tại kho: không thêm khoản thu thuê; activity_logs có PAYMENT_REVIEW_REQUIRED. Webhook gửi lại không thêm log trùng. Quản lý đối chiếu và hoàn thủ công, đây không phải lệnh tự hoàn của PayOS.
8. Chạy đồng thời hai request xác nhận tiền, hoặc hai quản lý phân bổ cùng một ô: SQL Server chỉ cho một kết quả; request còn lại trả kết quả cũ hoặc lỗi, không ghi trùng. Các test SQLite không thay thế kiểm khoá SQL Server này.
9. Với đơn trả tại kho chưa thu trên DB phát triển, đặt ExpiresAt về quá khứ, đợi worker tối đa một phút: EXPIRED, assignment/hợp đồng nháp CANCELLED, ô AVAILABLE. Không sửa ngày của dữ liệu thật để thử.
10. M02 đổi ô trống sang bảo trì rồi mở lại, nhập lý do: DB có lịch sử old/new/actor/reason/time. Bỏ lý do, đổi ô đang thuê thành trống, đổi ô đã giữ sang bảo trì đều bị chặn.
11. Token khác cơ sở không thu/phân bổ/sửa ô được; CUSTOMER không gọi được API staff.
12. Thử migration trên bản sao DB đang có dữ liệu và DB mới. So sánh số dòng/khoản thu trước sau; không có khoản tiền tự sinh cho đơn cũ thiếu payments.

## SQL đối chiếu

```sql
SELECT ReservationId, ContractId, PaymentType, Amount, PaymentMethod, TransactionReference, Status
FROM payments WHERE ReservationId = <reservation_id> ORDER BY PaymentId;
SELECT ReservationId, PaymentType, COUNT(*) AS RowCount
FROM payments WHERE ReservationId IS NOT NULL AND PaymentType IN ('RENT','DEPOSIT')
GROUP BY ReservationId, PaymentType HAVING COUNT(*) > 1;
SELECT * FROM activity_logs WHERE Action = 'PAYMENT_REVIEW_REQUIRED' ORDER BY LoggedAt DESC;
SELECT * FROM unit_status_history ORDER BY ChangedAt DESC;
```

Các đơn PENDING_VERIFICATION đời cũ không được tự coi là tiền mặt đã thu. Đơn cũ có PaidAt nhưng thiếu payments cần thành viên nhóm đối chiếu, không tự tạo tiền chỉ để qua điều kiện bàn giao. Gói này cũng không sửa các lỗi riêng của quy trình trả kho/hoàn cọc đã được liệt kê ở lần rà soát trước.
