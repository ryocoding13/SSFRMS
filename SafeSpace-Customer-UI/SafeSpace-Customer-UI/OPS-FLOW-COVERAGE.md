# Đối chiếu Figma ↔ code: Nhân viên cơ sở & Quản lý cơ sở

Nguồn: file Figma "SafeSpace - Modern UI", section *SafeSpace · Nhân viên cơ sở* và *SafeSpace · Quản lý cơ sở*.
Dữ liệu: `src/ops/data.js` (khởi tạo) · nghiệp vụ: `src/ops/reducer.js` (có test) · lưu: `src/ops/store.jsx`.

## Nhân viên cơ sở (`#/staff`)

| Figma | Route | Làm được gì |
|---|---|---|
| S01 Công việc trong ngày | `#/staff` | 3 số liệu + thẻ việc dạng **lưới 3x3** (9 thẻ / trang, phân trang); không có việc → S01-trống |
| S09a / S02a / S03a / S04a / S05a | `#/staff/reconcile` … `#/staff/support` (không có `?id`) | Mỗi tab là lưới 3x3 thẻ việc của tab đó; bấm thẻ mở màn xử lý; không có việc → thông báo trống (S09a-trống) |
| S09 Đối soát thanh toán | `#/staff/reconcile?id=` (có `?id`) | Xác nhận đã thu / Báo sai lệch (bắt buộc ghi rõ) |
| S02 Xác minh khách hàng | `#/staff/verify?id=` | Loại + số giấy tờ (chỉ giữ 4 số cuối), 2 ô đối chiếu; xong chuyển sang bàn giao |
| S03 Bàn giao kho | `#/staff/handover?id=` | Thẻ từ / Mã PIN / Vân tay; chặn khi chưa xác minh; kho → Đang hoạt động |
| S04 Kiểm tra trả kho | `#/staff/return?id=` | 4 mục biên bản, gửi quản lý; kho → Chờ kiểm tra |
| S05 Xử lý hỗ trợ | `#/staff/support?id=` | Ghi nhận xử lý + trạng thái tiếp theo |
| S06 Đã ghi nhận | `#/staff/done?kind=` | Màn kết quả theo từng thao tác |

## Quản lý cơ sở (`#/manager`)

| Figma | Route | Làm được gì |
|---|---|---|
| M01 Tổng quan | `#/manager` | 86 kho, tỷ lệ lấp đầy tính từ dữ liệu, doanh thu, "Cần xử lý" gom mọi việc tồn |
| M02 Danh sách kho | `#/manager/units?tab=` | Lọc theo trạng thái, tìm mã kho / khách, phân trang 12 |
| M05 Phân bổ kho | `#/manager/allocate?id=` | Chỉ hiện kho trống đúng loại + diện tích; phân bổ xong tạo lịch xác minh & bàn giao cho nhân viên |
| M06 Phân công | `#/manager/assign` | Giao việc cho nhân viên (ca làm, số việc đang nhận) |
| M03 Gia hạn | `#/manager/renewals` | Duyệt (cập nhật ngày hết hạn) / Từ chối (bắt buộc lý do) |
| M07 Hợp đồng & quá hạn | `#/manager/contracts?id=` | Ghi nhận đã nhắc khách; xác nhận hoàn cọc sau biên bản trả kho |
| M04 Báo cáo doanh thu | `#/manager/report` | Biểu đồ 6 tháng, cơ cấu theo loại kho, tỷ lệ lấp đầy; xuất CSV |
| M08 Cập nhật thành công | `#/manager/done?kind=` | |

## Chỗ Figma tự mâu thuẫn, code chọn như sau
- Figma dùng ngày cố định (14/09, 20/09) → code tính theo ngày hiện tại để lịch hẹn luôn ở tương lai.
- M05 hiện đơn SS-…-0142 "đã đối soát" trong khi S01/S09 vẫn "chờ đối soát" → đơn 0142 đã có kho A-102; M05 dùng đơn khác, và đơn nhân viên xác nhận thu mà chưa có kho sẽ tự vào M05.
- M01 "2 kho quá hạn" nhưng M07 có 3 hợp đồng quá hạn (thêm C-012) → danh sách kho có 3 kho quá hạn khớp M07.
- Quản lý xem được khu nhân viên (`#/staff`) để kiểm tra việc tại cơ sở; nhân viên không vào được `#/manager`.
