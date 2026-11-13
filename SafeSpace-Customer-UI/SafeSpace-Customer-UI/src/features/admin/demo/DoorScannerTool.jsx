/**
 * DOOR SCANNER TOOL - MÁY QUÉT TẠI CỬA KHO (Lượt 6b · #48 #50 #51 #59 · Figma A-DEMO-CỬA)
 *
 * Mô phỏng thiết bị kiểm soát ra vào có bàn phím (D21: không dùng thiết bị thật):
 * - Chọn cơ sở và ô kho → nhập PIN 6 số (chỉ 1–9, D51) hoặc "Mở cửa bằng QR" (camera, đọc bằng BarcodeDetector
 *   hoặc jsQR trên Windows; không có camera thì dán mã).
 * - Cửa không tự khoá (D51): mở tới khi bấm "Đóng cửa" (popup xác nhận, không nhập lại mã).
 * - "Gọi hỗ trợ" gửi yêu cầu tới nhân viên cơ sở; trong 30 phút không tạo yêu cầu trùng.
 * - Mọi lần mở, từ chối, đóng đều vào Nhật ký cửa (không lưu nguyên mã QR/PIN).
 */
import React, { useEffect, useRef, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { Button, Field, Icon, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { DemoHead } from "./DemoShared.jsx";
import { PIN_LENGTH, pinError, scanScreen } from "./demoModel.js";
import { cameraErrorState, cameraProblem, createQrReader } from "./qrReader.js";
import "./demo-tools.css";

const SCREEN = {
  IDLE: ["", "Nhập mã PIN 6 số"],
  OPEN: ["is-open", "ĐÃ MỞ CỬA"],
  DENIED: ["is-denied", "TỪ CHỐI"],
  NOT_YET: ["is-wait", "CHƯA ĐẾN NGÀY"],
  LOCKED: ["is-locked", "CỬA ĐÃ KHOÁ"],
};
const clock = () => new Date().toTimeString().slice(0, 5);

/**
 * Đọc QR bằng camera. Luôn xin quyền camera trước; đọc mã bằng BarcodeDetector nếu trình duyệt có,
 * không có (Chrome/Edge trên Windows) thì dùng jsQR (#51). Không mở được camera → popup nêu đúng lý do,
 * vẫn cho dán mã hoặc nhập PIN.
 */
const CAMERA_TEXT = {
  missing: ["Không tìm thấy camera", "Thiết bị này không có camera hoặc camera đang tắt. Dán nội dung mã QR của khách bên dưới, hoặc dùng PIN 6 số."],
  busy: ["Camera đang bận", "Camera đang được ứng dụng khác sử dụng (ví dụ Zalo, Zoom, Teams). Đóng ứng dụng đó rồi bấm Thử lại, hoặc dán mã / dùng PIN."],
  insecure: ["Trang chưa được phép dùng camera", "Trình duyệt chỉ cho mở camera trên trang HTTPS hoặc localhost. Mở máy quét bằng địa chỉ localhost / HTTPS, hoặc dán mã / dùng PIN."],
};

function QrDialog({ onCode, onClose, onPin }) {
  const video = useRef(null);
  const [state, setState] = useState("starting"); // starting | live | blocked | missing | busy | insecure
  const [attempt, setAttempt] = useState(0);
  const [paste, setPaste] = useState("");
  useEffect(() => {
    let stream, timer, stop = false;
    setState("starting");
    (async () => {
      const problem = cameraProblem(window);
      if (problem) return setState(problem);
      try {
        // Hiện hộp hỏi quyền camera của trình duyệt; "environment" chỉ là ưu tiên, laptop vẫn dùng webcam trước
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream; await video.current.play(); setState("live");
        const detect = await createQrReader(window);
        const tick = async () => {
          if (stop) return;
          try { const code = await detect(video.current); if (code) return onCode(code); } catch { /* khung hình chưa sẵn sàng */ }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) { if (!stop) setState(cameraErrorState(e)); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "blocked") return <ConfirmDialog tone="warning" title="Trình duyệt đang chặn camera" label="Nhập PIN" cancelLabel="Đóng" hint=""
    text="Bấm biểu tượng ổ khoá cạnh thanh địa chỉ → Camera → Cho phép, rồi mở lại “Mở cửa bằng QR”. Hoặc nhập PIN 6 số." onCancel={onClose} onConfirm={onPin} />;
  const problem = CAMERA_TEXT[state];
  return <Modal title={problem ? problem[0] : "Đưa mã QR vào camera"} size="md" onClose={onClose}>
    {problem
      ? <p className="modal__text">{problem[1]}</p>
      : <div className="demo-scan__video"><video ref={video} muted playsInline aria-label="Camera máy quét" />{state === "starting" && <span>Đang mở camera… Chọn “Cho phép” khi trình duyệt hỏi.</span>}</div>}
    <Field label="Hoặc dán nội dung mã QR"><input value={paste} placeholder="Ví dụ: SSQR-12-4821" onChange={(e) => setPaste(e.target.value)} /></Field>
    <div className="modal__actions modal__actions--end">
      {(state === "busy" || state === "missing") && <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>}
      <Button variant="outline" onClick={onPin}>Nhập PIN</Button>
      <Button disabled={!paste.trim()} onClick={() => onCode(paste.trim())}>Quét mã này</Button>
    </div>
  </Modal>;
}

export default function DoorScannerTool() {
  const { onApiError } = useApp();
  const [facilities, setFacilities] = useState([]), [units, setUnits] = useState([]);
  const [facilityId, setFacilityId] = useState(""), [unit, setUnit] = useState("");
  const [door, setDoor] = useState(null), [pin, setPin] = useState(""), [pinMsg, setPinMsg] = useState("");
  const [scan, setScan] = useState(null), [busy, setBusy] = useState(false), [popup, setPopup] = useState(null), [reason, setReason] = useState("");
  const [loadError, setLoadError] = useState("");
  const guard = useRef(false), pad = useRef(null);

  useEffect(() => { (async () => {
    try { const list = await adminApi.facilities(); setFacilities(list || []); if (list?.[0]) setFacilityId(String(list[0].facilityId)); }
    catch (e) { setLoadError(e.message || "Không tải được danh sách cơ sở."); onApiError?.(e); }
  })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!facilityId) return; (async () => {
    try { const list = await adminApi.facilityUnits(facilityId); setUnits(list || []); setUnit(list?.[0]?.unitNumber || ""); }
    catch (e) { setUnits([]); setUnit(""); setLoadError(e.message || "Không tải được danh sách ô kho."); }
  })(); }, [facilityId]);
  const refreshDoor = async (u = unit) => {
    if (!u) return setDoor(null);
    try { setDoor(await adminApi.doorState(u, facilityId || undefined)); } catch { setDoor(null); }
  };
  useEffect(() => { setScan(null); setPin(""); setPinMsg(""); refreshDoor(unit); }, [unit]); // eslint-disable-line react-hooks/exhaustive-deps

  const facilityName = facilities.find((f) => String(f.facilityId) === String(facilityId))?.name || "";
  const run = async (fn) => {
    if (guard.current) return; guard.current = true; setBusy(true);
    try { await fn(); } finally { guard.current = false; setBusy(false); }
  };
  const doScan = (code, method) => run(async () => {
    try {
      const res = await adminApi.scan(code, unit, facilityId); // gửi kèm cơ sở: mã ô K01… trùng giữa các cơ sở
      const s = { ...res, method, at: res.scannedAt || new Date().toISOString() };
      setScan(s); setPin("");
      setPopup({ kind: scanScreen(s), scan: s });
      refreshDoor();
    } catch (e) { setPopup({ kind: "ERROR", text: e.message || "Máy quét chưa kết nối được hệ thống mở cửa.", retry: () => doScan(code, method) }); }
  });
  const pressDigit = (d) => { if (busy) return; setPinMsg(""); setPin((p) => (p.length < PIN_LENGTH ? p + d : p)); };
  const submitPin = () => { const e = pinError(pin); if (e) return setPinMsg(e); doScan(pin, "PIN"); };
  const closeDoor = () => run(async () => {
    try { const d = await adminApi.closeDoor(unit, facilityId || undefined); setDoor(d); setScan(null); setPopup({ kind: "CLOSED", door: d }); }
    catch (e) { setPopup({ kind: "ERROR", text: e.message || "Không gửi được lệnh đóng cửa.", retry: closeDoor }); }
  });
  const support = () => run(async () => {
    try { const r = await adminApi.doorSupport({ unitNumber: unit, facilityId: facilityId ? Number(facilityId) : null, reason: reason.trim() || null }); setReason(""); setPopup({ kind: "SUPPORT_OK", res: r }); }
    catch (e) { setPopup({ kind: "ERROR", text: `${e.message || "Chưa gửi được yêu cầu hỗ trợ."} Nội dung đã nhập vẫn được giữ.`, retry: support }); }
  });
  const onKey = (e) => {
    if (/^[0-9]$/.test(e.key)) pressDigit(e.key);
    else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    else if (e.key === "Enter") submitPin();
    else if (e.key === "Escape") setPin("");
  };

  const open = door?.door === "OPEN";
  const screen = scan ? scanScreen(scan) : door?.door === "LOCKED" && door?.updatedAt && !pin ? "LOCKED" : "IDLE";
  const [screenCls, screenTitle] = SCREEN[screen];
  return (
    <main className="container page demo-tools">
      <DemoHead title="Máy quét" description="Mô phỏng máy quét ở cửa kho. QR và PIN dùng cùng quyền truy cập, phải đúng kho và còn hiệu lực. Cửa không tự khoá.">
        <Tag tone="amber">Mô phỏng · chưa kết nối thiết bị</Tag>
      </DemoHead>
      {loadError && <Notice tone="error">{loadError}</Notice>}
      <div className="demo-tools__row">
        <div className="demo-tools__main">
          <section className="panel demo-tools__card">
            <h2>1 · Chọn cửa kho</h2>
            <div className="form-pair">
              <Field label="Cơ sở"><select value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>{facilities.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}</select></Field>
              <Field label="Ô kho"><select value={unit} disabled={!units.length} onChange={(e) => setUnit(e.target.value)}>
                {!units.length && <option value="">Chưa có ô kho</option>}
                {units.map((u) => <option key={u.unitId || u.unitNumber} value={u.unitNumber}>{u.unitNumber}</option>)}
              </select></Field>
            </div>
          </section>
          <section className="panel demo-tools__card">
            <h2>2 · Máy quét tại cửa {unit}</h2>
            <div className="demo-scan__stand">
              <div className="demo-scan__plate" aria-hidden="true"><i /><i /><i /><i /></div>
              <div className="demo-scan" ref={pad} tabIndex={0} onKeyDown={onKey} aria-label={`Máy quét cửa ${unit}`}>
                <div className="demo-scan__top">
                  <span className={`demo-scan__led${busy ? " is-busy" : ""}`}>{busy ? "ĐANG KIỂM TRA" : "SẴN SÀNG"}</span>
                  <span className="demo-scan__grille" aria-hidden="true" />
                  <span className="demo-scan__brand">SafeSpace</span>
                </div>
                <div className="demo-scan__reader" aria-hidden="true"><span className="demo-scan__lens" /><span className="demo-scan__beam" /></div>
                <p className="demo-scan__reader-hint">Đưa mã QR vào đây</p>
                <div className="demo-scan__bezel">
                <div className={`demo-scan__screen ${screenCls}`} aria-live="assertive">
                  <p className="demo-scan__bar"><span>{unit || "—"}</span><span>{clock()}</span></p>
                  <strong>{screenTitle}</strong>
                  {screen === "IDLE" ? <>
                    <span className="demo-scan__dots">{Array.from({ length: PIN_LENGTH }, (_, i) => <i key={i} className={i < pin.length ? "is-on" : i === pin.length ? "is-next" : ""} />)}</span>
                    <small>{pinMsg || "C: xoá nhập lại · OK: kiểm tra mã"}<br />Hoặc bấm "Mở cửa bằng QR"</small>
                  </> : <small>{screen === "OPEN" ? `${scan.customerName || ""} · ${scan.method === "QR" ? "QR" : "PIN"} · ${dateTimeLabel(scan.at).slice(-5)}`
                    : screen === "LOCKED" ? `Khoá lúc ${dateTimeLabel(door.updatedAt)}` : scan.reason}</small>}
                </div>
                </div>
                <div className="demo-scan__keys">
                  {[["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"]].map(([d, sub]) => <button type="button" key={d} aria-label={d} disabled={busy} onClick={() => pressDigit(d)}>{d}{sub && <small aria-hidden="true">{sub}</small>}</button>)}
                  <button type="button" className="is-clear" aria-label="C" disabled={busy} onClick={() => { setPin(""); setPinMsg(""); setScan(null); }}>C<small aria-hidden="true">XOÁ</small></button>
                  <button type="button" aria-label="0" disabled={busy} onClick={() => pressDigit("0")}>0</button>{/* Phím 0 bấm được như máy thật; PIN không có số 0 nên bấm OK sẽ báo lỗi (D53) */}
                  <button type="button" className="is-ok" disabled={busy} onClick={submitPin}>OK</button>
                </div>
                <button type="button" className="demo-scan__qr" disabled={busy || !unit} onClick={() => setPopup({ kind: "QR" })}><Icon name="qr" size={18} /> Mở cửa bằng QR</button>
                <div className="demo-scan__row">
                  <button type="button" className="is-help" disabled={busy || !unit} onClick={() => setPopup({ kind: "SUPPORT" })}><i aria-hidden="true" />Gọi hỗ trợ</button>
                  <button type="button" className="is-close" disabled={busy || !unit} onClick={() => setPopup({ kind: "CLOSE" })}><i aria-hidden="true" />Đóng cửa</button>
                </div>
                <p className="demo-scan__model" aria-hidden="true">MODEL SA-200 · CỬA KHO TỰ PHỤC VỤ</p>
              </div>
            </div>
          </section>
        </div>
        <aside className="demo-tools__aside">
          <section className="panel demo-tools__card">
            <h2>Trạng thái cửa {unit}</h2>
            <p><Tag tone={open ? "amber" : "gray"}>{open ? "Đang mở" : "Đã khoá"}</Tag>{door?.updatedAt && <span className="muted"> từ {dateTimeLabel(door.updatedAt)}</span>}</p>
            <p className="demo-tools__hint">Cửa không tự khoá. Đóng bằng nút "Đóng cửa" trên máy quét hoặc trong Kho của tôi của khách.</p>
          </section>
          <section className="panel demo-tools__card">
            <h2>Lần quét gần nhất</h2>
            {!scan ? <p className="muted">Chưa quét ở ô này trong lần mở trang.</p> : <dl className="demo-tools__sum">
              <div><dt>Thời gian</dt><dd>{dateTimeLabel(scan.at)}</dd></div>
              <div><dt>Kết quả</dt><dd className={scan.result === "OPEN" ? "is-green" : "is-red"}>{scan.result === "OPEN" ? "Mở cửa" : "Từ chối"}</dd></div>
              <div><dt>Cách xác thực</dt><dd>{scan.method === "QR" ? "QR" : "PIN"}</dd></div>
              {scan.contractCode && <div><dt>Hợp đồng</dt><dd>{scan.contractCode}{scan.customerName ? ` · ${scan.customerName}` : ""}</dd></div>}
            </dl>}
          </section>
          <section className="panel demo-tools__card">
            <h2>Cần hỗ trợ?</h2>
            <p className="muted">Gửi ngay cho nhân viên cơ sở, kèm cơ sở và ô đang thao tác. Không cần nhập lại hay gửi ảnh.</p>
            <Button variant="outline" block disabled={busy || !unit} onClick={() => setPopup({ kind: "SUPPORT" })}>Gửi hỗ trợ</Button>
          </section>
        </aside>
      </div>

      {popup?.kind === "QR" && <QrDialog onClose={() => setPopup(null)} onPin={() => { setPopup(null); pad.current?.focus(); }} onCode={(code) => { setPopup(null); doScan(code, "QR"); }} />}
      {popup?.kind === "OPEN" && <ConfirmDialog tone="success" title={`Đã mở cửa ${popup.scan.unitNumber || unit}`} cancelLabel={null} hint="" label="Đóng"
        text={`Xác thực bằng ${popup.scan.method === "QR" ? "QR" : "PIN"} thành công. Cửa giữ trạng thái mở cho tới khi bấm "Đóng cửa".`}
        rows={[["Khách", popup.scan.customerName], ["Hợp đồng", popup.scan.contractCode]].filter((r) => r[1])} onCancel={() => setPopup(null)} onConfirm={() => setPopup(null)} />}
      {popup?.kind === "NOT_YET" && <ConfirmDialog tone="warning" title="Chưa đến ngày sử dụng" cancelLabel={null} hint="" label="Đóng"
        text={popup.scan.reason} rows={[["Ô kho", popup.scan.unitNumber || unit], ["Hợp đồng", popup.scan.contractCode]].filter((r) => r[1])} onCancel={() => setPopup(null)} onConfirm={() => setPopup(null)} />}
      {popup?.kind === "DENIED" && <ConfirmDialog tone="error" title="Từ chối mở cửa" cancelLabel={null} hint="" label="Đóng"
        text={popup.scan.reason || "Mã không hợp lệ hoặc đã hết hiệu lực."} onCancel={() => setPopup(null)} onConfirm={() => setPopup(null)} />}
      {popup?.kind === "CLOSE" && <ConfirmDialog title={`Đóng cửa kho ${unit}?`} busy={busy} label="Đóng cửa" hint="Kiểm tra không còn ai trong kho."
        text="Cửa khoá lại. Lần sau mở bằng QR hoặc PIN như bình thường." rows={[["Cơ sở", facilityName], ["Ô kho", unit]]} onCancel={() => setPopup(null)} onConfirm={closeDoor} />}
      {popup?.kind === "CLOSED" && <ConfirmDialog tone="success" title={`Đã đóng cửa ${unit}`} cancelLabel={null} hint="" label="Đóng"
        text={popup.door?.changed === false ? "Cửa đã khoá từ trước, không cần đóng thêm." : "Cửa kho đã khoá và được ghi vào Nhật ký cửa."}
        rows={popup.door?.updatedAt ? [["Cập nhật", dateTimeLabel(popup.door.updatedAt)]] : []} onCancel={() => setPopup(null)} onConfirm={() => setPopup(null)} />}
      {popup?.kind === "SUPPORT" && <ConfirmDialog title="Gửi hỗ trợ cho cơ sở?" busy={busy} label="Gửi hỗ trợ" cancelLabel="Huỷ" hint=""
        text="Yêu cầu tự gắn cơ sở và ô đang thao tác." rows={[["Cơ sở", facilityName], ["Ô kho", unit], ...(scan?.customerName ? [["Khách liên quan", scan.customerName]] : [])]}
        onCancel={() => setPopup(null)} onConfirm={support}>
        <Field label="Mô tả (không bắt buộc)"><textarea rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: quét QR nhiều lần không mở được" /></Field>
      </ConfirmDialog>}
      {popup?.kind === "SUPPORT_OK" && <ConfirmDialog tone="success" title={popup.res.duplicate ? "Yêu cầu hỗ trợ đang mở" : "Đã gửi hỗ trợ"} cancelLabel={null} hint="" label="Đóng"
        text={popup.res.duplicate ? `Ô ${popup.res.unitNumber} đã có yêu cầu ${popup.res.ticketCode} đang mở, nhân viên đang xử lý. Không tạo yêu cầu mới.`
          : `Nhân viên cơ sở đã nhận yêu cầu ${popup.res.ticketCode}. Bấm lại trong lúc yêu cầu còn mở sẽ không tạo yêu cầu mới.`}
        onCancel={() => setPopup(null)} onConfirm={() => setPopup(null)} />}
      {popup?.kind === "ERROR" && <ConfirmDialog tone="error" title="Chưa thực hiện được" label="Thử lại" busy={busy} cancelLabel="Đóng" hint=""
        text={popup.text} onCancel={() => setPopup(null)} onConfirm={() => { const r = popup.retry; setPopup(null); r?.(); }} />}
    </main>
  );
}
