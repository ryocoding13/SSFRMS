# Quy ước code

## Chung

- Giao diện, thông báo lỗi cho người dùng, tài liệu: **tiếng Việt**. Tên biến/hàm/endpoint/bảng: **tiếng Anh**.
- Sửa ít file nhất có thể cho tính năng đang làm. Không đổi tên, không format lại file không liên quan.
- Không thêm thư viện mới khi chưa ghi lý do vào `DECISIONS.md`.

## Backend (.NET)

- **Endpoint**: file `StorageProject.Api/Endpoints/<Tên>Endpoints.cs`, hàm mở rộng `Map<Tên>Endpoints`,
  `MapGroup("/api/...")`, `.WithTags(...)`, `.RequireAuthorization()` (thêm policy vai trò khi cần).
- Endpoint mỏng: lấy `userId` bằng `user.GetUserId()`, gọi service, map kết quả sang `Results.Ok / Created / BadRequest / NotFound`.
- Lỗi nghiệp vụ: service ném `ArgumentException` hoặc `InvalidOperationException` với thông điệp tiếng Việt;
  endpoint bắt và trả `400 { error }`. Sai mật khẩu không trả 401 (giao diện coi 401 là hết phiên).
- **Service**: interface trong `Core/Interfaces/IServices.cs`, cài đặt trong `Infrastructure/Services/`, primary constructor
  `(AppDbContext dbContext)`, luôn nhận `CancellationToken ct`. Truy vấn đọc dùng `AsNoTracking()` và `Select` thẳng ra DTO.
- Luôn kiểm tra **quyền sở hữu / phạm vi cơ sở** trong service trước khi đọc/ghi (BR05, BR12).
- Thao tác nhiều bảng: bọc trong transaction (`dbContext.Database.BeginTransactionAsync`).
- **DTO**: `record` trong `Core/DTOs/<Nhóm>/<Nhóm>Dtos.cs`. Không trả entity ra ngoài.
- **Schema**: sửa Entity + Configuration → `dotnet ef migrations add <TenMoTa> --project StorageProject.Infrastructure --startup-project StorageProject.Api`. Không sửa migration cũ.
- Dữ liệu khởi tạo thêm vào `DbSeeder` theo kiểu chạy lại được (chỉ thêm phần thiếu).
- Endpoint mới: thêm request mẫu vào `StorageProject.Api.http` và cập nhật `BE-CONTRACT.md`.

## Frontend (React + Vite)

- Không có TypeScript, không có thư viện UI/CSS ngoài. Style dùng class + token trong `src/styles/ss.css`; không hard-code màu.
- Màn mới: `src/pages/<Tên>.jsx`, thêm route trong `CustomerApp.jsx` (hoặc `admin/AdminApp.jsx`) và dòng tương ứng
  trong `CUSTOMER-FLOW-COVERAGE.md` / `ADMIN-FLOW-COVERAGE.md`.
- Page **không gọi fetch trực tiếp**: gọi lệnh qua store → `reducer.js` (chế độ trình duyệt) hoặc `ApiProvider` → `src/api/*`.
- Dữ liệu backend đi qua `src/api/mappers.js` trước khi tới component. Nhãn trạng thái lấy từ `src/lib/status.js`.
- Tiền và ngày định dạng bằng `src/lib/format.js`. Ngày từ backend coi là UTC (D10).
- Text lấy đúng từ Figma. Không có chữ "demo", "sample", "dữ liệu mẫu" (D07).
- Ảnh: file trong `public/images/`, gán qua `src/config/media.js` (D06).
- Nghiệp vụ mới trong `reducer.js` phải có test trong `tests/reducer.test.js`.

## Git

- Nhánh `feature/<tên>` → PR vào `main` (D08). Commit: `feat(F05): gửi yêu cầu gia hạn 1/3/6 tháng`.
- Không commit: `node_modules/`, `dist/`, `bin/`, `obj/`, `.env.local`, `appsettings.*.json`.
