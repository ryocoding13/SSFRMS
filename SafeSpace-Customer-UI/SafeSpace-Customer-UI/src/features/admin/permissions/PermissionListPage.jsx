import React from "react";
import {adminApi} from "../api/adminApi.js";
import {useLoad} from "../utils/adminUtils.js";
import {useApp} from "../../../app/state/AppProvider.jsx";
import {Button,Empty,Notice,PageHeader} from "../../../shared/components/UI.jsx";
import {ROLE_SCOPE,roleLabel,sortRoles} from "../../../shared/utils/roles.js";
const descriptions={CUSTOMER:"Đặt kho, thanh toán, quản lý hợp đồng và gửi hỗ trợ",STAFF:"Thu tiền tại kho, xác minh, giao chìa khóa, kiểm tra và hỗ trợ khách",MANAGER:"Phân bổ kho, phân công, duyệt gia hạn và xử lý hoàn tiền",OPERATIONS:"Quản lý cơ sở, giá thuê, chính sách và báo cáo",ADMIN:"Quản lý tài khoản, gán vai trò, cơ sở phụ trách và xem nhật ký"};
export function RoleAccessTable({roles}) {return <div className="panel table-wrap"><table className="table"><thead><tr><th>Vai trò</th><th>Phạm vi dữ liệu</th><th>Quyền theo vai trò</th><th>Thiết lập</th></tr></thead><tbody>{sortRoles(roles,r=>r.roleName).map(r=><tr key={r.roleId}><td>{roleLabel(r.roleName)}</td><td>{ROLE_SCOPE[r.roleName]||"Chưa có mô tả"}</td><td>{descriptions[r.roleName]||"Chưa có mô tả quyền vai trò"}</td><td>Cố định</td></tr>)}</tbody></table></div>;}
export default function PermissionListPage() {
 const {onApiError}=useApp(),load=useLoad(()=>adminApi.roles(),[],onApiError);
 return <main className="container page"><p className="customer-records__breadcrumb">SafeSpace / Quản trị / Vai trò &amp; quyền truy cập</p><PageHeader title="Vai trò & quyền truy cập" description="Quyền của từng vai trò đã được định nghĩa sẵn và cố định."/><Notice>Chỉ xem · Không chỉnh sửa quyền của vai trò. Quản trị viên gán, đổi hoặc gỡ vai trò trên từng tài khoản; quyền đi kèm được áp dụng tự động.</Notice>{load.error?<Empty title="Không tải được vai trò" text={load.error}><Button onClick={load.reload}>Thử lại</Button></Empty>:load.loading?<p role="status">Đang tải vai trò…</p>:load.data?.length?<RoleAccessTable roles={load.data}/>:<Empty title="Chưa có vai trò"/>}</main>;
}
