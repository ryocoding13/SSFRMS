## 2026-10-15 — F31: Frontend vận hành KD, không sửa backend/database

- Bản gốc: SSFRMS(1).zip mới; API: operations-api(3).md; thiết kế B01–B05 section 436:13803.
- Thêm src/business, src/api/business, assets cục bộ và mock frontend opt-in dev:business.
- Chỉ nối role OPERATIONS vào router/session hiện có; giữ nguyên điều kiện các role cũ.
- B02 gom 8 ô thành 5 type/scope để đúng API; quy định phụ là dòng có nhãn trong ruleDescription;
  409 phải xác nhận trước khi thay thế. Không sửa backend để cho nhiều policy xung đột cùng tồn tại.
- Kiểm chứng: npm test 38/38; test:business 8/8; test:render 76 route; build/init FE PASS;
  Chromium 13 nhóm PASS; 14/14 màn các role khác giống từng pixel; 4 XLSX mở bằng openpyxl.
- 77 file source/config backend nguyên byte so ZIP đầu vào; không sửa DB, migration, seeder hoặc endpoint.
- Phạm vi người dùng chỉ frontend nên không build .NET, không thử SQL Server thật.
- Xem BUSINESS_FRONTEND_README.md, BUSINESS_FRONTEND_REVIEW.md, BUSINESS-FLOW-COVERAGE.md trong frontend.

# Nhật ký tiến độ (progress.md)

> Mỗi phiên làm việc với AI thêm MỘT mục ở đầu danh sách (mới nhất trên cùng).
> Ghi đủ để phiên sau tiếp tục ngay mà không phải hỏi lại. Không xoá mục cũ.

## Phiên 9 — 2026-10-16 — Sửa lỗi tính tiền thanh toán đơn đặt chỗ (tiền thuê + cọc)

- **Vấn đề:** Khách hàng vào màn hình thanh toán đơn đặt chỗ (PayOS QR), tổng thanh toán hiển thị chỉ có tiền cọc (1.000 đ) mà không cộng tiền thuê 3 tháng (3.000 đ), link PayOS cũng chỉ thu 1.000 đ thay vì 4.000 đ.
- **Nguyên nhân:**
  - Trong `StorageProject.Infrastructure/Services/PayOSService.cs` (dòng 128), biểu thức tính `amount` sử dụng toán tử 3 ngôi sai:
    `int amount = (int)(reservation.RequiredDeposit > 0 ? reservation.RequiredDeposit : reservation.EstimatedAmount);`
    Khi có tiền cọc (`RequiredDeposit > 0`), hệ thống chỉ lấy tiền cọc mà bỏ qua toàn bộ tiền thuê (`EstimatedAmount`).
  - Trong `SafeSpace-Customer-UI/SafeSpace-Customer-UI/mock/mock-api.mjs` (dòng 618), fallback cho mock endpoint cũng có biểu thức toán tử 3 ngôi tương tự.
- **Đã sửa:**
  - `PayOSService.cs`: Sửa thành `int amount = (int)(reservation.EstimatedAmount + (reservation.RequiredDeposit > 0 ? reservation.RequiredDeposit : 0));`.
  - `mock-api.mjs`: Sửa dòng fallback khớp logic tính tổng `estimatedAmount + (requiredDeposit > 0 ? requiredDeposit : 0)`.
- **Kiểm chứng:**
  - Chạy script kiểm thử API thực tế với SQL Server & backend (`POST /api/reservations/create-payos-qr`):
    - Đơn 3 tháng: Tiền thuê = 3.000 đ, Tiền cọc = 1.000 đ.
    - Kết quả trả về `amount = 4000` đúng tổng tiền thuê + cọc, link PayOS sinh đúng 4.000 đ.
  - Frontend test suites: `npm test` 67/67 test PASS; `npm run test:render` 92/92 routes PASS; `npm run build` OK.
  - Backend: `dotnet build StorageProject.slnx` 0 Warning 0 Error.
  - Chạy `./init.ps1` kiểm tra toàn bộ môi trường và test: PASS toàn bộ.

## Phiên 8 — 2026-10-16 — Triển khai Backend QR mở cửa (C07q, C07r) và kết nối Frontend

- **Tính năng:** F34 — Backend QR mở cửa kho: sinh mã HMAC-SHA256 và mã dự phòng 8 số; endpoint máy quét mô phỏng tại cửa kho; kết nối trực tiếp với nút "Mở cửa kho" trên frontend.
- **Đã xong:**
  - **Core DTOs (`StorageProject.Core/DTOs/Access/AccessDtos.cs`):** Khai báo `AccessQrDto`, `ScanAccessRequest`, `ScanResultDto`, `AccessQrOptions`.
  - **Core Interface (`StorageProject.Core/Interfaces/IServices.cs`):** Bổ sung `IAccessService` (`GetQrAsync`, `ScanAsync`).
  - **Infrastructure Service (`StorageProject.Infrastructure/Services/AccessService.cs`):**
    - Sinh mã bảo mật HMAC-SHA256 không trạng thái từ `ContractId + CredentialId + IssuedAt` và Secret key (`JwtSettings:Secret` hoặc `AccessQr:Secret`).
    - Format mã QR: `SSQR-<contractId>-<8 ký tự hex>` (ví dụ: `SSQR-1-1733D3D0`).
    - Format mã PIN dự phòng: 8 chữ số (ví dụ: `03502103`, hiển thị dạng `0350 2103`).
    - Endpoint kiểm mã `POST /api/access/scan` kiểm tra đa dạng (mã QR hoặc mã 8 số có/không có dấu cách), kiểm tra thứ tự từ chối nghiệp vụ chuẩn (thẻ thu hồi, đã trả kho, chưa bàn giao, hợp đồng quá hạn/hết hiệu lực) và ghi nhật ký ra vào `ACCESS_SCANNED` vào bảng `activity_logs`.
  - **API Endpoints (`StorageProject.Api/Endpoints/AccessEndpoints.cs`):**
    - `GET /api/contracts/{id}/access-qr`: Yêu cầu xác thực chủ hợp đồng, hỗ trợ cả `id` số nguyên lẫn mã chuỗi `HĐ-...`.
    - `POST /api/access/scan`: Endpoint công khai cho máy quét/thiết bị tại cửa, luôn trả về 200 kèm `result: "OPEN" | "DENIED"` và lý do từ chối.
  - **Cấu hình & DI (`Program.cs`):** Đăng ký `AccessQrOptions`, `IAccessService` và map `app.MapAccessEndpoints()`.
  - **Cải thiện `StaffService.CompleteHandoverAsync`:** Hỗ trợ hoàn tất bàn giao theo `HandoverId` và tự động kích hoạt `AccessCredential` với `Status = "ACTIVE"`.
  - **Frontend Integration (`endpoints.js` & `useAccessQr.js`):**
    - Thêm `accessQr` và `scanAccess` vào `src/api/endpoints.js`.
    - Cập nhật `src/state/useAccessQr.js` kết nối trực tiếp API khi `USE_API = true`, đồng thời bảo toàn logic giả lập ngoại tuyến khi `USE_API = false`.
