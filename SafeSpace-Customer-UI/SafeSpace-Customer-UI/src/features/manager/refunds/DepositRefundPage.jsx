/**
 * DEPOSIT REFUND PAGE - QUYẾT TOÁN VÀ HOÀN TRẢ TIỀN CỌC KHI KẾT THÚC THUÊ (M07 / D32 / D39)
 *
 * Nghiệp vụ D32 / D39:
 * - Sau khi nhân viên lập biên bản kiểm kê trả kho (S03), khách hàng có 48 giờ để xác nhận khấu trừ.
 * - Quản lý kiểm tra các khoản khấu trừ hợp lệ (vệ sinh tối đa 10% cọc, hư hỏng có ảnh bằng chứng).
 * - Tuyệt đối không tạo nợ âm vượt quá tiền cọc đang giữ; tạo lệnh thanh toán REFUND cho số tiền còn lại.
 */
import React,{useState} from "react";
import { Button, DetailList, Empty, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { useWorkflowChange, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { transferProof, knownMoney } from "../../facility-operations/settlements/settlementModel.js";
import { SettlementSummary } from "../../facility-operations/settlements/SettlementComponents.jsx";
import { amountLabel,timeLabel } from "../../facility-operations/damage/DamageComponents.jsx";
import { vnDateTimeInput } from "../../facility-operations/damage/damageModel.js";
import "../../../shared/styles/customer-detail.css";
import { go } from "../../../app/router.js";
function defaultCode(item, m) {
  if (m === "CASH") return `PC-${item.id}`;
  const clean = (item.contractId || item.id || "").replace(/[^a-zA-Z0-9]/g, "");
  return `FT${clean}${String(Date.now()).slice(-4)}`;
}

function TransferForm({item,load,ask}) {
  const hasBank = Boolean(item.bankName && item.bankName !== "CASH" && item.accountNumber);
  const initialMethod = (item.method === "CASH" || item.bankName === "CASH" || !hasBank) ? "CASH" : "BANK_TRANSFER";
  const [method, setMethod] = useState(initialMethod);
  const [ref, setRef] = useState(() => item.transactionRef || defaultCode(item, initialMethod));
  const [at, setAt] = useState(() => vnDateTimeInput());
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  const isCash = method === "CASH";
  const payload = {
    id: item.id,
    transactionRef: ref,
    transferredAt: at,
    confirmed,
    expectedVersion: item.version,
    method
  };
  const disabled = load.busy || load.needsRefresh;
  let valid = false;
  try {
    transferProof(item, payload);
    valid = true;
  } catch {}

  const switchMethod = (newMethod) => {
    setMethod(newMethod);
    setRef(defaultCode(item, newMethod));
    setError("");
  };

  const regenerateCode = (e) => {
    e.preventDefault();
    setRef(defaultCode(item, method));
  };

  return (
    <form
      className="panel customer-detail__card"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled) return;
        try {
          transferProof(item, payload);
          setError("");
          ask(
            "CONFIRM_DEPOSIT_REFUND",
            payload,
            isCash
              ? `Xác nhận đã chi ${amountLabel(item.amount)} tiền mặt?`
              : `Ghi nhận đã chuyển ${amountLabel(item.amount)}?`,
            isCash
              ? `Chỉ xác nhận sau khi đã chi đủ ${amountLabel(item.amount)} tiền mặt cho khách hàng tại quầy và có chữ ký nhận.`
              : `Chỉ ghi nhận sau khi đã chuyển ${amountLabel(item.amount)} vào đúng tài khoản. Thao tác không thực hiện chuyển tiền.`,
            {
              confirmLabel: isCash ? "Xác nhận đã chi tiền" : "Xác nhận đã chuyển",
              successTitle: isCash ? `Đã chi hoàn cọc ${amountLabel(item.amount)}` : `Đã hoàn cọc ${amountLabel(item.amount)}`,
              failTitle: isCash ? "Chưa ghi nhận được chi tiền mặt" : "Chưa ghi nhận được chuyển khoản",
              doneLabel: "Về hợp đồng & quá hạn",
              onDone: () => go("manager/contracts"),
            }
          );
        } catch (err) {
          setError(err.message);
        }
      }}
      noValidate
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <h2>{isCash ? "Ghi nhận chi tiền mặt tại quầy" : "Ghi nhận chuyển khoản"}</h2>
        <div style={{ display: "inline-flex", gap: "6px" }}>
          <Button
            type="button"
            size="small"
            variant={!isCash ? "primary" : "outline"}
            disabled={disabled}
            onClick={() => switchMethod("BANK_TRANSFER")}
          >
            Chuyển khoản
          </Button>
          <Button
            type="button"
            size="small"
            variant={isCash ? "primary" : "outline"}
            disabled={disabled}
            onClick={() => switchMethod("CASH")}
          >
            Tiền mặt tại quầy
          </Button>
        </div>
      </div>

      <Notice>
        {isCash
          ? "Khách hàng nhận tiền mặt trực tiếp tại quầy cơ sở. Kiểm tra CCCD trùng tên hợp đồng trước khi chi tiền và lưu phiếu chi."
          : "Hạn hoàn: 3–5 ngày làm việc từ khi chốt đối soát. Chuyển đúng số tiền vào tài khoản chính chủ rồi ghi nhận."}
      </Notice>

      <DetailList
        items={
          isCash
            ? [
                ["Người nhận tiền", item.customer || item.accountHolder || "Chưa có dữ liệu"],
                ["Hình thức nhận", "Tiền mặt tại quầy cơ sở (không áp dụng số tài khoản)"],
              ]
            : [
                ["Người nhận", item.accountHolder || item.customer || "Chưa có dữ liệu"],
                [
                  "Ngân hàng / tài khoản",
                  hasBank
                    ? `${item.bankName} · ••••${item.accountNumber.slice(-4)}`
                    : "Chưa có dữ liệu (chọn 'Tiền mặt tại quầy' nếu khách nhận tại cơ sở)",
                ],
              ]
        }
      />

      <div className="form-row">
        <Field label={isCash ? "Mã phiếu chi / chứng từ *" : "Mã giao dịch *"}>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              maxLength={100}
              value={ref}
              disabled={disabled}
              onChange={(e) => setRef(e.target.value)}
              placeholder={isCash ? "Ví dụ: PC-001" : "Mã tham chiếu ngân hàng"}
            />
            <Button type="button" variant="outline" size="small" disabled={disabled} onClick={regenerateCode} title="Tự động tạo mã mới">
              Tạo lại mã
            </Button>
          </div>
        </Field>
        <Field label={isCash ? "Thời gian chi · giờ Việt Nam *" : "Thời gian chuyển · giờ Việt Nam *"}>
          <input
            type="datetime-local"
            max={vnDateTimeInput()}
            value={at}
            disabled={disabled}
            onChange={(e) => setAt(e.target.value)}
          />
        </Field>
      </div>

      <label className="customer-detail__choice">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={disabled}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          {isCash
            ? "Tôi đã chi đủ số tiền mặt cho khách hàng tại quầy (đã kiểm tra CCCD và ký nhận)"
            : "Tôi đã chuyển đúng số tiền vào đúng tài khoản nhận"}
        </span>
      </label>

      {error && <Notice tone="error">{error}</Notice>}
      <p className="hint">
        {isCash
          ? "Kiểm tra kỹ thông tin người nhận và ký nhận trước khi ghi nhận."
          : "Thiếu tài khoản chính chủ, thời gian, mã giao dịch hoặc xác nhận thì không được ghi nhận."}
      </p>

      <div className="customer-detail__actions">
        <LinkButton to={`manager/contracts?id=${encodeURIComponent(item.contractId)}`} variant="outline">
          Xem biên bản &amp; ảnh
        </LinkButton>
        <Button type="submit" disabled={disabled || !valid}>
          {isCash ? "Xác nhận đã chi tiền mặt" : "Ghi nhận đã chuyển tiền"}
        </Button>
      </div>
    </form>
  );
}
/**
 * Màn hình quyết toán tiền đặt cọc và phê duyệt lệnh hoàn tiền cho khách hàng trả kho.
 */
