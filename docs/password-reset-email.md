# Quên mật khẩu qua email

Bản triển khai F43 theo D35, nền main efc0c40. Giữ màn `#/reset-password` và hai endpoint đã được frontend gọi sẵn. Thành viên tự review, commit/push và tạo PR.

## Cài trên Windows

1. Áp dụng bản vá trên nhánh riêng, kiểm diff. Cần .NET SDK 10, Node >= 22.12 và SQL Server đang chạy với connection string hiện có.
2. Dùng một Gmail của nhóm để gửi thư. Bật xác minh hai bước và tạo mật khẩu ứng dụng tại https://myaccount.google.com/apppasswords. Một số tài khoản trường/công ty không cho tạo; dùng Gmail cá nhân hoặc SMTP do quản trị cấp. Không dùng mật khẩu đăng nhập Gmail thông thường.
3. Từ PowerShell tại gốc repo:

```powershell
dotnet restore StorageProject.slnx
.\scripts\configure-password-reset.ps1
dotnet tool restore
dotnet ef database update --project StorageProject.Infrastructure --startup-project StorageProject.Api
dotnet run --project StorageProject.Api --launch-profile http
```

Script hỏi email người gửi và mật khẩu ứng dụng, tạo HashKey ngẫu nhiên và lưu bằng .NET user-secrets trên máy. Không đưa vào repo. User-secrets được nạp khi chạy Development (profile http); không dùng `dotnet user-secrets list` trong ảnh chụp chia sẻ vì sẽ hiện bí mật. Lần chạy lại giữ HashKey đã có.

Ở terminal thứ hai:

```powershell
$env:VITE_USE_API = 'true'
$env:VITE_API_URL = 'http://localhost:5151'
npm.cmd --prefix SafeSpace-Customer-UI/SafeSpace-Customer-UI ci
npm.cmd run dev:frontend
```

Mở http://127.0.0.1:5173/#/reset-password. Nhập **email đang lưu trong tài khoản ở database**; email này là người nhận, có thể khác Gmail dùng gửi. Tài khoản seed `@example.com` không có hộp thư thật; muốn nghiệm thu cần một tài khoản thử có email thật mà bạn kiểm soát. Đăng ký tài khoản thử từ màn đăng ký rồi dùng đúng email đó. Không cần sửa/xóa dữ liệu nhóm.

Migration mới `20261030150136_AddMaiPasswordResetInquiriesAndFeeWaiver` tạo 3 bảng reset/inquiries/replies và thêm CANCELLED cho payment; không sửa migration cũ, không reset DB hoặc dọn hợp đồng đã đóng. Backup theo quy trình nhóm trước khi nâng cấp database dùng chung. Development có thể tự migrate khi khởi động, nhưng lệnh EF ở trên giúp xem lỗi rõ trước khi chạy.

## SMTP khác và triển khai

Cấu hình backend qua biến môi trường: `Smtp__Host`, `Smtp__Port`, `Smtp__Security` (`StartTls` cổng 587 hoặc `SslOnConnect` cổng 465), `Smtp__Username`, `Smtp__Password`, `Smtp__FromEmail`, `PasswordReset__HashKey` (chuỗi ngẫu nhiên ít nhất 32 ký tự). Các instance phải dùng cùng HashKey và database. Không đưa vào `VITE_*`. Máy test SMTP loopback được phép `Security=None`; máy SMTP từ xa luôn bắt buộc TLS và thông tin đăng nhập. Không bỏ kiểm chứng chứng chỉ.

## Hành vi

- Gửi mã: 6 chữ số ngẫu nhiên mật mã, HMAC lưu DB, có hạn 10 phút. Gửi lại ít nhất 60 giây, tối đa 5 email/tài khoản trong một giờ. Yêu cầu trong thời gian chờ trả thông báo chung nhưng không phát hành mã mới. Gửi lại thành công huỷ mã cũ. SMTP lỗi trả 503; mã cũ vẫn giữ nếu đang có hiệu lực.
- Xác nhận: email/mã/mật khẩu mới. Mã sai, hết hạn, dùng lại, tài khoản bị khoá hoặc password/email đã đổi đều bị từ chối. Mỗi mã tối đa 5 lần sai. Mật khẩu tối thiểu 8 ký tự, tối đa 72 byte UTF-8, khác mật khẩu cũ; khoảng trắng được giữ.
- Đổi thành công: lưu BCrypt, dùng mã và kết thúc các phiên cũ trong cùng giao dịch. Phải đăng nhập lại, không tự cấp token. Token JWT được đối chiếu login history khi sử dụng; logout và reset khiến phiên bị từ chối. Login và reset dùng cùng khoá DB để tránh phiên mới được tạo bằng mật khẩu cũ trong lúc reset.
- Chỉ ACTIVE và email khớp duy nhất được khôi phục; không thay vai trò/trạng thái. Gửi tới email không tồn tại hoặc bị khoá vẫn trả thông báo chung, không gửi thư. Không có endpoint lấy OTP và không log mã/mật khẩu. Lỗi SMTP trả thông báo chung không chứa thông tin nhà cung cấp.
- IP giới hạn riêng: request 10/10 phút, confirm 30/10 phút; 429 có JSON và Retry-After. Giới hạn IP theo RAM của từng instance; cần gateway limiter chung nếu triển khai nhiều replica. SQL Server dùng sp_getapplock trong giao dịch Serializable để giới hạn theo tài khoản và tránh dùng lại mã đồng thời.
- Phản hồi và nội dung lỗi không nêu tài khoản tồn tại. SMTP được gửi đồng bộ, nên thời gian đáp ứng có thể khác giữa email hợp lệ/không tồn tại. Nếu triển khai công khai ở quy mô lớn, nên chuyển gửi thư sang hàng đợi bền vững để giảm chênh lệch thời gian và tránh giữ khoá DB trong lúc chờ SMTP.

