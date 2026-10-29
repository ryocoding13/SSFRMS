# BACKEND-TODO — việc backend (StorageProject.Api) còn thiếu cho giao diện SafeSpace

Cập nhật 01/10/2026, đối chiếu với `main` (commit `5177812`). Bổ sung 26/10/2026: mục "D32" ngay dưới đây là danh sách việc hiện hành. Giao diện đã gọi hết các endpoint backend đang có.
Phần nào backend chưa có thì giao diện **tạm lưu trong trình duyệt** (mất khi đổi máy / xoá dữ liệu) và sẽ tự dùng
API ngay khi backend có — không cần sửa giao diện nếu làm đúng hợp đồng dưới đây.

Chạy thử hợp đồng không cần .NET: `MOCK_OPS=1 npm run dev:mock` (máy chủ giả lập `mock/mock-api.mjs` đã làm đủ các
endpoint mục A–B; `tests/ops-api.test.mjs` kiểm tra từng endpoint). Backend làm đúng như mock là giao diện chạy.

## D32 — Việc BE/FE theo chính sách chốt 26/10/2026 (ưu tiên cao nhất)

Nguồn: `DECISIONS.md` D32. Áp dụng cho mọi hợp đồng. Mục nào dưới đây mâu thuẫn với phần cũ của tài liệu này thì theo D32.
Mã việc khớp kế hoạch "SafeSpace — Kế hoạch hoàn thiện cập nhật 26–31/10/2026".

| Mã | Việc | Endpoint / chỗ sửa | Người | Mức |
|---|---|---|---|---|
| T02 | Duyệt gia hạn chỉ tạo khoản `RENEWAL` `PENDING`, hạn thanh toán = min(duyệt + 24 giờ, EndDate); **không đổi EndDate** khi duyệt. Hết hạn thanh toán → renewal `EXPIRED` | `FacilityOpsService.ApproveRenewalAsync`, `ManagerService` (route cũ) | Đạt | P0 |
| T03 | PayOS cho khoản thu: tạo link theo `paymentId`; webhook ghi `RENEWAL` `PAID`, renewal `PAID`, rồi mới đặt `EndDate = NewEndDate` (đúng một lần) | `POST /api/payments/{id}/payos` → `PayosCheckoutDto` (mục P3 bên dưới) | Đạt | P0 |
| T04 | Khách chọn trả gia hạn tại quầy; nhân viên xác nhận thu | `POST /api/renewals/{id}/counter-payment`; board `counterRenewals[]` + `POST /api/ops/counter-renewals/actions` `{action:"COLLECT_RENEWAL"}` (xem `APPROVED-FE-API-GAPS.md`) | Đạt | P1 |
| T05 | Biên bản trả kho lưu phí và ảnh | `POST /api/ops/returns/{id}/inspection` nhận thêm `damageFee`, `cleaningRequired`, `feeReason`, `photos[]` (ảnh kho trống bắt buộc); lưu `ReturnInspection.DamageFee/CleaningFee/CleaningRequired`. Vệ sinh = 10% cọc cố định, không nhập tay | Ngọc Mai | P0 |
| T06 | Quyết toán trả kho: tổng khấu trừ ≤ `DepositAmount`; bỏ `Debt`; không để khoản `DAMAGE_FEE`/`OVERDUE_FEE` nào ở trạng thái chờ thu sau quyết toán | `RefundPolicy.Calculate`, `ConfirmRefundAsync`, `RefundPolicyTests` | Ngọc Mai | P0 |
| T07 | Hoàn cọc hai bước: M07 chốt → `REFUND` `PENDING`; màn hoàn cọc ghi `transactionRef` → `PAID`. Ô cần vệ sinh giữ `MAINTENANCE` | `POST /api/ops/contracts/{id}/refund` (chỉ chốt số), `GET /api/ops/deposit-refunds`, `POST /api/ops/deposit-refunds/actions` `{action:"CONFIRM_DEPOSIT_REFUND", id, transactionRef}` | Ngọc Mai | P0 |
| T08 | Tài khoản nhận hoàn chính chủ khi huỷ đơn và khi gửi trả kho: `bankName`, `accountNumber` (6–19 chữ số), `accountHolder` (trùng tên hợp đồng) | `POST /api/reservations/{id}/cancel`, `POST /api/contracts/{id}/move-out` | Ngọc Mai | P1 |
| T09 | Phí quá hạn = `DepositAmount × rate × số ngày trễ`, tối đa `DepositAmount`; dừng khi gửi trả kho. Thêm `CalculationType` `DEPOSIT_PERCENT_PER_DAY` cho chính sách `OVERDUE` (mặc định 5) | `RefundPolicy.OverdueFeeFor`, seed/B02, test | Tiến | P0 |
| T11 | Job quá hạn mỗi ngày: EXPIRING/OVERDUE, tạo `OverdueCase`, cộng phí theo ngày không trùng, mốc nhắc ngày 10–14, việc xử lý đồ ngày 20 | Worker mới (giống `ExpiredCashHoldWorker`) | Tiến | P1 |
| T12 | Hồ sơ quá hạn ngày 20 | `GET /api/ops/overdue-cases`, `POST /api/ops/overdue-cases/actions` `{action:"ASSIGN_REMOVAL" hoặc "RECORD_REMOVAL"}` | Tiến | P1 |
| T13 | Sự cố cơ sở: quản lý ghi nhận và đề xuất ô thay thế; khách chọn đổi ô hoặc kết thúc; quản lý xác nhận hoàn tất chuyển (cấp mã ô mới, ô cũ `MAINTENANCE`) hoặc tạo khoản hoàn = tháng đang thuê + tháng chưa dùng + 100% cọc | Đề xuất: `POST /api/ops/incidents`, `POST /api/contracts/{id}/incident-choice` `{choice:"TRANSFER" hoặc "TERMINATE"}`, `POST /api/ops/incidents/{id}/complete-transfer` `{unitCode, movedAt}` | Tiến | P1 |
| T15 | Gỡ thu hồi mã | Bỏ `POST /api/staff/credentials/{id}/revoke` và `StaffService.RevokeCredentialAsync`; FE bỏ `REVOKE_CREDENTIAL` | Tiến, Thắng | P0 |
| T16 | Giới hạn quét 10 lượt/phút ở `POST /api/access/scan`; trả `result:"DENIED"`, `reason` kiểu "Tạm dừng quét, thử lại sau 60 giây" (màn C07r3) | `AccessService` | Tiến | P1 |
| T17 | Route cũ phải lọc cơ sở hoặc bị chặn, bắt đầu từ `StaffService.SubmitReturnInspectionAsync`. Phân quyền chỉ theo vai trò + cơ sở, không kiểm PermissionCode | `StaffEndpoints`, `ManagerEndpoints` | Tiến | P0 |
| T18 | Đăng nhập bằng email hoặc username | `AuthService.LoginAsync` | Ngọc Mai | P1 |
| T19 | Hỗ trợ khi chưa có hợp đồng (C12-0): khách chọn cơ sở + chủ đề; nhân viên đúng cơ sở trả lời | `GET/POST /api/support/inquiries`, `POST /api/support/inquiries/actions` `{action:"REPLY_INQUIRY"}` | Ngọc Mai | P1 |
| T20 | Phiên bản chính sách và bằng chứng đồng ý | `GET /api/rental-policy` (công khai, bản hiện hành), `GET /api/rental-policy/versions/{version}`, `POST /api/rental-policy/actions` (OPERATIONS); lưu `policyVersion`, `acceptedAt`, `channel` theo đơn/hợp đồng/gia hạn; `POST /api/reservations/{id}/policy-consent` cho khách tự xác nhận khi thu tại quầy | Đạt (BE), Thắng (FE) | P0 |
| T10 | FE đồng bộ: phí quá hạn và số hoàn lấy từ BE; bỏ chữ "5% giá thuê tháng"; ẩn luồng trả phí/công nợ sau trả kho (C11d, C11fq, C11fc, C11e, S09f…); hiện "Chờ hoàn"/"Đã hoàn" | FE | Thắng | P0 |

