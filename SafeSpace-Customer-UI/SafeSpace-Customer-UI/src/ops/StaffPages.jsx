import React, { useState } from "react";
import { Select } from "../components/Pickers";
import { Button, Empty, Field, Icon, LinkButton, Modal, Notice, Tag } from "../components/UI";
import { typeLabel } from "../lib/catalog";
import { dateLabel, dateTimeLabel, money, today } from "../lib/format";
import { go, href } from "../lib/router";
import { useApp } from "../state/store";
import { UNIT_STATE } from "./data";
import { PAYMENT_STATE, TICKET_STATE, UNLOCK_METHODS } from "./reducer";
import { useOps } from "./store";
import { LIST_TEXT, TaskEmpty, TaskGrid, staffTasks } from "./tasks";
import { Facts, slotLabel } from "./util";

export const useMe = () => {
  const { user } = useApp();
  const { ops } = useOps();
  return ops.me || ops.staff.find((s) => s.full_name === user?.full_name) || ops.staff[0] || { staff_id: null, full_name: user?.full_name };
};

// ---------------------------------------------------------------- S01
export function StaffToday({ query }) {
  const { ops } = useOps();
  const me = useMe();
  const tasks = staffTasks(ops, me, "all");
  const count = (k) => tasks.filter((t) => t.kind === k).length;
  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>Công việc hôm nay — {dateLabel(today())}</h1>
          <p>{ops.facility.name}</p>
        </div>
      </header>
      <div className="stats">
        <div className="stat"><strong className="tone-blue">{ops.verifications.filter((v) => v.status === "TODO").length}</strong><span>Cần xác minh khách</span></div>
        <div className="stat"><strong className="warn">{count("reconcile")}</strong><span>Chờ đối soát thanh toán</span></div>
        <div className="stat"><strong className="ok">{count("support")}</strong><span>Yêu cầu hỗ trợ / bảo trì</span></div>
      </div>
      {tasks.length === 0 ? (
        <TaskEmpty
          title={LIST_TEXT.all.empty[0]}
          text={LIST_TEXT.all.empty[1]}
          action={<button type="button" className="btn btn--outline" onClick={() => window.location.reload()}>Tải lại danh sách</button>}
        />
      ) : (
        <>
          <h2 className="section-title">Danh sách việc cần xử lý · {tasks.length} việc</h2>
          <TaskGrid tasks={tasks} base="staff" query={query} />
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- S09
export function StaffReconcile({ query }) {
  const { ops, run } = useOps();
  const pending = ops.payments.filter((p) => p.status === "PENDING");
  const p = ops.payments.find((x) => x.id === query.get("id")) || pending[0];
  const [mismatch, setMismatch] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  if (!p)
    return (
      <main className="container page">
        <Empty title="Không có khoản chờ đối soát" text="Khi khách báo đã chuyển khoản, đơn sẽ hiện ở đây để đối chiếu với sao kê.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const done = p.status !== "PENDING";
  const confirm = async () => {
    const r = await run("CONFIRM_PAYMENT", { id: p.id }, `Đã xác nhận thu đơn ${p.id}`);
    if (r.ok) go("staff/done?kind=payment");
  };
  const report = async () => {
    const r = await run("REPORT_MISMATCH", { id: p.id, note });
    if (!r.ok) return setErr(r.error);
    setMismatch(false);
    go("staff/done?kind=mismatch");
  };
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/reconcile")}>← Danh sách đối soát</a>
      <section className="panel ops-card">
        <h1>Đối chiếu thanh toán</h1>
        <p className="muted">Đơn #{p.id} — kiểm tra đúng số tiền và nội dung chuyển khoản trước khi xác nhận đã thu.</p>
        <Facts
          rows={[
            ["Khách hàng", p.customer],
            ["Gói đặt chỗ", p.offer],
            ["Số tiền khách báo", <span className="price" key="a">{money(p.amount)}</span>],
            ["Phương thức", p.method],
            ["Thời gian khách báo", dateTimeLabel(p.reported_at)],
            ["Nội dung chuyển khoản", <code key="m">{p.memo}</code>],
          ]}
        />
        {done ? (
          <Notice tone={p.status === "CONFIRMED" ? "success" : "error"}>
            {PAYMENT_STATE[p.status][0]}{p.note ? `: ${p.note}` : ""}.
          </Notice>
        ) : (
          <>
            <Notice>Chỉ nhân viên có quyền mới được xác nhận đã thu, sau khi đối chiếu đúng giao dịch trên sao kê.</Notice>
            <div className="ops-actions">
              <Button onClick={confirm}>Xác nhận đã thu</Button>
              <Button variant="outline" className="btn--danger-text" onClick={() => setMismatch(true)}>Báo sai lệch</Button>
            </div>
          </>
        )}
      </section>
      {mismatch && (
        <Modal title="Báo sai lệch thanh toán" onClose={() => setMismatch(false)}>
          <p className="modal__text">Ghi rõ điểm chưa khớp để quản lý liên hệ khách hàng.</p>
          <Field label="Sai lệch ghi nhận" error={err}>
            <textarea rows={3} value={note} placeholder="Ví dụ: sao kê nhận 4.000.000 đ, thiếu 600.000 đ" onChange={(e) => { setNote(e.target.value); setErr(""); }} />
          </Field>
          <div className="modal__actions">
            <Button variant="danger" onClick={report}>Gửi báo cáo</Button>
            <Button variant="outline" onClick={() => setMismatch(false)}>Huỷ</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- S02
const DOC_TYPES = ["Căn cước công dân", "Chứng minh nhân dân", "Hộ chiếu"];
export function StaffVerify({ query }) {
  const { ops, run } = useOps();
  const todo = ops.verifications.filter((v) => v.status === "TODO");
  const v = ops.verifications.find((x) => x.id === query.get("id")) || todo[0];
  const [form, setForm] = useState({ doc_type: DOC_TYPES[0], doc_no: "", photo_ok: false, info_ok: false });
  const [err, setErr] = useState("");
  if (!v)
    return (
      <main className="container page">
        <Empty title="Không có khách cần xác minh" text="Khách đến nhận kho theo lịch hẹn sẽ hiện ở đây.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const set = (k, val) => {
    setForm({ ...form, [k]: val });
    setErr("");
  };
  const submit = async (e) => {
    e.preventDefault();
    const r = await run("VERIFY_CUSTOMER", { id: v.id, ...form }, `Đã xác minh ${v.customer}`);
    if (!r.ok) return setErr(r.error);
    const h = ops.handovers.find((x) => x.verification_id === v.id);
    go(h ? `staff/handover?id=${h.id}` : "staff");
  };
  const handover = ops.handovers.find((x) => x.verification_id === v.id);
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/verify")}>← Danh sách xác minh</a>
      <form className="panel ops-card" onSubmit={submit} noValidate>
        <h1>Xác minh khách hàng</h1>
        <p className="muted">Kiểm tra giấy tờ tuỳ thân trùng khớp với thông tin đặt chỗ trước khi cấp quyền ra vào.</p>
        <Facts rows={[["Họ và tên khách hàng", v.customer], ["Mã đặt chỗ", `#${v.reservation_id}`], ["Kho nhận", `#${v.unit} · Hẹn ${slotLabel(v.appointment)}`]]} />
        {v.status === "DONE" ? (
          <>
            <Notice tone="success">Đã xác minh bằng {v.doc_type} (…{v.doc_last4}) lúc {dateTimeLabel(v.verified_at)}.</Notice>
            {handover && handover.status !== "DONE" && <LinkButton to={`staff/handover?id=${handover.id}`}>Tiếp tục bàn giao kho</LinkButton>}
          </>
        ) : (
          <>
            <Field label="Loại giấy tờ">
              <Select value={form.doc_type} onChange={(e) => set("doc_type", e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Số giấy tờ" hint="Chỉ lưu 4 số cuối để đối chiếu.">
              <input inputMode="text" autoComplete="off" placeholder="Nhập số giấy tờ để đối chiếu" value={form.doc_no} onChange={(e) => set("doc_no", e.target.value)} />
            </Field>
            <label className="check-row">
              <span className="check"><input type="checkbox" checked={form.photo_ok} onChange={(e) => set("photo_ok", e.target.checked)} /><span /></span>
              Ảnh trên giấy tờ khớp với người đến nhận kho
            </label>
            <label className="check-row">
              <span className="check"><input type="checkbox" checked={form.info_ok} onChange={(e) => set("info_ok", e.target.checked)} /><span /></span>
              Thông tin giấy tờ trùng khớp với đơn đặt chỗ
            </label>
            {err && <Notice tone="error">{err}</Notice>}
            <Button type="submit" block>Xác minh thành công</Button>
          </>
        )}
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- S03
export function StaffHandover({ query }) {
  const { ops, run } = useOps();
  const waiting = ops.handovers.filter((h) => h.status === "WAITING");
  const h = ops.handovers.find((x) => x.id === query.get("id")) || waiting.find((x) => ops.verifications.find((v) => v.id === x.verification_id)?.status === "DONE") || waiting[0];
  const [method, setMethod] = useState("CARD");
  if (!h)
    return (
      <main className="container page">
        <Empty title="Không có kho chờ bàn giao" text="Kho được quản lý phân bổ sẽ hiện ở đây sau khi khách được xác minh.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const unit = ops.units.find((u) => u.code === h.unit);
  const verification = ops.verifications.find((v) => v.id === h.verification_id);
  const ready = !verification || verification.status === "DONE";
  const submit = async () => {
    const r = await run("HANDOVER", { id: h.id, method }, `Kho ${h.unit} đã được kích hoạt`);
    if (r.ok) go("staff/done?kind=handover");
  };
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/handover")}>← Danh sách bàn giao</a>
      <section className="panel ops-card">
        <h1>Bàn giao kho #{h.unit}</h1>
        <Facts
          rows={[
            ["Khách hàng", h.customer],
            ["Cơ sở", ops.facility.name],
            ["Loại kho", typeLabel(unit?.type)],
            ["Diện tích", unit ? `${unit.area} m²` : "—"],
          ]}
        />
        {h.status === "DONE" ? (
          <Notice tone="success">Đã bàn giao lúc {dateTimeLabel(h.done_at)} · {UNLOCK_METHODS.find(([k]) => k === h.method)?.[1]}.</Notice>
        ) : (
          <>
            <div className="field">
              <span className="field__label" id="unlock-label">Phương thức mở khoá</span>
              <div className="seg" role="group" aria-labelledby="unlock-label">
                {UNLOCK_METHODS.map(([k, label]) => (
                  <button type="button" key={k} className={method === k ? "is-on" : ""} aria-pressed={method === k} onClick={() => setMethod(k)}>{label}</button>
                ))}
              </div>
            </div>
            {!ready && (
              <Notice tone="error">
                Khách chưa được xác minh. <a href={href(`staff/verify?id=${verification.id}`)}>Xác minh khách trước</a>.
              </Notice>
            )}
            <Button block onClick={submit} disabled={!ready}>Xác nhận bàn giao — Kích hoạt kho</Button>
            <Notice tone="success">Sau khi bàn giao, kho chuyển sang trạng thái "Đang hoạt động" và khách hàng có thể sử dụng ngay.</Notice>
          </>
        )}
        <LinkButton to="staff" variant="outline" block>Về danh sách công việc</LinkButton>
      </section>
    </main>
  );
}

// ---------------------------------------------------------------- S04
const PROPOSALS = ["Chờ vệ sinh / kiểm tra trước khi cho thuê lại", "Sẵn sàng cho thuê lại", "Cần bảo trì trước khi cho thuê lại"];
export function StaffReturn({ query }) {
  const { ops, run } = useOps();
  const list = ops.returns.filter((r) => r.status === "SCHEDULED");
  const r = ops.returns.find((x) => x.id === query.get("id")) || list[0] || ops.returns[0];
  const [form, setForm] = useState({ items: "Đã chuyển hết đồ khỏi kho", walls: "Không ghi nhận hư hỏng mới", keys: "Đã nhận lại 01 thẻ", proposal: PROPOSALS[0] });
  const [err, setErr] = useState("");
  if (!r)
    return (
      <main className="container page">
        <Empty title="Không có lịch trả kho" text="Khách đăng ký trả kho sẽ hiện ở đây theo lịch hẹn.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErr("");
  };
  const submit = async (e) => {
    e.preventDefault();
    const out = await run("SUBMIT_RETURN", { id: r.id, report: form }, "Đã gửi biên bản trả kho cho quản lý");
    if (!out.ok) return setErr(out.error);
    go("staff/done?kind=return");
  };
  const submitted = r.status === "SUBMITTED";
  const report = submitted ? r.report : form;
  return (
    <main className="container page">
      <a className="back-link" href={href("staff/return")}>← Danh sách trả kho</a>
      <header className="page-header page-header--tight">
        <div>
          <h1>Kiểm tra & tiếp nhận trả kho</h1>
          <p>{r.unit} · {r.customer} · Lịch hẹn {dateTimeLabel(r.appointment)}</p>
        </div>
      </header>
      <div className="detail-grid">
        <form className="panel form-card" onSubmit={submit} noValidate>
          <Field label="Đồ lưu trữ"><input value={report.items} disabled={submitted} onChange={(e) => set("items", e.target.value)} /></Field>
          <Field label="Tường, sàn & cửa kho"><input value={report.walls} disabled={submitted} onChange={(e) => set("walls", e.target.value)} /></Field>
          <Field label="Khóa / thẻ ra vào"><input value={report.keys} disabled={submitted} onChange={(e) => set("keys", e.target.value)} /></Field>
          <Field label="Đề xuất trạng thái kho">
            <Select value={report.proposal} disabled={submitted} onChange={(e) => set("proposal", e.target.value)}>
              {PROPOSALS.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          {err && <Notice tone="error">{err}</Notice>}
          {submitted ? <Notice tone="success">Đã gửi biên bản lúc {dateTimeLabel(r.submitted_at)}. Chờ quản lý xác nhận hoàn cọc.</Notice> : <Button type="submit">Gửi biên bản cho quản lý</Button>}
        </form>
        <aside className="panel booking">
          <h2>Cọc đang giữ: {money(r.deposit)}</h2>
          <p className="muted">
            Khoản chưa đối soát: {money(r.unpaid)}
            <br />
            Số tiền hoàn dự kiến: chờ quản lý xác nhận
          </p>
          <p className="muted">Nhân viên ghi nhận tình trạng và đề xuất. Hoàn cọc chỉ thực hiện sau khi đối chiếu khoản còn phải trả.</p>
        </aside>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- S05
const NEXT_STATES = [
  ["WAITING_CUSTOMER", "Chờ khách xác nhận đã sử dụng được"],
  ["IN_PROGRESS", "Tiếp tục xử lý tại cơ sở"],
  ["DONE", "Đã xử lý xong · Đóng yêu cầu"],
];
export function StaffSupport({ query }) {
  const { ops, run } = useOps();
  const me = useMe();
  const mine = ops.tickets.filter((t) => t.status !== "DONE" && (t.assignee === me.staff_id || !t.assignee));
  const t = ops.tickets.find((x) => x.id === query.get("id")) || mine[0];
  const [note, setNote] = useState("Đã kiểm tra thông tin và hẹn hỗ trợ tại cơ sở.");
  const [next, setNext] = useState("WAITING_CUSTOMER");
  const [err, setErr] = useState("");
  if (!t)
    return (
      <main className="container page">
        <Empty title="Không có yêu cầu hỗ trợ" text="Yêu cầu được phân công cho bạn sẽ hiện ở đây.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const assignee = ops.staff.find((s) => s.staff_id === t.assignee);
  const submit = async (e) => {
    e.preventDefault();
    const r = await run("TICKET_RESPONSE", { id: t.id, note, next, staff: me.staff_id }, `Đã lưu phản hồi ${t.id}`);
    if (!r.ok) return setErr(r.error);
    go("staff/done?kind=support");
  };
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/support")}>← Danh sách hỗ trợ</a>
      <form className="panel ops-card" onSubmit={submit} noValidate>
        <div className="ops-card__head">
          <h1>Yêu cầu hỗ trợ {t.id}</h1>
          <Tag tone={TICKET_STATE[t.status][1]}>{TICKET_STATE[t.status][0]}</Tag>
        </div>
        <p className="muted">{ops.facility.name} · Kho {t.unit} · {t.customer}</p>
        <div className="note-box">
          <strong>{t.title}</strong>
          <p className="muted">Khách gửi {dateTimeLabel(t.created_at)}. Nhân viên phụ trách: {assignee?.full_name || "chưa phân công"}.</p>
        </div>
        {t.notes.length > 0 && (
          <ul className="ops-notes">
            {t.notes.map((n, i) => <li key={i}><small>{dateTimeLabel(n.at)}</small>{n.text}</li>)}
          </ul>
        )}
        {t.status === "DONE" ? (
          <Notice tone="success">Yêu cầu đã đóng.</Notice>
        ) : (
          <>
            <Field label="Ghi nhận xử lý" error={err}>
              <textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} />
            </Field>
            <Field label="Trạng thái tiếp theo">
              <Select value={next} onChange={(e) => setNext(e.target.value)}>
                {NEXT_STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <Button type="submit">Lưu phản hồi</Button>
          </>
        )}
      </form>
    </main>
  );
}

// ---------------------------------------------------------------- S06
const DONE_TEXT = {
  payment: ["Đã xác nhận thu", "Đơn chuyển sang bước phân bổ / bàn giao kho. Khách hàng nhận thông báo thanh toán thành công."],
  mismatch: ["Đã gửi báo sai lệch", "Quản lý cơ sở sẽ liên hệ khách để đối chiếu lại giao dịch."],
  handover: ["Đã bàn giao kho", "Kho chuyển sang trạng thái \"Đang hoạt động\" và khách hàng có thể sử dụng ngay."],
  return: ["Đã gửi biên bản trả kho", "Biên bản đã được chuyển đến quản lý cơ sở để xác nhận hoàn cọc."],
  support: ["Đã ghi nhận xử lý", "Phản hồi đã được chuyển đến khách hàng và quản lý cơ sở."],
};
export function StaffDone({ query }) {
  const [title, text] = DONE_TEXT[query.get("kind")] || ["Đã lưu thông tin xử lý", "Biên bản và phản hồi đã được chuyển đến người phụ trách."];
  return (
    <main className="container page page--narrow">
      <section className="panel ops-card ops-done">
        <span className="result__icon"><Icon name="check" size={30} /></span>
        <h1>{title}</h1>
        <p className="muted">{text}</p>
        <Tag tone="green">Đã ghi nhận</Tag>
        <div className="note-box">
          <strong>Lưu ý vận hành</strong>
          <p className="muted">Kho trả lại vẫn chờ kiểm tra/vệ sinh. Yêu cầu hỗ trợ chỉ đóng sau khi kết quả xử lý được xác nhận.</p>
        </div>
        <LinkButton to="staff" block>Về công việc trong ngày</LinkButton>
      </section>
    </main>
  );
}

export const unitStateTag = (s) => UNIT_STATE[s] || [s, "gray"];
