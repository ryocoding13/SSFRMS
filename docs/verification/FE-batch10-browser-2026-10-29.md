# SafeSpace FE Batch10 — bằng chứng và giới hạn ngày 29/10/2026 (Việt Nam)

## Nền và tính toàn vẹn

Repo ryocoding13/SSFRMS, HEAD c1a9b05b67a96972cbf44d039b9acb4e15307781. Khôi phục đúng gói SafeSpace-Figma-FE-Batch09.zip đã chỉ định, SHA-256 `45698710691ba1348db454770a132b25754082ce88524ea1727149e6dedd688e`. Bản tải lại trùng ZIP/checkpoint hiện có;143 file trong files/ trùng byte source đang làm trước sửa. Không ghi đè hay bỏ các phần Batch01–09. Không commit/push/PR/merge, không sửa backend/schema/Figma hoặc trạng thái feature. F40 active/F41 blocked giữ nguyên.

Đọc lại AGENTS gốc/FE, DECISIONS, feature_list, progress, FRONTEND-MAP, BACKEND-TODO, naming/conventions/verification và sprint04–09. Áp D26/D32/D33. Không gọi Figma trong phiên này: dùng kiểm kê và mapping đã ghi ở các sprint trước; không tuyên bố so pixel với file thiết kế mới nhất trong lượt29/10.

## Lỗi FE đã sửa

1. Modal phụ thuộc callback onClose khiến effect cleanup/focus lại sau rerender; nhập liên tục có thể mất focus. Sửa bằng ref callback và effect theo vòng đời mount.
2. Các modal cùng nghe Escape/Tab khiến popup lồng xử lý lẫn nhau. Chỉ modal trên cùng nhận bàn phím/focus/backdrop; Tab bỏ control hidden/disabled (kể cả fieldset disabled), phục hồi focus đúng trigger, khóa body đến khi modal cuối đóng. General modal giới hạn chiều cao và cuộn nội dung dài.
3. Xuất báo cáo ở768px bị select cơ sở vượt cột. Thêm CSS phạm vi report-export cho input/select co đúng cột, không che overflow toàn trang để giấu lỗi.

Đã tạm khôi phục riêng UI.jsx gốc Batch09 và chạy2 test focus/drawer tại390px: **2 FAIL tái hiện lỗi**. Sau đó phục hồi bản sửa trong finally. Bản cuối qua cả45 ca. Các lần xây test có lỗi selector/đợi điều hướng và giả định vị trí header do banner demo; đã sửa test để chờ đúng h1/route, dùng trigger ổn định và tạo vùng cuộn riêng cho trang ngắn. Không sửa nghiệp vụ hay bỏ assertion overflow. Một lỗi parse trong lúc chỉnh Modal đã sửa trước kiểm cuối.

## Môi trường

Linux, Node24.22.1/npm11.9.0, dependencies đã có từ checkpoint, không đổi dependency/lockfile. Playwright của repo, Chrome Headless Shell156.0.8078.73 tải từ nguồn Chrome for Testing chính thức. Cài browser mặc định qua CDN trả HTML thay ZIP; Chrome desktop tải được nhưng launch bị lỗi socket trong môi trường. Headless Shell chạy được, không dùng kết quả launch lỗi làm PASS.

Các ảnh browser được xem nội bộ ở desktop/mobile/tablet; không nằm trong gói bàn giao. Screenshot chỉ hỗ trợ xem bố cục, không phải kiểm visual regression pixel với Figma. Suite Batch10 đặt timezone Asia/Ho_Chi_Minh và locale vi-VN; native date picker vẫn phụ thuộc trình duyệt. Không kiểm Firefox/WebKit, bàn phím phần mềm iOS/Android hoặc screen reader thật.

## Kết quả thực thi

| Lệnh | Kết quả | Loại bằng chứng |
|---|---|---|
| npm test |155 PASS,0 FAIL,0 skip | Node FE/model/API helper; có mock/stub |
| npm run test:business |9 PASS | FE business |
| npm run test:workflows |12 PASS | FE workflow model |
| npm run test:render |173 lượt PASS | SSR, không thay browser |
| npm run check:structure |PASS | Cấu trúc/đặt tên |
| npm run build |PASS | Vite; còn cảnh báo chunk>500kB có sẵn |
| npm run test:batch10 |45 PASS (15 nhóm ×3 viewport1440/768/390) | Chromium thực thi; demo/route stub |
| npm run test:auth-support |14 PASS | Chromium thực thi; route stub DTO auth/support |
| git diff --check |PASS trên thay đổi tracked hiện tại | Không thay kiểm whitespace của file mới/staged trên máy người dùng |

Đã chạy lại structure/SSR/build sau sửa CSS và file test cuối. Không chạy lại init riêng: các bộ FE cần thiết đã chạy trực tiếp. Không chạy dotnet/test SQL vì thiếu môi trường. Không ghi số test lịch sử backend thành kết quả phiên này.

