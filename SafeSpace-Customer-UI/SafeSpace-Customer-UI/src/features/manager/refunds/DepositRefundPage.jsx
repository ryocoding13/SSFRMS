/**
 * DEPOSIT REFUND PAGE - QUYẾT TOÁN VÀ HOÀN TRẢ TIỀN CỌC KHI KẾT THÚC THUÊ (M07 / D32 / D39)
 *
 * Nghiệp vụ D32 / D39:
 * - Sau khi nhân viên lập biên bản kiểm kê trả kho (S03), khách hàng có 48 giờ để xác nhận khấu trừ.
 * - Quản lý kiểm tra các khoản khấu trừ hợp lệ (vệ sinh tối đa 10% cọc, hư hỏng có ảnh bằng chứng).
 * - Tuyệt đối không tạo nợ âm vượt quá tiền cọc đang giữ; tạo lệnh thanh toán REFUND cho số tiền còn lại.
 */
import React,{useState} from "react";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { useWorkflowChange, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { isCashRefund, transferProof, knownMoney } from "../../facility-operations/settlements/settlementModel.js";
import { SettlementTable } from "../../facility-operations/settlements/SettlementComponents.jsx";
import { settlementFromRefund } from "../../facility-operations/settlements/settlementModel.js";
import { amountLabel,timeLabel } from "../../facility-operations/damage/DamageComponents.jsx";
import "../../../shared/styles/customer-detail.css";
import { go, qs } from "../../../app/router.js";

// D64 (18/11, Figma M-ĐS-CHỐT): quản lý thấy thông tin nhận hoàn khách đã điền và chỉ bấm xác nhận;
// không nhập mã giao dịch hay thời gian chuyển (máy chủ ghi thời điểm xác nhận).
function TransferForm({item,load,ask}) {
  const method = (item.method === "CASH" || item.bankName === "CASH") ? "CASH" : "BANK_TRANSFER";
  const isCash = method === "CASH";
  const [error, setError] = useState("");
  const payload = { id: item.id, confirmed: true, expectedVersion: item.version, method };
  const disabled = load.busy || load.needsRefresh;
  let valid = false;
  try { transferProof(item, payload); valid = true; } catch {}
  const rows = isCash
    ? [["Khách chọn nhận", "Tiền mặt tại quầy"], ["Người nhận", item.customer || item.accountHolder || "Chưa có dữ liệu"], ["Số tiền cần trả", amountLabel(item.amount)]]
    : [["Khách chọn nhận", "Chuyển khoản"], ["Ngân hàng", item.bankName || "Chưa có dữ liệu"], ["Số tài khoản", item.accountNumber || "Chưa có dữ liệu"],
       ["Chủ tài khoản", item.accountHolder || "Chưa có dữ liệu"], ["Số tiền cần chuyển", amountLabel(item.amount)]];
  const submit = (e) => {
    e.preventDefault();
    if (disabled) return;
    try { transferProof(item, payload); } catch (err) { return setError(err.message); }
    setError("");
    ask("CONFIRM_DEPOSIT_REFUND", payload,
      isCash ? `Xác nhận đã trả ${amountLabel(item.amount)} tiền mặt?` : `Xác nhận đã chuyển ${amountLabel(item.amount)}?`,
      isCash ? "Chỉ xác nhận khi khách đã nhận đủ tiền tại quầy. Không cần nhập mã giao dịch."
        : `Kiểm tra đã chuyển đúng số tiền vào ${item.bankName || "tài khoản"} · ${item.accountNumber || ""} · ${item.accountHolder || ""}. Không cần nhập mã giao dịch.`,
      { confirmLabel: isCash ? "Đã trả tiền mặt" : "Đã chuyển khoản",
        successTitle: `Đã hoàn tiền ${amountLabel(item.amount)}`,
        failTitle: isCash ? "Chưa ghi nhận được trả tiền mặt" : "Chưa ghi nhận được chuyển khoản",
        doneLabel: "Về biên bản & trả kho", onDone: () => go("manager/contracts") });
  };
  return (
    <form className="panel customer-detail__card" onSubmit={submit} noValidate>
      <h2>Bước tiếp theo</h2>
      <p className="hint">{isCash
        ? "Khách đã chọn nhận tiền mặt tại quầy. Khi khách đến nhận đủ tiền, bấm xác nhận. Không cần nhập mã giao dịch."
        : "Khách đã chọn nhận hoàn bằng chuyển khoản. Chuyển đúng số tiền vào tài khoản dưới đây rồi bấm xác nhận. Không cần nhập mã giao dịch."}</p>
      <DetailList items={rows} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="customer-detail__actions">
        <LinkButton to={`manager/contracts?id=${encodeURIComponent(item.contractId)}`} variant="outline">Xem biên bản &amp; ảnh</LinkButton>
        <Button type="submit" disabled={disabled || !valid}>{isCash ? "Xác nhận đã trả tiền mặt" : "Xác nhận đã chuyển khoản"}</Button>
      </div>
    </form>
  );
}
/**
 * Màn hình quyết toán tiền đặt cọc và phê duyệt lệnh hoàn tiền cho khách hàng trả kho.
 */
export function DepositRefundPage({query=new URLSearchParams(),embedded=false}) {
 const base=useWorkflowData("depositRefunds"),{ops,source,run,saving,needsRefresh}=useOps(),[selected,setSelected]=useState(query.get("id")||"");
 const load=source==="local"?{...base,data:ops.deposit_refunds||[],loading:false,error:"",busy:saving,needsRefresh,demo:true,run:(action,payload)=>run(action,payload)}:base;
 const [dialog,ask]=useWorkflowChange(load),item=load.data?.find(r=>r.id===selected);
 // D42/D47/D66: hoàn cọc tiền mặt nằm ở mục "Hoàn tiền mặt tại quầy" (quản lý xác nhận đã trả) — không lặp ở đây.
 const transfers=(load.data||[]).filter(r=>!isCashRefund(r));
 const Wrap=embedded?"section":"main";
 return <Wrap className={embedded?"refund-center__section customer-detail":"container page customer-records customer-detail"}>{embedded?<h2 className="section-title">{item?`Hoàn cọc ${item.contractId} · ${item.customer}`:"Hoàn cọc sau trả kho"}</h2>:<><p className="customer-records__breadcrumb">SafeSpace / Quản lý cơ sở / Hoàn tiền</p><PageHeader title={item?`Hoàn cọc ${item.contractId} · ${item.customer}`:"Hoàn cọc sau trả kho"} description="Duyệt đối soát và xác nhận chuyển tiền là hai bước riêng."/></>}<WorkflowState load={load}>{!selected?<div className="customer-detail__column">{transfers.map(r=><section className="panel customer-detail__card record-card" key={r.id}><div><h2>{r.customer} · Kho {r.unit}</h2><p>{r.contractId} · {amountLabel(r.amount)}</p><Tag tone="amber">{r.status==="PAID"?"Đã hoàn":r.status==="PENDING"?"Chờ hoàn":r.status==="NO_REFUND"?"Không còn khoản hoàn":"Chưa rõ trạng thái"}</Tag></div><Button onClick={()=>setSelected(r.id)}>Xem khoản hoàn</Button></section>)}{!transfers.length&&<Empty title="Không có đối soát chờ duyệt" text="Khoản hoàn cọc sẽ hiện ở đây sau khi quản lý chốt số tiền ở Biên bản & trả kho."/>}</div>:!item?<Empty title="Không tìm thấy khoản hoàn"/>:<><div className="panel customer-detail__card"><DetailList items={[["1 · Duyệt đối soát",item.inspectedAt?timeLabel(item.inspectedAt):"Chưa có dữ liệu"],["2 · " + (item.method==="CASH"?"Chi tiền mặt & ghi nhận":"Chuyển khoản & ghi nhận"),item.status==="PENDING"?"Đang thực hiện":item.status==="PAID"?"Đã ghi nhận":"Không có giao dịch cần ghi"],["3 · Kết quả",item.status==="PAID"?`Đã hoàn · ${item.method==="CASH"?"tiền mặt tại quầy":"chuyển khoản"}`:knownMoney(item.amount)&&item.amount===0?"Không còn khoản hoàn":"Chưa ghi nhận đã hoàn"]]}/></div><div className="customer-detail__grid"><div className="customer-detail__column">{item.status==="PENDING"&&knownMoney(item.amount)&&item.amount>0&&isCashRefund(item)?<Notice>Khách chọn nhận tiền mặt tại quầy. Khi khách đến nhận đủ tiền, xác nhận ở mục Hoàn tiền mặt tại quầy. <LinkButton to={`manager/refund${qs({kind:"cash"})}`} variant="outline">Mở Hoàn tiền mặt tại quầy</LinkButton></Notice>:item.status==="PENDING"&&knownMoney(item.amount)&&item.amount>0?<TransferForm key={item.id} item={item} load={load} ask={ask}/>:<Notice>{item.status==="PAID"?`Đã ghi nhận ${item.method==="CASH"?"chi tiền mặt":"chuyển tiền"} lúc ${timeLabel(item.paidAt)}.`:knownMoney(item.amount)&&item.amount===0?"Không còn khoản hoàn; không tạo giao dịch chuyển tiền.":"Chưa có đủ dữ liệu khoản hoàn để thao tác."}</Notice>}</div><SettlementTable title="Kết quả đối soát" settlement={settlementFromRefund(item)} report={{fee_reason:item.inspectionNote}}/></div><div className="workflow-links"><Button variant="outline" onClick={()=>setSelected("")}>Danh sách khoản hoàn</Button></div></>}</WorkflowState>{dialog}</Wrap>;
}
