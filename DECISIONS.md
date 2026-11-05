# Quyết định thiết kế (DECISIONS.md)

> Ghi lại vì sao chọn A thay vì B, để phiên AI sau không tự đảo ngược.
> Muốn đổi một quyết định → thêm quyết định mới ghi "Thay thế Dxx", không sửa mục cũ.
> Trạng thái: **Đã chốt** · **Cần nhóm chốt** · **Đã thay thế**.

## D01 — Figma là chuẩn cho giao diện khách hàng — Đã chốt
- Giao diện code bám file Figma "SafeSpace - Modern UI". Backend được sửa cho khớp giao diện, không ngược lại.
- Figma đã được rà và sửa hết mâu thuẫn về luồng ngày 26/09/2026 (D11, `docs/figma-review-2026-09-26.md`).
- Những gì backend cần bổ sung: `BE-CONTRACT.md`.

## D02 — Thời điểm thanh toán khi đặt chỗ — Đã chốt theo Figma (26/09/2026)
- Theo D01: khách chuyển khoản QR ngay lúc đặt (C04), bấm "Tôi đã chuyển khoản" → đơn "Chờ đối soát";
  nhân viên đối soát (S09) → quản lý phân bổ kho (M05) → nhận kho theo lịch (S02, S03). Hết giờ giữ chỗ → đơn tự huỷ (C04b).
- SRS v2.0 mục A03 (thanh toán sau hợp đồng DRAFT) khác luồng này → nhóm cần sửa SRS cho khớp.
- Backend còn thiếu API báo đã chuyển khoản và đối soát (F03).

## D03 — Khách đăng ký dùng email làm username — Đã chốt
- Backend chỉ đăng nhập bằng `username`; Figma không có ô username.
- Khi khách đăng ký trên giao diện, `username = email`. Tài khoản seed vẫn dùng username (`customer01`…).

## D04 — Luồng backend chưa hỗ trợ thì lưu trong trình duyệt theo tài khoản — Đã chốt
- Áp dụng: báo đã chuyển khoản, trả kho, thông báo, đổi tên, ảnh đính kèm hỗ trợ.
- Khi backend có API: chỉ sửa nhánh `ApiProvider` trong `src/state/store.jsx`; không rải lời gọi API vào page.

## D05 — Tên vai trò lấy từ backend, không cứng trong giao diện — Đã chốt
- Backend có `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`; SRS/Figma có thêm Quản lý vận hành KD.
- Giao diện quản trị đọc `GET /api/admin/roles`, nên thêm vai trò ở backend (F24) là giao diện tự hiện.

## D06 — Ảnh cơ sở là file tĩnh của nhóm — Đã chốt
- Dùng ảnh thật của nhóm trong `public/images/` (mặt tiền, bên trong, sơ đồ), không lấy ảnh từ Figma.
- Cách gán ảnh cho cơ sở nằm ở `src/config/media.js`; khi có API ảnh chỉ đổi file này.

## D07 — Giao diện trông như sản phẩm chính thức — Đã chốt
- Không hiện chữ "demo", "bản thử", "dữ liệu mẫu", "sample" trên giao diện, kể cả khi chạy không có backend.

## D08 — Quy trình Git — Đã chốt
- Mỗi việc một nhánh `feature/<tên>` → Pull Request vào `main`. Giao diện khách hàng dùng `feature/customer-ui-figma`.
- Commit theo tính năng: `feat(F05): …`, `fix(F02): …`, `docs: …`.

## D09 — Tiền cọc và số tiền chuyển lúc đặt — Đã chốt (phía giao diện)
- Cọc = 1 tháng tiền thuê. Số tiền chuyển lúc đặt = tiền thuê cả kỳ + cọc. Gói thuê 1 / 3 / 6 tháng.
- Đi cùng luồng thanh toán lúc đặt (D02).

## D10 — Thời gian từ backend coi là UTC — Đã chốt
- Backend trả DateTime không kèm múi giờ; giao diện hiểu là UTC. Nên cấu hình JSON backend trả kèm `Z`.

## D11 — Figma đã rà mâu thuẫn, mọi màn dùng chung một mốc dữ liệu — Đã chốt (26/09/2026)
- Mốc chung 14/09/2026: A-102 chờ nhận kho 20/09; B-015 sắp hết hạn, chưa gửi gia hạn; HT-0082 thuộc B-015;
  một tên cơ sở "SafeSpace Nguyễn Lương Bằng"; một nhân viên Trần Văn Long. Chi tiết: `docs/figma-review-2026-09-26.md`.
- Quy tắc rút ra từ Figma: hợp đồng **chưa bàn giao** chỉ cho "Xem lịch nhận kho" / "Đổi lịch nhận kho" / hỗ trợ;
  gia hạn và trả kho chỉ mở sau khi nhận kho. Gia hạn gửi chậm nhất 7 ngày trước ngày kết thúc; tiền cọc chuyển sang kỳ mới.
- Ảnh, giá, số liệu trong Figma chỉ là minh hoạ — dữ liệu thật lấy từ backend.

## D12 — Tìm kho: chế độ Bản đồ chỉ hiện bản đồ — Đã chốt (01/10/2026)
- `#/find` (Danh sách) và `#/find/map` (Bản đồ) chuyển qua nút Danh sách / Bản đồ trên đầu trang.
- Chế độ Bản đồ không hiện danh sách cơ sở bên cạnh; bấm điểm trên bản đồ → popup có "Xem chi tiết cơ sở".
- Bản đồ dùng Leaflet + OpenStreetMap (ghi công trong `THIRD-PARTY-NOTICES.md`); toạ độ cơ sở ở `src/config/geo.js`.

## D13 — Sơ đồ ô kho ở chi tiết cơ sở: chọn ô để xem giá, quản lý vẫn phân bổ — Cần nhóm chốt
- Nút "Sơ đồ tình trạng kho" thay phần ảnh + tiện ích bằng sơ đồ 10 ô; ô trống màu xanh như nút bấm.
  Chọn ô → tóm tắt đặt trước đổi theo loại kho / diện tích / giá của ô đó; ô không trống thì khoá nút đặt.
- Ô khách chọn được gửi kèm đơn (`unit_code`) chỉ như **mong muốn**; quản lý vẫn phân bổ chính thức ở M05 (giữ D02).
- Ảnh sơ đồ mặt bằng bỏ khỏi thư viện ảnh cơ sở (sơ đồ ô kho thay thế); D06 vẫn giữ cho ảnh mặt tiền / bên trong.
- Số ô trống lấy từ `POST /api/availability/check`. Khi backend có `GET /api/facilities/{id}/units` thì sơ đồ dùng ô thật.
- Nhóm cần chốt: có cho khách giữ đúng ô đã chọn hay không. Nếu có → đổi D02 và API đặt chỗ.

## D14 — Công việc nhân viên dạng lưới 3×3 — Đã chốt (01/10/2026)
- Mỗi trang danh sách việc của nhân viên hiện tối đa 9 thẻ (3×3), có phân trang.
- Ô / mục không có việc hiện "Chưa có việc" — không để trống. Khách chưa thuê kho thì phần kho chỉ hiện một dòng thông báo.

## D15 — Khu vận hành gọi `/api/ops/*`, chưa có thì lưu trong trình duyệt — Đã chốt (mở rộng D04)
- Khu Nhân viên (`#/staff`) và Quản lý cơ sở (`#/manager`) dùng một hợp đồng API: `GET /api/ops/board` + các lệnh
  `POST /api/ops/...` (chi tiết `BACKEND-TODO.md` mục A). Mọi lời gọi nằm trong `src/ops/api.js` + `src/ops/store.jsx`.
- Backend trả 404 cho `/api/ops/board` → giao diện chuyển sang lưu trên trình duyệt (`safespace.ops.v1`) và hiện dòng
  "Khu vận hành chưa kết nối được máy chủ. Thao tác đang được lưu trên trình duyệt này." (không dùng chữ "dữ liệu mẫu", theo D07).
- Mock `npm run dev:mock` với `MOCK_OPS=1` có đủ endpoint này để thử; backend làm xong thì không cần sửa giao diện.

## D16 — Vai trò Vận hành KD và quy ước báo cáo — Đã chốt (14/10/2026)
- Tên role backend là `OPERATIONS` (khớp `src/lib/roles.js`). API riêng `/api/operations/*`, chỉ role này gọi được;
  hợp đồng chi tiết ở `docs/operations-api.md`. Tài khoản seed `ops01` / `Ops@123`.
- Chính sách `DEPOSIT`: `PERCENTAGE` = % tiền thuê cả kỳ; `FIXED ≥ 1.000` = số tiền VND; `FIXED < 1.000` = số tháng tiền thuê
  (giữ nghĩa của chính sách seed `Value = 1` = 1 tháng, khớp D09). Chỉ chính sách `ACTIVE` còn hiệu lực mới được áp dụng.
- Tra cứu giá thuê chỉ lấy `rental_rates.Status = ACTIVE`, để giá bị thay thế (`INACTIVE`) không còn được dùng.
- Báo cáo: `payments` chưa có `original_payment_id`, và hoàn tiền hiện chỉ có hoàn cọc, nên mọi REFUND trừ vào
  "Cọc còn giữ"; "Doanh thu thuê và phí" không trừ REFUND. Khi thêm hoàn tiền thuê/phí thì phải thêm liên kết khoản gốc.
- Cơ sở `TEMPORARILY_CLOSED` chặn đặt chỗ mới; `INACTIVE` chỉ khi không còn hợp đồng / đơn đang xử lý. Không xoá cơ sở.

## D17 — Mô hình kho theo Figma 14/10: 2 cỡ, mọi cơ sở có kho lạnh, gợi ý theo khu vực — Đã chốt (14/10/2026)
- Chỉ còn 2 cỡ kho: **Cỡ M · 15 m²** và **Cỡ L · 30 m²** (bỏ cỡ S). Loại kho từ backend: diện tích ≤ 20 m² là M, lớn hơn là L.
- Cả 12 cơ sở đều có kho thường và kho lạnh. Mỗi cơ sở 12 ô: 8 kho thường (4 M + 4 L) và 4 kho lạnh (2 M + 2 L).
  Sơ đồ ô kho: dãy A cỡ M (K01–K04 thường, K05–K06 lạnh), dãy B cỡ L (K07–K10 thường, K11–K12 lạnh).
