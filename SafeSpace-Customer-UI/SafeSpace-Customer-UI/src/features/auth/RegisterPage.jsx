// useState: lưu dữ liệu thay đổi trên giao diện.
// useEffect: thực hiện tác vụ sau khi render và khi dependency thay đổi.
import React, { useEffect, useState } from "react";

// Các thành phần giao diện dùng chung:
// Button: nút bấm; Field: nhãn, ô nhập và thông báo lỗi; Icon: biểu tượng.
import { Button, Field, Icon, Modal, Notice } from "../../shared/components/UI.jsx";

// go(): chuyển trang bằng code.
// href(): tạo đường dẫn dạng #/... để dùng trong thẻ <a>.
import { go, href } from "../../app/router.js";

// Lấy dữ liệu và chức năng được AppProvider chia sẻ cho ứng dụng.
import { useApp } from "../../app/state/AppProvider.jsx";

// Chọn trang đến tiếp theo, tránh quay lại trang login/register.
import { safeNext } from "./utils/safeNext.js";

/*
 * Trang đăng ký tài khoản khách hàng.
 *
 * Luồng chính:
 * 1. Người dùng nhập thông tin → cập nhật state form.
 * 2. Nhấn đăng ký → gọi hàm submit.
 * 3. submit gọi register từ AppProvider.
 * 4. Có lỗi → hiển thị lỗi; thành công → chuyển sang trang next.
 *
 * query là đối tượng URLSearchParams do phần điều hướng truyền vào.
 */
