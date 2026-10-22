# Backend QR mở cửa kho (C07q, C07r) — SafeSpace / SSFRMS

Phần backend cho tính năng **QR mở cửa** và **máy quét mô phỏng ở cửa kho** (Figma C07q, C07r1, C07r2; quyết định D21).
Giao diện đã gọi sẵn đúng 2 endpoint này, làm xong backend là giao diện chạy ngay, không phải sửa frontend.

> **Trạng thái:** đã viết xong, kiểm tra cú pháp C# OK. **Chưa `dotnet build` và chưa chạy với SQL Server**
> (máy viết code không có .NET). Người nhận cần build và chạy thử theo mục 6.

---

## 1. Tính năng làm gì

| Bước | Ai | Việc |
|---|---|---|
| 1 | Nhân viên (S03) | Bàn giao kho → backend **đã có sẵn** đoạn tạo 1 thẻ ra vào trong bảng `access_credentials` (trạng thái `ACTIVE`) |
| 2 | Khách (C07) | Bấm **"Mở cửa kho"** → giao diện gọi `GET /api/contracts/{id}/access-qr` → hiện QR + mã dự phòng 8 số |
| 3 | Máy quét (`#/door`) | Khách bấm "Mô phỏng quét ở cửa kho" (hoặc gõ mã dự phòng) → gọi `POST /api/access/scan` |
| 4 | Backend | Kiểm mã → trả **OPEN** ("Mở cửa", xanh) hoặc **DENIED** ("Từ chối", đỏ, kèm lý do); ghi `activity_logs` |
| 5 | Nhân viên (S04) | Lập biên bản trả kho → backend **đã có sẵn** đoạn chuyển thẻ sang `RETURNED` → mã QR cũ tự hết hiệu lực |

Nhóm không dùng thiết bị thật: "máy quét" là trang `#/door` trên chính web SafeSpace.

---

## 2. Cách tạo mã — không thêm bảng, không cần migration

- Mã QR **không lưu trong database**. Mỗi lần cần, backend tính lại bằng **HMAC-SHA256** với khoá bí mật từ:
  `mã hợp đồng + mã thẻ ra vào mới nhất của hợp đồng (access_credentials) + thời điểm cấp thẻ`.
- Mã QR có dạng `SSQR-<mã hợp đồng>-<8 ký tự hex>`, ví dụ `SSQR-12-9F3A61C0`.
- Mã dự phòng có 8 chữ số, ví dụ `4821 9037`. Cũng tính từ cùng HMAC đó.
- Khách không đoán được mã vì không có khoá bí mật. Mã chỉ là mã tham chiếu, không chứa mật khẩu hay bí mật nào.

Hệ quả tự động, không phải viết thêm code:
- **Chưa bàn giao** thì chưa có thẻ, nên chưa có mã.
- **Trả kho** (S04) chuyển thẻ sang `RETURNED`, nên quét mã cũ sẽ bị từ chối: "đã trả kho".
- **Bàn giao lại** thì thẻ cũ chuyển `REPLACED` và có thẻ mới, nên mã QR đổi theo và mã cũ hết dùng.

---

## 3. API

### 3.1 `GET /api/contracts/{id}/access-qr` — lấy mã (cần đăng nhập khách)

Chỉ chủ hợp đồng gọi được. Hợp đồng phải **đã bàn giao** (`handover_records.Status = HANDED_OVER`), thẻ mới nhất đang
`ACTIVE`, hợp đồng ở `ACTIVE` / `EXPIRING` / `OVERDUE`.

**200**
```json
{
  "contractId": 12,
  "code": "SSQR-12-9F3A61C0",
  "backupCode": "4821 9037",
  "unitNumber": "K01",
  "unitType": "Kho thường",
  "location": "Tầng trệt · Dãy A",
  "validUntil": "2026-12-31"
}
```
| Trường hợp | Mã | Body |
|---|---|---|
| Hợp đồng không tồn tại / không phải của khách | 404 | `{ "error": "Không tìm thấy hợp đồng." }` |
| Chưa bàn giao | 400 | `{ "error": "QR mở cửa chỉ dùng được sau khi nhân viên bàn giao kho." }` |
| Đã trả kho / hết hiệu lực | 400 | `{ "error": "Hợp đồng đã trả kho hoặc hết hiệu lực, mã mở cửa không còn dùng được." }` |

