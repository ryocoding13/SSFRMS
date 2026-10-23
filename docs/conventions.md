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
- **Schema**: sửa Entity + Configuration → `dotnet ef migrations add <TenMoTa> --project StorageProject.Infrastructure --startup-project StorageProject.Api`. Không sửa migration đã merge hoặc áp dụng trên DB dùng chung. Migration chưa chia sẻ được chỉnh trên nhánh riêng; giữ model/snapshot đồng bộ. Không tự reset database.
- Dữ liệu khởi tạo thêm vào `DbSeeder` theo kiểu chạy lại được (chỉ thêm phần thiếu).
- Endpoint mới: thêm request mẫu vào `StorageProject.Api.http` và cập nhật `BE-CONTRACT.md`.

## Frontend (React + Vite)

- Không có TypeScript, không có thư viện UI/CSS ngoài. Style dùng class + token trong `src/shared/styles/ss.css`; không hard-code màu.
- Màn mới: `src/features/<vai-tro>/<chuc-nang>/<Ten>Page.jsx`; đọc bắt buộc `docs/frontend-naming.md` và `FRONTEND-MAP.md` ở thư mục FE. Mỗi file một màn hình; cập nhật route tại `src/app/App.jsx` hoặc `<Role>Routes.jsx`.
- Page **không gọi fetch trực tiếp**: gọi lệnh qua store → `appReducer.js` (chế độ trình duyệt) hoặc `ApiProvider` → `src/shared/api/*`.
- Dữ liệu backend đi qua `src/shared/api/apiMappers.js` trước khi tới component. Nhãn trạng thái lấy từ `src/shared/utils/status.js`.
- Tiền và ngày định dạng bằng `src/shared/utils/format.js`. Ngày từ backend coi là UTC (D10).
- Text/bố cục bám Figma; nghiệp vụ/quyền theo quyết định nhóm hiện hành. Mock/offline phải nhận biết khi kiểm thử; API lỗi không được giả thành công (PROCESS-2026-10-24).
- Ảnh: file trong `public/images/`, gán qua `src/app/config/media.js` (D06).
- Nghiệp vụ mới trong `appReducer.js` phải có test trong `tests/reducer.test.js`.

## Git

- Thành viên dùng nhánh `feature/`, `fix/`, `docs/` hoặc `chore/` → PR vào `main`; không push thẳng main.
- Thành viên tự commit/push/tạo PR/merge sau khi kiểm tra. Ví dụ commit: `feat(F05): gửi yêu cầu gia hạn`.
- AI không tạo commit/push/PR/merge hoặc đổi thông tin tác giả/cấu hình danh tính Git. Không sửa lịch sử để thay danh tính.
- Không commit `node_modules/`, `dist/`, `bin/`, `obj/`, `.env.local` hoặc cấu hình chứa bí mật thật.
- Cho phép `.env.example`, `appsettings.json` và cấu hình dùng chung không chứa bí mật; không đưa secret vào `VITE_*`.
- Mỗi PR có mục tiêu rõ; được sửa phần phụ thuộc cần thiết, không mở rộng ngoài task. Review bởi thành viên khác trước merge.
- Dùng `docs/verification.md` để chọn kiểm tra. Task chỉ tài liệu không cần build/test ứng dụng.