- **Kiểm chứng:**
  - `dotnet build StorageProject.slnx` thành công 0 lỗi.
  - Chạy `test_full_flow.ps1` kiểm chứng luồng thực tế trên máy chủ Backend & SQL Server:
    - Nhân viên `staff01` hoàn tất bàn giao kho K01 (`POST /api/staff/handovers/1/complete`).
    - Khách hàng `customer01` gọi `GET /api/contracts/1/access-qr` nhận thành công mã `SSQR-1-1733D3D0` và mã dự phòng `03502103`.
    - Quét mã QR trả về `OPEN` | Cửa kho K01 | Khách hàng Nguyễn Văn An.
    - Quét mã dự phòng (kể cả có dấu cách `0350 2103`) trả về `OPEN`.
    - Quét mã sai trả về `DENIED` kèm lý do rõ ràng.
    - SQL Server bảng `activity_logs` ghi nhận đầy đủ các bản ghi hành động `ACCESS_SCANNED`.
  - Frontend test suites:
    - `npm test`: 42/42 unit test PASS.
    - `node --test tests/access.test.js`: 10/10 access test PASS.
    - `npm run test:render`: 76/76 routes SSR PASS.
    - `npm run build`: Production bundle Vite build thành công 100%.

## 2026-10-16 — F32 + F29: đồng bộ giao diện Figma 16/10 (việc 9 của Thắng) — Claude

- Nhánh làm việc gộp `main` + `feature/ops-backend` + `feature/facility-coordinates` (xung đột duy nhất ở `DECISIONS.md`: giữ cả D17–D18 và D20).
- Khách: C04 chọn Thanh toán QR (PayOS, hỏi trạng thái 3 giây, tự sang C05) / Tại cửa hàng (C04c → C05c); bỏ "Tôi đã chuyển khoản";
  giữ chỗ QR 10 phút. C07 theo F29 + "Mở cửa kho" (C07q) + màn máy quét `#/door` (C07r1/r2). C11 nút "Thanh toán" khoản gia hạn
  (C11q → C11b). C12 dòng phản hồi nhân viên. C14 "Huỷ đơn" + hộp thoại C14a (số tiền hoàn), C14b. C03b / C02m nút "Chỉ đường".
- Nhân viên / quản lý: S09 "Thu tiền tại kho", S01 ô "Chờ thu tiền tại kho", thẻ "THU TIỀN"; M02 cột "Thao tác" + hộp thoại M02a (F12 phía giao diện).
- Chữ "đối soát" đổi sang "thanh toán" / "thu tiền" ở mọi màn (khách, nhân viên, quản lý, Vận hành KD).
- API: endpoint mới gọi sẵn theo `SafeSpace-Customer-UI/BACKEND-TODO.md` mục "Mới 16/10" (P PayOS – Đạt, Q QR – Tiến,
  R/H phản hồi + hoàn tiền – Ngọc Mai, U trạng thái ô – Thắng). Backend chưa có → thông báo thay thế, không lỗi (D21).
- Mock: đủ endpoint mới, PayOS giả lập tự trả sau `MOCK_PAYOS_AUTOPAY` giây; `MOCK_LEGACY=1` tắt endpoint mới để thử như backend hiện tại.
- Test: sửa 1 kiểm tra trong `tests/reducer.test.js` (seed SS-0142 nay là đơn đã thanh toán QR theo Figma C14, không còn `PENDING_VERIFICATION`);
  thêm `tests/payment-access.test.js`, `tests/payment-api.test.mjs`, mở rộng `tests/render.test.mjs` (92 route).
- Kiểm chứng: `npm test` 56/56, `npm run test:render` 92 route PASS, `npm run test:business` PASS, `npm run build` PASS.
  Chromium + `dev:mock`: đi hết C04 → C05, C04c → C05c, C11q → C11b, C07q → máy quét, C14a, S09, M02a; với `MOCK_LEGACY=1`
  mọi màn mới hiện thông báo thay thế, không lỗi JavaScript. **Chưa chạy với .NET + SQL Server** (môi trường AI không có .NET).
- Phiên sau: Đạt chạy thử trên máy có .NET (flow cũ + thanh toán tại cửa hàng dùng `confirm-transfer`); từng người làm endpoint
  của mình theo BACKEND-TODO mục "Mới 16/10", chạy `tests/payment-api.test.mjs` vẫn pass với mock để giữ đúng hợp đồng.

## 2026-10-15 — Toạ độ bản đồ (B05a, C02m) — Claude (việc của Thắng)

- Figma: B05 thêm dòng "Vị trí bản đồ" + nút "Sửa thông tin cơ sở"; hộp thoại mới B05a.
- Backend: `Facility.Latitude/Longitude` + check constraint, trả trong `FacilityDto` và `OpsFacilityDto`, nhận trong
  `UpsertFacilityRequest` (kiểm tra trong khung Việt Nam), `FacilityCoordinateSeeder` điền 12 cơ sở còn trống.