export function RegisterPage({ query }) {
  // register: chức năng đăng ký do AppProvider cung cấp.
  // authed: cho biết người dùng hiện đã đăng nhập hay chưa.
  // Trang này không tự gọi API trực tiếp.
  const { register, authed } = useApp();

  // Ví dụ URL có ?next=find thì query.get("next") trả về "find".
  // Theo safeNext hiện tại, nếu thiếu next hoặc next bắt đầu bằng
  // "login"/"register", trang đích được đổi thành "overview".
  const next = safeNext(query.get("next"));

  // form chứa giá trị hiện tại của các ô nhập.
  // setForm cập nhật dữ liệu và yêu cầu React render lại giao diện.
  // confirm là ô nhập lại mật khẩu để kiểm tra xác nhận.
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });

  // errors chứa thông báo lỗi theo từng trường, ví dụ:
  // { email: "Email không hợp lệ", form: "Không thể đăng ký" }.
  // errors.form dành cho lỗi chung của toàn biểu mẫu.
  const [errors, setErrors] = useState({});

  // busy = true khi đang chờ kết quả đăng ký.
  // Giao diện dùng giá trị này để khóa nút và đổi nội dung nút.
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  // Nếu người dùng đã đăng nhập thì chuyển khỏi trang đăng ký.
  // Effect chạy sau lần render đầu và khi authed hoặc next thay đổi.
  // replace: true thay thế mục hiện tại trong lịch sử trình duyệt,
  // giúp nút Back không quay lại đúng mục trang đăng ký vừa bị thay thế.
  useEffect(() => {
    if (authed && !busy && !success) go(next, { replace: true });
  }, [authed, next, busy, success]);

  /*
   * Cập nhật một ô nhập.
   * k là tên trường, ví dụ "email"; v là giá trị mới.
   * Ví dụ: set("email", "abc@gmail.com").
   */
  const set = (k, v) => {
    // ...form sao chép các trường đang có.
    // [k]: v thay giá trị của đúng trường được truyền vào,
    // đồng thời tạo object mới thay vì sửa trực tiếp state cũ.
    setForm({ ...form, [k]: v });

    // p là state errors mới nhất React truyền vào.
    // Giữ lỗi của các trường khác; xóa lỗi ở ô đang sửa và lỗi chung.
    // Gán undefined khiến các thông báo đó không còn được hiển thị.
    // Đây là xóa thông báo cũ, chưa phải kiểm tra lại dữ liệu.
    setErrors((p) => ({ ...p, [k]: undefined, form: undefined }));
  };

  // Hàm async cho phép dùng await để chờ kết quả đăng ký.
  // e là sự kiện submit do biểu mẫu phát ra.
  const submit = async (e) => {
    // Ngăn hành vi gửi form mặc định làm tải lại trang.
    e.preventDefault();

    // Bật trạng thái đang xử lý trước khi bắt đầu đăng ký.
    setBusy(true);

    // Chuyển toàn bộ dữ liệu form cho AppProvider xử lý.
    // register kiểm tra dữ liệu; cách lưu/gọi API tùy chế độ provider.
    // await chờ kết quả nhưng không chặn toàn bộ giao diện trình duyệt.
    const res = await register(form);

    // Tắt trạng thái đang xử lý sau khi register trả về kết quả.
    setBusy(false);

    // Nếu thất bại, lưu các lỗi để hiển thị rồi kết thúc hàm.
    // return ở đây ngăn chạy xuống lệnh chuyển trang phía dưới.
    if (!res.ok) return setErrors(res.errors);

    // Chỉ chuyển trang tại đây khi kết quả có ok = true.
    setSuccess(true);
  };

  return (
    <main className="auth">
      {/*
        onSubmit gọi submit khi người dùng gửi biểu mẫu.
        noValidate tắt kiểm tra form mặc định của trình duyệt;
        chức năng register đảm nhiệm kiểm tra dữ liệu của ứng dụng.
      */}
      <form className="panel auth__card" onSubmit={submit} noValidate>
        <h1>Tạo tài khoản khách hàng</h1>
        <p className="lead">Điền thông tin bên dưới để bắt đầu thuê kho cùng SafeSpace.</p>

        {/*
          Chỉ hiện lỗi chung nếu errors.form có nội dung.
          role="alert" giúp công nghệ hỗ trợ nhận biết thông báo lỗi.
        */}
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}

        {/*
          Các ô bên dưới dùng cùng một cơ chế:
          - value lấy dữ liệu từ state form.
          - onChange lấy giá trị mới qua e.target.value.
          - set(...) ghi giá trị mới trở lại state.
          Vì React quản lý giá trị ô nhập, đây là controlled input.

          Field nhận error tương ứng để hiển thị lỗi dưới ô nhập.
          autoComplete gợi ý loại dữ liệu cho trình duyệt tự điền.
        */}
        <Field label="Họ và tên" error={errors.name}>
          <input autoComplete="name" placeholder="Nhập họ và tên của bạn" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>

        <Field label="Email" error={errors.email}>
          <input type="email" autoComplete="email" placeholder="ban@vidu.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>

        {/* type="tel" hỗ trợ nhập số điện thoại, không tự xác nhận số hợp lệ. */}
        <Field label="Số điện thoại" error={errors.phone}>
          <input type="tel" autoComplete="tel" placeholder="09xx xxx xxx" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>

        {/* type="password" che ký tự trên màn hình, không phải mã hóa dữ liệu. */}
        <Field label="Mật khẩu" error={errors.password}>
          <input type="password" autoComplete="new-password" placeholder="Tạo mật khẩu" value={form.password} onChange={(e) => set("password", e.target.value)} />
        </Field>

        {/* Việc so sánh confirm với password nằm trong kiểm tra của register. */}
        <Field label="Xác nhận mật khẩu" error={errors.confirm}>
          <input type="password" autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} />
        </Field>

        {/*
          type="submit" gửi biểu mẫu và kích hoạt onSubmit.
          disabled={busy} khóa nút trong thời gian chờ kết quả.
          Biểu thức điều kiện đổi chữ trên nút theo trạng thái busy.
          block là thuộc tính của Button giúp nút rộng hết hàng.
        */}
        <Button type="submit" block disabled={busy}>{busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}</Button>

        {/* Đây là thông tin hiển thị; việc gán vai trò không diễn ra ở đoạn JSX này. */}
        <p className="auth__role">
          <Icon name="check" size={14} /> Tài khoản mới sẽ tự động vào vai trò Khách hàng.
        </p>

        {/* href("login") tạo đường dẫn #/login cho người đã có tài khoản. */}
        <p className="auth__switch">
          Đã có tài khoản? <a href={href("login")}>Đăng nhập</a>
        </p>
      </form>
      {success && <Modal title="Đăng ký thành công" onClose={() => go(next)}><Notice tone="success">Tài khoản khách hàng đã được tạo. Bạn đã được đăng nhập.</Notice><Button onClick={() => go(next)}>Tiếp tục</Button></Modal>}
    </main>
  );
}
