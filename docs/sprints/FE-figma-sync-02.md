# Figma–FE đợt 02 — 27/10/2026

## Nền và bàn giao

- Tiếp tục worktree SSFRMS-figma-sync-01; nền Git 816209d (D32/PR #46), giữ toàn bộ đợt 01. Fetch cuối phiên: origin/main d57c71b. Không commit/push/PR/merge.
- ZIP có `changes.patch` (D32 → đợt 01 + 02) và `after-batch01.patch` (chỉ đợt 02). Chỉ áp dụng một bản. Script chọn dựa trên sự hiện diện của RecordSummaryCard rồi git apply --check trước khi ghi; repo phải sạch, nhánh riêng.
- F40 active, F41 blocked giữ nguyên. Chưa xác nhận BE T20 hoặc visual match toàn bộ.

## Phần đã code

| Màn | Node Figma đã đọc context + screenshot | Kết quả |
|---|---|---|
| C07 chi tiết hợp đồng | 1084:12363 | Cột 804/432; thẻ hợp đồng, QR/PIN/chìa khóa, policy và thao tác; giữ liên kết theo dõi; khóa gia hạn hết hạn, vẫn cho trả kho quá hạn nếu không có yêu cầu chờ |
| C08 gia hạn | 1084:12741 | Radio kỳ 1/3/6 tháng, checkbox policy, summary chi phí; không tự kéo EndDate; giữ dữ liệu khi lỗi; backend cũ bị chặn theo T20 |
| C11 thanh toán/lịch hẹn | 1101:12197 | Thẻ theo lịch/khoản, status, chi tiết, QR, liên kết chọn tại quầy tới màn gia hạn hiện có; summary tổng khoản thanh toán/cọc/chờ hoàn; giữ chặn phí D32 |
| C11h lịch sử | 1101:12569 | Thẻ, filter hợp đồng/loại; không đưa khoản chờ hoàn/chờ trả vào giao dịch đã ghi nhận; popup info |
| C11k kiểm tra thanh toán | 1101:12732 | Route mới payments/check/:ref; kiểm dịch vụ hiện có, lỗi không thành công giả; mở QR chỉ sau check unpaid thành công; bản ghi không phải renewal hiện not-found |
| Popup chuẩn | 1058:13284, 1058:13315, 1058:13346, 1058:13377, 1058:13408, 1058:13439 | ConfirmDialog hỗ trợ 6 tone cùng kích thước/spacing; ChangeFlowDialog dùng lại; giữ focus trap và nút đóng; success/failure của luồng cũ không tự retry mutation |

Không sửa Figma; tái sử dụng React/CSS/token/font/Modal/QR hiện có. Nội dung thẻ không có asset tĩnh mới; header/nav giữ bản cũ, chưa đối chiếu hoàn chỉnh. Dữ liệu minh họa trong ảnh không được đưa vào giao dịch thực.

## Khoảng cách còn lại / không tuyên bố đã xong

- C07 chưa hiển thị bằng chứng policy đã đồng ý do mapper/API chưa có; hiện thông báo đúng và link policy hiện hành. Sidebar dùng nhãn thao tác rõ nghĩa dài hơn Figma, có wrap cho thẻ hẹp. Không chặn gia hạn trước StartDate chỉ vì ảnh mẫu khóa, vì D32 chỉ yêu cầu gửi trước EndDate.
- C08: `renewalConsentSupported` và response `policyConsent` là hợp đồng FE đề xuất, BE chưa triển khai. Ghi chi tiết ở BACKEND-TODO. UI bị chặn trên server cũ; demo lưu consent trong yêu cầu cục bộ. Chưa lưu lại lịch sử policy trên BE.
- C11: nút Tại quầy đi tới màn theo dõi để chọn kênh thu đang có; không dựng workflow thu tiền mới. Chưa có payment deadline/QR session trong mapper, không giả ngày hay trạng thái hết hạn. Màn C11k mở/lấy QR qua dịch vụ cũ, không khẳng định tạo phiên mới mỗi lần.
- C11h chưa filter tháng hoặc hiển thị thời điểm/mã giao dịch khi server chưa trả; không suy ra từ kỳ thuê. Bản ghi phí lịch sử giữ trạng thái thực, không tự gán Trừ cọc nếu BE chưa ghi.
- Popup 6 variants đã có component nhưng chưa migrate mọi CancelDialog, QR, PayOS và popup từng vai trò; chưa sửa toàn bộ màn staff/manager/business/admin. C14 ngân hàng hoàn tiền, trả kho có ảnh, sự cố và khắc phục vẫn còn backlog.

## Kiểm chứng

- Node24.22.1: check:structure PASS; npm test 89/89 (thêm 3 nhóm consent: server cũ/thiếu consent/policy đổi không POST, payload/ack, demo lưu evidence/không đổi EndDate/chặn hết hạn); business 9/9; workflows 11/11.
- SSR 117 routes, gồm C11k hợp lệ/không tìm thấy; assertion radio/checkbox C08, history không giả chờ hoàn thành đã hoàn, 6 tone dialog và các assertion D32/đợt01. Build, init --fe-only và diff --check PASS; chunk >500 kB là cảnh báo còn có.
- **Browser chưa kiểm**: thử thêm `npx playwright install chromium --only-shell`, tải ZIP Chrome Headless Shell156/v1248 lỗi. Không coi SSR là kiểm click hoặc so ảnh. Không chạy SQL Server, API thật hoặc PayOS thật.
- Patch sẽ được kiểm trên export base sạch và export base + đợt01, so byte từng file kết quả.

## Tiếp tục

1. Chạy browser 1440/768/390, click các link C07/C08/C11/h/k, kiểm focus/Escape/tab popup, dữ liệu rỗng/dài, check unpaid/paid/error; không phát sinh giao dịch thật để test UI.
2. BE T20 thống nhất/triển khai contract trong BACKEND-TODO; test API thật policy đổi + không ghi một nửa + duplicate; đưa consent vào mapper/policy history. Sau đó mới mở lại gửi gia hạn API.
3. Bổ sung timestamp/payment deadline/QR session khi API cung cấp, rồi hoàn thiện C11h/k và biến thể paid C11b (hiện state paid đi theo dữ liệu thực).
4. C14 cancel-bank/refund và ReturnRequestPage ảnh/ngân hàng; lấy design context trước sửa. Sau đó các vai trò khác theo backlog đợt01.

Không rà lại từ đầu các màn đã code; đọc tài liệu này, đợt01 và diff đang lưu trước khi tiếp tục.
