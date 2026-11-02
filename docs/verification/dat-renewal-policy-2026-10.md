# Báo cáo kiểm chứng Backend: T02, T03, T04, T20 (Chính sách D32)

- **Người thực hiện:** Đạt (Backend Agent)
- **Nhánh thực hiện:** `feature/dat-renewal-policy-d32`
- **Mã commit base:** `0f0194b` (`origin/main`)
- **Quyết định nghiệp vụ áp dụng:** D32 (kế hoạch hoàn thiện 26–31/10/2026), bảo toàn D23–D26, D27, D29, D31.
- **Tài liệu hợp đồng FE liên quan:** `SafeSpace-Customer-UI/SafeSpace-Customer-UI/BACKEND-TODO.md` (mục D32), `BE-CONTRACT.md`, `APPROVED-FE-API-GAPS.md`.

---

## 1. Tóm tắt phạm vi triển khai

1. **T02 — Duyệt gia hạn hợp đồng không đổi EndDate (P0):**
   - Khách hàng gửi yêu cầu gia hạn: bắt buộc kiểm tra ngày kết thúc hợp đồng theo giờ Việt Nam (`contract.EndDate > vnToday`), kiểm tra không có yêu cầu đang mở, và yêu cầu phiên bản chính sách (`policyVersion`) kèm chấp thuận (`accepted = true`).
   - Duyệt gia hạn (`FacilityOpsService.ApproveRenewalAsync`, `RenewalService.ApproveRenewalAsync`, và legacy route `ManagerService.ApproveRenewalAsync`):
     - Chốt lại đơn giá tại thời điểm duyệt theo `rental_rates` hiệu lực.
     - **Tuyệt đối không tăng `contract.EndDate` khi duyệt.**
     - Tạo khoản thanh toán `payments` kiểu `RENEWAL`, trạng thái `PENDING`, gắn `RenewalId` và `ContractId`.
     - Tính hạn thanh toán: `PaymentDeadlineAt = min(ApprovedAt + 24h, 00:00 EndDate theo giờ VN)`.
   - Quá hạn thanh toán: background service `ExpiredRenewalWorker` quét định kỳ 1 phút, chuyển `contract_renewals.Status = 'EXPIRED'`, `ExpiredAt = now`, và `payments.Status = 'FAILED'`. `contract.EndDate` được giữ nguyên.

2. **T03 — PayOS cho gia hạn hợp đồng (P0):**
   - `POST /api/payments/{id}/payos`: kiểm tra quyền sở hữu của khách hàng, tạo link checkout PayOS theo `paymentId`, lưu `orderCode` vào bảng `payment_checkouts`.
   - Webhook `POST /api/payments/payos-webhook`:
     - Kiểm tra chữ ký bằng PayOS SDK 2.1.0 và Checksum Key.
     - Đối soát chính xác `orderCode` và `amount`.
     - Chống trùng lặp (idempotency): nếu thanh toán đã `PAID`, trả kết quả thành công và không kéo dài ngày lần thứ hai.
     - Giao dịch thanh toán gia hạn (`RenewalSettlement.RecordAsync`): dùng lock ứng dụng SQL Server `contract:{id}`, ghi `payments.Status = 'PAID'`, `contract_renewals.Status = 'PAID'`, `AppliedAt = now`, và cập nhật `contract.EndDate = renewal.NewEndDate` **đúng một lần**.
     - Tiền về muộn/sau khi quá hạn/lệch giao dịch: ghi log audit `PAYMENT_REVIEW_REQUIRED`, không tự động gia hạn hợp đồng.