Không làm: thu hồi QR/PIN thủ công; công nợ sau trả kho; thanh toán phí phát sinh sau trả kho qua PayOS hoặc tại quầy (`POST /api/payments/{id}/at-facility`, `feeCollections`, `POST /api/ops/fees/{id}/confirm`).

### Bàn giao FE T10 / T15 — 26/10

FE đã ẩn phí trả kho đang chờ thu ở C11, bỏ route S09f/queue/badge và adapter thu phí, gỡ adapter `REVOKE_CREDENTIAL`; vẫn giữ luồng tiền thuê/gia hạn và cấp lại mã.

**Điều kiện mở M07:** `GET /api/ops/board` (và board staff/manager nếu dùng) bổ sung `returnPolicyVersion: "D32"` chỉ sau khi T05–T09 được triển khai/kiểm chứng: lưu phí kiểm kê, cap cọc, không debt, chốt `REFUND PENDING`, không ghi `PAID` và giữ kho `MAINTENANCE` khi cần vệ sinh/sửa. Thiếu marker thì FE không gọi POST chốt trả kho; đây là hợp đồng tích hợp bổ sung của bản vá, BE hiện tại chưa có. Không dùng marker để thay kiểm tra nghiệp vụ ở server.

POST refund tiếp tục trả số `refund` do BE tính. FE không lấy ước tính demo thay tiền hoàn của API. Tiến trình chuyển tiền đọc riêng API deposit-refunds; không tự báo đã hoàn từ thao tác chốt. S04 gửi `cleaningRequired` và `cleaningFee` cố định 10% để tương thích adapter hiện có, BE phải tự tính lại từ cọc chứ không tin số FE. API hiện tại chưa đảm bảo lưu đủ phí: T05 vẫn cần Mai hoàn thiện.

