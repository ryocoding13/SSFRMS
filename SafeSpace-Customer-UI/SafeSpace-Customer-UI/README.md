# SafeSpace — Giao diện khách hàng & quản trị hệ thống

React + Vite, bám theo file Figma **SafeSpace - Modern UI**: Trang chủ, Đăng nhập, Đăng ký, Bảng giá,
Hướng dẫn, toàn bộ luồng khách hàng C01–C14 (kèm C03b/C03c/C04b, popup thông báo, các trạng thái C13)
và khu **Quản trị hệ thống** A01–A04 (xem `ADMIN-FLOW-COVERAGE.md`).

## Chạy cùng backend

1. Chạy backend ở thư mục gốc repo: `dotnet run --project StorageProject.Api --launch-profile http` → `http://localhost:5151`
2. Chạy giao diện:

```bash
cd SafeSpace-Customer-UI/SafeSpace-Customer-UI
npm ci
npm run dev                         # http://127.0.0.1:5173
```

Giao diện mặc định gọi API ở `http://localhost:5151`; đổi địa chỉ bằng `VITE_API_URL` trong `.env.local` (xem `.env.example`). Tài khoản có sẵn trong backend (đăng nhập bằng **tên đăng nhập**):

| Tài khoản | Mật khẩu | Vào |
|---|---|---|
| `customer01`, `customer02` | `Customer@123` | Giao diện khách hàng `#/overview` |
| `admin` | `Admin@123` | Quản trị hệ thống `#/admin` |

Khách đăng ký mới trên giao diện đăng nhập bằng **email**. Khu quản trị chỉ chạy ở chế độ API.

## Chạy không cần backend

Tạo `.env.local` với dòng `VITE_USE_API=false`: dữ liệu lưu trong trình duyệt, tài khoản có sẵn
`mai.nguyen@example.com` / `SafeSpace@123`. Dùng khi chỉ cần xem giao diện.

## Luồng nào gọi backend

| Luồng | Chế độ API |
|---|---|
| Đăng ký, đăng nhập, đăng xuất | `POST /api/auth/register · login · logout` |
| Cơ sở, loại kho, bảng giá, kiểm tra kho trống | `GET /api/facilities · unit-types · rates`, `POST /api/availability/check` |
| Tạo / xem / huỷ đơn đặt chỗ, hết giờ giữ chỗ tự huỷ | `/api/reservations` |
| Hợp đồng, khoản thu, lịch nhận kho, xác nhận bàn giao | `/api/contracts`, `/api/handovers/{id}/confirm` |
| Gia hạn | `POST /api/contracts/{id}/renewals` |
| Yêu cầu hỗ trợ (gửi, xem, huỷ) | `/api/tickets` |
| Báo "Tôi đã chuyển khoản", đăng ký trả kho, thông báo, đổi tên hiển thị, ảnh đính kèm hỗ trợ | Backend **chưa có API** → lưu trong trình duyệt theo từng tài khoản |
| Đổi mật khẩu, quên mật khẩu | Backend chưa có API → giao diện hướng dẫn liên hệ quản trị viên |

Khi backend bổ sung API cho các dòng cuối, chỉ cần sửa `src/state/store.jsx` (nhánh `ApiProvider`), xem `BE-CONTRACT.md`.

## Kiểm tra

```bash
npm test             # 28 test: nghiệp vụ, VietQR, chuyển đổi dữ liệu backend, vai trò JWT, nhật ký quản trị
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
  state/store.jsx          phiên đăng nhập; 2 chế độ: dữ liệu trong trình duyệt / API backend
  api/                     gọi API (http.js, endpoints.js, admin.js) + chuyển dữ liệu backend → giao diện (mappers.js)
  admin/                   khu quản trị: AdminShell, AdminUsers, AdminUserDetail, AdminCreateUser, AdminPermissions, AdminLogs
  data/seed.js             dữ liệu khởi tạo: 12 cơ sở, khách hàng Nguyễn Thị Mai
  config/                  địa chỉ API, ảnh, tài khoản nhận chuyển khoản
```
