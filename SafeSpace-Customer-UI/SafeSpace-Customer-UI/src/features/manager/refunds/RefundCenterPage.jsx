/**
 * REFUND CENTER PAGE - HOÀN TIỀN (mục navbar Quản lý, #7 · 12/11)
 *
 * Gộp ba việc hoàn tiền vào một mục trên navbar, lọc theo loại ngay trong trang:
 * - Hoàn tiền đơn huỷ (huỷ trước ngày thuê).
 * - Hoàn cọc sau trả kho (sau khi chốt đối soát).
 * - Hoàn tiền mặt tại quầy (khách chọn nhận tiền mặt, duyệt và giao nhân viên chi).
 * Mỗi phần dùng lại đúng màn xử lý cũ nên không đổi nghiệp vụ hay API.
 */
import React from "react";
import { PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { go, qs } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { CancellationRefundPage } from "./CancellationRefundPage.jsx";
import { DepositRefundPage } from "./DepositRefundPage.jsx";
import { CashRefundApprovalPage } from "../cash/CashRefundApprovalPage.jsx";
import { REFUND_KINDS, refundKindOf, refundPendingCounts } from "./refundCenterModel.js";
import "./refund-center.css";

export function RefundCenterPage({ query = new URLSearchParams() }) {
  const { ops } = useOps();
  const kind = refundKindOf(query.get("kind"));
  const counts = refundPendingCounts(ops);
  const total = counts.cancel + counts.deposit + counts.cash;
  return (
    <main className="container page refund-center">
      <p className="customer-records__breadcrumb">SafeSpace / Quản lý cơ sở / Hoàn tiền</p>
      <PageHeader title="Hoàn tiền" description="Hoàn tiền đơn huỷ, hoàn cọc sau trả kho và chi tiền mặt tại quầy ở cùng một nơi. Hoàn về tài khoản chính chủ hoặc tiền mặt theo lựa chọn của khách.">
        <Tag tone={total ? "amber" : "green"}>{total ? `${total} khoản chờ xử lý` : "Không có khoản chờ"}</Tag>
      </PageHeader>
      <div className="chips refund-center__filters" role="group" aria-label="Lọc theo loại hoàn tiền">
        {REFUND_KINDS.map(([k, label]) => {
          const n = k ? counts[k] : total;
          return (
            <button type="button" key={k || "all"} className={`chip chip--dark${kind === k ? " is-on" : ""}`} aria-pressed={kind === k}
              onClick={() => go(`manager/refund${qs({ kind: k })}`, { replace: true })}>
              {label}{n ? ` · ${n}` : ""}
            </button>
          );
        })}
      </div>
      <div className="refund-center__body" key={kind || "all"}>
        {(!kind || kind === "cancel") && <CancellationRefundPage embedded />}
        {(!kind || kind === "deposit") && <DepositRefundPage embedded query={query} />}
        {(!kind || kind === "cash") && <CashRefundApprovalPage embedded />}
      </div>
    </main>
  );
}
