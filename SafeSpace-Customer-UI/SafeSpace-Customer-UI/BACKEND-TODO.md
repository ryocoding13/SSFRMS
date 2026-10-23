# BACKEND-TODO — việc backend (StorageProject.Api) còn thiếu cho giao diện SafeSpace

Cập nhật 01/10/2026, đối chiếu với `main` (commit `5177812`). Giao diện đã gọi hết các endpoint backend đang có.
Phần nào backend chưa có thì giao diện **tạm lưu trong trình duyệt** (mất khi đổi máy / xoá dữ liệu) và sẽ tự dùng
API ngay khi backend có — không cần sửa giao diện nếu làm đúng hợp đồng dưới đây.

Chạy thử hợp đồng không cần .NET: `MOCK_OPS=1 npm run dev:mock` (máy chủ giả lập `mock/mock-api.mjs` đã làm đủ các
endpoint mục A–B; `tests/ops-api.test.mjs` kiểm tra từng endpoint). Backend làm đúng như mock là giao diện chạy.

## Mới 16/10/2026 — API cho các màn đồng bộ Figma (PayOS, thanh toán tại kho, QR mở cửa, F12)

Giao diện **đã gọi sẵn** các endpoint dưới đây (`src/shared/api/customerApi.js`, `src/features/customer/access/accessApi.js`, `src/features/facility-operations/api/facilityOperationsApi.js`).
Backend chưa có route → giao diện **không báo lỗi**: hiện thông báo thay thế (bảng cột "Khi chưa có") cho tới khi backend
làm xong. Máy chủ giả lập đã làm đủ (`npm run dev:mock`), `tests/payment-api.test.mjs` kiểm tra từng endpoint. Làm đúng
tên route + tên trường JSON là giao diện chạy ngay, không phải sửa giao diện. JSON camelCase như các endpoint đang có.

| Mục | Endpoint | Người làm | Khi chưa có (404/405) |
|---|---|---|---|
| P1 | ~~`POST /api/reservations/{id}/payos`~~ — **đã nối** vào `POST /api/reservations/create-payos-qr` `{ reservationId }` có sẵn trên main (16/10) | Đạt | — |
| P2 | `POST /api/reservations/{id}/pay-at-facility` → `ReservationDto` | Đạt | Giao diện gọi `confirm-transfer` (đã có) → đơn vẫn vào S09 chờ thu tiền |
| P3 | `POST /api/payments/{id}/payos` → `PayosCheckoutDto`; `GET /api/payments/{id}` (đã có) để hỏi trạng thái | Đạt | Popup C11q báo "đang tạm gián đoạn, thanh toán tại quầy" |
| P4 | Webhook PayOS — **đã có** `POST /api/payments/payos-webhook` (webhook đổi đơn sang `CONFIRMED`) | Đạt | — (giao diện hỏi trạng thái 3 giây/lần) |
| Q1 | `GET /api/contracts/{id}/access-qr` → `AccessQrDto` | Tiến | Popup C07q báo "Mã QR đang được cơ sở kích hoạt" |
| Q2 | `POST /api/access/scan` `{ code }` → `ScanResultDto` (cho phép không đăng nhập — máy quét ở cửa) | Tiến | Màn `#/door` báo "Máy quét chưa kết nối được hệ thống" |
| R1 | `GET /api/tickets/{id}` trả thêm `responses[]` | Ngọc Mai | C12 không hiện dòng phản hồi |
| H1 | **Đã viết (D27)** `GET /api/reservations/{id}/cancel-preview` → `CancelPreviewDto`; `ReservationDto` thêm `refundAmount`, `refundStatus` (`PENDING` / `COMPLETED`). Chờ nhóm build và kiểm thử | Ngọc Mai, Đạt, Thắng | C14a ghi "Theo chính sách hiện hành / Cơ sở xác nhận sau khi huỷ" |
| U1 | **Đã nối** `PUT /api/staff/units/{mã}/status` `{ status, reason }` có sẵn trên main (nhân viên + quản lý). Còn thiếu: kiểm chuyển tiếp hợp lệ, bắt buộc lý do, trạng thái `INSPECTION` | Thắng | — |

