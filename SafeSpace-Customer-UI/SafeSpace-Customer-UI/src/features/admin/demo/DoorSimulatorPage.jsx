/**
 * DOOR SIMULATOR PAGE - MÁY QUÉT MÔ PHỎNG (Công cụ demo · Figma 01–04 "Máy quét mô phỏng", 14/11/2026)
 *
 * - Toàn cảnh kho, không có thanh điều hướng: cửa cuốn + máy quét nhỏ gắn cạnh cửa.
 *   Hai ô Cơ sở / Ô kho màu tối nằm sát trên khung cửa, bấm để xổ danh sách (dữ liệu thật).
 * - Bấm máy quét → máy phóng to giữa màn, cảnh kho mờ đi. Nhập PIN, quét QR, đóng cửa, gọi hỗ trợ ngay trên máy;
 *   kết quả và lỗi hiện trên màn hình máy quét (không dùng popup), trừ khung camera khi quét QR.
 * - X ở máy phóng to → về cảnh kho, ảnh cửa theo trạng thái hiện tại (mở / đóng). X ở cảnh kho → về Công cụ demo.
 * Nghiệp vụ giữ nguyên D51, D53: cửa không tự khoá; PIN 6 số 1–9; mã chỉ mở ô của đúng cơ sở;
 * đóng cửa và gọi hỗ trợ có bước xác nhận (trên màn hình máy: OK xác nhận, C huỷ).
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { href } from "../../../app/router.js";
import { Icon } from "../../../shared/components/UI.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { PIN_LENGTH, pinError, scanScreen, unitOptionLabel } from "./demoModel.js";
import QrScanDialog from "./QrScanDialog.jsx";
import closedScene from "../../../assets/demo/door-scene-closed.webp";
import openScene from "../../../assets/demo/door-scene-open.webp";
import "./demo-tools.css";
import "./door-simulator.css";

const KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"]];
const clock = () => new Date().toTimeString().slice(0, 5);
const hhmm = (iso) => (iso ? dateTimeLabel(iso).slice(-5) : clock());

/** Nội dung màn hình máy quét theo trạng thái: [lớp màu, tiêu đề, dòng phụ]. */
function screenText(s, unit) {
  switch (s.kind) {
    case "BUSY": return ["", "ĐANG KIỂM TRA…", "Vui lòng chờ trong giây lát"];
    case "OPEN": return ["is-open", "ĐÃ MỞ CỬA", [s.scan.customerName, s.scan.method === "QR" ? "QR" : "PIN", hhmm(s.scan.at)].filter(Boolean).join(" · ")];
    case "NOT_YET": return ["is-wait", "CHƯA ĐẾN NGÀY", s.scan.reason];
    case "DENIED": return ["is-denied", "TỪ CHỐI", s.scan.reason || "Mã không hợp lệ hoặc đã hết hiệu lực."];
    case "CLOSED": return ["is-locked", "ĐÃ ĐÓNG CỬA", s.unchanged ? "Cửa đã khoá từ trước." : `Khoá lúc ${hhmm(s.at)} · đã ghi Nhật ký cửa`];
    case "CONFIRM_CLOSE": return ["is-wait", `ĐÓNG CỬA ${unit}?`, "Kiểm tra không còn ai trong kho. OK: đóng cửa · C: huỷ"];
    case "CONFIRM_SUPPORT": return ["is-wait", "GỌI HỖ TRỢ?", "Gửi nhân viên cơ sở kèm ô đang thao tác. OK: gửi · C: huỷ"];
    case "SUPPORT_OK": return ["is-open", s.res.duplicate ? "ĐANG CÓ YÊU CẦU" : "ĐÃ GỌI HỖ TRỢ",
      s.res.duplicate ? `Yêu cầu ${s.res.ticketCode} đang được xử lý, không tạo trùng.` : `Nhân viên cơ sở đã nhận yêu cầu ${s.res.ticketCode}.`];
    case "ERROR": return ["is-denied", "CHƯA THỰC HIỆN ĐƯỢC", `${s.text} C: quay lại`];
    case "NO_UNIT": return ["is-locked", "CHƯA CHỌN Ô KHO", "Đóng máy quét rồi chọn cơ sở và ô kho phía trên cửa."];
    default: return null;
  }
}

