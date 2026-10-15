# Kết quả triển khai frontend Quản lý vận hành KD

Nguồn mới: `SSFRMS(1).zip` và `operations-api(3).md` do người dùng cung cấp.
Thiết kế: Figma SafeSpace - Modern UI, section 436:13803, B01–B05.

## Phạm vi

Chỉ frontend: 5 màn KD trong `src/business/`, lớp API, assets riêng, mock HTTP dùng khi phát triển,
kiểm thử và phần nối role/route/session tối thiểu để OPERATIONS đăng nhập vào đúng khu.
Không sửa source .NET, database, migrations, seeder, DTO, API endpoint hay cấu hình backend.

`src/ops`, `src/admin`, `src/components`, `src/styles/ss.css` và các trang nghiệp vụ khác giữ nguyên byte.
Các file chung được sửa giới hạn: CustomerApp.jsx (route/guard KD), roles.js (home OPERATIONS),
store.jsx (chấp nhận role và tránh tải dữ liệu CUSTOMER cho OPERATIONS), Auth.jsx (điều hướng role KD).
Điều kiện cũ cho CUSTOMER, STAFF, MANAGER, ADMIN được giữ nguyên.

## Các màn đã triển khai

| Màn | Kết quả |
|---|---|
| B01 | Header, logo/chuông gốc, 5 tab, 4 thẻ số liệu, bảng cơ sở và các nút điều hướng |
| B02 | 8 ô chính sách trong 4 nhóm, xác thực đầu vào, lưu qua API, xác nhận 409 và tải lại |
| B03 | Bảng sửa khung giá/phí theo loại kho, danh sách quy tắc, thêm quy tắc giảm giá/miễn phí, lưu |
| B04 | 4 tab báo cáo, biểu đồ/bảng, tải XLSX OOXML hợp lệ |
| B05 | Chọn cơ sở, xem thông tin, xem báo cáo cơ sở tương ứng |
| Chung | Tên tài khoản, đăng xuất, thông báo, trạng thái tải/rỗng/lỗi, thử lại, 401/403, mobile |

Giữ bố cục theo Figma, không cố định tên, ngày, giá hoặc số lượng cơ sở khi gọi API thật.
Các hình minh hoạ Figma và dữ liệu API có thể khác nhau. Không chèn ảnh chụp Figma vào giao diện.
Hai SVG logo/chuông giữ đúng kích thước 36x36 và 44x44; font Manrope cục bộ có kèm giấy phép.
CSS mới chỉ tác động dưới `.business-app`.

## Theo đúng hợp đồng API, không sửa backend để phục vụ frontend

1. Gọi `/api/operations/*` qua `src/api/business.js`, dùng JWT của phiên đăng nhập chung.
2. 8 ô B02 được ánh xạ thành 5 policy type. Những quy định phụ lưu thành các dòng có nhãn trong
   ruleDescription của cùng policy, không tạo nhiều policy cùng type/scope rồi tự ghi đè.
3. API trả 409 thì phải có xác nhận trước khi replaceExisting=true. Huỷ thì giữ chính sách cũ,
   bản mới là DRAFT; không báo đã áp dụng.
4. Tài liệu chưa đảm bảo managerName: không có thì hiện Chưa có thông tin. Không bịa người quản lý.
5. API chỉ trả overdueContracts: ghi rõ Hợp đồng quá hạn, không đánh đồng với số ô kho quá hạn riêng.
   Đây là điều chỉnh nhãn có chủ đích theo dữ liệu API, thay cho nhãn Kho quá hạn trong Figma.
6. Backend xuất CSV; frontend đóng gói thành XLSX thật. Tab tình trạng dùng snapshot hiện đang xem,
   vì tài liệu không có endpoint xuất CSV trạng thái.
7. Không tự thi hành các quy định chữ như khoá truy cập, ân hạn, giới hạn gia hạn ở role khác.

## Kiểm chứng

| Kiểm tra | Kết quả |
|---|---|
| Bộ test gốc `npm test` | 38/38 PASS |
| Test mới `npm run test:business` | 8/8 PASS: role, phạm vi/hiệu lực, 8 ô/5 policy type, tiền/tháng/ngày, giữ giá trị khác trong cùng policy, XLSX/CSV, JWT/query/body, 401/403/409, huỷ/xác nhận thay thế |
| `npm run test:render` | 76 route PASS (giữ nguyên bộ render cũ) |
| `npm run build` | PASS |
| init.sh --fe-only | PASS qua bản tạm bỏ CRLF trên Linux; không sửa init.sh gốc |
| Trình duyệt Chromium | 13 nhóm kiểm tra PASS; không có pageerror |
| Assets | Đã kiểm tra file cục bộ, callsite, kích thước thực tế 36/44 px |
| Tệp XLSX | 4 tệp tải từ trình duyệt đọc được bằng openpyxl; tiếng Việt và cấu trúc workbook hợp lệ |
| Hồi quy 14 màn role khác | Nội dung và ảnh từng pixel giống bản ZIP gốc sau khi dữ liệu tải xong |
| Backend/database | Đối chiếu byte source/config với ZIP gốc, không thay đổi |

13 nhóm trình duyệt gồm: hồi quy role khác; 5 tab KD; assets; lưu/tải lại 8 ô và từ chối đầu vào sai;
sửa giá/phí và từ chối khoảng giá sai; quy tắc mới và xác nhận 409; chọn cơ sở/drilldown;
4 view và tải XLSX; đăng xuất/xoá session; chặn CUSTOMER; 5 màn mobile không tràn ngang;
lỗi API/thử lại; JWT hết hạn về đăng nhập.

14 route so sánh: CUSTOMER overview/units/reservations/payments/support;
STAFF staff/reconcile/support; MANAGER manager/units/report; ADMIN admin/users/logs.
So sánh dùng cùng dữ liệu HTTP ở hai bản frontend trước/sau để tránh nhầm khác biệt dữ liệu thành lỗi CSS.

## Cách chạy

Đọc `BUSINESS_FRONTEND_README.md`. Dùng `npm run dev:business` để kiểm tra ngay mà không cần .NET/SQL Server.
Khi backend sẵn sàng, đổi VITE_API_URL và dùng `npm run dev` để gọi server thật.

Các kiểm tra tích hợp hiện dùng mock HTTP ở frontend theo tài liệu, không xác nhận backend hoặc DB thật.
Không thay đổi hay sửa lỗi build .NET trong phạm vi công việc này.