### P · PayOS (D19) và thanh toán tại cửa hàng
```json
// PayosCheckoutDto — P1, P3 (gọi lại khi đơn PayOS còn hạn thì trả lại đúng đơn cũ, không tạo mới)
{ "orderCode": 100001, "amount": 4600000, "description": "SS0142", "status": "PENDING",
  "qrCode": "000201010212385700...6304ABCD", "checkoutUrl": "https://pay.payos.vn/web/...", "expiredAt": "2026-10-16T08:10:00Z" }
```
- `qrCode`, `checkoutUrl` lấy nguyên từ PayOS SDK (`createPaymentLink`). Giao diện vẽ `qrCode` thành ảnh QR, kèm link `checkoutUrl`.
- `amount` của P1 = `estimatedAmount + requiredDeposit` (thuê cả kỳ + cọc 1 tháng). P3 = số tiền khoản `RENEWAL`.
- `expiredAt` = thời gian giữ chỗ. Giao diện đếm ngược theo giá trị nhỏ hơn giữa `expiredAt` và 10 phút (`VITE_PAYMENT_TIMEOUT_SECONDS=600`);
  hết giờ giao diện gọi `POST /api/reservations/{id}/cancel` như cũ. **Backend đặt `expiredAt` 10 phút** cho khớp Figma C04.
- Webhook (P4): kiểm chữ ký bằng SDK + Checksum Key, đúng `orderCode`, đúng `amount`, gửi trùng chỉ ghi một lần. Đặt chỗ: đơn
  `PENDING_PAYMENT` → `CONFIRMED` (hoặc `PAID`; giao diện coi cả hai là "Đã thanh toán", `UNIT_ASSIGNED` cũng vậy) và ghi khoản
  thuê + cọc `PAID`. Gia hạn: payment `RENEWAL` → `PAID`, renewal → `PAID`, `contracts.end_date` = `newEndDate`.
- Giao diện hỏi trạng thái bằng `GET /api/reservations/{id}` (đặt chỗ) và `GET /api/payments/{id}` (gia hạn, `status: "PAID"`).
- Lúc quản lý phân bổ ô (M05) với đơn đã trả qua PayOS: gắn các khoản đã thu vào hợp đồng, **không tạo khoản mới**.
- P2 thanh toán tại cửa hàng: đơn `PENDING_PAYMENT` → trạng thái chờ thu (dùng `PENDING_VERIFICATION` sẵn có, hoặc trạng thái mới
  `PENDING_AT_FACILITY` — giao diện hiểu cả hai), ghi `paymentMethod: "AT_FACILITY"` trong `ReservationDto`, giữ chỗ 24 giờ
  (job nền tự huỷ khi quá hạn), huỷ link PayOS đang mở của đơn. `GET /api/ops/board` phải đưa đơn này vào `payments[]` để hiện
  ở S09; nhân viên xác nhận bằng `POST /api/ops/payments/{id}/confirm` (đã có). Đơn trả PayOS **không** vào `payments[]`.
- Board `payments[]` nên trả thêm `rent`, `deposit`, `months` (S09 dòng "Gồm"); chưa có thì giao diện tự tách từ `amount`.

### Q · QR mở cửa (Tiến) — mô phỏng, không dùng thiết bị thật
```json
// AccessQrDto — Q1: chỉ chủ hợp đồng, hợp đồng đã bàn giao (HANDED_OVER) và còn hiệu lực; sai → 400 { "error": "..." }
{ "contractId": 86, "code": "SSQR-86-4821", "backupCode": "4821 9037", "unitNumber": "B-015",
  "unitType": "Kho lạnh", "location": "Tầng 1 · Dãy B", "validUntil": "2026-12-25" }
// ScanResultDto — Q2: nhận code hoặc backupCode; luôn trả 200, kết quả nằm trong "result"; ghi activity_logs mỗi lần quét
{ "result": "OPEN", "unitNumber": "B-015", "customerName": "Nguyễn Thị Mai", "contractCode": "HĐ-2026-0086",
  "scannedAt": "2026-10-16T03:32:00Z", "reason": null }
{ "result": "DENIED", "reason": "Mã đã hết hiệu lực — hợp đồng đã trả kho.", "unitNumber": "B-015", ... }
```
`code` chỉ là mã tham chiếu (không chứa bí mật). Hết hiệu lực khi biên bản trả kho được lập (S04) hoặc hợp đồng kết thúc.
Hợp đồng quá hạn có khoá QR hay không: nhóm chốt (giao diện chỉ hiện `reason` backend trả về).