Phần T08 (ảnh trống/ngân hàng), T20 (bằng chứng đồng ý), sự cố/khắc phục và BE T15 vẫn chưa làm trong gói này. Không đánh dấu toàn bộ D32 hoàn thành.

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
`code` chỉ là mã tham chiếu (không chứa bí mật). Hết hiệu lực khi biên bản trả kho được lập (S04) hoặc hợp đồng kết thúc. (D31: hết hiệu lực ngay khi khách gửi yêu cầu trả kho thành công; không có thu hồi thủ công.)
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
| M03 | `POST /api/ops/renewals/{id}/approve` | — | `ContractRenewal` → APPROVED, cập nhật `EndDate` hợp đồng (**D31 thay: chưa đổi EndDate khi duyệt, xem T02**) |
| M03 | `POST /api/ops/renewals/{id}/reject` | `{ reason }` | `reason` rỗng → 400; gửi lý do cho khách |
| M07 | `POST /api/ops/contracts/{id}/reminders` | `{ note }` | Ghi lịch sử nhắc khách (`OverdueCase`) |
| M07 | `POST /api/ops/contracts/{id}/refund` | — | Chỉ sau biên bản trả kho. Hoàn cọc = cọc − khoản còn nợ; kho → `AVAILABLE`; hợp đồng đóng (**D31 thay: khấu trừ tối đa bằng cọc, REFUND `PENDING`, ô cần vệ sinh giữ `MAINTENANCE`, xem T06–T07**) |
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
| Đăng nhập | D32: đã bổ sung code nhận **email hoặc username** qua `{username, password}`; giữ HTTP 401 hiện có cho sai thông tin | FE login đã xử lý riêng 401; còn kiểm chứng SQL Server của nhóm |
| Hỗ trợ (C12) | Cho gửi khi **chưa có hợp đồng** (`ContractId` không bắt buộc); nhận ảnh đính kèm (multipart, ≤3 ảnh, ≤5 MB). D31 giữ, xem T19 | Chưa có hợp đồng thì không gửi được; ảnh lưu cục bộ |

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
- Hư hỏng vật lý hoặc quá hạn: trừ `DamageFee` và `OverdueFee` vào phần cọc còn lại; vượt cọc thì hoàn 0 đ và ghi công nợ. (**D31 thay: không ghi công nợ, tổng khấu trừ tối đa bằng cọc.**)
- Quá hạn: đọc tham số `OVERDUE` từ cấu hình B02, không hard-code. (D31: 5% cọc ban đầu mỗi ngày, tối đa 100% cọc, xem T09.)
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

> **D31 (26/10/2026):** không còn công nợ sau trả kho. Chỉ giữ việc lưu phí ở biên bản (T05) và trừ trong phạm vi cọc (T06). Các mục thanh toán phí qua PayOS, trả tại quầy và `feeCollections` bên dưới **không làm**.

Giao diện đã làm theo Figma; backend cần bổ sung:

- `POST /api/ops/returns/{id}/inspection` (`OpsReturnInspectionRequest`): nhận thêm `damageFee`, `cleaningFee`, `cleaningRequired`, `feeReason`; lưu vào `ReturnInspection.DamageFee` / `CleaningFee` / `CleaningRequired` (cột đã có, `ConfirmRefundAsync` đang đọc) và ghi khoản `DAMAGE_FEE` / `CLEANING_FEE` trạng thái `PENDING` để M07 trừ cọc theo D27, phần thiếu thành công nợ.
  - Cập nhật 25/10: S04 **bỏ ô nhập phí quá hạn** vì `ConfirmRefundAsync` đã tự tính phí quá hạn theo số ngày trễ (chính sách `OVERDUE`); nhập tay sẽ tính trùng. Giao diện không gửi `overdueFee` nữa.
  - `OpsReturnReportDto` trong `GET /api/ops/board` trả thêm `damageFee`, `cleaningFee`, `cleaningRequired`, `feeReason`. Khi chưa có, S04 hiện "Máy chủ chưa lưu phí phát sinh…" và M07 không có dòng phí.
- `POST /api/ops/contracts/{id}/refund` (M07a): giao diện gửi body `{ note }` (ghi chú khi xác nhận trả kho); endpoint hiện bỏ qua body — cần lưu vào activity log. Phản hồi `{ refund }` đang được dùng để hiện số hoàn cọc thực tế.
- Khách trả phí qua PayOS: `POST /api/payments/{paymentId}/payos` cho khoản phí `PENDING` (cùng endpoint giao diện đang dùng cho gia hạn; hiện backend chưa có nên popup báo "tạm gián đoạn").
- Khách chọn trả tại quầy (C11fc): API ghi nhận lựa chọn, ví dụ `POST /api/payments/{paymentId}/at-facility`. Giao diện tạm lưu trong trình duyệt (`overlay.feesAtCounter`).
- Nhân viên thu tại quầy (S09f): `GET /api/ops/board` trả `feeCollections[]` `{ id, contract, customer, unit, items: [[nhãn, số tiền]], amount, due, status, requestedAt }` và `POST /api/ops/fees/{id}/confirm` chuyển các khoản sang `PAID`.

## C08 / T20 — hợp đồng đã merge trên main, FE sửa trong Batch04 (28/10/2026)

Thay đề xuất của Batch02: đã đối chiếu `RentalPolicyDtos.cs`, `RenewalDtos.cs`, `RenewalService.cs` trên main `c1a9b05`.

- `GET /api/rental-policy` trả `{rate, sections, version, displayVersion, updatedAt}`; **không có** `renewalConsentSupported`. FE kiểm phiên bản hợp lệ và đọc lại trước POST.
- `POST /api/contracts/{id}/renewals`: `{renewalPeriodMonths, policyVersion: number, accepted: true}`. Không gửi thời điểm client làm bằng chứng. Response `RenewalDto` có `policyVersion` và `acceptedAt` ở cấp ngoài cùng, không phải `policyConsent` lồng.
- FE chỉ báo thành công khi version và timestamp server hợp lệ. Nếu server nhận yêu cầu nhưng thiếu evidence, refresh và yêu cầu kiểm tra hồ sơ; không tự POST lại.
- Mapper giữ `PAID` / `EXPIRED`, `paymentDeadlineAt`, `appliedAt`, `expiredAt`; không biến hết hạn thành chờ duyệt. Gia hạn quá hạn không có nút thanh toán; backend vẫn quyết định trạng thái cuối cùng.
- Mã BE đã có không đồng nghĩa tích hợp thật đã đạt: cần kiểm SQL Server/PayOS của nhóm, mutation khi policy đổi, yêu cầu trùng và atomicity của ghi renewal + consent. Hiện service có hai SaveChanges, chưa bọc giao dịch chung trong task FE này.
- C04a xác nhận chính sách trước thanh toán chưa có luồng FE; C15b xem phiên bản theo hợp đồng còn thiếu mapping/DTO evidence. Không gán giả bản hiện hành thành bản khách đã đồng ý.
- C11k dùng GET payment qua services.checkPaid, không tự xác nhận khách đã chuyển tiền.

