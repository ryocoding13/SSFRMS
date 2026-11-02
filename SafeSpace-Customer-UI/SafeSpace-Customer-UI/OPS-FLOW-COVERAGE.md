# Đối chiếu Figma ↔ code: Nhân viên cơ sở & Quản lý cơ sở

Nguồn: file Figma "SafeSpace - Modern UI", section *SafeSpace · Nhân viên cơ sở* và *SafeSpace · Quản lý cơ sở*.
Dữ liệu: `src/features/facility-operations/data/facilityOperationsSeed.js` (khởi tạo) · nghiệp vụ: `src/features/facility-operations/state/facilityOperationsReducer.js` (có test) · lưu: `src/features/facility-operations/state/FacilityOperationsProvider.jsx`.

## Nhân viên cơ sở (`#/staff`)

| Figma | Route | Làm được gì |
|---|---|---|
| S01 Công việc trong ngày | `#/staff` | 3 số liệu (có "Chờ thu tiền tại kho") + thẻ việc dạng **lưới 3x3** (9 thẻ / trang, phân trang); không có việc → S01-trống |
| S09a / S02a / S03a / S04a / S05a | `#/staff/reconcile` … `#/staff/support` (không có `?id`) | Mỗi tab là lưới 3x3 thẻ việc của tab đó; bấm thẻ mở màn xử lý; không có việc → thông báo trống (S09a-trống) |
| S09 Thu tiền tại kho | `#/staff/reconcile?id=` (có `?id`) | Đơn khách chọn "Thanh toán tại cửa hàng": số tiền, giữ chỗ đến, gồm thuê + cọc; "Xác nhận đã thu" (`POST /api/ops/payments/{id}/confirm`) / "Để sau". Đơn trả PayOS không vào đây |
| S02 Xác minh khách hàng | `#/staff/verify?id=` | Checklist 4 mục đối chiếu (D30-14), **không nhập lại số giấy tờ**; xong mở bước nhận chìa khóa (cập nhật 02/11/2026) |
| S03 Nhận chìa khóa vật lý | `#/staff/handover?id=` (`#/staff/keys?id=` cùng màn) | Chặn khi chưa xác minh; 3 ô xác nhận rồi ghi nhận đã giao chìa khóa. **Không** còn thẻ từ / vân tay và **không** phải bước kích hoạt: hợp đồng, QR/PIN cấp tự động sau thanh toán (D26) |
| S04 Kiểm tra trả kho | `#/staff/return?id=` | 4 mục biên bản, gửi quản lý; kho → Chờ kiểm tra |
| S05 Xử lý hỗ trợ | `#/staff/support?id=` | Ghi nhận xử lý + trạng thái tiếp theo |
| S06 Đã ghi nhận | `#/staff/done?kind=` | Màn kết quả theo từng thao tác |
| Thu gia hạn tại quầy | `#/staff/renewal-payments` | Khoản `RENEWAL` khách chọn trả tại quầy; xác nhận đã thu |
| Báo sai lệch thanh toán | `#/staff/mismatch` | Nhân viên báo số thu thực tế khác hệ thống, gửi quản lý đối soát |
| D30-11 Xử lý đồ quá hạn ngày 20 | `#/staff/overdue` | Lập biên bản + ảnh sau khi đã thực hiện; rỗng → "Không có kho quá hạn đến ngày 20" |
| Hỗ trợ chưa có hợp đồng | `#/staff/inquiries` | Trả lời tư vấn khách chưa thuê kho (chờ BE `/api/support/inquiries`, T19) |

## Quản lý cơ sở (`#/manager`)

| Figma | Route | Làm được gì |
|---|---|---|
| M01 Tổng quan | `#/manager` | 86 kho, tỷ lệ lấp đầy tính từ dữ liệu, doanh thu, "Cần xử lý" gom mọi việc tồn |
| M02 / M02a Danh sách kho | `#/manager/units?tab=` | Lọc theo trạng thái (thêm "Bảo trì"), tìm mã kho / khách, phân trang 12; cột "Thao tác": "Đổi trạng thái" → hộp thoại M02a (Trống ↔ Bảo trì, Chờ kiểm tra → Trống / Bảo trì, bắt buộc lý do) — `PUT /api/ops/units/{code}/status` (F12) |
| M05 Phân bổ kho | `#/manager/allocate?id=` | Chỉ hiện kho trống đúng loại + diện tích; phân bổ xong tạo lịch xác minh & bàn giao cho nhân viên |
| M06 Phân công | `#/manager/assign` | Giao việc cho nhân viên (ca làm, số việc đang nhận) |
| M03 Gia hạn | `#/manager/renewals` | Duyệt = chốt giá, tạo khoản `RENEWAL` chờ thanh toán 24 giờ, **chưa đổi ngày hết hạn** (D32); Từ chối bắt buộc lý do. Khối "Chốt giá khi duyệt" (D30-17) còn chờ BE trả số tiền (L8) |
| M07 Hợp đồng & quá hạn | `#/manager/contracts?id=` | Ghi nhận đã nhắc khách; chốt số hoàn sau biên bản trả kho → khoản hoàn `PENDING` (D32), chuyển tiền ở màn Hoàn cọc |
| M04 Báo cáo doanh thu | `#/manager/report` | Biểu đồ 6 tháng, cơ cấu theo loại kho, tỷ lệ lấp đầy; xuất CSV |
| M08 Cập nhật thành công | `#/manager/done?kind=` | |
| Hoàn cọc sau trả kho (D30-09) | `#/manager/deposit-refunds` | Duyệt đối soát và ghi nhận chuyển khoản là hai bước; `PENDING` → `PAID`; rỗng → "Không có đối soát chờ duyệt" |
| M08 Hoàn tiền đơn huỷ | `#/manager/refunds` | Ghi mã giao dịch, chỉ một lần (D27) |
| Báo cáo sai lệch | `#/manager/discrepancies`, `#/manager/discrepancy-detail?id=` | Danh sách báo cáo của nhân viên, trạng thái rỗng / lỗi tải theo Figma |
| Hồ sơ quá hạn | `#/manager/overdue` | Nhắc khách ngày 10–14, phân công xử lý ngày 20 (chờ BE `overdue-cases`, T12) |
| Sự cố cơ sở | `#/manager/incidents` | Lối vào từ M07 → "Sự cố cơ sở"; phương án chuyển ô / kết thúc (T13) |
| Phản hồi / kiểm khắc phục hư hỏng | `#/manager/damage-responses`, `#/manager/damage-inspections` | D30-18; chờ BE damage-cases (T23) |

## Chỗ Figma tự mâu thuẫn, code chọn như sau
- Figma dùng ngày cố định (14/09, 20/09) → code tính theo ngày hiện tại để lịch hẹn luôn ở tương lai.
- M05 hiện đơn SS-…-0142 "đã đối soát" trong khi S01/S09 vẫn "chờ đối soát" → đơn 0142 đã có kho A-102; M05 dùng đơn khác, và đơn nhân viên xác nhận thu mà chưa có kho sẽ tự vào M05.
- M01 "2 kho quá hạn" nhưng M07 có 3 hợp đồng quá hạn (thêm C-012) → danh sách kho có 3 kho quá hạn khớp M07.
- Quản lý xem được khu nhân viên (`#/staff`) để kiểm tra việc tại cơ sở; nhân viên không vào được `#/manager`.