### R · Phản hồi hỗ trợ (Ngọc Mai)
`SupportTicketDetailDto` thêm `"responses": [{ "message": "Thẻ cũ bị lỗi từ…", "staffName": "Trần Văn Long", "createdAt": "2026-09-14T04:02:00" }]`
(lấy từ phản hồi S05, hiện đang nằm trong `activity_logs`). Giao diện cũng đọc `note`/`content` nếu đặt tên khác.

### H · Huỷ đơn đã thanh toán (Ngọc Mai)
```json
// CancelPreviewDto — theo D27 (ví dụ: cọc 1.150.000 đ, tiền thuê 3.450.000 đ)
{ "paidAmount": 4600000, "cancellationFee": 115000, "refundAmount": 4485000, "policyName": "Huỷ trước ngày bắt đầu: phí 10% tiền cọc, hoàn đủ tiền thuê và 90% tiền cọc" }
```
`POST /api/reservations/{id}/cancel` (đã có, nhận `PENDING_PAYMENT` / `CONFIRMED`) với đơn đã trả: ghi một khoản `REFUND` (`PENDING`, `BANK_TRANSFER`), trả
`refundAmount` + `refundStatus: "PENDING"` trong `ReservationDto` để C14b hiện "Đã huỷ · Đang hoàn tiền".

### U · Đổi trạng thái ô kho — F12 (Thắng)
`PUT /api/ops/units/{code}/status` `{ "status": "MAINTENANCE", "reason": "Hỏng khoá cửa" }` — chỉ `MANAGER`, đúng cơ sở.
Trạng thái theo từ của board: `EMPTY` (DB `AVAILABLE`), `MAINTENANCE`, `INSPECTION`. Chỉ cho: `EMPTY ↔ MAINTENANCE`,
`INSPECTION → EMPTY | MAINTENANCE`; ô đang có khách → 400. Thiếu lý do → 400. Ghi `unit_status_history` (dùng lại
`FacilityOpsService.SetUnitStatus`). Board `units[]` nên trả thêm `history[]` `{ from, to, reason, by, at }` (không bắt buộc).

---

## Đã nối API (không cần làm thêm)
`/api/auth/register · login · logout`, `/api/facilities`, `/api/unit-types`, `/api/rates`, `/api/availability/check`,
`/api/reservations` (tạo, xem, huỷ), `/api/contracts` (+ payments, renewals), `/api/handovers/{id}/confirm`,
`/api/tickets`, toàn bộ `/api/admin/*`. Sơ đồ 10 ô kho ở trang chi tiết cơ sở đã lấy **số ô trống thật** của từng
loại kho từ `/api/availability/check`.

---

## A. Ưu tiên 1 — chặn luồng chính

> **Đã làm (14/10/2026, nhánh `feature/ops-backend`, D18):** toàn bộ A1–A4 theo đúng bảng dưới. Tài liệu API:
> `docs/facility-ops-api.md`. Còn lại: chạy thử với SQL Server rồi đổi F03, F11–F21 sang `passing`.

### A1. Dữ liệu seed & phân quyền
- [x] `DbSeeder`: thêm tài khoản **quản lý cơ sở** `manager01 / Manager@123` (role `MANAGER`); hiện chỉ có `staff01`.
- [x] Gán `UserFacility` cho `staff01` và `manager01` (ví dụ cơ sở SafeSpace Nguyễn Lương Bằng). Mọi endpoint mục A2–A3
      chỉ trả / cho sửa dữ liệu của cơ sở được gán.
