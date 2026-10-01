# Đối chiếu Figma ↔ code

Nguồn: file Figma "SafeSpace - Modern UI" (section Khách hàng + Trang chủ & tài khoản + các section tương tác).

| Figma | Route | Component | Ghi chú |
|---|---|---|---|
| START Trang chủ | `#/home` | `pages/Home.jsx` | Hero tối, 3 điểm nổi bật, 12 cơ sở phân trang 9/trang, CTA đăng ký / đăng nhập |
| A01 Đăng nhập | `#/login` | `pages/Auth.jsx` | Trang riêng; "Quên mật khẩu?" mở hộp thoại; giữ `?next=` để quay lại |
| A02 Đăng ký | `#/register` | `pages/Auth.jsx` | Họ tên, email, SĐT, mật khẩu, xác nhận mật khẩu; tự vào vai trò Khách hàng |
| P01 Bảng giá | `#/pricing` | `pages/Public.jsx` | Giá "Từ" tính từ dữ liệu cơ sở |
| P02 Hướng dẫn | `#/guide` | `pages/Public.jsx` | Accordion +/− |
| C01 Dashboard | `#/overview` | `pages/Overview.jsx` | 3 số liệu, kho đang thuê, hành động nhanh, mốc sắp tới, hoạt động |
| C02 Tìm & đặt kho | `#/find` | `pages/FindList.jsx` | Hiện tất cả cơ sở; lọc loại kho / diện tích / khu vực; chip; sắp xếp; phân trang |
| C02a–f, C03 | `#/find?type=&band=&area=` | `pages/FindList.jsx` | Các trạng thái chọn + kết quả lọc + trail 01→04 |
| Nút Danh sách · Bản đồ | `#/find` ↔ `#/find/map` | `components/Inline.jsx` (`ViewToggle`) | Góc trên phải của C02 và C02m, giữ bộ lọc khi chuyển |
| C01/C06/C14-trống | `#/overview`, `#/units`, `#/reservations` | `components/Inline.jsx` (`EmptyInline`) | Khách chưa có kho / đơn: một dòng thông báo + nút "Tìm & đặt kho" |
| C02m, C02m-1, C02m-2 | `#/find/map` | `pages/FindMap.jsx` | Chỉ có thanh tìm kho + bản đồ Leaflet/OSM (không có danh sách thẻ, Figma 01/10); bấm logo mở "Thông tin cơ sở" + "Xem chi tiết cơ sở" |
| C03b, C03b-1..3 | `#/find/:id` | `pages/FacilityDetail.jsx` | Loại kho, diện tích, gói 1/3/6 tháng, lịch chọn ngày, chi phí |
| C03b-sđ (13 cơ sở) | `#/find/:id?view=map&unit=K01` | `pages/FacilityDetail.jsx`, `components/UnitMap.jsx` | Nút "Xem sơ đồ & tình trạng kho" ↔ "← Xem ảnh & tiện ích"; 10 ô; tóm tắt đổi theo ô; ô không trống → nút xám "Ô này hiện không khả dụng" |
| C03c-1..4 | (lightbox) | `components/Photo.jsx` | 5 ảnh: ảnh cơ sở + 4 ảnh bên trong kho (đã bỏ sơ đồ mặt bằng); ← → / Esc |
| C04 Đặt chỗ & Thanh toán | `#/checkout/:id` | `pages/Checkout.jsx` | Mã VietQR thật, số tiền, nội dung CK, đếm ngược, "Tôi đã chuyển khoản" |
| C04b Không thành công | `#/checkout/:id/failed` | `pages/Checkout.jsx` | Hết giờ → đơn tự huỷ, kể cả khi đã đóng tab |
| C05 Xác nhận | `#/confirmation/:id` | `pages/Checkout.jsx` | "Chờ đối soát thanh toán" |
| C06 Kho của tôi | `#/units` | `pages/Units.jsx` | |
| C07 / C07b Hợp đồng | `#/units/:id` | `pages/Units.jsx` | Nút gia hạn / trả kho bị khoá khi đang có yêu cầu chờ |
| C08 / C08b Gia hạn | `#/units/:id/renew` | `pages/Units.jsx` | Chọn 1/3/6 tháng |
| C09 / C09b Trả kho | `#/units/:id/return` | `pages/Units.jsx` | Ngày (lịch), khung giờ, ghi chú, đối chiếu cọc |
| C10 Yêu cầu đã gửi | `#/sent?type=&contract=` | `pages/Units.jsx` | |
| C11 Thanh toán & lịch hẹn | `#/payments` | `pages/Payments.jsx` | Thẻ lịch hẹn + bảng khoản thu; "Cần đổi lịch?" mở form hỗ trợ đúng chủ đề |
| C12 Hỗ trợ | `#/support` | `pages/Support.jsx` | Có ảnh đính kèm (tối đa 3, 5 MB); danh sách yêu cầu bên phải |
| C13, C13a–d, toast | `#/profile` | `pages/Profile.jsx` | Chỉ sửa tên; email / SĐT chỉ đọc (SĐT che bớt); hộp thoại "Đã hiểu" |
| C14 Đơn đặt chỗ | `#/reservations`, `#/reservations/:id` | `pages/Reservations.jsx`, `pages/Checkout.jsx` | |
| Popup thông báo (public / customer, đã đọc) | (header) | `components/Header.jsx` | |

## Chỗ Figma tự mâu thuẫn, code chọn như sau
- C04 ghi cần chuyển 3.450.000 đ nhưng C03b/C14 ghi "Tổng ban đầu" 4.600.000 đ → chuyển **4.600.000 đ** (tiền thuê + cọc).
- C03c ghi "x trên 4" → thư viện hiện **5 ảnh** (ảnh cơ sở + 4 ảnh bên trong).
- C03b-sđ: ô 5 m² / 10 m² dùng giá của nhóm diện tích "2 – 5 m²" / "10 – 20 m²" để khớp với giá đặt chỗ.
- C01 nói đã gửi gia hạn B-015 nhưng vẫn có nút "Gửi yêu cầu gia hạn" → dữ liệu khởi tạo chưa có yêu cầu gia hạn.
- Figma không có màn cho: chi tiết đơn, huỷ yêu cầu hỗ trợ, trạng thái rỗng → dựng theo cùng phong cách.
- Figma có 12 cơ sở nhưng chỉ vẽ 9 thẻ; 3 cơ sở trang 2 (Gò Vấp, Tân Bình, Bình Tân) dùng lại ảnh Bình Thạnh, Tân Thuận, Bình Chánh.
