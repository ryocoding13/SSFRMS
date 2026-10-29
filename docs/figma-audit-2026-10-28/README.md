# SafeSpace — đối chiếu repo, Figma và Batch01–03 (28/10/2026)

## Kết luận

Ba ZIP chưa đồng bộ hoàn toàn với Figma hiện tại. Batch03 là gói cộng dồn của 01–03, không phải ba phần độc lập để áp dụng cùng lúc. Nền ZIP là 816209d; repo được kiểm lần này là main c1a9b05b67a96972cbf44d039b9acb4e15307781. Code FE giữa hai commit chưa đổi, nhưng BE gia hạn/chính sách đã đổi; patch cũ xung đột progress.md.

Batch04 giữ phần đã làm của ba ZIP, ghép lên main hiện hành, sửa các lỗi đã xác minh và bàn giao patch mới. Chưa hoàn thành toàn bộ Figma, chưa xác nhận browser/API/SQL Server/PayOS thật. Không sửa canvas, backend, schema, không commit/push/PR/merge.

## Đếm màn đúng phạm vi

Đếm frame toàn màn rộng từ 1400px ở 6 section Main, bỏ khung con nằm trong màn; không tính khu component/tham chiếu. Kết quả kiểm kê trực tiếp từ Figma:

| Khu | Frame toàn màn |
|---|---:|
| Trang chủ & tài khoản | 10 |
| Khách hàng | 92 |
| Nhân viên cơ sở | 18 |
| Quản lý cơ sở | 25 |
| Vận hành KD | 9 |
| Quản trị hệ thống | 9 |
| **Tổng** | **163** |

163 không phải 163 trang React hay 163 màn mới: gồm cùng màn ở nhiều cơ sở, trạng thái lọc/lỗi/rỗng và kết quả. Popup 560px không cộng vào số này. Không có snapshot lịch sử Figma ngày tạo Batch03 để đếm chính xác “bao nhiêu màn vừa được thêm sau Batch03”.

Đối chiếu code/route xác định **8 màn/nhánh còn thiếu triển khai tương ứng**, xuất hiện trong **11 frame** (C04a có nhiều bản theo cơ sở và trạng thái checkbox):

| Mã | Thiết kế | Node đại diện | Cần làm |
|---|---|---|---|
| C04a | Xác nhận đơn & đồng ý chính sách trước thanh toán | 1095:12148 | Tóm tắt đơn → đọc bản hiện hành → khách tự đồng ý → lưu consent → chọn thanh toán. Không để nhân viên tích thay. |
| C15b | Chính sách theo hợp đồng | 1079:12031 | Chọn hợp đồng, đọc đúng version và bằng chứng server; không lấy version hiện hành thay version đã đồng ý. |
| D30-13 | Khách đối chiếu hư hỏng, đề nghị khắc phục | 1052:13092 | Biên bản/ảnh, khiếu nại và nội dung đề nghị. |
| D30-18 | Quản lý xử lý phản hồi hư hỏng | 1076:11700 | Đồng ý/từ chối có lý do, tạm giữ khấu trừ và hạn khắc phục. |
| D30-18b | Quản lý kiểm tra khắc phục | 1076:11827 | Đạt → bỏ khoản khấu trừ hư hỏng; không đạt → ghi lý do. |
| D30-10 | Quản lý xử lý sự cố cơ sở | 1051:12926 | Đề xuất ô tương đương, hoàn tất chuyển hoặc kết thúc theo lựa chọn khách. |
| D30-16 | Khách chọn phương án sự cố | 1053:13267 | Chấp nhận chuyển ô hoặc kết thúc, hoàn theo D32. |
| D30-16b | Trạng thái khách sau chuyển ô | 1077:11925 | Mã ô mới, kỳ thuê/giá giữ nguyên; mã cũ chỉ vô hiệu khi quản lý hoàn tất. Đây là trạng thái của luồng, không bắt buộc một Page riêng. |

CSV `screens.csv` liệt kê từng frame trong 163 frame và file/route tương ứng. “Có code/route” chỉ là bằng chứng có triển khai chức năng, không xác nhận UI khớp pixel, mọi trạng thái đã có hay API hoạt động. Các popup chọn cơ sở/đổi vai trò Admin mới có chức năng tương ứng nhưng bố cục cần đồng bộ; không tính thêm thành trang nghiệp vụ mới.

## Kiểm tra ba ZIP và sửa trong Batch04