### 3.2 `POST /api/access/scan` — máy quét kiểm mã (không cần đăng nhập)

Request: `{ "code": "SSQR-12-9F3A61C0" }` hoặc mã dự phòng `{ "code": "4821 9037" }` (có hay không có khoảng trắng đều được).

Luôn trả **200**. Kết quả nằm trong `result`:
```json
{ "result": "OPEN", "unitNumber": "K01", "customerName": "Nguyễn Văn An", "contractCode": "HĐ-2026-0012",
  "scannedAt": "2026-10-16T08:32:00Z", "reason": null }
```
```json
{ "result": "DENIED", "unitNumber": "K01", "customerName": "Nguyễn Văn An", "contractCode": "HĐ-2026-0012",
  "scannedAt": "2026-10-16T08:35:00Z", "reason": "Mã đã hết hiệu lực — hợp đồng đã trả kho." }
```

Thứ tự kiểm và lý do từ chối:

| # | Điều kiện | `reason` |
|---|---|---|
| 1 | Mã rỗng | Chưa nhận được mã. Đưa mã QR vào máy quét hoặc nhập mã dự phòng. |
| 2 | Không khớp mã nào | Mã không đúng. Kiểm tra lại mã trên ứng dụng hoặc mã dự phòng. |
| 3 | Thẻ `RETURNED` hoặc hợp đồng `RETURN_PENDING` / `COMPLETED` / `TERMINATED` / `CANCELLED` | Mã đã hết hiệu lực — hợp đồng đã trả kho. |
| 4 | Thẻ `REVOKED` / `LOST` / `REPLACED` | Mã đã bị thu hồi. Liên hệ nhân viên cơ sở để được cấp lại. |
| 5 | Chưa bàn giao | Kho chưa được bàn giao cho khách. |
| 6 | Hợp đồng không ở `ACTIVE` / `EXPIRING` / `OVERDUE` | Hợp đồng không còn hiệu lực. |
| 7 | Quá hạn (`OVERDUE` hoặc `EndDate` < hôm nay giờ VN) và `DenyOverdue = true` | Hợp đồng đã quá hạn. Vui lòng gia hạn hoặc liên hệ cơ sở. |
| — | Qua hết | `result = "OPEN"`, `reason = null` |

Mỗi lần quét ghi 1 dòng `activity_logs`: `Action = ACCESS_SCANNED`, `EntityType = CONTRACT`, `EntityId` = mã hợp đồng
(null nếu mã sai), `NewValue` = `{ result, unit, reason }`, `IpAddress` của máy quét, `UserId = null`.

---

## 4. Các file trong gói

Giữ đúng đường dẫn khi chép vào repo (thư mục gốc SSFRMS).

| File | Mới / sửa | Nội dung |
|---|---|---|
| `StorageProject.Core/DTOs/Access/AccessDtos.cs` | **Mới** | `AccessQrDto`, `ScanAccessRequest`, `ScanResultDto`, `AccessQrOptions` |
| `StorageProject.Infrastructure/Services/AccessService.cs` | **Mới** | Tính mã HMAC, lấy QR, kiểm mã khi quét, ghi log |
| `StorageProject.Api/Endpoints/AccessEndpoints.cs` | **Mới** | 2 endpoint ở mục 3 |
| `StorageProject.Core/Interfaces/IServices.cs` | Sửa | Thêm `using StorageProject.Core.DTOs.Access;` và interface `IAccessService` (đặt trước `IPaymentService`) |
| `StorageProject.Api/Program.cs` | Sửa | Đăng ký `AccessQrOptions` + `IAccessService`, gọi `app.MapAccessEndpoints();` |
| `StorageProject.Api/StorageProject.Api.http` | Sửa | Thêm biến `@customerToken` và 3 request mẫu ở cuối file |
| `qr-mo-cua-backend.patch` | — | Toàn bộ thay đổi trên ở dạng patch, dùng thay cho chép tay |

