import React, { useState } from "react";
import { Button, Empty, LinkButton, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateTimeLabel, rangeLabel } from "../../../shared/utils/format.js";
import { candidateUnits } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { QueuePicker } from "../../facility-operations/components/FacilityOperationsComponents.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

export function UnitAllocationPage({ query }) {
  const { ops, run } = useOps();
  const pending = ops.allocations.filter((a) => a.status === "PENDING");
  const a = ops.allocations.find((x) => x.id === query.get("id")) || pending[0];
  const units = a ? candidateUnits(ops, a) : [];
  const [pick, setPick] = useState(null);
  const chosen = units.find((u) => u.code === pick) || units[0];
  if (!a)
    return (
      <main className="container page">
        <Empty title="Không có đơn chờ phân bổ" text="Hệ thống tự phân bổ sau thanh toán. Đơn cần xử lý ngoại lệ hoặc giữ chỗ tại quầy sẽ hiện ở đây.">
          <LinkButton to="manager">Về tổng quan</LinkButton>
        </Empty>
      </main>
    );
  const submit = async () => {
    // Figma 885:10453–10477: xác nhận → kết quả “Về màn hình trước”, ở lại trang phân bổ
    await run("ALLOCATE", { id: a.id, unit: chosen?.code }, `Đã phân bổ kho ${chosen?.code}`);
  };
  return (
    <main className="container page">
      <QueuePicker label="Đơn chờ phân bổ" items={pending} current={a.id} base="manager/allocate" render={(x) => `${x.id.slice(-4)} · ${x.customer}`} />
      <PageHeaderBlock title="Phân bổ kho cho đơn đặt chỗ" text={`Phạm vi: ${ops.facility.name} · Chỉ hiển thị kho trống trong toàn bộ kỳ thuê.`} />
      <section className="panel ops-order">
        <Tag tone="blue">Cần xử lý phân bổ</Tag>
        <strong>{a.id} · {a.customer}</strong>
        <span className="muted">{a.offer} · {rangeLabel(a.start, a.end)}</span>
        <span className="muted">Lịch nhận dự kiến: {dateTimeLabel(a.pickup)}</span>
      </section>
      {["DONE", "ALLOCATED"].includes(a.status) ? (
        <Notice tone="success">Đã phân bổ kho {a.unit} lúc {dateTimeLabel(a.allocated_at)}. Hợp đồng và QR/PIN được cấp sau khi đủ khoản thu. Chìa khóa vật lý nhận tại quầy.</Notice>
      ) : units.length === 0 ? (
        <Notice tone="error">Không còn kho trống khớp loại kho và diện tích trong kỳ thuê. Liên hệ khách để đổi lựa chọn hoặc cơ sở.</Notice>
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
