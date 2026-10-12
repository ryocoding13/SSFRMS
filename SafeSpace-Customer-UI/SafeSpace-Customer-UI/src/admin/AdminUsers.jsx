
/*
 * ADMIN USERS - TRANG QUẢN LÝ DANH SÁCH TÀI KHOẢN
 *
 * Chức năng chính:
 * - Hiển thị thống kê số lượng tài khoản trong hệ thống.
 * - Lấy danh sách người dùng từ Backend API.
 * - Tìm kiếm người dùng theo từ khóa.
 * - Lọc người dùng theo vai trò và trạng thái.
 * - Hiển thị cơ sở mà nhân viên hoặc quản lý phụ trách.
 * - Phân trang danh sách (10 tài khoản/trang).
 * - Chuyển đến trang chi tiết hoặc tạo tài khoản mới.
 */

import React, { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { Pagination, Select } from "../components/Pickers";
import { Empty, LinkButton, Notice, StatusTag } from "../components/UI";
import { USER_STATUS, needsFacility, roleLabel, sortRoles } from "../lib/roles";
import { go, href } from "../lib/router";
import { useApp } from "../state/store";
import { useLoad } from "./util";

const PAGE_SIZE = 10;

export default function AdminUsers() {

  // Lấy hàm xử lý lỗi API từ Context.
  // Ví dụ: kết thúc phiên khi token hết hạn (HTTP 401).
  const { onApiError } = useApp();


  /*
   * STATE - LƯU TRẠNG THÁI BỘ LỌC VÀ PHÂN TRANG
   */

  // ID vai trò đang được chọn để lọc.
  // "" nghĩa là hiển thị tất cả vai trò.
  const [roleId, setRoleId] = useState("");

  // Trạng thái tài khoản đang lọc.
  // "" nghĩa là không giới hạn trạng thái.
  const [status, setStatus] = useState("");

  // Nội dung người dùng đang nhập vào ô tìm kiếm.
  const [search, setSearch] = useState("");

  // Từ khóa thực sự dùng để gọi API tìm kiếm.
  // Được cập nhật sau khi người dùng ngừng gõ 300ms.
  const [term, setTerm] = useState("");

  // Trang hiện tại của bảng danh sách.
  // Mặc định bắt đầu từ trang 1.
  const [page, setPage] = useState(1);

  // Lưu tên cơ sở phụ trách theo ID người dùng.
  // Ví dụ: { 5: "SafeSpace Quận 1" }.
  const [scopes, setScopes] = useState({});


  /*
   * DEBOUNCE TÌM KIẾM
   *
   * Mục đích:
   * - Không gọi API liên tục mỗi khi người dùng gõ một ký tự.
   * - Chờ 300ms sau lần nhập cuối mới cập nhật từ khóa.
   * - Khi tìm kiếm mới, quay về trang 1.
   */

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);

    // Hủy timer cũ nếu người dùng tiếp tục nhập,
    // tránh thực hiện tìm kiếm với từ khóa cũ.
    return () => clearTimeout(t);
  }, [search]);


  /*
   * API 1 - LẤY THỐNG KÊ VÀ DANH SÁCH VAI TRÒ
   *
   * adminApi.stats(): lấy số lượng tài khoản, trạng thái,...
   * adminApi.roles(): lấy danh sách vai trò trong hệ thống.
   *
   * Promise.all giúp gọi hai API đồng thời.
   * sortRoles sắp xếp vai trò trước khi sử dụng.
   *
   * [] nghĩa là không cần tải lại theo bộ lọc.
   */

  const meta = useLoad(async () => {
    const [stats, roles] = await Promise.all([adminApi.stats(), adminApi.roles()]);
    return { stats, roles: sortRoles(roles, (r) => r.roleName) };
  }, [], onApiError);


  /*
   * API 2 - LẤY DANH SÁCH NGƯỜI DÙNG
   *
   * Gửi các tham số:
   * - page: trang hiện tại.
   * - pageSize: số tài khoản mỗi trang (10).
   * - searchTerm: từ khóa tìm kiếm.
   * - status: trạng thái cần lọc.
   * - roleId: vai trò cần lọc.
   *
   * Khi page, term, status hoặc roleId thay đổi,
   * useLoad sẽ tải lại danh sách từ backend.
   */

  const list = useLoad(() => adminApi.users({ page, pageSize: PAGE_SIZE, searchTerm: term, status, roleId }), [page, term, status, roleId], onApiError);


  /*
   * LẤY CƠ SỞ PHỤ TRÁCH CỦA NHÂN VIÊN / QUẢN LÝ
   *
   * Mỗi tài khoản có vai trò cần gán cơ sở sẽ được
   * gọi API để tìm cơ sở đang được phân công.
   *
   * Khách hàng thông thường không cần xử lý phần này.
   */

  // Cơ sở phụ trách của nhân viên / quản lý trong trang hiện tại
  useEffect(() => {

    // Lấy danh sách tài khoản đang hiển thị.
    // Nếu chưa có dữ liệu thì dùng mảng rỗng.
    const items = list.data?.items || [];

    // Cờ đánh dấu effect còn hiệu lực.
    // Tránh setState từ request cũ sau khi cleanup.
    let alive = true;

    items

      // Chỉ lấy những người cần phân công cơ sở
      // và chưa có dữ liệu cơ sở trong scopes.
      .filter((u) => needsFacility(u.roles) && scopes[u.userId] === undefined)

      // Gọi API riêng cho từng tài khoản phù hợp.
      .forEach(async (u) => {
        try {

          // Lấy danh sách cơ sở được phân công cho User.
          const rows = await adminApi.userFacilities(u.userId);

          // Tìm cơ sở có trạng thái phân công ACTIVE.
          const active = rows.find((r) => r.status === "ACTIVE");

          // Nếu có cơ sở đang hoạt động thì lưu tên cơ sở.
          // Nếu không có thì hiển thị "Chưa phân công".
          if (alive) setScopes((s) => ({ ...s, [u.userId]: active ? active.facilityName : "Chưa phân công" }));

        } catch {

          // Nếu API lỗi, hiển thị dấu "—" cho tài khoản đó.
          if (alive) setScopes((s) => ({ ...s, [u.userId]: "—" }));
        }
      });

    // Cleanup khi effect kết thúc hoặc dữ liệu thay đổi.
    // Request cũ sẽ không cập nhật scopes nữa.
    return () => {
      alive = false;
    };

  }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps


  /*
   * XỬ LÝ DỮ LIỆU THỐNG KÊ
   */

  // Lấy dữ liệu thống kê đã tải từ API.
  const stats = meta.data?.stats;

  // Đối tượng chứa số lượng tài khoản theo từng vai trò.
  // Nếu chưa có dữ liệu thì dùng object rỗng.
  const byRole = stats?.usersByRole || {};

  // Tính tổng số tài khoản thuộc nhóm nhân viên / quản lý.
  // Loại trừ CUSTOMER và ADMIN khỏi phép tính.
  const staffCount = Object.entries(byRole)
    .filter(([k]) => k !== "CUSTOMER" && k !== "ADMIN")
    .reduce((a, [, v]) => a + v, 0);

  // Dữ liệu cho bốn thẻ thống kê ở đầu trang.
  // Mỗi phần tử gồm: [số lượng, nhãn, màu].
  const cards = [
    [stats?.totalUsers, "Tổng tài khoản", ""],
    [byRole.CUSTOMER || 0, "Khách hàng", "blue"],
    [staffCount, "Nhân viên & Quản lý", "green"],
    [stats?.inactiveUsersCount || 0, "Đang khoá / ngưng", "red"],
  ];


  /*
   * XÁC ĐỊNH PHẠM VI PHỤ TRÁCH CỦA USER
   *
   * ADMIN: hiển thị "Toàn hệ thống".
   * Nhân viên / quản lý cơ sở: hiển thị tên cơ sở.
   * Các vai trò hệ thống khác CUSTOMER:
   * hiển thị "Toàn hệ thống".
   * CUSTOMER: hiển thị "—".
   */

  const scopeOf = (u) => {

    // Admin có phạm vi toàn hệ thống.
    if (u.roles.includes("ADMIN")) return "Toàn hệ thống";

    // Nhân viên hoặc quản lý cần gán cơ sở.
    // "…" nghĩa là dữ liệu cơ sở chưa tải xong.
    if (needsFacility(u.roles)) return scopes[u.userId] ?? "…";

    // Vai trò khác CUSTOMER được hiển thị toàn hệ thống.
    if (u.roles.some((r) => r !== "CUSTOMER")) return "Toàn hệ thống";

    // Khách hàng không có cơ sở phụ trách.
    return "—";
  };


  /*
   * XỬ LÝ THÔNG TIN PHÂN TRANG
   */

  // Dữ liệu danh sách người dùng trả về từ API.
  const data = list.data;

  // Tính vị trí bắt đầu của bản ghi trên trang hiện tại.
  // Ví dụ: trang 2, 10 tài khoản/trang => bắt đầu từ 11.
  const from = data ? (data.page - 1) * data.pageSize + 1 : 0;

  // Tính tổng số trang dựa trên tổng số tài khoản.
  // Math.ceil làm tròn lên để tính cả trang cuối.
  // Math.max đảm bảo số trang không nhỏ hơn 1.
  const totalPages = data ? Math.max(1, Math.ceil(data.totalItems / data.pageSize)) : 1;

  // Danh sách vai trò lấy từ API.
  const roles = meta.data?.roles || [];

  // Thêm lựa chọn "Tất cả" (roleId rỗng)
  // vào đầu danh sách vai trò để tạo bộ lọc.
  // useMemo chỉ tính lại khi roles thay đổi.
  const chips = useMemo(() => [{ roleId: "", roleName: "" }, ...roles], [roles]);


  /*
   * RENDER GIAO DIỆN QUẢN LÝ TÀI KHOẢN
   */

  return (
    <main className="container page">

      {/* HEADER - TIÊU ĐỀ VÀ NÚT THÊM TÀI KHOẢN */}
      <header className="page-header">
        <div>
          <h1>Quản lý tài khoản người dùng</h1>

          {/* Hiển thị tổng số tài khoản từ API.
              Nếu chưa tải xong thì hiển thị "Đang tải…". */}
          <p>{stats ? `${stats.totalUsers} tài khoản trong hệ thống` : "Đang tải…"}</p>
        </div>

        <div className="page-header__actions">

          {/* Điều hướng đến form tạo tài khoản mới. */}
          <LinkButton to="admin/new">+ Thêm tài khoản mới</LinkButton>
        </div>
      </header>


      {/* HIỂN THỊ LỖI KHI KHÔNG TẢI ĐƯỢC THỐNG KÊ / VAI TRÒ */}
      {meta.error && <Notice tone="error">{meta.error}</Notice>}


      {/* BỐN THẺ THỐNG KÊ TÀI KHOẢN */}
      <div className="stats stats--4">

        {/* Duyệt mảng cards và tạo từng thẻ thống kê.
            tone dùng để xác định màu chữ cho số lượng. */}
        {cards.map(([n, label, tone]) => (
          <div className="stat" key={label}>
            <strong className={tone ? `tone-${tone}` : ""}>{n ?? "—"}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>


      {/* THANH CÔNG CỤ - LỌC VAI TRÒ, TÌM KIẾM, TRẠNG THÁI */}
      <div className="admin-toolbar">

        {/* BỘ LỌC THEO VAI TRÒ */}
        <div className="chips" role="group" aria-label="Lọc theo vai trò">

          {/* Render nút cho từng vai trò trong chips. */}
          {chips.map((r) => (
            <button
              type="button"
              key={r.roleId || "all"}

              // Thêm class "is-on" cho vai trò đang được chọn.
              className={`chip chip--dark${String(roleId) === String(r.roleId) ? " is-on" : ""}`}

              // Cho biết nút lọc đang được chọn hay chưa.
              aria-pressed={String(roleId) === String(r.roleId)}

              // Khi nhấn: cập nhật roleId và quay về trang 1.
              onClick={() => {
                setRoleId(r.roleId);
                setPage(1);
              }}
            >

              {/* Chuyển tên vai trò thành nhãn dễ đọc.
                  Nếu roleName rỗng thì hiển thị "Tất cả". */}
              {r.roleName ? roleLabel(r.roleName) : "Tất cả"}
            </button>
          ))}
        </div>


        {/* KHU VỰC TÌM KIẾM VÀ LỌC TRẠNG THÁI */}
        <div className="admin-toolbar__filters">

          {/* Ô tìm kiếm theo tên, email hoặc số điện thoại.
              onChange cập nhật search mỗi khi người dùng nhập.
              useEffect phía trên sẽ đợi 300ms trước khi tìm. */}
          <input className="search-input" type="search" placeholder="Tìm tên, email, SĐT…" aria-label="Tìm tài khoản" value={search} onChange={(e) => setSearch(e.target.value)} />

          {/* Dropdown lọc tài khoản theo trạng thái.
              Khi thay đổi trạng thái sẽ quay lại trang 1. */}
          <Select aria-label="Lọc trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>

            {/* Lựa chọn mặc định không lọc trạng thái. */}
            <option value="">Mọi trạng thái</option>

            {/* Tạo các lựa chọn từ USER_STATUS.
                k là mã trạng thái, label là tên hiển thị. */}
            {Object.entries(USER_STATUS).map(([k, [label]]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </Select>
        </div>
      </div>


      {/* HIỂN THỊ THÔNG BÁO NẾU API DANH SÁCH BỊ LỖI */}
      {list.error && <Notice tone="error">{list.error}</Notice>}


      {/* BẢNG DANH SÁCH TÀI KHOẢN */}
      <div className="table-wrap panel">
        <table className="table table--hover">

          {/* PHẦN TIÊU ĐỀ CÁC CỘT */}
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Cơ sở phụ trách</th>
              <th>Trạng thái</th>
            </tr>
          </thead>

          <tbody>

            {/* Lặp qua danh sách tài khoản do API trả về.
                Mỗi phần tử u tương ứng với một User.
                Nếu data chưa có thì dùng mảng rỗng. */}
            {(data?.items || []).map((u) => (

              // Mỗi hàng là một tài khoản.
              // Nhấn vào hàng sẽ chuyển đến trang chi tiết User.
              <tr key={u.userId} onClick={() => go(`admin/users/${u.userId}`)}>

                {/* CỘT 1: HỌ TÊN VÀ USERNAME */}
                <td>

                  {/* Link mở trang chi tiết tài khoản.
                      stopPropagation ngăn sự kiện click
                      lan lên hàng <tr> và gọi go lần nữa. */}
                  <a href={href(`admin/users/${u.userId}`)} onClick={(e) => e.stopPropagation()} className="cell-strong">{u.fullName}</a>

                  {/* Hiển thị tên đăng nhập dưới họ tên. */}
                  <small className="cell-sub">@{u.username}</small>
                </td>

                {/* CỘT 2: EMAIL CỦA USER */}
                <td>{u.email}</td>

                {/* CỘT 3: VAI TRÒ CỦA USER.
                    Sắp xếp vai trò, chuyển thành nhãn,
                    rồi nối bằng dấu phẩy nếu có nhiều vai trò. */}
                <td>{sortRoles(u.roles).map(roleLabel).join(", ") || "—"}</td>

                {/* CỘT 4: PHẠM VI / CƠ SỞ PHỤ TRÁCH.
                    Sử dụng hàm scopeOf đã định nghĩa phía trên. */}
                <td>{scopeOf(u)}</td>

                {/* CỘT 5: TRẠNG THÁI TÀI KHOẢN.
                    StatusTag hiển thị nhãn và màu tương ứng. */}
                <td>
                  <StatusTag map={USER_STATUS} status={u.status} />
                </td>
              </tr>
            ))}


            {/* TRƯỜNG HỢP KHÔNG CÓ USER PHÙ HỢP BỘ LỌC.
                Chỉ hiển thị sau khi tải xong.
                colSpan={5} gộp cả 5 cột thành một ô. */}
            {!list.loading && data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="table__empty">Không có tài khoản phù hợp bộ lọc.</td>
              </tr>
            )}


            {/* TRƯỜNG HỢP ĐANG TẢI DANH SÁCH LẦN ĐẦU.
                Hiển thị khi loading và chưa có data. */}
            {list.loading && !data && (
              <tr>
                <td colSpan={5} className="table__empty">Đang tải danh sách…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      {/* PHÂN TRANG DANH SÁCH NGƯỜI DÙNG.
          Chỉ hiển thị khi đã có data.
          onPage={setPage}: khi chọn trang mới,
          cập nhật state page để useLoad gọi lại API. */}
      {data && <Pagination page={data.page} pages={totalPages} total={data.totalItems} from={from} to={from + data.items.length - 1} noun="tài khoản" onPage={setPage} />}


      {/* CÁC NÚT ĐIỀU HƯỚNG ĐẾN CHỨC NĂNG ADMIN KHÁC */}
      <div className="stack">

        {/* Mở trang quản lý và cấu hình phân quyền. */}
        <LinkButton to="admin/permissions" variant="outline">Cấu hình quyền truy cập</LinkButton>

        {/* Mở trang xem nhật ký hoạt động hệ thống. */}
        <LinkButton to="admin/logs" variant="outline">Xem nhật ký hoạt động</LinkButton>
      </div>


      {/* Nếu API metadata đã tải nhưng không có vai trò nào,
          hiển thị thông báo hệ thống chưa có vai trò. */}
      {meta.data && roles.length === 0 && <Empty title="Chưa có vai trò" text="Hệ thống chưa có vai trò nào." />}
    </main>
  );
}
