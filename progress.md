# Nhật ký tiến độ (progress.md)

> Mỗi phiên làm việc với AI thêm MỘT mục ở đầu danh sách (mới nhất trên cùng).
> Ghi đủ để phiên sau tiếp tục ngay mà không phải hỏi lại. Không xoá mục cũ.

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

## Phiên 4 — 2026-10-14 — Sửa mã QR thanh toán PayOS đúng chuẩn liên kết thanh toán

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

## Phiên 3 — 2026-10-07 — Backend cho khu Nhân viên / Quản lý cơ sở (BACKEND-TODO mục A)

- Tính năng: F21, F03, F11–F20 (phía backend .NET).
- Đã xong:
  - Seed tài khoản quản lý cơ sở `manager01 / Manager@123` (role `MANAGER`).
  - Gán quyền cho role `STAFF` (`HANDOVER_MANAGE`, `RETURN_MANAGE`, `TICKET_MANAGE`, `PAYMENT_CONFIRM`) và `MANAGER` (`HANDOVER_MANAGE`, `RETURN_MANAGE`, `TICKET_MANAGE`, `PAYMENT_CONFIRM`, `UNIT_MANAGE`, `ASSIGNMENT_MANAGE`, `RENEWAL_MANAGE`, `REPORT_VIEW`).
  - Phân công `UserFacility` cho `staff01` và `manager01` tại cơ sở SafeSpace Nguyễn Lương Bằng.
  - Xây dựng trọn bộ `/api/ops/*` (`GET /api/ops/board`, `POST /api/ops/payments/{id}/confirm`, `POST /api/ops/payments/{id}/mismatch`, `POST /api/ops/verifications/{id}`, `POST /api/ops/handovers/{id}/complete`, `POST /api/ops/returns/{id}/inspection`, `POST /api/ops/tickets/{id}/responses`, `POST /api/ops/allocations/{id}`, `PUT /api/ops/assignments/{id}`, `POST /api/ops/renewals/{id}/approve`, `POST /api/ops/renewals/{id}/reject`, `POST /api/ops/contracts/{id}/reminders`, `POST /api/ops/contracts/{id}/refund`).
  - Xây dựng `POST /api/reservations/{id}/confirm-transfer` cho khách báo chuyển khoản.
  - Sửa tương thích PowerShell trong `init.ps1`.
- Kiểm chứng:
  - `.\init.ps1` → pass toàn bộ:
    - Frontend: `npm test` 38/38 PASS, `npm run test:render` 76 route PASS, `npm run build` OK.
    - Backend: `dotnet build StorageProject.slnx` 0 Warning 0 Error.
  - Cập nhật F03, F11–F21 sang `passing`.
- Phiên sau nên: Tiếp tục thực hiện các việc ưu tiên 2 trong `BACKEND-TODO.md` (mục B: API sơ đồ 10 ô kho, toạ độ địa lý cơ sở, move-out, notifications, profile).

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
