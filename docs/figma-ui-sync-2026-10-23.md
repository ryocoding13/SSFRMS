# Đồng bộ Figma 23/10/2026 (F40)

Figma: https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN/SafeSpace---Modern-UI

## Sửa trên Figma

- Luồng đặt chỗ hiện tiền cọc: C03b (12 cơ sở và component sơ đồ), C04, C04c, C05c, S09 (4.600.000 đ = thuê 3.450.000 + cọc 1.150.000).
- Huỷ/hoàn tiền theo D27: C14, C14a, C14b, C14c, M07b–f, M08, M08a, M08a2, kết quả M08; B02 ô huỷ đặt chỗ và phí quá hạn.
- Lỗi hiển thị: C04b dòng "Lý do" tràn; chữ ngắn bị xuống dòng (C05-chờ ô, S05r, C14a); nút lệch ở C05-chờ ô; thống nhất "huỷ" như code.

## Màn đã nối vào code

| Figma | Route | File |
|---|---|---|
| C14, C14a, C14b, C14c | `#/reservations` | `features/customer/reservations/ReservationListPage.jsx` |
| M08, M08a, M08a2, M08-kết thúc, M07e | `#/manager/refunds` | `features/manager/refunds/CancellationRefundPage.jsx` |
| M07 (nút "Hoàn tiền đơn huỷ"), M07a | `#/manager/contracts` | `features/manager/contracts/ContractListPage.jsx` |
| S02–S05, S09 · 02 / 03a / 03b | `#/staff/*` | `facility-operations/utils/opsConfirmation.js`, `state/FacilityOperationsProvider.jsx` |
| S05c–e (xác nhận/kết quả cấp lại QR, PIN, chìa khóa) | `#/staff/support` | như trên |
| M03a–d | `#/manager/renewals` | `features/manager/renewals/RenewalApprovalPage.jsx` + provider |
| Phân bổ ô kho, Lưu phân công · Xác nhận/Thành công/Thất bại | `#/manager/allocate`, `#/manager/assign` | provider |
| Lưu chính sách cho thuê, Lưu giá và phí | `#/business/policies`, `#/business/pricing` | `shared/components/ChangeFlowDialog.jsx` |
| Admin: tạo tài khoản, cấu hình quyền, thông tin, đặt lại mật khẩu, gán/thu hồi vai trò, phân công cơ sở | `#/admin/*` | `features/admin/**` + `ChangeFlowDialog.jsx` |
| M05 · Còn N yêu cầu, Đã xử lý hết, M05-không ô | `#/manager/allocate` | `features/manager/allocations/UnitAllocationPage.jsx` |
| M02b Thêm ô kho, M02c Sửa ô kho, kết quả M02 | `#/manager/units` | `features/manager/units/UnitManagementPage.jsx` |
| B05b Thêm cơ sở, B05c Đổi trạng thái cơ sở, kết quả B05 | `#/business/facilities` | `features/business/facilities/FacilityManagementPage.jsx` |
| C05-chờ ô (đã nhận tiền, đang cấp hợp đồng) | `#/confirmation/:id` | `features/customer/reservations/ReservationDetailPage.jsx` |
| C11f, C11fb, C11fq, C11fc, C11fcp, C11-kiểm tra (phí phát sinh trả kho qua PayOS / tại quầy) | `#/payments` | `features/customer/payments/PaymentListPage.jsx`, `shared/components/PayosModal.jsx` |
| S04 (phí hư hỏng / vệ sinh / quá hạn + lý do), M07a hiện phí theo biên bản | `#/staff/return`, `#/manager/contracts` | `features/staff/returns/ReturnInspectionPage.jsx`, `ContractListPage.jsx` |
| S09a (thẻ thu phí), S09f / S09b, S09fc / S09c, S09fd / S09d, S09e | `#/staff/reconcile`, `#/staff/fees?id=` | `features/staff/payments/FeeCollectionPage.jsx`, `StaffTasks.jsx`, provider |

## Kiểm tra nhanh trên trình duyệt

1. Khách `customer01`: `#/reservations` → "Huỷ đơn" trên dòng đơn đã thanh toán → hộp thoại ghi "Phí huỷ (10% tiền cọc)" → huỷ → dòng chuyển "Đã huỷ · Đang hoàn tiền".
2. Quản lý `manager01`: `#/manager/refunds` → "Xác nhận đã hoàn" → bỏ trống mã giao dịch báo lỗi → nhập mã → đơn chuyển "Đã hoàn" (cần backend trả `refunds`, xem BACKEND-TODO.md mục M08).
3. Nhân viên `staff01`: thu tiền / xác minh / nhận chìa khóa / trả kho / phản hồi hỗ trợ → mỗi thao tác có hộp thoại xác nhận rồi hộp thoại "Đã …" với nút về danh sách.
4. Quản lý: phân bổ, phân công, duyệt/từ chối gia hạn, xác nhận trả kho (M07a).
5. Admin / Vận hành KD: lưu thay đổi → hộp thoại "<Thao tác>?" → "Đã …" hoặc "Không … được".

## Chưa nối (cần nhóm quyết)

- C11c / C11d / C11e / C11f (trang "Phí phát sinh & công nợ" riêng cho một hợp đồng): cùng luồng với C11f trong bảng Thanh toán đã nối; chưa tách trang riêng.
- A01b / A01c đặt lại mật khẩu bằng mã 6 số: backend chưa có API gửi mã qua email, giao diện giữ hộp thoại "Quên mật khẩu?" hiện tại.
- C12 danh sách chủ đề, C12-ảnh, C12-lỗi, C12b: thuộc nhánh `feature/ngoc-mai-auth-support` (chưa merge), không sửa ở đây để tránh xung đột.

- C02-vị trí / C02-không vị trí: Figma có màn dùng vị trí trình duyệt, nhưng quy tắc nhóm là gợi ý cơ sở theo khu vực khách chọn (không theo vị trí). Chưa làm, chờ nhóm chốt có giữ hai màn này không.
