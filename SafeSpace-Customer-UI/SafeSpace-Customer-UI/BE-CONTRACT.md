# BE-CONTRACT — những gì giao diện khách hàng cần từ backend

Giao diện bám Figma nên **khác luồng backend cũ (v3)** ở vài điểm. Tài liệu này là danh sách để sửa BE cho khớp.
Toàn bộ nghiệp vụ hiện nằm ở `src/state/reducer.js`; mỗi lệnh (`CREATE_RESERVATION`, `CONFIRM_TRANSFER`, ...)
tương ứng một endpoint dưới đây, nên thay bằng lời gọi API là đủ.

## 0. Hiện trạng nối API

Giao diện đã gọi thật các endpoint backend đang có: auth, facilities / unit-types / rates / availability,
reservations, contracts (+ payments, renewals, handover), tickets. Những luồng dưới đây backend **chưa có**
nên giao diện tạm lưu trong trình duyệt theo từng tài khoản (mất khi đổi máy / xoá dữ liệu trình duyệt):
báo đã chuyển khoản, đăng ký trả kho + lịch trả kho, thông báo, đổi tên hiển thị, ảnh đính kèm hỗ trợ.
Đổi / quên mật khẩu đang khoá trên giao diện.

Cách giao diện xử lý các điểm lệch hiện tại của backend:
- **Đăng nhập chỉ bằng Username** → khi khách đăng ký trên giao diện, `username` được đặt bằng email, nên khách
  đăng nhập được bằng email như Figma. Tài khoản seed (`customer01`…) vẫn đăng nhập bằng username.
- **DateTime trả về không kèm múi giờ** (đọc từ DB) → giao diện coi là UTC. Nên cấu hình JSON trả kèm `Z`.
- **Giữ chỗ 24 giờ** ở backend, Figma là 01:00 → đơn tạo trên giao diện đếm ngược theo `VITE_PAYMENT_TIMEOUT_SECONDS`,
  hết giờ thì gọi `POST /api/reservations/{id}/cancel`. Đơn tạo nơi khác theo `ExpiresAt` của backend.
- **Không có API báo đã chuyển khoản** → đơn vẫn `PENDING_PAYMENT` trên backend dù khách đã bấm.
- **Yêu cầu hỗ trợ bắt buộc ContractId** → khách chưa có hợp đồng không gửi được. `IssueType` = mã chủ đề
  (`ACCESS`, `LOCK`, `UNIT`, `PAYMENT`, `ITEMS`, `SCHEDULE`, `OTHER`), `Title` theo chủ đề, `Priority` = `HIGH` / `NORMAL`.
- **Loại kho thật** (Mini S 1 m², M 4 m², L 9 m², XL 16 m²) hiển thị thành "Kho thường / Kiểm soát nhiệt độ" +
  diện tích thật, lấy giá từ `/api/rates`.

## 0a. Dữ liệu 12 cơ sở theo Figma

`StorageProject.Infrastructure/Data/DbSeeder.cs` được bổ sung bước **7b** (`SeedSafeSpaceNetworkAsync`):
- Đổi tên 2 cơ sở seed cũ: "SSFRMS Chi nhánh Tân Bình / Quận 7" → "SafeSpace Tân Bình / Quận 7".
- Thêm 10 cơ sở Figma (Nguyễn Lương Bằng, Him Lam, Phú Xuân, Tân Thuận, Phú Mỹ Hưng, Bình Thạnh, Nhà Bè, Bình Chánh,
  Thủ Đức, Gò Vấp), mỗi cơ sở có bảng giá S / M / L (một số có XL) và 5–6 phòng kho `AVAILABLE`.
- Chạy lại được: chỉ thêm phần còn thiếu, nên database đã tạo từ trước cũng tự có đủ 12 cơ sở khi khởi động lại API.

## 0b. Khu quản trị

Đã gọi toàn bộ `/api/admin/*` hiện có (xem `ADMIN-FLOW-COVERAGE.md`). Đề xuất bổ sung phía backend:
- Gửi email mời / đặt mật khẩu lần đầu khi tạo tài khoản (Figma A02 "Gửi lời mời").
- Vai trò `OPERATIONS` (Vận hành KD) như Figma.
- Ghi lịch sử đăng nhập **thất bại** (hiện chỉ ghi khi thành công) và lưu IP vào nhật ký hoạt động.
- Cho lọc nhật ký theo nhiều `action` một lúc (để tab "Thay đổi dữ liệu" / "Phân quyền" phân trang ở máy chủ).
- Trả kèm cơ sở phụ trách trong `GET /api/admin/users` để khỏi gọi thêm từng người.

## 1. Luồng khác v3 (cần quyết định phía BE)

| Điểm | Figma / giao diện hiện tại | Backend cũ (v3) |
|---|---|---|
| Thanh toán đặt chỗ | Khách chuyển khoản QR **ngay lúc đặt** (C04), bấm "Tôi đã chuyển khoản" → đơn "Chờ đối soát" | Đặt chỗ trước, thanh toán sau khi có hợp đồng |
| Giữ chỗ | Đơn chờ chuyển khoản **tự huỷ sau N giây** (Figma: 60 giây) → C04b | Không có |
| Số tiền chuyển | Tổng ban đầu = tiền thuê + cọc (cọc = 1 tháng) | — |
| Gói thuê | 1 / 3 / 6 tháng | 1–24 tháng tuỳ nhập |
| Đăng ký | Họ tên, email, SĐT, mật khẩu, xác nhận; **không có username** | Có `username` |
| Đăng nhập | "Tên đăng nhập **hoặc** email" | `username` |
| Hồ sơ | Khách chỉ sửa **tên**; email / SĐT chỉ đọc | Sửa cả email, SĐT |
| Hỗ trợ | Chủ đề + mô tả + ảnh đính kèm (không có tiêu đề) | Có `title` |
| Thanh toán & lịch hẹn | Một màn: lịch hẹn + **sổ khoản thu** (chỉ xem) | Danh sách thanh toán có nút báo chuyển khoản |

