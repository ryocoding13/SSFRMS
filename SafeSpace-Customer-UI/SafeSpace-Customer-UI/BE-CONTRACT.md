> **Danh sách việc backend còn thiếu, xếp theo ưu tiên: xem `BACKEND-TODO.md`.** Tài liệu này giữ chi tiết lịch sử.

# BE-CONTRACT — những gì giao diện khách hàng cần từ backend

Giao diện bám Figma nên **khác luồng backend cũ (v3)** ở vài điểm. Tài liệu này là danh sách để sửa BE cho khớp.
Toàn bộ nghiệp vụ hiện nằm ở `src/app/state/appReducer.js`; mỗi lệnh (`CREATE_RESERVATION`, `CONFIRM_TRANSFER`, ...)
tương ứng một endpoint dưới đây, nên thay bằng lời gọi API là đủ.

## 0. Hiện trạng nối API

Giao diện đã gọi thật các endpoint backend đang có: auth, facilities / unit-types / rates / availability,
reservations, contracts (+ payments, renewals, handover), tickets. Những luồng dưới đây backend **chưa có**
nên giao diện tạm lưu trong trình duyệt theo từng tài khoản (mất khi đổi máy / xoá dữ liệu trình duyệt):
báo đã chuyển khoản, đăng ký trả kho + lịch trả kho, thông báo, đổi tên hiển thị, ảnh đính kèm hỗ trợ.
Đổi / quên mật khẩu đang khoá trên giao diện.

Cách giao diện xử lý các điểm lệch hiện tại của backend:
- **Đăng nhập bằng username hoặc email (D31)** → `POST /api/auth/login` giữ JSON `{username, password}`;
  `username` nhận cả email (không phân biệt hoa/thường). Giữ HTTP 401 cho sai thông tin; FE login đã xử lý riêng. Tài khoản seed vẫn dùng username.
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
- ~~Vai trò `OPERATIONS` (Vận hành KD) như Figma.~~ Đã có (14/10/2026): role `OPERATIONS`, tài khoản `ops01`, API `/api/operations/*` — xem `docs/operations-api.md`.
- Ghi lịch sử đăng nhập **thất bại** (hiện chỉ ghi khi thành công) và lưu IP vào nhật ký hoạt động.
- Cho lọc nhật ký theo nhiều `action` một lúc (để tab "Thay đổi dữ liệu" / "Phân quyền" phân trang ở máy chủ).
- Trả kèm cơ sở phụ trách trong `GET /api/admin/users` để khỏi gọi thêm từng người.

## 1. Luồng khác v3 (cần quyết định phía BE)

| Điểm | Figma / giao diện hiện tại | Backend cũ (v3) |
|---|---|---|
| Thanh toán đặt chỗ | **QR PayOS** ngay lúc đặt (C04), tự xác nhận qua webhook, trang tự chuyển (D19); hoặc **thanh toán tại cửa hàng** (C04c) → nhân viên thu ở S09 | Đặt chỗ trước, thanh toán sau khi có hợp đồng |
| Giữ chỗ | QR: **10 phút** (Figma C04) rồi tự huỷ → C04b; tại cửa hàng: 24 giờ (C04c) | Không có |
| Số tiền chuyển | Tổng ban đầu = tiền thuê + cọc (cọc = 1 tháng) | — |
| Gói thuê | 1 / 3 / 6 tháng | 1–24 tháng tuỳ nhập |
| Đăng ký | Họ tên, email, SĐT, mật khẩu, xác nhận; **không có username** | Có `username` |
| Đăng nhập | "Tên đăng nhập **hoặc** email" | `username` |
| Hồ sơ | Khách chỉ sửa **tên**; email / SĐT chỉ đọc | Sửa cả email, SĐT |
| Hỗ trợ | Chủ đề + mô tả + ảnh đính kèm (không có tiêu đề) | Có `title` |
| Thanh toán & lịch hẹn | Một màn: lịch hẹn + **sổ khoản thu** (chỉ xem) | Danh sách thanh toán có nút báo chuyển khoản |

## 2. Trạng thái UI dùng (khoá → nhãn)

- **Reservation**: `PENDING_PAYMENT` Chờ thanh toán · `PENDING_VERIFICATION` Chờ thanh toán tại cửa hàng (BE `PENDING_VERIFICATION` hoặc `PENDING_AT_FACILITY`) · `CONFIRMED` Đã xác nhận (BE `CONFIRMED` / `PAID` / `UNIT_ASSIGNED`) · `CHECKED_IN` Đã nhận kho · `CANCELLED` Đã huỷ đặt chỗ (kèm `cancel_reason`)
- **Contract**: `ACTIVE`, `ENDED` lưu ở BE; `EXPIRING` (≤ 30 ngày) và `OVERDUE` UI tự suy ra từ `end_date`
- **Ledger (khoản thu)**: `RECONCILED` Đã thanh toán · `PENDING_VERIFICATION` Chờ thanh toán tại cửa hàng · `DEPOSIT_HELD` Đang giữ cọc · `RENEWAL_PENDING` Chờ duyệt yêu cầu · `UNPAID` Chờ thanh toán (khoản `RENEWAL` chưa trả có nút "Thanh toán" → C11q) · `REFUNDED`
- **Appointment**: `kind` = `CHECK_IN` | `MOVE_OUT`; `status` = `CONFIRMED` | `PENDING` | `DONE` | `CANCELLED`
- **Ticket**: `OPEN` · `IN_PROGRESS` · `RESOLVED` · `CANCELLED`; `topic` = `ACCESS|LOCK|UNIT|PAYMENT|ITEMS|SCHEDULE|OTHER`
- **Renewal**: `PENDING` | `APPROVED` | `REJECTED` — **ReturnRequestPage**: `PENDING` | `SCHEDULED` | `COMPLETED`

