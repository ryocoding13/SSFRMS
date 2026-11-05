import React, { useRef, useState } from "react";
import { Button, DetailList, Empty, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import { DAMAGE_CHOICES } from "./damageModel.js";
import "./damage.css";
export const amountLabel = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? money(value) : "Chưa có dữ liệu";
export const timeLabel = value => value && Number.isFinite(Date.parse(value)) ? dateTimeLabel(value) : "Chưa có thông tin";
export function DamageState({ load, children }) {
  return <>{load.demo && <Notice>Chế độ mô phỏng FE: hồ sơ khắc phục được lưu riêng trên trình duyệt, không thay đổi quyết toán hay chuyển tiền thật. Ảnh chỉ lưu tên tệp sau khi gửi.</Notice>}
    {load.needsRefresh && <Notice tone="error">Chưa xác minh kết quả lần gửi trước. Tải lại hồ sơ trước khi thao tác tiếp.<Button variant="outline" disabled={load.busy} onClick={load.reload}>Tải lại hồ sơ</Button></Notice>}
    {load.loading ? <p role="status">Đang tải hồ sơ hư hỏng…</p> : load.error ? <Empty title="Chưa tải được hồ sơ hư hỏng" text={load.error}><Button onClick={load.reload}>Thử lại</Button></Empty> : children}
  </>;
}
const safeImageUrl = value => typeof value === "string" && (/^https:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//")));
export function DamagePhotos({ photos = [] }) {
  const valid = (Array.isArray(photos) ? photos : []).filter(photo => safeImageUrl(photo?.url));
  return valid.length ? <div className="damage-photos">{valid.map((photo,index) => <a key={`${photo.url}-${index}`} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.caption || `Ảnh bằng chứng ${index+1}`} loading="lazy" /></a>)}</div> : <p className="hint">Chưa có ảnh bằng chứng từ cơ sở.</p>;
}
export function DamageRecord({ item }) {
  return <section className="panel customer-detail__card"><h2>Hạng mục được ghi nhận</h2><DetailList items={[["Khách hàng", item.customer || "Chưa có thông tin"], ["Hợp đồng / kho", `${item.contractId} · ${item.unit || "Chưa có thông tin"}`], ["Hạng mục", item.item || "Chưa có nội dung biên bản"], ["Khấu trừ đề xuất", amountLabel(item.damageAmount)]]} /><DamagePhotos photos={item.photos} /><p className="hint">Biên bản: {item.recordedBy || "Chưa có người lập"} · {timeLabel(item.recordedAt)}</p></section>;
}
export function DamageResponseRecord({ item }) {
  return <section className="panel customer-detail__card"><h2>Phản hồi của khách</h2><DetailList items={[["Khách hàng", item.customer || "Chưa có thông tin"], ["Hạng mục", item.item || "Chưa có thông tin"], ["Khấu trừ đề xuất", amountLabel(item.damageAmount)], ["Phương án", DAMAGE_CHOICES[item.response?.choice] || "Chưa có phản hồi"], ["Khách đề nghị", item.response?.note || "Không có nội dung bổ sung"]]} />
    {item.response?.files?.length > 0 && <p className="damage-note">Tệp khách gửi: {item.response.files.map(file => file.fileName).join(", ")}</p>}
    <DamagePhotos photos={item.response?.photos || []} />
    {item.remediation && <div className="damage-note"><strong>Khách báo đã khắc phục</strong><p>{item.remediation.note}</p><p className="hint">Gửi lúc {timeLabel(item.remediation.at)}</p>{item.remediation.files?.length > 0 && <p>Tệp: {item.remediation.files.map(file => file.fileName).join(", ")}</p>}<DamagePhotos photos={item.remediation.photos || []} /></div>}
  </section>;
}
export function DamageFinance({ item, inspection = false }) {
  return <aside className="panel customer-detail__card customer-detail__sidebar"><h2>{inspection ? "Khoản hoàn sau kiểm tra" : "Ảnh hưởng tới khoản hoàn"}</h2><DetailList items={[["Cọc ban đầu", amountLabel(item.deposit)], ["Khấu trừ khác", amountLabel(item.otherDeductions)], ["Hư hỏng đang giữ", amountLabel(item.damageDeduction)], ["Dự kiến hoàn", amountLabel(item.refundPreview)], ["Nếu khắc phục đạt", amountLabel(item.refundIfRemedied)]]} /><p className="hint">Số tiền xem trước khi đối soát chưa chốt. Khấu trừ không vượt tiền cọc; không thu thêm ngoài cọc. Chỉ kết quả khắc phục đạt mới bỏ khoản khấu trừ hư hỏng.</p><p className="hint">Thao tác này không xác nhận đã chuyển khoản hoàn tiền và không mở lại QR/PIN.</p></aside>;
}
export function DamageOutcome({ item }) {
  return <>{item.decision && <Notice tone={item.status === "REJECTED" ? "error" : "info"}>Quyết định cơ sở: {item.decision.decision === "ALLOW" ? "Cho phép khắc phục; khoản khấu trừ tạm giữ đến khi kiểm tra đạt." : "Từ chối phản hồi."}{item.decision.note && <p>Lý do/ghi chú: {item.decision.note}</p>}{item.deadline && <p>Hạn khắc phục: {timeLabel(item.deadline)} · giờ Việt Nam</p>}</Notice>}
    {item.inspection && <Notice tone={item.inspection.result === "PASS" ? "success" : "error"}>{item.inspection.result === "PASS" ? "Khắc phục đạt; bỏ khoản khấu trừ hư hỏng này." : "Khắc phục chưa đạt; khoản khấu trừ được giữ để đối soát."}<p>{item.inspection.note}</p></Notice>}
    {item.status === "CUSTOMER_ACCEPTED" && <Notice>Đã ghi nhận bạn đồng ý khấu trừ theo biên bản. Khoản hoàn chính thức chờ cơ sở chốt đối soát.</Notice>}
  </>;
}
export function useDamageChange(load) {
  const [pending,setPending] = useState(null), guard = useRef(false);
  const ask = value => { if (!load.busy && !load.needsRefresh) setPending({...value,stage:"confirm"}); };
  const close = () => { if (!load.busy) setPending(null); };
  const confirm = async () => {
    if (pending.stage !== "confirm") { close(); return; }
    if (guard.current) return;
    guard.current = true;
    try {
      const result = await load.run(pending.id,pending.action,pending.payload);
      setPending(previous => previous ? {...previous, stage:result.ok?"success":"failure",error:result.error} : null);
    } finally { guard.current = false; }
  };
  const dialog = pending && <ConfirmDialog title={pending.stage === "confirm" ? pending.title : pending.stage === "success" ? "Đã ghi nhận" : "Chưa ghi nhận được kết quả"} tone={pending.stage} busy={load.busy} text={pending.stage === "confirm" ? pending.summary : pending.stage === "success" ? (load.demo ? "Đã cập nhật dữ liệu mô phỏng trên trình duyệt." : "Máy chủ đã trả kết quả phù hợp hồ sơ. Kết quả chuyển sang bước đối soát; chưa thực hiện chuyển tiền.") : pending.error} rows={[]} hint={pending.stage === "failure" ? "Nội dung và tệp bạn chọn vẫn được giữ. Kiểm tra hoặc tải lại hồ sơ trước khi thử tiếp." : ""} label={pending.stage === "confirm" ? "Xác nhận" : "Quay lại hồ sơ"} cancelLabel={pending.stage === "confirm" ? "Quay lại" : null} onCancel={close} onConfirm={confirm} />;
  return [dialog,ask];
}
