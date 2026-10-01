import React, { useMemo, useState } from "react";
import { Pagination, Select } from "../components/Pickers";
import { Button, Empty, Field, Icon, LinkButton, Modal, Notice, Tag } from "../components/UI";
import { typeLabel } from "../lib/catalog";
import { dateLabel, dateTimeLabel, daysBetween, rangeLabel, today } from "../lib/format";
import { go, href, qs } from "../lib/router";
import { UNIT_STATE } from "./data";
import { ASSIGN_STATE, candidateUnits } from "./reducer";
import { useOps } from "./store";
import { QueuePicker, millions, slotLabel } from "./util";

const RENTED = ["ACTIVE", "EXPIRING", "OVERDUE", "WAITING_HANDOVER"];
const occupancy = (units) => Math.round((units.filter((u) => RENTED.includes(u.status)).length / Math.max(1, units.length)) * 100);
const growth = (months) => {
  if (months.length < 2) return 0;
  const [a, b] = months.slice(-2).map((m) => m.value);
  return a ? ((b - a) / a) * 100 : 0;
};
const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`;

// ---------------------------------------------------------------- M01
export function ManagerOverview() {
  const { ops } = useOps();
  const renewals = ops.renewals.filter((r) => r.status === "PENDING");
  const overdue = ops.units.filter((u) => u.status === "OVERDUE");
  const allocations = ops.allocations.filter((a) => a.status === "PENDING");
  const returned = ops.contracts.filter((c) => c.state === "RETURNED");
  const unassigned = ops.assignments.filter((a) => a.status === "OPEN");
  const mismatch = ops.payments.filter((p) => p.status === "MISMATCH");
  const month = ops.revenue.months.at(-1) || { value: 0 };
  const g = growth(ops.revenue.months);
  const items = [
    renewals.length && { key: "r", title: `${renewals.length} yêu cầu gia hạn đang chờ duyệt`, sub: "Cần phản hồi trong vòng 24 giờ", to: "manager/renewals", label: "Xem yêu cầu", primary: true },
    allocations.length && { key: "a", title: `${allocations.length} đơn đã đối soát chờ phân bổ kho`, sub: allocations.map((a) => a.id).join(", "), to: "manager/allocate", label: "Phân bổ kho", primary: true },
    unassigned.length && { key: "u", title: `${unassigned.length} công việc chưa phân công`, sub: unassigned.map((a) => a.title).join(" · "), to: "manager/assign", label: "Phân công" },
    overdue.length && { key: "o", title: `${overdue.length} kho quá hạn thanh toán`, sub: `Kho ${overdue.map((u) => `#${u.code}`).join(", ")}`, to: "manager/units?tab=OVERDUE", label: "Xem danh sách kho" },
    returned.length && { key: "t", title: `${returned.length} biên bản trả kho chờ xác nhận hoàn cọc`, sub: returned.map((c) => `${c.unit} · ${c.customer}`).join(", "), to: "manager/contracts", label: "Xem hợp đồng" },
    mismatch.length && { key: "m", title: `${mismatch.length} khoản thanh toán báo sai lệch`, sub: mismatch.map((p) => `${p.id} · ${p.customer}`).join(", "), to: "manager/contracts", label: "Xem chi tiết" },
  ].filter(Boolean);
  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>Tổng quan cơ sở — {ops.facility.name}</h1>
          <p>Cập nhật đến {dateLabel(today())}</p>
        </div>
      </header>
      <div className="stats stats--4">
        <div className="stat"><strong>{ops.units.length}</strong><span>Tổng số kho</span></div>
        <div className="stat"><strong className="tone-blue">{occupancy(ops.units)}%</strong><span>Tỷ lệ lấp đầy</span></div>
        <div className="stat"><strong className="ok">{millions(month.value)}</strong><span>Doanh thu tháng này</span><small className="ok">{pct(g)} so với tháng trước</small></div>
        <div className="stat"><strong className="warn">{renewals.length}</strong><span>Yêu cầu chờ duyệt</span></div>
      </div>
      <h2 className="section-title">Cần xử lý</h2>
      {items.length === 0 ? (
        <Empty title="Không có việc tồn đọng" text="Các yêu cầu mới từ khách hàng và nhân viên sẽ hiện ở đây." />
      ) : (
        <ul className="rows">
          {items.map((it) => (
            <li className="row ops-row" key={it.key}>
              <div className="row__main"><strong>{it.title}</strong><span>{it.sub}</span></div>
              <a className={`btn ${it.primary ? "btn--primary" : "btn--outline"}`} href={href(it.to)}>{it.label}</a>
            </li>
          ))}
        </ul>
      )}
      <div className="ops-actions">
        <LinkButton to="manager/units">Xem danh sách kho</LinkButton>
        <LinkButton to="manager/report" variant="outline">Xem báo cáo doanh thu</LinkButton>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- M02
const UNIT_TABS = [
  ["", "Tất cả"],
  ["ACTIVE", "Đang hoạt động"],
  ["EMPTY", "Trống"],
  ["EXPIRING", "Sắp hết hạn"],
  ["OVERDUE", "Quá hạn"],
  ["WAITING_HANDOVER", "Chờ bàn giao"],
];
const PER_PAGE = 12;
export function ManagerUnits({ query }) {
  const { ops } = useOps();
  const tab = query.get("tab") || "";
  const [search, setSearch] = useState("");
  const page = Math.max(1, Number(query.get("page")) || 1);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ops.units.filter((u) => (!tab || u.status === tab) && (!q || u.code.toLowerCase().includes(q) || (u.tenant || "").toLowerCase().includes(q)));
  }, [ops.units, tab, search]);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const count = (s) => (s ? ops.units.filter((u) => u.status === s).length : ops.units.length);
  return (
    <main className="container page">
      <header className="page-header page-header--tight"><div><h1>Danh sách kho — {ops.facility.name}</h1></div></header>
      <div className="admin-toolbar">
        <div className="chips" role="group" aria-label="Lọc theo trạng thái">
          {UNIT_TABS.map(([k, label]) => (
            <button type="button" key={k || "all"} className={`chip chip--dark${tab === k ? " is-on" : ""}`} aria-pressed={tab === k} onClick={() => go(`manager/units${qs({ tab: k })}`, { replace: true })}>
              {label} · {count(k)}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Tìm mã kho hoặc khách thuê" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm mã kho hoặc khách thuê" />
        </label>
      </div>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Mã kho</th><th>Khách thuê</th><th>Loại kho</th><th>Diện tích</th><th>Trạng thái</th><th>Hết hạn</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={6} className="table__empty">Không có kho phù hợp.</td></tr>}
            {shown.map((u) => {
              const [label, tone] = UNIT_STATE[u.status] || [u.status, "gray"];
              return (
                <tr key={u.code}>
                  <td className="cell-strong">#{u.code}</td>
                  <td>{u.tenant || "—"}</td>
                  <td>{typeLabel(u.type)}</td>
                  <td>{u.area} m² · Tầng {u.floor}</td>
                  <td><Tag tone={tone}>{label}</Tag></td>
                  <td>{u.end ? dateLabel(u.end) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={cur} pages={pages} total={list.length} from={(cur - 1) * PER_PAGE + 1} to={(cur - 1) * PER_PAGE + shown.length} noun="kho" onPage={(n) => go(`manager/units${qs({ tab, page: n === 1 ? "" : n })}`, { replace: true })} />
    </main>
  );
}

// ---------------------------------------------------------------- M05
export function ManagerAllocate({ query }) {
  const { ops, run } = useOps();
  const pending = ops.allocations.filter((a) => a.status === "PENDING");
  const a = ops.allocations.find((x) => x.id === query.get("id")) || pending[0];
  const units = a ? candidateUnits(ops, a) : [];
  const [pick, setPick] = useState(null);
  const chosen = units.find((u) => u.code === pick) || units[0];
  if (!a)
    return (
      <main className="container page">
        <Empty title="Không có đơn chờ phân bổ" text="Đơn đặt chỗ đã đối soát thanh toán sẽ hiện ở đây để chọn kho cụ thể.">
          <LinkButton to="manager">Về tổng quan</LinkButton>
        </Empty>
      </main>
    );
  const submit = async () => {
    const r = await run("ALLOCATE", { id: a.id, unit: chosen?.code }, `Đã phân bổ kho ${chosen?.code}`);
    if (r.ok) go("manager/done?kind=allocate");
  };
  return (
    <main className="container page">
      <QueuePicker label="Đơn chờ phân bổ" items={pending} current={a.id} base="manager/allocate" render={(x) => `${x.id.slice(-4)} · ${x.customer}`} />
      <PageHeaderBlock title="Phân bổ kho cho đơn đặt chỗ" text={`Phạm vi: ${ops.facility.name} · Chỉ hiển thị kho trống trong toàn bộ kỳ thuê.`} />
      <section className="panel ops-order">
        <Tag tone="green">Đã đối soát thanh toán</Tag>
        <strong>{a.id} · {a.customer}</strong>
        <span className="muted">{a.offer} · {rangeLabel(a.start, a.end)}</span>
        <span className="muted">Lịch nhận dự kiến: {dateTimeLabel(a.pickup)}</span>
      </section>
      {a.status === "DONE" ? (
        <Notice tone="success">Đã phân bổ kho {a.unit} lúc {dateTimeLabel(a.allocated_at)}. Nhân viên sẽ xác minh và bàn giao theo lịch hẹn.</Notice>
      ) : units.length === 0 ? (
        <Notice tone="error">Không còn kho trống khớp loại kho và diện tích trong kỳ thuê. Liên hệ khách để đổi lựa chọn hoặc cơ sở.</Notice>
      ) : (
        <>
          <div className="panel table-wrap">
            <table className="table table--hover">
              <thead><tr><th>Chọn</th><th>Mã kho</th><th>Diện tích / tầng</th><th>Tình trạng</th><th>Khả dụng</th></tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.code} onClick={() => setPick(u.code)} className={chosen?.code === u.code ? "is-picked" : ""}>
                    <td><input type="radio" name="unit" checked={chosen?.code === u.code} onChange={() => setPick(u.code)} aria-label={`Chọn kho ${u.code}`} /></td>
                    <td className="cell-strong">{u.code}</td>
                    <td>{u.area} m² · Tầng {u.floor}</td>
                    <td>Sẵn sàng</td>
                    <td><Tag tone="green">Trống toàn kỳ</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={submit}>Xác nhận phân bổ {chosen?.code}</Button>
        </>
      )}
    </main>
  );
}

function PageHeaderBlock({ title, text }) {
  return (
    <header className="page-header page-header--tight">
      <div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- M06
export function ManagerAssign() {
  const { ops, run } = useOps();
  const open = ops.assignments.filter((a) => a.status !== "DONE");
  const [task, setTask] = useState(() => (open.find((a) => a.status === "OPEN") || open[0])?.id || "");
  const [staff, setStaff] = useState(ops.staff[0]?.staff_id || "");
  const staffName = (id) => ops.staff.find((s) => s.staff_id === id)?.full_name || "Chưa phân công";
  const busyCount = (id) => ops.assignments.filter((a) => a.staff === id && a.status !== "DONE").length;
  const submit = async (e) => {
    e.preventDefault();
    const r = await run("ASSIGN", { id: task, staff }, `Đã phân công ${staffName(staff)}`);
    if (r.ok) go("manager/done?kind=assign");
  };
  return (
    <main className="container page">
      <PageHeaderBlock title="Phân công & lịch vận hành" text={`Sắp xếp bàn giao, kiểm tra kho và xử lý sự cố tại ${ops.facility.name}.`} />
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Công việc</th><th>Lịch hẹn</th><th>Nhân viên</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {ops.assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{slotLabel(a.when)}</td>
                <td>{staffName(a.staff)}</td>
                <td><Tag tone={ASSIGN_STATE[a.status][1]}>{ASSIGN_STATE[a.status][0]}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open.length > 0 ? (
        <form className="panel form-card" onSubmit={submit}>
          <Field label="Công việc">
            <Select value={task} onChange={(e) => setTask(e.target.value)}>
              {open.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </Select>
          </Field>
          <Field label="Nhân viên phụ trách">
            <Select value={staff} onChange={(e) => setStaff(e.target.value)}>
              {ops.staff.map((s) => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.full_name} · Ca {s.shift} · {busyCount(s.staff_id) ? `${busyCount(s.staff_id)} việc đang nhận` : "Còn lịch trống"}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Lưu phân công</Button>
        </form>
      ) : (
        <Notice tone="success">Tất cả công việc đã hoàn tất.</Notice>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- M03
export function ManagerRenewals() {
  const { ops, run } = useOps();
  const pending = ops.renewals.filter((r) => r.status === "PENDING");
  const done = ops.renewals.filter((r) => r.status !== "PENDING");
  const [reject, setReject] = useState(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const approve = (r) => run("DECIDE_RENEWAL", { id: r.id, approve: true }, `Đã duyệt gia hạn ${r.unit}`);
  const doReject = async () => {
    const out = await run("DECIDE_RENEWAL", { id: reject.id, approve: false, reason }, `Đã từ chối gia hạn ${reject.unit}`);
    if (!out.ok) return setErr(out.error);
    setReject(null);
    setReason("");
  };
  return (
    <main className="container page">
      <PageHeaderBlock title="Yêu cầu gia hạn chờ duyệt" text={pending.length ? `${pending.length} yêu cầu — vui lòng phản hồi trong vòng 24 giờ.` : "Không còn yêu cầu chờ duyệt."} />
      <ul className="rows">
        {pending.map((r) => (
          <li className="row ops-row" key={r.id}>
            <div className="row__main">
              <strong>{r.customer} — Kho #{r.unit}</strong>
              <span>Gia hạn {r.months} tháng từ {dateLabel(r.from)} đến {dateLabel(r.to)}</span>
              <span>Gửi yêu cầu: {dateLabel(r.requested.slice(0, 10))} · {r.contract}</span>
            </div>
            <div className="ops-actions ops-actions--tight">
              <Button onClick={() => approve(r)}>Duyệt</Button>
              <Button variant="outline" className="btn--danger-text" onClick={() => { setReject(r); setErr(""); }}>Từ chối</Button>
            </div>
          </li>
        ))}
      </ul>
      {done.length > 0 && (
        <>
          <h2 className="section-title">Đã xử lý</h2>
          <ul className="rows">
            {done.map((r) => (
              <li className="row ops-row" key={r.id}>
                <div className="row__main">
                  <strong>{r.customer} — Kho #{r.unit}</strong>
                  <span>{r.status === "APPROVED" ? `Gia hạn đến ${dateLabel(r.to)}` : `Lý do: ${r.reason}`}</span>
                </div>
                <Tag tone={r.status === "APPROVED" ? "green" : "red"}>{r.status === "APPROVED" ? "Đã duyệt" : "Đã từ chối"}</Tag>
              </li>
            ))}
          </ul>
        </>
      )}
      <LinkButton to="manager" variant="outline">Về tổng quan</LinkButton>
      {reject && (
        <Modal title={`Từ chối gia hạn kho #${reject.unit}`} onClose={() => setReject(null)}>
          <p className="modal__text">Lý do sẽ được gửi đến {reject.customer}.</p>
          <Field label="Lý do từ chối" error={err}>
            <textarea rows={3} value={reason} placeholder="Ví dụ: kho đã có đơn đặt trước từ ngày …" onChange={(e) => { setReason(e.target.value); setErr(""); }} />
          </Field>
          <div className="modal__actions">
            <Button variant="danger" onClick={doReject}>Từ chối yêu cầu</Button>
            <Button variant="outline" onClick={() => setReject(null)}>Huỷ</Button>
          </div>
        </Modal>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- M07
