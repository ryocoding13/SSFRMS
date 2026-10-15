# Frontend Quản lý vận hành KD

Bản này được làm trên `SSFRMS(1).zip`, chỉ thêm/sửa frontend. Tất cả source .NET, cấu hình DB,
seeder và migration giữ nguyên so với ZIP đầu vào.

## Xem giao diện ngay, không cần backend hoặc SQL Server

Mở thư mục `SSFRMS` trong VS Code, chạy:

```powershell
cd SafeSpace-Customer-UI/SafeSpace-Customer-UI
npm ci
npm run dev:business
```

Mở địa chỉ Vite in ra (thường `http://127.0.0.1:5173/#/login`).
Tài khoản kiểm tra frontend: **ops01 / Ops@123**. Đăng nhập tự vào `#/business`.
Bấm tên góc phải để Đăng xuất. Khi chạy lệnh này, các request HTTP dùng máy chủ giả lập
trong bộ nhớ ở cổng 5199; tắt tiến trình thì các thay đổi thử nghiệm không được giữ lại.
Không chạy `dotnet` để kiểm tra frontend ở chế độ này.

Nếu cổng API 5199 bị chiếm:

```powershell
$env:MOCK_API_PORT=5299
npm run dev:business
```

PowerShell chặn npm.ps1: thay `npm` bằng `npm.cmd`.

## Nối API thật khi backend phát triển xong

```powershell
$env:VITE_USE_API="true"
$env:VITE_API_URL="http://localhost:5151"
npm run dev
```

`npm run dev` dùng API thật theo cấu hình, không tự chuyển sang dữ liệu giả lập.
API đăng nhập chung `/api/auth/login` phải trả JWT có role `OPERATIONS`.
Không thêm tài khoản vào DB và không thay đổi backend để chạy frontend.

## Màn hình

| Route | Nội dung |
|---|---|
| `#/business` | B01 tổng quan hệ thống, thẻ số liệu, bảng cơ sở và 3 nút điều hướng |
| `#/business/facilities` | B05 chọn cơ sở, xem thông tin, mở báo cáo của cơ sở |
| `#/business/policies` | B02 đủ 8 ô trong 4 nhóm; sửa, kiểm tra, lưu và tải lại |
| `#/business/pricing` | B03 sửa khung giá/phí theo loại kho, thêm quy tắc giảm giá, lưu |
| `#/business/reports` | B04 4 tab báo cáo, biểu đồ/bảng, xuất XLSX |

Giữ bố cục theo Figma. Tên, số lượng cơ sở/loại kho, giá và ngày lấy từ API nên có thể khác hình minh hoạ.
Không bổ sung nút CRUD cơ sở hoặc bảng giá ngoài các màn Figma.

## API và giới hạn hợp đồng

Lớp API duy nhất của khu này là `src/api/business.js`; sử dụng đúng `/api/operations/*`
trong file `operations-api(3).md` và JWT của store đăng nhập chung.

- Chính sách đang ACTIVE: tạo DRAFT mới, kích hoạt; gặp 409 phải xác nhận rồi mới gửi `replaceExisting=true`.
  Nếu huỷ, bản nháp còn trên server, chính sách cũ không bị thay thế.
- API chỉ cho một chính sách cùng type/phạm vi có hiệu lực tại một thời điểm. Vì vậy các thông tin phụ ở B02
  (số lần gia hạn, thời gian kiểm tra sau trả, ân hạn) được lưu thành các dòng có nhãn trong `ruleDescription`
  của cùng chính sách RENEWAL/RETURN/OVERDUE. Không tự thay đổi quy tắc xung đột của backend.
- Các dòng chữ là hướng dẫn; frontend không tự thi hành khoá truy cập hay tính phạt ở các role khác.
- Nếu API chưa có chính sách tương ứng, ô hiện “Chưa thiết lập”. Không bịa số liệu trong chế độ API thật.
- Tài liệu chưa đảm bảo `managerName`; nếu không có trường này, cột Quản lý hiện “Chưa có thông tin”.
  Nếu backend trả tên quản lý, giao diện sử dụng trực tiếp.
- API báo cáo cung cấp `overdueContracts`, không có số ô kho quá hạn riêng. Giao diện ghi rõ “Hợp đồng quá hạn”,
  thay vì đổi nhãn rồi đánh đồng hai chỉ tiêu.
- Xuất theo cơ sở/loại kho/doanh thu: gọi endpoint CSV rồi chuyển thành XLSX OOXML thật tại trình duyệt.
  Tab tình trạng thuê xuất snapshot vừa tải; không gọi một endpoint xuất trạng thái không có trong tài liệu.
- Khi tải lỗi có nút Thử lại. 401 kết thúc phiên và về đăng nhập; 403 hiện lỗi phân quyền, không tự vượt quyền.

## Kiểm tra

```powershell
npm test
npm run test:business
npm run test:render
npm run build
```

Các lệnh này không cần .NET hoặc SQL Server. Xem `BUSINESS_FRONTEND_REVIEW.md` để đọc kết quả kiểm chứng.
