# Figma–FE Batch07 — Phiên 4, 28/10/2026

## Nền, phạm vi và nguồn

Tiếp nguyên source Batch06 chưa commit. Main đọc lại qua GitHub hiện vẫn c1a9b05b67a96972cbf44d039b9acb4e15307781; DECISIONS.md remote blob 13b2eea528949844dd708bd00ee53d58be3c966c có D32 và PROCESS-2026-10-28-PAYOS. Giữ D33 local của Batch04. Đọc lại AGENTS/FE AGENTS, feature_list, progress, BACKEND-TODO, FRONTEND-MAP, naming/conventions/verification và target code. F40 active/F41 blocked không đổi; không sửa BE/schema/Figma, không commit/push/PR/merge.

Design context high-fidelity và screenshot trực tiếp: D30-10 `1051:12926`, D30-16 `1053:13267`, D30-16b `1077:11925`. Ba màn/nhánh được triển khai bằng hai Page; trạng thái sau chuyển dùng lại trang khách. Figma khớp D32 về hoàn cả tháng đang thuê + tháng chưa dùng + cọc. Không chép số tiền/ngày/tên khách minh họa thành dữ liệu API thật.

Dùng shared UI, ConfirmDialog 560px, RefundBankFields, ReturnPhotoInput, DamagePhotos và font/token/layout 804/432 đang có. Radio/checkbox là input native theo component pattern; ảnh biên bản là dữ liệu động, không dùng icon ảnh trống hoặc ảnh chụp màn Figma thay bằng chứng thật. Header/nav dùng shared layout hiện có; chưa tuyên bố visual khớp pixel vì chưa có browser chạy. Không thêm dependency/asset tĩnh mới, không nhúng temporary Figma asset URL.

## Đã làm

- Manager `manager/incidents[?id=:id]`: danh sách hồ sơ/hợp đồng đủ điều kiện theo cơ sở, ghi mô tả và thời điểm ảnh hưởng theo giờ VN, ảnh JPG/PNG tuỳ chọn, checkbox xác nhận ban đầu chưa tick. Chọn phương án đề xuất và ô tương đương; lưu nháp riêng hoặc gửi khách. Server chưa có: báo lỗi, không tự tạo thành công.
- Khách `units/:id/incident?incident=:id`: chỉ thấy hồ sơ đã gửi của mình, hai phương án ban đầu chưa chọn. Chuyển ô tương đương không phụ phí/giữ kỳ và giá; hoặc kết thúc do sự cố với nội dung khoản hoàn, ngân hàng chính chủ theo D32. Ghi chú tuỳ chọn. Không gọi luồng trả kho/dừng sớm thông thường để tính hoàn 70% hoặc chia theo ngày.
- Sau khách đồng ý chuyển: TRANSFER_PENDING, chưa đổi ô hoặc mã. Manager xác nhận đã chuyển đồ thực tế + thời điểm không ở tương lai và không trước lựa chọn/sự cố. TRANSFERRED mới cho thấy ô mới, ô cũ bảo trì, mã cũ hết hiệu lực/mã mới đã cấp; giá/kỳ/cọc giữ nguyên và phụ phí 0.
- API thật mở QR qua AccessQrModal/services đang có khi GET/receipt đã đủ bằng chứng chuyển; không tạo credential từ chuỗi seed. Demo chặn nút QR vì không đổi hợp đồng/credential thật. Backend phải cập nhật contract/unit/access nguyên tử; FE không thực hiện thu hồi mã thủ công.
- Khách chọn kết thúc: TERMINATION_PENDING, cơ sở đối chiếu và xác nhận → TERMINATED với REFUND PENDING đúng tổng hoàn, không tự PAID. GET có thể hiển thị PAID khi server trả mã giao dịch và paidAt; thao tác kết thúc vẫn phải trả PENDING. Việc chuyển tiền là bước riêng. Ô cũ giữ bảo trì.
- Pure model kiểm role/owner/facility/version/contract stage, tương đương loại+diện tích+cùng cơ sở và phiên bản ô. Payload tiền/owner/giá tự gán không gửi. Ảnh kiểm số lượng/size/type/signature; lỗi giữ nội dung/tệp. Popup cấp Page giữ kết quả khi form đổi trạng thái. Request cũ không cập nhật màn/tài khoản mới, đổi tài khoản trước POST thì dừng.
- Xung đột 409, mất mạng, 5xx hoặc receipt thiếu/sai buộc tải lại trước thử tiếp; có nút cập nhật trạng thái. Receipt kiểm đúng hồ sơ/owner/cơ sở/version/stage và điều kiện đổi mã/giữ kỳ/giá hoặc khoản chờ hoàn. Client guards không thay server authorization/transaction/idempotency.
- Demo opt-in có nhãn; hồ sơ, preview và reservation ô lưu riêng, không sửa store hợp đồng/ledger/QR thật. Có case nháp Mai để chạy từ đầu; manager gửi thì Mai mới nhìn thấy. Chặn hai case giữ cùng ô; chọn kết thúc giải phóng ô đã giữ. Ảnh demo chỉ lưu metadata, không phải evidence thật. LocalStorage không cung cấp transaction đa thiết bị; SQL Server phải làm ở BE.

