# Kiểm thử hai task Ngọc Mai — 23/10/2026

Nền: main `6d959aef4b54e4e9558e2db772fd1d50dda85c13`.
Phạm vi: khách đọc phản hồi C12/S05; đổi tên và mật khẩu C13.

## Kết quả

| Kiểm tra | Kết quả |
|---|---|
| .NET build | PASS, 0 lỗi biên dịch |
| .NET test | 54/54 PASS, gồm 2 HTTP integration mới |
| npm test | 76/76 PASS |
| npm run test:business | 9/9 PASS |
| npm run test:render | 92 route PASS |
| npm run check:structure | PASS |
| npm run build | PASS |
| init.sh | PASS, wrapper dotnet thêm -m:1 trong môi trường kiểm thử |
| Browser Chromium Headless Shell 145 | 10 nhóm PASS |
| git diff --check | PASS |

## Browser gọi backend thật

- C13 tải hồ sơ qua GET profile khi đăng nhập.
- Tên rỗng bị chặn; PUT tên hợp lệ lưu và giữ khi tải lại.
- Mật khẩu xác nhận sai bị chặn ở FE; mật khẩu hiện tại sai trả 400 BAD_PASSWORD, hiện đúng ô, giữ phiên.
- POST change-password mang đúng currentPassword/newPassword; sau đổi mật khẩu cũ không đăng nhập được, mật khẩu mới đăng nhập được.
- Tên overlay cũ không che tên trong database.
- Mạng lỗi khi lưu tên không báo thành công và giữ phần đang nhập.
- C12 gửi ticket từ UI qua API.
- Staff đúng cơ sở thấy ticket, quay lại từ xác nhận giữ nội dung; xác nhận lưu thì khách thấy phản hồi sau reload.
- Hai phản hồi được giữ và xem lịch sử; hỗ trợ ở viewport 390 × 844 không tràn ngang.
- Tài khoản khách khác giữ hồ sơ riêng, không thấy ticket/phản hồi của khách đầu. Không có pageerror.

## HTTP/JWT

Test AuthSupportHttpTests gọi endpoint .NET thật qua Kestrel với JWT thật; SQLite tạm có constraint model, mỗi fixture database riêng. Kiểm 401 khi không có token, 400 tên/mật khẩu sai, lưu tên không đổi số điện thoại, hồ sơ khách khác không đổi; ticket sai chủ trả 404, staff sai cơ sở không thấy và không phản hồi được. Phản hồi được đọc lại bằng request/phiên đăng nhập mới.

## Giới hạn

Không có kết nối SQL Server của nhóm trong môi trường này; chưa xác nhận dữ liệu, migration hay cấu hình thực tế trên máy nhóm. Host browser không phải server triển khai: dùng endpoint/service thật cho phạm vi này, SQLite riêng, GET reservations trả trống để khởi động FE. Các kết quả trên không xác nhận PayOS, hoàn cọc hoặc toàn bộ nghiệp vụ khác.

Cảnh báo có sẵn: NU1902/NU1903 cho System.Security.Cryptography.Pkcs 9.0.11, nullable trong Board.cs, đường dẫn font và chunk frontend lớn. Các cảnh báo này không được giấu hoặc đổi thành PASS an toàn bảo mật.

Xem docs/backend-auth-support.md để chạy lại. ZIP không có cấu hình bí mật hoặc node_modules/bin/obj. Nếu áp dụng patch vào repo đang dùng, giữ nguyên cấu hình local của bạn.


Bản ghép tiếp theo với giao diện Mai: xem `docs/mai-auth-support-integration.md`. Kết quả mới 79 FE, 94 route, 14 Playwright giả lập và 10 nhóm browser API thật; backend 54. Báo cáo phía trên ghi mốc gói C12-C13 ban đầu.