| Phần | Kết quả / thay đổi |
|---|---|
| Tính cộng dồn | Batch03 chứa phần 01–02; chỉ ghép một lần. Phần code áp dụng lên main được; nhật ký phải giữ bản mới. |
| C06/C14/C07/C11/C11h/C11k | Giữ layout, route và popup của các batch; giữ khấu trừ trong cọc và không thu công nợ sau trả kho. Không khẳng định đã duyệt visual toàn bộ. |
| C08 / T20 | Bỏ capability đề xuất `renewalConsentSupported`; API main không có cờ này. Gửi `{renewalPeriodMonths, policyVersion: number, accepted: true}`. Đọc evidence từ `policyVersion`, `acceptedAt` cấp ngoài cùng. Thiếu evidence thì báo chưa xác nhận và không tự POST lại. |
| Theo dõi gia hạn | Giữ PAID/EXPIRED, hạn thanh toán và bằng chứng; nhận CASH từ payment. Hết hạn không bị biến thành chờ duyệt, không mở QR/quầy cho khoản hết hạn. Chặn yêu cầu mới khi còn gia hạn đã duyệt chưa trả. |
| A02 đăng ký | Username riêng, gửi đúng trường backend đã có; giữ đăng nhập email/username. Validation, lỗi trùng chung và chống gửi lặp. D33 ghi thay thế phần username=email. |
| C13 tài khoản | Hiện username chỉ đọc; giữ form tên/mật khẩu và các kiểm tra cũ. |
| B03/B03a | Chọn cơ sở bằng thẻ có ảnh → đúng 4 loại kho → sửa giá/ngày áp dụng → xác nhận/kết quả. Lọc mức giá đúng cơ sở, loại kho, thời gian; không lấy giá tương lai hoặc của cơ sở khác. Lỗi/huỷ giữ form. Giá minh hoạ Figma không đưa vào code. |
| Asset | Ảnh cơ sở dùng mapping D06 hiện có. Bốn ảnh kho xuất riêng từ các node 1154:12052/12054/12056/12058, JPEG 180×228; không dùng ảnh chụp cả UI. |
| Trả kho / huỷ có hoàn | Giữ ngân hàng chính chủ/ảnh, chống gửi lặp và chặn server chưa có hợp đồng T08. Đây là blocker tích hợp thực tế, không bật cờ giả. |
| Theo dõi hoàn | Giữ Chờ hoàn/Đã hoàn, che số tài khoản, không biến thiếu dữ liệu thành 0đ hoặc PENDING thành đã chuyển. API khách `/api/deposit-refunds` vẫn chưa có trên main đã kiểm. |

## Chia 7 phiên, gồm phiên hiện tại

| Phiên | Phạm vi | Điều kiện bàn giao |
|---|---|---|
| **1 — Batch04 hiện tại** | Rà ba ZIP, ghép main, A02/C13, B03/B03a, C08 và trạng thái gia hạn | Patch có kiểm tra áp dụng; test FE/mapper/DTO/render/build; công khai giới hạn browser/API. |
| 2 | C04a + C15/C15b, bằng chứng chính sách từ đặt chỗ đến thanh toán tại quầy | Khách tự đồng ý; version/server timestamp đúng; không trả tiền khi chưa lưu; policy đổi báo đọc lại. |
| 3 | D30-13/D30-18/D30-18b: hư hỏng và khắc phục | Phân quyền, ảnh/biên bản, lý do, deadline; đạt thì bỏ khấu trừ, lỗi giữ dữ liệu. |
| 4 | D30-10/D30-16/D30-16b: sự cố cơ sở | Khách chọn; chuyển ô giữ kỳ/giá; mã cũ/mới đổi đúng thời điểm; kết thúc hoàn đúng D32. |
| 5 | Nhân viên/Quản lý: kiểm kê, ngày 20, M07, hoàn cọc/hoàn đơn, xác minh/chìa khoá | Nối T05–T08/T11–T13 theo backend sẵn sàng; hai bước hoàn tiền; MAINTENANCE đúng; xác nhận/lỗi/thành công. |
| 6 | Vận hành/Admin và rà popup trên mọi vai trò | Chọn cơ sở/đổi vai trò/cấp lại vai trò, B02/B05/báo cáo; popup chuẩn; lỗi/rỗng và menu theo role. |
| 7 | Browser và tích hợp toàn luồng | 1440/768/390, bàn phím, reload/retry/gửi lặp, phân quyền/cơ sở, SQL Server và PayOS thử thực tế. Thành viên review trước merge. |