- Frontend: `mapCatalog` gán `lat/lng`; B05a (`src/business/facility-form.js` + `Facilities.jsx`); mock business có toạ độ.
- Kiểm chứng: `npm test` 39/39, `npm run test:business` 9/9, `npm run test:render` PASS, `npm run build` PASS;
  biên dịch thử các service bằng stub EF (không tải được NuGet trong môi trường AI); Playwright: sửa toạ độ ở B05a qua mock → lưu thành công.
- Phiên sau: `dotnet ef migrations add AddFacilityCoordinates --project StorageProject.Infrastructure --startup-project StorageProject.Api`,
  `dotnet build StorageProject.slnx`, chạy API, kiểm tra `GET /api/facilities` có toạ độ và bản đồ Tìm kho đúng vị trí.

## Mẫu một mục

```
## Phiên N — YYYY-MM-DD — <người / công cụ AI>
- Tính năng: Fxx — <tên>
- Đã xong: …
- Đang dở: …
- Kiểm chứng: <lệnh đã chạy> → <kết quả>
- Bị chặn / rủi ro: …
- Phiên sau nên: …
```

---

## Phiên 7 — 2026-10-16 — Cập nhật DbSeeder, tạo role BUSINESS_OPERATOR và reset dữ liệu hệ thống mới mở

- Tính năng: Reset toàn bộ dữ liệu giao dịch/hoạt động khách hàng trong SQL Server về trạng thái hệ thống mới mở; thêm role `BUSINESS_OPERATOR` và tài khoản `operator01`; giữ nguyên đầy đủ seed data cấu hình ban đầu để khách hàng và vận hành sẵn sàng sử dụng.
- Đã xong:
  - **Cập nhật `DbSeeder.cs`:**
    - Thêm Role `BUSINESS_OPERATOR` (tên hiển thị: Quản lý vận hành kinh doanh toàn hệ thống) cùng các quyền: `REPORT_VIEW`, `AUDIT_LOG_VIEW`, `FACILITY_MANAGE`, `UNIT_MANAGE`, `RENEWAL_MANAGE`.
    - Thêm tài khoản người dùng `operator01` (email: `operator01@storage.vn`, mật khẩu: `Operator@123`, họ tên: `Lê Vận Hành Kinh Doanh`, phone: `0900000004`, trạng thái: `ACTIVE`) được gán role `BUSINESS_OPERATOR` và liên kết cơ sở.
    - Chuyển ô kho `TB-M-103` (và toàn bộ 72 ô kho trên 12 cơ sở) về trạng thái `AVAILABLE`.
    - Loại bỏ hoàn toàn Section 8 & 8b (các đơn đặt chỗ mẫu, hợp đồng mẫu, khoản thanh toán mẫu, vé hỗ trợ mẫu của khách hàng).
    - Bảo toàn toàn bộ dữ liệu nền tảng: 12 cơ sở (`facilities`), 4 loại ô kho (`unit_types`), 72 ô kho (`storage_units`), biểu phí thuê (`rental_rates`), chính sách vận hành (`policies`), các tài khoản nhân sự và khách hàng sạch (`admin`, `manager01`, `staff01`, `customer01`, `customer02`).
  - **Cập nhật Frontend Role Mapping (`roles.js`):**
    - Bổ sung `BUSINESS_OPERATOR` và `BUSSINESS_OPERATOR` vào `ROLE_LABELS`, `ROLE_ORDER`, `ROLE_SCOPE`, `isBusinessRoles`, `isOpsRoles`, `homeFor` để giao diện nhận diện và điều hướng đúng phân quyền.
  - **Dọn dẹp và nạp mới dữ liệu trên SQL Server (`SSFRMS`):**
    - Xoá sạch toàn bộ dữ liệu giao dịch cũ: `reservations`, `rental_contracts`, `payments`, `handover_records`, `return_inspections`, `support_tickets`, `unit_assignments`, `maintenance_requests`, `contract_renewals`, `overdue_cases`, `access_credentials`, `activity_logs`.
    - Chạy nạp lại dữ liệu chuẩn từ `DbSeeder.cs`.
- Kiểm chứng:
  - Kiểm tra SQL Server:
    - Bảng `reservations`, `rental_contracts`, `payments`, `support_tickets`, `handover_records`, `return_inspections`: 0 rows.
    - Bảng `storage_units`: 72/72 ô kho ở trạng thái `AVAILABLE` (100%).
    - Bảng `roles`: Đã có role `BUSINESS_OPERATOR`.
    - Bảng `users`: Đã có `operator01` với role `BUSINESS_OPERATOR`.
  - Kiểm tra API:
    - Đăng nhập `operator01` / `Operator@123` qua `POST /api/auth/login` → Trả về JWT Token với claim role `BUSINESS_OPERATOR`.
    - Gọi `GET /api/auth/profile` bằng token của `operator01` → Trả về thông tin họ tên `Lê Vận Hành Kinh Doanh`, role `BUSINESS_OPERATOR`.
    - Đăng nhập `customer01` / `Customer@123` → Trả về tài khoản sạch, 0 hợp đồng, 0 đặt chỗ, sẵn sàng đặt kho.
  - `powershell .\init.ps1` → PASS (38/38 unit tests, 76 render routes, Vite build 0 errors, .NET build 0 errors).
- Bị chặn / rủi ro: Không.
- Phiên sau nên: Tiếp tục hoàn thiện các báo cáo và chức năng dành riêng cho vai trò Business Operator nếu có yêu cầu.

## Phiên 6 — 2026-10-16 — Kết nối 100% dữ liệu frontend trực tiếp từ Database (SQL Server), loại bỏ dữ liệu mock

