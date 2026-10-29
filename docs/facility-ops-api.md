# API Nhân viên cơ sở & Quản lý cơ sở (`/api/ops/*`)

Dành cho role **STAFF** (Figma S01–S09) và **MANAGER** (M01–M08). Code: `StorageProject.Api/Endpoints/FacilityOpsEndpoints.cs`,
`StorageProject.Infrastructure/Services/FacilityOpsService*.cs`. Giao diện gọi ở `src/ops/api.js`.

Tài khoản seed (cùng cơ sở **SafeSpace Nguyễn Lương Bằng**): `staff01` / `Staff@123`, `staff02` / `Staff@123`,
`manager01` / `Manager@123`.

Quy ước chung:

- Mỗi tài khoản chỉ thấy và sửa dữ liệu của **cơ sở đang được phân công** (SRS A06, bảng `user_facilities`).
  Chưa được phân công → **403**. Dữ liệu cơ sở khác → **404**.
- Thao tác của quản lý gọi bằng tài khoản nhân viên → **403**. Quản lý làm được mọi thao tác của nhân viên.
- Lỗi: `400 { error }` dữ liệu sai / sai trạng thái · `403 { error }` · `404 { error }`. Thành công: `200 { message }`.
- `id` trong đường dẫn là **mã hiển thị**, giống mã khách thấy: `SS-20261014-0012` (đơn đặt chỗ), `XM-0007` / `BG-0007`
  (xác minh / bàn giao), `TK-0003` (trả kho), `HT-0005` (hỗ trợ), `GH-0002` (gia hạn), `HĐ-2026-0004` (hợp đồng),
  `PC-BG-0007` (công việc), `NV-02` (nhân viên).
- Ngày `yyyy-MM-dd`; ngày giờ là **giờ Việt Nam** `yyyy-MM-ddTHH:mm:ss` (DB vẫn lưu UTC). Tiền là số VND.
- Mọi thao tác ghi `activity_logs`. Những thông tin bảng chưa có cột (giấy tờ đã xác minh, biên bản trả kho,
  phản hồi hỗ trợ, lý do từ chối gia hạn, lần nhắc khách) cũng đọc lại từ đây — D18.

## 1. Bảng dữ liệu — `GET /api/ops/board`

Mẫu JSON ở cuối `BACKEND-TODO.md`. Nhân viên nhận: `facility, me, staff, units, payments, verifications, handovers,
returns, tickets`. Quản lý nhận thêm: `allocations, renewals, contracts, assignments, revenue`.

| Phần | Lấy từ | Ghi chú |
|---|---|---|
| `units` | `storage_units` + hợp đồng đang giữ ô | `EMPTY` · `WAITING_HANDOVER` (RESERVED) · `ACTIVE` · `EXPIRING` (hết hạn trong 14 ngày) · `OVERDUE` · `INSPECTION` · `MAINTENANCE` |
| `payments` (S09) | đơn `PENDING_VERIFICATION` | `PENDING`; `MISMATCH` nếu nhân viên đã báo sai lệch; `CONFIRMED` hiện thêm 3 ngày |
| `verifications`, `handovers` (S02, S03) | `handover_records` | `SCHEDULED` → `TODO`/`WAITING`; `VERIFIED` → xác minh `DONE`; `HANDED_OVER` → bàn giao `DONE` |
| `returns` (S04) | `return_inspections` | `unpaid` = khoản PENDING/FAILED của hợp đồng |
| `tickets` (S05) | `support_tickets` của ô / hợp đồng tại cơ sở | `OPEN` · `IN_PROGRESS` · `WAITING_CUSTOMER` (DB `RESOLVED`) · `DONE` (DB `CLOSED`) |
| `allocations` (M05) | đơn `CONFIRMED` chưa có ô | `minArea = maxArea` = diện tích loại kho |
| `renewals` (M03) | `contract_renewals` `PENDING` (+ đã quyết trong 14 ngày) | |
| `contracts` (M07) | hợp đồng `OVERDUE` / chờ gia hạn / đã có biên bản trả kho | `state`: `OVERDUE` · `RENEWAL` · `RETURNED` · `RESOLVED` · `CLOSED` |
| `assignments` (M06) | bàn giao, trả kho, hỗ trợ chưa xong | `staff = null` → `OPEN` (chưa giao ai) |
| `revenue` (M04) | `payments` đã thu 6 tháng, theo giờ VN | Triệu đồng; không gồm cọc và hoàn tiền; `byType` là của tháng này |

## 2. Nhân viên (STAFF, MANAGER)

| Màn | Endpoint | Body | Kết quả |
|---|---|---|---|
| S09 | `POST /api/ops/payments/{id}/confirm` | — | Đơn `PENDING_VERIFICATION` → `CONFIRMED`, vào hàng phân bổ của quản lý |
| S09 | `POST /api/ops/payments/{id}/mismatch` | `{ note }` | Ghi sai lệch; đơn vẫn chờ đối soát. `note` rỗng → 400 |
| S02 | `POST /api/ops/verifications/{id}` | `{ docType, docNumber, photoMatched, infoMatched }` | Số giấy tờ 9/12 số hoặc hộ chiếu 1 chữ + 7 số; hai ô đối chiếu phải `true`. **Chỉ lưu 4 số cuối.** → `VERIFIED` |
| S03 | `POST /api/ops/handovers/{id}/complete` | `{ unlockMethod: "CARD" \| "PIN" \| "FINGER" }` | Chưa xác minh → 400. Hợp đồng `ACTIVE`, ô `OCCUPIED`, đơn `CHECKED_IN`, cấp `access_credentials` |
| S04 | `POST /api/ops/returns/{id}/inspection` | `{ items, walls, keys, proposal }` | Đủ 4 mục. Hợp đồng `RETURN_PENDING`, ô `INSPECTION`, thu hồi thẻ / mã |
| S05 | `POST /api/ops/tickets/{id}/responses` | `{ note, nextStatus: "IN_PROGRESS" \| "WAITING_CUSTOMER" \| "DONE" }` | Ghi phản hồi; chưa có người nhận thì giao cho người phản hồi |

