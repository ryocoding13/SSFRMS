
/*
 * ADMIN CREATE USER - TẠO TÀI KHOẢN NGƯỜI DÙNG
 *
 * Chức năng:
 * - Admin nhập thông tin tài khoản mới.
 * - Tự tạo username từ email nếu Admin chưa tự sửa.
 * - Tự sinh mật khẩu tạm thời.
 * - Chọn vai trò cho tài khoản.
 * - Phân công cơ sở nếu là Staff hoặc Manager.
 * - Kiểm tra dữ liệu trước khi gửi.
 * - Gọi API tạo tài khoản trên backend.
 * - Hiển thị thông tin đăng nhập sau khi tạo thành công.
 */


import React, { useState } from "react";
import { adminApi } from "../api/adminApi.js";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Field, Modal, Notice } from "../../../shared/components/UI.jsx";
import { isEmail, isPhone, today } from "../../../shared/utils/format.js";
import { FACILITY_ROLES, roleLabel, sortRoles } from "../../../shared/utils/roles.js";
import { go } from "../../../app/router.js";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { tempPassword, useLoad, usernameFrom } from "../utils/adminUtils.js";

/*
 * EMPTY - DỮ LIỆU FORM MẶC ĐỊNH
 *
 * Tất cả trường được khởi tạo là chuỗi rỗng.
 * Được dùng khi mở form và khi tạo tài khoản tiếp theo.
 */
const EMPTY = { fullName: "", email: "", phone: "", username: "", password: "", roleId: "", facilityId: "" };