3. **T04 — Khách chọn trả tại quầy & Nhân viên xác nhận thu tiền mặt (P1):**
   - `POST /api/renewals/{id}/counter-payment`: khách hàng chọn trả tại quầy cho yêu cầu đã duyệt (`APPROVED`). Cập nhật `paymentMethod = "CASH"`, hủy an toàn link PayOS đang mở qua `IPayOSGateway.CancelAsync`. Trạng thái vẫn là `APPROVED`, **chưa đổi EndDate**.
   - `GET /api/ops/counter-renewals`: danh sách hàng chờ thu tiền mặt tại quầy lọc theo cơ sở phụ trách của nhân viên (`STAFF` hoặc `MANAGER`).
   - `POST /api/ops/counter-renewals/actions` `{ action: "COLLECT_RENEWAL", id: "GHQ-xxxx" }`:
     - Nhân viên cơ sở xác nhận đã thu đủ tiền mặt.
     - Ghi nhận thanh toán CASH, cập nhật `contract_renewals.Status = 'PAID'`, và kéo dài `contract.EndDate = renewal.NewEndDate` **đúng một lần**.
     - Chặn thu trùng lặp: nếu khoản gia hạn đã được thu, từ chối với lỗi "Khoản gia hạn đã được thu. Không thu lần nữa."

4. **T20 — Quản lý phiên bản chính sách cho thuê & Consent (P0):**
   - Bảng mới `rental_policy_versions`: lưu trữ các bản snapshot chính sách bất biến (Version, Rate, 7 sections: `payment`, `access`, `renewal`, `overdue`, `return`, `cancellation`, `support`).
   - `GET /api/rental-policy`: API công khai trả về phiên bản chính sách hiện hành (`RentalPolicyDto`).
   - `GET /api/rental-policy/versions/{version}`: API công khai tra cứu lịch sử phiên bản bất biến.
   - `POST /api/rental-policy/actions` `{ action: "SAVE_RENTAL_POLICY", ... }`: chỉ cho phép `OPERATIONS` hoặc `ADMIN`. Tạo bản ghi phiên bản mới, đồng bộ tỷ lệ vào bảng `policies` (`PolicyType = 'OVERDUE'`). Kiểm tra xung đột lạc quan (optimistic concurrency), trả 409 Conflict nếu version gửi lên đã cũ.
   - Bảng mới `policy_consents`: lưu trữ lịch sử khách hàng đồng ý chính sách (Version, thời điểm UTC server, channel `WEB`/`COUNTER_CUSTOMER`), liên kết với `ReservationId`, `ContractId`, `RenewalId`.
   - `POST /api/reservations/{id}/policy-consent`: ghi nhận bằng chứng đồng ý chính sách khi khách tự xác nhận lúc thu tại quầy.

---

## 2. Danh sách file thay đổi & tạo mới

### Core (Entities, DTOs, Interfaces)
- `StorageProject.Core/Entities/ContractRenewal.cs`: bổ sung `PaymentDeadlineAt`, `AppliedAt`, `ExpiredAt`, `PolicyVersion`, `AcceptedAt`, `PolicyConsents`.
- `StorageProject.Core/Entities/Payment.cs`: navigation `Checkouts`.
- `StorageProject.Core/Entities/PaymentCheckout.cs` (Mới): theo dõi orderCode checkout PayOS.
- `StorageProject.Core/Entities/RentalPolicyVersion.cs` (Mới): phiên bản chính sách cho thuê bất biến.
- `StorageProject.Core/Entities/PolicyConsent.cs` (Mới): bằng chứng đồng ý chính sách của khách.
- `StorageProject.Core/Entities/Reservation.cs` & `RentalContract.cs`: navigation `PolicyConsents`.
- `StorageProject.Core/DTOs/Renewal/RenewalDtos.cs`: bổ sung trường D32 vào `CreateRenewalRequest` và `RenewalDto`.
- `StorageProject.Core/DTOs/Renewal/CounterRenewalDtos.cs` (Mới): DTOs cho hàng chờ thu tiền tại quầy.
- `StorageProject.Core/DTOs/Policy/RentalPolicyDtos.cs` (Mới): DTOs cho chính sách và consent.
- `StorageProject.Core/DTOs/Payment/PayOSDtos.cs`: thêm `PayosCheckoutDto`.
- `StorageProject.Core/DTOs/Payment/PaymentDtos.cs`: thêm `PaymentDeadlineAt`.
- `StorageProject.Core/Interfaces/IServices.cs`: mở rộng `IRenewalService`, thêm `IRentalPolicyService`.
- `StorageProject.Core/Interfaces/IPayOSService.cs`: thêm `CreateRenewalPaymentQrAsync`.