## Figma–FE đợt03 — hợp đồng tích hợp đề xuất T08 / ảnh trả kho / theo dõi hoàn

Ngày 27/10/2026. **Chỉ FE đã làm; các endpoint/field bổ sung dưới đây chưa được xác nhận có trên BE.** Không bật capability trước khi server thực hiện toàn bộ điều kiện. Không thay đổi DTO/migration BE trong patch này.

### Huỷ đơn đã thanh toán

- `GET /api/rental-policy` bổ sung `cancellationBankSupported: true` khi endpoint huỷ hỗ trợ ngân hàng chính chủ. FE kiểm lại trước POST. Đơn chưa thanh toán vẫn dùng API cũ, không bắt buộc ngân hàng.
- `POST /api/reservations/{id}/cancel` giữ `reason`, thêm `bankName`, `accountNumber` (chuỗi 6–19 chữ số, giữ số 0 đầu), `accountHolder`.
- Server kiểm quyền sở hữu, ngày bắt đầu, tên tài khoản với tên lưu trên hợp đồng, trạng thái tiền thật và chống huỷ trùng. Huỷ trước StartDate hoàn 100% tiền thuê +90% cọc; không coi response preview là kết quả chuyển tiền.
- GET reservations tiếp tục trả `refundAmount`, `refundStatus` sau khi huỷ; server lưu ngân hàng cho hồ sơ hoàn, không chỉ nhận rồi bỏ qua. UI thành công dùng số từ bản ghi đọc lại, không dùng preview để khẳng định số thực tế.

### Gửi trả kho

- `GET /api/rental-policy` bổ sung `returnRequestSupported: true` chỉ khi server lưu ảnh/ngân hàng và đảm bảo QR/PIN hết hiệu lực, dừng phí ngay lúc nhận thành công, không cho huỷ yêu cầu, chống gửi trùng. FE chặn server cũ.
- `POST /api/contracts/{id}/move-out`: giữ `{date, slot, note}`; thêm `{bankName, accountNumber, accountHolder, emptied:true, photos:[{fileName,contentType,dataBase64}]}`.
- Đây là JSON contract đề xuất để dùng HTTP client hiện tại; tối đa5 ảnh JPG/PNG, mỗi ảnh giải mã ≤5MiB. Nếu BE chọn upload riêng/signed URL, phải đổi adapter FE và kiểm tích hợp trước bật capability. Với JSON, cần giới hạn request phù hợp (khoảng35MiB), kiểm kích thước trước/sau giải mã, định dạng ảnh thực, xử lý tên tệp an toàn, lưu ảnh và yêu cầu nguyên tử; không tin MIME/đuôi tệp hoặc validation FE.
- Không nhận hợp đồng kết thúc/chưa bắt đầu/đang gia hạn hoặc đã có yêu cầu trả; phải cho xử lý hợp đồng quá hạn. Gửi thành công dừng phí theo thời điểm server, không theo ngày kiểm tra khách chọn. Server kiểm ngày giờ Việt Nam, slot và quyền sở hữu, không phụ thuộc múi giờ thiết bị.
- GET contracts nên trả `customerName` là tên trên hợp đồng để FE đối chiếu; thiếu snapshot FE chỉ kiểm đủ trường, server vẫn phải kiểm chính chủ. Mapper giữ trạng thái `RETURN_PENDING`, không mở gửi lại trên thiết bị khác.
- Demo lưu ngân hàng + metadata ảnh vào trình duyệt, không lưu bytes ảnh vào localStorage. Preview dùng object URL và được thu hồi khi xoá/rời màn. Demo có thông báo rõ, không phải chứng cứ ảnh đã gửi cơ sở.

### Khách xem hoàn cọc

- Đề xuất `GET /api/deposit-refunds`, chỉ trả hồ sơ thuộc khách đang đăng nhập; FE không dùng `/api/ops/deposit-refunds` cho khách nữa. Staff/Manager giữ endpoint `/api/ops/*`. Không dựa vào lọc ownerId ở FE để bảo vệ dữ liệu.
- Schema mỗi dòng: `{id, ownerId, contractId, unit, deposit, overdue, cleaning, damage, amount, status, bankName, accountNumber, requestedAt, inspectedAt, approvedAt, paidAt, refundDueDate, transactionRef, inspectionNote, photos:[{url}]}`. `PENDING` là chờ hoàn, `PAID` chỉ sau ghi nhận chuyển tiền. `amount` do server tính; không tin phép tính FE.
- Timestamp/ảnh/ngân hàng thiếu hiển thị "Chưa có thông tin", không lấy ngày trong Figma để điền. `unpaid` legacy chỉ hiện "Khấu trừ khác (dữ liệu cũ)", không tạo nút thu hoặc công nợ; BE cần chuyển sang phân rã D32 chính xác. URL ảnh phải thuộc quyền khách, server cấp URL HTTPS có thời hạn; không trả ảnh hồ sơ khác.
- Danh sách đơn huỷ vẫn theo refunds của reservations; màn này chỉ hoàn cọc sau trả kho. Không trộn hai nguồn để tự báo đã chuyển.

Chưa kiểm API/SQL Server/PayOS thật. T08 và các điều kiện T05–T09 vẫn cần owner BE triển khai và nhóm kiểm tích hợp.


