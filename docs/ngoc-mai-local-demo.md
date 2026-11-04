# Chạy local và demo quên mật khẩu qua email

Mỗi thành viên chạy backend và frontend trên máy riêng. Email hệ thống gửi thư là
`safespace.swp391@gmail.com`. Khách dùng email của tài khoản SafeSpace đã đăng ký
trong database; khách không nhập mật khẩu Gmail.

## Chuẩn bị lần đầu

1. Cài Git, .NET **SDK 10** và Node.js **từ 22.12 trở lên**. Sau khi cài, đóng/mở lại
   VS Code để terminal nhận PATH. Kiểm tra `git --version`, `dotnet --list-sdks`, `node -v`, `npm.cmd -v`.
2. Có SQL Server đang chạy và kết nối được bằng SSMS. `SQL Server (MSSQLSERVER)`
   thường dùng `localhost`; `SQL Server (SQLEXPRESS)` thường dùng `.\SQLEXPRESS`.
   Nếu dùng máy chủ nhóm, nhập đúng tên/IP và phương thức đăng nhập của nhóm.
3. Tài khoản SQL phải có quyền với database demo, gồm quyền áp dụng migration khi
   `Database:AutoMigrate=true`. Startup sẽ chạy migration đang chờ; kiểm tra đúng
   database trước khi chạy. Không xóa/reset database để sửa lỗi kết nối.
4. Người phụ trách Gmail bật xác minh 2 bước và cấp mật khẩu ứng dụng 16 ký tự cho
   máy demo: <https://myaccount.google.com/apppasswords>. Không dùng mật khẩu đăng nhập Google.
   Nhận mật khẩu qua kênh riêng của nhóm; không đưa vào source hoặc PR.

Sau khi PR được merge, lấy code lần đầu vào thư mục mới:

```powershell
git clone --branch main https://github.com/ryocoding13/SSFRMS.git SSFRMS_Demo
cd SSFRMS_Demo
node scripts/mai-demo/local-demo.cjs setup
```

Trước khi PR merge, dùng nhánh feature được ghi trong `manifest.json` của gói bàn giao:

```powershell
git clone --branch TEN_NHANH_FEATURE https://github.com/ryocoding13/SSFRMS.git SSFRMS_Demo
cd SSFRMS_Demo
node scripts/mai-demo/local-demo.cjs setup
```

Thay `TEN_NHANH_FEATURE` bằng tên nhánh thật đã push, không nhập nguyên chữ mẫu.
Script dừng sớm nếu repo chưa có API quên mật khẩu, SDK thiếu hoặc cài dependencies lỗi.
Nhập SQL Server, database và tài khoản SQL (Enter để dùng Windows Authentication).
Sau đó nhập mật khẩu ứng dụng Gmail ở chế độ ẩn. Nếu máy đã lưu những giá trị này
thì script giữ lại, không hỏi lại và không tạo lại HashKey.

SQL, mật khẩu SMTP và HashKey được lưu trong **user-secrets** của API trên từng máy;
không ghi vào file được commit. Script đọc cấu hình này khi chạy Development.
Cấu hình Gmail dùng SMTP/TLS `smtp.gmail.com:587`, `StartTls`.

Lệnh setup kiểm tra SDK, lưu cấu hình, kiểm tra TCP tới SMTP, restore/build backend,
cài frontend bằng lockfile, kiểm cấu trúc và build frontend. TCP thông chỉ chứng minh
kết nối mạng, chưa chứng minh đăng nhập Gmail hoặc thư đã đến hộp thư.

## Mỗi lần demo

Từ gốc repo, chạy đúng một lệnh:

```powershell
node scripts/mai-demo/local-demo.cjs start
```

Script chạy backend, chờ `/health/ready` trả 200 (SQL/migration sẵn sàng), rồi chạy frontend
ở cổng 5173 và mở `http://127.0.0.1:5173/#/reset-password`.
Frontend dùng API thật `http://localhost:5151`, tắt chế độ workflow demo.
Giữ terminal đang chạy; nhấn Ctrl+C để dừng các tiến trình do script mở.
Script không tự kill tiến trình khác đang dùng cổng 5151/5173.

