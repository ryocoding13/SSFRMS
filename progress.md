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

## Phiên 5 — 2026-10-14 — Backend khu Nhân viên / Quản lý cơ sở + seed D17 (Claude)

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
  - Backend: máy làm không tải được NuGet → **chưa chạy `dotnet build` thật**; đã biên dịch kiểm kiểu các file sửa
    với bản giả lập EF Core → 0 lỗi. **Chưa chạy với SQL Server.**
- Bị chặn / rủi ro: cần một bạn chạy `dotnet build` + chạy API trên máy có SQL Server, đi luồng ở
  `docs/facility-ops-api.md` mục 5. Nên xoá database cũ trước (seed chỉ thêm phần thiếu).
- Phiên sau nên: chạy thử luồng trên; pass thì đổi F03, F11–F21 sang `passing`. Sau đó giao diện B01–B05 (Vận hành KD).

## Phiên 4 — 2026-10-14 — Đồng bộ giao diện với Figma 14/10 (Claude)

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
- Kiểm chứng: `npm test` → 39/39 pass; `npm run test:render` → 76 route PASS; `npm run build` → OK;
  chụp màn hình trang chủ (1440 px và 390 px), sơ đồ 12 ô, header quản lý / nhân viên ở chế độ không backend.
- Chưa làm: dữ liệu khu vận hành (`ops/data.js`) vẫn dùng diện tích cũ và 86 ô; backend chưa đổi seed (D17);
  dòng thông báo trong `OpsShell.jsx` còn chữ "dữ liệu mẫu" (trái D07/D15).
- Phiên sau nên: cập nhật `DbSeeder` theo D17, rồi chạy giao diện với backend thật.

## Phiên 3 — 2026-10-14 — Backend khu Quản lý vận hành KD (Claude)

- Tính năng: F24 (role OPERATIONS), F22 (cơ sở, chính sách, bảng giá), F23 (báo cáo + xuất CSV) — phía backend.
  Nhánh `feature/operations-backend`.
- Đã xong:
  - Role `OPERATIONS`, quyền `POLICY_MANAGE`, `REPORT_SYSTEM`, `REPORT_EXPORT`, tài khoản `ops01` / `Ops@123`
    (`DbSeeder.EnsureOperationsRoleAsync`, chạy lại được với DB cũ).
  - `/api/operations/*`: cơ sở (UC19), chính sách (UC20–21), bảng giá (UC21), báo cáo theo cơ sở / loại kho / tháng /
    trạng thái, drill-down hợp đồng, xuất CSV (UC22–23). Hợp đồng API: `docs/operations-api.md`. Không có migration mới.
  - Đặt chỗ: chặn cơ sở không ACTIVE; tiền cọc và giá chỉ lấy chính sách / giá `ACTIVE` còn hiệu lực (D16).
- Kiểm chứng:
  - `dotnet build StorageProject.Core` → Build succeeded, 0 warning.
  - Không tải được NuGet trong môi trường làm việc → biên dịch file mới / file sửa với lớp giả lập API EF Core → Build succeeded.
  - **Chưa chạy `dotnet build StorageProject.slnx` đầy đủ và chưa chạy với SQL Server thật.**
- Bị chặn / rủi ro: giao diện B01–B05 chưa có. Nếu B làm PayOS đổi `Payment.ContractId` thành không bắt buộc thì
  `OperationsReportService.LoadAsync` cần lọc `p.ContractId != null` (khoản chưa có hợp đồng chưa thuộc cơ sở nào).
- Phiên sau nên: chạy `dotnet build StorageProject.slnx` + chạy API, đăng nhập `ops01`, thử các request trong
  `StorageProject.Api.http` mục Vận hành KD; pass thì đổi F24 sang `passing`, F22–F23 chờ giao diện B01–B05.

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
