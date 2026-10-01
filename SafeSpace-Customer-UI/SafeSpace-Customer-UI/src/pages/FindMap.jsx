import React, { useEffect, useMemo, useRef, useState } from "react";
import { Photo } from "../components/Photo";
import SearchBar from "../components/SearchBar";
import { ViewToggle } from "../components/Inline";
import { Icon, PageHeader } from "../components/UI";
import { HCMC_CENTER, coordsOf } from "../config/geo";
import { areaLabel, minRate, offerTypes, searchFacilities, typeLabel } from "../lib/catalog";
import { money } from "../lib/format";
import { go, href, qs } from "../lib/router";
import { useApp } from "../state/store";
import { filtersFromQuery } from "./FindList";

// Nhãn loại kho & diện tích trên thẻ / popup: "Kho thường · Kiểm soát nhiệt độ | 2 – 5 m² · 10 – 20 m²"
function specLabel(f) {
  const types = offerTypes(f).map(typeLabel).join(" · ");
  const sizes = [...new Set(f.offers.map((o) => o.size_label.replaceAll(" – ", "–")))].slice(0, 2).join(" · ");
  return `${types} | ${sizes}`;
}

const MARKER_HTML = `<span class="map-marker__inner"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 3 8v9l9 5 9-5V8l-9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5"/></svg></span>`;

// Figma C02m / C02m-1 / C02m-2 (01/10): chế độ Bản đồ chỉ gồm thanh tìm kho và bản đồ, không có danh sách thẻ cơ sở.
// Bấm logo trên bản đồ mở thẻ "Thông tin cơ sở" với nút "Xem chi tiết cơ sở".
export default function FindMap({ query }) {
  const { data } = useApp();
  const filters = filtersFromQuery(query);
  const results = useMemo(() => searchFacilities(data.facilities, filters), [data.facilities, filters.type, filters.band, filters.area]); // eslint-disable-line react-hooks/exhaustive-deps
  const [visible, setVisible] = useState(null); // id các cơ sở trong khung bản đồ; null = chưa có bản đồ
  const [selected, setSelected] = useState(null);
  const [mapError, setMapError] = useState(false);
  const box = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const leafletRef = useRef(null);
  const mapSection = useRef(null);

  const current = results.find((f) => f.facility_id === selected) || null;
  const shown = visible ? results.filter((f) => visible.includes(f.facility_id)) : results;

  // Khởi tạo Leaflet (nạp động để không chạy khi render phía máy chủ)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (!alive || !box.current) return;
        leafletRef.current = L;
        const map = L.map(box.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView(HCMC_CENTER, 12);
        L.control.zoom({ position: "topright" }).addTo(map);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "© OpenStreetMap contributors",
        }).addTo(map);
        const updateVisible = () => {
          const b = map.getBounds();
          setVisible(results.filter((f) => b.contains(coordsOf(f))).map((f) => f.facility_id));
        };
        map.on("moveend", () => mapRef.current?._ssUpdate?.());
        map._ssUpdate = updateVisible;
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
        setVisible([]); // kích hoạt vẽ ghim ở effect bên dưới
      } catch {
        if (alive) setMapError(true);
      }
    })();
    return () => {
      alive = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Vẽ lại ghim khi kết quả lọc đổi; thu khung bản đồ vừa các cơ sở tìm được
  const ids = results.map((f) => f.facility_id).join(",");
  const ready = visible !== null;
  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    layerRef.current.clearLayers();
    results.forEach((f) => {
      const m = L.marker(coordsOf(f), {
        title: f.name,
        icon: L.divIcon({ className: `map-marker${f.facility_id === selected ? " is-selected" : ""}`, html: MARKER_HTML, iconSize: [40, 40], iconAnchor: [20, 20] }),
        keyboard: true,
      });
      m.on("click", () => setSelected(f.facility_id));
      m.addTo(layerRef.current);
    });
    map._ssUpdate = () => {
      const b = map.getBounds();
      setVisible(results.filter((f) => b.contains(coordsOf(f))).map((f) => f.facility_id));
    };
    map.invalidateSize();
    if (results.length) map.fitBounds(L.latLngBounds(results.map(coordsOf)).pad(0.15), { maxZoom: 14 });
    else map._ssUpdate();
  }, [ids, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đổi kiểu ghim đang chọn mà không vẽ lại khung bản đồ
  useEffect(() => {
    layerRef.current?.eachLayer((m) => {
      const el = m.getElement?.();
      if (el) el.classList.toggle("is-selected", m.options.title === current?.name);
    });
  }, [selected, current?.name]);

  const showAll = () => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (map && L && data.facilities.length) {
      if (filters.type || filters.band || filters.area) go("find/map", { replace: true });
      else map.fitBounds(L.latLngBounds(data.facilities.map(coordsOf)).pad(0.1));
    }
  };
  const areaName = filters.area || "TP. Hồ Chí Minh";

  return (
    <main className="container page">
      <PageHeader title="Tìm kho" description="Xem tất cả cơ sở SafeSpace tại TP.HCM. Phóng to bản đồ và chọn logo để xem thông tin kho.">
        <ViewToggle active="map" listTo={`find${qs({ type: filters.type, band: filters.band, area: filters.area })}`} mapTo={`find/map${qs({ type: filters.type, band: filters.band, area: filters.area })}`} />
      </PageHeader>
      <SearchBar
        facilities={data.facilities}
        filters={filters}
        onSubmit={(draft) => {
          setSelected(null);
          go(`find/map${qs(draft)}`, { replace: false });
        }}
      />

      <section className="map-wrap" ref={mapSection} aria-label="Bản đồ cơ sở SafeSpace">
        <div className="map-canvas" ref={box} />
        {mapError && <p className="map-fallback">Không tải được bản đồ. Kiểm tra kết nối mạng rồi tải lại trang.</p>}
        {results.length === 0 && (
          <div className="map-empty" role="status">
            <strong>Chưa có cơ sở phù hợp</strong>
            <span>Thử đổi loại kho, diện tích hoặc khu vực.</span>
            <a className="btn btn--primary" href={href("find/map")}>Xem tất cả cơ sở</a>
          </div>
        )}
        <span className="map-chip">{areaName} · {visible ? shown.length : results.length} cơ sở</span>
        <button type="button" className="btn btn--light map-all" onClick={showAll}>Xem tất cả cơ sở</button>
        {current && (
          <aside className="map-info" aria-label={`Thông tin cơ sở ${current.name}`}>
            <div className="map-info__head">
              <span>THÔNG TIN CƠ SỞ</span>
              <button type="button" onClick={() => setSelected(null)} aria-label="Đóng thông tin cơ sở"><Icon name="close" size={16} /></button>
            </div>
            <Photo facility={current} />
            <h3>{current.name}</h3>
            <p className="muted">{current.address || areaLabel(current)}</p>
            <p className="map-info__spec">{specLabel(current)}</p>
            <p className="muted">{current.hours} · Camera 24/7</p>
            <p className="price price--lg">Từ {money(minRate(current, filters) ?? 0)} / tháng</p>
            <a className="btn btn--primary btn--block" href={href(`find/${current.facility_id}${qs({ type: filters.type, band: filters.band })}`)}>
              Xem chi tiết cơ sở
            </a>
          </aside>
        )}
      </section>
    </main>
  );
}
