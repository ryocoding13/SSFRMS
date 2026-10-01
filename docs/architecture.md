# Kiến trúc SSFRMS / SafeSpace

## Tổng quan

```
Trình duyệt (React 19 + Vite, hash router)
  ├── Khu khách hàng   #/home, #/find, #/find/map, #/overview, #/units, #/payments, #/support, #/profile …
  ├── Khu nhân viên    #/staff/*   (vai trò STAFF)
  ├── Khu quản lý      #/manager/* (vai trò MANAGER)
  └── Khu quản trị     #/admin/*   (chỉ vai trò ADMIN, chỉ chế độ API)
        │  fetch + Bearer JWT   (VITE_API_URL, mặc định http://localhost:5151)
        ▼
StorageProject.Api        .NET Minimal API — Endpoints/*Endpoints.cs, JWT, Swagger (/index.html), /health
        │  gọi interface trong Core
        ▼
StorageProject.Infrastructure   Services/*Service.cs (nghiệp vụ), AppDbContext (EF Core), DbSeeder, Migrations
        │
        ▼
SQL Server (mặc định .\SQLEXPRESS, database SSFRMS)

StorageProject.Core       Entities (25 bảng theo Data Dictionary), DTOs, Interfaces/IServices.cs
```

## Backend — một request đi qua đâu

1. `Endpoints/XxxEndpoints.cs`: nhận request, lấy `userId` từ JWT (`ClaimsPrincipal.GetUserId()`), gọi service.
2. `Core/Interfaces/IServices.cs`: khai báo `IXxxService`.
3. `Infrastructure/Services/XxxService.cs`: kiểm tra quyền sở hữu, nghiệp vụ, truy vấn EF Core, trả DTO.
4. Lỗi nghiệp vụ: service ném `ArgumentException` / `InvalidOperationException` → endpoint trả `400 { error }`.
5. Đăng ký service trong `Program.cs`; map endpoint bằng `app.MapXxxEndpoints()`.

Khi khởi động, `DbSeeder` tạo vai trò, quyền, 12 cơ sở, loại kho, bảng giá, tài khoản seed. Chạy lại được (chỉ thêm phần thiếu).

## Frontend — hai chế độ dữ liệu

`src/state/store.jsx` chọn provider theo `VITE_USE_API`:

| Chế độ | Khi nào | Dữ liệu |
|---|---|---|
| `ApiProvider` | `VITE_USE_API=true` (mặc định) | Gọi backend qua `src/api/*`; luồng backend chưa có → lưu trình duyệt theo tài khoản (D04) |
| Provider trình duyệt | `VITE_USE_API=false` | `src/data/seed.js` + `reducer.js`, lưu localStorage; chỉ để xem giao diện |

Nghiệp vụ phía giao diện nằm trong `src/state/reducer.js` dưới dạng lệnh (`CREATE_RESERVATION`, `CONFIRM_TRANSFER`, …).
Mỗi lệnh tương ứng một endpoint trong `BE-CONTRACT.md`. Page chỉ gọi lệnh, không gọi `fetch` trực tiếp.

| Thư mục | Vai trò |
|---|---|
| `src/pages/` | Mỗi màn Figma một component |
| `src/components/` | Header + thông báo, lịch, thư viện ảnh, mã QR, sơ đồ ô kho (`UnitMap.jsx`), thanh tìm kiếm, UI dùng chung (`UI.jsx`, `Inline.jsx`) |
| `src/admin/` | Khu quản trị A01–A04 |
| `src/ops/` | Khu Nhân viên (S01–S05, S09) và Quản lý cơ sở (M01–M07): `api.js` gọi `/api/ops/*`, `store.jsx` (OpsProvider, dự phòng trình duyệt — D15), `reducer.js` nghiệp vụ, `tasks.jsx` lưới 3×3 |
| `src/api/` | `http.js` (fetch + token), `endpoints.js`, `admin.js`, `mappers.js` (backend → giao diện) |
| `src/lib/` | router, định dạng tiền/ngày, trạng thái → nhãn (`status.js`), vai trò, VietQR, xếp ô kho (`units.js`) |
| `src/config/` | địa chỉ API, ảnh, toạ độ cơ sở (`geo.js`), tài khoản nhận chuyển khoản |
| `src/styles/ss.css` | Token màu / chữ / bo góc theo Figma |
| `tests/` | `node --test`: reducer, mappers, admin; `render.test.mjs` render mọi route |

Khu vận hành (`src/ops/`) có provider riêng: tải `GET /api/ops/board`, gửi lệnh `POST /api/ops/...`, tải lại bảng.
Backend trả 404 → dùng `src/ops/data.js` + `reducer.js` lưu trình duyệt và hiện dòng báo (D15).

## Chưa có (theo SRS)

- API `/api/ops/*`, tài khoản seed MANAGER, lọc theo cơ sở được phân công — xem `BACKEND-TODO.md` mục A.
- Giao diện và API cho Quản lý vận hành KD (UC19–UC23), vai trò này ở backend (F24), project test backend (F28).
  Xem `feature_list.json`.