- Gợi ý cơ sở theo **khu vực khách chọn**, không theo vị trí người dùng: bỏ "Gần bạn nhất" và "Cách bạn … km".
- Tên loại kho hiển thị là "Kho lạnh" (thay "Kiểm soát nhiệt độ") cho khớp Figma.
- Nhân viên / quản lý cơ sở thấy tên cơ sở phụ trách dưới vai trò trên header (SRS A06: mỗi người 1 cơ sở).
- Trang chủ theo Figma mới: hero ảnh + tìm theo khu vực, số liệu, 4 loại kho, 3 bước, cơ sở theo khu vực, kêu gọi, footer.
- Backend đổi seed cho khớp (4 loại kho, 12 cơ sở, 12 ô mỗi cơ sở) — đã làm ở D18.

## D18 — Backend khu Nhân viên / Quản lý cơ sở (`/api/ops/*`) và seed theo D17 — Đã chốt (14/10/2026)
- Làm đúng hợp đồng giao diện đã có (`src/ops/api.js`, mẫu JSON trong `BACKEND-TODO.md`); tài liệu `docs/facility-ops-api.md`.
- Id trong API là **mã hiển thị** (`SS-…`, `XM-`/`BG-`, `TK-`, `HT-`, `GH-`, `HĐ-…`, `PC-<mã việc>`, `NV-<userId>`), backend đọc số cuối.
- Phạm vi: chỉ cơ sở đang phân công trong `user_facilities` (A06); khác cơ sở trả 404, chưa phân công trả 403.
- Không thêm bảng mới. Phần bảng chưa có cột (loại giấy tờ + 4 số cuối, biên bản trả kho 4 mục, phản hồi hỗ trợ,
  lý do từ chối gia hạn, lần nhắc khách, thời điểm khách báo chuyển khoản, báo sai lệch) lưu và đọc lại từ `activity_logs`.
- `handover_records.StaffId` và `return_inspections.StaffId` bắt buộc: việc **chưa giao** tạm ghi người tạo (quản lý);
  bảng M06 coi người không có role STAFF là "chưa giao" (`OPEN`).
- Trạng thái hỗ trợ: giao diện `WAITING_CUSTOMER` = DB `RESOLVED`, `DONE` = DB `CLOSED`.
- Mở khoá: `CARD` → `ACCESS_CARD`; `PIN`, `FINGER` → `ACCESS_CODE` (mã tham chiếu ghi phương thức, **không lưu bí mật**).
- Báo sai lệch thanh toán không đổi trạng thái đơn (vẫn `PENDING_VERIFICATION`); sau khi quản lý làm rõ, nhân viên xác nhận lại.
- Phân bổ ô: ô phải trống và **đúng loại kho** của đơn; lúc này mới tạo hợp đồng `DRAFT` và ghi khoản cọc + tiền thuê `PAID`
  (bảng `payments` bắt buộc có hợp đồng nên không ghi được lúc nhân viên đối soát).
- Hoàn cọc: khoản còn nợ được trừ vào cọc (đánh dấu `PAID`, ghi chú "Trừ vào tiền cọc"), phần còn lại tạo khoản `REFUND`.
- Thêm trạng thái đơn `PENDING_VERIFICATION` (migration viết tay `20261014150000_ReservationPendingVerification`).
- Sửa lỗi cũ: `HandoverService` ghi `COMPLETED` và `RenewalService` ghi `PENDING_PAYMENT` — cả hai vi phạm CHECK trong DB;
  nay ghi `HANDED_OVER` và `PENDING` (gia hạn chờ quản lý duyệt ở M03).
- Seed D17: 4 loại kho, 12 cơ sở, 12 ô K01–K12 mỗi cơ sở, giá cùng công thức `src/lib/catalog.js`. Loại kho S/M/L/XL và
  cơ sở "Quận 7" đời cũ chỉ chuyển ngừng dùng (không xoá). Muốn dữ liệu sạch: xoá database rồi chạy lại API.

## D19 — Kết nối 100% dữ liệu vận hành & khách hàng trực tiếp từ SQL Server — Đã chốt (16/10/2026)
- Xoá bỏ hoàn toàn mock store RAM `FacilityOpsStateStore.GetOrCreateState` và mock data fallback trong `OpsProvider`.
- Mọi dữ liệu hiển thị trên bảng làm việc của Nhân viên (`GET /api/staff/board`) và Quản lý (`GET /api/manager/board`) đều được truy vấn trực tiếp từ các bảng SQL Server (`Reservations`, `StorageUnits`, `RentalContracts`, `UnitAssignments`, `HandoverRecords`, `ReturnInspections`, `SupportTickets`, `UserFacilities`, `Payments`).
- Mọi thao tác ghi nhận (đối soát, phân bổ kho, bàn giao, kiểm tra trả kho, gia hạn, hoàn cọc) đều được lưu vĩnh viễn vào SQL Server qua `dbContext.SaveChangesAsync()`.
- Các hành động của khách hàng (`REQUEST_RETURN`, `UPDATE_NAME`, `CHANGE_PASSWORD`) được kết nối trực tiếp đến các endpoint backend (`POST /api/contracts/{id}/move-out`, `PUT /api/auth/profile`, `POST /api/auth/change-password`).

## D20 — Toạ độ cơ sở lưu trong database, Vận hành KD sửa ở B05a — Đã chốt (15/10/2026)
- Bảng `facilities` thêm `Latitude`, `Longitude` (decimal(9,6), cùng có hoặc cùng trống). API cơ sở công khai và `/api/operations/facilities` trả / nhận hai trường này.
- Màn B05 thêm nút "Sửa thông tin cơ sở" mở hộp thoại B05a (tên, địa chỉ, điện thoại, giờ ra vào, vĩ độ, kinh độ). Dán cặp toạ độ copy từ Google Maps vào một ô thì tự tách hai ô.
- Bản đồ Tìm kho (C02m) đọc toạ độ từ API; `src/config/geo.js` chỉ còn là toạ độ dự phòng cho cơ sở chưa nhập.
- Toạ độ khởi tạo của 12 cơ sở lấy giống `geo.js` (ước lượng); Vận hành KD nên kiểm tra lại trên Google Maps và sửa ở B05a.

## D21 — Giao diện thanh toán theo Figma 16/10: PayOS + tại cửa hàng, QR mở cửa mô phỏng — Đã chốt (16/10/2026)
- C04 có hai lựa chọn: **Thanh toán QR** (PayOS, tự xác nhận qua webhook PayOS, giao diện hỏi trạng thái 3 giây/lần rồi tự
  sang C05) và **Tại cửa hàng** (C04c → C05c, nhân viên thu ở S09). Bỏ nút "Tôi đã chuyển khoản"; chữ "đối soát" đổi thành
  "thanh toán" / "thu tiền" trên mọi màn (S09 "Thu tiền tại kho").
- Giữ chỗ khi thanh toán QR: **10 phút** (Figma C04; `VITE_PAYMENT_TIMEOUT_SECONDS=600`, trước là 60 giây). Tại cửa hàng: 24 giờ.
- Thanh toán tại cửa hàng dùng lại trạng thái `PENDING_VERIFICATION` (hàng chờ S09 sẵn có). Backend chưa có
  `pay-at-facility` thì giao diện gọi `confirm-transfer` — luồng vẫn chạy với backend hiện tại.
- Endpoint mới chưa có trên backend (404/405 không kèm nội dung) → giao diện hiện thông báo thay thế, không báo lỗi
  (`src/api/payment-access.js` `isUnsupported`). Hợp đồng JSON: `SafeSpace-Customer-UI/BACKEND-TODO.md` mục "Mới 16/10".
- QR mở cửa: **mô phỏng** máy quét ở `#/door` (không cần đăng nhập, như thiết bị tại cơ sở); mã QR chỉ là mã tham chiếu.
- Huỷ đơn đã thanh toán (C14a) lấy số tiền hoàn từ `cancel-preview`; chế độ trình duyệt tạm tính phí 10% tiền thuê như Figma.
- M02a đổi trạng thái ô chỉ cho Trống ↔ Bảo trì và Chờ kiểm tra → Trống / Bảo trì (SRS 8.1); ô đang có khách không đổi ở đây.

## D22 — Cơ chế cấp mã QR mở cửa và máy quét mô phỏng cửa kho (C07q, C07r) — Đã chốt (16/10/2026)
- Cấp mã mở cửa không trạng thái (stateless HMAC-SHA256) từ `ContractId + CredentialId + IssuedAt` với khoá bí mật `JwtSettings:Secret` hoặc `AccessQr:Secret`. Không cần tạo migration hay thêm bảng mới.
- Định dạng mã QR: `SSQR-<contractId>-<8 ký tự hex>` (ví dụ `SSQR-1-1733D3D0`). Mã dự phòng: 8 chữ số (ví dụ `03502103`), hiển thị dạng `xxxx xxxx`.
- `GET /api/contracts/{id}/access-qr` (cần đăng nhập) hỗ trợ cả ID số nguyên lẫn mã chuỗi `HĐ-...`. Kiểm tra điều kiện: kho đã bàn giao (`handover_records.Status == HANDED_OVER`), hợp đồng hiệu lực (`ACTIVE`/`EXPIRING`/`OVERDUE`), thẻ ra vào mới nhất `ACTIVE`.
- `POST /api/access/scan` (công khai cho thiết bị máy quét ở cửa): nhận diện cả mã QR và mã dự phòng 8 số (hỗ trợ có hoặc không có dấu cách), kiểm tra quyền truy cập theo thứ tự và luôn trả về HTTP 200 kèm `result: "OPEN" | "DENIED"` và lý do từ chối.
- Ghi nhận lịch sử quét mã vào bảng `activity_logs` với `Action = "ACCESS_SCANNED"`, `EntityType = "CONTRACT"`, `EntityId = ContractId`, `NewValue = { result, unit, reason }`, `IpAddress` của máy quét.
- Frontend: kết nối `useAccessQr.js` và `endpoints.js` trực tiếp với API backend khi `VITE_USE_API=true`, giữ nguyên mock offline cho môi trường thử nghiệm khi `VITE_USE_API=false`.