- [x] Gán quyền cho role `STAFF` (`HANDOVER_MANAGE`, `RETURN_MANAGE`, `TICKET_MANAGE`, `PAYMENT_CONFIRM`) và `MANAGER`
      (thêm `UNIT_MANAGE`, `ASSIGNMENT_MANAGE`, `RENEWAL_MANAGE`, `REPORT_VIEW`). Hiện chỉ `ADMIN` có quyền.
- [x] Endpoint mục A2 cho role `STAFF` **và** `MANAGER`; mục A3 chỉ `MANAGER` (sai vai trò → **403**).

### A2. Khu Nhân viên cơ sở (Figma S01–S09) — chưa có endpoint nào
Bảng trong DB đã có sẵn (`HandoverRecord`, `ReturnInspection`, `UnitAssignment`, `MaintenanceRequest`, `Payment`,
`AccessCredential`), chỉ thiếu service + endpoint.

| Màn | Endpoint | Body | Việc backend làm |
|---|---|---|---|
| Tất cả | `GET /api/ops/board` | — | Dữ liệu cơ sở được gán (mẫu JSON ở cuối). STAFF: `facility, me, staff, units, payments, verifications, handovers, returns, tickets`; MANAGER: thêm phần A3 |
| S09 | `POST /api/ops/payments/{id}/confirm` | — | Đơn đặt chỗ `PENDING_VERIFICATION` → `CONFIRMED`, ghi `Payment` PAID. Đơn chưa có kho → vào `allocations` của quản lý |
| S09 | `POST /api/ops/payments/{id}/mismatch` | `{ note }` | Ghi sai lệch, báo quản lý. `note` rỗng → 400 |
| S02 | `POST /api/ops/verifications/{id}` | `{ docType, docNumber, photoMatched, infoMatched }` | **Chỉ lưu 4 số cuối** giấy tờ. Hai ô đối chiếu phải `true`; số giấy tờ 9/12 số hoặc hộ chiếu → sai thì 400 |
| S03 | `POST /api/ops/handovers/{id}/complete` | `{ unlockMethod: "CARD" \| "PIN" \| "FINGER" }` | Chưa xác minh khách → 400. Xong: `HandoverRecord` hoàn tất (entity ghi `HANDED_OVER` nhưng `HandoverService` đang đặt `COMPLETED` — nên thống nhất), tạo `AccessCredential`, kho `OCCUPIED`, hợp đồng `ACTIVE` |
| S04 | `POST /api/ops/returns/{id}/inspection` | `{ items, walls, keys, proposal }` | Tạo `ReturnInspection`; kho → `INSPECTION`; hợp đồng chờ quản lý hoàn cọc |
| S05 | `POST /api/ops/tickets/{id}/responses` | `{ note, nextStatus: "IN_PROGRESS" \| "WAITING_CUSTOMER" \| "DONE" }` | Ghi phản hồi vào yêu cầu hỗ trợ của khách |

### A3. Khu Quản lý cơ sở (Figma M01–M08) — chưa có endpoint nào

| Màn | Endpoint | Body | Việc backend làm |
|---|---|---|---|
| M05 | `POST /api/ops/allocations/{id}` | `{ unitCode }` | Kho phải trống, đúng loại + diện tích → tạo `UnitAssignment`, `RentalContract`, lịch xác minh + `HandoverRecord`; kho → `RESERVED` |
| M06 | `PUT /api/ops/assignments/{id}` | `{ staffId }` | Giao việc (bàn giao / trả kho / hỗ trợ) cho nhân viên cùng cơ sở |
| M03 | `POST /api/ops/renewals/{id}/approve` | — | `ContractRenewal` → APPROVED, cập nhật `EndDate` hợp đồng |
| M03 | `POST /api/ops/renewals/{id}/reject` | `{ reason }` | `reason` rỗng → 400; gửi lý do cho khách |
| M07 | `POST /api/ops/contracts/{id}/reminders` | `{ note }` | Ghi lịch sử nhắc khách (`OverdueCase`) |
| M07 | `POST /api/ops/contracts/{id}/refund` | — | Chỉ sau biên bản trả kho. Hoàn cọc = cọc − khoản còn nợ; kho → `AVAILABLE`; hợp đồng đóng |
| M01/M02/M04 | (trong `GET /api/ops/board`) | — | `units` (12 ô của cơ sở, D17), `revenue` 6 tháng + cơ cấu theo loại kho, tỷ lệ lấp đầy tính từ `units` |