Chi tiết phần sửa trong `Program.cs`:
```csharp
using StorageProject.Core.DTOs.Access;   // thêm cạnh các using khác
...
builder.Services.AddScoped<IFacilityOpsService, FacilityOpsService>();
builder.Services.AddSingleton(new AccessQrOptions(
    builder.Configuration["AccessQr:Secret"] ?? jwtSecret,
    !bool.TryParse(builder.Configuration["AccessQr:DenyOverdue"], out var denyOverdue) || denyOverdue));
builder.Services.AddScoped<IAccessService, AccessService>();
...
app.MapFacilityOpsEndpoints();
app.MapAccessEndpoints();
```

---

## 5. Cấu hình (không bắt buộc)

Trong `appsettings.json` (không commit khoá thật):
```json
"AccessQr": {
  "Secret": "<chuỗi bí mật riêng, ≥ 32 ký tự>",
  "DenyOverdue": true
}
```
- Không có `AccessQr:Secret` thì dùng `JwtSettings:Secret`. **Đổi khoá thì mọi mã QR đang có đổi theo.**
- `DenyOverdue`: hợp đồng quá hạn có bị khoá QR không. Nhóm chưa chốt; mặc định là **có khoá**.

---

## 6. Cách đưa vào repo và chạy thử

**Cách 1 — dùng patch (khuyên dùng):**
```bash
git checkout main && git pull
git checkout -b feature/access-qr-backend
git apply qr-mo-cua-backend.patch
dotnet build StorageProject.slnx
```
Nếu `git apply` báo lệch ở `IServices.cs` / `Program.cs` / `.http` (do main đổi), chép 3 file mới vào, rồi sửa tay 3 file kia theo mục 4.

**Chạy thử:**
1. `dotnet run --project StorageProject.Api --launch-profile http`. Không cần migration mới.
2. Swagger (`http://localhost:5151`): đăng nhập `customer01` / `Customer@123`, gọi `GET /api/contracts` lấy `contractId` của kho
   **K01** (seed đã bàn giao sẵn), rồi gọi `GET /api/contracts/{id}/access-qr` → nhận `code`, `backupCode`.
3. `POST /api/access/scan` với `code` vừa nhận → `result = OPEN`.
4. `POST /api/access/scan` với `{ "code": "1234 5678" }` → `DENIED`, "Mã không đúng…".
5. Trên giao diện (`npm run dev`, chế độ API): `customer01` → Kho của tôi → K01 → **Mở cửa kho** → **Mô phỏng quét ở cửa kho** → "Mở cửa".
6. Thử thu hồi: `staff01` lập biên bản trả kho K01 (S04) → quét lại mã cũ → "Từ chối — đã trả kho"; gọi lại `access-qr` → 400.
7. Xem `activity_logs` có các dòng `ACCESS_SCANNED`.

Giao diện tương ứng (đã có trong bản FE): popup C07q ở `src/pages/Units.jsx` (`AccessQrModal`), máy quét `src/pages/Door.jsx`,
gọi API ở `src/api/endpoints.js` (`accessQr`, `scanAccess`). Bản FE cũ khi chưa có BE chỉ hiện "Mã QR mở cửa đang được cơ sở kích hoạt".

---

## 7. Lưu ý

- Endpoint quét **không cần đăng nhập** vì đóng vai thiết bị ở cửa. Mã dự phòng 8 số đủ cho đồ án; sản phẩm thật nên
  giới hạn số lần quét sai theo IP.
- Tìm theo mã dự phòng duyệt các hợp đồng đã có thẻ ra vào — với quy mô 12 cơ sở × 12 ô thì nhẹ.
- Không đổi bảng, không đổi dữ liệu cũ; chỉ thêm dòng `activity_logs` khi quét.
