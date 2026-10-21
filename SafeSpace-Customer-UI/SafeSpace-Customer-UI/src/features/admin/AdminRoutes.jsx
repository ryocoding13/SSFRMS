/*
 * ADMIN APP - ĐIỀU HƯỚNG TRANG QUẢN TRỊ
 *
 * Chức năng chính:
 * - Nhận thông tin đường dẫn (URL) từ component cha.
 * - Xác định Admin đang truy cập chức năng nào.
 * - Hiển thị component tương ứng với đường dẫn.
 * - Sử dụng AdminShell làm layout chung cho các trang Admin.
 *
 * File này KHÔNG trực tiếp xử lý dữ liệu người dùng
 * hoặc gọi API. Nó chỉ quyết định component nào được hiển thị.
 */

import React from "react";
import { Empty, LinkButton } from "../../shared/components/UI.jsx";
import CreateUserPage from "./users/CreateUserPage.jsx";
import AuditLogPage from "./logs/AuditLogPage.jsx";
import PermissionListPage from "./permissions/PermissionListPage.jsx";
import AdminLayout from "./AdminLayout.jsx";
import UserDetailPage from "./users/UserDetailPage.jsx";
import UserListPage from "./users/UserListPage.jsx";

// Định tuyến khu quản trị: #/admin, #/admin/users/:id, #/admin/new, #/admin/permissions, #/admin/logs
export default function AdminRoutes({ parts }) {

  // Lấy hai phần đầu tiên của đường dẫn.
  // a: tên chức năng đang truy cập (users, new, logs,...).
  // b: tham số bổ sung, thường là ID người dùng.
  const [a, b] = parts;

  // tab xác định mục menu đang được chọn trong AdminShell.
  // Mặc định là chuỗi rỗng.
  let tab = "";

  // body lưu component sẽ được hiển thị
  // bên trong layout AdminShell.
  let body;

  // TRƯỜNG HỢP 1: Admin truy cập #/admin
  // Không có phần đường dẫn bổ sung (!a).
  // Hiển thị trang danh sách người dùng mặc định.
  if (!a) body = <UserListPage />;

  // TRƯỜNG HỢP 2: Admin truy cập #/admin/users/:id
  // a phải là "users" và b phải có giá trị.
  // Hiển thị trang chi tiết của người dùng có ID tương ứng.
  // key={b} giúp React tạo lại component khi ID thay đổi.
  else if (a === "users" && b)
    body = <UserDetailPage key={b} id={b} />;

  // TRƯỜNG HỢP 3: Admin truy cập #/admin/new
  // Chọn tab "new" và hiển thị form tạo tài khoản mới.
  else if (a === "new") {
    tab = "new";
    body = <CreateUserPage />;

  // TRƯỜNG HỢP 4: Admin truy cập #/admin/permissions
  // Chọn tab "permissions" và hiển thị trang quản lý phân quyền.
  } else if (a === "permissions") {
    tab = "permissions";
    body = <PermissionListPage />;

  // TRƯỜNG HỢP 5: Admin truy cập #/admin/logs
  // Chọn tab "logs" và hiển thị nhật ký hệ thống.
  } else if (a === "logs") {
    tab = "logs";
    body = <AuditLogPage />;

  // TRƯỜNG HỢP 6: URL không khớp với chức năng nào.
  // Hiển thị thông báo không tìm thấy trang.
  // Cung cấp nút quay lại trang quản lý tài khoản.
  } else
    body = (
      <main className="container page">
        <Empty title="Không tìm thấy trang" text="Đường dẫn quản trị này không tồn tại.">
          <LinkButton to="admin">Về quản lý tài khoản</LinkButton>
        </Empty>
      </main>
    );

  // Render layout chung của Admin.
  // tab: truyền mục menu hiện tại cho AdminShell.
  // body: nội dung trang được chọn ở các điều kiện phía trên.
  // {body} được truyền vào AdminShell thông qua children.
  return <AdminLayout tab={tab}>{body}</AdminLayout>;
}
