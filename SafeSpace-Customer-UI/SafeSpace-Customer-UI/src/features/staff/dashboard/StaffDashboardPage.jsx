/**
 * STAFF DASHBOARD PAGE - BẢNG CÔNG VIỆC HÔM NAY CỦA NHÂN VIÊN CƠ SỞ (UC09)
 *
 * Bố cục lưới công việc 3x3 theo D14:
 * - Hàng đợi thu tiền tại kho (S09 / S10).
 * - Hàng đợi xác minh khách và bàn giao kho (S02).
 * - Hàng đợi kiểm tra trả kho và nhận chìa khóa (S03).
 * - Hàng đợi hỗ trợ kỹ thuật và sự cố (S04).
 */
import React from "react";
import { dateLabel, today } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { LIST_TEXT, TaskEmpty, TaskGrid, staffTasks } from "../../facility-operations/components/StaffTasks.jsx";
import { useMe } from "../hooks/useStaffIdentity.js";

/**
 * Màn hình trung tâm công việc hàng ngày của nhân viên trực tại cơ sở.
 * @param {{ query: URLSearchParams }} props
 */
export function StaffDashboardPage({ query }) {
  const { ops } = useOps();
  const me = useMe();
  const tasks = staffTasks(ops, me, "all");
  const count = (k) => tasks.filter((t) => t.kind === k).length;
  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>Công việc hôm nay — {dateLabel(today())}</h1>
          <p>{ops.facility.name}</p>
        </div>
      </header>
      <div className="stats">
        <div className="stat"><strong className="tone-blue">{ops.verifications.filter((v) => v.status === "TODO").length}</strong><span>Cần xác minh khách</span></div>
        <div className="stat"><strong className="warn">{count("reconcile")}</strong><span>Chờ thu tiền tại kho</span></div>
        <div className="stat"><strong className="ok">{count("support")}</strong><span>Yêu cầu hỗ trợ / bảo trì</span></div>
      </div>
      {tasks.length === 0 ? (
        <TaskEmpty
          title={LIST_TEXT.all.empty[0]}
          text={LIST_TEXT.all.empty[1]}
          action={<button type="button" className="btn btn--outline" onClick={() => window.location.reload()}>Tải lại danh sách</button>}
        />
      ) : (
        <>
          <h2 className="section-title">Danh sách việc cần xử lý · {tasks.length} việc</h2>
          <TaskGrid tasks={tasks} base="staff" query={query} />
        </>
      )}
    </main>
  );
}