## Batch05 — C04a, C15/C15b và giới hạn T20 (28/10/2026)

### FE đã nối đúng endpoint đang có

- `GET /api/rental-policy`: kiểm đủ 7 sections và version số dương; không dùng policy mẫu khi API lỗi.
- `POST /api/reservations/{id}/policy-consent`: `{policyVersion: number, accepted: true}`; FE đọc lại policy trước POST, kiểm `consentId`, `customerId`, `policyVersion`, `acceptedAt`, `channel` từ server. Khách tự tích checkbox, chưa lưu được thì không mở QR hoặc chọn trả tại quầy.
- FE kiểm consent ở cả UI và provider khi gọi PayOS/chọn quầy; không chỉ dựa vào nút disabled. Đồng ý cũ khác version hiện hành sẽ yêu cầu đọc lại.
- Response xác nhận được cache trong overlay đúng user/đơn để tiếp tục thanh toán và reload trên cùng thiết bị. **Cache không phải cơ chế bảo mật của backend**. Không tự biến cache thành bằng chứng gốc theo hợp đồng.
- `GET /api/rental-policy/versions/{version}`: tải đúng bản trong bằng chứng, kiểm version trả về; không fallback sang bản hiện hành nếu version cũ lỗi/404.
- C15b đọc bằng chứng gia hạn đã có trong `RenewalDto`. Phân biệt rõ hồ sơ gia hạn với lần đặt chỗ/ký hợp đồng ban đầu.

### BE còn thiếu / cần tích hợp trước nghiệm thu toàn luồng

1. **Đọc lại bằng chứng ban đầu:** hiện `ReservationDetailDto` và `ContractDetailDto` chưa trả `policyConsent`. Đề nghị bổ sung DTO (không phải khẳng định endpoint đã có): `{consentId, customerId, policyVersion, displayVersion, acceptedAt, channel}` lấy từ dữ liệu đã lưu theo ReservationId/ContractId, lọc quyền chủ sở hữu ở server. FE đã đọc optional `policyConsent`; thiếu thì C15b hiện “Chưa có bằng chứng đồng ý”, không giả version/timestamp. Thiết bị mới mất cache checkout sẽ phải xác nhận lại có chủ ý, không tự POST khi mở trang.
2. **Chặn giao dịch ở server:** trước tạo checkout PayOS, thu tiền mặt/thu tại quầy, phải kiểm bằng chứng khách đã đồng ý theo đơn và quy tắc version đã chốt. Không lấy cache FE, `acceptedAt` client hoặc tick từ nhân viên làm bằng chứng. FE mới chỉ chặn các lời gọi từ ứng dụng khách; API trực tiếp và màn nhân viên vẫn cần server bảo vệ. Không sửa BE trong Batch05.
3. **Idempotency/retry:** RecordReservationConsentAsync hiện thêm một bản ghi mỗi POST; cần BE owner kiểm retry khi mạng mất phản hồi, trùng người dùng/đơn/version và lựa chọn bằng chứng được hiển thị. FE chống bấm lặp nhưng không thể bảo đảm exactly-once trên mạng.
4. Kiểm dữ liệu policy seed/version tồn tại, foreign key của consent, owner khác, token hết hạn, đổi policy giữa GET/POST, SQL Server và cả PayOS/thu quầy thật.
5. C15b chỉ xem lại nội dung đã đồng ý; không tự thay phạm vi D32 đang áp dụng cho hợp đồng hiện hữu. Không dùng câu “bản mới không thay đổi hợp đồng cũ” để đảo D32. Nội dung policy do backend cung cấp cần được nhóm publish nhất quán với DECISIONS.

Không đánh dấu T20 toàn hệ thống đã đạt chỉ từ kiểm FE hoặc HTTP mock. Mock T20 trong `mock/mock-api.mjs` chỉ dùng môi trường opt-in, không chứng minh BE thật đã có các điều kiện trên.


## Batch06 — hư hỏng/khắc phục: contract API ĐỀ XUẤT, chưa có trên main c1a9b05

FE đã dựng ba màn D30-13/18/18b; không sửa BE/schema và không chứng minh tích hợp thật. Cần BE owner thống nhất contract trước khi nối/triển khai, không dùng capability hoặc dữ liệu demo để báo đã xử lý.

- GET `/api/damage-cases` (CUSTOMER owner), GET `/api/ops/damage-cases` (MANAGER/FACILITY_MANAGER đúng cơ sở) → `{items:[DamageCase]}`.
- DamageCase: `id`, `contractId` chuỗi; `ownerId`, `facilityId` số nguyên dương; `version` số nguyên dương; `status`, `settlementStatus: OPEN|FINALIZED`; `damageAmount` số >=0; `unit`, `item`, `customer`, `recordedBy`, `recordedAt`; `photos:[{url,caption?}]`. URL ảnh HTTPS hoặc root-relative có kiểm quyền truy cập. Không public ảnh khách trái owner/cơ sở.
- `response:{choice:AGREE|REMEDIATE|DISPUTE,note,at,files:[{fileName}],photos?}`; `decision:{decision:ALLOW|REJECT,note,at}`, `deadline` ISO server; `remediation:{note,at,files,photos?}`; `inspection:{result:PASS|FAIL,note,at}`. Metadata và evidence được server lưu/đọc lại, không chỉ tên tệp.
- Finance preview từ server: `deposit`, `otherDeductions`, `damageDeduction`, `refundPreview`, `refundIfRemedied` số >=0; thiếu hiện chưa có dữ liệu. Nếu nhiều hạng mục, cần định nghĩa preview đúng cấp hợp đồng, không cộng hoặc trừ lặp. Không tin số tiền/owner/facility do client gửi.
- POST `/api/damage-cases/actions` hoặc `/api/ops/damage-cases/actions` → `{case:DamageCase}` với **version mới** và stage đúng; payload chung `{action,id,expectedVersion}`.

