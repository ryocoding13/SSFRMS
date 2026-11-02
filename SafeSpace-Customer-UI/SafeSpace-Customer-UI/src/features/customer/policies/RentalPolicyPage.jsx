import React, { useState } from "react";
import { Button, DetailList, Empty, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { POLICY_SECTIONS } from "../../facility-operations/workflows/workflowModel.js";
import { useRentalPolicy } from "../../../shared/hooks/useRentalPolicy.js";
import { normalizePolicyConsent, policyVersionLabel } from "../../../shared/utils/rentalPolicy.js";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import "../../../shared/styles/rental-policy.css";

export function RentalPolicyPage({ query = new URLSearchParams() }) {
  const { data, authed, mode, retry } = useApp();
  const [tab, setTab] = useState(query.get("tab") === "contract" ? "contract" : "current");
  const [selected, setSelected] = useState(query.get("contract") || "");
  const [record, setRecord] = useState(query.get("renewal") || "initial");
  const contracts = data.contracts || [];
  const contract = contracts.find(c => c.contract_id === selected) || (!selected ? contracts[0] : null);
  const renewal = record === "initial" ? null : (data.renewals || []).find(r => r.renewal_id === record && r.contract_id === contract?.contract_id);
  const recordConsent = normalizePolicyConsent(renewal?.policy_consent || (record === "initial" ? contract?.policy_consent : null));
  const consent = recordConsent && (recordConsent.customer_id == null || String(recordConsent.customer_id) === String(data.user?.user_id)) ? recordConsent : null;
  const load = useRentalPolicy(tab === "current" ? undefined : consent?.version ?? null);
  const policy = load.data;
  const changeContract = value => { setSelected(value); setRecord("initial"); };
  return <main className="container page rental-policy">
    <p className="rental-policy__breadcrumb">SafeSpace / Khách hàng / Chính sách</p>
    <PageHeader title="Chính sách thuê kho" description={tab === "current" ? "Đọc nội dung chính sách hiện hành trước khi đặt chỗ hoặc gia hạn." : "Xem lại đúng phiên bản và bằng chứng đã đồng ý cho hợp đồng hoặc yêu cầu gia hạn."}><Tag tone="blue">{policy ? policyVersionLabel(policy) : tab === "contract" ? "Bản đã đồng ý" : "Bản hiện hành"}</Tag></PageHeader>
    <div className="rental-policy__toolbar"><nav className="rental-policy__tabs" aria-label="Phạm vi chính sách"><Button variant={tab === "current" ? "primary" : "ghost"} onClick={() => setTab("current")} aria-pressed={tab === "current"}>Bản hiện hành</Button><Button variant={tab === "contract" ? "primary" : "ghost"} onClick={() => setTab("contract")} aria-pressed={tab === "contract"}>Theo hợp đồng của tôi</Button></nav>
      {tab === "contract" && authed && contracts.length > 0 && <Field label="Hợp đồng"><select value={contract?.contract_id || ""} onChange={e => changeContract(e.target.value)}>{selected && !contract && <option value="">Chọn hợp đồng</option>}{contracts.map(c => <option key={c.contract_id} value={c.contract_id}>{c.contract_id} · Kho {c.unit_number}</option>)}</select></Field>}
    </div>
    {tab === "contract" && !authed ? <Empty title="Đăng nhập để xem chính sách đã đồng ý" text="Bằng chứng chỉ hiển thị cho tài khoản có hợp đồng."><LinkButton to={`login?next=${encodeURIComponent("policies?tab=contract")}`}>Đăng nhập</LinkButton></Empty> : tab === "contract" && !contract ? <Empty title={selected ? "Không tìm thấy hợp đồng" : "Bạn chưa có hợp đồng"} text="Chỉ hiển thị hợp đồng thuộc tài khoản đang đăng nhập."><LinkButton to="units">Về Kho của tôi</LinkButton></Empty> :
    <div className="rental-policy__grid">
      <div className="rental-policy__content">
        {tab === "contract" && <section className="panel rental-policy__card"><Field label="Bằng chứng muốn xem"><select value={record} onChange={e => setRecord(e.target.value)}><option value="initial">Khi đặt chỗ / ký hợp đồng ban đầu</option>{(data.renewals || []).filter(r => r.contract_id === contract.contract_id && normalizePolicyConsent(r.policy_consent)).map(r => <option key={r.renewal_id} value={r.renewal_id}>Yêu cầu gia hạn {r.renewal_id} · {r.months} tháng</option>)}</select></Field></section>}
        {load.loading && <section className="panel rental-policy__card" role="status">Đang tải đúng phiên bản chính sách…</section>}
        {load.error && <section className="panel rental-policy__card"><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Thử lại</Button></section>}
        {tab === "contract" && !consent && <section className="panel rental-policy__card"><h2>Chưa có bằng chứng đồng ý</h2><p>Máy chủ chưa cung cấp phiên bản và thời điểm đồng ý cho hồ sơ này. Không dùng bản hiện hành để thay cho bản bạn đã đồng ý.</p><Button variant="outline" onClick={() => retry?.()}>Tải lại hồ sơ</Button></section>}
        {policy && POLICY_SECTIONS.map(([key, title], index) => <section className="panel rental-policy__card" key={key}><h2>{String(index + 1).padStart(2, "0")} · {title}</h2><p>{policy.sections[key]}</p></section>)}
      </div>
      <aside className="rental-policy__aside">
        {tab === "contract" && <section className="panel rental-policy__card"><h2>Bằng chứng đồng ý</h2><DetailList items={[["Hợp đồng", contract.contract_id], ["Hồ sơ", renewal ? `Yêu cầu gia hạn ${renewal.renewal_id}` : "Đặt chỗ ban đầu"], ["Phiên bản", consent ? policyVersionLabel({version:consent.version,displayVersion:policy?.displayVersion || consent.displayVersion}) : "Chưa có thông tin"], ["Thời điểm", consent ? dateTimeLabel(consent.accepted_at) : "Chưa có thông tin"], ["Kênh", consent ? "Khách xác nhận trên tài khoản" : "Chưa có thông tin"]]} /><LinkButton to={`units/${encodeURIComponent(contract.contract_id)}`} variant="outline">Mở hợp đồng</LinkButton>{renewal && <p className="hint">Đồng ý chính sách không đồng nghĩa yêu cầu đã được duyệt hoặc thanh toán.</p>}</section>}
        {policy && <section className="panel rental-policy__card"><h2>Các mốc cần nhớ</h2><ul className="rental-policy__milestones"><li><strong>Ngày cuối hợp đồng</strong><span>Dùng đến 23:59 theo giờ Việt Nam</span></li><li><strong>Quá hạn ngày 1</strong><span>Xem tỷ lệ và cách tính trong mục Quá hạn</span></li><li><strong>Ngày 10–14</strong><span>Cơ sở nhắc khách theo chính sách</span></li><li><strong>Ngày 20</strong><span>Xem quy định xử lý đồ trong chính sách</span></li></ul></section>}
        {mode === "local" && <Notice>Chế độ mô phỏng FE: bản lưu và bằng chứng trên trình duyệt này.</Notice>}
        {tab === "contract" && <Notice>Bản lưu thể hiện nội dung bạn đã đồng ý. Phạm vi áp dụng chính sách và các thay đổi bắt buộc thực hiện theo quy định đang có hiệu lực của hệ thống.</Notice>}
      </aside>
    </div>}
  </main>;
}