### Infrastructure (Data, Configurations, Services)
- `StorageProject.Infrastructure/Data/Configurations/ReservationContractConfigurations.cs`: check constraint `contract_renewals.Status` có `'EXPIRED'`, filtered unique index trên `ContractId` cho PENDING/APPROVED, filtered unique index trên `payments.RenewalId`.
- `StorageProject.Infrastructure/Data/Configurations/PaymentCheckoutConfiguration.cs` (Mới).
- `StorageProject.Infrastructure/Data/Configurations/RentalPolicyConfigurations.cs` (Mới).
- `StorageProject.Infrastructure/Data/AppDbContext.cs`: DbSet `PaymentCheckouts`, `RentalPolicyVersions`, `PolicyConsents`.
- `StorageProject.Infrastructure/Migrations/20261027165711_AddRenewalSettlementAndPolicyConsent.cs` (Migration mới).
- `StorageProject.Infrastructure/Data/DbSeeder.cs`: seed phiên bản chính sách mặc định Version 1, Rate 5.0%.
- `StorageProject.Infrastructure/Services/PayOSGateway.cs`: mở rộng `IPayOSGateway.CreateRenewalAsync`.
- `StorageProject.Infrastructure/Services/RenewalSettlement.cs` (Mới): xử lý settlement atomic & idempotent cho PayOS và tiền mặt.
- `StorageProject.Infrastructure/Services/RentalPolicyService.cs` (Mới): dịch vụ quản lý phiên bản chính sách và consent.
- `StorageProject.Infrastructure/Services/RenewalService.cs`: cập nhật toàn bộ luồng request, approve, counter-payment, collect cash, expire.
- `StorageProject.Infrastructure/Services/FacilityOpsService.Actions.cs`: cập nhật `ApproveRenewalAsync` theo D32.
- `StorageProject.Infrastructure/Services/ManagerService.cs`: cập nhật route legacy theo D32.
- `StorageProject.Infrastructure/Services/PayOSService.cs`: hỗ trợ checkout PayOS renewal và webhook settlement.
- `StorageProject.Infrastructure/Services/PaymentService.cs`: trả về `PaymentDeadlineAt`.

### API & Workers
- `StorageProject.Api/Endpoints/PaymentEndpoints.cs`: bổ sung `POST /api/payments/{id:long}/payos`.
- `StorageProject.Api/Endpoints/RenewalEndpoints.cs`: cập nhật xử lý consent.
- `StorageProject.Api/Endpoints/CounterRenewalEndpoints.cs` (Mới): endpoints cho T04.
- `StorageProject.Api/Endpoints/RentalPolicyEndpoints.cs` (Mới): endpoints cho T20.
- `StorageProject.Api/Workers/ExpiredRenewalWorker.cs` (Mới): worker quét định kỳ xử lý hết hạn thanh toán gia hạn.
- `StorageProject.Api/Program.cs`: đăng ký DI, worker và map endpoints mới.

### Tests & Documentation
- `StorageProject.Tests/RenewalPolicyD32Tests.cs` (Mới): 8 test cases chuyên sâu kiểm tra toàn diện T02, T03, T04, T20 và Expiry.
- `docs/sprints/dat-renewal-policy-d32.md` (Mới): sprint contract.
- `docs/verification/dat-renewal-policy-2026-10.md` (Mới): tài liệu kiểm chứng này.

---

## 3. Bằng chứng kiểm thử tự động

### 3.1. Build Solution Release
Lệnh thực hiện:
```powershell
dotnet build StorageProject.slnx -c Release --no-restore -m:1
```
Kết quả:
`Build succeeded. 0 Warning(s) / 0 Error(s) trên mã nguồn mới` (chỉ có warning NU1902/NU1903 về vulnerability của thư viện `System.Security.Cryptography.Pkcs` có sẵn trong template .NET).

