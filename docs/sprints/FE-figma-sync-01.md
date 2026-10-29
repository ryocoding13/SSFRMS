# Figma–FE: điểm tiếp tục đợt 01 (27/10/2026)

## Nền và phạm vi

- Base: `816209d5aac53c6051202941004e17e8cf2fcf0e` (`origin/feature/thang-d32-fe`, PR #46). Sau fetch, origin/main vẫn ở d57c71b. Bản này áp dụng SAU bản D32; không áp dụng riêng lên main cũ.
- Worktree: `SSFRMS-figma-sync-01`; chưa commit/push/PR/merge. Bản vá không gồm lại các thay đổi D32.
- Figma file: `SX8EvOf1TJkxfMl90bZsGN`. Đã đọc design context có ảnh C06, C14, C08, popup xác nhận. Không sửa Figma.
- D26/D30/D32 có hiệu lực; F40 active, F41 blocked giữ nguyên. Đây là batch giao diện, không xác nhận backend hoàn thành.

## Đã sửa, chờ kiểm trực quan

| Mục | Figma node | Thay đổi |
|---|---|---|
| C06 Kho của tôi | 1084:12160 | Thẻ ngang, thông tin gần nhau, badge + nút bên phải, breadcrumb/count, mở AccessQrModal hiện có, liên kết gia hạn khi sắp hết hạn và không có yêu cầu chờ |
| C14 Đặt chỗ | 1085:12208 | Thay bảng bằng thẻ ngang, Huỷ đơn trước Xem đơn, count/breadcrumb, khung ghi chú cuối; giữ điều kiện huỷ và luồng API hiện có |
| Popup xác nhận | 1058:13284 | Giữ Modal 560 px/focus trap; sửa font 600, bo khung thông tin 10 px, nút 8 px; ẩn khung rỗng, giữ giá trị số 0 |

Dùng lại Button, LinkButton, Panel, Tag, StatusTag, AccessQrModal, token hiện có và font Manrope đã có trong public/fonts. Thẻ chung mới: `src/shared/components/RecordSummaryCard.jsx`; CSS được giới hạn theo customer-records/record-summary, không đổi RecordCard của workflow vận hành. Header/nav và QR modal vẫn là bản có sẵn, chưa đối chiếu hoàn tất theo Figma mới. Không có asset tĩnh mới trong nội dung hai thẻ/popup xác nhận.

## Kiểm chứng

- Node 24.22.1; check:structure PASS; npm test 86/86; test:business 9/9; test:render 115 routes PASS và thêm assertions: hợp đồng kết thúc không có nút QR, trả kho chờ xử lý khoá QR, hai danh sách rỗng, popup giữ số 0/ẩn summary rỗng.
- build PASS; `bash init.sh --fe-only` PASS; git diff --check PASS. Build còn cảnh báo chunk >500 kB.
- Lần SSR đầu thiếu chữ Thao tác do bỏ tiêu đề cột: thêm role=group + aria-label theo từng bản ghi cho nhóm nút; kiểm lại PASS, không xoá assertion.
- **Chưa kiểm browser/visual**: npx playwright install chromium tải Chrome 156 / Chromium 1248 về ZIP lỗi (End of central directory record signature not found), kết thúc exit 1. SSR không thay thao tác/ảnh trình duyệt. Chưa kiểm API thật, SQL Server hoặc PayOS.
- Khi có trình duyệt: kiểm 1440/768/390 px, thẻ dữ liệu dài/không dữ liệu, tab/focus/Escape popup, mở/đóng QR, gia hạn, huỷ thành công/thất bại và refresh hoàn tiền. Không thực hiện huỷ/giao dịch thật chỉ để test UI.

## Tiếp tục từ đây — không làm lại C06/C14 từ đầu

1. Review/browser hai màn đã sửa; kiểm C14 huỷ/đã hoàn/empty với các node 1085:12364, 1085:12518, 1085:12655. Badge/copy về tài khoản hoàn trong luồng cũ chưa được chuyển sang toàn bộ D32: xử lý cùng form ngân hàng và hợp đồng API, không giả đã lưu.
2. C07 `1084:12363`, C07b `1084:12566`: đọc context+ảnh, chuyển detail sang cột 804/432; giữ QR/renew/return/support và các link theo dõi đã có.
3. C08 `1084:12741`: đã xem thiết kế radio kỳ thuê, đồng ý chính sách, cột tạm tính. Chưa sửa code. Đọc BACKEND-TODO, policy/provider/API trước khi thêm consent; phải lưu đúng phiên bản/thời điểm, không thêm checkbox rồi giả server đã lưu. Không chép giá hay phiên bản 11/2026 minh hoạ thành dữ liệu thật.
4. C11 `1101:12197`, C11b `1101:12396`, history `1101:12569`, kiểm thanh toán `1101:12732`: lấy high-fidelity context và ảnh trước sửa; giữ chặn thu phí D32 và trạng thái refund pending.
5. Popup còn 5 loại: danger1058:13315, success1058:13346, failure1058:13377, warning1058:13408, info1058:13439. Chưa migrate mọi callsite/CancelDialog/QR/PayOS; không đổi kích thước các modal chuyên biệt hàng loạt.
6. Sau đó đối chiếu màn trả kho, hoàn tiền, sự cố, hỗ trợ chưa hợp đồng và các vai trò staff/manager/business/admin. Danh sách này chưa phải kết luận tất cả đã thiếu: cần đọc repo/Figma mới tại lần tiếp tục.

Trước lần tiếp theo: fetch; kiểm PR #46 đã merge chưa, đọc AGENTS/DECISIONS/feature_list/progress; giữ worktree đang sửa. Nếu chuyển nền main mới, áp dụng patch có kiểm tra xung đột, không ghi đè bằng toàn bộ file cũ. Bàn giao ZIP có patch, files và hướng dẫn; thành viên tự commit/push và review trước main.
