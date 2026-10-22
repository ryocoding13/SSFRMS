# API Quản lý vận hành kinh doanh (`/api/operations/*`)

Dành cho vai trò **OPERATIONS** (Business Operations Manager trong SRS) — UC19 đến UC23, Flow 4.
Tài khoản seed: `ops01` / `Ops@123`. Mọi endpoint cần JWT của tài khoản có role `OPERATIONS`; vai trò khác nhận **403**.

Quy ước chung:

- JSON dùng camelCase. Ngày `yyyy-MM-dd`, ngày giờ là UTC (D10). Tiền là số VND.
- Lỗi: `400 { error }` dữ liệu sai · `404 { error }` không tìm thấy · `409 { error, details }` xung đột trạng thái.
- Mọi thay đổi (cơ sở, chính sách, giá, xuất báo cáo) được ghi `activity_logs` (BR13) — xem ở màn A04 của quản trị.
- Không cần migration: dùng các bảng `facilities`, `policies`, `rental_rates` đã có.

## 1. Cơ sở (UC19) — màn B01

| Phương thức | Đường dẫn | Body / query | Ghi chú |
|---|---|---|---|
| GET | `/api/operations/facilities` | `?status=ACTIVE&search=quận 7` | Gồm cả cơ sở INACTIVE / TEMPORARILY_CLOSED |
| GET | `/api/operations/facilities/{id}` | — | |
| POST | `/api/operations/facilities` | `{ name, address, contactPhone, openingTime, closingTime, status?, latitude?, longitude? }` | `201` + `{ facility, warnings[] }` |
| PUT | `/api/operations/facilities/{id}` | như trên | Sửa thông tin; `status` nếu gửi thì đi qua cùng kiểm tra như endpoint dưới |
| PUT | `/api/operations/facilities/{id}/status` | `{ status, reason? }` | `ACTIVE` · `TEMPORARILY_CLOSED` · `INACTIVE` |

Một cơ sở trả về:

```json
{
  "facilityId": 3,
  "name": "SafeSpace Nguyễn Lương Bằng",
  "address": "12 Nguyễn Lương Bằng, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh",
  "contactPhone": "02837001012",
  "latitude": 10.7295,
  "longitude": 106.7219,
  "openingTime": "06:00",
  "closingTime": "22:00",
  "status": "ACTIVE",
  "totalUnits": 6,
  "unitsInUse": 1,
  "operableUnits": 6,
  "occupancyRate": 16.7,
  "pricedUnitTypes": 4,
  "assignedStaff": 2,
  "createdAt": "2026-09-15T12:40:41",
  "updatedAt": "2026-09-15T12:40:41"
}
```

Quy tắc:

- `name`, `address` bắt buộc; giờ dạng `HH:mm`, nhập cả hai hoặc bỏ trống cả hai, giờ mở < giờ đóng; điện thoại 8–15 chữ số.
- `occupancyRate = null` nghĩa là **Không áp dụng** (không có kho khai thác được) — giao diện hiện đúng chữ đó, không hiện 0%.
- `warnings` không chặn lưu: tên gần giống cơ sở khác; cơ sở ACTIVE nhưng chưa có giá / ô kho / nhân sự.
- `TEMPORARILY_CLOSED`: chặn đặt chỗ mới (`POST /api/reservations` trả 400), khách hiện tại vẫn trả kho, gia hạn, gửi hỗ trợ.
- `INACTIVE`: chỉ được khi không còn hợp đồng và đơn đặt chỗ đang xử lý; ngược lại trả **409** với
  `details: { openContracts, openReservations }`. Không có API xoá cơ sở (SRS UC19).

## 2. Chính sách, khung giá, phí, giảm giá (UC20, UC21) — màn B02, B03

| Phương thức | Đường dẫn | Body / query | Ghi chú |
|---|---|---|---|
| GET | `/api/operations/policies` | `?type=DEPOSIT&status=ACTIVE&facilityId=&unitTypeId=` | |
| GET | `/api/operations/policies/{id}` | — | |
| POST | `/api/operations/policies` | xem body dưới | Luôn tạo ở trạng thái `DRAFT` |
| PUT | `/api/operations/policies/{id}` | như POST | Chỉ sửa được `DRAFT` |
| POST | `/api/operations/policies/{id}/activate` | `?replaceExisting=true` | `{ policy, superseded[] }` |
| POST | `/api/operations/policies/{id}/deactivate` | — | → `INACTIVE`, giữ lại để truy vết |
| DELETE | `/api/operations/policies/{id}` | — | Chỉ xoá `DRAFT` |