## 3. Endpoint cần có

| Màn | Endpoint đề xuất | Ghi chú |
|---|---|---|
| A01 | D31: `POST /api/auth/login` `{username, password}` | `username` nhận username/email; giữ **401** khi sai thông tin, **400** khi tài khoản không ACTIVE; FE login đã xử lý riêng |
| A02 | `POST /api/auth/register` `{fullName, email, phone, password}` | Tự gán role Customer; trả token + user |
| A01 | `POST /api/auth/forgot-password` `{email}` | Luôn trả 200 |
| C13 | `GET/PUT /api/auth/profile` | PUT chỉ nhận `fullName` |
| C13 | `POST /api/auth/change-password` `{currentPassword, newPassword}` | Sai mật khẩu hiện tại → 400 |
| C02, C03 | `GET /api/facilities?type=&band=&area=&camera=&sort=&page=` | Trả: `id, name, district, city, address, distanceKm, hours, camera, hasClimate, basePrice`. `distanceKm` cần vị trí khách hoặc tạm tính |
| C03b | `POST /api/quotes` `{facilityId, type, band, months, startDate}` | → `monthlyRate, rentTotal, deposit, initialTotal, endDate, available` |
| C03c | `GET /api/facilities/{id}/photos` | 4+ ảnh kèm chú thích (mặt tiền, sơ đồ, ...) |
| C04 | `POST /api/reservations` | Tạo đơn `PENDING_PAYMENT`, trả `reservationId, expiresAt, timeoutSeconds, transferAmount, transferContent` (UI tự tạo VietQR từ tài khoản nhận) |
| C04 | `POST /api/reservations/{id}/payos`, `POST /api/reservations/{id}/pay-at-facility` | PayOS + thanh toán tại cửa hàng — hợp đồng JSON ở `BACKEND-TODO.md` mục "Mới 16/10". `confirm-transfer` (đã có) chỉ còn là dự phòng khi chưa có `pay-at-facility` |
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
- Ảnh cơ sở đang là file tĩnh trong `public/images/`; khi có API ảnh (`GET /api/facilities/{id}/photos`), thay các hàm trong `src/app/config/media.js`.
- Khu Nhân viên cơ sở (S01–S09) và Quản lý cơ sở (M01–M08) đã có giao diện, đang chạy trên dữ liệu trong trình duyệt
  (`src/features/facility-operations/`). Endpoint cần có ở mục 5.
- Kho dữ liệu cục bộ lưu cả mật khẩu để đăng nhập được khi chưa có server; khi nối API, bỏ trường này.

## 5. Endpoint cho sơ đồ ô kho, bản đồ và khu vận hành (giao diện đã sẵn, đang dùng dữ liệu cục bộ)

| Màn | Endpoint đề xuất | Thay ở |
|---|---|---|
| C03b-sđ | **Đã có** `GET /api/facilities/{id}/units` → `unitId, facilityId, unitTypeId, unitNumber, floor, zone, locationDescription, sizeM2, climateControlled, status` | `customerApi.facilityUnits`, `AppProvider.getFacilityUnits`, `FacilityDetailPage.jsx`, `unitsFor()` trong `units.js` |

| C02m | **Đã có** `latitude, longitude` trong `GET /api/facilities` (nhập ở B05a) | `mapCatalog` gán `lat/lng`; `coordsOf()` trong `src/app/config/geo.js` chỉ dùng toạ độ dự phòng khi cơ sở chưa có toạ độ |
| S01–S09, M01–M08 | `/api/ops/*` — **đã chốt hợp đồng ở `BACKEND-TODO.md` mục A2–A3**, giao diện gọi qua `src/features/facility-operations/api/facilityOperationsApi.js` | `src/features/facility-operations/state/FacilityOperationsProvider.jsx` |

Hình dạng dữ liệu giao diện đang dùng nằm ở `src/features/facility-operations/data/facilityOperationsSeed.js`; nghiệp vụ (điều kiện chặn, chuyển trạng thái) ở
`src/features/facility-operations/state/facilityOperationsReducer.js` và có test (`tests/ops.test.js`) để backend đối chiếu.

## Bổ sung 20/10 — thu tiền trước phân bổ và trạng thái ô

