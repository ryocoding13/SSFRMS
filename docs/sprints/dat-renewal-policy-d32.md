# Sprint Contract: T02, T03, T04, T20 — Gia hạn hợp đồng & Quản lý phiên bản chính sách theo D32

> Kế hoạch chi tiết theo `SSFRMS-Dat-Agent-Implementation-Plan.md`.
> Phụ trách: Đạt (Backend). Phối hợp Frontend: Thắng.

## 1. Mục tiêu
1. Khách hàng gửi yêu cầu gia hạn kèm đồng ý chính sách hiện hành.
2. Quản lý cơ sở duyệt gia hạn: chốt giá tại thời điểm duyệt, tạo khoản thu `RENEWAL PENDING`, lưu hạn thanh toán (24 giờ, không vượt quá hạn hợp đồng); **tuyệt đối không tăng `EndDate` khi duyệt**.
3. Khách thanh toán PayOS hoặc trả tại quầy qua nhân viên: ghi nhận khoản thu `PAID`, renewal `PAID`, gán `EndDate = NewEndDate` đúng một lần. Idempotent và chống race condition.
4. Quá hạn thanh toán: renewal chuyển sang `EXPIRED`, payment chuyển `FAILED` kèm audit; không kéo dài hợp đồng.
5. Quản lý phiên bản chính sách: `GET /api/rental-policy` công khai, `POST /api/rental-policy/actions` chỉ dành cho OPERATIONS tạo bản mới bất biến; ghi nhận bằng chứng đồng ý (consent) của khách hàng với version, thời điểm server và kênh xác nhận.

## 2. Nguồn yêu cầu & Quyết định
- Quyết định: D32 (26/10/2026), D05, D10, D15, D16, D19, D26, D27, D29.
- Tài liệu: `SafeSpace-Customer-UI/SafeSpace-Customer-UI/BACKEND-TODO.md` mục D32; `APPROVED-FE-API-GAPS.md`.
- Kế hoạch: `SSFRMS-Dat-Agent-Implementation-Plan.md`.

## 3. Phạm vi (Backend)
- Entity & Schema: `PaymentCheckout`, `RentalPolicyVersion`, `PolicyConsent`, cập nhật `ContractRenewal` (`PaymentDeadlineAt`, `AppliedAt`, `ExpiredAt`, status check `EXPIRED`), unique filtered index chống trùng renewal/payment.
- Services: `RenewalService`, `RenewalSettlement`, `RentalPolicyService`, `PayOSService`, `FacilityOpsService.Actions`, `FacilityOpsService.Board`, `ManagerService`.
- Worker: `ExpiredRenewalWorker` (job quét hết hạn gia hạn).
- Endpoints: `POST /api/payments/{id}/payos`, `POST /api/renewals/{id}/counter-payment`, `GET /api/ops/counter-renewals`, `POST /api/ops/counter-renewals/actions`, `GET /api/rental-policy`, `GET /api/rental-policy/versions/{version}`, `POST /api/rental-policy/actions`, `POST /api/reservations/{id}/policy-consent`.
- Migration mới: `AddRenewalSettlementAndPolicyConsent`.
- Unit/HTTP test & Integration test.

## 4. Ngoài phạm vi
- Không tự thay đổi nghiệp vụ cọc, phí trả kho, huỷ đơn đã chốt trong D27/D32.
- Không thu phí phát sinh sau trả kho hay công nợ ngoài cọc.
- Không làm thu hồi QR/PIN thủ công.
- Không tự ý commit, push, tạo PR, merge hay reset database.

## 5. Tiêu chí hoàn thành (DoD)
- [ ] Duyệt gia hạn trên cả `/api/ops/renewals/{id}/approve` và `/api/manager/renewals/{id}/approve` đều tạo khoản thu `RENEWAL PENDING` và không thay đổi `EndDate`.
- [ ] Settlement atomic & idempotent: PayOS webhook hoặc Collect Counter chỉ cập nhật `EndDate = NewEndDate` đúng 1 lần.
- [ ] Quá hạn thanh toán chuyển renewal sang `EXPIRED`.
- [ ] GET `/api/rental-policy` trả bản mới nhất; `POST /api/rental-policy/actions` tạo bản mới cho role OPERATIONS.
- [ ] Migration mới đồng bộ model snapshot (`dotnet ef migrations has-pending-model-changes` pass 0 changes).
- [ ] Solution build 0 lỗi, xUnit test pass.
