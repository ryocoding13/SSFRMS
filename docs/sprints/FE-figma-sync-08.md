# Figma–FE Batch08 — Phiên 5, 28/10/2026

## Nền và đối chiếu

Tiếp toàn bộ Batch07 trên main c1a9b05b67a96972cbf44d039b9acb4e15307781 (đã đọc lại branch main và DECISIONS qua GitHub; blob DECISIONS 13b2eea528949844dd708bd00ee53d58be3c966c). Giữ D33 local của các batch trước. Đọc AGENTS/FE AGENTS, feature_list, progress, BACKEND-TODO, FRONTEND-MAP, naming/conventions/verification và target files. F40 active/F41 blocked không đổi. Không sửa BE/schema/Figma, không commit/push/PR/merge.

Đọc high-fidelity design context + screenshot trực tiếp: S02 `436:13163`, D30-14 `1052:13237`, D30-08 `1050:12843`, M07 `1085:13132`, D30-09 `1051:12752`, M08 `828:10212`, D30-11 `1051:13091`. Reuse shared UI/fonts/tokens, layout 804/432, ConfirmDialog, photo/bank helpers. Radio/checkbox native theo codebase; ảnh kiểm kê động, không chép placeholder/screenshot Figma thành bằng chứng. Không thêm asset tĩnh/dependency; header/nav shared giữ nguyên, chưa xác nhận visual khớp pixel.

## Thay đổi

- S02 bốn checkbox ban đầu chưa chọn, thông tin khách/đơn chỉ đọc, bỏ nhập số giấy tờ theo Figma mới. Không tự điền giấy tờ giả để gọi API cũ. API cần verificationChecklistSupported; thiếu thì chặn, demo lưu checklist. Adapter giữ khả năng serialize DTO cũ khi caller legacy có docNumber; Page mới không gửi số giấy tờ.
- Nhận chìa khóa: thiếu hồ sơ xác minh không được tiếp tục (sửa bug trước đây coi thiếu là ready). Cần đủ ba mục đối chiếu/kiểm tra kho-chìa/đã giao thực tế. Không thay ngày, trạng thái ô hoặc kích hoạt QR/PIN. Bằng chứng chính sách chỉ hiển thị khi có version/time hợp lệ; thiếu ghi rõ. Không xác nhận chính sách thay khách.
- Kiểm kê: không điền sẵn kết luận 'đã chuyển hết đồ/không hư hỏng'; nhập đủ bốn mục. Hư hỏng >0 cần hạng mục, lý do và ảnh; JPG/PNG tối đa5 ảnh, 5MiB/ảnh, kiểm signature. Vệ sinh cố định10% cọc; cần vệ sinh/sửa không đề xuất Trống. Sidebar không biến thiếu cọc/phí quá hạn thành0. Có lưu/mở nháp nội dung tại thiết bị, không lưu binary ảnh trong nháp; ảnh cần chọn lại khi reload. Thành công bỏ nháp, thất bại giữ nội dung/tệp.
- M07 chuyển bảng thành thẻ từng hợp đồng, đúng nút theo loại việc. ID lạ không tự chọn hợp đồng khác. Chi tiết có biên bản/ảnh, chốt dùng popup chuẩn. Thiếu biên bản hoặc phản hồi/khắc phục chưa đóng thì chặn. API cần marker D32 và damageWorkflowResolved=true; không bật giả. Chốt chỉ tạo chờ hoàn, không đánh dấu đã chuyển.
- Hoàn cọc: danh sách/chi tiết, tiến độ duyệt→chuyển khoản→kết quả, bank chính chủ có mask số tài khoản. Cần mã giao dịch + thời điểm VN không ở tương lai/không trước đối soát + checkbox chuyển đúng tiền/đúng tài khoản. Thiếu tiền không hiện0; số hoàn0 không tạo giao dịch; chỉ PAID mới Đã hoàn. Bỏ dòng công nợ legacy. Số tiền chính thức thiếu không lấy phép tính preview thay thế.
- M08: vẫn thẻ từng khách; sửa wording về tài khoản chính chủ, không giả định chỉ PayOS/tài khoản nguồn. Bổ sung bank, thời gian và xác nhận; thiếu hỗ trợ server chặn ghi PAID. Trạng thái lạ không mặc định Đã hoàn; tiền thiếu không hiện0. Popup nhập/xác nhận/kết quả dùng mẫu chung.
- Ngày20: đúng cơ sở và phân công, thời điểm thực hiện đủ mốc, ảnh trước/sau và checkbox bắt buộc. Không đưa đồ ra sớm chỉ vì tỷ lệ khấu trừ cao khiến cọc đã hết. Mốc xử lý độc lập thời điểm cap cọc: mặc định20 trong demo, policy removalDay nếu >=20; API phải trả mốc thật và assigneeId, không lấy policy demo thay server. Chỉ INSPECTION/MAINTENANCE sau xử lý, không tự cho Trống.
- Provider kiểm điều kiện ngay mutation boundary; đọc lại board sau API và kiểm trạng thái/evidence, không coi200 rỗng là thành công. Reload thất bại, conflict/mất mạng/5xx/ack thiếu buộc tải lại; không chuyển tiền lần nữa. File đang đọc/busy chặn submit; đổi route ID dựng form mới; phiên đã unmount/đổi role trước POST không gửi file muộn. Success/failure provider dùng ConfirmDialog chuẩn.
- Demo M07 tạo deposit_refunds trong ops store; màn hoàn cọc dùng cùng queue và customer tracking đọc queue này khi có, thay vì chốt một nơi/xem seed hoàn cọc nơi khác. Phát sự kiện cập nhật sau lưu. Demo chỉ metadata ảnh và không chuyển tiền/đổi quyền cửa thật. Case M07 thiếu owner/bank không tự suy đoán; không cho ghi chuyển tiền cho đến đủ dữ liệu. Hồ sơ hư hỏng/sự cố của Batch06–07 vẫn là kịch bản độc lập, chưa giả là backend tích hợp.

