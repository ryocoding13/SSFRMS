import React from "react";
import { Empty, LinkButton } from "../components/UI";
import AdminCreateUser from "./AdminCreateUser";
import AdminLogs from "./AdminLogs";
import AdminPermissions from "./AdminPermissions";
import AdminShell from "./AdminShell";
import AdminUserDetail from "./AdminUserDetail";
import AdminUsers from "./AdminUsers";

// Định tuyến khu quản trị: #/admin, #/admin/users/:id, #/admin/new, #/admin/permissions, #/admin/logs
export default function AdminApp({ parts }) {
  const [a, b] = parts;
  let tab = "";
  let body;
  if (!a) body = <AdminUsers />;
  else if (a === "users" && b) body = <AdminUserDetail key={b} id={b} />;
  else if (a === "new") {
    tab = "new";
    body = <AdminCreateUser />;
  } else if (a === "permissions") {
    tab = "permissions";
    body = <AdminPermissions />;
  } else if (a === "logs") {
    tab = "logs";
    body = <AdminLogs />;
  } else
    body = (
      <main className="container page">
        <Empty title="Không tìm thấy trang" text="Đường dẫn quản trị này không tồn tại.">
          <LinkButton to="admin">Về quản lý tài khoản</LinkButton>
        </Empty>
      </main>
    );
  return <AdminShell tab={tab}>{body}</AdminShell>;
}