Luật nghiệp vụ chi tiết (điều kiện chặn, chuyển trạng thái) xem `src/features/facility-operations/state/facilityOperationsReducer.js` — có test `tests/ops.test.js`.

### A4. Khách báo đã chuyển khoản (Figma C04)
- [x] `POST /api/reservations/{id}/confirm-transfer` → đơn `PENDING_PAYMENT` chuyển `PENDING_VERIFICATION` (để hiện ở
      S09 của nhân viên). Hiện giao diện chỉ lưu trong trình duyệt nên **nhân viên không thấy khách đã chuyển**.
- [x] Thêm trạng thái `PENDING_VERIFICATION` cho `Reservation` (entity hiện liệt kê `PENDING_PAYMENT, CONFIRMED, UNIT_ASSIGNED, CHECKED_IN, CANCELLED, EXPIRED, NO_SHOW`).

---

## B. Ưu tiên 2 — đang chạy bằng dữ liệu tạm

| Việc | Endpoint / thay đổi | Giao diện đang tạm làm gì |
|---|---|---|
| Sơ đồ 10 ô kho (C03b-sđ) | `GET /api/facilities/{id}/units` → `unitId, unitNumber, floor, zone, unitTypeId, status` (công khai, không lộ khách thuê) | Tự xếp 10 ô theo loại kho, số ô trống lấy từ availability (`src/shared/utils/units.js`) |
| Bản đồ cơ sở (C02m) | Thêm `latitude, longitude` vào `Facility` + `FacilityDto` (cần migration) | Toạ độ gán cứng theo tên cơ sở (`src/app/config/geo.js`) |
| Đăng ký trả kho (C09) | `POST /api/contracts/{id}/move-out` `{ date, slot, note }` → tạo lịch trả kho (hiện ở S04 của nhân viên) | Lưu trong trình duyệt |
| Thông báo (chuông) | `GET /api/notifications`, `POST /api/notifications/read` `{ ids? }` | Lưu trong trình duyệt |
| Hồ sơ (C13) | `PUT /api/auth/profile` `{ fullName }`, `POST /api/auth/change-password`, `POST /api/auth/forgot-password` | Đổi tên lưu cục bộ; đổi / quên mật khẩu đang khoá |
| Đăng nhập | Cho đăng nhập bằng **email hoặc username**; sai mật khẩu trả **400** (không phải 401) | Khách đăng ký mới được đặt username = email |
| Hỗ trợ (C12) | Cho gửi khi **chưa có hợp đồng** (`ContractId` không bắt buộc); nhận ảnh đính kèm (multipart, ≤3 ảnh, ≤5 MB) | Chưa có hợp đồng thì không gửi được; ảnh lưu cục bộ |

## C. Ưu tiên 3 — chỉnh nhỏ
- [ ] JSON `DateTime` trả kèm `Z` (UTC); hiện đọc từ DB không có múi giờ, giao diện phải tự coi là UTC.
- [ ] Giữ chỗ: thanh toán QR 10 phút (Figma C04, `VITE_PAYMENT_TIMEOUT_SECONDS=600`), thanh toán tại cửa hàng 24 giờ (C04c) — backend đặt `ExpiresAt` / `expiredAt` PayOS theo hai con số này.
- [ ] Khu quản trị: ~~role `OPERATIONS` (Vận hành KD)~~ (đã có), ghi lịch sử đăng nhập thất bại, lọc nhật ký nhiều `action`.
- [x] API khu Vận hành KD (Figma B01–B05): `/api/operations/*`, role `OPERATIONS`, tài khoản `ops01` / `Ops@123` — hợp đồng ở `docs/operations-api.md`. Giao diện B01–B05 chưa có.

