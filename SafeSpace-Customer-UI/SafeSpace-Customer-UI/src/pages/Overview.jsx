import React from "react";
import { useCustomer } from "../context";
import {
  Badge,
  Button,
  LinkButton,
  Icon,
  PageTitle,
  StorageArt,
  Empty,
} from "../components/UI";
import { money, dateLabel, dateTimeLabel, paymentTypes } from "../domain";

export function UnitCard({ contract: c }) {
  const { data } = useCustomer();
  const u = data.units.find((u) => u.unit_id === c.unit_id),
    f = data.facilities.find((f) => f.facility_id === u.facility_id),
    t = data.unitTypes.find((t) => t.unit_type_id === u.unit_type_id);
  return (
    <article className="ss-unit-card">
      <div className="ss-unit-visual">
        <StorageArt variant={f.color} />
        <Badge status={c.status} />
        <span className="ss-unit-number">{u.unit_number}</span>
      </div>
      <div className="ss-card-body">
        <div className="ss-row">
          <h3>Kho {t.name}</h3>
          <span className="ss-size">{t.size} m²</span>
        </div>
        <p className="ss-muted-line">
          <Icon name="pin" size={15} />
          {f.name}
        </p>
        <div className="ss-unit-meta">
          <div>
            <small>Ngày kết thúc</small>
            <strong>{dateLabel(c.end_date)}</strong>
          </div>
          <div>
            <small>Giá thuê / tháng</small>
            <strong>{money(c.agreed_monthly_rate)}</strong>
          </div>
        </div>
        <LinkButton to={`units/${c.contract_id}`} variant="outline full">
          Xem chi tiết <Icon name="arrow" size={16} />
        </LinkButton>
      </div>
    </article>
  );
}
export default function Overview() {
  const { data } = useCustomer();
  const active = data.contracts.filter((c) =>
    ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"].includes(c.status),
  );
  const due = data.payments.filter((p) =>
    ["PENDING", "FAILED"].includes(p.status),
  );
  const h = data.handovers.find((h) => h.status === "SCHEDULED");
  const tickets = data.tickets.filter(
    (t) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status),
  );
  const exp = data.contracts.find((c) => c.status === "EXPIRING");
  return (
    <>
      <PageTitle
        title={`Xin chào, ${data.user.full_name.split(" ").slice(-2).join(" ")}`}
        description="Mọi không gian lưu trữ của bạn, gọn gàng ở một nơi."
      >
        <LinkButton to="find" icon="plus">
          Thuê thêm kho
        </LinkButton>
      </PageTitle>
      <section className="ss-welcome">
        <div>
          <span className="ss-eyebrow">SAFESPACE CUSTOMER</span>
          <h2>
            Thêm không gian.
            <br />
            <span>Thêm an tâm.</span>
          </h2>
          <p>
            Theo dõi kho thuê, thanh toán và lịch hẹn
            <br className="desktop" /> chỉ với vài thao tác.
          </p>
          <LinkButton to="units" variant="light">
            Quản lý kho của tôi <Icon name="arrow" size={17} />
          </LinkButton>
        </div>
        <StorageArt />
        <div className="ss-hero-caption">
          <Icon name="shield" size={15} /> Không gian riêng · An tâm lưu trữ
        </div>
      </section>
      <section className="ss-stats">
        {[
          [
            "box",
            "Kho đang thuê",
            active.length,
            "Không gian của bạn",
            "units",
          ],
          [
            "card",
            "Cần thanh toán",
            money(due.reduce((s, p) => s + p.amount, 0)),
            `${due.length} khoản cần xử lý`,
            "payments",
          ],
          [
            "calendar",
            "Lịch nhận kho",
            h ? "01" : "00",
            h ? dateTimeLabel(h.scheduled_at) : "Chưa có lịch hẹn mới",
            "appointments",
          ],
          [
            "help",
            "Yêu cầu hỗ trợ",
            String(tickets.length).padStart(2, "0"),
            "Đang được cơ sở xử lý",
            "support",
          ],
        ].map(([icon, label, value, note, to]) => (
          <a href={`#/customer/${to}`} className="ss-stat" key={label}>
            <div className="ss-row">
              <span>{label}</span>
              <span className={`ss-stat-icon ${icon}`}>
                <Icon name={icon} />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </a>
        ))}
      </section>
      {exp && (
        <div className="ss-renew-banner">
          <span className="ss-alert-icon">
            <Icon name="clock" />
          </span>
          <div>
            <strong>
              Kho{" "}
              {data.units.find((u) => u.unit_id === exp.unit_id).unit_number}{" "}
              sắp đến ngày gia hạn
            </strong>
            <p>
              Hợp đồng kết thúc ngày {dateLabel(exp.end_date)}. Gửi yêu cầu sớm
              để tiếp tục lưu trữ.
            </p>
          </div>
          <LinkButton to={`units/${exp.contract_id}`} variant="outline">
            Xem hợp đồng <Icon name="arrow" size={16} />
          </LinkButton>
        </div>
      )}
      <div className="ss-section-heading">
        <div>
          <h2>Kho của tôi</h2>
          <p>Những không gian đang đồng hành cùng bạn.</p>
        </div>
        <a href="#/customer/units">
          Xem tất cả <Icon name="arrow" size={16} />
        </a>
      </div>
      <div className="ss-grid two">
        {active.slice(0, 2).map((c) => (
          <UnitCard key={c.contract_id} contract={c} />
        ))}
      </div>
      <div className="ss-grid two ss-bottom-grid">
        <section className="ss-panel">
          <div className="ss-section-heading">
            <h2>Thanh toán sắp tới</h2>
            <a href="#/customer/payments">Xem tất cả</a>
          </div>
          {due.length ? (
            due.slice(0, 3).map((p) => (
              <a
                className="ss-list-row"
                key={p.payment_id}
                href={`#/customer/payments/${p.payment_id}`}
              >
                <span className="ss-soft-icon">
                  <Icon name="card" />
                </span>
                <div>
                  <strong>{paymentTypes[p.payment_type]}</strong>
                  <small>
                    {p.contract_id} · Hạn {dateLabel(p.due_date)}
                  </small>
                </div>
                <b>{money(p.amount)}</b>
                <Icon name="chevron" size={16} />
              </a>
            ))
          ) : (
            <Empty
              title="Bạn đã thanh toán đủ"
              text="Không có khoản nào cần xử lý."
            />
          )}
        </section>
        <section className="ss-panel">
          <div className="ss-section-heading">
            <h2>Bạn cần hỗ trợ?</h2>
            <Icon name="help" />
          </div>
          <p className="muted">
            Vấn đề về kho, khóa hoặc thanh toán? Gửi yêu cầu để nhân viên tại cơ
            sở hỗ trợ bạn.
          </p>
          <LinkButton to="support/new" variant="outline" icon="plus">
            Tạo yêu cầu hỗ trợ
          </LinkButton>
          <div className="ss-help-note">
            <Icon name="clock" size={17} /> Theo dõi tiến độ ngay trong tài
            khoản
          </div>
        </section>
      </div>
    </>
  );
}
