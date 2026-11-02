# Figma–FE đợt03 — 27/10/2026

## Phạm vi và nền

Tiếp tục code FE theo lựa chọn trước đó của người dùng; không sửa file Figma. Nền816209d + đợt01/02 đang lưu trong worktree SSFRMS-figma-sync-01. Không commit, push, PR hoặc merge. F40 active/F41 blocked giữ nguyên. Không tuyên bố đã hoàn thành mọi màn.

Đã đọc design context và screenshot:
- `1048:12519`: trả kho — cột804/432, ảnh, ngân hàng, cảnh báo hậu quả.
- `1050:12699`: huỷ đơn — trang riêng, tài khoản chính chủ, lý do, khoản hoàn.
- `1053:13123`: hoàn cọc — tiến độ4 bước, bảng khấu trừ, tài khoản/hạn/mã chuyển.

## Đã code

1. ReturnRequestPage: chọn/xoá/xem trước tối đa5 ảnh JPG/PNG≤5MiB; kiểm signature; checkbox dọn hết đồ; ngân hàng; xác nhận theo popup dùng chung; giữ form khi lỗi; khoá gửi trùng; chặn hợp đồng kết thúc/chưa bắt đầu/đang có yêu cầu. UI không giả ảnh đã upload.
2. CancelReservationPage mới `reservations/:id/cancel`: thay popup cũ từ C14, hai cột, preview số tiền từ dịch vụ, ngân hàng chính chủ cho đơn đã thanh toán, xác nhận nguy hiểm, trạng thái lỗi/thành công. Đơn chưa trả tiền không yêu cầu ngân hàng. Footer C14 bỏ câu hoàn về tài khoản đã thanh toán, vì có thể đã trả tiền mặt.
3. RefundTrackingPage: chọn hồ sơ khi có nhiều khoản, tiến độ theo timestamp thật, tách chờ/đã hoàn; tài khoản che số; biên bản/ảnh khi có; lỗi/rỗng; số thiếu không giả0; không hiện mã chuyển cho PENDING. Lọc ownerId phòng vệ và dùng endpoint khách riêng (server vẫn phải phân quyền).
4. ReturnProgress dùng chung RefundSummary, bỏ wording khoản chưa thanh toán/thu thêm. Không tuyên bố đã đối chiếu lại bố cục toàn màn này.
5. Demo reducer bắt buộc bank/ảnh/xác nhận cho trả, bank/xác nhận và trước StartDate cho huỷ đã trả tiền. Lưu metadata ảnh tránh localStorage quá quota; QR access_issued=false khi gửi. API dùng capability đề xuất; không silently drop bank/ảnh ở server cũ. Mapper giữ RETURN_PENDING và tên snapshot khi được trả về.

## Kiểm chứng

- Chạy với `TZ=Asia/Ho_Chi_Minh`: npm test96/96, business9/9, workflows12/12, SSR119route + assertions (form bắt buộc, hoàn PENDING/PAID, che tài khoản, lọc owner, dữ liệu thiếu), structure/build PASS.
- npm test chạy với timezone mặc định của host lần đầu có lệch ngày ở các fixture mapper/gia hạn/huỷ; không nới assertion. Chạy đúng timezone VN như đợt trước đạt. Fixture thành công trả kho cũ được đặt StartDate đã bắt đầu và thêm dữ liệu bắt buộc theo D32; giữ test lỗi.
- `init.sh --fe-only` và `git diff --check` PASS; sau bổ sung guard RETURN_PENDING chạy lại FE/render/build.
- Cảnh báo build chunk>500KB vẫn có.
- Không có Chromium dùng được; các lần cài ở đợt trước lỗi ZIP. Chưa kiểm click, mobile, focus/file picker và so ảnh trên trình duyệt. SSR không thay browser QA.
- Chưa test API thật, SQL Server, PayOS. Không sửa BE. Hợp đồng capability/JSON trong BACKEND-TODO là đề xuất FE, chưa được BE owner xác nhận; gửi trả/huỷ có hoàn sẽ bị chặn trên máy chủ cũ.

## Điểm cần tích hợp / còn lại

- Mai: T08 ngân hàng và ảnh gửi trả; T05–T09 để dừng phí/QR, chốt hoàn PENDING/PAID đúng; endpoint khách xem hoàn. Đạt: T20 consent gia hạn từ đợt02. Kiểm atomicity, quyền, retry/idempotency và ảnh thật trước mở capability.
- Browser: 1440/768/390; thử ảnh lỗi/6ảnh/quá5MB/xoá/chọn lại; thiếu/sai/chính chủ ngân hàng; gửi2lần; mạng lỗi; chuyển route trong khi chờ; huỷ chưa trả tiền/đã trả tiền/đếnStartDate; PENDING/PAID/0đ/thiếufield/quyền khác.
- Màn còn chưa đồng bộ trong các đợt này: khắc phục hư hỏng, sự cố chuyển ô/kết thúc, hỗ trợ chưa hợp đồng và các màn vai trò Staff/Manager/Operations/Admin theo backlog đợt01. Những màn đã code vẫn còn các khoảng cách dữ liệu và kiểm browser ghi tại đợt02.
- Không tiếp tục từ đầu: đọc sprint03 và diff hiện tại; node/các thay đổi trên là checkpoint. File Figma không thay đổi trong đợt này.

## Bàn giao

ZIP có changes.patch gộp đợt01–03 từ816209d; after-batch01.patch hoặc after-batch02.patch chỉ phần còn lại. Script chọn marker và chạy git apply --check; chỉ áp dụng một patch. Bản sao source tại files/ để review, không copy đè mù. Không có node_modules/dist/secrets.