Body tạo / sửa:

```json
{
  "policyName": "Phí quá hạn trả kho",
  "policyType": "OVERDUE",
  "calculationType": "PERCENTAGE",
  "value": 5,
  "minValue": null,
  "maxValue": null,
  "ruleDescription": "Tính 5% tiền thuê tháng cho mỗi tuần quá hạn",
  "facilityId": null,
  "unitTypeId": null,
  "effectiveFrom": "2026-10-20",
  "effectiveTo": null
}
```

- `policyType`: `DEPOSIT, RENEWAL, CANCELLATION, RETURN, OVERDUE, EXTRA_FEE, DISCOUNT, FEE_WAIVER, PRICE_RANGE`.
- `calculationType`: `FIXED` (số tiền VND) · `PERCENTAGE` (0–100) · `RANGE` (`minValue ≤ maxValue`) · `RULE` (chỉ là hướng dẫn, BR23).
- `PRICE_RANGE` bắt buộc dùng `RANGE`. Giá trị không được âm. `effectiveTo ≥ effectiveFrom`.
- `facilityId` / `unitTypeId` để `null` = toàn hệ thống / mọi loại kho. Trường `scope` trong kết quả:
  `GLOBAL`, `FACILITY`, `UNIT_TYPE`, `FACILITY_UNIT_TYPE`.
- Kích hoạt khi đã có chính sách **cùng loại, cùng phạm vi**, khoảng hiệu lực giao nhau → **409** với
  `details.conflictingPolicyIds`. Giao diện hỏi lại người dùng rồi gửi `?replaceExisting=true`: bản cũ được kết thúc
  hiệu lực ngay trước ngày bản mới bắt đầu (hoặc chuyển `INACTIVE` nếu chưa kịp bắt đầu) — UC20 A2.
- Chính sách đang áp dụng không sửa trực tiếp: tạo bản mới rồi kích hoạt với `replaceExisting=true`.

Ảnh hưởng tới nghiệp vụ khác:

- **Tiền cọc** (`POST /api/reservations`, `POST /api/availability/check`) lấy chính sách `DEPOSIT` đang áp dụng theo thứ tự
  ưu tiên BR20. `PERCENTAGE` = % tiền thuê cả kỳ; `FIXED ≥ 1.000` = số tiền VND; `FIXED < 1.000` = số tháng tiền thuê
  (cách ghi của chính sách seed: `1` = 1 tháng, D16). Bản `DRAFT` không ảnh hưởng.
- **Khung giá** `PRICE_RANGE` đang áp dụng chặn giá ngoài khung khi đặt giá ở mục 3.

## 3. Bảng giá thuê (UC21) — màn B03

| Phương thức | Đường dẫn | Body / query | Ghi chú |
|---|---|---|---|
| GET | `/api/operations/rates` | `?facilityId=&unitTypeId=&includeHistory=false` | Mặc định: giá đang áp dụng + giá đã lên lịch |
| POST | `/api/operations/rates` | `{ facilityId, unitTypeId, monthlyRate, effectiveFrom? }` | `effectiveFrom` bỏ trống = hôm nay |

- `monthlyRate > 0`, bội số 1.000 VND; `effectiveFrom` không được ở quá khứ.
- Giá cũ của cùng cơ sở + loại kho tự kết thúc ngay trước ngày giá mới bắt đầu (BR19, không chồng giá).
  Giá đã lên lịch từ cùng ngày hoặc sau đó bị thay bằng giá mới.
- Giá đã chốt trong đơn đặt chỗ và hợp đồng **không đổi** (BR14).
- `isCurrent = true` là giá đang áp dụng hôm nay.

## 4. Báo cáo (UC22, UC23) — màn B04, B05