## Backend còn thiếu

S02 main vẫn bắt DocNumber; S04 main lưu bốn mục nhưng không lưu đủ phí/ảnh; M08 main không lưu proof mới; API deposit-refunds/overdue còn đề xuất. Đã ghi contract/marker/receipt mới tại BACKEND-TODO mục Batch08. Marker do server công bố sau khi triển khai/kiểm chứng, không dùng env hoặc mock để bypass. FE guard không thay quyền/transaction server.

M07 cần tích hợp trạng thái hư hỏng/khắc phục thực tế và ngân hàng/ảnh từ T08; không chỉ thêm một cờ rồi chốt. Mọi cập nhật refund/inspection/unit/credential phải khóa/transaction/version/idempotency tại SQL Server. LocalStorage/demo không cung cấp các bảo đảm này.

## Kiểm chứng

- FE **145/145** (8 test mới, thêm assertions S02 checklist), workflow **12/12**, business **9/9**, SSR **158 lượt route/scenario**. Assertions gồm thiếu xác minh, 3/4 checkbox chưa chọn, nháp kiểm kê, ID lạ, bank/time/checkbox hoàn, tiền thiếu/0/trạng thái lạ, pending remediation và thời điểm ngày20.
- Structure/build/init.sh --fe-only/git diff --check PASS. Build còn chunk >500KB.
- Cập nhật fixture positive vì checklist/bank/time/ảnh nay bắt buộc; giữ negative assertions. Sửa test cũ coi cọc hết sau10 ngày là được xử lý đồ ở ngày11: trái D32/Figma nên nay phải từ chối. Fixture thời gian thực hiện cũ nằm trước EndDate cũng sửa về thời điểm đủ điều kiện; không bỏ kiểm tra mốc/thời gian tương lai.
- API tests có request stub và mock HTTP hiện có; không chứng minh BE thật đã lưu field mới. Chromium launch trong phiên này thiếu executable. Chưa browser/visual/click/focus/file picker/cross-tab, API .NET/SQL Server/PayOS/thiết bị cửa thật. Không lấy SSR thay browser.
- Patch after-batch07/main được kiểm apply + byte-match trên bản export sạch. PowerShell chưa thực thi trên Windows.

## Bàn giao / tiếp tục

Chỉ chọn after-batch07.patch nếu đã có Batch07, hoặc main.patch cộng dồn01–08 cho main c1a9b05. Thành viên tự review/kiểm tích hợp trước commit/push/PR/merge. Còn2 phiên: Batch09 vận hành/admin/popup, Batch10 browser và tích hợp. Không tuyên bố toàn bộ Figma/hệ thống hoàn tất.
