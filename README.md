# SSFRMS - Self-Storage Facility Rental Management System

Hệ thống quản lý và cho thuê kho tự quản thông minh (SafeSpace Self-Storage), bao gồm API Backend trên nền tảng **.NET 9** và Giao diện khách hàng Frontend trên nền tảng **React (Vite)**.

---

## 📋 Yêu Cầu Môi Trường (Prerequisites)

Trước khi chạy dự án, hãy đảm bảo máy tính đã cài đặt các công cụ sau:
- **[.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)** (hoặc phiên bản .NET tương thích)
- **[Node.js](https://nodejs.org/)** (v18 trở lên) & **npm**
- **[Microsoft SQL Server](https://www.microsoft.com/sql-server/sql-server-downloads)** (SQL Server Express, Developer Edition, LocalDB hoặc chạy qua Docker)
- **[Git](https://git-scm.com/)**

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Clone Repository
```bash
git clone https://github.com/ryocoding13/SSFRMS.git
cd SSFRMS
```

---

### 2. Thiết lập & Khởi động Backend (.NET Web API)

1. **Cấu hình Connection String**:
   Mở file `StorageProject.Api/appsettings.json` và kiểm tra chuỗi kết nối cơ sở dữ liệu:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=.\\SQLEXPRESS;Database=SSFRMS;Trusted_Connection=True;TrustServerCertificate=True;"
   }
   ```
   *(Nếu bạn không dùng `SQLEXPRESS`, đổi thành tên máy chủ của bạn, ví dụ `Server=localhost;...` hoặc `Server=(localdb)\\mssqllocaldb;...`)*.

2. **Khôi phục công cụ Entity Framework Core & Chạy Migration**:
   Tại thư mục gốc dự án, chạy lệnh:
   ```bash
   dotnet tool restore
   dotnet ef database update --project StorageProject.Infrastructure --startup-project StorageProject.Api
   ```

3. **Khởi chạy Backend API**:
   ```bash
   dotnet run --project StorageProject.Api
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
   Kiểm tra file `.env` đã có cấu hình trỏ về API Backend:
   ```env
   VITE_API_URL=http://localhost:5151
   ```

4. **Khởi chạy Frontend**:
   ```bash
   npm run dev
   ```
   - Mở trình duyệt tại: `http://localhost:5173` (hoặc cổng được hiển thị trên terminal).
   - Thanh điều hướng (Breadcrumb) sẽ hiển thị tag màu xanh **`● KẾT NỐI API .NET`** báo hiệu đã liên kết thành công với Backend.

---

## 🔑 Tài Khoản Dùng Thử Mặc Định (Seed Data)

Hệ thống đã tạo sẵn các tài khoản để kiểm thử quy trình:

| Quyền hạn | Tên đăng nhập (Username) | Mật khẩu (Password) | Mô tả |
|-----------|--------------------------|---------------------|-------|
| **CUSTOMER** | `customer01` | `Customer@123` | Khách hàng mẫu (Nguyễn Văn An) |
| **CUSTOMER** | `customer02` | `Customer@123` | Khách hàng mẫu (Trần Thị Mai) |
| **STAFF** | `staff01` | `Staff@123` | Nhân viên vận hành |
| **ADMIN** | `admin` | `Admin@123` | Quản trị viên hệ thống |

*(Bạn cũng có thể bấm nút **"Đăng ký"** trực tiếp trên giao diện để tạo tài khoản mới)*.

---

## 🧠 Kiến Trúc: Cơ Chế Fallback Thông Minh (Smart Fallback Mode)

Giao diện SafeSpace hỗ trợ cơ chế hoạt động linh hoạt (dual-mode):

```
┌─────────────────────────────────────────────────────────────┐
│  App Startup (CustomerApp.jsx)                              │
│  ──────────────────────────────────────────────────────     │
│  1. loadServerData() → GET /api/facilities, /unit-types     │
│     ├── Success → isLiveApi = true, load real data          │
│     └── Failure → isLiveApi = false, keep demo data         │
│                                                             │
│  command() dispatcher:                                      │
│    ├── isLiveApi && authenticated → call API service        │
│    ├── isLiveApi && not authenticated → prompt AuthModal    │
│    └── fallback → local reduceCustomer (demo mode)          │
└─────────────────────────────────────────────────────────────┘
```

- **Khi Backend Online:** Dữ liệu được fetch trực tiếp từ cơ sở dữ liệu SQL Server, các thao tác đặt phòng, xem hợp đồng, gia hạn, tạo ticket đều gửi qua API.
- **Khi Backend Offline:** Giao diện vẫn hoạt động trơn tru với dữ liệu mẫu tĩnh (hiển thị tag `BẢN DEMO UI` màu xám).

---

## 📂 Cấu Trúc Dự Án (Project Structure)

```text
SSFRMS/
├── StorageProject.Api/                 # .NET 9 Minimal API, Middleware, Endpoints
│   ├── Endpoints/                      # Auth, Facility, Reservation, Contract, Payment, Support...
│   └── appsettings.json                # Cấu hình DB, JWT
├── StorageProject.Core/                # Domain Entities, DTOs, Service Interfaces
├── StorageProject.Infrastructure/      # EF Core DbContext, Migrations, DbSeeder, Service Implementations
├── SafeSpace-Customer-UI/
│   └── SafeSpace-Customer-UI/          # React + Vite Frontend
│       ├── src/
│       │   ├── components/             # UI Components (AuthModal, ActionModal, UI Elements)
│       │   ├── pages/                  # Pages: FindStorage, Overview, Records, Support
│       │   ├── services/               # API Clients & Service Adapters
│       │   ├── CustomerApp.jsx         # App Root & State Management
│       │   └── customer.css            # SafeSpace Modern Design System
│       └── .env                        # Environment Config (VITE_API_URL)
└── README.md                           # Hướng dẫn dự án
```

---

## 🛠️ Tính Năng Đã Tích Hợp (Customer Scope)

- **Tìm kiếm & Đặt kho**: Tìm kiếm cơ sở, kiểm tra phòng trống theo thời gian thực, tạo đơn đặt chỗ (Reservation).
- **Hợp đồng & Bàn giao**: Xem danh sách hợp đồng đang thuê, xác nhận bàn giao nhận kho (Handover).
- **Gia hạn & Trả kho**: Gửi yêu cầu gia hạn hợp đồng (Renewal), yêu cầu trả kho.
- **Hỗ trợ khách hàng**: Tạo vé hỗ trợ sự cố, xem tiến độ giải quyết, hủy vé hỗ trợ.
- **Xác thực JWT**: Đăng nhập, đăng ký, tự động đính kèm Bearer Token vào các yêu cầu bảo mật.
- **Cơ chế Fallback thông minh**: Tự động chuyển đổi mượt mà giữa chế độ Demo UI và Live API khi Backend online/offline.
