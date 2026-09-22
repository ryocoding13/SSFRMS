import React, { useState } from "react";
import { DatePicker, Select } from "../components/Pickers";
import { Button, Empty, Field, LinkButton, Notice, PageHeader, StatusTag, Tag } from "../components/UI";
import { RENTAL_PLANS, bandLabel, typeLabel } from "../lib/catalog";
import { addDays, addMonths, dateLabel, dayMonth, money, rangeLabel, today } from "../lib/format";
import { shortName } from "../lib/hooks";
import { go, href } from "../lib/router";
import { CONTRACT_STATUS, LEDGER_STATUS } from "../lib/status";
import { contractOf, contractStatus, facilityOf, pendingRenewal, pendingReturn } from "../state/selectors";
import { useApp } from "../state/store";

const compact = (s) => s.replaceAll(" – ", "–");

function NotFound() {
  return (
    <main className="container page">
      <Empty title="Không tìm thấy hợp đồng" text="Hợp đồng này không tồn tại hoặc không thuộc tài khoản của bạn.">
        <LinkButton to="units">Về kho của tôi</LinkButton>
      </Empty>
    </main>
  );
}

// C06 — Kho của tôi
export function Units() {
  const { data } = useApp();
  return (
    <main className="container page">
      <PageHeader title="Kho của tôi" description="Theo dõi kho đang thuê, hợp đồng và các mốc cần xử lý." />
      {data.contracts.length === 0 ? (
        <Empty title="Bạn chưa thuê kho nào" text="Các kho đang thuê sẽ xuất hiện tại đây sau khi cơ sở xác nhận đơn đặt chỗ.">
          <LinkButton to="find">Tìm & đặt kho</LinkButton>
        </Empty>
      ) : (
        <div className="grid grid--2">
          {data.contracts.map((c) => {
            const f = facilityOf(data, c.facility_id);
            return (
              <article className="panel unit-card" key={c.contract_id}>
                <StatusTag map={CONTRACT_STATUS} status={contractStatus(c)} square />
                <h2>{c.unit_number} · {typeLabel(c.type)}</h2>
                <p className="muted">SafeSpace {f.district} · {c.size_m2} m²</p>
                <h3>Thời hạn hợp đồng</h3>
                <p className="muted">
                  Ngày kết thúc: {dateLabel(c.end_date)}
                  <br />
                  {c.handed_over ? "Đã bàn giao" : "Chờ bàn giao"} · Ra vào {f.hours}
                </p>
                <a className="btn btn--primary" href={href(`units/${c.contract_id}`)}>Xem hợp đồng & quản lý</a>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

// C07 — Hợp đồng & quản lý kho
export function UnitDetail({ id }) {
  const { data } = useApp();
  const c = contractOf(data, id);
  if (!c) return <NotFound />;
  const f = facilityOf(data, c.facility_id);
  const renewal = pendingRenewal(data, id);
  const ret = pendingReturn(data, id);
  const rent = [...data.ledger].reverse().find((l) => l.contract_id === id && /-RENT$/.test(l.ref));
  const busy = Boolean(renewal || ret);
  return (
    <main className="container page">
      <PageHeader title={`Kho ${c.unit_number} · Hợp đồng thuê`} description={`${c.contract_id} · ${f.name}`} />
      <div className="detail-grid detail-grid--even">
        <section className="panel info-card">
          <StatusTag map={CONTRACT_STATUS} status={contractStatus(c)} square />
          <h2 className="h-sub">{typeLabel(c.type)} · {c.size_m2} m²</h2>
          <p className="muted">
            {c.location} · Kho {c.unit_number}
            <br />
            Kỳ thuê: {rangeLabel(c.start_date, c.end_date)}
            <br />
            Khách hàng: {data.user.full_name}
          </p>
          <table className="table table--inner">
            <thead>
              <tr><th>Khoản mục</th><th>Giá trị</th></tr>
            </thead>
            <tbody>
              <tr><td>Tiền thuê mỗi tháng</td><td>{money(c.monthly_rate)}</td></tr>
              <tr><td>Tiền cọc đang giữ</td><td>{money(c.deposit)}</td></tr>
              <tr><td>Thanh toán kỳ này</td><td>{rent ? LEDGER_STATUS[rent.status][0] : "—"}</td></tr>
            </tbody>
          </table>
          <h3>Thông tin ra vào</h3>
          <p className="muted">
            {c.handed_over
              ? "Thẻ ra vào đã bàn giao. Liên hệ cơ sở khi mất thẻ hoặc gặp lỗi mã truy cập."
              : "Thẻ ra vào và khóa sẽ được bàn giao tại cơ sở theo lịch hẹn nhận kho."}
          </p>
        </section>
        <aside className="panel booking">
          <h2>Bạn cần làm gì?</h2>
          {renewal && <Notice>Yêu cầu gia hạn thêm {renewal.months} tháng đang chờ cơ sở duyệt.</Notice>}
          {ret && <Notice>Yêu cầu trả kho ngày {dateLabel(ret.date)} đang chờ cơ sở xác nhận.</Notice>}
          <div className="stack stack--col">
            {busy ? (
              <>
                <Button disabled>Yêu cầu gia hạn</Button>
                <Button variant="outline" disabled>Đăng ký trả kho</Button>
              </>
            ) : (
              <>
                <LinkButton to={`units/${id}/renew`}>Yêu cầu gia hạn</LinkButton>
                <LinkButton to={`units/${id}/return`} variant="outline">Đăng ký trả kho</LinkButton>
              </>
            )}
            <LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Gửi yêu cầu hỗ trợ</LinkButton>
          </div>
          <p className="hint">Gia hạn và trả kho cần cơ sở xác nhận. Tiền cọc được đối chiếu sau kiểm tra kho.</p>
        </aside>
      </div>
    </main>
  );
}

// C08 — Yêu cầu gia hạn
export function Renew({ id }) {
  const { data, dispatch } = useApp();
  const c = contractOf(data, id);
  const [months, setMonths] = useState(3);
  const [error, setError] = useState("");
  if (!c) return <NotFound />;
  const newEnd = addMonths(c.end_date, months);
  const submit = (e) => {
    e.preventDefault();
    const res = dispatch("REQUEST_RENEWAL", { contract_id: id, months });
    if (!res.ok) return setError(res.error);
    go(`sent?type=renew&contract=${encodeURIComponent(id)}`);
  };
  return (
    <main className="container page">
      <PageHeader title={`Gia hạn kho ${c.unit_number}`} description="Giữ không gian hiện tại sau khi cơ sở kiểm tra kỳ thuê tiếp theo." />
      <form className="panel form-card" onSubmit={submit}>
        <Field label="Thời hạn hiện tại">
          <input readOnly value={`Đến ${dateLabel(c.end_date)}`} />
        </Field>
        <Field label="Kỳ gia hạn đề xuất">
          <Select value={months} onChange={(e) => { setMonths(Number(e.target.value)); setError(""); }}>
            {RENTAL_PLANS.map((m) => (
              <option key={m} value={m}>{`${dateLabel(c.end_date)}–${dateLabel(addMonths(c.end_date, m))} · ${m} tháng`}</option>
            ))}
          </Select>
        </Field>
        <h3>Chi phí dự kiến</h3>
        <p className="muted">
          {months} × {money(c.monthly_rate)} = {money(months * c.monthly_rate)}. Thanh toán sau khi yêu cầu được duyệt. Không hoàn lại tiền cọc đang giữ.
        </p>
        <p className="visually-hidden" aria-live="polite">Ngày kết thúc mới dự kiến {dateLabel(newEnd)}</p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="stack">
          <Button type="submit">Gửi yêu cầu gia hạn</Button>
          <LinkButton to={`units/${id}`} variant="outline">Quay lại hợp đồng</LinkButton>
        </div>
      </form>
    </main>
  );
}

export const RETURN_SLOTS = ["09:00–09:30", "10:00–10:30", "14:00–14:30", "15:30–16:00"];

// C09 — Đăng ký trả kho
export function Return({ id }) {
  const { data, dispatch } = useApp();
  const c = contractOf(data, id);
  const [date, setDate] = useState(() => (c && c.end_date >= today() ? c.end_date : addDays(today(), 1)));
  const [slot, setSlot] = useState(RETURN_SLOTS[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  if (!c) return <NotFound />;
  const submit = (e) => {
    e.preventDefault();
    const res = dispatch("REQUEST_RETURN", { contract_id: id, date, slot, notes });
    if (!res.ok) return setError(res.error);
    go(`sent?type=return&contract=${encodeURIComponent(id)}`);
  };
  return (
    <main className="container page">
      <PageHeader title={`Đăng ký trả kho ${c.unit_number}`} description="Chọn lịch hẹn để cơ sở kiểm tra tình trạng kho và đối chiếu tiền cọc." />
      <form className="panel form-card" onSubmit={submit}>
        <div className="form-row">
          <DatePicker label="Ngày mong muốn" value={date} min={today()} onChange={(v) => { setDate(v); setError(""); }} />
          <Field label="Giờ mong muốn">
            <Select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {RETURN_SLOTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Ghi chú">
          <input maxLength={300} placeholder="Ví dụ: Đã lên kế hoạch chuyển hết đồ trước giờ hẹn." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <h3>Trước khi trả kho</h3>
        <p className="muted">Dọn hết đồ · Trả thẻ/chìa khóa · Có mặt để kiểm tra cùng nhân viên.</p>
        <h3>Đối chiếu tiền cọc</h3>
        <p className="muted">
          Cọc đang giữ: {money(c.deposit)}. Khoản hoàn thực tế được xác nhận sau kiểm tra và trừ các khoản còn phải trả theo chính sách.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="stack">
          <Button type="submit">Gửi lịch trả kho</Button>
          <LinkButton to={`units/${id}`} variant="outline">Quay lại hợp đồng</LinkButton>
        </div>
      </form>
    </main>
  );
}

// C10 — Yêu cầu đã gửi
export function Sent({ query }) {
  const contract = query.get("contract");
  return (
    <main className="container page">
      <PageHeader title="Đã gửi yêu cầu đến cơ sở" description="Yêu cầu đã được ghi nhận. Bạn sẽ nhận thông báo khi có kết quả." />
      <section className="panel form-card">
        <Tag tone="amber" square>Chờ cơ sở xác nhận</Tag>
        <h3>Tiếp theo</h3>
        <p className="muted">
          Nhân viên hoặc quản lý kiểm tra thông tin và phản hồi qua thông báo. Trạng thái thuê kho hiện tại vẫn được giữ cho đến khi yêu cầu được xử lý.
        </p>
        <div className="stack stack--col">
          <LinkButton to="units">Về kho của tôi</LinkButton>
          {contract && <LinkButton to={`units/${encodeURIComponent(contract)}`} variant="outline">Xem hợp đồng</LinkButton>}
        </div>
      </section>
    </main>
  );
}