/** Ô chọn tối nằm trên khung cửa, bấm để xổ danh sách. */
function SceneSelect({ name, label, value, options, open, onToggle, onPick, disabled }) {
  return (
    <div className="door-sim__select">
      <button type="button" className="door-sim__select-btn" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={onToggle}>
        <span>{label} · {value}</span><i aria-hidden="true">⌄</i>
      </button>
      {open && (
        <ul className="door-sim__list" role="listbox" aria-label={name}>
          {options.map((o) => (
            <li key={o.value}><button type="button" role="option" aria-selected={o.selected} className={o.selected ? "is-active" : ""} onClick={() => onPick(o.value)}>{o.label}</button></li>
          ))}
          {!options.length && <li className="door-sim__list-empty">Chưa có dữ liệu</li>}
        </ul>
      )}
    </div>
  );
}

export default function DoorSimulatorPage() {
  const { onApiError } = useApp();
  const [facilities, setFacilities] = useState(null), [units, setUnits] = useState(null);
  const [facilityId, setFacilityId] = useState(""), [unit, setUnit] = useState("");
  const [door, setDoor] = useState(null), [loadError, setLoadError] = useState("");
  const [menu, setMenu] = useState(""); // "" | "facility" | "unit"
  const [zoomed, setZoomed] = useState(false), [qr, setQr] = useState(false);
  const [pin, setPin] = useState(""), [pinMsg, setPinMsg] = useState("");
  const [screen, setScreen] = useState({ kind: "IDLE" }), [now, setNow] = useState(clock());
  const [scale, setScale] = useState(1);
  const guard = useRef(false), device = useRef(null), stage = useRef(null), frame = useRef(null);

  useEffect(() => { (async () => {
    try { const list = await adminApi.facilities(); setFacilities(list || []); if (list?.[0]) setFacilityId(String(list[0].facilityId)); }
    catch (e) { setFacilities([]); setLoadError(e.message || "Không tải được danh sách cơ sở."); onApiError?.(e); }
  })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!facilityId) return; setUnits(null); (async () => {
    try { const list = await adminApi.facilityUnits(facilityId); setUnits(list || []); setUnit(list?.[0]?.unitNumber || ""); }
    catch (e) { setUnits([]); setUnit(""); setLoadError(e.message || "Không tải được danh sách ô kho."); }
  })(); }, [facilityId]);
  const refreshDoor = async (u = unit) => {
    if (!u) return setDoor(null);
    try { setDoor(await adminApi.doorState(u, facilityId || undefined)); } catch { setDoor(null); }
  };
  useEffect(() => { setPin(""); setPinMsg(""); setScreen({ kind: "IDLE" }); refreshDoor(unit); }, [unit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(clock()), 15000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (e.type === "keydown" ? e.key === "Escape" : !e.target.closest?.(".door-sim__selects")) setMenu(""); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [menu]);
  // Máy phóng to vừa chiều cao cảnh kho (thu nhỏ khi màn thấp)
  useLayoutEffect(() => {
    if (!zoomed) return undefined;
    const fit = () => { const h = frame.current?.offsetHeight, H = stage.current?.offsetHeight; if (h && H) setScale(Math.min(1.15, (H * 0.94) / h)); };
    fit(); window.addEventListener("resize", fit); return () => window.removeEventListener("resize", fit);
  }, [zoomed]);
  useEffect(() => { if (zoomed && !qr) device.current?.focus(); }, [zoomed, qr]);

  const facilityName = facilities?.find((f) => String(f.facilityId) === String(facilityId))?.name || "";
  const unitRow = units?.find((u) => u.unitNumber === unit);
  const run = async (fn) => {
    if (guard.current) return; guard.current = true; setScreen({ kind: "BUSY" });
    try { await fn(); } finally { guard.current = false; }
  };
  const doScan = (code, method) => run(async () => {
    try {
      const res = await adminApi.scan(code, unit, facilityId); // gửi kèm cơ sở: mã ô K01… trùng giữa các cơ sở (D53)
      const scan = { ...res, method, at: res.scannedAt || new Date().toISOString() };
      setPin(""); setScreen({ kind: scanScreen(scan), scan });
      await refreshDoor();
    } catch (e) { setScreen({ kind: "ERROR", text: e.message || "Máy quét chưa kết nối được hệ thống mở cửa." }); }
  });
  const closeDoor = () => run(async () => {
    try { const d = await adminApi.closeDoor(unit, facilityId || undefined); setDoor(d); setScreen({ kind: "CLOSED", at: d?.updatedAt, unchanged: d?.changed === false }); }
    catch (e) { setScreen({ kind: "ERROR", text: e.message || "Không gửi được lệnh đóng cửa." }); }
  });
  const support = () => run(async () => {
    try { const res = await adminApi.doorSupport({ unitNumber: unit, facilityId: facilityId ? Number(facilityId) : null, reason: null }); setScreen({ kind: "SUPPORT_OK", res }); }
    catch (e) { setScreen({ kind: "ERROR", text: e.message || "Chưa gửi được yêu cầu hỗ trợ." }); }
  });

  const busy = screen.kind === "BUSY";
  const needUnit = () => { if (unit) return false; setScreen({ kind: "NO_UNIT" }); return true; };
  const pressDigit = (d) => {
    if (busy || needUnit()) return;
    setPinMsg("");
    if (screen.kind !== "IDLE") { setScreen({ kind: "IDLE" }); setPin(d); return; }
    setPin((p) => (p.length < PIN_LENGTH ? p + d : p));
  };
  const pressClear = () => { if (busy) return; setPin(""); setPinMsg(""); setScreen({ kind: "IDLE" }); };
  const pressOk = () => {
    if (busy) return;
    if (screen.kind === "CONFIRM_CLOSE") return closeDoor();
    if (screen.kind === "CONFIRM_SUPPORT") return support();
    if (screen.kind !== "IDLE") return setScreen({ kind: "IDLE" });
    if (needUnit()) return;
    const e = pinError(pin); if (e) return setPinMsg(e); // PIN có số 0 / thiếu số: báo ngay trên máy, không gửi lên máy chủ (D53)
    doScan(pin, "PIN");
  };
  const onKey = (e) => {
    if (qr) return;
    if (/^[0-9]$/.test(e.key)) pressDigit(e.key);
    else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    else if (e.key === "Enter") { e.preventDefault(); pressOk(); }
    else if (e.key === "Escape") { if (screen.kind === "IDLE" && !pin) setZoomed(false); else pressClear(); }
  };
  const closeZoom = () => { setZoomed(false); setQr(false); setPin(""); setPinMsg(""); setScreen({ kind: "IDLE" }); refreshDoor(); };

  const isOpen = door?.door === "OPEN";
  const text = screenText(screen, unit);
  const facilityOptions = (facilities || []).map((f) => ({ value: String(f.facilityId), label: f.name, selected: String(f.facilityId) === String(facilityId) }));
  const unitOptions = (units || []).map((u) => ({ value: u.unitNumber, label: unitOptionLabel(u), selected: u.unitNumber === unit }));

  return (
    <main className="door-sim" aria-label="Máy quét mô phỏng">
      <div className="door-sim__stage" ref={stage}>
        <div className={`door-sim__scene${zoomed ? " is-blurred" : ""}`} aria-hidden={zoomed || undefined}>
          <img className="door-sim__photo" src={isOpen ? openScene : closedScene} alt={`Cửa kho ${unit || ""} ${isOpen ? "đang mở" : "đang đóng"}`} draggable="false" />
          {unit && <div className="door-sim__sign" style={{ "--n": unit.length }} aria-label={`Bảng tên ô kho ${unit}`}><small>Ô KHO</small><strong>{unit}</strong></div>}
          <div className="door-sim__selects">
            <SceneSelect name="Cơ sở" label="Cơ sở" value={facilities ? facilityName || "Chưa có cơ sở" : "Đang tải…"} options={facilityOptions} disabled={zoomed || !facilities?.length}
              open={menu === "facility"} onToggle={() => setMenu(menu === "facility" ? "" : "facility")} onPick={(v) => { setMenu(""); if (v !== facilityId) setFacilityId(v); }} />
            <SceneSelect name="Ô kho" label="Ô kho" value={units ? unit || "Chưa có ô kho" : "Đang tải…"} options={unitOptions} disabled={zoomed || !units?.length}
              open={menu === "unit"} onToggle={() => setMenu(menu === "unit" ? "" : "unit")} onPick={(v) => { setMenu(""); setUnit(v); }} />
          </div>
          {!zoomed && <>
            <button type="button" className="door-sim__hotspot" aria-label={`Phóng to máy quét cửa ${unit || ""}`} onClick={() => { setMenu(""); setZoomed(true); }} />
            <a className="door-sim__x" href={href("admin/demo")} aria-label="Về Công cụ demo"><Icon name="close" size={22} /></a>
            {(loadError || (units && !unit)) && <p className="door-sim__status" role="status">{loadError || "Cơ sở này chưa có ô kho để mô phỏng."}</p>}
          </>}
        </div>

        {zoomed && (
          <div className="door-sim__zoom" onMouseDown={(e) => { if (e.target === e.currentTarget) closeZoom(); }}>
            <button type="button" className="door-sim__x" aria-label="Về toàn cảnh kho" onClick={closeZoom}><Icon name="close" size={22} /></button>
            <div className="door-sim__device" ref={frame} style={{ transform: `scale(${scale})` }}>
              <div className="door-sim__plate" aria-hidden="true"><i /><i /><i /><i /></div>
              <div className="demo-scan" ref={device} tabIndex={0} onKeyDown={onKey} aria-label={`Máy quét cửa ${unit}`}>
                <div className="demo-scan__top">
                  <span className={`demo-scan__led${busy ? " is-busy" : ""}`}>{busy ? "ĐANG KIỂM TRA" : "SẴN SÀNG"}</span>
                  <span className="demo-scan__grille" aria-hidden="true" />
                  <span className="demo-scan__brand">SafeSpace</span>
                </div>
                <div className="demo-scan__reader" aria-hidden="true"><span className="demo-scan__lens" /><span className="demo-scan__beam" /></div>
                <p className="demo-scan__reader-hint">Đưa mã QR vào đây</p>
                <div className="demo-scan__bezel">
                  <div className={`demo-scan__screen ${text ? text[0] : ""}`} aria-live="assertive">
                    <p className="demo-scan__bar"><span>{unitRow ? unitOptionLabel(unitRow, true) : unit || "—"}</span><span>{now}</span></p>
                    {text ? <><strong>{text[1]}</strong><small>{text[2]}</small></> : <>
                      <strong>Nhập mã PIN 6 số</strong>
                      <span className="demo-scan__dots">{Array.from({ length: PIN_LENGTH }, (_, i) => <i key={i} className={i < pin.length ? "is-on" : i === pin.length ? "is-next" : ""} />)}</span>
                      <small>{pinMsg || "C: xoá nhập lại · OK: kiểm tra mã"}</small>
                      {!pinMsg && <small className="demo-scan__qr-hint">Hoặc bấm “Mở cửa bằng QR”</small>}
                    </>}
                  </div>
                </div>
                <div className="demo-scan__keys">
                  {KEYS.map(([d, sub]) => <button type="button" key={d} aria-label={d} disabled={busy} onClick={() => pressDigit(d)}>{d}{sub && <small aria-hidden="true">{sub}</small>}</button>)}
                  <button type="button" className="is-clear" aria-label="C" disabled={busy} onClick={pressClear}>C<small aria-hidden="true">XOÁ</small></button>
                  <button type="button" aria-label="0" disabled={busy} onClick={() => pressDigit("0")}>0</button>{/* Phím 0 bấm được như máy thật; PIN không có số 0 nên bấm OK báo lỗi (D53) */}
                  <button type="button" className="is-ok" disabled={busy} onClick={pressOk}>OK</button>
                </div>
                <button type="button" className="demo-scan__qr" disabled={busy} onClick={() => { if (!needUnit()) { setScreen({ kind: "IDLE" }); setQr(true); } }}><Icon name="qr" size={18} /> Mở cửa bằng QR</button>
                <div className="demo-scan__row">
                  <button type="button" className="is-help" disabled={busy} onClick={() => { if (!needUnit()) setScreen({ kind: "CONFIRM_SUPPORT" }); }}><i aria-hidden="true" /><Icon name="bell" size={15} />Gọi hỗ trợ</button>
                  <button type="button" className={`is-close${isOpen ? "" : " is-idle"}`} disabled={busy} onClick={() => { if (!needUnit()) setScreen({ kind: "CONFIRM_CLOSE" }); }}><i aria-hidden="true" /><Icon name="lock" size={15} />Đóng cửa</button>
                </div>
                <p className="demo-scan__model" aria-hidden="true">MODEL SA-200 · CỬA KHO TỰ PHỤC VỤ</p>
              </div>
            </div>
          </div>
        )}
      </div>
      {qr && <QrScanDialog onClose={() => setQr(false)} onPin={() => { setQr(false); device.current?.focus(); }} onCode={(code) => { setQr(false); doScan(code, "QR"); }} />}
    </main>
  );
}

