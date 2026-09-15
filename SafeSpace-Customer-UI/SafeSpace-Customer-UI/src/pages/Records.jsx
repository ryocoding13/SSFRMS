import React, { useState } from "react";
import { useCustomer } from "../context";
import {
  Badge,
  Button,
  LinkButton,
  Icon,
  PageTitle,
  StorageArt,
  Empty,
  Details,
  Notice,
} from "../components/UI";
import { money, dateLabel, dateTimeLabel, paymentTypes } from "../domain";
import { UnitCard } from "./Overview";
export function Reservations({ id }) {
  const { data, openModal } = useCustomer();
  const [filter, setFilter] = useState("ALL");
  const reservations = data.reservations.filter(
    (r) => filter === "ALL" || r.status === filter,
  );
  if (id) {
    const r = data.reservations.find((r) => String(r.reservation_id) === String(id));
    if (!r) return <Empty title="Không tìm thấy đơn đặt kho" />;
    const f = data.facilities.find((f) => String(f.facility_id) === String(r.facility_id)) || {
        name: r.facility_name || "SafeSpace",
        color: "blue",
      },
      t = data.unitTypes.find((t) => String(t.unit_type_id) === String(r.unit_type_id)) || {
        name: r.unit_type_name || "Tiêu chuẩn",
        size: 10,
      },
      c = data.contracts.find((c) => String(c.reservation_id) === String(r.reservation_id));
    const step = [
      "PENDING_PAYMENT",
      "UNIT_ASSIGNED",
      "CONFIRMED",
      "CHECKED_IN",
    ].indexOf(r.status);
    return (
      <>
        <a className="ss-back" href="#/customer/reservations">
          <Icon name="back" size={17} /> Đơn đặt kho
        </a>
        <PageTitle
          title={`Đơn ${r.reservation_id}`}
          description="Theo dõi quá trình chuẩn bị không gian của bạn."
        >
          <Badge status={r.status} />
        </PageTitle>
        {step >= 0 && (
          <div className="ss-steps">
            {[
              "Gửi yêu cầu",
              "Phân bổ & thanh toán",
              "Xác nhận",
              "Nhận kho",
            ].map((s, i) => (
              <div className={i <= step ? "done" : ""} key={s}>
                <span>
                  {i < step ? <Icon name="check" size={16} /> : i + 1}
                </span>
                <strong>{s}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="ss-grid detail">
          <section className="ss-panel">
            <StorageArt variant={f.color} />
            <h2>
              {f.name} · Kho {t.name}
            </h2>
            <Details
              items={[
                ["Diện tích", `${t.size} m²`],
                ["Ngày bắt đầu", dateLabel(r.start_date)],
                ["Ngày kết thúc dự kiến", dateLabel(r.expected_end_date)],
                ["Thời hạn", `${r.rental_period_months} tháng`],
                [
                  "Kho được phân bổ",
                  c
                    ? data.units.find((u) => u.unit_id === c.unit_id)
                        .unit_number
                    : "Chờ quản lý phân bổ",
                ],
              ]}
            />
            {r.status === "PENDING_PAYMENT" && (
              <Notice>
                Yêu cầu đã được ghi nhận. Cơ sở sẽ kiểm tra lịch trống và phân
                bổ kho phù hợp. Khoản thanh toán sẽ xuất hiện sau khi có hợp
                đồng.
              </Notice>
            )}
            {r.cancellation_reason && (
              <Notice>Lý do hủy: {r.cancellation_reason}</Notice>
            )}
          </section>
          <aside className="ss-panel">
            <h2>Chi phí dự kiến</h2>
            <Details
              items={[
                ["Đơn giá / tháng", money(r.quoted_monthly_rate)],
                [
                  `Tiền thuê ${r.rental_period_months} tháng`,
                  money(r.quoted_monthly_rate * r.rental_period_months),
                ],
                ["Tiền đặt cọc", money(r.required_deposit)],
              ]}
            />
            <div className="ss-total">
              <span>Tổng dự kiến</span>
              <strong>{money(r.estimated_amount)}</strong>
            </div>
            <p className="muted">
              Mức cọc mẫu bằng 1 tháng thuê. Số tiền chính thức được xác nhận
              khi tạo hợp đồng.
            </p>
            {c && (
              <LinkButton to={`units/${c.contract_id}`} variant="full">
                Xem hợp đồng
              </LinkButton>
            )}
            {r.status === "CONFIRMED" && (
              <LinkButton to="appointments" variant="outline full">
                Xem lịch nhận kho
              </LinkButton>
            )}
            {r.status === "PENDING_PAYMENT" && (
              <Button
                variant="danger-text full"
                onClick={() => openModal("cancel", r)}
              >
                Hủy đơn đặt kho
              </Button>
            )}
            {["UNIT_ASSIGNED", "CONFIRMED", "CHECKED_IN"].includes(
              r.status,
            ) && (
              <LinkButton to="support/new" variant="ghost full">
                Liên hệ hỗ trợ
              </LinkButton>
            )}
          </aside>
        </div>
      </>
    );
  }
  return (
    <>
      <PageTitle
        title="Đơn đặt kho"
        description="Theo dõi yêu cầu đặt chỗ và trạng thái phân bổ kho."
      >
        <LinkButton to="find" icon="plus">
          Đặt kho mới
        </LinkButton>
      </PageTitle>
      <div className="ss-tabs">
        {[
          ["ALL", "Tất cả"],
          ["PENDING_PAYMENT", "Chờ phân bổ"],
          ["CONFIRMED", "Đã xác nhận"],
          ["CANCELLED", "Đã hủy"],
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
              <th>Đơn đặt / Cơ sở</th>
              <th>Loại kho</th>
              <th>Kỳ thuê</th>
              <th>Dự kiến</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.reservation_id}>
                <td>
                  <strong>{r.reservation_id}</strong>
                  <small>
                    {
                      data.facilities.find(
                        (f) => f.facility_id === r.facility_id,
                      ).name
                    }
                  </small>
                </td>
                <td>
                  {
                    data.unitTypes.find(
                      (t) => t.unit_type_id === r.unit_type_id,
                    ).name
                  }
                </td>
                <td>
                  {dateLabel(r.start_date)}
                  <small>{r.rental_period_months} tháng</small>
                </td>
                <td>{money(r.estimated_amount)}</td>
                <td>
                  <Badge status={r.status} />
                </td>
                <td>
                  <a
                    className="ss-table-link"
                    href={`#/customer/reservations/${r.reservation_id}`}
                  >
                    Chi tiết <Icon name="chevron" size={15} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!reservations.length && (
          <Empty
            title="Chưa có đơn trong mục này"
            text="Bạn có thể tìm và đặt kho mới bất cứ lúc nào."
          />
        )}
      </div>
    </>
  );
}
export function Units({ id }) {
  const { data, openModal } = useCustomer();
  const [filter, setFilter] = useState("ALL");
  if (id) {
    const c = data.contracts.find((c) => String(c.contract_id) === String(id));
    if (!c) return <Empty title="Không tìm thấy hợp đồng" />;
    const u = data.units.find((u) => String(u.unit_id) === String(c.unit_id)) || {
        unit_id: c.unit_id,
        unit_number: c.unit_number || `Kho #${c.unit_id}`,
        location: "Cơ sở SafeSpace",
        facility_id: 1,
        unit_type_id: 1,
      },
      f = data.facilities.find((f) => String(f.facility_id) === String(u.facility_id)) || {
        name: c.facility_name || "SafeSpace",
        color: "blue",
      },
      t = data.unitTypes.find((t) => String(t.unit_type_id) === String(u.unit_type_id)) || {
        name: c.unit_type_name || "Tiêu chuẩn",
        size: 10,
      },
      renewals = data.renewals.filter((r) => String(r.contract_id) === String(id)),
      returnReq = data.returnRequests.find((r) => String(r.contract_id) === String(id)),
      h = data.handovers.find((h) => String(h.contract_id) === String(id));
    const pendingRenewal = renewals.some((r) =>
      ["PENDING", "APPROVED"].includes(r.status),
    );
    return (
      <>
        <a className="ss-back" href="#/customer/units">
          <Icon name="back" size={17} /> Kho của tôi
        </a>
        <PageTitle
          title={`Kho ${u.unit_number}`}
          description={`${f.name} · ${u.location}`}
        >
          <Badge status={c.status} />
        </PageTitle>
        <div className="ss-grid detail">
          <section>
            <div className="ss-panel">
              <StorageArt variant={f.color} />
              <div className="ss-section-heading">
                <h2>Thông tin kho & hợp đồng</h2>
                <span className="ss-size">{t.size} m²</span>
              </div>
              <Details
                items={[
                  ["Mã hợp đồng", c.contract_id],
                  ["Loại kho", `${t.name} · ${t.dimensions}`],
                  ["Ngày bắt đầu", dateLabel(c.start_date)],
                  ["Ngày kết thúc", dateLabel(c.end_date)],
                  ["Giá thuê / tháng", money(c.agreed_monthly_rate)],
                  ["Tiền cọc", money(c.deposit_amount)],
                  ["Kiểm soát nhiệt độ", t.climate ? "Có" : "Không"],
                ]}
              />
            </div>
            <section className="ss-panel ss-mt">
              <h2>Lịch sử gia hạn</h2>
              {renewals.length ? (
                renewals.map((r) => (
                  <div className="ss-list-row" key={r.renewal_id}>
                    <Icon name="calendar" />
                    <div>
                      <strong>Gia hạn {r.renewal_period_months} tháng</strong>
                      <small>
                        Dự kiến đến {dateLabel(r.new_end_date)} ·{" "}
                        {money(r.renewal_amount)}
                      </small>
                    </div>
                    <Badge status={r.status} />
                  </div>
                ))
              ) : (
                <p className="muted">
                  Chưa có yêu cầu gia hạn cho hợp đồng này.
                </p>
              )}
            </section>
          </section>
          <aside>
            <section className="ss-panel">
              <h2>Quản lý không gian</h2>
              <p className="muted">
                Lựa chọn phù hợp với kế hoạch lưu trữ của bạn.
              </p>
              <Button
                variant="full"
                icon="calendar"
                disabled={
                  !["ACTIVE", "EXPIRING"].includes(c.status) || pendingRenewal
                }
                onClick={() => openModal("renew", c)}
              >
                {pendingRenewal ? "Đang chờ duyệt gia hạn" : "Yêu cầu gia hạn"}
              </Button>
              <Button
                variant="outline full"
                icon="box"
                disabled={
                  !["ACTIVE", "EXPIRING", "OVERDUE"].includes(c.status) ||
                  pendingRenewal
                }
                onClick={() => openModal("return", c)}
              >
                Yêu cầu trả kho
              </Button>
              <LinkButton
                to={`payments?contract=${id}`}
                variant="outline full"
                icon="card"
              >
                Thanh toán của hợp đồng
              </LinkButton>
              <LinkButton
                to={`support/new?contract=${id}`}
                variant="ghost full"
                icon="help"
              >
                Báo vấn đề về kho
              </LinkButton>
            </section>
            <section className="ss-panel ss-mt">
              <span className="ss-soft-icon">
                <Icon name="key" />
              </span>
              <h3>Ra vào & bàn giao</h3>
              <p className="muted">
                {c.status === "DRAFT"
                  ? "Nhận khóa hoặc thẻ ra vào tại cơ sở khi bàn giao."
                  : "Khóa và thẻ được quản lý tại cơ sở. Nếu bị mất hoặc gặp lỗi, hãy gửi yêu cầu hỗ trợ."}
              </p>
              {h && (
                <LinkButton to="appointments" variant="outline full">
                  Xem biên bản bàn giao
                </LinkButton>
              )}
            </section>
            {returnReq && (
              <Notice>
                Đã gửi yêu cầu trả kho ngày{" "}
                {dateLabel(returnReq.requested_date)}. Chờ nhân viên xác nhận
                lịch kiểm tra và đối soát.
              </Notice>
            )}
            {pendingRenewal && (
              <Notice>
                Ngày kết thúc hợp đồng chỉ thay đổi sau khi yêu cầu gia hạn được
                duyệt và thanh toán được xác nhận.
              </Notice>
            )}
          </aside>
        </div>
      </>
    );
  }
  const list = data.contracts.filter(
    (c) =>
      filter === "ALL" ||
      (filter === "RENTED"
        ? ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"].includes(c.status)
        : c.status === filter),
  );
  return (
    <>
      <PageTitle
        title="Kho của tôi"
        description="Quản lý mọi không gian bạn đang thuê tại SafeSpace."
      >
        <LinkButton to="find" icon="plus">
          Thuê thêm kho
        </LinkButton>
      </PageTitle>
      <div className="ss-tabs">
        {[
          ["ALL", "Tất cả kho"],
          ["RENTED", "Đang sử dụng"],
          ["DRAFT", "Chờ nhận kho"],
          ["COMPLETED", "Đã kết thúc"],
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
      <div className="ss-grid three">
        {list.map((c) => (
          <UnitCard key={c.contract_id} contract={c} />
        ))}
      </div>
      {!list.length && (
        <Empty
          title="Chưa có kho trong mục này"
          text="Các kho thuê của bạn sẽ xuất hiện tại đây."
        />
      )}
    </>
  );
}
export function Payments({ id, query }) {
  const { data, openModal } = useCustomer();
  const [filter, setFilter] = useState("ALL");
  const contract = query.get("contract");
  const all = data.payments.filter(
    (p) => !contract || String(p.contract_id) === String(contract),
  );
  const list = all.filter(
    (p) =>
      filter === "ALL" ||
      (filter === "PENDING"
        ? ["PENDING", "FAILED"].includes(p.status)
        : p.status === filter),
  );
  if (id) {
    const p = data.payments.find((p) => String(p.payment_id) === String(id));
    if (!p) return <Empty title="Không tìm thấy khoản thanh toán" />;
    const notice = data.paymentNotices[id],
      c = data.contracts.find((c) => String(c.contract_id) === String(p.contract_id)),
      u = c
        ? data.units.find((u) => String(u.unit_id) === String(c.unit_id)) || {
            unit_number: c.unit_number || "Kho",
          }
        : { unit_number: "Kho" };
    return (
      <>
        <a className="ss-back" href="#/customer/payments">
          <Icon name="back" size={17} /> Thanh toán
        </a>
        <PageTitle
          title={paymentTypes[p.payment_type]}
          description={p.payment_id}
        >
          <Badge status={p.status}>
            {notice ? "Chờ nhân viên xác minh" : null}
          </Badge>
        </PageTitle>
        <div className="ss-grid detail">
          <section className="ss-panel">
            <h2>Thông tin thanh toán</h2>
            <Details
              items={[
                ["Mã giao dịch", p.payment_id],
                ["Hợp đồng", p.contract_id],
                ["Kho", u.unit_number],
                ["Loại phí", paymentTypes[p.payment_type]],
                ["Hạn thanh toán", dateLabel(p.due_date)],
                [
                  "Ngày thanh toán",
                  p.paid_at ? dateLabel(p.paid_at) : "Chưa xác nhận",
                ],
                [
                  "Phương thức",
                  p.payment_method === "CASH"
                    ? "Tiền mặt tại cơ sở"
                    : p.payment_method === "BANK_TRANSFER"
                      ? "Chuyển khoản"
                      : "Chưa chọn",
                ],
              ]}
            />
          </section>
          <aside className="ss-panel">
            <span className="ss-soft-icon">
              <Icon name="card" />
            </span>
            <h3>Số tiền thanh toán</h3>
            <div className="ss-big-amount">{money(p.amount)}</div>
            {["PENDING", "FAILED"].includes(p.status) && !notice && (
              <Button variant="full" onClick={() => openModal("pay", p)}>
                Thanh toán
              </Button>
            )}
            {notice && (
              <Notice>
                Đã gửi thông báo{" "}
                {notice.method === "CASH"
                  ? "thanh toán tiền mặt tại cơ sở"
                  : "chuyển khoản"}
                . Khoản phí vẫn chờ xác minh từ nhân viên.
              </Notice>
            )}
            {p.status === "PAID" && (
              <Notice tone="success">
                Khoản thanh toán đã được xác nhận trong dữ liệu mẫu.
              </Notice>
            )}
            <LinkButton
              to={`support/new?contract=${p.contract_id}`}
              variant="ghost full"
            >
              Cần hỗ trợ về khoản phí này?
            </LinkButton>
          </aside>
        </div>
      </>
    );
  }
  return (
    <>
      <PageTitle
        title="Thanh toán"
        description="Theo dõi tiền thuê, tiền cọc và các khoản phí của bạn."
      />
      <div className="ss-stats three">
        {[
          [
            "Cần thanh toán",
            all
              .filter((p) => ["PENDING", "FAILED"].includes(p.status))
              .reduce((s, p) => s + p.amount, 0),
          ],
          [
            "Đã thanh toán",
            all
              .filter((p) => p.status === "PAID")
              .reduce((s, p) => s + p.amount, 0),
          ],
          [
            "Đang chờ xác minh",
            all
              .filter(
                (p) =>
                  data.paymentNotices[p.payment_id] && p.status === "PENDING",
              )
              .reduce((s, p) => s + p.amount, 0),
          ],
        ].map(([l, v]) => (
          <div className="ss-stat" key={l}>
            <span>{l}</span>
            <strong>{money(v)}</strong>
          </div>
        ))}
      </div>
      {contract && (
        <Notice>
          Đang lọc theo {contract}.{" "}
          <a href="#/customer/payments">Xem tất cả thanh toán</a>
        </Notice>
      )}
      <div className="ss-tabs">
        {[
          ["ALL", "Tất cả"],
          ["PENDING", "Cần xử lý"],
          ["PAID", "Đã thanh toán"],
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
              <th>Khoản thanh toán</th>
              <th>Hợp đồng</th>
              <th>Số tiền</th>
              <th>Hạn / Ngày trả</th>
              <th>Trạng thái</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.payment_id}>
                <td>
                  <strong>{paymentTypes[p.payment_type]}</strong>
                  <small>{p.payment_id}</small>
                </td>
                <td>{p.contract_id}</td>
                <td>
                  <strong>{money(p.amount)}</strong>
                </td>
                <td>{dateLabel(p.due_date || p.paid_at)}</td>
                <td>
                  <Badge status={p.status}>
                    {data.paymentNotices[p.payment_id]
                      ? "Chờ xác minh"
                      : p.status === "PENDING"
                        ? "Chưa thanh toán"
                        : null}
                  </Badge>
                </td>
                <td>
                  <a
                    className="ss-table-link"
                    href={`#/customer/payments/${p.payment_id}`}
                  >
                    {p.status === "PAID" || data.paymentNotices[p.payment_id]
                      ? "Chi tiết"
                      : "Thanh toán"}{" "}
                    <Icon name="chevron" size={15} />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!list.length && (
          <Empty
            title="Không có khoản thanh toán"
            text="Các khoản phí thuộc mục này sẽ được hiển thị ở đây."
          />
        )}
      </div>
    </>
  );
}
export function Appointments() {
  const { data, openModal } = useCustomer();
  return (
    <>
      <PageTitle
        title="Lịch nhận kho"
        description="Chuẩn bị cho buổi bàn giao và kiểm tra biên bản nhận kho."
      />
      {data.handovers.map((h) => {
        const c = data.contracts.find((c) => String(c.contract_id) === String(h.contract_id)) || {
            unit_number: "Kho",
            facility_name: "SafeSpace",
          },
          u = data.units.find((u) => String(u.unit_id) === String(c.unit_id)) || {
            unit_number: c.unit_number || "Kho",
          },
          f = data.facilities.find((f) => String(f.facility_id) === String(u.facility_id)) || {
            name: c.facility_name || "SafeSpace",
            address: "Cơ sở SafeSpace",
          };
        return (
          <section className="ss-panel ss-appointment" key={h.handover_id}>
            <div className="ss-date-tile">
              <span>
                {new Date(h.scheduled_at).toLocaleDateString("vi-VN", {
                  month: "long",
                })}
              </span>
              <strong>{new Date(h.scheduled_at).getDate()}</strong>
              <small>
                {new Date(h.scheduled_at).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
            <div className="ss-appointment-body">
              <div className="ss-row">
                <h2>Nhận kho {u.unit_number}</h2>
                <Badge status={h.status} />
              </div>
              <p className="ss-muted-line">
                <Icon name="pin" size={16} />
                {f.name} · {f.address}
              </p>
              <Details
                items={[
                  ["Lịch hẹn", dateTimeLabel(h.scheduled_at)],
                  ["Mã hợp đồng", h.contract_id],
                  ["Tình trạng bàn giao", h.initial_condition],
                  [
                    "Xác nhận khách hàng",
                    h.customer_confirmed ? "Đã xác nhận" : "Chưa xác nhận",
                  ],
                ]}
              />
              {h.status === "SCHEDULED" && (
                <Notice>
                  Mang theo giấy tờ tùy thân và mã đặt chỗ. Nhân viên sẽ kiểm
                  tra và bàn giao kho, khóa hoặc thẻ ra vào tại cơ sở.
                </Notice>
              )}
              <div className="ss-actions">
                <Button
                  variant="outline"
                  disabled={!h.staff_confirmed || h.customer_confirmed}
                  onClick={() => openModal("handover", h)}
                >
                  {h.customer_confirmed
                    ? "Đã xác nhận nhận kho"
                    : "Xác nhận đã nhận kho"}
                </Button>
                <LinkButton
                  to={`support/new?contract=${h.contract_id}`}
                  variant="ghost"
                >
                  Cần đổi lịch / hỗ trợ
                </LinkButton>
              </div>
            </div>
          </section>
        );
      })}
      {!data.handovers.length && (
        <Empty
          title="Chưa có lịch nhận kho"
          text="Lịch hẹn sẽ xuất hiện sau khi đơn đặt kho được xác nhận."
        />
      )}
    </>
  );
}
