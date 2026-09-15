import React, { useState } from "react";
import { useCustomer } from "../context";
import {
  Badge,
  Button,
  LinkButton,
  Icon,
  PageTitle,
  Empty,
  Field,
  Details,
  Notice,
} from "../components/UI";
import { dateLabel, dateTimeLabel, issueTypes, uid } from "../domain";
export default function Support({ id, query }) {
  const { data, command, notify, navigate } = useCustomer();
  const [filter, setFilter] = useState("ALL");
  const [form, setForm] = useState({
    contract_id: query.get("contract") || "",
    issue_type: "UNIT",
    title: "",
    description: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErrors((previous) => {
      const next = { ...previous };
      delete next[k];
      return next;
    });
  };
  const submit = async (e) => {
    e.preventDefault();
    const err = {};
    if (!form.contract_id) err.contract_id = "Vui lòng chọn kho / hợp đồng.";
    if (!form.title.trim()) err.title = "Vui lòng nhập tiêu đề.";
    if (!form.description.trim())
      err.description = "Vui lòng mô tả vấn đề cần hỗ trợ.";
    setErrors(err);
    if (Object.keys(err).length) return;
    const ticket_id = uid("HT");
    setSubmitting(true);
    try {
      const res = await command("TICKET", { ...form, ticket_id });
      if (res) {
        notify("Đã gửi yêu cầu hỗ trợ.");
        const nextId =
          typeof res === "object" && res.ticket_id ? res.ticket_id : ticket_id;
        navigate(`support/${nextId}`);
      }
    } finally {
      setSubmitting(false);
    }
  };
  if (id === "new")
    return (
      <>
        <a className="ss-back" href="#/customer/support">
          <Icon name="back" size={17} /> Yêu cầu hỗ trợ
        </a>
        <PageTitle
          title="Chúng mình có thể giúp gì?"
          description="Mô tả vấn đề để nhân viên tại cơ sở hỗ trợ bạn nhanh hơn."
        />
        <div className="ss-grid detail">
          <form className="ss-panel" onSubmit={submit} noValidate>
            <h2>Tạo yêu cầu hỗ trợ</h2>
            <Field
              label="Kho / Hợp đồng liên quan *"
              error={errors.contract_id}
            >
              <select
                value={form.contract_id}
                onChange={(e) => set("contract_id", e.target.value)}
              >
                <option value="">Chọn kho cần hỗ trợ</option>
                {data.contracts.map((c) => (
                  <option key={c.contract_id} value={c.contract_id}>
                    {
                      data.units.find((u) => u.unit_id === c.unit_id)
                        .unit_number
                    }{" "}
                    · {c.contract_id}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Loại vấn đề *">
              <select
                value={form.issue_type}
                onChange={(e) => set("issue_type", e.target.value)}
              >
                {Object.entries(issueTypes).map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Tiêu đề *"
              error={errors.title}
              hint={`${form.title.length}/150 ký tự`}
            >
              <input
                maxLength={150}
                placeholder="Ví dụ: Khóa kho A-102 khó mở"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
            <Field label="Mô tả chi tiết *" error={errors.description}>
              <textarea
                rows={6}
                maxLength={5000}
                placeholder="Vấn đề xảy ra khi nào? Bạn đã thử cách xử lý nào?"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            <div className="ss-form-actions">
              <LinkButton to="support" variant="outline">
                Quay lại
              </LinkButton>
              <Button type="submit" icon="arrow">
                Gửi yêu cầu
              </Button>
            </div>
          </form>
          <aside className="ss-panel ss-fit">
            <span className="ss-soft-icon">
              <Icon name="help" size={26} />
            </span>
            <h2>Luôn sẵn sàng hỗ trợ</h2>
            <p className="muted">
              Yêu cầu sẽ được chuyển đến cơ sở quản lý hợp đồng bạn chọn.
            </p>
            <ol className="ss-simple-list">
              <li>Chọn đúng kho gặp vấn đề.</li>
              <li>Mô tả cụ thể tình trạng hiện tại.</li>
              <li>Theo dõi trạng thái tại “Yêu cầu hỗ trợ”.</li>
            </ol>
            <Notice>
              Nếu không thể vào kho, hãy liên hệ quầy hỗ trợ tại cơ sở trong giờ
              làm việc.
            </Notice>
          </aside>
        </div>
      </>
    );
  if (id) {
    const t = data.tickets.find((t) => String(t.ticket_id) === String(id));
    if (!t) return <Empty title="Không tìm thấy yêu cầu" />;
    return (
      <>
        <a className="ss-back" href="#/customer/support">
          <Icon name="back" size={17} /> Yêu cầu hỗ trợ
        </a>
        <PageTitle title={t.title} description={`Mã: ${t.ticket_id}`}>
          <Badge status={t.status} />
        </PageTitle>
        <div className="ss-grid detail">
          <section className="ss-panel">
            <h2>Nội dung yêu cầu</h2>
            <p className="ss-description">{t.description}</p>
            <Details
              items={[
                ["Loại vấn đề", issueTypes[t.issue_type] || t.issue_type],
                [
                  "Kho liên quan",
                  data.units.find((u) => String(u.unit_id) === String(t.unit_id))
                    ?.unit_number ||
                    data.contracts.find((c) => String(c.contract_id) === String(t.contract_id))
                      ?.unit_number ||
                    "Kho lưu trữ",
                ],
                ["Hợp đồng", t.contract_id],
                ["Thời gian gửi", dateTimeLabel(t.created_at)],
              ]}
            />
            {["OPEN", "ASSIGNED"].includes(t.status) && (
              <div style={{ marginTop: "1rem" }}>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (window.confirm("Bạn có chắc chắn muốn hủy yêu cầu này?")) {
                      const ok = await command("CANCEL_TICKET", { id: t.ticket_id });
                      if (ok) notify("Đã hủy yêu cầu hỗ trợ thành công.");
                    }
                  }}
                >
                  Hủy yêu cầu hỗ trợ
                </Button>
              </div>
            )}
          </section>
          <section className="ss-panel ss-fit">
            <h2>Tiến độ xử lý</h2>
            <div className="ss-timeline">
              <div className="complete">
                <strong>Đã gửi yêu cầu</strong>
                <small>{dateLabel(t.created_at)}</small>
              </div>
              <div
                className={
                  ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(
                    t.status,
                  )
                    ? "complete"
                    : ""
                }
              >
                <strong>Nhân viên tiếp nhận</strong>
                <small>
                  {t.status === "OPEN"
                    ? "Đang chờ cơ sở tiếp nhận"
                    : "Đã chuyển đến cơ sở phụ trách"}
                </small>
              </div>
              <div
                className={
                  ["RESOLVED", "CLOSED"].includes(t.status) ? "complete" : ""
                }
              >
                <strong>Hoàn tất xử lý</strong>
                <small>
                  {["RESOLVED", "CLOSED"].includes(t.status)
                    ? "Cơ sở đã xử lý yêu cầu"
                    : "Sẽ cập nhật khi xử lý xong"}
                </small>
              </div>
            </div>
            <LinkButton
              to={`support/new?contract=${t.contract_id}`}
              variant="outline full"
            >
              Gửi yêu cầu khác
            </LinkButton>
          </section>
        </div>
      </>
    );
  }
  const list = data.tickets.filter(
    (t) =>
      filter === "ALL" ||
      (filter === "OPEN"
        ? ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(t.status)
        : ["RESOLVED", "CLOSED"].includes(t.status)),
  );
  return (
    <>
      <PageTitle
        title="Yêu cầu hỗ trợ"
        description="Theo dõi và giải quyết các vấn đề liên quan đến kho thuê."
      >
        <LinkButton to="support/new" icon="plus">
          Tạo yêu cầu
        </LinkButton>
      </PageTitle>
      <div className="ss-tabs">
        {[
          ["ALL", "Tất cả yêu cầu"],
          ["OPEN", "Đang xử lý"],
          ["RESOLVED", "Đã giải quyết"],
        ].map(([v, l]) => (
          <button
            key={v}
            className={filter === v ? "active" : ""}
            onClick={() => setFilter(v)}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="ss-panel ss-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Yêu cầu</th>
              <th>Loại vấn đề</th>
              <th>Ngày gửi</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.ticket_id}>
                <td>
                  <strong>{t.title}</strong>
                  <small>{t.ticket_id}</small>
                </td>
                <td>{issueTypes[t.issue_type]}</td>
                <td>{dateLabel(t.created_at)}</td>
                <td>
                  <Badge status={t.status} />
                </td>
                <td>
                  <a
                    className="ss-table-link"
                    href={`#/customer/support/${t.ticket_id}`}
                  >
                    Chi tiết <Icon name="chevron" size={15} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <Empty
            title="Chưa có yêu cầu trong mục này"
            text="Bạn có thể gửi yêu cầu mới khi cần hỗ trợ."
          />
        )}
      </div>
    </>
  );
}
export function Profile() {
  const { data, command, notify } = useCustomer();
  const [name, setName] = useState(data.user.full_name),
    [phone, setPhone] = useState(data.user.phone),
    [errors, setErrors] = useState({});
  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!name.trim()) err.name = "Vui lòng nhập họ tên.";
    if (phone && !/^(0\d{9}|\+84\d{9})$/.test(phone.replace(/\s/g, "")))
      err.phone = "Số điện thoại gồm 10 số, bắt đầu bằng 0 hoặc +84.";
    setErrors(err);
    if (
      !Object.keys(err).length &&
      command("PROFILE", {
        full_name: name.trim(),
        phone: phone.replace(/\s/g, ""),
      })
    )
      notify("Đã lưu thông tin cá nhân trong bản demo.");
  };
  return (
    <>
      <PageTitle
        title="Tài khoản của tôi"
        description="Cập nhật thông tin liên hệ để cơ sở hỗ trợ bạn thuận tiện hơn."
      />
      <div className="ss-grid detail">
        <form className="ss-panel" onSubmit={submit} noValidate>
          <h2>Thông tin cá nhân</h2>
          <Field label="Họ và tên *" error={errors.name}>
            <input
              autoComplete="name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input type="email" value={data.user.email} disabled />
            <small className="muted">
              Liên hệ bộ phận hỗ trợ nếu bạn cần đổi email.
            </small>
          </Field>
          <Field label="Số điện thoại" error={errors.phone}>
            <input
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Button type="submit">Lưu thay đổi</Button>
        </form>
        <aside className="ss-panel ss-fit">
          <span className="ss-avatar large">
            {data.user.full_name
              .split(" ")
              .slice(-2)
              .map((s) => s[0])
              .join("")}
          </span>
          <h2>{data.user.full_name}</h2>
          <p className="muted">{data.user.email}</p>
          <Badge tone="blue">Khách hàng</Badge>
          <p className="muted ss-mt">
            Thông tin liên hệ được dùng cho lịch hẹn, hợp đồng và các yêu cầu hỗ
            trợ của bạn.
          </p>
        </aside>
      </div>
    </>
  );
}