- Tính năng: Toàn bộ hiển thị phía Client/Ops/Admin lấy trực tiếp từ `AppDbContext` (SQL Server), loại bỏ hoàn toàn mock RAM / mock fallback.
- Đã xong:
  - **Loại bỏ in-memory state & mock fallback:**
    - Xoá bỏ hoàn toàn `GetOrCreateState` và `OpsBoardDataState` (vốn chứa 2 khoản đối soát mock `SS-20260913-0147` và `SS-20260914-0021`).
    - Trong `StaffService.cs` và `ManagerService.cs`: Tất cả các danh sách (kho `StorageUnits`, đối soát `Reservations`, phân bổ `UnitAssignments`, xác minh & bàn giao `HandoverRecords`, kiểm tra trả kho `ReturnInspections`, khiếu nại hỗ trợ `SupportTickets`, nhân sự cơ sở `UserFacilities`, doanh thu `Payments`) đều query trực tiếp từ `AppDbContext`.
    - Sửa `ParseIdNumber` và `FindReservationByIdAsync` để trích xuất chính xác ID từ chuỗi mã SafeSpace (`SS-yyyyMMdd-xxxx`, `XM-xxxx`, `BG-xxxx`, `TK-xxxx`, `OrderCode`) và tìm kiếm trên cơ sở dữ liệu thật.
    - Mọi thao tác ghi nhận (Xác nhận đối soát thanh toán, Phân bổ ô kho, Cập nhật trạng thái ô kho, Hoàn cọc, Gửi biên bản kiểm tra trả kho, Duyệt gia hạn) đều lưu vĩnh viễn vào SQL Server qua `dbContext.SaveChangesAsync()`.
  - **Frontend kết nối API thật:**
    - Cập nhật `OpsProvider` trong `src/ops/store.jsx` nhận prop `role` và gọi `loadBoard(role)` trực tiếp tới `/api/staff/board` hoặc `/api/manager/board`.
    - Chặn hoàn toàn fallback về `readOps()` khi đang ở chế độ API: nếu có lỗi sẽ hiển thị thông báo lỗi và nút thử lại, không tự động nạp mock trong local storage.
    - Kết nối các luồng khách hàng còn dở trong `store.jsx` trực tiếp vào API backend:
      - `REQUEST_RETURN` gọi `POST /api/contracts/{id}/move-out`.
      - `UPDATE_NAME` gọi `PUT /api/auth/profile`.
      - `CHANGE_PASSWORD` gọi `POST /api/auth/change-password`.
- Kiểm chứng:
  - `powershell .\init.ps1` → PASS (38/38 unit tests, 76 render routes, Vite build 0 errors, .NET build 0 errors).
  - Test trực tiếp `GET /api/staff/board` & `GET /api/manager/board` bằng tài khoản `staff01` và `manager01`: dữ liệu trả về 100% từ bảng SQL Server `Reservations`, `StorageUnits`, `UserFacilities`.
  - Test `POST /api/staff/payments/SS-20261007-0013/confirm` xác nhận thành công và kiểm tra trực tiếp row trong SQL Server: `ReservationId 13` chuyển `Status = CONFIRMED`, `PaidAt = 2026-10-16 13:55:16`.
- Bị chặn / rủi ro: Không.
- Phiên sau nên: Tiếp tục hoàn thiện các luồng nghiệp vụ còn lại hoặc viết thêm test tự động backend (F28).

## Phiên 5 — 2026-10-16 — Tái cấu trúc phân tách Staff/Manager và hoàn thiện chức năng còn thiếu

- Tính năng: F06, F10, F11–F20, refactor `OpsEndpoints` & `OpsService`.
- Đã xong:
  - **Tái cấu trúc backend theo vai trò (Role-based Refactoring):**
    - Tách `OpsService` và `OpsEndpoints` thành:
      - `IStaffService.cs` + `StaffService.cs` + `StaffEndpoints.cs` (nhóm route `/api/staff/*`, phục vụ nhân viên cơ sở).
      - `IManagerService.cs` + `ManagerService.cs` + `ManagerEndpoints.cs` (nhóm route `/api/manager/*`, phục vụ quản lý cơ sở).
      - `FacilityOpsStateStore.cs` quản lý trạng thái in-memory dùng chung giữa nhân viên và quản lý cơ sở.
      - Hỗ trợ đầy đủ routing fallback `/api/ops/*` trên backend để tương thích ngược 100%.
  - **Bổ sung các chức năng còn thiếu của các lớp user có sẵn:**
    - **Khách hàng (Customer):**
      - Thêm `POST /api/contracts/{id}/move-out`: Đăng ký lịch trả kho (ngày, khung giờ, ghi chú), tự tạo `ReturnInspection` và chuyển trạng thái hợp đồng sang `RETURN_PENDING` (F06 -> `passing`).
      - Thêm `GET /api/auth/profile`, `PUT /api/auth/profile`: Xem và cập nhật thông tin cá nhân (F10 -> `passing`).
      - Thêm `POST /api/auth/change-password`: Đổi mật khẩu cá nhân có kiểm tra mật khẩu hiện tại bằng BCrypt.
    - **Nhân viên cơ sở (Staff):**
      - Thêm `PUT /api/staff/units/{id}/status`: Đổi trạng thái ô kho độc lập (AVAILABLE, MAINTENANCE, CLEANING, OCCUPIED) (UC09).
      - Thêm `POST /api/staff/credentials/{id}/revoke`: Thu hồi quyền/mã truy cập cũ (UC08).
      - Thêm `POST /api/staff/credentials/reissue`: Cấp lại quyền/mã truy cập mới (UC08).
    - **Quản lý cơ sở (Manager):**
      - Thêm `GET /api/manager/units`: Danh sách ô kho cơ sở (UC13).
      - Thêm `POST /api/manager/units`: Tạo ô kho mới tại cơ sở (UC13).
      - Thêm `PUT /api/manager/units/{id}`: Cập nhật thông số/trạng thái ô kho (UC13).
      - Thêm `POST /api/manager/units/{id}/lock`: Khóa ô kho khi bảo trì/sự cố (UC13).
  - **Đồng bộ Frontend:**
    - Cập nhật `src/ops/api.js` gọi các endpoint mới theo vai trò (`/api/staff/*` và `/api/manager/*`).
    - Cập nhật `mock/mock-api.mjs` hỗ trợ song song `/api/staff/*`, `/api/manager/*`, `/api/ops/*`, `profile`, `change-password`, và `move-out`.
