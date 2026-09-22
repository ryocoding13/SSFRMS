# SafeSpace — Giao diện khách hàng

React + Vite, bám theo file Figma **SafeSpace - Modern UI**: Trang chủ, Đăng nhập, Đăng ký, Bảng giá,
Hướng dẫn và toàn bộ luồng khách hàng C01–C14 (kèm C03b/C03c/C04b, popup thông báo, các trạng thái C13).

```bash
npm ci
cp .env.example .env            # chỉnh tài khoản nhận chuyển khoản
npm run dev                     # http://127.0.0.1:5173
```

Tài khoản khách hàng có sẵn: `mai.nguyen@example.com` / `SafeSpace@123`. Khách mới đăng ký tại `#/register`.

## Kiểm tra

```bash
npm test             # 18 test nghiệp vụ: báo giá, giữ chỗ / tự huỷ, gia hạn, trả kho, hỗ trợ, VietQR...
npm run test:render  # render 38 route, bắt lỗi runtime, NaN, undefined
npm run build        # xuất bản dist/ (đường dẫn tương đối, đặt được ở thư mục con)
```

## Ảnh

Toàn bộ ảnh nằm sẵn trong `public/images/` (đã nén JPG, tổng ~3,9 MB): ảnh hero trang chủ, ảnh mặt tiền
9 cơ sở, 4 ảnh bên trong kho và 3 sơ đồ mặt bằng. Khi bấm xem một cơ sở, thư viện ảnh gồm ảnh cơ sở,
4 ảnh bên trong kho và 1 sơ đồ ở cuối (mỗi cơ sở được gán một trong 3 sơ đồ). Chi tiết ở
`public/images/README.md`; đổi cách gán ảnh ở `src/config/media.js`.

## Thanh toán

Màn C04 tạo mã **VietQR** (chuẩn NAPAS 247) từ tài khoản trong `.env`, số tiền và mã đặt chỗ làm nội dung
chuyển khoản; ứng dụng ngân hàng quét là điền sẵn cả ba. Đơn tự huỷ khi hết thời gian giữ chỗ
(`VITE_PAYMENT_TIMEOUT_SECONDS`), kể cả khi khách đã đóng trang.

## Cấu trúc

```
src/
  CustomerApp.jsx          router + chặn trang cần đăng nhập
  pages/                   mỗi màn Figma một component (xem CUSTOMER-FLOW-COVERAGE.md)
  components/              Header + thông báo, lịch chọn ngày, thư viện ảnh, mã QR, UI dùng chung
  state/reducer.js         nghiệp vụ (thuần, có test)
  state/store.jsx          phiên đăng nhập + kho dữ liệu cục bộ (localStorage)
  data/seed.js             dữ liệu khởi tạo: 12 cơ sở, khách hàng Nguyễn Thị Mai
  config/                  ảnh, tài khoản nhận chuyển khoản
  services/                lớp gọi API REST, dùng khi nối backend
```

Dữ liệu hiện lưu ở trình duyệt. Nối backend: thay `dispatch` / `login` / `register` trong `state/store.jsx`
bằng lời gọi API theo `BE-CONTRACT.md`; các trang không phải sửa.