---

## Mẫu `GET /api/ops/board` (tài khoản MANAGER, mỗi mảng cắt còn 1 phần tử)
`id` là chuỗi (giao diện không tự đọc nghĩa), ngày `yyyy-MM-dd`, ngày giờ ISO. Tiền là số VND.

```json
{
  "facility": {
    "facilityId": 1,
    "name": "SafeSpace Nguyễn Lương Bằng",
    "address": "Số 12 Nguyễn Lương Bằng, Tân Phú, Quận 7"
  },
  "staff": [
    {
      "staffId": "NV-01",
      "fullName": "Trần Nhân Viên",
      "shift": "08:00–17:00"
    }
  ],
  "units": [
    {
      "code": "A-102",
      "tenant": "Nguyễn Thị Mai",
      "area": 12,
      "floor": 1,
      "type": "normal",
      "status": "WAITING_HANDOVER",
      "end": "2027-01-07"
    }
  ],
  "payments": [
    {
      "id": "SS-20260914-0142",
      "customer": "Nguyễn Thị Mai",
      "amount": 4600000,
      "method": "Chuyển khoản ngân hàng",
      "reportedAt": "2026-10-01T09:12:00",
      "memo": "SS 20260914 0142 MAI",
      "offer": "Kho thường · 10–20 m²",
      "start": "2026-10-07",
      "end": "2027-01-07",
      "pickup": "2026-10-07T09:00:00",
      "status": "PENDING"
    }
  ],
  "allocations": [
    {
      "id": "SS-20260912-0138",
      "customer": "Hồ Ngọc Hân",
      "type": "normal",
      "offer": "Kho thường · 10–20 m²",
      "minArea": 10,
      "maxArea": 20,
      "start": "2026-10-07",
      "end": "2027-01-07",
      "pickup": "2026-10-07T10:30:00",
      "status": "PENDING",
      "unit": null
    }
  ],
  "verifications": [
    {
      "id": "XM-0115",
      "reservationId": "SS-20260908-0115",
      "customer": "Võ Thị Hạnh",
      "unit": "A-115",
      "appointment": "2026-10-01T15:30:00",
      "status": "DONE",
      "docType": "Căn cước công dân",
      "docLast4": "4821",
      "verifiedAt": "2026-10-01T08:40:00"
    }
  ],
  "handovers": [
    {
      "id": "BG-0115",
      "verificationId": "XM-0115",
      "unit": "A-115",
      "customer": "Võ Thị Hạnh",
      "status": "WAITING",
      "method": null
    }
  ],
  "returns": [
    {
      "id": "TK-0098",
      "contract": "HĐ-0098",
      "unit": "C-012",
      "customer": "Lê Văn An",
      "appointment": "2026-10-07T10:00:00",
      "deposit": 1150000,
      "unpaid": 460000,
      "status": "SCHEDULED",
      "report": null
    }
  ],
  "tickets": [
    {
      "id": "HT-0082",
      "unit": "B-015",
      "customer": "Nguyễn Thị Mai",
      "title": "Thẻ ra vào không mở được cổng",
      "createdAt": "2026-10-01T09:45:00",
      "schedule": "2026-10-01T14:00:00",
      "status": "OPEN",
      "assignee": null,
      "notes": []
    }
  ],
  "renewals": [
    {
      "id": "GH-0208",
      "contract": "HĐ-0088",
      "customer": "Lê Văn Tùng",
      "unit": "C-208",
      "from": "2026-10-15",
      "to": "2027-01-15",
      "months": 3,
      "requested": "2026-09-30T10:05:00",
      "status": "PENDING"
    }
  ],
  "contracts": [
    {
      "id": "HĐ-0061",
      "customer": "Trần Quốc Bảo",
      "unit": "A-045",
      "end": "2026-09-28",
      "due": "Tiền thuê kỳ mới · Chưa thanh toán",
      "amount": 1250000,
      "state": "OVERDUE",
      "reminders": []
    }
  ],
  "assignments": [
    {
      "id": "PC-01",
      "title": "Bàn giao A-102 · Nguyễn Thị Mai",
      "when": "2026-10-07T09:00:00",
      "staff": "NV-01",
      "status": "ACCEPTED",
      "ref": "BG-0142"
    }
  ],
  "revenue": {
    "months": [
      {
        "label": "Tháng 9",
        "month": 9,
        "year": 2026,
        "value": 87
      },
      {
        "label": "Tháng 10",
        "month": 10,
        "year": 2026,
        "value": 92.4
      }
    ],
    "byType": [
      {
        "label": "Kho thường",
        "value": 58.4
      },
      {
        "label": "Kiểm soát nhiệt độ",
        "value": 34
      }
    ],
    "asOf": "2026-10-01"
  },
  "me": null
}
```