| Action | Bổ sung | Quy tắc server |
|---|---|---|
| RESPOND_DAMAGE | choice, note, photos? | AWAITING_RESPONSE → AGREE: CUSTOMER_ACCEPTED; REMEDIATE/DISPUTE: RESPONSE_SUBMITTED. Note bắt buộc với 2 lựa chọn sau |
| DECIDE_DAMAGE_RESPONSE | decision, deadline?, note | RESPONSE_SUBMITTED → ALLOW: REMEDIATION_ALLOWED + deadline tương lai; REJECT: REJECTED + lý do bắt buộc |
| REPORT_DAMAGE_REMEDIATION | note, photos? | REMEDIATION_ALLOWED trước hạn → AWAITING_INSPECTION, note bắt buộc |
| INSPECT_DAMAGE_REMEDIATION | result, note | AWAITING_INSPECTION → PASS: REMEDIATED + damageDeduction=0 đúng hạng mục; FAIL: REMEDIATION_FAILED giữ khoản trừ. Note bắt buộc |

`photos` đề xuất là `[{fileName,contentType,dataBase64}]`, tối đa 5 ảnh JPEG/PNG, 5MiB/ảnh: validate signature/size/type và giới hạn request phía server; lưu private, trả URL có quyền. Note tối đa 1000 ký tự. Server lấy actor/time/deadline theo clock có thẩm quyền (FE nhập giờ VN +07:00), kiểm owner/facility/role, stage/version và settlement OPEN trong cùng transaction. 409 khi version cũ; không tạo duplicate khi retry; cần idempotency/receipt có thể đọc lại khi mạng lỗi. FE buộc reload khi không xác minh acknowledgement, chưa có idempotency key riêng.

Khi cho khắc phục vẫn giữ deduction đến inspection PASS; bỏ đúng khoản rồi tính lại refund cap trong tiền cọc, không tạo nợ/thu thêm. Không tự đánh dấu refund PAID hoặc mở QR/PIN. Cần nối T05/T06/M07: chặn chốt trong giai đoạn phản hồi/khắc phục/kiểm tra đang mở, xử lý quá hạn minh bạch trước chốt; không tự chốt chỉ vì client hết hạn. Lưu audit/history, không cho sửa sau FINALIZED. Luồng chuyển tiền hoàn vẫn xác nhận riêng hai bước theo D32. Cần kiểm API .NET/SQL Server thật với đồng thời/retry/quyền và nhiều hạng mục.


## Batch07 — T13 sự cố cơ sở: API ĐỀ XUẤT, chưa có trên main c1a9b05

FE có D30-10/16/16b; không triển khai BE/schema và chưa chứng minh tích hợp thật. Cần BE owner thống nhất contract dưới đây; giữ các đường T13 đề xuất trước, bổ sung GET/save/send/terminate/version/evidence.

### Đọc và khởi tạo nháp

- GET `/api/incidents` (CUSTOMER owner, chỉ hồ sơ đã gửi) và GET `/api/ops/incidents` (MANAGER/FACILITY_MANAGER đúng cơ sở) → `{items:[IncidentCase]}`. Manager response cần gồm descriptor `DRAFT` có ID/version từ server cho hợp đồng đủ điều kiện và các candidates đúng cơ sở. FE không tự tạo ID hoặc dựng hợp đồng API. SAVE/SEND tại POST incidents mới persist ghi nhận; server phải tái kiểm điều kiện. Nếu chọn endpoint tạo draft riêng thì điều chỉnh adapter/UI chọn hợp đồng tương ứng trước tích hợp.
- IncidentCase: chuỗi `id,contractId,oldUnitId,oldUnit,unitType,customer,startDate,endDate`; số nguyên dương `ownerId,facilityId,version,sizeM2`; `contractStatus` (`ACTIVE|EXPIRING` mới cho mutation); `monthlyRate` số VND nguyên dương, `deposit,currentMonthRent,unusedRent` số VND nguyên >=0. Số hoàn = toàn bộ tháng đang thuê + tháng nguyên chưa dùng + 100% cọc, không chia theo ngày và không phạt 30% cọc.
- `status: DRAFT|PROPOSED|TRANSFER_PENDING|TRANSFERRED|TERMINATION_PENDING|TERMINATED`; `description,affectedAt` ISO UTC, `confirmed:true`, `proposal:TRANSFER|TERMINATE`; `photos:[{url,caption?}]`, `files:[{fileName,contentType?,size?}]`; ảnh URL private HTTPS/root-relative kiểm owner/cơ sở.
- `candidates:[Unit]`, `targetUnit:Unit|null`; Unit `{id,code,facilityId,type,sizeM2,status,version,reservedFor?}`. Tương đương = cùng cơ sở/loại/diện tích; AVAILABLE hoặc RESERVED cho đúng incident. Dùng ID/version, không chỉ code hiển thị. Server tái kiểm tại send/choice/complete. Không phụ phí hoặc đổi kỳ/giá/cọc hợp đồng.
- `choice:{choice:TRANSFER|TERMINATE,note,at}` do **khách tự xác nhận**, server timestamp/audit; `refundBank:{bankName,accountNumber,accountHolder}` cho TERMINATE, validate chính chủ. Không cho manager gửi thay. Note/description tối đa1000 ký tự. Ngày FE nhập theo VN +07:00, độ chính xác phút; server dùng timestamp có thẩm quyền.

