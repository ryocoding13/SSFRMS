import React from "react";
import { LinkButton, PageHeader } from "../../../shared/components/UI.jsx";
import { SIZE_BANDS, minRate } from "../../../shared/utils/catalog.js";
import { money } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

export function PublicPricingPage() {
  const { data } = useApp();
  return (
    <main className="container page">
      <PageHeader title="Chi phí rõ ràng, dễ lựa chọn" description="Hai cỡ kho, kho thường hoặc kho lạnh. Giá chính xác phụ thuộc cơ sở và kỳ thuê." />
      <div className="grid grid--2">
        {SIZE_BANDS.map((b) => {
          const from = (type) => {
            const rates = data.facilities.map((f) => minRate(f, { band: b.id, type })).filter((x) => x != null);
            return rates.length ? Math.min(...rates) : null;
          };
          const normal = from("normal");
          const cold = from("climate");
          return (
            <article className="panel price-card" key={b.id}>
              <h2>{b.name}</h2>
              <span className="tag tag--soft">{b.short}</span>
              <p className="price price--lg">{normal == null ? "Xem giá theo cơ sở" : `Từ ${money(normal)} / tháng`}</p>
              {cold != null && <p className="muted">Kho lạnh từ {money(cold)} / tháng</p>}
              <p className="muted">{b.note}</p>
              <LinkButton to={`find?band=${b.id}`}>Tìm kho phù hợp</LinkButton>
            </article>
          );
        })}
      </div>
      <section className="panel note-card">
        <h3>Tiền thuê, tiền cọc và phí phát sinh</h3>
        <p className="muted">
          Bảng tổng hợp trước thanh toán hiển thị tiền thuê theo kỳ, cọc và phí áp dụng. Tiền cọc được đối chiếu khi trả kho; phí gia hạn, huỷ hoặc quá hạn áp dụng theo chính sách hợp đồng.
        </p>
      </section>
    </main>
  );
}