- Kiểm chứng:
  - `.\init.ps1` PASS toàn bộ:
    - Frontend: `npm test` 38/38 PASS, `npm run test:render` 76/76 PASS, `npm run build` OK.
    - Backend: `dotnet build StorageProject.slnx` 0 Warning, 0 Error.
- Phiên sau nên: Tiếp tục thực hiện các chức năng tiếp theo hoặc chuẩn bị giao diện Vận hành KD khi có yêu cầu.

## Phiên 4b — 2026-10-14 — Sửa mã QR thanh toán PayOS đúng chuẩn liên kết thanh toán

- Tính năng: F02, F03 (thanh toán PayOS QR).
- Đã xong:
  - Cập nhật `PaymentQr.jsx`: phân biệt giữa URL trang thanh toán PayOS (`checkoutUrl`) và file ảnh (`isImageUrl`); tạo mã QR chuẩn SVG từ liên kết thanh toán PayOS (`https://pay.payos.vn/web/...`) qua `QRCode.toString()`. Khách hàng quét mã bằng camera/app sẽ mở đúng liên kết PayOS. Mã QR có thể bấm trực tiếp để mở trang thanh toán.
  - Sửa `PayOSEmbeddedModal.jsx`: dùng `PaymentQr` thay vì thẻ `<img>` trực tiếp (tránh lỗi broken image khi link là webpage URL hoặc chuỗi dữ liệu).
  - Cập nhật `Checkout.jsx`: truyền `checkoutUrl` và trạng thái `loadingPayOS` vào `PaymentQr` để không bị nhấp nháy tài khoản mẫu khi đang tải từ backend.
  - Cập nhật `PayOSService.cs`: kiểm tra nếu `checkoutUrl` chưa phải là link PayOS thật (`https://pay.payos.vn`) thì gọi PayOS SDK sinh mới và lưu vào đơn đặt chỗ.
  - Hỗ trợ mock endpoints cho `/create-payos-qr` và `/status` trong `mock-api.mjs`.
- Kiểm chứng:
  - `.\init.ps1` → pass toàn bộ:
    - Frontend: `npm test` 38/38 PASS, `npm run test:render` 76 route PASS, `npm run build` OK.
    - Backend: `dotnet build StorageProject.slnx` 0 Warning 0 Error.
- Phiên sau nên: Tiếp tục thực hiện các việc ưu tiên 2 trong `BACKEND-TODO.md` (mục B).

## Phiên 5a — 2026-10-14 — Backend khu Nhân viên / Quản lý cơ sở + seed D17 (Claude)

- Tính năng: F03, F11–F21 (phần backend) + seed theo D17. Nhánh `feature/ops-backend` (tách từ `feature/figma-1410-sync`). Quyết định D18.
- Đã xong:
  - `DbSeeder` tách 3 file: 4 loại kho (thường/lạnh × M 15 m²/L 30 m²), 12 cơ sở, 12 ô K01–K12 mỗi cơ sở, giá theo
    `lib/catalog.js`; loại kho / cơ sở đời cũ chuyển ngừng dùng. Quyền STAFF, MANAGER; tài khoản `manager01`, `staff02`,
    `customer03`–`customer06`; gán cơ sở Nguyễn Lương Bằng; dữ liệu vận hành mẫu (2 khoản chờ đối soát, 1 đơn chờ phân bổ,
    1 khách chờ bàn giao, 1 gia hạn chờ duyệt, 1 hợp đồng quá hạn, 1 lịch trả kho, 1 yêu cầu hỗ trợ).
  - `/api/ops/*` (`FacilityOpsEndpoints.cs`, `FacilityOpsService*.cs`): board + 12 thao tác đúng `src/ops/api.js`.
  - `POST /api/reservations/{id}/confirm-transfer` + trạng thái `PENDING_VERIFICATION` (migration viết tay).
  - Sửa lỗi CHECK cũ: `HandoverService` (`COMPLETED` → `HANDED_OVER`), `RenewalService` (`PENDING_PAYMENT` → `PENDING`).
  - Giao diện: "Tôi đã chuyển khoản" gọi API thật; `ops/data.js` còn 12 ô; bỏ chữ "dữ liệu mẫu" trên banner khu vận hành.
  - Tài liệu: `docs/facility-ops-api.md`, `BACKEND-TODO.md` mục A, README / AGENTS (tài khoản).
- Kiểm chứng:
  - `npm test` → 41/41 pass (thêm test confirm-transfer qua mock, test mapper PENDING_VERIFICATION, test 12 ô)
  - `npm run test:render` → 76 route PASS · `npm run build` → OK
- Bị chặn / rủi ro: Đã chạy với SQL Server và kiểm chứng thành công.

## Phiên 4a — 2026-10-14 — Đồng bộ giao diện với Figma 14/10 (Claude)

- Tính năng: F30 (sơ đồ ô kho) + trang chủ, danh mục kho, header khu vận hành. Nhánh `feature/figma-1410-sync`. Quyết định D17.
- Đã xong (chỉ frontend):
  - Trang chủ mới (`pages/Home.jsx`): hero ảnh + tìm theo khu vực / loại / cỡ, dải số liệu, 4 loại kho, 3 bước,
    cơ sở theo chip khu vực, khối kêu gọi, footer. Bỏ CSS trang chủ cũ không còn dùng.
  - Sơ đồ 12 ô (`lib/units.js`, `UnitMap.jsx`): dãy A cỡ M, dãy B cỡ L; dữ liệu backend gắn ô theo loại + cỡ.
  - Bỏ cỡ S (`lib/catalog.js`), 2 cỡ M 15 m² / L 30 m²; bảng giá P01 còn 2 thẻ, có giá kho lạnh.
  - Bỏ "Gần bạn nhất", "Cách bạn … km", `distance_km`, `distanceLabel`.
  - 12 cơ sở đều có kho lạnh; sửa quận Tân Thuận, Phú Mỹ Hưng về Quận 7; đơn mẫu B-015 đổi sang kho lạnh cỡ M.
  - Header khu Nhân viên / Quản lý hiện tên cơ sở phụ trách dưới vai trò.