### Ghi, acknowledgement và transaction

Payload chung có `action,id,expectedVersion`, response `{incident:IncidentCase}` version mới; client không gửi tiền/owner/facility/giá để server tin theo.

| Endpoint đề xuất | Action / payload bổ sung | Stage / tác động server |
|---|---|---|
| POST `/api/ops/incidents` | SAVE_INCIDENT / SEND_INCIDENT_PROPOSAL; description, affectedAt, confirmed:true, proposal, targetUnitId?, expectedTargetVersion?, photos? | DRAFT→DRAFT hoặc PROPOSED. Chỉ send mới gửi khách; giữ target, chống hai hợp đồng giữ cùng ô. Không đổi credential/contract/payment |
| POST `/api/contracts/{contractId}/incident-choice` | CHOOSE_INCIDENT_OPTION; choice, note, targetUnitId/expectedTargetVersion (TRANSFER) hoặc refundBank (TERMINATE) | PROPOSED→TRANSFER_PENDING/TERMINATION_PENDING. Đúng owner, incident và contract. Không để manager chọn thay. Chọn kết thúc giải phóng ô đề xuất đã giữ |
| POST `/api/ops/incidents/{id}/complete-transfer` | COMPLETE_INCIDENT_TRANSFER; targetUnitId, expectedTargetVersion, movedAt, confirmed:true | TRANSFER_PENDING→TRANSFERRED sau đã chuyển đồ thực tế; currentUnit=target.code, movedAt; oldUnitStatus=MAINTENANCE; target OCCUPIED; access={oldUnit:INVALID,newUnit:ISSUED}; surcharge=0. Giữ nguyên kỳ/giá/cọc |
| POST `/api/ops/incidents/{id}/terminate` | FINALIZE_INCIDENT_TERMINATION; confirmed:true | TERMINATION_PENDING→TERMINATED, contractStatus=ENDED, oldUnitStatus=MAINTENANCE, access.oldUnit=INVALID, tạo refund={id,amount,status:PENDING}. Không ghi PAID ở bước này |

Nhánh manager đối chiếu trước khi chốt kết thúc là contract FE đề xuất, cần thống nhất với BE owner; nếu server kết thúc nguyên tử ngay khi khách chọn thì phải đổi adapter/state/receipt tương ứng, không ép receipt sai thành thành công. GET sau này được trả refund PAID với `transactionRef,paidAt` khi chuyển tiền đã được ghi nhận ở nghiệp vụ riêng; FE không tự tạo mã giao dịch.

`photos` đề xuất `[{fileName,contentType,dataBase64}]`, tối đa5 JPG/PNG, mỗi ảnh5MiB; server kiểm signature/type/size/quota và lưu thật, trả metadata/URL có quyền. Lưu bổ sung ảnh không được xoá ảnh cũ khi payload không có ảnh; dedupe khi retry/save rồi send. Demo chỉ metadata, không làm bằng chứng đã lưu ảnh thật.

Khóa SQL Server/transaction theo contract+incident+unit+credential/refund: ngăn gửi/chọn/complete lặp, staleversion trả409, target thay đổi trả conflict, retry idempotent không tạo 2 refund/cấp mã 2 lần. Bảo đảm chỉ xác nhận complete mới đổi mã, mã mới gắn đúng ô; server/máy quét kiểm thật. Không API thu hồi mã thủ công. Không tự set AVAILABLE cho ô bị sự cố/không đủ an toàn. Phải lưu choice, actor, timestamp, evidence và audit, GET đọc lại đúng sau mất mạng; cần idempotency key/receipt độc lập cho retry, FE hiện mới có expectedVersion và reload khi không xác minh kết quả.

Contract đã ENDED/RETURN_PENDING/OVERDUE hoặc đang có xử lý xung đột không được mutation qua luồng này; backend tái kiểm chứ không dựa guard FE. Xử lý renewal/return/settlement đồng thời cần cùng khóa và quy tắc ưu tiên nghiệp vụ. Contract/list lịch sử cần còn đọc được sau kết thúc để khách theo dõi; board/map/access/cọc/refund cập nhật đồng bộ. API .NET/SQL Server/thiết bị cửa và nhiều khách/cơ sở/ô cạnh tranh chưa kiểm. Blocker BE của các batch trước giữ nguyên.


## Batch08 — T05–T08/T11–T12, S02/M07/M08: contract FE bổ sung, chưa có đầy đủ trên main c1a9b05

Không sửa BE/schema trong task này. Các marker bên dưới là đề xuất tích hợp, **server chỉ công bố sau khi đã triển khai và kiểm chứng**; không bật từ FE/env hoặc mock để giả hỗ trợ. Cờ không thay server authorization/validation/transaction.