## D27 — Hoàn tiền và cọc (chốt 22/10/2026; code đã viết, chờ nhóm build và kiểm thử)

Nguồn: DECISIONS.md D27. Các việc backend cần làm:

- Hủy trước StartDate: `cancellationFee` = 10% `requiredDeposit` (không phải 10% tiền thuê như H1 cũ). `refundAmount` = tiền thuê đã thu + 90% cọc.
- Dừng sau StartDate (Move-out): hoàn 70% cọc, giữ 30%. Tiền thuê hoàn theo phương án B: tháng đang dùng tính đủ; các tháng nguyên vẹn chưa bắt đầu được hoàn.
- Trả kho sạch, đúng hạn: hoàn 100% cọc. Vi phạm vệ sinh cơ bản: trừ 10% cọc cố định.
- Hư hỏng vật lý hoặc quá hạn: trừ `DamageFee` và `OverdueFee` vào phần cọc còn lại; vượt cọc thì hoàn 0 đ và ghi công nợ.
- Quá hạn: đọc tham số `OVERDUE` từ cấu hình B02, không hard-code.
- Ghi trạng thái hoàn khi Quản lý xác nhận ở M07; chuyển khoản thủ công.
- Đồng bộ FE: appReducer.js `CANCEL_FEE_RATE` và màn C14a phải theo công thức trên.

Trạng thái triển khai D27 (22/10/2026):

- `StorageProject.Core/Policies/RefundPolicy.cs`: hàm thuần tính 3 tình huống (huỷ trước StartDate, dừng sớm, trả kho) kèm `OverdueFeeFor` đọc tham số `OVERDUE`; thiếu hoặc không hỗ trợ cấu hình thì báo lỗi, không tự đặt mức phí. Phí quá hạn: `PERCENTAGE` = % tiền thuê tháng mỗi ngày trễ, `FIXED` = số tiền cố định mỗi ngày trễ.
- `GET /api/reservations/{id}/cancel-preview` và `POST /api/reservations/{id}/cancel`: đơn đã thanh toán chỉ huỷ được trước StartDate (giờ Việt Nam); ghi đúng một khoản `REFUND` trạng thái `PENDING`.
- `POST /api/ops/reservations/{id}/refund` (M07, chỉ quản lý): xác nhận đã chuyển khoản hoàn cho đơn đã huỷ, `PENDING` → `PAID`, chỉ chạy được một lần.
- `POST /api/ops/contracts/{id}/refund` (M07): tính theo D27 từ biên bản trả kho. Trả trước EndDate = dừng sớm; trễ so với EndDate = quá hạn. Ghi một khoản `REFUND` gồm hoàn thuê + hoàn cọc; hư hỏng/quá hạn chỉ trừ trong phạm vi cọc, phần thiếu giữ trạng thái chưa thanh toán (công nợ).
- Giao diện: `cancelPreviewOf` (appReducer.js) tính 10% tiền cọc; C14a hiển thị phí và số hoàn theo đó. Còn thiếu: nút xác nhận hoàn cho đơn đã huỷ ở màn M07.
- Đường cũ `POST /api/manager/contracts/{id}/refund` giờ gọi chung `FacilityOpsService.ConfirmRefundAsync` (D27); đã bỏ `ManagerService.ConfirmRefundAsync` (trước đây đặt trạng thái `ENDED` không hợp lệ). Id phải là mã hiển thị `HĐ-…` như `/api/ops`; tài khoản ADMIN không có cơ sở được phân công nên nhận 403.
- F12 · RESERVED → OCCUPIED: `UnitStartActivation` (chạy cùng worker mỗi phút) chuyển ô đang giữ chỗ sang đang thuê khi hợp đồng ACTIVE/EXPIRING đến `StartDate` (giờ Việt Nam), ghi `unit_status_histories`. Nhận chìa khóa vẫn không đổi trạng thái ô (D26). Chuyển RESERVED/OCCUPIED bằng tay vẫn bị chặn ở `UnitStatusRules`.