Bộ lọc chung: `from`, `to` (`yyyy-MM-dd`, giờ Việt Nam; mặc định từ đầu tháng đến hôm nay), `facilityId`, `unitTypeId`.

| Phương thức | Đường dẫn | Trả về |
|---|---|---|
| GET | `/api/operations/reports/facilities` | `{ filter, snapshotAt, totals, facilities: [{ facilityId, facilityName, facilityStatus, metrics }] }` |
| GET | `/api/operations/reports/unit-types` | `{ filter, snapshotAt, totals, unitTypes: [{ unitTypeId, unitTypeName, metrics }] }` |
| GET | `/api/operations/reports/revenue-trend?months=6` | `{ months: [{ year, month, label, collected, refunded, rentalAndFeeRevenue, depositCollected }] }` |
| GET | `/api/operations/reports/rental-status` | Số hợp đồng / đơn đặt chỗ / ô kho theo trạng thái |
| GET | `/api/operations/reports/facilities/{id}/contracts?status=OVERDUE` | Chi tiết một cơ sở: hợp đồng, công nợ, case quá hạn |
| GET | `/api/operations/reports/export?view=facilities` | Tệp CSV. `view` = `facilities` · `unit-types` · `revenue-trend` |

`metrics` (định nghĩa theo SRS mục 10.2):

| Trường | Ý nghĩa |
|---|---|
| `collected` | Tiền thu trong kỳ — mọi khoản trừ REFUND đã thu, kể cả cọc |
| `refunded` | Tiền hoàn trong kỳ |
| `netCollected` | Thu ròng = thu − hoàn |
| `rentalAndFeeRevenue` | Doanh thu thuê và phí — không gồm cọc |
| `depositCollected` | Cọc thu trong kỳ |
| `depositHeld` | Cọc còn giữ đến thời điểm báo cáo |
| `outstanding` | Công nợ hiện tại (khoản PENDING/FAILED > 0) |
| `totalUnits`, `unitsInUse`, `unitsAvailable`, `unitsReserved`, `unitsUnavailable`, `operableUnits` | Ảnh chụp trạng thái ô kho tại `snapshotAt` |
| `occupancyRate` | `unitsInUse / operableUnits × 100`; `null` = Không áp dụng |
| `activeContracts` | Hợp đồng ACTIVE, EXPIRING, OVERDUE, RETURN_PENDING |
| `overdueCases`, `overdueContracts` | Số case quá hạn chưa xử lý và số hợp đồng quá hạn (không trùng) |

- `totals` luôn bằng tổng các dòng trong cùng bộ lọc (điểm nghiệm thu UC22).
- Trạng thái kho là **hiện tại**, không phải lịch sử — giao diện ghi rõ "Số liệu kho tại thời điểm …" từ `snapshotAt`.
- CSV: UTF-8 có BOM (mở bằng Excel giữ tiếng Việt), có dòng tiêu đề báo cáo, kỳ, cơ sở, loại kho, thời điểm chụp, đơn vị;
  ô bắt đầu bằng `= + - @` được chặn công thức. Giao diện gọi với **cùng bộ lọc** đang xem rồi tải tệp
  (`Content-Disposition` có tên tệp `bao-cao-...csv`).

Giả định của bản cơ bản (D16): bảng `payments` chưa có `original_payment_id`, và hoàn tiền hiện chỉ có hoàn cọc sau trả kho,
nên mọi khoản REFUND trừ vào "Cọc còn giữ"; "Doanh thu thuê và phí" không trừ REFUND.

### Toạ độ cơ sở (B05a, C02m)
- `latitude`, `longitude` (số thập phân, 6 chữ số) có trong `POST`/`PUT /api/operations/facilities`, `GET /api/operations/facilities`
  và `GET /api/facilities` (công khai). Nhập cả hai hoặc để trống cả hai; phải nằm trong Việt Nam (vĩ độ 8–24, kinh độ 102–110).
- `PUT` ghi đè toạ độ theo đúng giá trị gửi lên (gửi `null` cả hai = xoá toạ độ). Form B05a luôn gửi lại toạ độ đang có.
- Khi khởi động, `FacilityCoordinateSeeder` điền toạ độ cho 12 cơ sở SafeSpace còn trống (không ghi đè toạ độ đã sửa).