const CONTRACT_STATE = (c) =>
  c.state === "OVERDUE"
    ? [`Quá hạn ${Math.max(1, daysBetween(c.end, today()))} ngày`, "red"]
    : c.state === "RENEWAL"
      ? ["Cần duyệt", "amber"]
      : c.state === "RETURNED"
        ? ["Chờ hoàn cọc", "blue"]
        : ["Đã xử lý", "green"];
export function ManagerContracts({ query }) {
  const { ops, run } = useOps();
  const sel = ops.contracts.find((c) => c.id === query.get("id")) || ops.contracts.find((c) => c.state === "RETURNED") || ops.contracts[0];
  const [note, setNote] = useState("");
  const mismatch = ops.payments.filter((p) => p.status === "MISMATCH");
  return (
    <main className="container page">
      <PageHeaderBlock title="Hợp đồng & xử lý quá hạn" text="Theo dõi hạn thuê, khoản chưa thanh toán và lịch sử nhắc tại cơ sở." />
      {mismatch.map((p) => (
        <Notice tone="error" key={p.id}>Nhân viên báo sai lệch thanh toán đơn {p.id} ({p.customer}): {p.note}</Notice>
      ))}
      <div className="panel table-wrap">
        <table className="table table--hover">
          <thead><tr><th>Hợp đồng / khách</th><th>Kho / ngày hết hạn</th><th>Khoản cần xử lý</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {ops.contracts.map((c) => {
              const [label, tone] = CONTRACT_STATE(c);
              return (
                <tr key={c.id} className={sel?.id === c.id ? "is-picked" : ""} onClick={() => go(`manager/contracts${qs({ id: c.id })}`, { replace: true })}>
                  <td className="cell-strong">{c.id} · {c.customer}</td>
                  <td>{c.unit} · {dateLabel(c.end)}</td>
                  <td>{c.due}</td>
                  <td><Tag tone={tone}>{label}</Tag></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sel && (
        <section className="panel form-card">
          <h2>{sel.id} · Bước tiếp theo</h2>
          {sel.state === "RETURNED" ? (
            <>
              <p className="muted">Nhân viên đã gửi biên bản trả kho {sel.unit}. Đối chiếu khoản còn nợ rồi xác nhận số tiền hoàn cọc.</p>
              <Button onClick={async () => (await run("CONFIRM_REFUND", { id: sel.id }, "Đã xác nhận hoàn cọc")).ok && go("manager/done?kind=refund")}>Xác nhận hoàn cọc</Button>
            </>
          ) : sel.state === "RENEWAL" ? (
            <>
              <p className="muted">Khách đã gửi yêu cầu gia hạn. Duyệt hoặc từ chối trong vòng 24 giờ.</p>
              <LinkButton to="manager/renewals">Xem yêu cầu gia hạn</LinkButton>
            </>
          ) : sel.state === "CLOSED" || sel.state === "RESOLVED" ? (
            <Notice tone="success">{sel.due}</Notice>
          ) : (
            <>
              <p className="muted">Kiểm tra thanh toán và trao đổi với khách trước khi áp dụng biện pháp xử lý. Ghi nhận liên hệ, phí phát sinh và quyết định của quản lý.</p>
              <Field label="Nội dung đã trao đổi (không bắt buộc)">
                <textarea rows={2} value={note} placeholder="Ví dụ: gọi điện nhắc, khách hẹn thanh toán trước 18:00" onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="ops-actions">
                <Button onClick={async () => { if ((await run("REMIND", { id: sel.id, note }, "Đã ghi nhận nhắc khách")).ok) setNote(""); }}>Ghi nhận đã nhắc khách</Button>
                <LinkButton to="manager/renewals" variant="outline">Xem yêu cầu gia hạn</LinkButton>
              </div>
            </>
          )}
          {sel.reminders.length > 0 && (
            <ul className="ops-notes">
              {sel.reminders.map((r, i) => <li key={i}><small>{dateTimeLabel(r.at)}</small>{r.text}</li>)}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- M04
export function ManagerReport() {
  const { ops } = useOps();
  const months = ops.revenue.months;
  const now = new Date();
  const cur = months.at(-1) || { value: 0, month: now.getMonth() + 1, year: now.getFullYear(), label: `Tháng ${now.getMonth() + 1}` };
  const max = 100;
  const typeTotal = ops.revenue.by_type.reduce((s, x) => s + x.value, 0);
  const occ = occupancy(ops.units);
  const rented = ops.units.filter((u) => RENTED.includes(u.status)).length;
  const exportCsv = () => {
    const rows = [["Tháng", "Doanh thu (triệu đồng)"], ...months.map((m) => [`${m.month}/${m.year}`, m.value]), [], ["Loại kho", "Doanh thu (triệu đồng)"], ...ops.revenue.by_type.map((t) => [t.label, t.value]), [], ["Tỷ lệ lấp đầy", `${occ}%`]];
    const csv = "﻿" + rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bao-cao-doanh-thu-${cur.month}-${cur.year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <main className="container page">
      <PageHeaderBlock title={`Báo cáo doanh thu — Tháng ${cur.month}/${cur.year}`} />
      <div className="stats">
        <div className="stat"><strong>{millions(cur.value)}</strong><span>Tổng doanh thu</span></div>
        <div className="stat"><strong className="ok">{pct(growth(months))}</strong><span>Tăng trưởng</span><small className="ok">so với tháng trước</small></div>
        <div className="stat"><strong className="tone-blue">{millions(cur.value / Math.max(1, rented))}</strong><span>Doanh thu TB / kho</span></div>
      </div>
      <div className="detail-grid">
        <section className="panel report-chart" aria-label="Doanh thu 6 tháng gần nhất">
          <h2>Doanh thu 6 tháng gần nhất (triệu đồng)</h2>
          <div className="bars">
            <div className="bars__axis" aria-hidden="true">{[100, 75, 50, 25, 0].map((n) => <span key={n}>{n}</span>)}</div>
            <div className="bars__plot">
              {months.map((m, i) => (
                <div className="bars__col" key={m.label}>
                  <b className={i === months.length - 1 ? "is-current" : ""}>{String(m.value.toFixed(1)).replace(".", ",")}</b>
                  <i className={i === months.length - 1 ? "is-current" : ""} style={{ height: `${(m.value / max) * 100}%` }} />
                  <span className={i === months.length - 1 ? "is-current" : ""}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <aside className="panel booking">
          <h2>Cơ cấu doanh thu theo loại kho</h2>
          {ops.revenue.by_type.map((t, i) => (
            <div className="meter" key={t.label}>
              <div className="meter__row"><span>{t.label}</span><strong>{millions(t.value)} · {Math.round((t.value / typeTotal) * 100)}%</strong></div>
              <div className="meter__track"><i className={`meter__fill meter__fill--${i}`} style={{ width: `${(t.value / typeTotal) * 100}%` }} /></div>
            </div>
          ))}
          <div className="meter">
            <div className="meter__row"><span>Tỷ lệ lấp đầy kho</span><strong>{occ}%</strong></div>
            <div className="meter__track"><i className="meter__fill meter__fill--2" style={{ width: `${occ}%` }} /></div>
          </div>
          <p className="hint">Số liệu tháng {cur.month}/{cur.year} · cập nhật đến {dateLabel(today())}</p>
        </aside>
      </div>
      <div className="ops-actions">
        <Button variant="outline" onClick={exportCsv}>Xuất báo cáo</Button>
        <LinkButton to="manager">Về tổng quan</LinkButton>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------- M08
const DONE_TEXT = {
  allocate: "Kho đã được giữ cho đơn đặt chỗ. Nhân viên cơ sở sẽ xác minh khách và bàn giao theo lịch hẹn.",
  assign: "Nhân viên được phân công đã nhận thông báo công việc mới.",
  refund: "Hợp đồng đã đóng, kho chuyển về trạng thái trống để cho thuê lại.",
};
export function ManagerDone({ query }) {
  return (
    <main className="container page page--narrow">
      <section className="panel ops-card ops-done">
        <span className="result__icon"><Icon name="check" size={30} /></span>
        <h1>Đã ghi nhận cập nhật</h1>
        <p className="muted">{DONE_TEXT[query.get("kind")] || "Thông tin công việc đã được lưu vào luồng vận hành của cơ sở."}</p>
        <Tag tone="green">Cập nhật thành công</Tag>
        <div className="note-box">
          <strong>Theo dõi bước tiếp theo</strong>
          <p className="muted">Kiểm tra danh sách kho, lịch phân công và công việc đang chờ nhân viên thực hiện.</p>
        </div>
        <div className="ops-actions">
          <LinkButton to="manager">Về tổng quan cơ sở</LinkButton>
          <LinkButton to="manager/assign" variant="outline">Xem lịch phân công</LinkButton>
        </div>
      </section>
    </main>
  );
}
