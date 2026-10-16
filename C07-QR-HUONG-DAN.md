# C07 — Xem và quét QR mở cửa (frontend)

## Phạm vi
Chỉ thêm frontend C07q, C07r1, C07r2 theo Figma; không triển khai backend QR. File code cũ `src/pages/Units.jsx` chỉ thêm 1 import và 1 lần render component. Không đổi đăng nhập, đặt kho, thanh toán, bàn giao, trả kho, giao diện KD, backend hay database.

## Xem giao diện
Vào `SafeSpace-Customer-UI/SafeSpace-Customer-UI`, tạo/cập nhật `.env.local`:
```
VITE_USE_API=false
```
Chạy `npm install`, `npm run dev`. Đăng nhập `mai.nguyen@example.com` / `SafeSpace@123`, chọn Kho của tôi → B-015 → Mở cửa kho → bấm trực tiếp hình QR để mô phỏng máy quét, giống prototype Figma. Nút Quay lại đưa về QR; Đóng, Escape hoặc bấm nền ngoài đóng hộp thoại.
A-102 chưa được bàn giao (`handed_over: false`) nên QR bị khóa. Không đổi dữ liệu A-102 chỉ để mở khóa.
Nếu đang đăng nhập tài khoản cục bộ khác không có hợp đồng, nó sẽ không có QR. Tính năng không kiểm tra email cố định; lấy hợp đồng và người dùng từ state.

## Hành vi
- Chỉ hiện mã khi hợp đồng đã bàn giao, trạng thái ACTIVE/EXPIRING và trong kỳ thuê.
- QR thật được tạo bằng thư viện qrcode đã có; chứa mã tham chiếu ngẫu nhiên, không chứa thông tin cá nhân.
- Mã dự phòng, ô kho và hạn hợp đồng lấy theo phiên mô phỏng và hợp đồng hiện tại.
- Bấm QR kiểm tra lại quyền phiên mô phỏng, mã, ô kho, ngày cấp, ngày hiệu lực và trạng thái; hợp lệ hiện Mở cửa, không hợp lệ hiện Từ chối.
- Nhật ký mô phỏng nằm riêng trong localStorage, tối đa 100 lần; không phải activity_logs database.
- Mã cấp lại khi mở popup; mã mô phỏng hết hiệu lực sau ngày cấp.
- Không có thao tác đóng cửa kho. Đóng chỉ đóng popup; cửa vật lý khách tự đóng.
- Màn nhập mã dự phòng/camera không có trong khung Figma này nên không thêm.

## Chế độ API
Khi `VITE_USE_API=true`, các chức năng cũ vẫn dùng backend như trước. QR sẽ báo máy chủ chưa hỗ trợ; không giả lập thành công trên tài khoản thật. Đổi `src/state/useAccessQr.js` khi triển khai API cấp mã, kiểm mã và thu hồi mã; backend phải tự kiểm tra quyền sở hữu, đúng ô và thời hạn. Không dùng kiểm tra frontend làm kiểm soát cửa thật.

## Các file thêm
- src/components/AccessQr.jsx: giao diện và popup.
- src/styles/access-qr.css: CSS riêng C07.
- src/state/useAccessQr.js: ranh giới mô phỏng/tích hợp sau.
- src/lib/access.js: kiểm tra mô phỏng.
- src/assets/access/check.svg, close.svg: icon xuất từ Figma 601:9827/601:9837, kích thước 96×96.
- tests/access.test.js: chạy `node --test tests/access.test.js`.

Thiết kế tham chiếu: Figma SafeSpace - Modern UI, C07q 601:9806, C07r1 601:9826, C07r2 601:9836. Vùng giữ chỗ QR trong thiết kế được thay bằng QR có thể giải mã, thông tin minh họa được thay bằng dữ liệu hợp đồng.
