import React from "react";
import { Button, Empty, LinkButton } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";

// S09f / S09b · Thu phí phát sinh & công nợ tại quầy (Figma 848:10716, 830:10924). Xác nhận → S09fc / S09c,
// kết quả S09fd / S09d, lỗi S09e (provider). Khoản khách đã trả qua PayOS không hiện ở đây.
export function FeeCollectionPage({ query }) {
  const { ops, run } = useOps();
  const fees = ops.fee_collections || [];
  const f = fees.find((x) => x.id === query.get("id")) || fees.find((x) => x.status === "PENDING");
  if (!f)
    return (
      <main className="container page">
        <Empty title="Không có khoản phí chờ thu" text="Khi khách chọn trả phí phát sinh hoặc công nợ tại quầy, khoản thu sẽ hiện ở đây.">
          <LinkButton to="staff/reconcile">Về danh sách thu tiền</LinkButton>
        </Empty>
      </main>
    );
  const paid = f.status !== "PENDING";
  const items = Array.isArray(f.items) ? f.items : [];
  const submit = async () => {
    const r = await run("CONFIRM_FEE_COLLECTION", { id: f.id }, `Đã thu ${money(f.amount)} · ${f.contract}`);
    if (r.ok) go("staff/reconcile");
  };
  return (
    <main className="container page">
      <a className="back-link" href={href("staff/reconcile")}>← Danh sách thu tiền</a>
      <header className="page-header page-header--tight">
        <div>
          <h1>Thu phí & công nợ tại quầy</h1>
          <p>Chỉ xác nhận khi đã nhận đủ tiền. Kiểm tra trạng thái mới nhất để tránh thu lại khoản khách đã thanh toán qua PayOS.</p>
        </div>
      </header>
      <section className="panel form-card">
        <h2>{f.contract} · {f.customer} · Kho {f.unit}</h2>
        <p className="muted">{items.map(([label, amount]) => `${label}: ${money(amount)}`).join(" · ")}{items.length ? ". " : ""}Tổng cần thu: {money(f.amount)}.</p>
        <p className="muted">Phương thức: Tiền mặt tại quầy. Khoản thu này thanh toán công nợ hiện có; trạng thái hợp đồng đã kết thúc được giữ nguyên.{f.due ? ` Hạn thanh toán: ${dateLabel(f.due)}.` : ""}</p>
        {paid ? <p className="hint tone-green">Đã thu đủ {money(f.amount)}.</p> : <Button className="btn--fit" onClick={submit}>Xác nhận đã thu tiền</Button>}
      </section>
    </main>
  );
}