## 3. Quản lý cơ sở (MANAGER)

| Màn | Endpoint | Body | Kết quả |
|---|---|---|---|
| M05 | `POST /api/ops/allocations/{id}` | `{ unitCode }` | Ô phải `AVAILABLE` và **đúng loại kho** của đơn. Tạo `unit_assignments`, hợp đồng `DRAFT`, khoản cọc + thuê `PAID`, lịch bàn giao; ô `RESERVED` |
| M06 | `PUT /api/ops/assignments/{id}` | `{ staffId }` | `id` = `PC-BG-…` / `PC-TK-…` / `PC-HT-…`; nhân viên phải cùng cơ sở |
| M03 | `POST /api/ops/renewals/{id}/approve` | — | `APPROVED`, đổi ngày hết hạn hợp đồng, tạo khoản `RENEWAL` chờ thanh toán |
| M03 | `POST /api/ops/renewals/{id}/reject` | `{ reason }` | `reason` rỗng → 400 |
| M07 | `POST /api/ops/contracts/{id}/reminders` | `{ note }` | Ghi lần nhắc; ca quá hạn → `CONTACTED` |
| M07 | `POST /api/ops/contracts/{id}/refund` | — | Chỉ sau biên bản trả kho. Hoàn = cọc − khoản còn nợ (khoản nợ được trừ vào cọc). Hợp đồng `COMPLETED`, ô `AVAILABLE`. Trả `{ message, refund }` |

## 4. Khách báo đã chuyển khoản (F03)

`POST /api/reservations/{id}/confirm-transfer` (tài khoản khách, chủ đơn):

- `PENDING_PAYMENT` → `PENDING_VERIFICATION` (trạng thái mới, migration `20261014150000_ReservationPendingVerification`).
- Gọi lại khi đã chờ đối soát → 200, không đổi gì. Đơn ở trạng thái khác → 400.
- Quá `expiresAt` → đơn `EXPIRED`, trả `400 { error, code: "EXPIRED" }`.
- Đơn chờ đối soát vẫn giữ chỗ khi tính số ô trống (`/api/availability/check`, tạo đơn mới).

## 4b. D32 · Hoàn cọc, ảnh trả kho, sự cố cơ sở (29/10, nhánh `feature/be-t05-t07-t08-t13-flags`)

Chi tiết hợp đồng JSON: `BACKEND-TODO.md` mục "Cập nhật BE 29/10", Batch07, Batch08; quyết định kỹ thuật: `DECISIONS.md` D34.

| Endpoint | Vai trò | Ghi chú |
|---|---|---|
| `POST /api/ops/verifications/{id}` | STAFF, MANAGER | Checklist 4 mục (`originalDocumentValid`, `photoMatched`, `infoMatched`, `bookingMatched`) |
| `POST /api/ops/keys/{id}/receipt` | STAFF, MANAGER | Checklist 3 mục nếu gửi |
| `POST /api/ops/returns/{id}/inspection` | STAFF, MANAGER | Phí hư hỏng, vệ sinh 10% cọc, lý do, hạng mục, ảnh |
| `POST /api/ops/contracts/{id}/refund` | MANAGER | Trả `{refund, refundStatus: PENDING \| NO_REFUND}` |
| `GET /api/ops/deposit-refunds`, `POST /api/ops/deposit-refunds/actions` | MANAGER (GET cả STAFF) | `CONFIRM_DEPOSIT_REFUND`; 409 khi `expectedVersion` cũ |
| `POST /api/ops/reservations/{id}/refund` | MANAGER | `{method, transactionRef, transferredAt, confirmed}` |
| `GET /api/deposit-refunds` | CUSTOMER | Chỉ hồ sơ của mình |
| `GET/POST /api/ops/incidents`, `POST /api/ops/incidents/{id}/complete-transfer`, `/terminate` | MANAGER | T13 |
| `GET /api/incidents`, `POST /api/contracts/{contractId}/incident-choice` | CUSTOMER | T13, khách tự chọn |
| `GET /api/evidence-photos/{id}?exp=&sig=` | URL có chữ ký | Ảnh bằng chứng, hết hạn 1 giờ |

Board bổ sung `verificationChecklistSupported`, `inspectionEvidenceSupported`, `refundEvidenceSupported`, `returnPolicyVersion`, `refunds[]`, `returns[].requestedAt/overdueFee/damageWorkflowResolved/report.photos`.

## 5. Chạy thử nhanh

1. Xoá database cũ cho sạch (seed D17 chỉ thêm phần thiếu, không xoá dữ liệu cũ): trong SSMS xoá database
   `SSFRMS` (tên trong chuỗi kết nối `appsettings.json`), rồi chạy API — migration + seed tự chạy.
2. `dotnet run --project StorageProject.Api --launch-profile http`, rồi `npm run dev` ở thư mục giao diện.
3. Khách `customer01` đặt kho → C04 chọn "Tại cửa hàng" → "Xác nhận đặt chỗ" (đơn vào hàng chờ thu tiền). Thanh toán QR PayOS tự xác nhận qua webhook, không vào S09 (D19, D21).
4. `staff01` → Thu tiền → "Xác nhận đã thu" đơn vừa đặt. `manager01` → Phân bổ → chọn ô trống đúng loại → Phân công cho `staff01`.
5. `staff01` → Xác minh khách → Bàn giao. Ô chuyển "Đang hoạt động" ở `manager01` → Ô kho.