## Kiểm tra trên máy nhóm

1. Đăng nhập tài khoản thử, giữ một tab đã đăng nhập. Mở tab khác chọn Quên mật khẩu.
2. Gửi mã tới email thật; kiểm tra hộp thư và Spam. Response/console/log không được chứa mã; mã chỉ nằm trong thư.
3. Nhập mã sai: báo lỗi, giữ form. Mã đúng + mật khẩu xác nhận không khớp: FE chặn.
4. Mã đúng + mật khẩu mới: thành công; mật khẩu cũ không đăng nhập được, mật khẩu mới đăng nhập đúng tài khoản. Tab dùng token cũ bị 401 khi gọi API bảo vệ.
5. Mã đã dùng không đổi lần hai. Sau 10 phút mã hết hạn. Sau 60 giây gửi lại thì chỉ mã mới dùng được. Thử sai đủ 5 lần phải xin mã mới.
6. Tắt/sửa sai SMTP trên môi trường thử: gửi mã báo lỗi, không hiện thành công. Không chỉnh SMTP của máy chung đang phục vụ người khác.
7. Kiểm SQL Server với dữ liệu thử và đọc lại bảng User/PasswordResetChallenge/LoginHistory. Ghi commit, môi trường, email nhận, thời điểm và kết quả; không chụp mật khẩu ứng dụng hoặc OTP còn hiệu lực.

## Nguồn triển khai

- Microsoft: https://learn.microsoft.com/en-us/dotnet/api/system.net.mail.smtpclient
- MailKit: https://mimekit.net/docs/html/M_MailKit_Net_Smtp_SmtpClient_ConnectAsync_2.htm
- Google: https://support.google.com/accounts/answer/185833
- OWASP: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html

Bằng chứng chạy tự động và giới hạn cụ thể ghi trong `progress.md`. Test SMTP loopback không chứng minh thư đã đến Gmail; SQLite không thay nghiệm thu SQL Server nhóm.

## Lệnh kiểm thử bổ sung

```powershell
dotnet test StorageProject.Tests -m:1
dotnet build tools/PasswordResetBrowserHost -m:1
cd SafeSpace-Customer-UI/SafeSpace-Customer-UI
npm.cmd run test:password-reset:backend
```

Script browser cần Chromium của Playwright (`npx playwright install chromium`) và `dotnet` trên PATH. Dùng `DOTNET_EXECUTABLE` hoặc `PLAYWRIGHT_EXECUTABLE_PATH` nếu binary ở vị trí riêng. Host test chỉ bind loopback, dùng DB tạm và mailbox riêng; OTP đọc qua stdin/stdout của tiến trình test, không có route lấy mã trong backend sản phẩm.

SQL Server CI dùng database thử riêng do fixture tạo, cần tài khoản có quyền tạo/xóa database thử; không đặt connection string vào mã nguồn:

```powershell
$env:REQUIRE_SQLSERVER = 'true'
# Đặt SSFRMS_TEST_CONNECTION_STRING trong môi trường máy kiểm thử theo hướng dẫn CI của nhóm.
dotnet test StorageProject.IntegrationTests -m:1 --filter FullyQualifiedName~PasswordResetSqlServerTests
```

Không chạy fixture này bằng tài khoản/DB production. Test có chủ đích thử xác nhận đồng thời và chỉ cho một yêu cầu thành công; thiếu SQL Server phải báo lỗi, không bỏ REQUIRE_SQLSERVER để ghi nhận pass.

## PowerShell chặn script chưa ký

Không cần đổi ExecutionPolicy. Với lần cấu hình đầu, dán trực tiếp khối sau vào terminal tại gốc repo. Gmail đã bật xác minh 2 bước, dùng mật khẩu ứng dụng. Không chạy lại khối tạo HashKey này khi còn mã có hiệu lực; script `scripts/configure-password-reset.ps1` có thêm phần giữ HashKey cũ.

```powershell
$emailGui=(Read-Host 'Gmail của nhóm dùng gửi mã').Trim()
$matKhauAn=Read-Host 'Mật khẩu ứng dụng Gmail' -AsSecureString
$conTro=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($matKhauAn)
try {
    $matKhauUngDung=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($conTro).Replace(' ','')
    if ($matKhauUngDung.Length -ne 16) { throw 'Mật khẩu ứng dụng cần đủ 16 ký tự.' }
    $ngauNhien=New-Object byte[] 32
    $boSinh=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $boSinh.GetBytes($ngauNhien) } finally { $boSinh.Dispose() }
    $cauHinh=@{
        'Smtp:Host'='smtp.gmail.com';'Smtp:Port'='587';'Smtp:Security'='StartTls'
        'Smtp:Username'=$emailGui;'Smtp:FromEmail'=$emailGui;'Smtp:Password'=$matKhauUngDung
        'PasswordReset:HashKey'=[Convert]::ToBase64String($ngauNhien)
    } | ConvertTo-Json -Compress
    $cauHinh | dotnet user-secrets set --project StorageProject.Api
    if ($LASTEXITCODE -ne 0) { throw 'Không lưu được cấu hình.' }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($conTro)
    $matKhauUngDung=$null;$cauHinh=$null
}
```
