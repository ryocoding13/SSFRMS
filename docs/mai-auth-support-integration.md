# Ghép lại task Ngọc Mai trên main — 23/10/2026

## Task được xác định từ gói ZIP

1. C12: khách gửi hỗ trợ, đọc phản hồi mới nhất, cập nhật yêu cầu và đi tới chi tiết.
2. C12b: tiến trình xử lý, nội dung ban đầu, nhân viên phản hồi, lịch sử và trạng thái; dữ liệu thật từ GET /api/tickets/{id}.
3. C13/C13a–d: xem hồ sơ, đổi tên, đổi mật khẩu, lỗi thiếu dữ liệu/xác nhận sai, chống gửi lặp, giữ dữ liệu khi lỗi.
4. S05: phản hồi không rỗng, xác nhận trước khi lưu, khách đọc lại sau F5.

Nền: origin/main 6d959ae. Tái sử dụng bố cục/icon từ ZIP Ngọc Mai e615dad, ghép lại từng phần thay vì merge toàn nhánh cũ. Bản vá bao gồm các sửa payload/profile của gói C12-C13 trước. Không sửa Figma trong phiên này.

## Giữ phần mới trên main

- StickyHeader và PendingBadge, thông báo khách, polling 30 giây/khi focus.
- /api/ops là endpoint chuẩn cho board và các mutation vận hành; chỉ fallback board khi 404/405.
- RECORD_KEY_RECEIPT, REISSUE_CREDENTIAL và giao diện cấp lại QR/PIN/chìa khóa trên S05.
- Modal xác nhận mutation nhân viên, dữ liệu form giữ khi hủy/thất bại.
- 8 nhóm hỗ trợ; Khác bắt buộc tiêu đề 1–100 ký tự; yêu cầu cấp lại từng loại.
- D26, D27, công thức cọc, gia hạn và toàn bộ kiểm thử sẵn có; quyết định về test tooling đặt D28 để không trùng.

## Nối API

- GET /api/auth/profile khi đăng nhập/khôi phục phiên, loại tên overlay cũ.
- PUT /api/auth/profile chỉ gửi fullName; không gửi phone cũ khiến ghi đè số điện thoại. Response kiểm token/userId trước cập nhật phiên.
- POST /api/auth/change-password nhận currentPassword/newPassword. Hỗ trợ BAD_PASSWORD và thông báo 400 của backend cũ, không kết thúc phiên khi sai mật khẩu.
- GET /api/tickets và GET /api/tickets/{id} lấy lịch sử từ activity_logs. Nếu detail lỗi, báo lỗi rõ, giữ phản hồi đã đọc được và cho retry; 401 không bị giấu.
- POST /api/ops/tickets/{id}/responses lưu phản hồi của nhân viên theo cơ sở; backend đọc/ghi theo quyền đã có.

## Kiểm thử bản cuối

| Kiểm tra | Kết quả |
|---|---|
| FE npm test | 79/79, gồm 76 sẵn có + 3 kiểm thử ghép API/mapper/null board |
| Business | 9/9 |
| SSR | 94 route, gồm C12b và id không tồn tại |
| Playwright giả lập DTO | 14/14 |
| Browser với endpoint/service .NET thật | 10 nhóm |
| Backend .NET/Kestrel/JWT | 54/54 |
| Structure, build FE/BE, init.sh | PASS |

HTTP và browser backend dùng SQLite file riêng, không dùng mock cho endpoint hồ sơ/ticket/staff. GET reservations trả rỗng trong test host để khởi động FE; không chứng minh đặt kho/thanh toán. Kiểm thêm Khác/title thật, S05 modal, C12b sau reload, mật khẩu cũ/mới, quyền sở hữu và viewport 390px. Đã xem ảnh nội bộ C12b desktop và C13 mobile; không đóng gói ảnh kiểm tra.

Playwright của gói Mai dùng DTO giả lập; khi ghép sửa mock theo đường /api/ops chuẩn, bổ sung bấm xác nhận staff và giữ phone khi request không có phone. Không giảm assertion, không xóa các test cũ của main.

## Giới hạn và cách chạy lại

Chưa kết nối SQL Server của nhóm; cần xác nhận trên máy nhóm. Ảnh đính kèm vẫn chỉ lưu tên cục bộ, không thuộc task upload. Không tuyên bố PayOS, thiết bị cửa hay toàn hệ thống đã kiểm thử xong.

Môi trường: .NET SDK 10.0.100, Node 24, Chromium Headless Shell 145. init.sh dùng wrapper dotnet thêm -m:1 do giới hạn tiến trình, không sửa init.sh. Cảnh báo NU1902/NU1903, nullable Board.cs và chunk/font cũ còn; không sửa dependency sản phẩm ngoài phạm vi.

FE: npm ci; npm run check:structure; npm test; npm run test:business; npm run test:render; npm run build. Kiểm UI giả lập: npx playwright install chromium; npm run test:auth-support.

Backend: dotnet build StorageProject.slnx -m:1; dotnet test StorageProject.slnx --no-build -m:1. Browser API thật: xem docs/backend-auth-support.md và tools/AuthSupportBrowserHost. Test host tạo SQLite tạm, không đổi dữ liệu SQL Server thật.
