# Hoàn thiện phần Ngọc Mai — bản khôi phục gói tải 30/10/2026

Nền main efc0c4097f09f1aa02942ee5a9398614ab0ffdb1, giữ PR #55 và D31–D34; D35 triển khai phạm vi người dùng đã yêu cầu. Gói cũ không còn truy cập được nên dựng lại phần bàn giao. Không cam kết ZIP khớp byte với liên kết cũ. Không sửa appsettings/PayOS, không commit/push/PR/merge.

## Phạm vi

| Phần | Kết quả |
|---|---|
| Quên mật khẩu | SMTP MailKit/TLS; OTP 6 số/10 phút/1 lần/5 lần sai; HMAC, giới hạn gửi; đổi BCrypt và đóng phiên cũ. FE chống gửi trùng/countdown/lỗi giữ form. |
| T05 | Giữ phí/ảnh của PR55; route staff cũ delegate cùng service chuẩn, không bỏ qua phí/lý do/ảnh/phạm vi. |
| T06 | Không Debt, trừ tối đa cọc; PAID phần bù cọc, CANCELLED phần miễn có audit; không giữ chờ thu, bảo toàn RENT/RENEWAL. Mã tham chiếu không trùng. |
| T07/T08 | Giữ PR55, chạy lại D32RefundEvidenceTests: hoàn 2 bước/ảnh/chính chủ/phạm vi/version. |
| T18/C12/C13 | Giữ code có sẵn; EmailLoginTests, AuthSupportHttpTests chạy lại trong bộ Tests. |
| T19 | Inquiry DB/API; khách của mình và cơ sở hiện hành; conversation OPEN/WAITING_CUSTOMER/CLOSED; UUID/version; FE kiểm receipt và giữ popup thành công. |

## Kiểm chứng bản khôi phục

- Test BE 142/142, không skip, qua VSTest; SQLite/Kestrel/JWT và SMTP TCP loopback. Không phải SQL Server nhóm.
- NuGet có nhiều request timeout trong lần khôi phục. Đã biên dịch lại toàn bộ Core/Infrastructure/Api/Tests/IntegrationTests bằng compiler SDK 10 và dependency đúng phiên bản giữ từ bản build trước, có source generators của SDK. Không sửa csproj/giả package metadata/đổi version để né lỗi. Đây là kiểm biên dịch offline; **chưa xác nhận lại dotnet restore/build theo project trong lần khôi phục**. Người nhận phải chạy các lệnh chuẩn bên dưới trên máy/CI.
- FE: TZ=Asia/Ho_Chi_Minh, 155/155, business9/9, workflows12/12, render173, structure/build đạt. Test FE có 3 ca phụ thuộc timezone hệ điều hành; lần đầu môi trường America/Los_Angeles trượt, chạy timezone Việt Nam đạt; không sửa/nới test. Bundle >500 kB còn.
- Model drift đạt. Migration mới `20261030150136_AddMaiPasswordResetInquiriesAndFeeWaiver` tạo 3 bảng và mở constraint payment. Sinh SQL idempotent qua EF Core design/migrator; không sửa migration cũ hoặc reset DB. Up không UPDATE/DELETE dữ liệu nghiệp vụ.
- Browser reset và tư vấn được kiểm riêng với API .NET/Kestrel/JWT thật và SQLite tạm; không chứng minh Gmail/SQL nhóm. Host inquiry chỉ stub danh sách reservations rỗng để bootstrap app; mọi thao tác tư vấn gọi endpoint/service thật. OTP browser đọc qua stdin/stdout mailbox test, không có HTTP route lấy mã trong sản phẩm.
- SQL strict còn bị chặn do không kết nối SQL Server; không gọi trường hợp thiếu SQL là PASS. PowerShell Windows, hộp thư thật, DB nhóm, PayOS/thiết bị thật chưa nghiệm thu. Feature không tự passing.

## Lệnh kiểm chuẩn trên máy

Ở gốc repo:

```powershell
dotnet restore StorageProject.slnx
dotnet build StorageProject.slnx -m:1
dotnet test StorageProject.Tests -m:1
dotnet tool restore
dotnet ef migrations has-pending-model-changes --project StorageProject.Infrastructure --startup-project StorageProject.Api
```

FE và browser:

```powershell
$ui='SafeSpace-Customer-UI/SafeSpace-Customer-UI'
npm.cmd --prefix $ui ci
npm.cmd --prefix $ui run check:structure
npm.cmd --prefix $ui test
npm.cmd --prefix $ui run test:business
npm.cmd --prefix $ui run test:workflows
npm.cmd --prefix $ui run test:render
npm.cmd --prefix $ui run build
dotnet build tools/PasswordResetBrowserHost -m:1
Push-Location $ui
npx.cmd playwright install chromium
npm.cmd run test:password-reset:backend
npm.cmd run test:inquiries:backend
Pop-Location
```

Cần cổng test5178/5180 trống. Browser host chỉ loopback, dữ liệu thử riêng.

## SQL Server nhóm và thư thật

1. Giữ cấu hình connection string do nhóm cấp, hoặc nhập chuỗi riêng qua user-secrets; không commit mật khẩu DB. Cấu hình SMTP theo `docs/password-reset-email.md`.
2. Người quản lý DB đọc SQL/backup theo quy trình trước khi nâng cấp. Không tạo lại migration AddRefundEvidenceAndIncidents, không chạy Down trên DB chung (Down xoá 3 bảng mới).

```powershell
dotnet ef database update --project StorageProject.Infrastructure --startup-project StorageProject.Api
dotnet run --project StorageProject.Api --launch-profile http
```

Terminal thứ hai ở gốc repo:

```powershell
$env:VITE_USE_API='true'
$env:VITE_API_URL='http://localhost:5151'
npm.cmd run dev:frontend
```

Mở http://127.0.0.1:5173/#/reset-password, thử tài khoản có email thật do bạn kiểm soát (seed example.com không nhận thư). Kiểm hộp thư/Spam, đổi mật khẩu, login cũ thất bại/login mới đúng, token cũ bị từ chối. Kiểm tư vấn ở #/inquiries và #/staff/inquiries, đổi khách/cơ sở, reload đọc lại. Kiểm trả kho trên hợp đồng thử được nhóm chuẩn bị. Không tác động dữ liệu thật của người khác.

## SQL gate

Fixture tạo database `SSFRMS_CI_<guid>` riêng trên SQL instance và xoá DB thử sau test. Dùng tài khoản thử được nhóm cấp quyền tạo/xoá DB thử, không tài khoản production. App dùng connection string riêng, gate dùng SSFRMS_TEST_CONNECTION_STRING của môi trường CI/thử.

```powershell
$env:REQUIRE_SQLSERVER='true'
dotnet test StorageProject.IntegrationTests -m:1
```

Có test OTP confirm đồng thời một lần, inquiry cùng version một lần và UUID replay. Các hợp đồng đã đóng trước bản vá không tự được dọn phí; nhóm cần rà riêng. Cần thành viên review và nghiệm thu SQL/mail trước merge.