### 3.2. Migration Model Consistency
Lệnh thực hiện:
```powershell
dotnet ef migrations has-pending-model-changes --configuration Release --project StorageProject.Infrastructure --startup-project StorageProject.Api
```
Kết quả:
`No changes have been made to the model since the last migration.` (Hoàn toàn đồng bộ với EF snapshot).

### 3.3. Unit Test Suite
Lệnh thực hiện:
```powershell
dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release
```
Kết quả:
`Passed! - Failed: 0, Passed: 96, Skipped: 0, Total: 96, Duration: 3 s`
Bao gồm toàn bộ 88 test cases cũ và 8 test cases mới:
- `T02_ApproveRenewal_DoesNotChangeContractEndDate_AndCreatesPendingRenewalPayment`: PASS
- `T02_LegacyManagerApprove_FollowsSameRules_DoesNotChangeEndDate`: PASS
- `T02_ApproveRenewal_Twice_IsIdempotent_DoesNotCreateDuplicatePayment`: PASS
- `T03_PayOS_CreatesRenewalLink_AndWebhookSettlesEndDateExactlyOnce`: PASS
- `T04_CounterPayment_CustomerSelectsAndStaffCollectsCash_LengthensEndDateOnce`: PASS
- `T20_PolicyVersioning_OperationsCanPublish_AndConcurrencyConflictDetected`: PASS
- `T20_PolicyConsent_RecordedWithServerTimeAndChannel`: PASS
- `Expiry_PastDeadlineRenewal_ExpiresAutomatically`: PASS

### 3.4. Git Cleanliness
Lệnh thực hiện:
```powershell
git diff --check
```
Kết quả: Không có lỗi trailing whitespace hoặc định dạng.

---

## 4. Hướng dẫn kiểm chứng tích hợp thực tế (Manual / SQL Server / PayOS)

### Kịch bản 1: Kiểm chứng T02 — Phê duyệt gia hạn giữ nguyên EndDate
1. Khách hàng (`customer01`) gọi `POST /api/contracts/{id}/renew` kèm `{ renewalPeriodMonths: 3, policyVersion: 1, accepted: true }`.
2. Kiểm tra DB: `contract_renewals` có dòng mới trạng thái `PENDING`. `contracts.EndDate` giữ nguyên.
3. Quản lý (`manager01`) gọi `POST /api/ops/renewals/{id}/approve` (hoặc `POST /api/manager/renewals/{id}/approve`).
4. Kiểm tra DB:
   - `contract_renewals.Status` = `APPROVED`.
   - `contract_renewals.PaymentDeadlineAt` = thời điểm duyệt + 24 giờ (hoặc 00:00 EndDate nếu EndDate đến trước).
   - `payments` có dòng mới `PaymentType = 'RENEWAL'`, `Status = 'PENDING'`, `Amount` = 3 tháng tiền thuê.
   - **`contracts.EndDate` vẫn là ngày cũ, tuyệt đối chưa được gia hạn.**

### Kịch bản 2: Kiểm chứng T03 — Thanh toán PayOS & Webhook Idempotency
1. Khách hàng mở modal thanh toán, gọi `POST /api/payments/{paymentId}/payos`. Nhận về link và mã QR PayOS.
2. Webhook PayOS gửi về `POST /api/payments/payos-webhook` với dữ liệu khớp `orderCode` và `amount`.
3. Kiểm tra DB:
   - `payments.Status` = `PAID`, có `PaidAt`.
   - `contract_renewals.Status` = `PAID`, `AppliedAt` có giá trị.
   - `contracts.EndDate` = `NewEndDate` (ngày kết thúc được cộng thêm 3 tháng).
4. Replay lại cùng payload Webhook: hệ thống nhận diện idempotent, không kéo dài EndDate lần thứ hai.

