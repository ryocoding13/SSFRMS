import React, { useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Field, Notice, Tag } from "../../../shared/components/UI.jsx";
import { go } from "../../../app/router.js";
import { ASSIGN_STATE } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { slotLabel } from "../../facility-operations/components/FacilityOperationsComponents.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

export function StaffAssignmentPage() {
  const { ops, run } = useOps();
  const open = ops.assignments.filter((a) => a.status !== "DONE");
  const [task, setTask] = useState(() => (open.find((a) => a.status === "OPEN") || open[0])?.id || "");
  const [staff, setStaff] = useState(ops.staff[0]?.staff_id || "");
  const staffName = (id) => ops.staff.find((s) => s.staff_id === id)?.full_name || "Chưa phân công";
  const busyCount = (id) => ops.assignments.filter((a) => a.staff === id && a.status !== "DONE").length;
  const submit = async (e) => {
    e.preventDefault();
    const r = await run("ASSIGN", { id: task, staff }, `Đã phân công ${staffName(staff)}`);
    if (r.ok) go("manager/done?kind=assign");
  };
  return (
    <main className="container page">
      <PageHeaderBlock title="Phân công & lịch vận hành" text={`Sắp xếp nhận chìa khóa, kiểm tra kho và xử lý sự cố tại ${ops.facility.name}.`} />
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Công việc</th><th>Lịch hẹn</th><th>Nhân viên</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {ops.assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.title}</td>
                <td>{slotLabel(a.when)}</td>
                <td>{staffName(a.staff)}</td>
                <td><Tag tone={ASSIGN_STATE[a.status][1]}>{ASSIGN_STATE[a.status][0]}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open.length > 0 ? (
        <form className="panel form-card" onSubmit={submit}>
          <Field label="Công việc">
            <Select value={task} onChange={(e) => setTask(e.target.value)}>
              {open.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </Select>
          </Field>
          <Field label="Nhân viên phụ trách">
            <Select value={staff} onChange={(e) => setStaff(e.target.value)}>
              {ops.staff.map((s) => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.full_name} · Ca {s.shift} · {busyCount(s.staff_id) ? `${busyCount(s.staff_id)} việc đang nhận` : "Còn lịch trống"}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit">Lưu phân công</Button>
        </form>
      ) : (
        <Notice tone="success">Tất cả công việc đã hoàn tất.</Notice>
      )}
    </main>
  );
}
