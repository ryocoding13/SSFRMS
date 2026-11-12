/**
 * RENEWAL APPROVAL PAGE - PHÊ DUYỆT YÊU CẦU GIA HẠN HỢP ĐỒNG (M01 / D32 / D41 / D46)
 *
 * Nghiệp vụ:
 * - Quản lý duyệt gia hạn trong vòng 24 giờ kể từ khi khách gửi yêu cầu.
 * - Kiểm tra ràng buộc D41: Không cho gia hạn ô hiện tại nếu đã có khách khác đặt trước.
 * - Trường hợp gia hạn chuyển sang ô khác (D46 / D46b): Kiểm tra và giữ ô mới, tính cọc chênh.
 */
import React from "react";
import { LinkButton, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel } from "../../../shared/utils/format.js";
import { unitMoveText } from "./renewalApprovalModel.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

/**
 * Màn hình lịch sử gia hạn (đã bỏ hàng chờ quản lý duyệt — gia hạn hợp lệ tự động xác nhận).
 */
export function RenewalApprovalPage() {
  const { ops } = useOps();
  const done = ops.renewals.filter((r) => r.status !== "PENDING");
  return (
    <main className="container page">
      <PageHeaderBlock title="Gia hạn hợp đồng" text="Hệ thống tự động xác nhận các gia hạn hợp lệ để khách thanh toán trực tiếp." />
      <Notice>Quản lý không còn bước duyệt/từ chối gia hạn thủ công. Mọi yêu cầu gia hạn hợp lệ được xác nhận tự động khi khách gửi và mở thanh toán trong 24 giờ.</Notice>
      {done.length > 0 && (
        <>
          <h2 className="section-title">Lịch sử gia hạn</h2>
          <ul className="rows">
            {done.map((r) => (
              <li className="row ops-row" key={r.id}>
                <div className="row__main">
                  <strong>{r.customer} — Kho #{r.unit}</strong>
                  <span>{r.status === "APPROVED" || r.status === "PAID" ? `Gia hạn đến ${dateLabel(r.to)}${r.target_unit ? ` · ${unitMoveText(r)}` : ""}` : `Lý do: ${r.reason || "Đã đóng"}`}</span>
                </div>
                <Tag tone={r.status === "APPROVED" || r.status === "PAID" ? "green" : "red"}>{r.status === "PAID" ? "Đã thanh toán" : r.status === "APPROVED" ? "Đã xác nhận" : "Đã từ chối"}</Tag>
              </li>
            ))}
          </ul>
        </>
      )}
      <LinkButton to="manager" variant="outline">Về tổng quan</LinkButton>
    </main>
  );
}