## D23 — Thu tiền đặt kho và dự phòng thanh toán tại cơ sở (20/10/2026)
- Bổ sung cho D19/D21; không đổi số hoặc xoá nội dung quyết định cũ. Phạm vi được yêu cầu: kiểm tiền PayOS, ghi khoản thu, chống lặp, phân bổ, thanh toán tại kho và F12.
- Giữ cách tính hiện tại: khách trả tiền thuê cả kỳ + tiền cọc; không triển khai bỏ cọc trong gói này.
- PayOS: backend tính số tiền; SDK kiểm chữ ký; đối chiếu chính xác orderCode và số tiền. Không tìm đơn bằng cách tách số từ mô tả. Không dùng VietQR mặc định khi PayOS lỗi.
- Khoản thu RENT và DEPOSIT ghi vào payments ngay khi xác nhận, gắn ReservationId; ContractId được phép trống trước khi quản lý phân bổ. Gắn lại đúng bản ghi vào hợp đồng DRAFT, không tạo khoản PAID mới.
- Webhook chỉ xác nhận thanh toán; quản lý chọn ô ở M05. Đơn trả tại kho cũng được phân bổ trước, nhưng chưa thu đủ thì không được bàn giao.
- Chọn trả tại kho phải còn hạn và chưa trả tiền. Nếu đã khởi tạo orderCode, cần PayOS xác nhận link đã huỷ/không tồn tại; không chuyển nếu không kiểm tra được hoặc PayOS đã nhận tiền (kể cả một phần).
- Đơn trả tại kho có trạng thái PENDING_AT_FACILITY và PaymentMethod AT_FACILITY. Giữ chỗ đến hết ngày hẹn nhận kho theo giờ Việt Nam; worker xử lý hết hạn mỗi phút, huỷ phân bổ/hợp đồng nháp chưa thu và trả ô RESERVED về AVAILABLE. Thu tiền và worker dùng cùng khoá giao dịch.
- S09 chỉ là đơn chờ thu tại kho; nhân viên bấm xác nhận khi đã thực nhận tiền mặt. Ghi CASH. API gọi lại không tạo khoản thu mới.
- Tiền PayOS về sau khi đổi phương thức/đóng đơn: ghi PAYMENT_REVIEW_REQUIRED đúng một lần cho orderCode, không cộng vào khoản thu thuê lần nữa. Quản lý kiểm tra khoản tiền thực về và hoàn thủ công theo nhật ký; không tuyên bố đã tự chuyển tiền hoàn.
- Khoá transaction ở SQL Server bằng sp_getapplock, cùng khoá reservation cho webhook/thu tiền/phân bổ; thêm unique index trên ReservationId + PaymentType cho RENT/DEPOSIT. API /api/ops chỉ đăng ký một lần.
- Migration nối khoản RENT/DEPOSIT cũ vào đơn khi liên kết là duy nhất; không xoá hay tự bịa khoản tiền cho các đơn cũ chỉ có PaidAt. Các đơn cũ thiếu bằng chứng thu cần đối chiếu trước khi bàn giao.

## D24 — Đổi trạng thái ô bằng tay phải có lý do và lịch sử (20/10/2026)
- AVAILABLE, MAINTENANCE, OUT_OF_SERVICE được chuyển qua lại bằng thao tác quản lý vận hành nếu ô không có giữ chỗ/hợp đồng chưa đóng. Mỗi lần đổi phải có lý do 1–255 ký tự và ghi unit_status_history trong cùng transaction.
- RESERVED/ASSIGNED/OCCUPIED/RETURN_PENDING/INSPECTION thuộc luồng phân bổ, bàn giao, trả kho. Không cho dùng form trạng thái để bỏ qua các bước này.
- LOCKED từ giao diện được ánh xạ thành OUT_OF_SERVICE theo tập trạng thái SQL hiện có. Gọi lại cùng trạng thái với lý do hợp lệ không thêm lịch sử trùng.


## D25 — 2026-10-20: Tổ chức FE theo vai trò và chức năng

Theo yêu cầu nhóm, dùng src/app, src/features/<role>/<feature>, src/shared, src/assets. Tách từng Page từ các file tổng StaffPages/ManagerPages/Units/Auth/Checkout/Public; giữ code dùng chung Staff/Manager ở facility-operations. Giữ URL, API, localStorage và nghiệp vụ. Không đổi hai cấp thư mục gốc FE để không phá lệnh chạy/CI. docs/frontend-naming.md và FRONTEND-MAP.md là hướng dẫn bắt buộc; npm run check:structure kiểm tra quy ước cơ bản.

## D26 — Giao diện Figma 22/10 và tự cấp hợp đồng sau thanh toán
- Người dùng chốt rõ: hệ thống tự chọn ô trống sau PayOS; thay phần phân bổ thủ công thường lệ trong D23. M05 giữ vai trò xử lý ngoại lệ/đơn cũ và giữ chỗ chưa thu tại quầy.
- Sau khi xác minh chữ ký, mã đơn và đủ số tiền, ghi RENT/DEPOSIT rồi tự chọn ô AVAILABLE cùng cơ sở/loại, không bảo trì và không có hợp đồng trùng kỳ. Trong cùng transaction với khoá reservation + inventory. Khi không còn ô phù hợp, vẫn giữ khoản thu thật, ghi AUTO_ALLOCATION_PENDING cho quản lý; không tạo hợp đồng giả. Webhook lặp thử lại việc phân bổ còn thiếu, không thêm khoản thu.
- Hợp đồng được ACTIVE và cấp QR/PIN6 ngay sau thanh toán/phân bổ. DRAFT chỉ còn dùng cho giữ chỗ chưa thu. Quyền mở cửa độc lập việc nhận chìa khóa; máy chủ bắt buộc kiểm [StartDate, EndDate) theo giờ Việt Nam, trạng thái hợp đồng và mã hiện hành.
- Thay PIN8 trong D22 bằng PIN6. QR và PIN dùng hai credential ACCESS_CODE riêng (tiền tố QR-/PIN-), cấp lại từng loại không làm đổi loại còn lại; mã cũ bị thay thế. PIN quét cần ô kho, từ chối khi có kết quả trùng giữa cơ sở; giới hạn 10 lượt/phút/IP cho endpoint mô phỏng. Chưa thay thế tích hợp thiết bị cửa thật.
- Bỏ bàn giao kích hoạt và lựa chọn thẻ/vân tay. Tái sử dụng bảng HandoverRecord cho xác minh/nhận chìa khóa để giữ dữ liệu cũ: HANDED_OVER chỉ có nghĩa chìa khóa đã nhận. API cũ của nhân viên chỉ ghi nhận chìa khóa, không kích hoạt; endpoint khách xác nhận bàn giao bị từ chối. Không sửa migration.
- Header/menu luôn hiện, kích thước/màu/nội dung không đổi theo cuộn. Chuông chỉ ở khách hàng, hiện số chưa đọc; nhân viên/quản lý dùng số hàng chờ ngay trên task. Xử lý xong số giảm, 0 ẩn. Dữ liệu lấy lại sau lưu và mỗi 30 giây/khi quay lại tab.
- Mọi mutation STAFF qua provider đều phải qua modal xác nhận; hủy không gọi API. Chống gửi lặp khi đang xác nhận/lưu; thành công mới điều hướng, thất bại giữ form và báo lỗi.
- Hỗ trợ có 8 nhóm, Khác bắt buộc tiêu đề 1–100 ký tự; QR/PIN/key có yêu cầu cấp lại riêng. Quản lý cơ sở vẫn chỉ có 1 cơ sở phụ trách.
- FE ưu tiên board và mutation `/api/ops` chuẩn (cùng mã xác minh/nhận chìa khóa, phạm vi role và dữ liệu hàng chờ); chỉ fallback board vai trò khi route chuẩn trả 404/405. API trạng thái ô và cấp lại mã tiếp tục dùng `/api/staff`. Không fallback khi lỗi xác thực/phân quyền.

## D27 — Chính sách cọc và hoàn tiền (22/10/2026) — Đã chốt

- Cọc bằng 1 tháng tiền thuê của ô đó; số VNĐ thay đổi theo cỡ kho S/M/L.
- Mốc "đã sử dụng" là StartDate, theo giờ Việt Nam.
- Hủy trước StartDate: giữ phí cố định 10% tiền cọc, không chia theo số ngày báo trước. Khách được hoàn 100% tiền thuê và 90% cọc.
- Dừng sau StartDate: đi theo luồng Trả kho (Move-out), chỉ xét hoàn cọc. Hoàn 70% cọc, giữ 30%.
- Tiền thuê khi dừng giữa kỳ (phương án B, cần sửa BE): tháng đang dùng tính đủ 100%, không hoàn; các tháng nguyên vẹn chưa bắt đầu được hoàn; cộng thêm 70% cọc.
- Trả kho sạch và đúng hạn: hoàn 100% cọc. Vi phạm vệ sinh cơ bản: trừ 10% cọc cố định.
- Hư hỏng vật lý hoặc quá hạn nhiều ngày: trừ thêm DamageFee và OverdueFee vào phần cọc còn lại. Nếu tổng phí vượt cọc: tiền hoàn bằng 0 đ, phần thiếu ghi công nợ khách.
- Quá hạn: lấy đúng tham số OVERDUE lưu ở màn B02 (mặc định 5% giá thuê tháng mỗi ngày, hoặc 150% giá thuê ngày mỗi ngày trễ). Không đặt số cứng trong code.
- Thời hạn hoàn: 3–5 ngày làm việc, chuyển khoản thủ công sau khi trừ phí. Hệ thống ghi trạng thái hoàn khi Quản lý xác nhận ở M07.
- Thay thế: quy định "phí hủy 10% tiền thuê" trong BACKEND-TODO (H1) và CANCEL_FEE_RATE (appReducer.js) không còn áp dụng; phải đổi theo D27. Chưa triển khai code.

## D28 — 2026-10-23: Đồng bộ Figma 23/10 (huỷ/hoàn tiền D27 và hộp thoại kết quả)

