import React, { useEffect, useState } from "react";
import { Photo } from "../components/Photo";
import { Pagination, Select } from "../components/Pickers";
import { Button, Empty, Field, LinkButton, PageHeader } from "../components/UI";
import {
  BUDGET_LIMIT,
  SIZE_BANDS,
  UNIT_TYPES,
  areaLabel,
  bandLabel,
  listAreas,
  rateFor,
  searchFacilities,
  typeLabel,
} from "../lib/catalog";
import { distanceLabel, money } from "../lib/format";
import { go, href, qs } from "../lib/router";
import { useApp } from "../state/store";

const PER_PAGE = 9;

export const filtersFromQuery = (q) => ({
  type: q.get("type") || "",
  band: q.get("band") || "",
  area: q.get("area") || "",
  camera: q.get("camera") === "1",
  budget: q.get("budget") === "1",
  sort: q.get("sort") || "best",
});

const compactLabel = (s) => s.replaceAll(" – ", "–");

export default function FindList({ query }) {
  const { data } = useApp();
  const filters = filtersFromQuery(query);
  const page = Math.max(1, Number(query.get("page")) || 1);
  const [draft, setDraft] = useState({ type: filters.type, band: filters.band, area: filters.area });
  useEffect(() => setDraft({ type: filters.type, band: filters.band, area: filters.area }), [filters.type, filters.band, filters.area]);

  const searched = Boolean(filters.type || filters.band || filters.area);
  const results = searchFacilities(data.facilities, filters);
  const total = data.facilities.length;
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE));
  const current = Math.min(page, pages);
  const from = (current - 1) * PER_PAGE;
  const shown = results.slice(from, from + PER_PAGE);

  const update = (patch, { replace = true } = {}) => {
    const next = { ...filters, ...patch };
    if (next.sort === "best") next.sort = "";
    go(`find${qs(next)}`, { replace });
  };
  const detailQuery = qs({ type: filters.type, band: filters.band });

  return (
    <main className="container page">
      <PageHeader
        title={searched ? "Chọn cơ sở phù hợp với bạn" : "Tìm & đặt kho"}
        description={searched ? undefined : "Xem tất cả cơ sở SafeSpace, hoặc chọn nhu cầu bên dưới để thu hẹp danh sách."}
      />
      {searched && (
        <ol className="steps-trail" aria-label="Các bước đặt kho">
          <li className="is-current">01 Nhu cầu</li>
          <li>02 Chọn cơ sở</li>
          <li>03 Đặt chỗ & thanh toán</li>
          <li>04 Xác nhận</li>
        </ol>
      )}

      <form
        className="panel search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          update({ ...draft, page: "" }, { replace: false });
        }}
      >
        <Field label="Loại kho">
          <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
            <option value="">Tất cả loại kho</option>
            {UNIT_TYPES.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Diện tích">
          <Select value={draft.band} onChange={(e) => setDraft({ ...draft, band: e.target.value })}>
            <option value="">Mọi diện tích</option>
            {SIZE_BANDS.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Khu vực">
          <Select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>
            <option value="">Tất cả khu vực</option>
            {listAreas(data.facilities).map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </Field>
        <Button type="submit">{searched ? "Tìm lại" : "Tìm kho"}</Button>
      </form>

      <div className="result-bar">
        <strong>{searched || filters.camera || filters.budget ? `${results.length} cơ sở phù hợp trong tổng ${total} cơ sở` : `${total} cơ sở SafeSpace`}</strong>
        <div className="chips" role="group" aria-label="Lọc nhanh">
          <button type="button" className={`chip${filters.camera ? " is-on" : ""}`} aria-pressed={filters.camera} onClick={() => update({ camera: !filters.camera, page: "" })}>
            {filters.camera && "✓ "}Camera 24/7
          </button>
          <button type="button" className={`chip${filters.budget ? " is-on" : ""}`} aria-pressed={filters.budget} onClick={() => update({ budget: !filters.budget, page: "" })}>
            {filters.budget && "✓ "}Dưới {money(BUDGET_LIMIT)} / tháng
          </button>
          <button type="button" className={`chip${filters.sort === "near" ? " is-on" : ""}`} aria-pressed={filters.sort === "near"} onClick={() => update({ sort: filters.sort === "near" ? "best" : "near", page: "" })}>
            Gần bạn nhất
          </button>
        </div>
        <label className="sort">
          Sắp xếp:
          <Select aria-label="Sắp xếp" value={filters.sort} onChange={(e) => update({ sort: e.target.value, page: "" })}>
            <option value="best">Phù hợp nhất</option>
            <option value="near">Gần bạn nhất</option>
            <option value="price">Giá thấp đến cao</option>
          </Select>
        </label>
      </div>

      {shown.length === 0 ? (
        <Empty title="Chưa có cơ sở phù hợp" text="Thử đổi loại kho, diện tích, khu vực hoặc bỏ bớt bộ lọc nhanh.">
          <LinkButton to="find">Xem tất cả cơ sở</LinkButton>
        </Empty>
      ) : (
        <div className="facility-grid">
          {shown.map((f, i) => {
            const type = filters.type || "normal";
            const band = filters.band || "M";
            return (
              <article className="panel facility-card" key={f.facility_id}>
                <Photo facility={f} badge={filters.sort === "best" && current === 1 && i === 0 ? "Gợi ý phù hợp nhất" : null} />
                <h3>{f.name}</h3>
                <p className="muted">
                  {f.city} · Cách bạn {distanceLabel(f.distance_km)}
                </p>
                <p className="facility-card__meta">
                  {compactLabel(bandLabel(band))} · {typeLabel(type)}
                  <br />
                  Ra vào {f.hours} · Camera 24/7
                </p>
                <p className="price">{money(rateFor(f, type, band))} / tháng</p>
                <p className="hint">Chọn gói thuê và ngày bắt đầu ở trang chi tiết.</p>
                <a className="btn btn--primary" href={href(`find/${f.facility_id}${detailQuery}`)} aria-label={`Xem chi tiết cơ sở ${f.name} tại ${areaLabel(f)}`}>
                  Xem chi tiết cơ sở
                </a>
              </article>
            );
          })}
        </div>
      )}
      <Pagination
        page={current}
        pages={pages}
        total={results.length}
        from={from + 1}
        to={from + shown.length}
        onPage={(n) => update({ page: n === 1 ? "" : n }, { replace: false })}
      />
      {searched && results.length < total && shown.length > 0 && (
        <p className="see-all">
          <a href={href("find")}>Chưa thấy kho ưng ý? Xem tất cả cơ sở SafeSpace →</a>
        </p>
      )}
    </main>
  );
}