## API T13 còn chờ

Contract mới là **đề xuất** tại BACKEND-TODO mục Batch07, chưa có endpoint trên main đã kiểm. Cần GET hồ sơ khách/manager, manager danh sách nháp đủ điều kiện+candidates/version và persistence tạo/đọc nháp, POST save/send, choice, complete-transfer, terminate; lưu ảnh/bank/choice/server time; khóa giao dịch contract/incident/unit/credential/refund, idempotency và đọc lại sau mất mạng. Cơ sở không chọn thay khách. Phần kết thúc thêm bước manager đối chiếu là contract FE đề xuất, cần BE owner thống nhất khi triển khai; không tuyên bố backend đã thực hiện.

Không có nút tạo case từ một hợp đồng bất kỳ/ID tự nhập: GET manager phải trả descriptor nháp/server ID cho hợp đồng đủ điều kiện, chỉ lưu chính thức khi SAVE/SEND. Nếu BE chọn API tạo draft riêng thì cần chỉnh adapter và điểm chọn hợp đồng tương ứng; đây là blocker T13, không giả tạo case client ở API mode. Nháp không lộ trong GET khách. Lịch sử hợp đồng đã kết thúc cần còn đọc được để khách theo dõi khoản hoàn.

## Kiểm chứng

- `TZ=Asia/Ho_Chi_Minh npm test`: **137/137**, gồm 15 test incident mới (role/scope, checkbox/time, equivalent unit/version, stage, giữ giá/mã, đúng khoản hoàn, bank, ảnh metadata, 404/receipt, stale account và hai case giữ ô).
- Business **9/9**, workflows **12/12**, structure PASS. SSR **149 lượt route/scenario**: nháp, lựa chọn chưa check, khác owner/cơ sở, manager hoàn tất, kết quả ô mới và QR demo disabled.
- Build PASS; `TZ=Asia/Ho_Chi_Minh bash init.sh --fe-only` PASS; `git diff --check` PASS. Build còn chunk >500KB.
- Chromium launch thử trong phiên này: executable không tồn tại ở Playwright cache. Chưa kiểm browser/visual/click/file picker/focus/reload/cross-tab thực thi. SSR không thay kiểm browser. Chưa API .NET/SQL Server/PayOS/thiết bị cửa thật. API tests dùng request stub và pure model, không phải backend thật.
- Hai patch after-batch06 và main được kiểm apply và byte-match trên bản export sạch với source cuối. PowerShell chưa thực thi trên Windows.

## Điểm tiếp tục

Tám màn/nhánh thiếu FE trong danh mục Batch04 đã có triển khai tương ứng qua 05–07, nhưng nhiều API và visual/tích hợp vẫn blocked; không gọi là hoàn tất toàn bộ Figma/hệ thống. Còn 3 phiên: Batch08 nhân viên/manager (kiểm kê, M07, hoàn tiền, chìa khoá), Batch09 vận hành/admin/popup, Batch10 browser và tích hợp.

Bàn giao `after-batch06.patch` cho code đã có Batch06 hoặc `main.patch` cộng dồn 01–07 cho main c1a9b05; chỉ dùng một patch. Thành viên tự review, kiểm tích hợp, commit/push/PR/merge.