export default function CreateUserPage() {

  // onApiError: xử lý lỗi liên quan đến API, đặc biệt HTTP 401.
  // notify: hiển thị thông báo toast trên giao diện.
  const { onApiError, notify } = useApp();


  /*
   * LẤY DANH SÁCH VAI TRÒ VÀ CƠ SỞ TỪ BACKEND
   *
   * Promise.all gọi đồng thời hai API:
   * 1. adminApi.roles(): lấy các vai trò trong hệ thống.
   * 2. adminApi.facilities(): lấy danh sách cơ sở.
   *
   * Sau khi nhận dữ liệu:
   * - Sắp xếp các vai trò bằng sortRoles.
   * - Chỉ giữ những cơ sở có trạng thái ACTIVE.
   *
   * useLoad quản lý:
   * - meta.data: dữ liệu API trả về.
   * - meta.loading: đang tải dữ liệu.
   * - meta.error: lỗi khi gọi API.
   */

  const meta = useLoad(async () => {
    const [roles, facilities] = await Promise.all([adminApi.roles(), adminApi.facilities()]);
    return { roles: sortRoles(roles, (r) => r.roleName), facilities: facilities.filter((f) => f.status === "ACTIVE") };
  }, [], onApiError);


  /*
   * STATE CỦA COMPONENT
   */

  // Lưu toàn bộ thông tin người dùng đang nhập.
  // Mật khẩu mặc định được tạo bằng tempPassword().
  const [form, setForm] = useState(() => ({ ...EMPTY, password: tempPassword() }));

  // Kiểm tra Admin đã tự chỉnh username hay chưa.
  // false: username được tự động tạo theo email.
  // true: giữ username do Admin tự nhập.
  const [userTouched, setUserTouched] = useState(false);

  // Lưu các lỗi validation theo từng trường.
  // Ví dụ: { email: "Email không hợp lệ" }.
  const [errors, setErrors] = useState({});

  // Trạng thái đang gửi request tạo tài khoản.
  // Dùng để disable nút và tránh gửi lặp.
  const [busy, setBusy] = useState(false);

  // Lưu kết quả sau khi tạo tài khoản thành công.
  // null: chưa tạo thành công, chưa hiện Modal.
  // Có dữ liệu: hiện Modal thông tin đăng nhập.
  const [done, setDone] = useState(null);
  const [flowEl, runChange] = useChangeFlow();


  /*
   * XÁC ĐỊNH VAI TRÒ ĐANG CHỌN
   */

  // Lấy danh sách vai trò từ API.
  // Nếu chưa tải xong thì sử dụng mảng rỗng.
  const roles = meta.data?.roles || [];

  // Tìm object vai trò dựa trên roleId trong form.
  // Chuyển sang String để so sánh được cả ID số và chuỗi.
  const role = roles.find((r) => String(r.roleId) === String(form.roleId));

  // scoped = true nếu vai trò bắt buộc gắn với một cơ sở.
  // Ví dụ: STAFF hoặc MANAGER.
  // Vai trò toàn hệ thống không cần chọn cơ sở.
  const scoped = role && FACILITY_ROLES.includes(role.roleName);


  /*
   * HÀM SET - CẬP NHẬT DỮ LIỆU FORM
   *
   * k: tên trường cần cập nhật.
   * v: giá trị mới của trường.
   *
   * Ví dụ:
   * set("fullName", "Nguyen Van A")
   * set("email", "abc@gmail.com")
   */

  const set = (k, v) => {

    // Cập nhật trường tương ứng nhưng giữ nguyên
    // các trường khác bằng spread operator (...f).
    setForm((f) => {
      const next = { ...f, [k]: v };

      // Nếu đang nhập email và Admin chưa tự sửa username,
      // tự tạo username từ email mới.
      if (k === "email" && !userTouched) next.username = usernameFrom(v);

      return next;
    });

    // Xóa lỗi của trường vừa được sửa.
    // Đồng thời xóa lỗi chung của form để người dùng thử lại.
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  };


  /*
   * VALIDATE - KIỂM TRA FORM TRƯỚC KHI TẠO TÀI KHOẢN
   *
   * Hàm chỉ kiểm tra và trả về object chứa các lỗi.
   * Không gọi API và không lưu dữ liệu.
   *
   * Nếu object trả về rỗng {} => form hợp lệ.
   */

  const validate = () => {

    // Object dùng để lưu các lỗi tìm được.
    const e = {};

    // Họ tên bắt buộc nhập, không được chỉ chứa khoảng trắng.
    if (!form.fullName.trim()) e.fullName = "Vui lòng nhập họ và tên.";

    // Kiểm tra định dạng địa chỉ email.
    if (!isEmail(form.email)) e.email = "Nhập email hợp lệ, ví dụ ten@safespace.vn.";

    // Số điện thoại không bắt buộc.
    // Nhưng nếu đã nhập thì phải đúng định dạng.
    if (form.phone && !isPhone(form.phone)) e.phone = "Số điện thoại chưa đúng định dạng.";

    // Username phải dài 3-50 ký tự.
    // Chỉ được chứa chữ cái, số, dấu chấm, _, @ và -.
    if (!/^[a-zA-Z0-9._@-]{3,50}$/.test(form.username)) e.username = "Tên đăng nhập 3–50 ký tự: chữ, số, dấu . _ - @";

    // Mật khẩu tạm thời tối thiểu 8 ký tự.
    if (form.password.length < 8) e.password = "Mật khẩu tạm thời cần ít nhất 8 ký tự.";

    // Bắt buộc lựa chọn một vai trò.
    if (!form.roleId) e.roleId = "Chọn vai trò cho tài khoản.";

    // Nhân viên và quản lý cơ sở phải được phân công cơ sở.
    // Các vai trò không thuộc nhóm scoped được bỏ qua điều kiện.
    if (scoped && !form.facilityId) e.facilityId = "Nhân viên và Quản lý cơ sở cần có cơ sở phụ trách.";

    // Trả về danh sách lỗi để hàm submit xử lý.
    return e;
  };


  /*
   * SUBMIT - XỬ LÝ KHI ADMIN NHẤN "TẠO TÀI KHOẢN"
   *
   * Luồng xử lý:
   * 1. Ngăn form reload.
   * 2. Validate dữ liệu.
   * 3. Gọi API tạo tài khoản.
   * 4. Nếu có cơ sở phụ trách => gọi API phân công.
   * 5. Lưu kết quả để hiển thị Modal.
   */

  const submit = async (ev) => {

    // Ngăn hành vi submit mặc định của trình duyệt.
    ev.preventDefault();

    // Kiểm tra toàn bộ dữ liệu trước khi gọi API.
    const e = validate();

    // Nếu có ít nhất một lỗi, hiển thị lỗi và dừng.
    if (Object.keys(e).length) return setErrors(e);

    // Bật trạng thái xử lý để vô hiệu hóa nút submit.
    setBusy(true);

    // Biến lưu thông tin tài khoản được backend tạo.
    let created;

    // Figma 885:10555–10579: hỏi xác nhận trước khi tạo; lỗi hiện hộp thoại "Không tạo tài khoản được".
    // Thành công vẫn dùng hộp thoại riêng bên dưới để hiện tên đăng nhập và mật khẩu tạm một lần.
    const outcome = await runChange({
      action: "Tạo tài khoản", scope: "Tài khoản mới", content: "Thông tin, vai trò và cơ sở đã chọn", showSuccess: false,
      perform: async () => {
        created = await adminApi.createUser({
          username: form.username.trim(),
          password: form.password,
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.phone.replace(/[\s.-]/g, "") || null,
          initialRoleId: Number(form.roleId),
          status: "ACTIVE",
        });
        return created;
      },
    });
    if (outcome.cancelled) return setBusy(false);

    try {
      if (outcome.error) throw outcome.error;
    } catch (err) {

      // Xử lý lỗi API, ví dụ phiên đăng nhập hết hạn.
      onApiError(err);

      // Tắt trạng thái đang xử lý.
      setBusy(false);

      // Lấy thông báo lỗi từ backend.
      // Nếu không có thì sử dụng thông báo mặc định.
      const msg = err.message || "Không tạo được tài khoản.";

      // Nếu lỗi liên quan đến username,
      // hiển thị ngay tại trường Tên đăng nhập.
      if (/Tên đăng nhập/i.test(msg)) return setErrors({ username: msg });

      // Nếu lỗi liên quan đến email,
      // hiển thị ngay tại trường Email.
      if (/Email/i.test(msg)) return setErrors({ email: msg });

      // Các lỗi khác hiển thị phía trên form.
      return setErrors({ form: msg });
    }


    /*
     * PHÂN CÔNG CƠ SỞ SAU KHI TẠO TÀI KHOẢN
     *
     * Đây là request riêng, chạy sau createUser.
     * Nếu phân công lỗi, tài khoản vẫn đã được tạo.
     */

    // Biến lưu lỗi phân công cơ sở (nếu có).
    let facilityError = null;

    // Chỉ phân công khi vai trò cần cơ sở
    // và Admin đã chọn một cơ sở.
    if (scoped && form.facilityId) {
      try {

        // Gọi API gán cơ sở cho tài khoản vừa tạo.
        // userId: ID tài khoản mới.
        // facilityId: cơ sở Admin chọn.
        // assignedFrom: ngày bắt đầu phân công.
        // assignedTo: null nghĩa là chưa xác định ngày kết thúc.
        await adminApi.assignFacility({ userId: created.userId, facilityId: Number(form.facilityId), assignedFrom: today(), assignedTo: null });

      } catch (err) {

        // Lưu lỗi để cảnh báo trong Modal.
        // Không hủy kết quả tạo tài khoản trước đó.
        facilityError = err.message;
      }
    }

    // Hoàn tất quá trình gửi API.
    setBusy(false);

    // Lưu kết quả thành công.
    // State done có giá trị sẽ làm Modal xuất hiện.
    // Lưu password để Admin xem và sao chép một lần.
    setDone({ user: created, password: form.password, facilityError });
  };


  /*
   * COPY - SAO CHÉP THÔNG TIN ĐĂNG NHẬP
   *
   * Dùng Clipboard API của trình duyệt.
   * Sao chép username hoặc mật khẩu tạm thời.
   */

  const copy = async (text) => {
    try {

      // Ghi chuỗi được truyền vào clipboard.
      await navigator.clipboard.writeText(text);

      // Hiển thị toast sao chép thành công.
      notify("Đã sao chép.");

    } catch {

      // Thông báo nếu trình duyệt không cho phép sao chép.
      notify("Không sao chép được, vui lòng chép thủ công.", "error");
    }
  };


  /*
   * RENDER GIAO DIỆN TẠO TÀI KHOẢN
   */

  return (
    <main className="result">

      {/* FORM CHÍNH
          onSubmit gọi hàm submit khi Admin nhấn Tạo tài khoản.
          noValidate tắt validation mặc định của HTML,
          để sử dụng hàm validate tự viết phía trên. */}
      <form className="panel admin-form" onSubmit={submit} noValidate>

        <h1>Thêm tài khoản mới</h1>
        <p className="lead">Tạo tài khoản và gán vai trò phù hợp. Gửi tên đăng nhập và mật khẩu tạm thời cho người dùng để đăng nhập lần đầu.</p>

        {/* Hiển thị lỗi khi tải danh sách vai trò/cơ sở. */}
        {meta.error && <Notice tone="error">{meta.error}</Notice>}

        {/* Hiển thị lỗi chung khi tạo tài khoản thất bại. */}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}


        {/* TRƯỜNG HỌ VÀ TÊN
            Lấy giá trị từ form.fullName.
            Khi nhập, gọi set để cập nhật state. */}
        <Field label="Họ và tên" error={errors.fullName}>
          <input autoComplete="off" placeholder="Nhập họ và tên" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>


        {/* TRƯỜNG EMAIL
            Khi email thay đổi, hàm set có thể tự tạo username
            nếu Admin chưa chỉnh tên đăng nhập thủ công. */}
        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="off" placeholder="ten@safespace.vn" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>


        {/* TRƯỜNG SỐ ĐIỆN THOẠI - KHÔNG BẮT BUỘC */}
        <Field label="Số điện thoại" error={errors.phone}>
          <input type="tel" autoComplete="off" placeholder="09xx xxx xxx" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>


        {/* HAI TRƯỜNG USERNAME VÀ MẬT KHẨU TẠM THỜI */}
        <div className="form-row">

          {/* USERNAME
              Khi Admin tự sửa username:
              - setUserTouched(true) ngừng tự sinh theo email.
              - trim() loại bỏ khoảng trắng đầu/cuối. */}
          <Field label="Tên đăng nhập" error={errors.username}>
            <input autoComplete="off" placeholder="tên đăng nhập" value={form.username} onChange={(e) => { setUserTouched(true); set("username", e.target.value.trim()); }} />
          </Field>

          {/* MẬT KHẨU TẠM THỜI
              Admin có thể sửa hoặc nhấn Tạo mới để sinh lại. */}
          <Field label="Mật khẩu tạm thời" error={errors.password}>
            <span className="input-action">

              {/* Hiển thị mật khẩu đang được lưu trong form. */}
              <input autoComplete="new-password" value={form.password} onChange={(e) => set("password", e.target.value)} />

              {/* Tạo mật khẩu ngẫu nhiên mới bằng tempPassword(). */}
              <button type="button" onClick={() => set("password", tempPassword())} aria-label="Tạo mật khẩu khác">Tạo mới</button>
            </span>
          </Field>
        </div>


        {/* KHU VỰC CHỌN VAI TRÒ
            Hiển thị mỗi role dưới dạng một nút lựa chọn. */}
        <div className={`field${errors.roleId ? " field--invalid" : ""}`}>
          <span className="field__label" id="role-label">Vai trò</span>
          <div className="role-chips" role="radiogroup" aria-labelledby="role-label">

            {/* Render danh sách vai trò lấy từ API. */}
            {roles.map((r) => (
              <button
                type="button"
                key={r.roleId}

                // Khai báo nút có hành vi giống radio.
                role="radio"

                // Xác định vai trò này đang được chọn hay không.
                aria-checked={String(form.roleId) === String(r.roleId)}

                // Thêm class is-on để làm nổi bật role đang chọn.
                className={String(form.roleId) === String(r.roleId) ? "is-on" : ""}

                // Khi click, cập nhật roleId của form.
                onClick={() => set("roleId", r.roleId)}
              >
                {/* Hiển thị tên vai trò dễ đọc. */}
                {roleLabel(r.roleName)}
              </button>
            ))}

            {/* Trong lúc API tải vai trò, hiển thị thông báo. */}
            {meta.loading && <span className="muted">Đang tải vai trò…</span>}
          </div>

          {/* Hiển thị lỗi nếu chưa chọn vai trò. */}
          {errors.roleId && <p className="field__error" role="alert">{errors.roleId}</p>}
        </div>


        {/* CHỌN CƠ SỞ PHỤ TRÁCH
            Chỉ bật khi scoped = true (Staff/Manager).
            Vai trò toàn hệ thống không cần chọn cơ sở. */}
        <Field label="Cơ sở phụ trách" error={errors.facilityId}>
          <Select value={form.facilityId} disabled={!scoped} onChange={(e) => set("facilityId", e.target.value)}>

            {/* Placeholder thay đổi theo việc vai trò có cần cơ sở. */}
            <option value="">{scoped ? "Chọn cơ sở" : "Không áp dụng cho vai trò này"}</option>

            {/* Chỉ render cơ sở ACTIVE đã lọc từ API. */}
            {(meta.data?.facilities || []).map((f) => (
              <option key={f.facilityId} value={f.facilityId}>{f.name}</option>
            ))}
          </Select>
        </Field>


        {/* GHI CHÚ GIẢI THÍCH QUY TẮC PHÂN CÔNG CƠ SỞ */}
        <p className="note-box">
          "Cơ sở phụ trách" chỉ áp dụng cho vai trò gắn với một cơ sở cụ thể (Nhân viên, Quản lý cơ sở). Vận hành KD và Quản trị có quyền trên toàn hệ thống.
        </p>


        {/* NÚT TẠO TÀI KHOẢN
            disabled khi đang gửi request hoặc đang tải metadata.
            Text đổi thành "Đang tạo..." trong lúc xử lý. */}
        <Button type="submit" block disabled={busy || meta.loading}>{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</Button>

        {/* QUAY LẠI DANH SÁCH TÀI KHOẢN */}
        <p className="auth__switch">
          <a href="#/admin">← Về danh sách tài khoản</a>
        </p>
      </form>


      {/* MODAL SAU KHI TẠO TÀI KHOẢN THÀNH CÔNG
          Chỉ xuất hiện khi done khác null.
          Khi đóng Modal sẽ chuyển sang trang chi tiết User. */}
      {flowEl}
      {done && (
        <Modal title="Đã tạo tài khoản" onClose={() => go(`admin/users/${done.user.userId}`)}>

          {/* Thông báo Admin cần gửi thông tin đăng nhập
              cho người dùng mới và mật khẩu chỉ hiển thị một lần. */}
          <p className="modal__text">Gửi thông tin đăng nhập dưới đây cho {done.user.fullName}. Mật khẩu chỉ hiển thị một lần.</p>

          {/* HIỂN THỊ USERNAME VÀ PASSWORD */}
          <dl className="detail-list">

            {/* Username của tài khoản vừa được tạo.
                Nút Chép gọi hàm copy(username). */}
            <div><dt>Tên đăng nhập</dt><dd>{done.user.username} <button type="button" className="link-btn" onClick={() => copy(done.user.username)}>Chép</button></dd></div>

            {/* Mật khẩu tạm thời.
                Nút Chép gọi hàm copy(password). */}
            <div><dt>Mật khẩu tạm thời</dt><dd>{done.password} <button type="button" className="link-btn" onClick={() => copy(done.password)}>Chép</button></dd></div>
          </dl>

          {/* Nếu tạo User thành công nhưng phân công cơ sở lỗi,
              hiển thị thông báo để Admin phân công lại sau. */}
          {done.facilityError && <Notice tone="error">Chưa phân công được cơ sở: {done.facilityError}. Bạn có thể phân công lại trong trang chi tiết.</Notice>}

          <div className="modal__actions">

            {/* Chuyển đến trang chi tiết User vừa tạo. */}
            <Button onClick={() => go(`admin/users/${done.user.userId}`)}>Xem tài khoản</Button>

            {/* RESET FORM ĐỂ TẠO THÊM TÀI KHOẢN
                - Đóng Modal.
                - Đưa các trường về giá trị mặc định.
                - Tạo mật khẩu tạm thời mới.
                - Cho phép username tự sinh lại theo email. */}
            <Button
              variant="outline"
              onClick={() => {
                setDone(null);
                setForm({ ...EMPTY, password: tempPassword() });
                setUserTouched(false);
              }}
            >
              Tạo tài khoản khác
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}