Ước lượng 7 phiên là cách chia phạm vi để kiểm và bàn giao, không cam kết thời lượng. Còn 6 phiên sau gói này. Nhiều tác vụ phụ thuộc backend nên không thể lấy build FE để kết luận xong hệ thống.

## Mâu thuẫn và blocker cần giữ rõ

- C15b đang ghi “bản mới hơn không thay đổi hợp đồng đã ký”, trong khi D32 áp dụng chính sách D32 cho mọi hợp đồng đang chạy. Phải phân biệt việc lưu version khách đã đồng ý với phạm vi áp dụng D32; không tự đảo quyết định chỉ để chép chữ Figma. Trước phiên 2 cần chốt lại wording/phạm vi; Batch04 không triển khai cách hiểu mới.
- T08 chưa có DTO ngân hàng/ảnh tương ứng trên main: trả kho/huỷ có hoàn vẫn bị FE chặn đúng chủ ý. Không gọi server cũ rồi báo đã lưu ảnh/ngân hàng.
- T20 gia hạn có code BE, nhưng RenewalService hiện có hai lần SaveChanges cho yêu cầu và consent, chưa transaction chung; cần BE owner kiểm atomicity/idempotency. Task này chỉ sửa FE theo DTO đã merge.
- C04a chưa nối `POST /api/reservations/{id}/policy-consent`; hợp đồng chưa trả evidence policy trong ContractDto. Không khẳng định toàn luồng đặt chỗ đã đạt D32.
- Chưa kiểm browser (tải Chromium lỗi archive), API thật, SQL Server, PayOS/thiết bị cửa. Cảnh báo bundle >500KB còn.

## Kiểm chứng gói hiện tại

- `TZ=Asia/Ho_Chi_Minh npm test`: **103/103**.
- `npm run test:business`: **9/9**; `npm run test:workflows`: **12/12**.
- `npm run test:render`: **119 route + assertions** (có username và gia hạn hết hạn); không thay kiểm browser.
- `npm run check:structure`, `npm run build`, `bash init.sh --fe-only`, `git diff --check`: đạt trong môi trường bàn giao.
- Test mới kiểm chọn giá/loại kho, username, payload T20, acknowledgement, mapper PAID/EXPIRED/deadline và SSR. Fixture validation đổi có lý do: username mới là trường bắt buộc; không bỏ kiểm tra các trường cũ.
- Bản vá bàn giao được kiểm trên 4 nền: main, main+Batch01, main+Batch02, main+Batch03 (giữ progress mới), áp dụng và so byte toàn bộ file tác động.

F40 giữ active, F41 giữ blocked. Không tự nhận feature passing hoặc tuyên bố kiểm thử backend thật.


## Checkpoint Batch05 — phiên 2

C04a và C15/C15b đã có FE/adapter, xem `../sprints/FE-figma-sync-05.md`. C15b evidence ban đầu và server enforcement vẫn chờ BE; không coi T20 tích hợp xong. Còn 6 màn/nhánh chưa có FE (D30-13/18/18b, D30-10/16/16b), cùng các màn có code vẫn cần kiểm visual/API. CSV được cập nhật trạng thái mới; phần 8 màn phía trên là kết quả ở thời điểm Batch04. Còn 5 phiên tiếp theo.


## Checkpoint Batch06 — phiên 3

D30-13/18/18b đã có FE và adapter đề xuất, xem `../sprints/FE-figma-sync-06.md`. API chưa có trên main: lỗi báo rõ, demo tách riêng không thay quyết toán thật. Bỏ deduction chỉ khi inspection PASS, không xác nhận chuyển tiền/mở QR/PIN. Chưa browser/visual hoặc API thật; F40 active/F41 blocked giữ nguyên. Còn 3 màn/nhánh chưa có FE trong danh mục ban đầu: D30-10/16/16b; còn 4 phiên tiếp theo. Các số liệu/tables Batch04–05 phía trên là lịch sử kiểm kê, CSV đã cập nhật Batch06.


## Checkpoint Batch07 — phiên 4

D30-10/16/16b có FE/state qua manager/incidents và units/:id/incident; xem sprint07. Cả 8 màn/nhánh thiếu FE ở thời điểm Batch04 đã có triển khai tương ứng qua Batch05–07. Đây không phải xác nhận khớp pixel hoặc tích hợp hoàn tất: T13, evidence và các API khác còn chờ, chưa browser/SQL Server/thiết bị cửa thật. F40 active/F41 blocked giữ nguyên. Còn 3 phiên theo kế hoạch (Batch08–10). CSV đã cập nhật trạng thái; các bảng/số đếm cũ ở trên là lịch sử kiểm kê.