### Kịch bản 3: Kiểm chứng T04 — Thanh toán tại quầy
1. Khách hàng chọn thanh toán tại quầy: `POST /api/renewals/{id}/counter-payment`.
2. Link PayOS cũ bị hủy, `payments.PaymentMethod` chuyển thành `CASH`.
3. Nhân viên cơ sở xem `GET /api/ops/counter-renewals`, thấy dòng `GHQ-xxxx` ở trạng thái `PENDING`.
4. Nhân viên thu tiền mặt, bấm xác nhận: `POST /api/ops/counter-renewals/actions` `{ action: "COLLECT_RENEWAL", id: "GHQ-xxxx" }`.
5. Kiểm tra DB: `payments.Status = 'PAID'`, `contracts.EndDate` kéo dài đúng 1 lần. Gọi lại lần 2 bị từ chối 400.

### Kịch bản 4: Kiểm chứng T20 — Versioning Chính sách & Consent
1. Gọi `GET /api/rental-policy`: nhận bản `1.0` (Rate 5.0%).
2. Đăng nhập tài khoản `ops01`, gọi `POST /api/rental-policy/actions` để lưu bản mới (Rate 6.0%).
3. Kiểm tra DB: `rental_policy_versions` có version 2 là `IsCurrent = 1`, version 1 chuyển `IsCurrent = 0`. Bảng `policies` loại `OVERDUE` tự động cập nhật `Value = 6.0`.
4. Khách hàng thực hiện gia hạn: bảng `policy_consents` ghi nhận bản ghi với `PolicyVersionId` của version đang áp dụng, `Channel = 'WEB_CUSTOMER'`.

---

## 5. SQL Verification Queries

```sql
-- 1. Kiểm tra trạng thái gia hạn và khoản thanh toán
SELECT r.RenewalId, r.ContractId, r.Status AS RenewalStatus, r.OldEndDate, r.NewEndDate,
       r.PaymentDeadlineAt, r.AppliedAt, r.ExpiredAt,
       p.PaymentId, p.PaymentType, p.Amount, p.Status AS PaymentStatus, p.PaymentMethod, p.PaidAt
FROM contract_renewals r
LEFT JOIN payments p ON p.RenewalId = r.RenewalId
WHERE r.ContractId = <contract_id>;

-- 2. Kiểm tra ngày kết thúc hợp đồng
SELECT ContractId, StartDate, EndDate, Status
FROM rental_contracts
WHERE ContractId = <contract_id>;

-- 3. Kiểm tra phiên bản chính sách và bằng chứng đồng ý
SELECT Version, DisplayVersion, Rate, IsCurrent, PublishedAt
FROM rental_policy_versions
ORDER BY Version DESC;

SELECT ConsentId, CustomerId, PolicyVersionId, ReservationId, RenewalId, Channel, AcceptedAt
FROM policy_consents
WHERE CustomerId = <customer_id>;
```

---

## 6. Đánh giá rủi ro & Runbook an toàn

1. **Rủi ro Rollback Database:**
   - Theo quy tắc D29 và `docs/rollback.md`, tuyệt đối **không chạy `dotnet ef database drop` hay `database update` lùi lại**.
   - Mọi thay đổi schema đều là thêm bảng mới (`rental_policy_versions`, `policy_consents`, `payment_checkouts`) và thêm cột có nullable/default value vào `contract_renewals`.
   - Nếu cần điều chỉnh, nhóm thực hiện forward-fix bằng migration mới.
2. **Giới hạn môi trường hiện tại:**
   - Đã xác thực toàn diện qua 96 unit tests với SQLite in-memory, mock PayOS Gateway và fake clock.
   - Phần kiểm thử tích hợp trên SQL Server 2022 thật cần biến môi trường `REQUIRE_SQLSERVER=true` và kết nối database SQL Server được nhóm cấu hình trước khi chạy integration tests.
   - Thao tác thanh toán PayOS thật yêu cầu khóa cấu hình API thật từ PayOS.