Nếu cần chạy thủ công bằng hai terminal:

```powershell
# Terminal 1: gốc repo
dotnet run --project StorageProject.Api --launch-profile http
```

```powershell
# Terminal 2: gốc repo
cd SafeSpace-Customer-UI\SafeSpace-Customer-UI
$env:VITE_USE_API = 'true'
$env:VITE_API_URL = 'http://localhost:5151'
$env:VITE_WORKFLOW_DEMO = 'false'
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

## Kiểm chứng lần đầu trên từng máy

1. Đăng ký hoặc dùng tài khoản có email thật trong **đúng database đang kết nối**.
   Tài khoản phải ACTIVE, email khớp duy nhất. Email seed dạng `@storage.vn`/`example.com`
   không phải hộp thư thật để kiểm thử. Không sửa dữ liệu trực tiếp để bỏ qua điều kiện.
2. Bấm gửi mã; kiểm tra hộp thư và thư rác. Phản hồi API chung không chứng minh đã gửi
   thư nếu email chưa đăng ký. Chờ ít nhất 60 giây trước khi gửi lại.
3. Nhập mã còn hạn, đặt mật khẩu SafeSpace mới: ít nhất 8 ký tự, tối đa 72 byte UTF-8,
   khác mật khẩu cũ; mã chỉ dùng một lần, hạn 10 phút, khóa sau 5 lần sai.
4. Kiểm tra mật khẩu mới đăng nhập được, mật khẩu cũ bị từ chối, mã đã dùng không dùng lại.
5. Ghi máy, SQL/database, thời gian và kết quả; không ghi OTP, mật khẩu hoặc HashKey.

Ngày 04/11/2026, người dùng xác nhận đã demo thành công trên `SSFRMS_Demo`.
Đây là bằng chứng do người dùng báo; không thay việc kiểm trên máy thành viên khác,
bộ SQL Integration đầy đủ, nâng cấp DB có dữ liệu hoặc mọi luồng T05/T06/T19.

## Đổi cấu hình sau này

```powershell
# Chỉ hỏi lại SQL; giữ mật khẩu SMTP và HashKey hiện có.
node scripts/mai-demo/local-demo.cjs setup --sql

# Chỉ hỏi lại mật khẩu ứng dụng Gmail; giữ SQL và HashKey.
node scripts/mai-demo/local-demo.cjs setup --mail
```

Sau khi pull có đổi dependencies, chạy `setup` lại để cài đúng lockfile; các bí mật
đã lưu vẫn được giữ. Không chạy khối lệnh tạo HashKey mới mỗi lần demo.

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
|---|---|
| `dotnet`/`npm` không nhận diện | Cài SDK/Node, mở lại VS Code; dùng `npm.cmd` trong PowerShell |
| SQL error 26 | Kiểm tra dịch vụ SQL, tên instance/SSMS; chạy setup `--sql` |
| Backend chưa ready | Đọc lỗi backend phía trên: SQL, quyền, database, migration; không reset DB |
| Cổng đang dùng | Dừng phiên demo cũ bằng Ctrl+C; không chạy thêm backend/frontend song song |
| Không đến được SMTP:587 | Kiểm tra mạng/firewall/proxy/VPN; không tắt TLS để vượt lỗi |
| API báo chưa gửi mã/503 | Kiểm tra mật khẩu ứng dụng đúng Gmail SafeSpace bằng setup `--mail`; đọc lỗi backend |
| API nhận yêu cầu nhưng không có thư | Kiểm tra email ACTIVE/duy nhất trong đúng DB và thư rác; 200 không đủ chứng minh gửi |
| 429 hoặc gửi lại bị chặn | Chờ cooldown/giới hạn; không bỏ rate limit để demo |
| UI còn dùng dữ liệu giả/URL ngrok cũ | Chạy lệnh `start`; script ép URL localhost và API thật cho phiên đó |

Nguồn cấu hình: Microsoft user-secrets
<https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets?view=aspnetcore-10.0>
và Google App Passwords <https://support.google.com/accounts/answer/185833?hl=vi>.
