import React, { useState } from "react";
import { useCustomer } from "../context";
import {
  PageTitle,
  Field,
  Button,
  LinkButton,
  Icon,
  StorageArt,
  Badge,
  Empty,
  Notice,
  Details,
} from "../components/UI";
import { money, today, validateBooking } from "../domain";

export default function FindStorage({ id }) {
  const { data, openModal } = useCustomer();
  const [filters, setFilters] = useState({
    facility_id: "",
    unit_type_id: "",
    max_price: "",
    start_date: today(),
    rental_period_months: "1",
  });
  const [applied, setApplied] = useState(filters);
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setFilters({ ...filters, [k]: v });
    setErrors((previous) => {
      const next = { ...previous };
      delete next[k];
      // Tự động xóa lỗi global khi người dùng bắt đầu chọn lại
      delete next.global; 
      return next;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    
    // Kiểm tra chặn rỗng trước khi submit
    if (
      !filters.facility_id ||
      !filters.unit_type_id ||
      !filters.max_price ||
      !filters.start_date ||
      !filters.rental_period_months
    ) {
      setErrors({
        global: "Vui lòng chọn đầy đủ cơ sở, loại kho, giá tối đa và ngày bắt đầu trước khi tìm kho!",
      });
      return;
    }

    const err = validateBooking(filters);
    setErrors(err);
    if (!Object.keys(err).length) setApplied({ ...filters });
  };

  if (id) {
    const f = data.facilities.find((f) => String(f.facility_id) === id);
    if (!f)
      return (
        <Empty title="Không tìm thấy cơ sở">
          <LinkButton to="find">Quay lại tìm kho</LinkButton>
        </Empty>
      );
    return (
      <>
        <a className="ss-back" href="#/customer/find">
          <Icon name="back" size={17} /> Tất cả cơ sở
        </a>
        <PageTitle
          eyebrow="KHÁM PHÁ CƠ SỞ"
          title={f.name}
          description={f.address}
        />
        <div className="ss-facility-hero">
          <StorageArt variant={f.color} large />
          <div className="ss-panel">
            <Badge tone="green">Đang hoạt động</Badge>
            <h2>Không gian phù hợp với bạn</h2>
            <p className="muted">
              Kho riêng biệt, nhiều kích thước và đội ngũ hỗ trợ tại cơ sở.
            </p>
            <Details
              items={[
                ["Địa chỉ", f.address],
                ["Giờ hỗ trợ", f.hours],
                ["Liên hệ (mẫu)", f.phone],
              ]}
            />
            <div className="ss-features">
              <span>
                <Icon name="shield" /> Camera an ninh
              </span>
              <span>
                <Icon name="key" /> Khóa riêng
              </span>
              <span>
                <Icon name="box" /> Nhiều kích thước
              </span>
            </div>
          </div>
        </div>
        <div className="ss-section-heading">
          <div>
            <h2>Chọn loại kho của bạn</h2>
            <p>
              Giá và số chỗ hiển thị là dữ liệu mẫu. Cơ sở sẽ xác nhận theo kỳ
              thuê.
            </p>
          </div>
        </div>
        <div className="ss-grid three">
          {data.unitTypes.map((t) => {
            const r = data.rates.find(
              (r) =>
                r.facility_id === f.facility_id &&
                r.unit_type_id === t.unit_type_id,
            );
            return (
              <section className="ss-panel ss-type-card" key={t.unit_type_id}>
                <span className="ss-soft-icon">
                  <Icon name="box" size={28} />
                </span>
                <h2>Kho {t.name}</h2>
                <p>{t.description}</p>
                <Details
                  items={[
                    ["Diện tích", `${t.size} m²`],
                    ["Kích thước", t.dimensions],
                    ["Kiểm soát nhiệt độ", t.climate ? "Có" : "Không"],
                  ]}
                />
                <div className="ss-price">
                  {money(r.monthly_rate)}
                  <small>/ tháng</small>
                </div>
                <p className={r.available ? "ss-available" : "muted"}>
                  {r.available ? `Còn ${r.available} kho (mẫu)` : "Tạm hết kho"}
                </p>
                <Button
                  variant="full"
                  disabled={!r.available}
                  onClick={() =>
                    openModal("book", {
                      facility_id: f.facility_id,
                      unit_type_id: t.unit_type_id,
                      start_date: applied.start_date,
                      rental_period_months: applied.rental_period_months,
                    })
                  }
                >
                  Đặt kho này <Icon name="arrow" size={16} />
                </Button>
              </section>
            );
          })}
        </div>
        <Notice>
          Kho cụ thể sẽ được Facility Manager phân bổ sau khi nhận yêu cầu đặt
          chỗ. Bạn chưa cần thanh toán ở bước này.
        </Notice>
      </>
    );
  }

  const facilities = data.facilities.filter(
    (f) =>
      (!applied.facility_id || f.facility_id === Number(applied.facility_id)) &&
      data.rates.some(
        (r) =>
          r.facility_id === f.facility_id &&
          r.available > 0 &&
          (!applied.unit_type_id ||
            r.unit_type_id === Number(applied.unit_type_id)) &&
          (!applied.max_price || r.monthly_rate <= Number(applied.max_price)),
      ),
  );

  return (
    <>
      <PageTitle
        eyebrow="TÌM KHÔNG GIAN PHÙ HỢP"
        title="Một chỗ riêng cho mọi thứ."
        description="Chọn cơ sở, chọn kích thước. SafeSpace lo phần không gian."
      />
      <section className="ss-search-hero">
        <div className="ss-eyebrow">LINH HOẠT THEO NHU CẦU CỦA BẠN</div>
        <h2>
          Lưu trữ <span>thông minh.</span>
          <br />
          Sống thoải mái hơn.
        </h2>
        <p>Khám phá các cơ sở và gửi yêu cầu đặt kho trực tuyến.</p>
        <span className="ss-search-decoration">
          <Icon name="box" size={160} />
        </span>
      </section>
      <form className="ss-search-form" onSubmit={submit} noValidate>
        <Field label="CƠ SỞ / KHU VỰC">
          <select
            value={filters.facility_id}
            onChange={(e) => set("facility_id", e.target.value)}
          >
            <option value="">Tất cả cơ sở</option>
            {data.facilities.map((f) => (
              <option key={f.facility_id} value={f.facility_id}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="LOẠI KHO">
          <select
            value={filters.unit_type_id}
            onChange={(e) => set("unit_type_id", e.target.value)}
          >
            <option value="">Mọi kích thước</option>
            {data.unitTypes.map((t) => (
              <option key={t.unit_type_id} value={t.unit_type_id}>
                {t.name} · {t.size} m²
              </option>
            ))}
          </select>
        </Field>
        <Field label="GIÁ TỐI ĐA / THÁNG">
          <select
            value={filters.max_price}
            onChange={(e) => set("max_price", e.target.value)}
          >
            <option value="">Chọn Giá</option>
            <option value="600000">600.000 đ</option>
            <option value="1500000">1.500.000 đ</option>
            <option value="2500000">2.500.000 đ</option>
          </select>
        </Field>
        <Field label="NGÀY BẮT ĐẦU" error={errors.start_date}>
          <input
            aria-invalid={!!errors.start_date}
            type="date"
            value={filters.start_date}
            min={today()}
            onChange={(e) => set("start_date", e.target.value)}
          />
        </Field>
        <Field label="SỐ THÁNG" error={errors.rental_period_months}>
          <input
            aria-invalid={!!errors.rental_period_months}
            type="number"
            min="1"
            max="24"
            value={filters.rental_period_months}
            onChange={(e) => set("rental_period_months", e.target.value)}
          />
        </Field>
        <Button type="submit" icon="search">
          Tìm kho trống
        </Button>
        
        {/* Hiển thị lỗi bắt buộc điền form */}
        {errors.global && (
          <div style={{ color: "#dc2626", fontSize: "13px", gridColumn: "1 / -1", marginTop: "5px", fontWeight: "500" }}>
            {errors.global}
          </div>
        )}
      </form>
      <div className="ss-section-heading">
        <div>
          <h2>
            Cơ sở dành cho bạn{" "}
            <span className="ss-count">{facilities.length}</span>
          </h2>
          <p>
            Giá từ mức thấp nhất phù hợp bộ lọc · Kỳ thuê{" "}
            {applied.rental_period_months} tháng
          </p>
        </div>
        <button
          className="ss-text-btn"
          onClick={() => {
            const f = {
              facility_id: "",
              unit_type_id: "",
              max_price: "",
              start_date: today(),
              rental_period_months: "1",
            };
            setFilters(f);
            setApplied(f);
            setErrors({});
          }}
        >
          Đặt lại bộ lọc
        </button>
      </div>
      <div className="ss-grid three">
        {facilities.map((f) => {
          const rates = data.rates.filter(
            (r) =>
              r.facility_id === f.facility_id &&
              r.available > 0 &&
              (!applied.unit_type_id ||
                r.unit_type_id === Number(applied.unit_type_id)) &&
              (!applied.max_price ||
                r.monthly_rate <= Number(applied.max_price)),
          );
          return (
            <article className="ss-facility-card" key={f.facility_id}>
              <div className="ss-facility-image">
                <StorageArt variant={f.color} />
                <span className="ss-floating-label">
                  <Icon name="shield" size={14} />
                  {f.tag}
                </span>
              </div>
              <div className="ss-card-body">
                <small className="ss-eyebrow">{f.area}</small>
                <h3>{f.name}</h3>
                <p className="ss-muted-line">
                  <Icon name="pin" size={16} />
                  {f.address}
                </p>
                <div className="ss-feature-row">
                  <span>
                    <Icon name="shield" size={15} /> An ninh
                  </span>
                  <span>
                    <Icon name="snow" size={15} /> Kho mát
                  </span>
                </div>
                <div className="ss-row">
                  <div className="ss-price">
                    <small>Từ </small>
                    {money(Math.min(...rates.map((r) => r.monthly_rate)))}
                    <small>/tháng</small>
                  </div>
                </div>
                <div className="ss-actions">
                  <LinkButton to={`find/${f.facility_id}`} variant="outline">
                    Chi tiết
                  </LinkButton>
                  <Button
                    onClick={() =>
                      openModal("book", {
                        facility_id: f.facility_id,
                        unit_type_id: rates[0].unit_type_id,
                        start_date: applied.start_date,
                        rental_period_months: applied.rental_period_months,
                      })
                    }
                  >
                    Đặt chỗ <Icon name="arrow" size={16} />
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!facilities.length && (
        <Empty
          title="Chưa tìm được kho phù hợp"
          text="Thử chọn cơ sở khác hoặc tăng mức giá tối đa."
        />
      )}
      <Notice>
        Giá và số chỗ là dữ liệu minh họa. Cơ sở sẽ xác nhận khả dụng cho toàn
        bộ kỳ thuê của bạn.
      </Notice>
    </>
  );
}