# QR mở cửa — giao diện C07

Phạm vi: giao diện và mô phỏng frontend, chưa phải hệ thống kiểm soát cửa thật. Không sửa backend, schema, thanh toán hay nghiệp vụ Ops.

## Chạy và xem
1. Vào `SafeSpace-Customer-UI/SafeSpace-Customer-UI`.
2. `npm install`.
3. Tạo `.env.local` với `VITE_USE_API=false`.
4. `npm run dev`.
5. Đăng nhập `mai.nguyen@example.com` / `SafeSpace@123`.
6. Kho của tôi → hợp đồng B-015 → Mở cửa kho → bấm QR để mô phỏng quét → Mở cửa → Quay lại → Đóng.
A-102 chưa bàn giao nên nút mở cửa bị khóa. QR chứa mã tham chiếu ngẫu nhiên, không chứa thông tin cá nhân. Mã dự phòng chỉ được validator mô phỏng hỗ trợ, chưa có màn nhập riêng trong thiết kế Figma.

Popup theo C07q (601:9806), kết quả C07r1/C07r2 (601:9826 / 601:9836). Icon xuất trực tiếp từ Figma; vùng giữ chỗ QR được thay bằng QR có thể giải mã. Nút Đóng chỉ đóng popup.

## Giới hạn và điểm nối backend
`src/state/useAccessQr.js` là ranh giới tích hợp. Hiện `VITE_USE_API=true` sẽ báo máy chủ chưa hỗ trợ; tuyệt đối không tự chuyển sang mô phỏng để báo mở cửa thành công.
Khi backend sẵn sàng, thay `getCredential` bằng API xác thực chủ hợp đồng, kiểm bàn giao/ngày hiệu lực và trả mã tham chiếu; thay `scan` bằng API kiểm mã/ô kho/thu hồi, trả `{ allowed, message, at }` và ghi activity_logs. Cần thống nhất endpoint/JSON với nhóm trước khi nối.
Backend phải kiểm tra quyền và thời hạn độc lập; JavaScript và localStorage không phải bảo mật. Trả kho ở Ops phải thu hồi mã trên server. Chưa kiểm thử luồng bàn giao/trả kho trên SQL Server.
Mô phỏng kiểm tra lại trạng thái khi bấm QR, từ chối mã khác chủ/sai ô/sai mã/quá hạn/chưa bàn giao/đã trả kho. Nhật ký giới hạn 100 lần gần nhất ở khóa `safespace.access.scans.<user_id>` trong trình duyệt, không phải database. Mã cấp mỗi lần mở popup và chỉ có hiệu lực trong ngày cấp.

## Kiểm tra
`npm test` gồm kiểm tra QR mới; `npm run test:render`; `npm run build`.
