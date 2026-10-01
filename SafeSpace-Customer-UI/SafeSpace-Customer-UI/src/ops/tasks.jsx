import React from "react";
import { Pagination } from "../components/Pickers";
import { Icon } from "../components/UI";
import { dateLabel, money, today } from "../lib/format";
import { go, href, qs } from "../lib/router";
import { TICKET_STATE } from "./reducer";
import { useOps } from "./store";
import { slotLabel } from "./util";

// Trong câu: "Hẹn hôm nay · 14:00"
const slot = (iso) => slotLabel(iso).replace(/^Hôm nay/, "hôm nay");

// Danh sách việc của nhân viên dạng thẻ, lưới 3x3 (Figma S01 / S09a / S02a / S03a / S04a / S05a).
export const KINDS = {
  reconcile: { label: "ĐỐI SOÁT", route: "staff/reconcile" },
  handover: { label: "BÀN GIAO", route: "staff/handover" },
  verify: { label: "XÁC MINH", route: "staff/verify" },
  support: { label: "HỖ TRỢ", route: "staff/support" },
  return: { label: "TRẢ KHO", route: "staff/return" },
};

// Tiêu đề + mô tả + trạng thái trống của từng tab
export const LIST_TEXT = {
  all: { empty: ["Chưa có công việc nào hôm nay", "Khi khách báo chuyển khoản, đến nhận / trả kho hoặc gửi yêu cầu hỗ trợ, công việc sẽ hiện ở đây."] },
  reconcile: {
    title: "Đối soát thanh toán",
    sub: (n) => (n ? `${n} khoản khách báo đã chuyển khoản · đối chiếu với sao kê trước khi xác nhận đã thu.` : "Đối chiếu khoản khách báo đã chuyển khoản với sao kê."),
    empty: ["Chưa có khoản nào cần đối soát", "Khoản khách báo “Tôi đã chuyển khoản” sẽ hiện ở đây."],
  },
  verify: {
    title: "Xác minh khách hàng",
    sub: (n) => (n ? `${n} khách đến nhận kho theo lịch hẹn · kiểm tra giấy tờ trước khi bàn giao.` : "Kiểm tra giấy tờ của khách đến nhận kho."),
    empty: ["Chưa có khách cần xác minh", "Khách đến nhận kho theo lịch hẹn sẽ hiện ở đây."],
  },
  handover: {
    title: "Bàn giao kho",
    sub: () => "Kho đã phân bổ, chờ bàn giao. Kho chỉ bàn giao được sau khi khách được xác minh.",
    empty: ["Chưa có kho chờ bàn giao", "Kho được quản lý phân bổ sẽ hiện ở đây."],
  },
  return: {
    title: "Kiểm tra trả kho",
    sub: () => "Lịch khách trả kho tại cơ sở · ghi nhận tình trạng và gửi biên bản cho quản lý.",
    empty: ["Chưa có lịch trả kho", "Khách đăng ký trả kho sẽ hiện ở đây theo lịch hẹn."],
  },
  support: {
    title: "Yêu cầu hỗ trợ",
    sub: () => "Yêu cầu được phân công cho bạn hoặc chưa có người nhận tại cơ sở.",
    empty: ["Chưa có yêu cầu hỗ trợ", "Yêu cầu được phân công cho bạn sẽ hiện ở đây."],
  },
};