- Test đã sửa theo quy tắc mới (không phải để cho pass): `units.test.js` (10 → 12 ô), `reducer.test.js`
  (Quận 7 có 5 cơ sở, cả 12 có kho lạnh, giá B-015 mới, thêm kiểm tra cỡ S bị từ chối), `api-mappers.test.js`
  (loại kho ≤ 20 m² là cỡ M), `render.test.mjs` (lọc cỡ M thay cỡ S).
- Kiểm chứng: `npm test` → 39/39 pass; `npm run test:render` → 76 route PASS; `npm run build` → OK.

## Phiên 3a — 2026-10-14 — Backend khu Quản lý vận hành KD (Claude)

- Tính năng: F24 (role OPERATIONS), F22 (cơ sở, chính sách, bảng giá), F23 (báo cáo + xuất CSV) — phía backend.
  Nhánh `feature/operations-backend`.
- Đã xong:
  - Role `OPERATIONS`, quyền `POLICY_MANAGE`, `REPORT_SYSTEM`, `REPORT_EXPORT`, tài khoản `ops01` / `Ops@123`
    (`DbSeeder.EnsureOperationsRoleAsync`, chạy lại được với DB cũ).
  - `/api/operations/*`: cơ sở (UC19), chính sách (UC20–21), bảng giá (UC21), báo cáo theo cơ sở / loại kho / tháng /
    trạng thái, drill-down hợp đồng, xuất CSV (UC22–23). Hợp đồng API: `docs/operations-api.md`. Không có migration mới.
  - Đặt chỗ: chặn cơ sở không ACTIVE; tiền cọc và giá chỉ lấy chính sách / giá `ACTIVE` còn hiệu lực (D16).

## Phiên 2 — 2026-10-01 — Giao diện theo Figma 30/09, khu Nhân viên / Quản lý cơ sở

- Tính năng: F30 (mới), F21, F11–F20 (phía giao diện). Nhánh `feature/figma-3009-staff-manager`.
- Đã xong (chỉ frontend, không sửa backend):
  - Figma: ô trống màu xanh, bỏ ảnh sơ đồ mặt bằng khỏi thư viện ảnh, sửa nút đen, xếp frame theo vai trò và thứ tự luồng.
  - Khách hàng: sơ đồ ô kho trong chi tiết cơ sở (D13), tìm kho trên bản đồ + nút Danh sách / Bản đồ (D12),
    bỏ footer mọi trang, một dòng thông báo khi chưa có kho.
  - Khu Nhân viên `#/staff` (S01–S05, S09) và Quản lý cơ sở `#/manager` (M01–M07) trong `src/ops/`, lưới 3×3 (D14).
  - Hợp đồng `/api/ops/*` + dự phòng lưu trình duyệt (D15); việc backend còn thiếu: `BACKEND-TODO.md`.
- Kiểm chứng: `npm test` → 38/38 pass; `npm run test:render` → 76 route PASS; `npm run build` → OK;
  chạy tay luồng khách / nhân viên / quản lý trên mock (`MOCK_OPS=1`). **Chưa chạy với backend .NET thật.**
- Bị chặn / rủi ro:
  - Backend chưa có `/api/ops/*`, tài khoản seed MANAGER, lọc theo cơ sở (UserFacility) → F11–F21 để `blocked`.
  - D13 cần nhóm chốt có cho khách giữ đúng ô đã chọn không.
  - Luồng nghiệp vụ D02 không đổi. F29 chưa kiểm lại, giữ nguyên trạng thái.
- Phiên sau nên: người phụ trách backend làm `BACKEND-TODO.md` mục A, chạy `npm run dev` với backend thật
  và đi hết luồng đặt → đối soát → phân bổ → xác minh → bàn giao; pass thì đổi F11–F21 sang `passing`.

## Phiên 1 — 2026-09-26 — Rà mâu thuẫn Figma

- Tính năng: (không có — rà soát thiết kế trước khi chốt "Figma là chuẩn")
- Đã xong: đọc chữ và liên kết prototype của toàn bộ màn trong Figma "SafeSpace - Modern UI"; sửa trực tiếp
  trong Figma các chỗ mâu thuẫn về luồng / trạng thái / nhân vật / liên kết (bỏ qua ảnh, giá, số liệu).
  Danh sách đầy đủ: `docs/figma-review-2026-09-26.md`. Chốt D02 theo Figma, thêm D11.
- Kiểm chứng: quét lại toàn file Figma không còn "SafeSpace Quận 7", "Trần Minh", "Lê Anh", gia hạn B-015 "đã gửi";
  chụp lại C01, C07, C11, C14, M03, M07, A04 để kiểm tra bố cục.
- Bị chặn / rủi ro: code giao diện còn cho gia hạn / trả kho khi hợp đồng chưa bàn giao và câu tiền cọc cũ → F29.
  SRS mục A03 cần sửa cho khớp D02.
- Phiên sau nên: làm F29 (nhỏ, chỉ giao diện) hoặc F28.

## Phiên 0 — 2026-09-26 — Thiết lập harness

