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

## Kiểm tra nhanh trên trình duyệt

1. Khách `customer01`: `#/reservations` → "Huỷ đơn" trên dòng đơn đã thanh toán → hộp thoại ghi "Phí huỷ (10% tiền cọc)" → huỷ → dòng chuyển "Đã huỷ · Đang hoàn tiền".
2. Quản lý `manager01`: `#/manager/refunds` → "Xác nhận đã hoàn" → bỏ trống mã giao dịch báo lỗi → nhập mã → đơn chuyển "Đã hoàn" (cần backend trả `refunds`, xem BACKEND-TODO.md mục M08).
3. Nhân viên `staff01`: thu tiền / xác minh / nhận chìa khóa / trả kho / phản hồi hỗ trợ → mỗi thao tác có hộp thoại xác nhận rồi hộp thoại "Đã …" với nút về danh sách.
4. Quản lý: phân bổ, phân công, duyệt/từ chối gia hạn, xác nhận trả kho (M07a).
5. Admin / Vận hành KD: lưu thay đổi → hộp thoại "<Thao tác>?" → "Đã …" hoặc "Không … được".
