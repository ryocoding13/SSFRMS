# Đối chiếu C12/C13 với Figma — 22/10/2026

Nguồn: [SafeSpace · Khách hàng](https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN/SafeSpace---Modern-UI?node-id=436-9217). Section chỉ trả metadata nên đã đọc context đầy đủ và screenshot từng frame trước khi sửa.

| Màn | Node | Phần đã đối chiếu |
|---|---|---|
| C12 | 436:12074 | Form 804px và yêu cầu gần đây 432px tại viewport 1440; trích đoạn phản hồi, tên nhân viên, cập nhật và Xem chi tiết |
| C12b | 604:9927 | Quay lại, tiêu đề/mã, tiến trình, nội dung ban đầu, các phản hồi, trạng thái đóng |
| C13 | 436:12107 | Hai khối 618px, khoảng cách 24px; input 52px; Manrope cho tiêu đề, Inter cho nội dung |
| C13a | 436:12152 | Tên đang sửa trong ô nhập, lưu qua PUT và chỉ cập nhật sau khi máy chủ chấp nhận |
| C13b | 436:12197 | Các ô mật khẩu nhập thật, che ký tự và không đưa mật khẩu lên thông báo |
| C13c | 436:12242 | Viền lỗi ô xác nhận, thông báo không khớp và lời nhắc nhập lại |
| C13d | 436:12287 | Ba ô thiếu dữ liệu có viền lỗi, thông báo tổng và mô tả; lỗi từng ô vẫn có tên truy cập cho trình đọc màn hình |

CSS tại `src/shared/styles/auth-support.css` chỉ ảnh hưởng `.app--auth-support` và các component chi tiết mới. Logo/header chỉ chuyển asset cho route profile/support. Bố cục 1440px và responsive 390px được xem qua ảnh Chromium nội bộ; không dùng screenshot Figma làm tài nguyên của sản phẩm.

## Tài nguyên nguyên bản

URL asset không tải được trong môi trường (trả HTML 195 byte); các file đó đã được loại bỏ và thay bằng SVG nguyên bản xuất trực tiếp qua Plugin API từ đúng node. Chỉ đọc, không sửa canvas.

| File SVG | Node nguồn | Kích thước gốc |
|---|---|---|
| brand.svg | I604:9928;436:14708 | 36 × 36 |
| notification.svg | I604:9928;436:14728 | 44 × 44 |
| timeline-blue.svg | 612:8794 | 14 × 17 |
| timeline-green.svg | 612:8813 | 14 × 17 |
| timeline-pending.svg | 612:8825 | 14 × 17 |

Các file đặt ở `src/assets/customer/auth-support`, import bằng Vite, không có URL Figma tạm lúc chạy. Không sửa path SVG và không ép kích thước root khác thiết kế. Test kiểm các file tải được và kích thước hiển thị. Dùng font Manrope đã có ở public/fonts/manrope.

## Khác biệt có căn cứ dữ liệu

- Dữ liệu minh hoạ trên Figma được thay bằng dữ liệu tài khoản/đơn thực tế.
- API chưa trả tên người được phân công. Giao diện ghi “Nhân viên phản hồi” theo `responses.staffName`; không tự coi người phản hồi là người được phân công.
- API có AssignedAt/ResolvedAt/ClosedAt nhưng bản ghi cũ có thể trống. Không tự dựng giờ tiếp nhận/đóng. Các phản hồi được hiển thị theo dữ liệu thời gian mà API trả.
- Ảnh của khách là dữ liệu động. Backend hiện chưa nhận/lưu file; giao diện giữ tên file cục bộ như trước, không dùng hình minh hoạ thay ảnh thực.
- Nút “Cập nhật yêu cầu” bổ sung để lấy phản hồi mới và thử lại khi mất kết nối. Không tuyên bố đã làm realtime hoặc thông báo từ máy chủ.

## Kiểm chứng

14 kiểm tra Chromium tương tác với API giả lập, 68 test frontend, 9 business, 94 route SSR, structure/build/init đạt; backend 34 SQLite tiếp tục đạt. Kiểm thử trình duyệt không thay kiểm tra SQL Server của nhóm. Chưa xác nhận luồng upload ảnh hoặc tên người được phân công, và không mở phạm vi sang S04/M07/C14.
