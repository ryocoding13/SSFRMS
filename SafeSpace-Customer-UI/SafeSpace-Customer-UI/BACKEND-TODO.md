# BACKEND-TODO — việc backend (StorageProject.Api) còn thiếu cho giao diện SafeSpace

Cập nhật 01/10/2026, đối chiếu với `main` (commit `5177812`). Giao diện đã gọi hết các endpoint backend đang có.
Phần nào backend chưa có thì giao diện **tạm lưu trong trình duyệt** (mất khi đổi máy / xoá dữ liệu) và sẽ tự dùng
API ngay khi backend có — không cần sửa giao diện nếu làm đúng hợp đồng dưới đây.

Chạy thử hợp đồng không cần .NET: `MOCK_OPS=1 npm run dev:mock` (máy chủ giả lập `mock/mock-api.mjs` đã làm đủ các
endpoint mục A–B; `tests/ops-api.test.mjs` kiểm tra từng endpoint). Backend làm đúng như mock là giao diện chạy.

## Đã nối API (không cần làm thêm)
`/api/auth/register · login · logout`, `/api/facilities`, `/api/unit-types`, `/api/rates`, `/api/availability/check`,
`/api/reservations` (tạo, xem, huỷ), `/api/contracts` (+ payments, renewals), `/api/handovers/{id}/confirm`,
`/api/tickets`, toàn bộ `/api/admin/*`. Sơ đồ 10 ô kho ở trang chi tiết cơ sở đã lấy **số ô trống thật** của từng
loại kho từ `/api/availability/check`.

---

## A. Ưu tiên 1 — chặn luồng chính

### A1. Dữ liệu seed & phân quyền
- [ ] `DbSeeder`: thêm tài khoản **quản lý cơ sở** `manager01 / Manager@123` (role `MANAGER`); hiện chỉ có `staff01`.
- [ ] Gán `UserFacility` cho `staff01` và `manager01` (ví dụ cơ sở SafeSpace Nguyễn Lương Bằng). Mọi endpoint mục A2–A3
      chỉ trả / cho sửa dữ liệu của cơ sở được gán.
- [ ] Gán quyền cho role `STAFF` (`HANDOVER_MANAGE`, `RETURN_MANAGE`, `TICKET_MANAGE`, `PAYMENT_CONFIRM`) và `MANAGER`
      (thêm `UNIT_MANAGE`, `ASSIGNMENT_MANAGE`, `RENEWAL_MANAGE`, `REPORT_VIEW`). Hiện chỉ `ADMIN` có quyền.
- [ ] Endpoint mục A2 cho role `STAFF` **và** `MANAGER`; mục A3 chỉ `MANAGER` (sai vai trò → **403**).

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
| M01/M02/M04 | (trong `GET /api/ops/board`) | — | `units` (86 kho của cơ sở), `revenue` 6 tháng + cơ cấu theo loại kho, tỷ lệ lấp đầy tính từ `units` |

Luật nghiệp vụ chi tiết (điều kiện chặn, chuyển trạng thái) xem `src/ops/reducer.js` — có test `tests/ops.test.js`.

### A4. Khách báo đã chuyển khoản (Figma C04)
- [ ] `POST /api/reservations/{id}/confirm-transfer` → đơn `PENDING_PAYMENT` chuyển `PENDING_VERIFICATION` (để hiện ở
      S09 của nhân viên). Hiện giao diện chỉ lưu trong trình duyệt nên **nhân viên không thấy khách đã chuyển**.
- [ ] Thêm trạng thái `PENDING_VERIFICATION` cho `Reservation` (entity hiện liệt kê `PENDING_PAYMENT, CONFIRMED, UNIT_ASSIGNED, CHECKED_IN, CANCELLED, EXPIRED, NO_SHOW`).

---

## B. Ưu tiên 2 — đang chạy bằng dữ liệu tạm

| Việc | Endpoint / thay đổi | Giao diện đang tạm làm gì |
|---|---|---|
| Sơ đồ 10 ô kho (C03b-sđ) | `GET /api/facilities/{id}/units` → `unitId, unitNumber, floor, zone, unitTypeId, status` (công khai, không lộ khách thuê) | Tự xếp 10 ô theo loại kho, số ô trống lấy từ availability (`src/lib/units.js`) |
| Bản đồ cơ sở (C02m) | Thêm `latitude, longitude` vào `Facility` + `FacilityDto` (cần migration) | Toạ độ gán cứng theo tên cơ sở (`src/config/geo.js`) |
| Đăng ký trả kho (C09) | `POST /api/contracts/{id}/move-out` `{ date, slot, note }` → tạo lịch trả kho (hiện ở S04 của nhân viên) | Lưu trong trình duyệt |
| Thông báo (chuông) | `GET /api/notifications`, `POST /api/notifications/read` `{ ids? }` | Lưu trong trình duyệt |
| Hồ sơ (C13) | `PUT /api/auth/profile` `{ fullName }`, `POST /api/auth/change-password`, `POST /api/auth/forgot-password` | Đổi tên lưu cục bộ; đổi / quên mật khẩu đang khoá |
| Đăng nhập | Cho đăng nhập bằng **email hoặc username**; sai mật khẩu trả **400** (không phải 401) | Khách đăng ký mới được đặt username = email |
| Hỗ trợ (C12) | Cho gửi khi **chưa có hợp đồng** (`ContractId` không bắt buộc); nhận ảnh đính kèm (multipart, ≤3 ảnh, ≤5 MB) | Chưa có hợp đồng thì không gửi được; ảnh lưu cục bộ |

## C. Ưu tiên 3 — chỉnh nhỏ
- [ ] JSON `DateTime` trả kèm `Z` (UTC); hiện đọc từ DB không có múi giờ, giao diện phải tự coi là UTC.
- [ ] Giữ chỗ đơn chờ chuyển khoản: backend 24 giờ, Figma 1 phút → thống nhất một con số (giao diện đọc `VITE_PAYMENT_TIMEOUT_SECONDS`).
- [ ] Khu quản trị: role `OPERATIONS` (Vận hành KD), ghi lịch sử đăng nhập thất bại, lọc nhật ký nhiều `action`.
- [ ] Khu Vận hành KD (Figma B01–B05) chưa có giao diện lẫn API — để sau.

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