## Browser Batch10 bao phủ gì

- 25 route trong5 vai trò ×3 viewport; đợi đúng h1/URL, không pageerror, không document overflow ngang. Header sticky kiểm bằng vùng cuộn thêm trong test cho trang ngắn; nav mobile có cuộn ngang nội bộ là chủ đích, không phải toàn trang tràn.
- Popup nhập liên tục không mất focus; Tab/Shift+Tab bỏ hidden/disabled, focus trả trigger; drawer40 lựa chọn có scroll; Escape đóng trên cùng, body giữ khóa khi còn popup. Saving chặn Escape/backdrop.
- Admin bảng quyền không checkbox chỉnh quyền; chọn cơ sở chưa có mặc định, hủy không áp lựa chọn, xác nhận mới áp. Role-change lỗi404: đúng1 POST, không assign/revoke nối tiếp, giữ vai trò cũ và drawer; Enter/Escape khi saving không gửi lặp/đóng.
- Customer bị chặn giao diện admin/manager/business. Response PUT profile cũ trả sau khi logout/login customer khác không ghi đè hồ sơ/phiên mới.
- Lỗi503 catalog có retry, không biến thành bảng dữ liệu thành công. Hồ sơ hư hỏng khác facility bị lọc khỏi giao diện manager dù có trong fixture; không phải chứng minh server đã chống truy cập chéo cơ sở.
- Shared file input từ chối PNG giả, nhận/xem trước/xóa PNG hợp lệ. Đây là chọn tệp và validate/preview FE, chưa upload/persist evidence ở backend thật.
- CSV cancel không request tải; scope bị khóa khi xác nhận; HTML200 bị từ chối; retry CSV tạo browser download, tên tệp đúng và công thức được escape. DTO và CSV test được stub rõ, không chứng minh report service thật trả đúng dữ liệu.
- Bộ auth-support14 ca hiện có bổ sung kiểm validation, gửi lặp/giữ form lỗi, profile reload, password payload, support thread/staff reply,401 và response trễ. Password thay đổi chỉ trong stub, không đổi tài khoản thật.

Các nhóm không kiểm đầy đủ mọi trạng thái của163 frame Figma; không xác nhận tất cả popup/màn/API đều không lỗi. Luồng bank/return/settlement/incident qua server chưa có bằng chứng thực. Mock demo và dữ liệu local của các hồ sơ độc lập không phải một transaction xuyên backend.

## Blocker tích hợp thật

Read-only probe `http://127.0.0.1:5151/api/facilities`: connection refused/HTTP000. Không có dotnet, Docker, sqlcmd hoặc PowerShell trong PATH; không có môi trường SQL Server/PayOS/cửa kho được cấu hình cho lượt này. Không tự chạy migration/reset DB, không sửa BE/schema.

- Consent gốc trên đơn/hợp đồng và server enforcement trước QR/quầy; đọc lại trên thiết bị khác; policy/renewal đồng thời, expiry/idempotency.
- Checklist S02, ảnh/phí/bank trả kho, proof hoàn tiền, deposit-refunds/overdue, marker/readback theo Batch08 cần BE thực hiện thật.
- Damage/remediation và incident T13 còn API đề xuất, cần persistence/transaction/authorization/version/idempotency; đổi credential và bỏ deduction phải do server thực hiện nguyên tử.
- Atomic role-change chưa có; legacy PermissionCode mutation cần BE rà theo D32. Last-active-admin, assignment đồng thời và token/session bị gỡ quyền chưa kiểm thật.
- Scheduled publication metadata/effective date/change note chưa có; FE hiện chỉ dùng API công bố ngay, không giả lưu lịch.
- SQL Server thật, PayOS thật, ảnh private, ngân hàng và scanner/thiết bị không được kiểm. Không thể kết luận toàn hệ thống hoàn tất/đủ điều kiện merge từ59 ca browser dùng giả lập.

## Bàn giao và quan hệ7 phiên

Phiên1=Batch04,2=05,3=06,4=07,5=08,6=09,7=10. Nguồn Batch01–03 nằm trong phiên1. Patch04 main rồi05 after04…09 after08 đã được tái áp từ export sạch main và so từng file với checkpoint; không tạo commit để làm phép kiểm này. Bước10 áp/byte-match và manifests nằm trong báo cáo gói bàn giao.

ZIP có after-batch09.patch, main.patch, files/ (nội dung đầy đủ các file thay đổi, không phải clone repo độc lập), chain7 patch, manifest/checkpoint, script chỉ kiểm/áp patch, hướng dẫn PowerShell và7 mô tả PR. Không chứa dependencies/build/browser binary/credentials/screenshot. PowerShell chưa thực thi trên Windows; cần thành viên kiểm tại máy thật. Các lệnh commit/push trong hướng dẫn là để người dùng tự chạy sau review.
