# Frontend C12 và C13 của Ngọc Mai

Gói nối frontend tiếp sau backend `feature/ngoc-mai-auth-support` (13 file backend đã được người dùng push và chạy 34/34 test). Nền giao diện là main `fc83c3a`. Không kèm phí trả kho S04/M07, huỷ đơn C14 hoặc migration. Giữ các thay đổi đang làm dở trong thư mục SSFRMS cũ.

## Phần đã nối

- C13: đọc GET `/api/auth/profile` khi đăng nhập/tải lại; tên và số điện thoại đến từ hồ sơ máy chủ. PUT dùng tên đã trim và giữ nguyên số điện thoại. Cập nhật đúng session hiện tại bằng ref, loại tên overlay cũ; response đến trễ của tài khoản trước không thay tài khoản sau.
- C13a–d: gửi `{currentPassword, newPassword}` đúng với dữ liệu biểu mẫu. Sai mật khẩu hiện tại trả 400 được đặt dưới ô hiện tại, không xoá phiên. Kiểm tra xác nhận, độ dài, khác mật khẩu cũ; chặn gửi lặp và chỉ mở hộp thoại thành công sau response đạt.
- C12: mỗi ticket gọi GET `/api/tickets/{id}`, chuyển `responses` thành nội dung/tên nhân viên/thời gian. C12 hiện trích đoạn mới nhất; C12b tại `#/support/:id` hiện đầy đủ lịch sử theo tiến trình; tải lại trang vẫn lấy từ API. Chi tiết lỗi có thông báo, có nút cập nhật; 401 đưa về đăng nhập.
- S05: chặn phản hồi rỗng và gửi lặp. Chuẩn hoá các danh sách null trên board của staff/manager thành mảng trước khi render, tránh trắng trang với DTO theo vai trò.

## Đối chiếu Figma

Đã đọc được section `436:9217` từ liên kết mới. Lấy context đầy đủ và screenshot riêng cho C12 `436:12074`, C12b `604:9927`, C13 `436:12107`, C13a `436:12152`, C13b `436:12197`, C13c `436:12242`, C13d `436:12287`. Đã cập nhật CSS chỉ áp dụng các route profile/support, có trang chi tiết tiến trình, nhãn báo lỗi thiếu thông tin/xác nhận sai và placeholder mật khẩu. Tái sử dụng Manrope có sẵn. Không thay các màn ngoài phạm vi.

Đã xuất nguyên bản năm icon bằng Plugin API (chỉ đọc, không sửa canvas) vì URL tải asset trả trang HTML thay SVG. Logo 36×36, thông báo 44×44, ba mốc tiến trình 14×17; lưu file SVG cục bộ và xác minh kích thước/tải ảnh bằng Chromium. Không vẽ lại icon hoặc dùng screenshot làm ảnh nền. Xem nguồn đối chiếu trong `docs/figma-auth-support-review.md`.

Dữ liệu tên, nội dung, số kho và giờ lấy từ API, không chép dữ liệu minh hoạ của Figma. API hiện không trả tên người được phân công; chi tiết ghi “Nhân viên phản hồi” từ responses thay vì suy đoán người phụ trách. Nếu AssignedAt thiếu thì không bịa thời gian tiếp nhận. Ảnh đính kèm vẫn chỉ lưu tên cục bộ, chưa có upload máy chủ; không dùng hình minh hoạ Figma thay ảnh của khách.

## Chạy kiểm tra

Trong `SafeSpace-Customer-UI/SafeSpace-Customer-UI`:

```powershell
npm.cmd install
npm.cmd run check:structure
npm.cmd test
npm.cmd run test:business
npm.cmd run test:render
npm.cmd run build
npx.cmd playwright install chromium
npm.cmd run test:auth-support
```

Playwright chạy riêng tại 127.0.0.1:5273; cần cổng này trống. Các test dùng API giả lập, không yêu cầu đổi cấu hình SQL của bạn. Không commit `.env.local`, `test-results`, `playwright-report` hoặc trình duyệt tải về.

## Kiểm thử với SQL Server của nhóm trước merge

1. Trong thư mục `SSFRMS_AuthSupport`, dùng cấu hình SQL riêng đang chạy được (không stage file đó). Dừng backend cũ bằng Ctrl+C, chạy `dotnet run --project StorageProject.Api --launch-profile http`.
2. Frontend ở worktree này dùng `.env.local`: `VITE_USE_API=true`, `VITE_API_URL=http://localhost:5151`; mở terminal khác chạy `npm.cmd run dev` trong hai cấp thư mục FE. Không chạy frontend cũ nếu muốn kiểm chứng bản mới.
3. Customer01: đổi tên → lưu → F5 → đăng xuất/đăng nhập lại. Tên vẫn đúng customer01; customer02/staff01 không thay đổi. Số điện thoại vẫn giữ nguyên.
4. Customer01: sai mật khẩu hiện tại → lỗi đúng ô; xác nhận khác → lỗi; đổi đúng → đăng xuất → mật khẩu cũ bị từ chối, mật khẩu mới đăng nhập được. Không dùng mật khẩu của người khác làm dữ liệu thử.
5. Tại cơ sở có phân công staff: khách gửi yêu cầu; staff01 mở S05, nhập phản hồi và lưu; customer01 mở C12, cập nhật/F5, đọc đúng nội dung, tên nhân viên và lịch sử. Customer02 không đọc được ticket của customer01.
6. Chưa chạy SQL Server thật trong môi trường tạo bản vá. Không cần migration mới cho gói này. Không reset database.

Ảnh đính kèm vẫn là tên file lưu cục bộ; không tuyên bố đã lưu file ảnh lên máy chủ. Giao diện staff chưa được mở thêm chức năng hồ sơ C13 trong gói này.