// Gom việc của nhân viên. `all` = trang Công việc ngày (bàn giao chỉ tính kho đã xác minh khách).
export function staffTasks(ops, me, kind = "all") {
  const verified = (h) => ops.verifications.find((v) => v.id === h.verification_id)?.status !== "TODO";
  const list = [];
  if (kind === "all" || kind === "reconcile")
    ops.payments
      .filter((p) => p.status === "PENDING")
      .forEach((p) =>
        list.push({
          key: p.id, kind: "reconcile", status: ["Chờ đối soát", "amber"], title: `Đơn #${p.id}`,
          meta: `${p.customer} · ${p.offer}`, when: `${money(p.amount)} · Khách báo ${slot(p.reported_at).replace(" · ", " lúc ")}`,
          cta: "Đối soát ngay", to: `staff/reconcile?id=${p.id}`, sort: p.reported_at,
        }),
      );
  if (kind === "all" || kind === "handover")
    ops.handovers
      .filter((h) => h.status === "WAITING" && (kind === "handover" || verified(h)))
      .forEach((h) => {
        const unit = ops.units.find((u) => u.code === h.unit);
        const v = ops.verifications.find((x) => x.id === h.verification_id);
        const ready = verified(h);
        list.push({
          key: h.id, kind: "handover", status: ready ? ["Sẵn sàng bàn giao", "green"] : ["Chờ xác minh", "gray"],
          title: `Kho #${h.unit} · ${h.customer}`,
          meta: `${ready ? "Đã xác minh khách · " : ""}${unit?.type === "climate" ? "Kiểm soát nhiệt độ" : "Kho thường"}${unit ? ` · ${unit.area} m²` : ""}`,
          when: v ? `Hẹn ${slot(v.appointment)}` : "Chưa có lịch hẹn",
          cta: ready ? "Bàn giao" : "Xác minh trước", outline: !ready,
          to: ready ? `staff/handover?id=${h.id}` : `staff/verify?id=${v?.id}`, sort: v?.appointment || "",
        });
      });
  if (kind === "all" || kind === "verify")
    ops.verifications
      .filter((v) => v.status === "TODO")
      .forEach((v) =>
        list.push({
          key: v.id, kind: "verify", status: ["Chưa xử lý", "blue"], title: v.customer,
          meta: `Nhận kho #${v.unit} · Đơn ${v.reservation_id}`, when: `Hẹn ${slot(v.appointment)}`,
          cta: "Xác minh", to: `staff/verify?id=${v.id}`, sort: v.appointment,
        }),
      );
  if (kind === "all" || kind === "support")
    ops.tickets
      .filter((t) => t.status !== "DONE" && (t.assignee === me?.staff_id || !t.assignee))
      .forEach((t) =>
        list.push({
          key: t.id, kind: "support", status: TICKET_STATE[t.status], title: `${t.id} · ${t.title}`,
          meta: `Kho ${t.unit} · ${t.customer}`, when: `Hẹn ${slot(t.schedule)}`,
          cta: "Xử lý", to: `staff/support?id=${t.id}`, sort: t.schedule,
        }),
      );
  if (kind === "all" || kind === "return")
    ops.returns
      .filter((r) => r.status === "SCHEDULED")
      .forEach((r) =>
        list.push({
          key: r.id, kind: "return", status: ["Đã lên lịch", "gray"], title: `Kho #${r.unit} · ${r.customer}`,
          meta: `Cọc đang giữ ${money(r.deposit)} · Còn nợ ${money(r.unpaid)}`, when: `Hẹn ${slot(r.appointment)}`,
          cta: "Kiểm tra", outline: true, to: `staff/return?id=${r.id}`, sort: r.appointment,
        }),
      );
  // Trong cùng một loại: việc đến hạn sớm trước (thứ tự loại giữ theo mức ưu tiên ở trên)
  const order = Object.keys(KINDS);
  return list.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.sort.localeCompare(b.sort));
}

export function TaskCard({ task }) {
  const [label, tone] = task.status;
  return (
    <article className="panel task-card">
      <div className="task-card__top">
        <span className="task-card__kind">{KINDS[task.kind].label}</span>
        <span className={`tag tag--${tone}`}>{label}</span>
      </div>
      <h3>{task.title}</h3>
      <p className="muted">{task.meta}</p>
      <p className="task-card__when">{task.when}</p>
      <a className={`btn btn--block ${task.outline ? "btn--outline" : "btn--primary"}`} href={href(task.to)}>{task.cta}</a>
    </article>
  );
}

const PER_PAGE = 9;
export function TaskGrid({ tasks, base, query }) {
  const pages = Math.max(1, Math.ceil(tasks.length / PER_PAGE));
  const page = Math.min(Math.max(1, Number(query?.get("page")) || 1), pages);
  const from = (page - 1) * PER_PAGE;
  const shown = tasks.slice(from, from + PER_PAGE);
  return (
    <>
      <div className="task-grid" aria-label="Danh sách công việc">
        {shown.map((t) => <TaskCard key={t.key} task={t} />)}
      </div>
      <Pagination
        page={page}
        pages={pages}
        total={tasks.length}
        from={from + 1}
        to={from + shown.length}
        noun="việc"
        onPage={(n) => go(`${base}${qs({ page: n === 1 ? "" : n })}`, { replace: false })}
      />
    </>
  );
}

export function TaskEmpty({ title, text, action }) {
  return (
    <section className="task-empty" role="status">
      <span className="task-empty__icon" aria-hidden="true"><Icon name="check" size={26} /></span>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

// Trang danh sách của một tab nhân viên (Đối soát / Xác minh / Bàn giao / Trả kho / Hỗ trợ)
export function StaffTaskList({ kind, query, me }) {
  const { ops } = useOps();
  const tasks = staffTasks(ops, me, kind);
  const txt = LIST_TEXT[kind];
  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>{txt.title}</h1>
          <p>{txt.sub(tasks.length)}</p>
        </div>
      </header>
      {tasks.length === 0 ? (
        <TaskEmpty title={txt.empty[0]} text={txt.empty[1]} action={<a className="btn btn--outline" href={href("staff")}>Về công việc trong ngày</a>} />
      ) : (
        <TaskGrid tasks={tasks} base={KINDS[kind].route} query={query} />
      )}
    </main>
  );
}

export const todayLabel = () => dateLabel(today());