| Phần | JSON / yêu cầu server |
|---|---|
| S02 mới (436:13163) | Board `verificationChecklistSupported:true`. POST `/api/ops/verifications/{id}` nhận `{originalDocumentValid:true,photoMatched:true,infoMatched:true,bookingMatched:true}`; không DocNumber. Lưu actor/time/checklist, board đọc status DONE/verifiedAt/checklist. API hiện bắt DocNumber nên FE chặn; không điền giả. DTO legacy vẫn serialize được cho caller cũ, Page mới không dùng |
| Nhận chìa khóa | POST `/api/ops/keys/{id}/receipt` thêm `{identityChecked,conditionChecked,keyDelivered}`. Kiểm xác minh thật tồn tại/DONE, hợp đồng/đã thu đúng, staff/cơ sở. Giữ idempotency, không đổi kỳ/status contract/credential QR-PIN. Board handovers trả status DONE/doneAt; đọc `policyConsent:{version,acceptedAt,channel,displayVersion?}` đúng evidence, không tạo consent từ thao tác nhân viên |
| Kiểm kê S04 | Board `inspectionEvidenceSupported:true`. POST inspection giữ4 mục và `damageFee,cleaningFee,cleaningRequired,damageItem,feeReason,photos:[{fileName,contentType,dataBase64}]`. Server tính vệ sinh10% cọc, không tin tiền client; ảnh bắt buộc khi damage>0, kiểm signature/quota/type JPG-PNG/5ảnh/5MiB. Lưu ảnh private và DTO report trả `photos:[{url,caption?}]`, đủ phí/lý do/hạng mục. Board returns cần requestedAt/overdueFee tại thời điểm dừng, không dùng scheduledAt làm thời điểm dừng phí |
| M07 | Giữ returnPolicyVersion:D32, thêm `returns[].damageWorkflowResolved:true` chỉ khi không còn phản hồi/khắc phục chờ xử lý. `damageCasesPending:[{contractId}]` nếu còn mở; mapper FE đổi snake_case. Kiểm ở transaction khi chốt, không tin client. POST refund trả `{refund:number,refundStatus:"PENDING"}`, board contract CLOSED; không PAID, giữ MAINTENANCE khi cần. Lưu ghi chú, khoản hoàn0 đóng NO_REFUND không tạo giao dịch chuyển tiền |
| M08 | Board `refundEvidenceSupported:true`; `refunds[]` có `bankName,accountNumber,accountHolder` chính chủ từ T08, amount/status rõ. POST `/api/ops/reservations/{id}/refund` nhận BANK_TRANSFER/transactionRef/transferredAt(ISO UTC)/confirmed:true. Lưu đọc lại PAID/transactionRef/paidAt và thời điểm chuyển thực tế, không chỉ trả refund:number. Không giả định hoàn về tài khoản nguồn PayOS; kể cả khách trả cash cũng hoàn vào bank chính chủ |

### Hoàn cọc sau đối soát — endpoint còn đề xuất

GET `/api/ops/deposit-refunds` trả **array**: `[{id,facilityId,ownerId,contractId,unit,customer,version,deposit,overdue,cleaning,damage,amount,status:PENDING|PAID|NO_REFUND,inspectedAt,bankName,accountNumber,accountHolder,transactionRef?,paidAt?}]`. Không dùng unpaid/debt legacy để thu ngoài cọc. Chưa có amount thì không được biến thành0; amount=0 không chuyển tiền.

POST `/api/ops/deposit-refunds/actions` `{action:"CONFIRM_DEPOSIT_REFUND",id,expectedVersion,transactionRef,transferredAt,confirmed:true}` → `{item:<refund DTO>}` với version mới, status PAID, đúng id/owner/cơ sở/contract/bank/amount và transactionRef/paidAt. FE đã kiểm những trường này khi acknowledgement; raw200/receipt sai cần reload, không giả thành công. Bank được khách khai trước, không nhập thay tại màn chuyển tiền; số tài khoản UI mask nhưng server giữ đủ để đối chiếu có quyền. Mọi hoàn tiền cần mã, giờ thực tế không tương lai/không trước đối soát, checkbox rõ; server clock/audit là nguồn bằng chứng.

### Biên bản xử lý đồ — endpoint còn đề xuất

GET `/api/ops/overdue-cases` trả array có facilityId, assigneeId (server userId), assignee (tên), endDate, removalDay, status và record. Tỷ lệ cap cọc không quyết định ngày được xử lý đồ. Mốc mặc định D32 là20; policy/server phải trả mốc, không xử lý sớm do đổi tỷ lệ. Cần thống nhất với BE owner cách quản lý removalDay trong OVERDUE; FE không tự sửa chính sách hệ thống.

POST `/api/ops/overdue-cases/actions` `{action:"RECORD_REMOVAL",id,performedAt:ISO,inventory,location,unitStatus:INSPECTION|MAINTENANCE,confirmed:true,beforePhotos:[{fileName,contentType,dataBase64}],afterPhotos:[...]}` → `{item:<case DTO>}` status DONE, facilityId, record.savedAt/beforePhotos/afterPhotos đã lưu và truy cập có quyền. Ít nhất1 ảnh trước/1 sau; mỗi nhóm tối đa5 ảnh, 5MiB/ảnh. Server kiểm assigneeId/cơ sở/thời điểm thực hiện đủ mốc và actor; không chỉ so lúc bấm lưu. Không tự đưa ô về AVAILABLE, không suy ra quyền thanh lý tài sản.

Mọi thao tác tiền/inspection/access cần transaction SQL Server, version/concurrency và idempotency (retry không chuyển/tạo khoản refund hai lần). Frontend chặn local click lặp/readback sai/network/409/5xx và buộc reload, chưa thay bảo vệ server. Cần test trạng thái trước/sau commit, reload lỗi, nhiều tab/máy, assignment/return/renewal/hư hỏng đồng thời, lưu/đọc bank/ảnh thật. Demo LocalStorage chỉ metadata ảnh và không có transaction đa thiết bị. T08 còn cần owner/bank trong returns; thiếu thì M07 demo tạo pending nhưng không đoán dữ liệu hoặc cho xác nhận chuyển tiền.