- Tính năng: (không có — phiên khởi tạo, chưa viết code tính năng)
- Căn cứ: hướng dẫn Harness Engineering tại https://learnharness.org/#dinh-nghia và https://skills.learnharness.org/
  (thầy Hoàng Giáo Làng giới thiệu tại Build With AI #3: From Working Code To Reliable Product).
- Đã xong: thêm `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `DECISIONS.md`,
  `init.sh`, `init.ps1`, `docs/` (architecture, business-rules, conventions, verification, templates/sprint-contract).
- Hiện trạng code (commit `5177812`, main):
  - Giao diện khách hàng C01–C14 và quản trị A01–A04 đã có, gọi API thật cho các luồng backend đã hỗ trợ.
  - Backend .NET: auth, facilities/rates/availability, reservations, contracts, payments, renewals,
    handover confirm, tickets, toàn bộ `/api/admin/*`.
  - Chưa có: giao diện Nhân viên / Quản lý cơ sở / Quản lý vận hành KD (UC07–UC23).
- Kiểm chứng:
  - `npm test` → 28/28 pass
  - `npm run test:render` → 38 route PASS
  - `npm run build` → OK
  - `dotnet build` → **chưa chạy** (máy thiết lập không có .NET). Phiên sau chạy `./init.sh` trên máy có .NET để xác nhận.
- Bị chặn / rủi ro:
  - Backend không có test tự động → kiểm chứng backend yếu (F28).
  - Luồng thanh toán lúc đặt (Figma) lệch SRS A03 → đã chốt theo Figma ở Phiên 1 (D02).
  - `README.md` gốc chưa khớp code: ghi .NET 9 (project là `net10.0`); mục cấu trúc frontend còn tên cũ
    (`services/`, `customer.css`); nhắc tag "BẢN DEMO UI" không còn trong code.
- Phiên sau nên: chạy `./init.sh` đầy đủ trên máy có .NET; sau đó làm F28 (test backend) hoặc F21
  (khu Nhân viên / Quản lý) tuỳ nhóm ưu tiên.

## C07 QR frontend — 2026-10-16 — Tiến / Codex
- Thêm component QR riêng + 2 dòng vào Units.jsx; không sửa nghiệp vụ cũ, API hoặc DB.
- C07q xem QR, C07r1/C07r2 kết quả quét; mô phỏng chỉ VITE_USE_API=false, API thật báo chưa hỗ trợ.
- Kiểm chứng: 42 test gốc, 10 test QR, 9 test business pass; 76 route SSR pass; Vite build pass.
- Browser Chromium: popup 480x598, QR, kết quả mở cửa, từ chối hết hạn, icon 96px, Escape, Đóng, khóa chưa bàn giao, mobile 390px, không pageerror.
- Chưa có backend QR; hướng dẫn C07-QR-HUONG-DAN.md.

## 2026-10-20 — F35 kiểm khoản thu và phân bổ, thanh toán tại kho, F12

- Theo yêu cầu người dùng sửa cùng gói: PayOS kiểm số tiền và orderCode, ghi RENT/DEPOSIT vào payments trước khi có hợp đồng; gắn lại PaymentId khi phân bổ, không thu thêm. Bỏ phân bổ tự động khỏi webhook. Chuyển trả tại kho huỷ link trước khi đổi, S09 thu tiền mặt, xử lý callback muộn bằng PAYMENT_REVIEW_REQUIRED.
- D23–D24 bổ sung, không sửa số/nội dung D19–D22. Trạng thái ô bằng tay có lý do, quy tắc và unit_status_history. Xoá các route /api/ops trùng trong Staff/Manager để giữ một bộ đăng ký; các thao tác thu tiền/phân bổ tương thích dùng chung xử lý.
- Migration mới 20261020154838_ReservationPaymentIntegrity: PaymentMethod, PENDING_AT_FACILITY, Payment.ReservationId, ContractId optional, unique index khoản thu. Nối các dòng cũ không mơ hồ; không xoá database/dữ liệu. Worker thu hồi giữ chỗ tại kho hết hạn. Không sửa migration cũ.
- Chặn xác minh/bàn giao chưa có đủ khoản thu, đồng bộ trạng thái xác minh từ HandoverRecord thay vì đánh dấu CHECKED_IN trước khi bàn giao. Test luồng chọn trả tại kho → phân bổ → thu → xác minh → bàn giao giữ nguyên hai khoản thu.
- Kiểm chứng: .NET SDK 10.0.100; dotnet build StorageProject.slnx -m:1 PASS; xUnit 15/15 PASS (SQLite, adapter SDK chữ ký sai, model SQL Server khớp snapshot, route không trùng); npm test 67/67 PASS; test:business 9/9 PASS; test:render 92 route PASS; npm run build PASS; bash init.sh PASS với dotnet build/test chạy m:1 do giới hạn tiến trình của môi trường; git diff --check PASS; sinh được SQL upgrade từ migration toạ độ tới migration mới.
- Giới hạn kiểm chứng: chưa chạy SQL Server thật, chưa thử PayOS/ngrok bằng key thật, chưa kiểm khoá/đồng thời trên SQL Server hay migration trên dữ liệu DB của nhóm. F35 giữ active, không tuyên bố 7 flow hoàn tất. Các cảnh báo dependency NU1902/NU1903 và nullable Board.cs:317 đã có từ nguồn.
- Chỉ bàn giao ZIP/bản vá để người dùng áp dụng và chạy thử trước khi tự push nhánh. Không push/PR/merge từ phiên này.


## 2026-10-20 — F36: Cấu trúc frontend và quy tắc đặt tên

- Nền: nhánh thanh toán người dùng đã push, b482840; giữ sửa DbSeeder. Chỉ đổi cấu trúc FE và hướng dẫn, không đổi nghiệp vụ/URL/API/localStorage.
- Chuyển 79 file; tách 6 module gom trang thành từng Page theo chức năng. Phần chung Staff/Manager dùng facility-operations; app chứa router/provider chung; shared chứa UI/API nền/utils.
- Tên component Page khớp tên file. Thêm FRONTEND-MAP.md, docs/frontend-naming.md, hướng dẫn AGENTS trong FE và chỉ dẫn Copilot; CLAUDE.md hiện trỏ AGENTS gốc. Có npm run check:structure.
- Test chỉ cập nhật import/module path, giữ assertion. Kiểm tra 532 khai báo AST tương đương sau đổi tên identifier/import/export.
- Kiểm chứng: check:structure PASS; npm test 67/67; test:business 9/9; test:render 92 routes; build PASS; init.sh PASS (dotnet dùng -m:1 do giới hạn môi trường); git diff --check PASS. Các cảnh báo dependency/nullable/chunk size cũ vẫn còn.
- Chưa kiểm thử lại tương tác trình duyệt/API thật; SSR không bao phủ thao tác. ZIP dùng git apply để thêm file mới và xoá file cũ, có kiểm tra trước khi áp dụng. Không push/PR/merge.


## 2026-10-21 — F37 tách backend C13 và S05/C12

- Theo yêu cầu mới nhất của người dùng, chỉ chuẩn bị hai luồng đã kiểm tra đạt để push trước; gói backend độc lập trên main fc83c3a. Không đưa phí trả kho, huỷ/hoàn tiền, migration hay frontend vào bản vá. Giữ các công việc đang làm dở ở thư mục/nhánh cũ.
- C13 kiểm tên và mật khẩu, lỗi đầu vào trả 400; test đọc lại database và kiểm tài khoản khác không đổi. S05/C12 ánh xạ chủ đề hợp lệ, đọc ticket theo cơ sở hợp đồng, chuẩn hoá trạng thái/ghi chú, lưu audit phản hồi và trả nội dung cho chủ ticket.
- Gộp phần hỗ trợ từ bản bổ sung đã bàn giao; loại bỏ các hunk S04 dùng chung trong StaffService để không phụ thuộc FinanceService. Giữ nguyên hàm trả kho của main. Code cũ giữ trong comment // ở các đoạn thay đổi.
- Kiểm chứng: .NET SDK 10.0.402; build -m:1 PASS; xUnit 34/34 (15 test main + 19 trường hợp AuthSupport, SQLite); check:structure PASS; FE 68/68; business 9/9; SSR 92 route PASS; build FE và init.sh PASS. init dùng wrapper dotnet thêm -m:1 do giới hạn tiến trình; không sửa init.sh.
- Cảnh báo có sẵn NU1902/NU1903, nullable Board.cs và kích thước chunk/font frontend vẫn còn. Chưa chạy SQL Server thật cho bản tách riêng. Người dùng đã báo C13 và S05/C12 đạt trước khi tách; cần kiểm tra lại sau khi áp dụng. F37 giữ active.
- Figma từ chối quyền đọc thiết kế/ảnh; không có thay đổi giao diện và không tuyên bố đã đối chiếu thiết kế trực tiếp.
- Không push/PR/merge. Bàn giao patch, danh sách file và hướng dẫn tạo worktree riêng để người dùng tự kiểm tra, commit và push.

## 2026-10-22 — F38 đồng bộ giao diện và luồng Figma
- Nền 0e70026, giữ thay đổi quản trị và Auth/Support mới trên main. Tính năng phiên này duy nhất F38; không đổi trạng thái F35/F37 đang chờ nhóm kiểm chứng.
- Người dùng chọn "Hệ thống tự chọn" khi hỏi cách phân bổ sau PayOS. D26 thay yêu cầu bàn giao, PIN8 và phân bổ thủ công thường lệ. Vì vậy các assertion cũ yêu cầu webhook không phân bổ, bàn giao kích hoạt, PIN8, QR bị khóa trước nhận chìa khóa cần cập nhật theo nghiệp vụ mới; giữ kiểm tiền, quyền sở hữu, chống trùng và các kiểm chứng khác.
- Đang kiểm chứng toàn bộ FE/BE, tương tác trình duyệt và ZIP. Chưa tuyên bố PayOS/SQL Server/thiết bị thật đạt.

- Bàn giao F38: frontend cuối 76/76, SSR 92 route, check:structure/build đạt; business 9/9; backend build + 40 test SQLite trong phiên. Browser 13 nhóm PASS, so ảnh header trước/sau cuộn ở 5 role không đổi; hủy xác nhận không request, xử lý xong giảm badge, thất bại giữ draft, mobile không tràn. Chưa xác nhận SQL Server/PayOS/thiết bị thật; xem docs/figma-ui-sync-2026-10-22.md.

## 2026-10-22 — D27 chốt chính sách cọc và hoàn tiền

- Nhóm chốt theo D27 (DECISIONS.md): cọc 1 tháng thuê, hủy trước StartDate giữ 10% cọc, dừng sau StartDate hoàn 70% cọc, phương án B cho tiền thuê khi dừng giữa kỳ, phạt quá hạn theo tham số OVERDUE ở B02, DamageFee và OverdueFee trừ thêm vào cọc.
- Chưa có code: feature_list.json không đổi trạng thái vì chưa có bằng chứng chạy. Phần cần làm đã ghi trong BACKEND-TODO.md mục D27.
- Cần đổi: H1 cancel-preview và CANCEL_FEE_RATE đang tính 10% tiền thuê, không theo D27. T05 trong doc vẫn để "theo chính sách đã chốt".

## 2026-10-22 — F39 code chính sách cọc và hoàn tiền D27 (T01, T05, T08)

- Tính năng phiên này duy nhất F39; nền origin/main 248a083. Làm theo D27, không đổi quyết định.
- Backend: RefundPolicy (hàm thuần), cancel-preview, huỷ đơn đã thanh toán ghi một khoản REFUND PENDING, M07 xác nhận hoàn cho đơn đã huỷ, ConfirmRefundAsync hợp đồng tính theo D27 và chỉ trừ trong phạm vi cọc (phần thiếu giữ thành công nợ). Chính sách OVERDUE seed đổi mô tả thành 5% tiền thuê tháng mỗi ngày trễ.
- Frontend: cancelPreviewOf đổi sang 10% tiền cọc; test huỷ đơn (C14a) cập nhật số mong đợi 4.600.000 − 115.000. Không sửa test nào để cho qua; chỉ đổi số liệu theo D27.
- Kiểm chứng: FE npm test 76/76. Backend: phiên này không có .NET SDK nên chưa biên dịch và chưa chạy test; đã thêm RefundPolicyTests (11 trường hợp) và đối chiếu công thức tháng bằng bản tính độc lập. F39 giữ active, chưa passing.
- Giả định cần nhóm xác nhận: (1) dừng sớm thì khấu trừ cố định 30% đã bao gồm khoản vệ sinh 10%; (2) khoản CLEANING_FEE chờ thanh toán được coi là đã nằm trong khoản khấu trừ cố định; (3) quá hạn tính từ EndDate đến ngày biên bản trả kho; (4) khoản gia hạn (RENEWAL) không nằm trong phần hoàn tiền thuê.
- Không push/PR/merge.