- Figma được cập nhật theo D27: luồng đặt chỗ hiện tiền cọc (thuê + cọc 1 tháng = tổng ban đầu); huỷ trước ngày bắt đầu thuê: phí 10% tiền cọc, hoàn 100% tiền thuê và 90% cọc; B02 phí quá hạn 5% giá thuê tháng mỗi ngày trễ. Code giữ số liệu từ backend, chỉ đổi chữ và bố cục theo Figma.
- C14 đặt nút "Xem đơn / Huỷ đơn" trên từng dòng; C14b/C14c hiện "Đã huỷ · Đang hoàn tiền" (`refundStatus` PENDING) và "Đã huỷ · Đã hoàn tiền" (COMPLETED).
- Mọi thao tác ghi của nhân viên và các thao tác phân bổ, phân công, duyệt/từ chối gia hạn của quản lý đi qua: xác nhận → thành công (03a) hoặc thất bại (03b) theo Figma 779:*, 847:*, 885:*. Admin và Vận hành KD dùng chung `shared/components/ChangeFlowDialog.jsx`. Sau thành công, trang quay về danh sách đúng theo nút trên Figma thay vì trang kết quả `staff/done`.
- M08 hoàn tiền đơn huỷ là trang riêng `#/manager/refunds` nằm dưới tab "Hợp đồng & quá hạn" (Figma đặt cùng tab). Chỉ hoàn bằng chuyển khoản vì khách đã trả qua PayOS; bắt buộc nhập mã giao dịch.

## D28 — Kiểm thử giao diện C12/C12b/C13 bằng Playwright

Bổ sung @playwright/test trong devDependencies để kiểm thao tác biểu mẫu và giao diện tiến trình. Bộ kiểm thử giả lập DTO chỉ xác nhận FE; dùng thêm host Kestrel/JWT/SQLite cho HTTP và trình duyệt với backend thật. Giữ D26/D27 và endpoint vận hành chuẩn trên main. Không lưu browser binary hoặc test-results trong git. Các SVG của C12/C13 được tái sử dụng từ gói frontend Ngọc Mai đã cung cấp; phiên này không sửa Figma.

## D29 — Chiến lược CI/CD, Container hoá và Rollback an toàn (24/10/2026) — Đã chốt

- **Chuẩn hoá Pipeline 8 bước (CI01–CI08):** Toàn bộ quy trình từ kiểm tra môi trường cục bộ (`init.sh`, `init.ps1`), CI gate (`.github/workflows/ci.yml`), xuất bản gói phát hành GHCR, tự động hóa deploy Staging, đến kiểm soát Promotion Production (`.github/workflows/deploy-production.yml`) và kịch bản Rollback an toàn (`scripts/deploy/rollback.sh`, `.ps1`).
- **Kiểm thử Đa tầng:**
  - Frontend: 4 suites bắt buộc (`npm test`, `npm run test:render`, `npm run check:structure`, `npm run build`).
  - Backend Unit: 57 unit tests in-memory SQLite (`StorageProject.Tests`), thời gian chạy nhanh 3–5s phục vụ phản hồi tức thời.
  - Backend Integration: 9 integration tests chạy trên SQL Server 2022 thật (`StorageProject.IntegrationTests`), thẩm định toàn bộ 6 migrations EF Core, zero model drift, xác thực đăng nhập 5 roles, RBAC 401/403, idempotency payment và concurrency locking với `sp_getapplock`.