Đã triển khai API chọn trả tại kho, PaymentMethod, ghi khoản thu theo ReservationId rồi gắn ContractId, kiểm chuyển tiếp ô và lịch sử. Xem `docs/payment-integrity-2026-10-20.md` và D23–D24 để biết hợp đồng API, migration, phạm vi test và các ca cần chạy thật. FE không còn dùng confirm-transfer làm fallback cho chọn trả tại kho. Các API /api/ops tương thích được đăng ký duy nhất trong FacilityOpsEndpoints.


## Đồng bộ 22/10 — D26
- Dùng GET /api/ops/board và mutation /api/ops cho hàng chờ theo role; 404/405 mới dùng board vai trò dự phòng.
- POST /api/ops/keys/{id}/receipt ghi nhận nhận chìa khóa, không kích hoạt hợp đồng.
- AccessQrDto có validFrom, backupCode là PIN6; POST /api/access/scan nhận thêm unitNumber (bắt buộc khi dùng PIN). ContractDetailDto có accessUpdatedAt để tạo thông báo cấp lại mã.
- PayOS thành công tự phân bổ/cấp hợp đồng, không còn yêu cầu bàn giao. Xem đầy đủ tại docs/figma-ui-sync-2026-10-22.md.

## Đồng bộ 26/10 — D31

Nguồn `DECISIONS.md` D31; danh sách việc và người làm ở `BACKEND-TODO.md` mục "D31". Những điểm hợp đồng API thay đổi:

| Màn | Endpoint | Thay đổi theo D31 |
|---|---|---|
| A01 | `POST /api/auth/login` | Nhận email **hoặc** username trong cùng ô (`identifier` hoặc `username`) |
| C03b, C04 | `GET /api/rental-policy`, `GET /api/rental-policy/versions/{version}` | Bản chính sách hiện hành (công khai) và bản theo phiên bản; đơn lưu `policyVersion`, `acceptedAt`, `channel` khi khách đồng ý |
| S09 → khách | `POST /api/reservations/{id}/policy-consent` | Khách tự đồng ý khi thu tại quầy; nhân viên không tích thay |
| C14a | `POST /api/reservations/{id}/cancel` | Giữ phí 10% cọc (D27); thêm `bankName`, `accountNumber` (6–19 chữ số), `accountHolder` để hoàn vào tài khoản chính chủ |
| C08 | `POST /api/contracts/{id}/renewals` | Chỉ nhận trước EndDate; phải kèm đồng ý chính sách hiện hành |
| M03 | `POST /api/ops/renewals/{id}/approve` | Chốt giá, tạo `RENEWAL` `PENDING` hạn 24 giờ; **không đổi EndDate** |
| C11q | `POST /api/payments/{id}/payos` | Thu khoản `RENEWAL`; thu đủ đúng một lần mới đổi EndDate |
| C09 | `POST /api/contracts/{id}/move-out` | Bắt buộc ảnh kho trống và tài khoản nhận hoàn chính chủ; QR/PIN hết hiệu lực và phí quá hạn dừng ngay khi thành công |
| S04 | `POST /api/ops/returns/{id}/inspection` | Thêm `damageFee`, `cleaningRequired`, `feeReason`, `photos[]`; vệ sinh = 10% cọc cố định |
| M07 | `POST /api/ops/contracts/{id}/refund` | Chỉ chốt số; tổng khấu trừ ≤ cọc; tạo `REFUND` `PENDING`; ô cần vệ sinh giữ `MAINTENANCE` |
| Hoàn cọc | `GET /api/ops/deposit-refunds`, `POST /api/ops/deposit-refunds/actions` | Quản lý nhập `transactionRef` → `REFUND` `PAID` ("Đã hoàn") |
| Quá hạn | Chính sách `OVERDUE` | `CalculationType` `DEPOSIT_PERCENT_PER_DAY` (mặc định 5), tối đa 100% cọc; job hằng ngày tạo `OverdueCase` |
| Sự cố | `POST /api/ops/incidents`, `POST /api/contracts/{id}/incident-choice`, `POST /api/ops/incidents/{id}/complete-transfer` | Đổi ô tương đương không phụ phí, hoặc kết thúc với hoàn tháng đang thuê + tháng chưa dùng + 100% cọc |
| C12-0 | `GET/POST /api/support/inquiries` | Hỗ trợ khi chưa có hợp đồng: `facilityId`, `topic`, `description` |
| Cửa kho | `POST /api/access/scan` | 10 lượt/phút; quá giới hạn trả `DENIED` kèm lý do tạm dừng |

Bỏ khỏi hợp đồng: thu hồi QR/PIN thủ công (`POST /api/staff/credentials/{id}/revoke`), công nợ sau trả kho và các API trả phí phát sinh sau trả kho. Phân quyền chỉ theo vai trò và cơ sở phụ trách, không kiểm PermissionCode.

Các dòng cũ trong mục 0 ("Yêu cầu hỗ trợ bắt buộc ContractId", "Đăng nhập chỉ bằng Username") là hiện trạng backend tại thời điểm viết; hướng xử lý hiện hành theo bảng trên.