export function DepositRefundPage({query=new URLSearchParams()}) {
 const base=useWorkflowData("depositRefunds"),{ops,source,run,saving,needsRefresh}=useOps(),[selected,setSelected]=useState(query.get("id")||"");
 const load=source==="local"?{...base,data:ops.deposit_refunds||[],loading:false,error:"",busy:saving,needsRefresh,demo:true,run:(action,payload)=>run(action,payload)}:base;
 const [dialog,ask]=useWorkflowChange(load),item=load.data?.find(r=>r.id===selected);
 return <main className="container page customer-records customer-detail"><p className="customer-records__breadcrumb">SafeSpace / Quản lý cơ sở / Hợp đồng &amp; quá hạn</p><PageHeader title={item?`Hoàn cọc ${item.contractId} · ${item.customer}`:"Hoàn cọc sau trả kho"} description="Duyệt đối soát và xác nhận chuyển tiền là hai bước riêng."/><WorkflowState load={load}>{!selected?<div className="customer-detail__column">{(load.data||[]).map(r=><section className="panel customer-detail__card record-card" key={r.id}><div><h2>{r.customer} · Kho {r.unit}</h2><p>{r.contractId} · {amountLabel(r.amount)}</p><Tag tone="amber">{r.status==="PAID"?"Đã hoàn":r.status==="PENDING"?"Chờ hoàn":r.status==="NO_REFUND"?"Không còn khoản hoàn":"Chưa rõ trạng thái"}</Tag></div><Button onClick={()=>setSelected(r.id)}>Xem khoản hoàn</Button></section>)}{!load.data?.length&&<Empty title="Không có đối soát chờ duyệt" text="Khoản hoàn cọc sẽ hiện ở đây sau khi quản lý chốt số tiền ở Hợp đồng & quá hạn."/>}</div>:!item?<Empty title="Không tìm thấy khoản hoàn"/>:<><div className="panel customer-detail__card"><DetailList items={[["1 · Duyệt đối soát",item.inspectedAt?timeLabel(item.inspectedAt):"Chưa có dữ liệu"],["2 · " + (item.method==="CASH"?"Chi tiền mặt & ghi nhận":"Chuyển khoản & ghi nhận"),item.status==="PENDING"?"Đang thực hiện":item.status==="PAID"?"Đã ghi nhận":"Không có giao dịch cần ghi"],["3 · Kết quả",item.status==="PAID"?`Đã hoàn · ${item.method==="CASH"?"Tiền mặt: ":""}${item.transactionRef||"Chưa có mã giao dịch"}`:knownMoney(item.amount)&&item.amount===0?"Không còn khoản hoàn":"Chưa ghi nhận đã hoàn"]]}/></div><div className="customer-detail__grid"><div className="customer-detail__column">{item.status==="PENDING"&&knownMoney(item.amount)&&item.amount>0?<TransferForm key={item.id} item={item} load={load} ask={ask}/>:<Notice>{item.status==="PAID"?`Đã ghi nhận ${item.method==="CASH"?"chi tiền mặt":"chuyển tiền"} lúc ${timeLabel(item.paidAt)}.`:knownMoney(item.amount)&&item.amount===0?"Không còn khoản hoàn; không tạo giao dịch chuyển tiền.":"Chưa có đủ dữ liệu khoản hoàn để thao tác."}</Notice>}</div><SettlementSummary official deposit={item.deposit} damage={item.damage} cleaning={item.cleaning} overdue={item.overdue} amount={item.amount}/></div><div className="workflow-links"><Button variant="outline" onClick={()=>setSelected("")}>Danh sách khoản hoàn</Button></div></>}</WorkflowState>{dialog}</main>;
}
