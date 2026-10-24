import React, { useState } from "react";
import { Button, LinkButton, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateTimeLabel, rangeLabel } from "../../../shared/utils/format.js";
import { candidateUnits } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { QueuePicker } from "../../facility-operations/components/FacilityOperationsComponents.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

export function UnitAllocationPage({ query }) {
  const { ops, run } = useOps();
  const pending = ops.allocations.filter((a) => a.status === "PENDING");
  const picked = query.get("id");
  const a = ops.allocations.find((x) => x.id === picked) || pending[0];
  const units = a ? candidateUnits(ops, a) : [];
  const [pick, setPick] = useState(null);
  const chosen = units.find((u) => u.code === pick) || units[0];
  // Figma M05 · Đã xử lý hết: không còn yêu cầu, huy hiệu menu tự ẩn
  if (!a || (!picked && pending.length === 0))
    return (
      <main className="container page">
        <PageHeaderBlock title="Đã xử lý tất cả yêu cầu" text="Không còn yêu cầu đang chờ. Mục Phân bổ kho tự ẩn huy hiệu." />
        <LinkButton to="manager" className="btn--fit">Về tổng quan</LinkButton>
      </main>
    );
  // Figma M05 · Còn N yêu cầu chờ: danh sách để chọn từng yêu cầu
  if (!picked && pending.length > 1)
    return (
      <main className="container page">
        <PageHeaderBlock title="Yêu cầu phân bổ kho đang chờ" text="Hoàn thành từng yêu cầu để cập nhật số chờ trên menu." />
        <ul className="rows">
          {pending.map((x) => (
            <li className="row ops-row" key={x.id}>
              <div className="row__main">
                <strong>{x.id.replace(/^SS-\d{8}-/, "SS-")} · {x.customer}</strong>
                <span>{x.offer} · Cần xác nhận phân bổ</span>
              </div>
              <LinkButton to={`manager/allocate?id=${encodeURIComponent(x.id)}`}>Xử lý yêu cầu</LinkButton>
            </li>
          ))}
        </ul>
      </main>
    );
  const noUnit = !["DONE", "ALLOCATED"].includes(a.status) && units.length === 0;
  const submit = async () => {
    // Figma 885:10453–10477: xác nhận → kết quả “Về màn hình trước”, ở lại trang phân bổ
    await run("ALLOCATE", { id: a.id, unit: chosen?.code }, `Đã phân bổ kho ${chosen?.code}`);
  };
  return (
    <main className="container page">
      <QueuePicker label="Đơn chờ phân bổ" items={pending} current={a.id} base="manager/allocate" render={(x) => `${x.id.slice(-4)} · ${x.customer}`} />
      {noUnit ? (
        <PageHeaderBlock title="Chưa có ô phù hợp để cấp" text="Khoản thanh toán đã được ghi nhận. Hiện không có ô đúng cơ sở, loại kho và kỳ thuê; giữ yêu cầu chờ xử lý, không tạo hợp đồng hoặc mã mở kho khi chưa có ô." />
      ) : (
        <PageHeaderBlock title="Phân bổ kho cho đơn đặt chỗ" text={`Phạm vi: ${ops.facility.name} · Chỉ hiển thị kho trống trong toàn bộ kỳ thuê.`} />
      )}
      <section className="panel ops-order">
        <Tag tone={noUnit ? "green" : "blue"}>{noUnit ? "Đã thanh toán" : "Cần xử lý phân bổ"}</Tag>
        <strong>{a.id} · {a.customer}</strong>
        <span className="muted">{a.offer} · {rangeLabel(a.start, a.end)}</span>
        <span className="muted">Lịch nhận dự kiến: {dateTimeLabel(a.pickup)}</span>
      </section>
      {["DONE", "ALLOCATED"].includes(a.status) ? (
        <Notice tone="success">Đã phân bổ kho {a.unit} lúc {dateTimeLabel(a.allocated_at)}. Hợp đồng và QR/PIN được cấp sau khi đủ khoản thu. Chìa khóa vật lý nhận tại quầy.</Notice>
      ) : units.length === 0 ? (
        // Figma M05-không ô (848:10909)
        <div className="ops-actions ops-actions--col">
          <LinkButton to="manager/units">Kiểm tra danh sách ô kho</LinkButton>
          <LinkButton to="manager/allocate" variant="outline">Về yêu cầu chờ phân bổ</LinkButton>
        </div>
      ) : (
        <>
          <div className="panel table-wrap">
            <table className="table table--hover">
              <thead><tr><th>Chọn</th><th>Mã kho</th><th>Diện tích / tầng</th><th>Tình trạng</th><th>Khả dụng</th></tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.code} onClick={() => setPick(u.code)} className={chosen?.code === u.code ? "is-picked" : ""}>
                    <td><input type="radio" name="unit" checked={chosen?.code === u.code} onChange={() => setPick(u.code)} aria-label={`Chọn kho ${u.code}`} /></td>
                    <td className="cell-strong">{u.code}</td>
                    <td>{u.area} m² · Tầng {u.floor}</td>
                    <td>Sẵn sàng</td>
                    <td><Tag tone="green">Trống toàn kỳ</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button onClick={submit}>Xác nhận phân bổ {chosen?.code}</Button>
        </>
      )}
    </main>
  );
}
