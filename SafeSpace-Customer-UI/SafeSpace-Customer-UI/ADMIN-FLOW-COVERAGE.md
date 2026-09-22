# Quản trị hệ thống — đối chiếu Figma ↔ code ↔ API

Nguồn: Figma "SafeSpace - Modern UI", section **Quản trị hệ thống** (A01–A04) + popup "Thông báo / admin".
Backend: `StorageProject.Api/Endpoints/AdminEndpoints.cs` (UC24–UC27), yêu cầu vai trò `ADMIN`.

Đăng nhập chung trang `#/login`. Giao diện đọc vai trò trong JWT: tài khoản `ADMIN` vào thẳng `#/admin`,
tài khoản khác mở `#/admin` sẽ thấy "Không có quyền truy cập". Tài khoản seed: `admin` / `Admin@123`.

| Figma | Route | Component | API |
|---|---|---|---|
| A01 Quản lý tài khoản | `#/admin` | `admin/AdminUsers.jsx` | `GET dashboard/stats`, `GET users?page&pageSize&searchTerm&status&roleId`, `GET roles`, `GET users/{id}/facilities` (cột Cơ sở phụ trách) |
| (thêm) Chi tiết tài khoản | `#/admin/users/:id` | `admin/AdminUserDetail.jsx` | `GET/PUT users/{id}`, `POST users/{id}/reset-password`, `POST/DELETE users/{id}/roles`, `GET users/{id}/facilities`, `POST user-facilities`, `PUT user-facilities/{id}/status` |
| A02 Thêm & phân quyền tài khoản | `#/admin/new` | `admin/AdminCreateUser.jsx` | `POST users` (+ `POST user-facilities` khi là Nhân viên / Quản lý) |
| A03 Cấu hình quyền truy cập | `#/admin/permissions` | `admin/AdminPermissions.jsx` | `GET roles`, `GET permissions`, `POST/DELETE roles/{id}/permissions` |
| A04 Nhật ký hoạt động | `#/admin/logs` | `admin/AdminLogs.jsx` | `GET logs/login-history`, `GET logs/activity-logs` |
| Thông báo / admin | (chuông) | `admin/AdminShell.jsx` | `GET dashboard/stats`, `GET logs/login-history` |

## Khác Figma vì backend
- **A02**: Figma "Gửi lời mời qua email" nhưng backend chưa gửi email → form có thêm **Tên đăng nhập** (gợi ý từ email)
  và **Mật khẩu tạm thời** (tự sinh 12 ký tự); sau khi tạo hiện hộp thoại để admin chép gửi người dùng.
- **A03**: Figma vẽ Xem / Chỉnh sửa / Xoá theo vai trò; backend quản lý **13 mã quyền** gán cho vai trò → giữ bảng
  "Vai trò / Phạm vi dữ liệu" như Figma, bên dưới là ma trận quyền × vai trò; lưu theo thay đổi, có bước xác nhận.
- **Vai trò "Vận hành KD"** có trong Figma nhưng backend chỉ có `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`.
  Danh sách vai trò lấy từ `GET /api/admin/roles`, nên khi backend thêm vai trò mới (vd. `OPERATIONS`) giao diện tự hiện.
- **Chi tiết tài khoản** Figma chưa vẽ; dựng cùng phong cách để dùng các API sửa / khoá / đặt lại mật khẩu / vai trò / phân công.
- **Nhật ký**: backend chỉ ghi lịch sử đăng nhập **thành công** (sai mật khẩu không được ghi) và nhật ký hoạt động
  không lưu IP → cột IP là "—". Tab "Tất cả / Thay đổi dữ liệu / Phân quyền" gộp 100 bản ghi mới nhất mỗi loại.

## Luật backend được giao diện phản ánh
- Không khoá / thu hồi vai trò `ADMIN` của quản trị viên hoạt động cuối cùng → hiện đúng thông báo lỗi từ backend.
- Chỉ Nhân viên / Quản lý được phân công cơ sở; mỗi người tối đa 1 phân công đang hoạt động (phân công mới tự kết thúc cái cũ).
- Tài khoản không ở trạng thái "Đang hoạt động" không đăng nhập được (backend trả lỗi, trang đăng nhập hiện nguyên văn).
- Tài khoản chỉ có vai trò Nhân viên / Quản lý: chưa có giao diện riêng → trang đăng nhập báo và không mở phiên.
