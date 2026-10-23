# SSFRMS - Self-Storage Facility Rental Management System

Hệ thống quản lý và cho thuê kho tự quản thông minh (SafeSpace Self-Storage), bao gồm API Backend trên nền tảng **.NET 10** và Giao diện khách hàng Frontend trên nền tảng **React (Vite)**.

---

> **Quy định cho công cụ AI (Claude, Cursor, Copilot, Codex…):** AI hỗ trợ phân tích, sửa file và kiểm thử;
> **không tạo commit, push, tạo PR hoặc merge, không thay đổi danh tính Git**. Thành viên đọc hiểu, kiểm tra rồi tự thao tác.
> Dùng nhánh riêng → PR → review bởi thành viên khác → merge vào `main`; không push thẳng `main`.
> Ghi nhận đóng góp và việc dùng AI theo yêu cầu môn học. Kiểm tra theo phạm vi tại [`docs/verification.md`](docs/verification.md).
> Quy tắc đầy đủ cho AI nằm trong [`AGENTS.md`](AGENTS.md).

## 📋 Yêu Cầu Môi Trường (Prerequisites)

Trước khi chạy dự án, hãy đảm bảo máy tính đã cài đặt các công cụ sau:
- **[.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0)** (hoặc phiên bản .NET tương thích)
- **[Node.js](https://nodejs.org/)** (>= 22.12) & **npm**
- **[Microsoft SQL Server](https://www.microsoft.com/sql-server/sql-server-downloads)** (SQL Server Express, Developer Edition, LocalDB hoặc chạy qua Docker)
- **[Git](https://git-scm.com/)**

---

## ⚡ Khởi Chạy Nhanh Toàn Bộ Hệ Thống

Sau khi cấu hình database/API và cài dependencies ở cả thư mục gốc lẫn FE, bạn có thể khởi chạy đồng thời **Backend (.NET)**, **Frontend (Vite React)** và **Ngrok tunnel** chỉ với một lệnh duy nhất:

```bash
npm ci
npm --prefix SafeSpace-Customer-UI/SafeSpace-Customer-UI ci
npm run dev
```

* **[BACKEND]**: `http://localhost:5151`
* **[FRONTEND]**: `http://127.0.0.1:5173`
* **[NGROK]**: Tự động forward public domain tới `http://localhost:5151` (phục vụ webhook PayOS)
* **Dừng toàn bộ**: Nhấn `Ctrl + C` trong terminal.

---

## 🚀 Hướng Dẫn Cài Đặt Chi Tiết

---

### 2. Thiết lập & Khởi động Backend (.NET Web API)

1. **Cấu hình Connection String**:
   Mở file `StorageProject.Api/appsettings.json` và kiểm tra chuỗi kết nối cơ sở dữ liệu:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=.\\SQLEXPRESS;Database=SSFRMS;Trusted_Connection=True;TrustServerCertificate=True;"
   }
   ```
   Đây là cấu hình local minh họa. Nếu có mật khẩu/khóa thật, dùng biến môi trường hoặc .NET User Secrets; không ghi vào cấu hình được commit.

   *(Nếu bạn không dùng `SQLEXPRESS`, đổi thành tên máy chủ của bạn, ví dụ `Server=localhost;...` hoặc `Server=(localdb)\\mssqllocaldb;...`)*.

2. **Khôi phục công cụ Entity Framework Core & Chạy Migration**:
   Tại thư mục gốc dự án, chạy lệnh:
   ```bash
   dotnet tool restore
   dotnet ef database update --project StorageProject.Infrastructure --startup-project StorageProject.Api
   ```

3. **Khởi chạy Backend API**:
   ```bash
   dotnet run --project StorageProject.Api --launch-profile http
   ```
   - **Backend Base URL:** `http://localhost:5151`
   - **Swagger UI (Tài liệu API):** `http://localhost:5151/index.html`
   - **Kiểm tra trạng thái:** `http://localhost:5151/health`

> 💡 **Lưu ý:** Khi khởi chạy lần đầu, hệ thống sẽ tự động khởi tạo dữ liệu mẫu (Roles, Cơ sở kho, Loại kho, Bảng giá, Tài khoản mẫu) thông qua `DbSeeder`.

---

### 3. Thiết lập & Khởi động Frontend (SafeSpace Customer UI)

1. **Di chuyển vào thư mục Frontend**:
   ```bash
   cd SafeSpace-Customer-UI/SafeSpace-Customer-UI
   ```

2. **Cài đặt thư viện dependencies**:
   ```bash
   npm install
   ```

3. **Cấu hình biến môi trường**:
   Chép `.env.example` thành `.env.local`, chỉnh địa chỉ API; không commit cấu hình riêng hoặc bí mật:
   ```env
   VITE_USE_API=true
   VITE_API_URL=http://localhost:5151
   ```

4. **Khởi chạy Frontend**:
   ```bash
   npm run dev
   ```
   - Mở trình duyệt tại: `http://localhost:5173` (hoặc cổng được hiển thị trên terminal).
   - Kiểm tra request trong DevTools và thử đăng nhập để xác nhận kết nối; việc giao diện render không chứng minh API đã hoạt động.

---

## 🔑 Tài Khoản Dùng Thử Mặc Định (Seed Data)

Hệ thống đã tạo sẵn các tài khoản để kiểm thử quy trình:

| Quyền hạn | Tên đăng nhập (Username) | Mật khẩu (Password) | Mô tả |
|-----------|--------------------------|---------------------|-------|
| **CUSTOMER** | `customer01` | `Customer@123` | Khách hàng mẫu (Nguyễn Văn An) |
| **CUSTOMER** | `customer02` | `Customer@123` | Khách hàng mẫu (Trần Thị Mai) |
| **CUSTOMER** | `customer03` … `customer06` | `Customer@123` | Khách đang thuê / chờ bàn giao / quá hạn tại cơ sở mẫu |
| **STAFF** | `staff01`, `staff02` | `Staff@123` | Nhân viên cơ sở SafeSpace Nguyễn Lương Bằng (`#/staff`) |
| **MANAGER** | `manager01` | `Manager@123` | Quản lý cơ sở SafeSpace Nguyễn Lương Bằng (`#/manager`) |
| **OPERATIONS** | `ops01` | `Ops@123` | Quản lý vận hành kinh doanh |
| **ADMIN** | `admin` | `Admin@123` | Quản trị viên hệ thống |

*(Bạn cũng có thể bấm nút **"Đăng ký"** trực tiếp trên giao diện để tạo tài khoản mới)*.

---

## 🧠 Chế độ API và kiểm thử giao diện

- `VITE_USE_API=true`: dùng backend theo cấu hình `.env.local`; dữ liệu API đi qua `ApiProvider` và `apiMappers.js`.
- `VITE_USE_API=false`: dùng chế độ lưu trình duyệt để thử giao diện; không xác nhận dữ liệu SQL Server/PayOS thật.
- Có script mock riêng `npm run dev:mock` và `npm run dev:business`; đọc script/cấu hình trước khi dùng.
- Quy định mới: mock/offline phải nhận biết khi kiểm thử, API lỗi không được giả thành công. Đây là yêu cầu cho các lần sửa liên quan;
  bản cập nhật tài liệu này không bổ sung banner hay thay đổi cơ chế fallback trong code hiện có.

---

## 📂 Cấu Trúc Dự Án (Project Structure)

```text
SSFRMS/
├── StorageProject.Api/                 # .NET 10 Minimal API, endpoints, cấu hình
├── StorageProject.Core/                # Entities, DTOs, interfaces
├── StorageProject.Infrastructure/      # EF Core, migrations, seeder, services
├── StorageProject.Tests/               # Kiểm thử backend
├── SafeSpace-Customer-UI/
│   └── SafeSpace-Customer-UI/
│       ├── src/app/                    # App, router, state, config
│       ├── src/features/               # Màn hình và chức năng theo vai trò
│       ├── src/shared/                 # API, components, styles, utils
│       ├── tests/
│       └── .env.example                # Cấu hình mẫu; chép thành .env.local
├── AGENTS.md                           # Quy định làm việc
└── docs/verification.md                # Kiểm tra theo phạm vi, điều kiện merge
```

---

## 🛠️ Tính Năng Đã Tích Hợp (Customer Scope)

- **Tìm kiếm & Đặt kho**: Tìm kiếm cơ sở, kiểm tra phòng trống theo thời gian thực, tạo đơn đặt chỗ (Reservation).
- **Hợp đồng & Bàn giao**: Xem danh sách hợp đồng đang thuê, xác nhận bàn giao nhận kho (Handover).
- **Gia hạn & Trả kho**: Gửi yêu cầu gia hạn hợp đồng (Renewal), yêu cầu trả kho.
- **Hỗ trợ khách hàng**: Tạo vé hỗ trợ sự cố, xem tiến độ giải quyết, hủy vé hỗ trợ.
- **Xác thực JWT**: Đăng nhập, đăng ký, tự động đính kèm Bearer Token vào các yêu cầu bảo mật.
- **Chế độ kiểm thử**: phân biệt API thật và chế độ lưu trình duyệt; kết quả mock không thay cho kiểm chứng backend/SQL Server.