## M08 — Hoàn tiền đơn huỷ trên giao diện quản lý (F40, 23/10/2026)

Giao diện `#/manager/refunds` (Figma M08 828:10212, M08a 828:10262) đọc danh sách từ `GET /api/ops/board` và gọi
`POST /api/ops/reservations/{id}/refund` (đã có, D27). Backend cần bổ sung:

- `GET /api/ops/board` trả thêm mảng `refunds` cho cơ sở của quản lý (đơn `CANCELLED` có khoản `REFUND`). Khi chưa có, trang hiện "Chưa có đơn huỷ cần hoàn tiền."
- Body của `POST /api/ops/reservations/{id}/refund`: nhận và lưu `method` (`BANK_TRANSFER`) và `transactionRef` (mã giao dịch quản lý nhập). Hiện endpoint bỏ qua body.

```jsonc
// GET /api/ops/board → refunds[] (camelCase; giao diện tự đổi sang snake_case)
{ "id": "SS-20260918-0151", "customer": "Nguyễn Hoàng Yến", "cancelledAt": "2026-10-22T08:40:00",
  "rent": 3450000, "deposit": 1150000, "paid": 4600000, "fee": 115000, "amount": 4485000,
  "status": "PENDING", "paidAt": null, "transactionRef": null }   // status: PENDING | PAID
```

## M02b / M02c — Thêm và sửa ô kho (F40)

`POST /api/manager/units` và `PUT /api/manager/units/{id}` đã có nhưng `CreateUnitAsync` luôn lấy loại kho đầu tiên và bỏ qua loại/cỡ.
Giao diện gửi `{ unitNumber, locationDescription, unitTypeCode: "normal" | "climate", area: 15 | 30 }`; backend cần chọn `UnitType`
theo loại kho + diện tích (D17: cỡ M 15 m², cỡ L 30 m²) và từ chối đổi loại/cỡ khi ô đang có khách thuê.

## Phí phát sinh khi trả kho và công nợ (F40: S04, S09f, C11f)

Giao diện đã làm theo Figma; backend cần bổ sung:

- `POST /api/ops/returns/{id}/inspection` (`OpsReturnInspectionRequest`): nhận thêm `damageFee`, `cleaningFee`, `overdueFee`, `feeReason`; ghi các khoản `DAMAGE_FEE` / `CLEANING_FEE` / `OVERDUE_FEE` trạng thái `PENDING` để M07 trừ cọc theo D27 và phần thiếu thành công nợ.
- Khách trả phí qua PayOS: `POST /api/payments/{paymentId}/payos` cho khoản phí `PENDING` (cùng endpoint giao diện đang dùng cho gia hạn; hiện backend chưa có nên popup báo "tạm gián đoạn").
- Khách chọn trả tại quầy (C11fc): API ghi nhận lựa chọn, ví dụ `POST /api/payments/{paymentId}/at-facility`. Giao diện tạm lưu trong trình duyệt (`overlay.feesAtCounter`).
- Nhân viên thu tại quầy (S09f): `GET /api/ops/board` trả `feeCollections[]` `{ id, contract, customer, unit, items: [[nhãn, số tiền]], amount, due, status, requestedAt }` và `POST /api/ops/fees/{id}/confirm` chuyển các khoản sang `PAID`.
