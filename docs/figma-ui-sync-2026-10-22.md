# Đồng bộ Figma 22/10/2026

Nền repo: `0e70026` (main, sau PR #19). Nhánh bàn giao: `feature/figma-ui-sync-20261022`.

## Đã cập nhật
- Header và menu cùng nằm trong một khối sticky: không ẩn, đổi màu, co lại hay đổi nội dung khi cuộn. Áp dụng khách hàng, nhân viên, quản lý cơ sở, vận hành KD và quản trị.
- Nút Danh sách / Bản đồ dùng icon Figma, nền xanh/chữ trắng ở lựa chọn hiện tại; tăng vùng bấm và bố trí nút đặt kho.
- Chuông chỉ ở khách hàng, có số chưa đọc. Các sự kiện hợp đồng, thanh toán, nhận chìa khóa, cấp lại mã, gia hạn và phản hồi hỗ trợ được đưa vào danh sách thông báo. Trạng thái đọc hiện lưu trong trình duyệt theo tài khoản.
- Nhân viên/quản lý cơ sở có số yêu cầu chờ ngay trên task. Số lấy từ hàng chờ thực tế, cập nhật sau xử lý và khi tải lại; 0 ẩn. Không biến nhật ký vận hành thành thông báo ở chuông nhân viên.
- Mọi thao tác ghi dữ liệu của STAFF qua provider đều cần xác nhận trước. Quay lại không gọi API. Lưu lỗi giữ nội dung, hiện lỗi; thành công mới điều hướng. Chặn gửi lặp khi đang xác nhận/lưu.
- Hỗ trợ có 8 nhóm và mục Khác bắt buộc tiêu đề riêng tối đa 100 ký tự. Có yêu cầu cấp lại QR, PIN 6 số hoặc chìa khóa vật lý.
- Tên cơ sở hiện dưới tên/vai trò quản lý; vẫn chỉ một cơ sở tại một thời điểm.
- Bỏ bàn giao kích hoạt và lựa chọn thẻ/vân tay. Nhận chìa khóa tại quầy chỉ ghi nhận vật lý; không kích hoạt hợp đồng.

## Cấp hợp đồng tự động — D26
Người dùng chọn hệ thống tự chọn ô sau thanh toán. Backend kiểm chữ ký PayOS, mã đơn và số tiền, ghi đúng RENT/DEPOSIT, rồi chọn ô AVAILABLE đúng cơ sở/loại, không bảo trì, không trùng hợp đồng. Giao dịch dùng cùng khóa reservation/inventory; callback lặp không tạo tiền/hợp đồng/mã lần nữa.

Nếu không còn ô phù hợp, vẫn ghi nhận tiền thật, giữ đơn chờ xử lý ở Phân bổ kho; không báo đã cấp hợp đồng. Sau khi có ô, quản lý có thể xử lý qua màn này hoặc callback được gửi lại. Thu tiền tại quầy cũng tự cấp sau khi xác nhận đủ khoản thu.

QR và PIN có credential riêng, cấp lại loại nào thay loại đó. Mã chỉ mở trong [ngày bắt đầu, ngày kết thúc) theo giờ Việt Nam, kể cả chưa nhận chìa khóa. PIN cần mã ô kho khi kiểm tra; máy quét hiện vẫn là endpoint mô phỏng, chưa tích hợp thiết bị cửa thật. PIN 8 số cũ không còn được dùng trong luồng mới.

Không có migration mới; không sửa migration cũ. Tái sử dụng HandoverRecord để ghi nhận nhận chìa khóa, giữ dữ liệu cũ. Endpoint cũ của nhân viên không còn kích hoạt; endpoint khách xác nhận bàn giao bị từ chối.

## Kiểm chứng và giới hạn
- Frontend: 76/76 test; 92 route SSR; kiểm tra cấu trúc và build đạt. Business frontend: 9/9 ở phiên kiểm tra.
- Backend: build và 40/40 test SQLite đạt trong phiên. Các thay đổi UI cuối cùng đã chạy lại frontend trước đóng gói.
- Trình duyệt: 13 nhóm kiểm tra gồm ảnh header trước/sau cuộn giống nhau ở 5 vai trò, xác nhận trước lưu, hủy không gửi request, lưu lỗi giữ draft, số task giảm, QR/PIN và mobile không tràn ngang.
- Chưa kiểm SQL Server/PayOS bằng khóa thật, migration trên DB của nhóm, khóa cạnh tranh nhiều máy hoặc thiết bị cửa thật. F38 giữ active để nhóm kiểm thử tích hợp trước merge. Không tự push/PR/merge.
- Cảnh báo dependency NU1902/NU1903, nullable Board và kích thước chunk/font đã có ở nguồn; không xử lý trong gói giao diện này.

## Figma đối chiếu
- [Hỗ trợ / Khác](https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN?node-id=758-10733)
- [Xác nhận thu tiền](https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN?node-id=779-10177)
- [QR / PIN / chìa khóa](https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN?node-id=601-9806)
- [Nhận chìa khóa](https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN?node-id=436-13197)