## 2. Trạng thái UI dùng (khoá → nhãn)

- **Reservation**: `PENDING_PAYMENT` Chờ chuyển khoản · `PENDING_VERIFICATION` Chờ đối soát · `CONFIRMED` Đã xác nhận · `CHECKED_IN` Đã nhận kho · `CANCELLED` Đã huỷ đặt chỗ (kèm `cancel_reason`)
- **Contract**: `ACTIVE`, `ENDED` lưu ở BE; `EXPIRING` (≤ 30 ngày) và `OVERDUE` UI tự suy ra từ `end_date`
- **Ledger (khoản thu)**: `RECONCILED` Đã đối soát · `PENDING_VERIFICATION` Chờ đối soát · `DEPOSIT_HELD` Đang giữ cọc · `RENEWAL_PENDING` Chờ duyệt yêu cầu · `UNPAID` Chưa thanh toán · `REFUNDED`
- **Appointment**: `kind` = `CHECK_IN` | `MOVE_OUT`; `status` = `CONFIRMED` | `PENDING` | `DONE` | `CANCELLED`
- **Ticket**: `OPEN` · `IN_PROGRESS` · `RESOLVED` · `CANCELLED`; `topic` = `ACCESS|LOCK|UNIT|PAYMENT|ITEMS|SCHEDULE|OTHER`
- **Renewal**: `PENDING` | `APPROVED` | `REJECTED` — **Return**: `PENDING` | `SCHEDULED` | `COMPLETED`

## 3. Endpoint cần có

| Màn | Endpoint đề xuất | Ghi chú |
|---|---|---|
| A01 | `POST /api/auth/login` `{identifier, password}` | Sai mật khẩu nên trả **400/422**, không phải 401 (UI coi 401 là hết phiên) |
| A02 | `POST /api/auth/register` `{fullName, email, phone, password}` | Tự gán role Customer; trả token + user |
| A01 | `POST /api/auth/forgot-password` `{email}` | Luôn trả 200 |
| C13 | `GET/PUT /api/auth/profile` | PUT chỉ nhận `fullName` |
| C13 | `POST /api/auth/change-password` `{currentPassword, newPassword}` | Sai mật khẩu hiện tại → 400 |
| C02, C03 | `GET /api/facilities?type=&band=&area=&camera=&sort=&page=` | Trả: `id, name, district, city, address, distanceKm, hours, camera, hasClimate, basePrice`. `distanceKm` cần vị trí khách hoặc tạm tính |
| C03b | `POST /api/quotes` `{facilityId, type, band, months, startDate}` | → `monthlyRate, rentTotal, deposit, initialTotal, endDate, available` |
| C03c | `GET /api/facilities/{id}/photos` | 4+ ảnh kèm chú thích (mặt tiền, sơ đồ, ...) |
| C04 | `POST /api/reservations` | Tạo đơn `PENDING_PAYMENT`, trả `reservationId, expiresAt, timeoutSeconds, transferAmount, transferContent` (UI tự tạo VietQR từ tài khoản nhận) |
| C04 | `POST /api/reservations/{id}/confirm-transfer` | → `PENDING_VERIFICATION`; sau `expiresAt` trả lỗi mã `EXPIRED` |
| C04b | (job nền) | Tự chuyển `PENDING_PAYMENT` quá hạn sang `CANCELLED`, `cancelReason` kiểu "Quá 1 phút chưa xác nhận" |
| C14, C05 | `GET /api/reservations`, `GET /api/reservations/{id}` | |
| C06, C07 | `GET /api/contracts`, `GET /api/contracts/{id}` | Thêm `unitNumber, sizeM2, location, handedOver, depositAmount` |
| C08 | `POST /api/contracts/{id}/renewals` `{months}` (1/3/6) | Trả 409 nếu đã có yêu cầu chờ |
| C09 | `POST /api/contracts/{id}/move-out` `{date, slot, note}` | Tạo `Appointment MOVE_OUT` trạng thái `PENDING` |
| C11 | `GET /api/appointments`, `GET /api/ledger` | Sổ khoản thu: `ref, label, amount, status, contractId?, reservationId?` |
| C12 | `GET/POST /api/tickets`, `POST /api/tickets/{id}/cancel` | POST là multipart: `contractId?, topic, description, files[≤3, ≤5MB, image/*]`; chỉ huỷ được khi `OPEN` |
| Popup | `GET /api/notifications`, `POST /api/notifications/read` `{ids?}` | `id, title, detail, to, createdAt, read` |

## 4. Việc còn lại phía backend

- Tài khoản nhận chuyển khoản đang cấu hình ở `.env` (`VITE_BANK_*`); nếu mỗi cơ sở nhận tiền riêng thì trả kèm theo đơn.
- Khoảng cách "Cách bạn X km" cần vị trí khách; hiện lấy từ dữ liệu cơ sở.
- Ảnh cơ sở đang là file tĩnh trong `public/images/`; khi có API ảnh (`GET /api/facilities/{id}/photos`), thay các hàm trong `src/config/media.js`.
- Đăng nhập nhân viên / quản lý / admin (Figma A01) thuộc các giao diện vai trò khác, chưa nằm trong gói này.
- Kho dữ liệu cục bộ lưu cả mật khẩu để đăng nhập được khi chưa có server; khi nối API, bỏ trường này.