- **Đóng gói & Digest Pinning:**
  - API build Release, chạy trên .NET 10 noble-chiseled với người dùng `app` (non-root), cổng 8080 nội bộ.
  - Web chạy Nginx alpine, phục vụ static SPA bundle, proxy `/api` giữ nguyên prefix, chuyển tiếp headers đầy đủ.
  - Migrator container độc lập dạng self-contained bundle, chỉ chạy one-shot khi nâng cấp schema.
  - Tuyệt đối không dùng tag `latest`. Mọi môi trường đều chạy bằng exact SHA-256 digest (`@sha256:...`) được ghim trong `release-manifest.json` theo đúng schema [deploy/release-manifest.schema.json](file:///d:/StorageProject/deploy/release-manifest.schema.json).
- **Promotion Production có Kiểm Soát (Zero Rebuild):**
  - Promotion qua manual dispatch `deploy-production.yml` với commit SHA 40-hex.
  - Thẩm định nguồn gốc: Chỉ chấp nhận manifest từ bản CI run thành công trên `main` của chính repo với 4 gate checks đều là `success`.
  - Tuyệt đối không build lại mã nguồn khi chuyển từ Staging lên Production; tái sử dụng đúng exact digests.
  - Quản lý bảo vệ bằng GitHub Environment `production` và kiểm soát cổng bật triển khai qua `ENABLE_PRODUCTION_DEPLOY`.
- **Nguyên tắc Rollback & An toàn Dữ liệu:**
  - **Không EF Down:** Tuyệt đối không tự động chạy `dotnet ef database update` về migration cũ để tránh xung đột khóa ngoại và mất mát dữ liệu khách hàng. Schema database luôn được giữ nguyên và sửa chữa bằng migration tiến lên (Forward-fix).
  - **Backup Bắt Buộc:** Mọi kịch bản deploy đều bắt buộc sao lưu database trước khi can thiệp schema; backup fail thì dừng triển khai ngay.
  - **Phục hồi Database có Runbook:** Chỉ phục hồi database từ file backup `.bak` khi có sự phê chuẩn và chỉ định rõ ràng file sao lưu, kèm chấp nhận downtime và mất mát dữ liệu sau thời điểm backup theo đúng runbook [docs/rollback.md](file:///d:/StorageProject/docs/rollback.md).
## PROCESS-2026-10-24 — Quy trình AI, Git và kiểm chứng — Áp dụng khi nhóm tích hợp bản vá

- Theo yêu cầu cập nhật quy định của thành viên ngày 24/10/2026; không khẳng định cả nhóm đã biểu quyết. Việc merge bản vá ghi nhận nhóm chấp nhận áp dụng.
- Thay phần quy trình trong AGENTS/README: AI chỉ phân tích/sửa file/test; thành viên tự commit/push/PR/merge và chịu trách nhiệm đọc hiểu. Không đổi danh tính Git hoặc sửa lịch sử để thay tác giả. Việc dùng AI theo yêu cầu môn học.
- Giữ luồng nhánh riêng → PR → người khác trong nhóm review → main của D08; cho phép tiền tố feature/fix/docs/chore. Một task có một mục tiêu, được sửa các phụ thuộc cần thiết.
- Thay phần tuyệt đối của D01: Figma chuẩn về bố cục/tương tác; nghiệp vụ/quyền theo quyết định nhóm hiện hành. Có mâu thuẫn phải chốt rõ, không tự sửa backend để bỏ kiểm tra quyền hoặc đổi tính tiền theo ảnh.
- Thay D07 và phần cấm nhãn mock của D15: bản chạy chính giữ giao diện sản phẩm; mock/offline phải được chọn rõ và nhận biết khi kiểm thử. API lỗi không được giả thành công. Không thay đổi hành vi sản phẩm trong bản vá tài liệu này.
- Kiểm chứng theo phạm vi, cho phép làm phần độc lập khi môi trường thiếu; ghi rõ phần chưa kiểm chứng. Trước merge code chạy đủ bộ liên quan và kiểm thử tích hợp; chỉ tài liệu không bắt buộc build ứng dụng. AI review không thay review của thành viên khác.
- Không commit bí mật; cấu hình mẫu/dùng chung không chứa bí mật được phép. Không sửa migration đã merge/áp dụng trên DB dùng chung; migration chưa chia sẻ được sửa trong nhánh riêng. Không tự xóa/reset DB.
- Không thay D26/D27, tính tiền, phân quyền, schema, API hoặc trạng thái passing của bất kỳ tính năng sản phẩm nào.


## D30 — 2026-10-25: FE các màn đã duyệt và chính sách người dùng mới chốt

> Đánh số lại từ D29 khi gộp với `main`: D29 đã dùng cho Chiến lược CI/CD (24/10/2026).

- Theo yêu cầu người dùng: hoàn thiện FE kể cả chưa có BE. Thêm demo opt-in `dev:demo`, có nhãn rõ. API thường không fallback thành công. Không sửa backend, migration hoặc số tiền settlement hiện hành.
- Người dùng chốt chính sách mới cho bản cập nhật tiếp theo: mỗi ngày trễ trừ 5% cọc ban đầu, cap100%; ngày20 nhân viên đưa đồ ra ngoài, khách tự chịu trách nhiệm. Nội dung FE này thay hướng mô tả quá hạn theo giá thuê trong D27/D28; BE chưa được chuyển đổi trong task FE này. Ledger luôn là bản xem trước đến khi BE cung cấp quyết toán/phiên bản áp dụng.
- Khách đọc chính sách chi tiết; OPERATIONS sửa và xem trước. Không làm trang thu hồi QR; FE chặn mở cửa ngay sau trả kho thành công/hết hạn. Server/thiết bị phải kiểm tra quyền thực tế. Không tạo trang thông báo riêng; dùng chuông trên header.
- Mỗi khách/đơn một thẻ, tên/chi tiết nằm gần nhau, hành động ở bên phải và căn giữa; form gọn, tránh hai cột thông tin cách quá xa.
- Giữ source trên nhánh local để chủ repo review; không commit/push/PR và không đánh dấu passing trước owner duyệt.


## PROCESS-2026-10-25 — Pre-flight bắt buộc bằng công cụ đọc file

- Theo yêu cầu người dùng: đặt quy tắc pre-flight ở đầu AGENTS.md và CLAUDE.md (đã merge ở PR #43). Mỗi lượt implementation / bug fixing / business logic phải đọc DECISIONS.md, feature_list.json, progress.md và `SafeSpace-Customer-UI/SafeSpace-Customer-UI/BACKEND-TODO.md` nếu chạm API/BE, rồi in receipt có bằng chứng trước giải thích/code. Không lấy trí nhớ thay thao tác đọc.
- Dùng ID thực tế trong feature_list.json (hiện có F01–F41 và CI01–CI08), không giới hạn F01–F38. Tài liệu quy trình không tự tạo feature hoặc đổi passing.
- Giữ D26, các quy định Git và kiểm chứng hiện hành; test mock/SQLite không thay SQL Server và API thật. Không thay nghiệp vụ trong bản bổ sung quy trình này.

## D31 — 2026-10-25: Đăng nhập bằng email hoặc tên đăng nhập

- Theo yêu cầu hoàn thiện đăng nhập bằng email; thay phần "Backend chỉ đăng nhập bằng username" của D03. Giữ cách đăng ký `username = email` và tài khoản seed cũ.
- `POST /api/auth/login` tiếp tục nhận `{ username, password }`; trường `username` nhận tên đăng nhập hoặc email. Bỏ khoảng trắng ngoài định danh, so email không phân biệt chữ hoa/thường; không sửa email đã lưu và không cắt khoảng trắng của mật khẩu.
- Khi một định danh khớp nhiều tài khoản (email trùng username người khác hoặc email chỉ khác hoa/thường), từ chối bằng lỗi đăng nhập chung; không chọn tài khoản đầu tiên và không cấp token. Quản trị viên cần xử lý dữ liệu trùng trước khi dùng định danh đó.
- Giữ kiểm tra BCrypt, trạng thái ACTIVE, vai trò trong JWT và lịch sử đăng nhập thành công. Giữ mã HTTP hiện có: sai định danh/mật khẩu trả 401, tài khoản không ACTIVE trả 400; FE hiện đã xử lý riêng lỗi 401 khi đăng nhập. Không đổi schema/migration hoặc quyền theo cơ sở.
- Bằng chứng và giới hạn kiểm thử ghi trong `progress.md`; chưa xác nhận SQL Server của nhóm và không tự nâng trạng thái tính năng.

## D32 — 2026-10-26: Khấu trừ tối đa bằng cọc, quá hạn theo cọc, sự cố cơ sở, không thu hồi mã — Đã chốt

> Người dùng chốt ngày 26/10/2026 (kế hoạch hoàn thiện 26–31/10). Áp dụng cho **mọi hợp đồng**, kể cả hợp đồng đang chạy.
> Chưa triển khai code; việc BE/FE ghi ở `SafeSpace-Customer-UI/SafeSpace-Customer-UI/BACKEND-TODO.md` mục "D32" (02/11/2026: sửa tham chiếu ghi nhầm "D31", không đổi nội dung quyết định).

**Tiền khi trả kho và quá hạn**
- Tổng khấu trừ khi trả kho (vệ sinh 10% cọc cố định, hư hỏng, quá hạn) tối đa bằng 100% cọc. Vượt cọc thì hoàn 0 đ và dừng ở đó; **không phát sinh công nợ ngoài cọc**, không tạo khoản phải thu khách sau trả kho.
  Thay dòng "Nếu tổng phí vượt cọc: tiền hoàn bằng 0 đ, phần thiếu ghi công nợ khách" của D27 và phần "phần thiếu giữ trạng thái chưa thanh toán (công nợ)" trong mô tả `ConfirmRefundAsync`.
- Phí quá hạn: mỗi ngày lịch trễ (giờ Việt Nam, tính từ 00:00 ngày sau EndDate) trừ **5% cọc ban đầu**, tối đa 100% cọc. Ngày 10–14 nhắc khách; ngày 20 nhân viên lập biên bản, chụp ảnh, đưa đồ ra ngoài, khách tự chịu trách nhiệm. Gửi yêu cầu trả kho thành công thì dừng tính phí.
  Thay dòng quá hạn của D27 ("5% giá thuê tháng hoặc 150% giá thuê ngày") và mô tả B02 trong D28; hoàn thiện ý quá hạn của D30 (D30 chỉ đổi FE). Tỷ lệ 5% và mốc ngày lưu trong chính sách `OVERDUE` (B02), không ghi cứng trong code.
- Giữ nguyên từ D27: cọc = 1 tháng tiền thuê; trả sạch, đúng hạn hoàn 100% cọc; vi phạm vệ sinh cơ bản trừ 10% cọc; dừng sau StartDate hoàn 70% cọc và các tháng nguyên vẹn chưa bắt đầu.

**Huỷ đơn**
- Giữ D27: huỷ trước StartDate giữ phí cố định 10% tiền cọc, hoàn 100% tiền thuê + 90% cọc. Từ StartDate đi theo luồng trả kho. Không áp dụng hướng "bỏ phí huỷ 10%" trong tài liệu tổng hợp DOCX.

**Hoàn tiền**
- Mọi khoản hoàn chuyển vào **tài khoản ngân hàng chính chủ** khách khai báo (ngân hàng, số tài khoản 6–19 chữ số, tên chủ tài khoản trùng tên trên hợp đồng), kể cả khi khách đã trả tiền mặt. Thời hạn 3–5 ngày làm việc.
- Hoàn cọc sau trả kho có hai bước: M07 chốt số tiền → khoản `REFUND` `PENDING` ("Chờ hoàn"); quản lý ghi mã giao dịch ở màn hoàn cọc → `PAID` ("Đã hoàn"). Thay dòng "Hệ thống ghi trạng thái hoàn khi Quản lý xác nhận ở M07" của D27.

**Trả kho**
- Ảnh kho trống bắt buộc khi gửi yêu cầu trả kho. Gửi thành công thì QR/PIN hết hiệu lực ngay, phí quá hạn dừng, khách không huỷ được yêu cầu.
- Ô cần vệ sinh hoặc sửa sau kiểm tra giữ `MAINTENANCE`, không tự về `AVAILABLE` khi hoàn cọc.
- Khách phản hồi hư hỏng: cơ sở đồng ý (tạm giữ khấu trừ, đặt hạn khắc phục) hoặc từ chối có lý do; khắc phục đạt thì bỏ khoản khấu trừ đó.

**Sự cố do cơ sở**
- Khách đồng ý thì chuyển sang ô tương đương, không phụ phí, giữ nguyên kỳ thuê và giá; mã ra vào ô cũ hết hiệu lực khi quản lý xác nhận hoàn tất chuyển, hệ thống cấp mã cho ô mới.
- Khách không đồng ý thì kết thúc hợp đồng: hoàn **100% tiền tháng đang thuê + 100% các tháng chưa dùng + 100% cọc**, không phạt dừng sớm. Thay cách tính "theo số ngày chưa dùng" từng ghi trên Figma bản chờ duyệt.

**Gia hạn**
- Chỉ gửi trước ngày hết hạn. Quản lý duyệt thì chốt giá tại lúc duyệt và tạo khoản `RENEWAL` `PENDING`, **chưa đổi EndDate**. Khách thanh toán trong 24 giờ sau khi duyệt và trước khi hết hạn; thu đủ đúng một lần mới kéo dài hợp đồng. Quá hạn thanh toán thì yêu cầu hết hiệu lực.
  Thay mô tả M03 trong `BACKEND-TODO.md` mục A3 ("cập nhật EndDate hợp đồng") và phần webhook gia hạn tương ứng.

**Phiên bản chính sách**
- Khách đồng ý chính sách trước khi thanh toán (kể cả thu tại quầy: khách tự xác nhận trên tài khoản, nhân viên không tích thay). Lưu phiên bản và thời điểm đồng ý theo đơn/hợp đồng; gia hạn mới phải đồng ý bản hiện hành. Khách xem lại đúng bản đã đồng ý ở mục Chính sách.

**QR/PIN**
- **Không làm thu hồi QR/PIN thủ công** (không màn, không API). Mã tự hết hiệu lực khi hết hạn hợp đồng hoặc gửi trả kho thành công; cấp lại QR hay PIN thì mã cũ cùng loại hết hiệu lực, loại còn lại giữ nguyên (D26). Máy quét giới hạn 10 lượt/phút. Thay phần "thu hồi credential" của F13 và việc "thu hồi mã" trong kế hoạch 7 ngày.

**Phạm vi và quyền**
- Giữ **hỗ trợ khi chưa có hợp đồng** (màn C12-0): khách chọn cơ sở và chủ đề; BE làm API riêng, nhân viên đúng cơ sở trả lời.
- Phân quyền **chỉ theo vai trò** (CUSTOMER, STAFF, MANAGER, OPERATIONS, ADMIN) và cơ sở phụ trách; không kiểm từng PermissionCode trong nghiệp vụ. Màn ma trận quyền của admin chỉ để xem.

**Giao diện**
- Mục "Chính sách" riêng trên menu khách; một mẫu popup chuẩn (560 px, 6 loại: xác nhận, xác nhận nguy hiểm, thành công, thất bại, cảnh báo, thông tin); thông báo dùng chuông, không trang riêng. Màn không ghi mã nội bộ "D30/D31"; phiên bản hiển thị dạng "11/2026".

## PROCESS-2026-10-28-PAYOS — Cấu hình ngân hàng và PayOS dùng chung

- Theo yêu cầu trực tiếp của người dùng ngày 28/10/2026: bỏ hạn chế tránh lộ thông tin ngân hàng/PayOS cho dự án nhóm.
- Thay phần cấm commit khóa PayOS/cấu hình ngân hàng trong AGENTS.md quy tắc 6, checklist bàn giao và phạm vi tương ứng của PROCESS-2026-10-24. Không xóa quyết định lịch sử.
- Cho phép lưu/chia sẻ thông tin ngân hàng nhận tiền và cấu hình PayOS backend do nhóm cung cấp, kể cả khóa thật trong StorageProject.Api/appsettings.json. Agent được đọc, cấu hình, kiểm thử; không tự xóa/che/thay thành placeholder do quy định bảo mật ngân hàng/PayOS cũ.
- Ngoại lệ không mở rộng sang mật khẩu DB, khóa JWT, token khác hoặc khóa PayOS trong frontend/VITE_*. Không thay kiểm tra chữ ký webhook, mã đơn, số tiền hay chống ghi nhận trùng.
- appsettings.json được kiểm tra đang chỉ có YOUR_PAYOS_CLIENT_ID, YOUR_PAYOS_API_KEY, YOUR_PAYOS_CHECKSUM_KEY; không có cờ chặn/che ngân hàng. Không sửa file này khi chưa có giá trị thật từ nhóm, không tự bịa khóa.
- Không thay nghiệp vụ D26/D27/D32, API, schema, quyền hoặc trạng thái tính năng. Không khẳng định thanh toán thật đã hoạt động chỉ từ thay đổi quy định.


## D33 — 28/10/2026: Tên đăng nhập riêng và Giá & phí theo cơ sở

- Đồng bộ yêu cầu người dùng đã chốt khi sửa Figma ngày 28/10 và yêu cầu đối chiếu FE lần này: khách tự chọn tên đăng nhập riêng ở A02; C13 hiển thị tên đăng nhập chỉ đọc. Thay phần đăng ký `username = email` của D03/D31; giữ đăng nhập bằng email hoặc username, mật khẩu và kiểm tra quyền. FE gửi trường `Username` đã có của API, không đổi schema.
- Tên đăng nhập bắt buộc, tối đa 50 ký tự theo cột User.Username, không chứa khoảng trắng hoặc @ để tránh nhầm định danh email; trùng username/email trả đúng lỗi từ backend. Tài khoản cũ giữ nguyên.
- B03 chọn cơ sở trước → B03a bốn loại kho (15/30 m², thường/lạnh), có ảnh và sửa giá cho đúng cơ sở/loại kho/ngày áp dụng. Giá đọc API; không chép số minh họa Figma. Không sửa ngược giá hợp đồng. B02 giữ quản lý chính sách/phí toàn hệ thống theo D32.
- Chỉ sửa FE, ghi nhận hợp đồng T20 backend đã merge trên main c1a9b05. Không xác nhận tích hợp SQL Server/PayOS thật và không đổi trạng thái feature.

## D34 — 29/10/2026: Cách backend triển khai T05/T07/T08/T13 và cờ khả năng — Đã chốt 02/11/2026

> Người dùng (FE) yêu cầu ngày 29/10 làm hộ phần BE: sự cố cơ sở (T13, kế hoạch giao Tiến) và cờ hỗ trợ Batch08 kèm T05/T07/T08 (giao Ngọc Mai). Không đổi quy tắc tiền của D27/D32; chỉ ghi các lựa chọn kỹ thuật cần nhóm biết. Nhánh `feature/be-t05-t07-t08-t13-flags`, chưa build/kiểm SQL Server.

- **Ảnh bằng chứng** (trả kho, kiểm kê, sự cố): gửi JSON base64 theo hợp đồng FE, tối đa 5 ảnh JPG/PNG mỗi lần, ≤ 5 MiB/ảnh, server tự kiểm chữ ký tệp. Lưu trong bảng `evidence_photos` của SQL Server (không để thư mục web công khai). Đọc qua URL có chữ ký HMAC hết hạn 1 giờ (khoá dẫn từ `JwtSettings:Secret`).
- **Tài khoản chính chủ** lưu cột riêng trên `reservations` (huỷ đơn), `return_inspections` (gửi trả kho) và `facility_incidents` (kết thúc do sự cố) — không ghi vào nhật ký vì admin đọc được nhật ký.
- **Huỷ đơn đã thanh toán trước StartDate** áp dụng cả đơn đã được tự cấp hợp đồng sau thanh toán (D26, `UNIT_ASSIGNED`) khi khách chưa nhận chìa khóa: hợp đồng chuyển `CANCELLED`, ô `RESERVED` về `AVAILABLE`, mã QR/PIN do hệ thống vô hiệu (`REVOKED`) — không phải API thu hồi thủ công (giữ D32).
- **Hoàn tiền hai bước**: khoản hoàn cọc sau trả kho và khoản hoàn do sự cố cơ sở dùng chung màn/API hoàn cọc (`/api/ops/deposit-refunds`); phiên bản khoản hoàn = 1 khi chờ hoàn, 2 khi đã hoàn. Mã giao dịch không được trùng giữa các khoản.
- **Cờ khả năng** được bật cố định trên `GET /api/ops/board` và `GET /api/rental-policy` của nhánh này vì server đã lưu đủ dữ liệu tương ứng. `returns[].damageWorkflowResolved = true` vì BE chưa có luồng phản hồi/khắc phục hư hỏng (Batch06) nên không hồ sơ nào có thể đang mở; khi làm Batch06 phải tính lại cờ này.
- **Sự cố cơ sở (T13)**: mã hồ sơ `SC-{mã hợp đồng}-{lần}` cấp từ lúc còn nháp; ô tương đương = cùng cơ sở + cùng loại kho (loại và diện tích), trống, không bảo trì, không trùng hợp đồng khác; ô được giữ (`RESERVED`) từ lúc gửi phương án tới khi khách chọn. Khoản hoàn khi kết thúc = tiền tháng đang thuê + các tháng nguyên chưa bắt đầu (theo giá `AgreedMonthlyRate`) + 100% cọc, chốt tại ngày quản lý xác nhận kết thúc.
- Cần nhóm xác nhận: (1) Tiến / Ngọc Mai review vì chạm phần việc đã giao; (2) giá dùng cho tháng chưa dùng khi hợp đồng đã gia hạn với giá khác; (3) giữ ảnh trong DB hay chuyển sang lưu trữ tệp riêng sau 31/10.

**Chốt ngày 02/11/2026 (đại diện nhóm):**

- Code của nhánh này đã vào `main` qua PR #55. PR #54 trùng nội dung nên đóng, không merge lại.
- (1) Review: Tiến review phần T13 (sự cố cơ sở); Ngọc Mai review T05/T07/T08 và sửa luôn T06 trên `main` (`RefundPolicy` còn trả `Debt` và còn trừ 10% vệ sinh khi khách chỉ quá hạn, trái D32). Hạn 05/11/2026.
- (2) Giá cho tháng chưa dùng khi kết thúc do sự cố: giữ cách hiện tại, tính theo `AgreedMonthlyRate` (giá thuê ban đầu), kể cả khi hợp đồng đã gia hạn với giá khác. Giới hạn đã biết: nếu giá gia hạn khác giá gốc, số hoàn cho tháng thuộc kỳ gia hạn sẽ lệch với số khách đã trả.
- (3) Ảnh bằng chứng tiếp tục lưu trong bảng `evidence_photos` của SQL Server, đọc qua URL ký HMAC hết hạn 1 giờ; không chuyển sang lưu trữ tệp riêng.
- Cờ `returns[].damageWorkflowResolved = true` được giữ tạm. Khi làm T23 (BE phản hồi/khắc phục hư hỏng), bắt buộc thay bằng giá trị tính từ hồ sơ thật và chặn chốt M07 khi còn hồ sơ mở.

## D35–D36 — 02/11/2026: Ảnh hỗ trợ, nhận chìa khóa theo yêu cầu, mã ra vào và hỗ trợ theo kỳ thuê — Đã chốt

> Đại diện nhóm (Thắng) chốt ngày 02/11/2026 cho các lỗi L3, L6, L10, L13, L14 trong ghi chú sửa lỗi FE 02/11. Không đổi quy tắc tiền D27/D32.

- **D35 · Ảnh khách gửi (L3):** nhân viên phải xem được ảnh khách đính kèm (yêu cầu hỗ trợ, trả kho) thì mới xác nhận bàn giao hoặc thu hồi kho. Thay ý "chỉ lưu tên tệp" của D04 cho ảnh hỗ trợ. Ảnh lưu theo cách D34 đã chốt (bảng `evidence_photos`, URL ký HMAC 1 giờ). Cần BE: nhận ảnh khi tạo ticket và trả danh sách ảnh trong `OpsTicketDto`; FE: gửi ảnh thật và hiện ảnh ở màn nhân viên. Chưa triển khai.
- **D36 · Nhận chìa khóa theo yêu cầu (L10):** thay phần "tự tạo lịch bàn giao" của D26. Sau thanh toán vẫn tự cấp hợp đồng và QR/PIN, nhưng BE **không** tự tạo `HandoverRecord`; chỉ tạo khi khách gửi yêu cầu nhận chìa khóa. Huỷ đơn trước StartDate vẫn dùng điều kiện "chưa nhận chìa khóa" (D34). Cần nhóm làm tiếp: API/màn khách yêu cầu chìa khóa, Figma màn này, cách xử lý các lịch `SCHEDULED` cũ. Chưa triển khai.
- **L6 · Quản trị tạo tài khoản:** quản trị chỉ tạo tài khoản nội bộ (nhân viên, quản lý, vận hành, quản trị); khách tự đăng ký. Màn tạo tài khoản không hiện vai trò Khách hàng.
- **L13 · QR/PIN trước ngày thuê:** vẫn cấp mã sau thanh toán (D26) nhưng trước StartDate khách không xem được QR/PIN; giao diện ghi "Mã hiện từ {StartDate}". BE nên từ chối trả mã trước StartDate (mảng QR/PIN).
- **L14 · Hỗ trợ gắn kho:** chỉ gửi yêu cầu hỗ trợ gắn với một kho khi hợp đồng đã bắt đầu và chưa kết thúc (gồm đang chờ trả kho, quá hạn chưa trả). Chưa bắt đầu hoặc đã kết thúc thì dùng hỗ trợ khi chưa có hợp đồng (C12-0). BE `SupportTicketService` cần chặn tương ứng.

## D37 — 04/11/2026: Khôi phục phần Ngọc Mai đã triển khai ngày 30/10

- Giữ toàn bộ nội dung main, D31–D36 và quy định AI/Git hiện có. Bổ sung lại phần lưu trong stash; mục D35 của bản vá ngày 30/10 được ghi ở D37 để không trùng D35–D36 của nhóm. Không dùng lại D33/F42 của ZIP cũ và không tự chuyển tính năng sang passing.
- Theo yêu cầu người dùng, ưu tiên quên mật khẩu qua email thật, tiếp T06/T19 và kiểm T05/T07/T08/T18/C12/C13. Đây là phần triển khai bổ sung cho phạm vi quên mật khẩu trước đây để sau 31/10.
- Quên mật khẩu: OTP 6 số, hạn 10 phút, dùng một lần; tối đa 5 email/tài khoản/giờ, cách 60 giây, 5 lần sai/mã. Lưu HMAC; SMTP/HashKey ở user-secrets hoặc môi trường backend. MailKit 4.18.2 gửi SMTP/TLS. Chỉ tài khoản ACTIVE có email khớp duy nhất; không đổi vai trò/trạng thái, không trả hoặc log OTP. Lỗi SMTP trả 503; rollback giữ mã cũ.
- Mật khẩu mới tối thiểu 8 ký tự, tối đa 72 byte UTF-8, khác mật khẩu cũ; giữ khoảng trắng. Cập nhật BCrypt, dùng mã và đóng login history trong cùng giao dịch; JWT kiểm phiên. Login/reset dùng cùng khóa DB; không tự đăng nhập sau reset.
- T06 theo D32: bỏ Debt; phần phí bù trong cọc là PAID, phần vượt cọc là CANCELLED kèm audit RETURN_FEE_WAIVED; không giả đã thu hoặc để PENDING/FAILED cho phí trả kho sau chốt. Không sửa RENT/RENEWAL/DEPOSIT/REFUND hay tự quét hợp đồng đã đóng. Chỉ quá hạn không tự trừ thêm 10% vệ sinh khi không cần vệ sinh.
- T19 dùng support_inquiries/support_inquiry_replies, giữ ticket gắn hợp đồng. Khách chỉ xem của mình; STAFF/MANAGER theo phân công cơ sở hiện hành. Trạng thái OPEN/WAITING_CUSTOMER/CLOSED; chỉ phía cơ sở đóng khi trả lời. Tiêu đề 1–100, nội dung 1–1000 ký tự. Ghi cần clientRequestId UUID; phản hồi cần expectedVersion. Cùng UUID/nội dung là replay, khác nội dung hoặc phiên bản cũ trả 409.
- Route kiểm kê staff cũ dùng service ops chuẩn; không hoàn tất khi thiếu phí/lý do/ảnh theo điều kiện. SQLite, SMTP loopback và browser không thay nghiệm thu SQL Server của nhóm và hộp thư thật. Giữ errorStatus và cách xử lý 403 mới của main khi ghép hook hỗ trợ.

## D38 — 04/11/2026: Điều kiện cho thuê lại sau kiểm tra trả kho — Đã chốt

> Đại diện nhóm (Thắng) chốt ngày 04/11/2026 khi đổi biên bản kiểm tra S06 (Figma D30-08) sang dạng chọn.

- Biên bản có 3 mục: Đồ còn lại, Tường/sàn/cửa, Chìa khóa vật lý; mỗi mục chọn từ danh sách (không gõ tay), không điền sẵn kết luận. Giao diện ghi "Đạt tiêu chuẩn" / "Chưa đạt tiêu chuẩn", không dùng chữ "sạch" / "bẩn".
- Chỉ được chọn trạng thái ô "Sẵn sàng cho thuê lại" khi **đạt tiêu chuẩn ít nhất 2/3 mục** và **không có khấu trừ** vệ sinh/hư hỏng. Giữ D32: ô cần vệ sinh hoặc sửa giữ bảo trì.
- FE chặn ở màn S06. BE hiện chỉ chặn khi có khấu trừ (`SubmitReturnInspectionAsync`); chưa biết số mục đạt tiêu chuẩn vì 3 mục là chuỗi tự do — cần BE nhận mã lựa chọn hoặc tự kiểm (ghi ở file lỗi L22).

## D39 — 04/11/2026: Khách xác nhận khấu trừ trước khi hoàn tất hoàn cọc — Đã chốt, BE viết ở Phiên 3 (05/11), chưa build/kiểm thử; FE chưa làm

> Đại diện nhóm (Thắng) chốt ngày 04/11/2026. Mở rộng luồng phản hồi hư hỏng (Batch06, Figma D30-13) cho mọi khoản khấu trừ khi trả kho.

- Sau kiểm tra, nhân viên gửi các khoản trừ vào cọc cho **khách xác nhận** (Figma D30-08 nút "Gửi khấu trừ cho khách xác nhận"). Quản lý chỉ chốt hoàn cọc (M07) sau khi khách xác nhận hoặc phương án thay thế đã được cơ sở xử lý.
- Phí vệ sinh hiển thị là **khấu trừ theo chính sách** (cố định 10% cọc, D27/D32), không phải "khấu trừ đề xuất". Hư hỏng ghi "theo biên bản" kèm ảnh.
- Khách chọn: Đồng ý khấu trừ · hoàn tất hoàn cọc; Tự dọn dẹp kho thay cho phí vệ sinh (khi kho chưa đạt tiêu chuẩn vệ sinh); Tự thay thế vật dụng tương đương thay cho phí hư hỏng (khi hỏng cơ sở vật chất); Khiếu nại nội dung biên bản. Cơ sở kiểm tra lại phương án, đạt thì không trừ khoản tương ứng.
- Thay ý "M07 chốt ngay sau biên bản" của D32 phần hoàn cọc hai bước: bước khách xác nhận nằm trước M07. Cần BE (endpoint khách xác nhận/đề nghị cho mọi biên bản, chặn `ConfirmRefundAsync` khi khách chưa xác nhận); FE màn D30-13 làm sau khi có API (ghi ở file lỗi L23).

## D40 — 04/11/2026: Phí huỷ 5% cọc, hỗ trợ theo kỳ thuê, một thao tác mỗi ô, nhận chìa khóa — Đã chốt

> Đại diện nhóm (Thắng) chốt ngày 04/11/2026 lúc 23:03 khi rà file lỗi 04/11. Bổ sung D38–D39.

- **Huỷ trước ngày bắt đầu:** phí huỷ **5% tiền cọc** (thay mức 10% ở D27/D32). Từ 0h ngày bắt đầu thuê, tiền thuê tháng đó tính đủ. Chi tiết đơn hiện nút huỷ ghi rõ phí huỷ và số tiền hoàn; trang Chính sách ghi cùng quy tắc.
- **Hỗ trợ gắn ô kho:** hợp đồng đã thanh toán nhưng chưa tới ngày bắt đầu **được** gửi hỗ trợ; hợp đồng đã kết thúc thì không (thay phần L14 đã merge ở PR #63 chặn trước ngày bắt đầu).
- **Một thao tác mỗi ô (L5):** một ô chỉ có một yêu cầu đang xử lý. Đã gửi trả kho thì nút gia hạn mờ kèm lý do và ngược lại. Ô khác nhau chạy độc lập.
- **D39 bổ sung:** không có khấu trừ thì không cần khách xác nhận; cơ sở không được từ chối phương án khách tự dọn dẹp. Thắng chốt lại 05/11/2026 01:17 (thay mức 3 ngày chốt lúc 23:03): khách có **48 giờ** kể từ khi nhận biên bản để xác nhận, quá hạn hệ thống **tự hoàn cọc theo biên bản của nhân viên**. Khi khách gửi trả kho thành công, hệ thống báo: trong **3 ngày** nhân viên gửi biên bản và tiền hoàn dự kiến, nhắc khách theo dõi chuông/email để xác nhận trong 48 giờ.
- **D36 bổ sung:** yêu cầu nhận chìa khóa gửi qua nút hỗ trợ (chủ đề "Nhận chìa khóa"); huỷ các lịch bàn giao `SCHEDULED` tự tạo trước đây; không cần F04 (nhận kho tự động) — thành viên phụ trách xác nhận khi đổi `feature_list.json`; danh sách việc nhân viên xếp cũ trước (FIFO).
- Quên mật khẩu được báo "email chưa đăng ký" (L24, thay phản hồi chung của D37 — cần BE đổi). Giữ một mã vai trò Vận hành KD (gộp OPERATIONS/BUSINESS_OPERATOR, migration dữ liệu, không reset DB). Hotline footer là số minh hoạ.

## D41 — 04/11/2026: Đặt trước theo ngày và xử lý xung đột do khách cũ quá hạn — Đã chốt, chưa triển khai

> Thắng đặt bài toán và chốt ngày 04/11/2026 (23:39, 23:44). Thay ý "ô không trống thì khoá nút đặt" của D13 và cách tự gán chỉ ô `AVAILABLE` của D26.

- **Trống theo ngày:** ô đang thuê được coi là trống từ ngày hết hạn hợp đồng hiện tại cộng **3 ngày đệm** (giá trị trong chính sách, Vận hành KD sửa được). Đặt kho và tự gán ô (D26) ưu tiên ô đang trống thật; chỉ dùng ô sắp hết hạn khi hết ô trống. Sơ đồ ô hiện "Trống từ dd/mm". Không cho đặt trước ô đang quá hạn.
- **Mốc kiểm tra:** 5 ngày trước ngày nhận kho (giờ Việt Nam), nếu ô **chưa về Trống** (chưa trả hoặc đã trả nhưng chưa kiểm tra đạt D38) thì hệ thống tạo đề xuất đổi kho, gửi thông báo + email cho khách mới. Đơn tạo khi còn dưới 5 ngày thì kiểm ngay.
- **Phương án:** (1) đổi ngang sang ô cùng loại đang trống; (2) nâng cấp miễn phí sang loại lớn hơn — giữ giá và cọc cũ đến hết kỳ thuê, khi gia hạn khách chọn giá ô lớn hoặc chuyển về loại cũ nếu còn ô; (3) không còn ô phù hợp: dời ngày nhận kho hoặc huỷ **hoàn 100%**, không áp phí huỷ D40.
- Ô đề xuất được giữ (`RESERVED`) đến khi khách trả lời hoặc hết hạn **48 giờ**; quá hạn hệ thống tự đổi ngang, không có thì nâng cấp. Khách đã chọn thì giữ, không đổi lại ô cũ dù khách cũ trả kho sau đó.
- Đổi ô: cập nhật phân bổ + hợp đồng, cấp lại QR/PIN cho ô mới, ghi activity log; mã ô cũ không có hiệu lực với khách mới. Quản lý cơ sở xem danh sách xung đột.
- **Gia hạn của khách cũ:** ô đã có người đặt trước thì khoá gia hạn ô đó, hiện "Ô đã có khách đặt từ dd/mm"; khách cũ có thể chuyển sang ô khác nếu còn trống. Giữ D32 (quá hạn 5%/ngày, mốc ngày 20).

## D42 — 05/11/2026: Hoàn tiền mặt tại quầy, bỏ báo cáo sai lệch, việc tồn cuối ngày — Đã chốt, BE viết ở Phiên 3 (05/11), chưa build/kiểm thử; FE chưa làm

> Thắng chốt ngày 05/11/2026 (00:48–01:25).

- **Cách nhận hoàn do khách chọn:** mọi khách (không phụ thuộc cách đã thanh toán) chọn *Chuyển khoản ngân hàng* hoặc *Tiền mặt tại quầy* khi gửi huỷ đơn hoặc trả kho (D30-07, D30-03). Quản lý chỉ xem và làm theo lựa chọn đó, không đổi được. Thay ý "M08 chỉ hoàn bằng chuyển khoản, bắt buộc mã giao dịch" ở mục M08 phía trên.
- **Chuyển khoản:** quản lý cơ sở chốt số tiền, tự chuyển và nhập mã giao dịch (giữ cách cũ).
- **Tiền mặt:** quản lý chốt số tiền và duyệt → hệ thống giao việc "Chi tiền hoàn" cho nhân viên cơ sở (S01, S10). Nhân viên tick đủ 4 mục (CCCD trùng tên hợp đồng; khách đọc đúng mã đơn và số điện thoại; đếm đủ tiền trước mặt khách; khách đã nhận và ký sổ chi tại quầy) rồi xác nhận; **không** lưu ảnh hay số phiếu chi. Hệ thống ghi nhân viên chi và thời điểm. Khách nhận trong 30 ngày, mang CCCD; không khớp thì không chi ("Để sau"). Quá 30 ngày cơ sở liên hệ để chuyển khoản. Ở mốc **ngày 10, 20 và 25** (tính từ lúc quản lý duyệt) hệ thống tự tạo việc "Gọi nhắc khách nhận tiền hoàn" cho nhân viên (S10b): nhân viên gọi số điện thoại đăng ký và ghi kết quả (khách hẹn đến · không nghe máy · muốn đổi sang chuyển khoản · sai số).
- **Bỏ báo cáo sai lệch thanh toán:** xoá luồng nhân viên báo sai lệch và quản lý đối soát sai lệch (Figma đã xoá 13 màn, S09 bỏ nút). Thay dòng "Báo sai lệch thanh toán không đổi trạng thái đơn…" và mục "báo sai lệch" trong danh sách lưu `activity_logs` ở các mục phía trên. Code FE/BE hiện có (`features/manager/discrepancies`, `staff/payments/PaymentDiscrepancyPage.jsx`, endpoint trong `FacilityOpsEndpoints.cs`/`StaffEndpoints.cs`) gỡ ở phiên BE/FE; không xoá dữ liệu đã có trong DB.
- **Việc nhân viên quá hạn:** nhân viên phải gửi biên bản trả kho trong 3 ngày (D40). Danh sách "Công việc ngày" xếp theo thời gian tạo việc (FIFO), **không ưu tiên loại việc**; việc quá 3 ngày chỉ gắn nhãn, không nhảy hàng. Lúc 22:00 (giờ đóng cửa) hệ thống gửi chuông cho quản lý cơ sở danh sách việc chưa xong trong ngày của từng nhân viên kèm lịch sử việc đã làm (từ `activity_logs`); việc chưa xong giữ nguyên thứ tự sang ngày sau. Quản lý có thể giao lại cho nhân viên khác. Báo cáo 22:00 gồm **tên nhân viên và số việc chưa xử lý**; bấm vào nhân viên để xem chi tiết việc chưa xong và lịch sử việc đã làm trong ngày (M04-cuối ngày, M04-cuối ngày-chi tiết).
- **L11 (lỗi, Thắng xác nhận 05/11):** cọc tính theo % của **1 tháng thuê**, không phải % tổng tiền thuê cả kỳ (`OpsRules.CalculateDeposit`). Ví dụ 3 tháng × 1.150.000 đ: tổng ban đầu 4.600.000 đ.

## D43 — 05/11/2026: Hỗ trợ là cuộc trò chuyện, không có thao tác đóng; ngày hẹn nhận tiền hoàn — Đã chốt, BE viết ở Phiên 3 (05/11), chưa build/kiểm thử; FE chưa làm

> Thắng chốt ngày 05/11/2026 02:27.

- Yêu cầu hỗ trợ (cả hỏi đáp chưa có hợp đồng và ticket gắn kho) hoạt động như một phiên chat: **không ai cần bấm đóng**; không trao đổi nữa thì thôi. Bỏ nút "Đóng yêu cầu" và bước "Đóng yêu cầu" ở màn khách (HT0091, C12b). Thay ý "chỉ phía cơ sở đóng khi trả lời" và trạng thái `CLOSED` của D37: trạng thái chỉ còn dùng để biết lượt (*Chờ cơ sở trả lời* / *Chờ khách*); dữ liệu `CLOSED` cũ giữ nguyên, hiển thị như *Đã trả lời*. Ticket gắn kho vẫn giữ các bước xử lý của nhân viên (tiếp nhận, đã xử lý).
- S10b: khi khách hẹn ngày đến quầy, nhân viên nhập **ngày hẹn**; hệ thống tạo việc "Chi tiền hoàn" đúng ngày đó và tạm dừng gọi nhắc. Khách không đến thì nhắc lại ở mốc kế tiếp (10/20/25 ngày, D42).

## IMPL-2026-11-05-P3 — Cách triển khai BE Phiên 3 cho D36, D39–D43 — Chờ nhóm xác nhận

> Claude đề xuất khi viết BE Phiên 3; chưa phải quyết định nghiệp vụ mới. Nhóm xác nhận hoặc sửa trước khi merge. Không thay mục nào ở trên.

- Trạng thái D39, duyệt/gọi nhắc/chi tiền mặt D42 và báo cáo 22:00 lưu trong `activity_logs` (không thêm cột/bảng). Migration duy nhất là mở rộng CHECK `evidence_photos.OwnerType`.
- Quá 48 giờ (D40): tiến trình nền tự chốt hoàn cọc như M07, ghi dưới tên quản lý đang phụ trách cơ sở; cơ sở chưa có quản lý thì chờ quản lý chốt tay.
- Tiền mặt (D42): lưu `RefundBankName = "CASH"`, số tài khoản để trống, người nhận là khách trên hợp đồng; quản lý duyệt lại được để giao nhân viên khác, hạn 30 ngày tính từ lần duyệt đầu. Quá 30 ngày: trạng thái `EXPIRED`, không chi tiền mặt nữa; việc chuyển sang chuyển khoản chưa có API (cần nhóm chốt cách khách khai tài khoản).
- Lựa chọn tiền mặt không áp dụng cho hoàn tiền do sự cố cơ sở (T13) vì D42 chỉ nêu huỷ đơn và trả kho.
- Yêu cầu nhận chìa khóa (D36) lưu ticket loại `ACCESS_CARD` với tiêu đề cố định để không phải đổi CHECK của `support_tickets`.

## D44 — 05/11/2026: Tiền mặt quá 30 ngày, đổi sang chuyển khoản, tiền mặt cho sự cố cơ sở, hệ thống tự chốt 48 giờ — Đã chốt

> Thắng chốt ngày 05/11/2026 19:21–19:25 khi xem mục IMPL-2026-11-05-P3. Thay các ý tương ứng của D42 và IMPL-2026-11-05-P3; giữ nguyên lịch sử ở trên.

- **Quá 30 ngày chưa nhận tiền mặt:** khách **mất khoản hoàn** (không chi, không chuyển khoản). Thay câu "Quá 30 ngày cơ sở liên hệ để chuyển khoản" của D42 và trạng thái `EXPIRED` của IMPL-P3. Khách phải tick xác nhận điều này khi chọn tiền mặt; chính sách ghi rõ.
- **Trong 30 ngày** khách được đổi lại sang chuyển khoản (tài khoản chính chủ, tên trùng hợp đồng); khoản chuyển về luồng chuyển khoản, quản lý ghi mã giao dịch; việc chi tiền mặt và gọi nhắc dừng.
- **Hoàn tiền do sự cố cơ sở (T13)** cũng có lựa chọn tiền mặt như huỷ đơn / trả kho (thay ý cuối của IMPL-P3).
- **Tự chốt hoàn cọc sau 48 giờ (D40):** ghi là **Hệ thống** (không gắn tên quản lý), luôn tự chốt kể cả cơ sở chưa có quản lý (thay ý thứ hai của IMPL-P3).
- Thắng nêu: mọi cơ sở luôn có nhân viên và quản lý. Thêm dữ liệu tài khoản cho 11 cơ sở còn thiếu trong seed — Thắng làm sau, chưa thuộc phiên này.

## IMPL-2026-11-05-P4 — Cách triển khai Phiên 4–5 cho D41, D44 — Chờ nhóm xác nhận

> Claude đề xuất khi viết code Phiên 4–5; chưa phải quyết định nghiệp vụ. Nhóm xác nhận hoặc sửa trước khi merge.

- Ngày đệm cho thuê lại (D41) là chính sách mới `RELET_BUFFER` (FIXED, đơn vị ngày, 0–60; không có chính sách thì 3 ngày). Cần 1 migration đổi CHECK `policies.PolicyType`. Màn chính sách của Vận hành KD (B02) chưa có ô nhập — làm ở phiên FE vận hành.
- Khách bấm **"Đồng ý khấu trừ · hoàn tất hoàn cọc"** thì hệ thống tự chốt hoàn cọc luôn (không chờ quản lý bấm M07), theo đúng chữ trên nút D39.
- Hệ thống chốt / đổi ô tự động thì nhật ký ghi Hệ thống (UserId = null); riêng cột bắt buộc người thao tác (lịch sử trạng thái ô, người cấp mã) dùng mã khách của hợp đồng như cách `ContractProvisioning` đang làm — không đổi schema.
- Đề xuất đổi kho (D41): ưu tiên ô cùng loại đang trống thật, sau đó ô lớn hơn (cùng kho lạnh/thường trước, nhỏ nhất trước). Giữ ô đề xuất bằng trạng thái `RESERVED` không có hợp đồng; quá 48 giờ hệ thống tự nhận ô đề xuất. Không có ô phù hợp thì không tự làm gì, chờ khách dời ngày / huỷ hoặc quản lý xử lý.
- Dời ngày (D41): giữ độ dài kỳ thuê, trong 90 ngày, giữ ô cũ nếu ô cũ trống kịp; giá và cọc giữ nguyên. Huỷ do xung đột: hoàn 100% tiền thuê + cọc đã trả, cách nhận hoàn theo D42/D44.
- **Chưa làm:** gửi email/chuông riêng cho đề xuất đổi kho (chưa có bảng thông báo; khách xem ở chi tiết kho và `#/units/:id/unit-change`); giá khi gia hạn sau nâng cấp (khách chọn giá ô lớn hoặc chuyển về loại cũ) — cần nhóm chốt cách tính trong `RenewalService`.
- Quá hạn tiền mặt: tiến trình nền đổi khoản REFUND sang `CANCELLED` (tham chiếu `FORFEITED:{id}`) để không còn hiện "chờ hoàn"; giữ dòng tiền, không xoá.
