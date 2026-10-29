// Render SSR mọi route (kể cả khi đã đăng nhập) để bắt lỗi runtime cơ bản. Luồng thao tác nằm ở e2e.
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = fileURLToPath(new URL("../", import.meta.url));
const memory = new Map();
globalThis.localStorage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
globalThis.window = { location: { hash: "" }, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
globalThis.document = { title: "", addEventListener() {}, removeEventListener() {}, activeElement: null, body: { style: {} } };

process.env.VITE_USE_API = "false";
const vite = await createServer({ root, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const { default: App } = await vite.ssrLoadModule("/src/app/App.jsx");
  const { STORAGE_KEY } = await vite.ssrLoadModule("/src/app/state/AppProvider.jsx");
  const { createSeedData } = await vite.ssrLoadModule("/src/app/data/appSeed.js");
  const { OPS_ACCOUNTS } = await vite.ssrLoadModule("/src/features/facility-operations/data/facilityOperationsSeed.js");
  const seed = (authed, opsUser = null) => memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed, data: createSeedData(), opsUser }));

  const publicRoutes = ["reset-password","home", "login", "register", "pricing", "guide", "find", "find?type=climate&band=M", "find/map", "find/map?type=climate", "find/map?area=Kh%C3%B4ng%20c%C3%B3", "find/1", "find/1?view=map&unit=K02", "find/8?type=climate&view=map", "find/999", "nope", "door", "door?unit=B-015"];
  const privateRoutes = ["units/HĐ-2026-0086/incident", "units/HĐ-2026-0086/incident?incident=missing", "units/unknown/incident","units/HĐ-2026-0086/damage", "units/HĐ-2026-0086/damage?case=missing", "units/unknown/damage","reservations/SS-20260914-0142/cancel", "reservations/missing/cancel","refunds","policies", "payments/check/SS-0086-REN", "payments/check/missing", "payments/history", "inquiries", "inquiries/HT-0091", "units/HĐ-2026-0142/deposit", "units/HĐ-2026-0086/progress", "units/HĐ-2026-0086/renewal-status",
    "overview", "units", "units/HĐ-2026-0142", "units/HĐ-2026-0086", "units/HĐ-2026-0086/renew", "units/HĐ-2026-0142/return", "units/unknown",
    "sent?type=renew&contract=HĐ-2026-0086", "reservations", "reservations/SS-20260914-0142", "reservations/none",
    "confirmation/SS-20260914-0142", "checkout/SS-20260914-0142", "checkout/SS-20260914-0142/confirm", "policies?tab=contract", "policies?tab=contract&contract=unknown", "payments", "support", "support/HT-0082", "support/unknown", "support?contract=HĐ-2026-0142&topic=SCHEDULE", "profile",
  ];
  let count = 0;
  for (const authed of [false, true]) {
    seed(authed);
    for (const r of [...publicRoutes, ...(authed ? privateRoutes : [])]) {
      window.location.hash = `#/${r}`;
      const html = renderToStaticMarkup(React.createElement(App));
      assert.ok(html.includes("Điều hướng chính"), r);
      assert.ok(!html.includes("NaN") && !html.includes("undefined"), `${r} chứa NaN/undefined`);
      count++;
    }
  }
  seed(true);
  window.location.hash = "#/units/HĐ-2026-0142/return";
  const returnHtml = renderToStaticMarkup(React.createElement(App));
  for (const text of ["Hiện trạng kho", "Tải ảnh kho trống", "Tài khoản nhận hoàn", "Không thể huỷ yêu cầu", "QR/PIN khoá ngay"]) assert.ok(returnHtml.includes(text), text);
  window.location.hash = "#/reservations/SS-20260914-0142/cancel";
  const cancelHtml = renderToStaticMarkup(React.createElement(App));
  for (const text of ["Tài khoản nhận hoàn", "Số tài khoản", "Chủ tài khoản", "Khoản hoàn dự kiến"]) assert.ok(cancelHtml.includes(text), text);
  const { createWorkflowSeed } = await vite.ssrLoadModule("/src/features/facility-operations/workflows/workflowModel.js");
  const workflowFixture = createWorkflowSeed();
  const owner = createSeedData().user.user_id;
  workflowFixture.depositRefunds = [{id:"HC-test",ownerId:owner,unit:"A-102",contractId:"HĐ-test",amount:662500,deposit:1150000,overdue:172500,cleaning:115000,damage:200000,status:"PENDING",bankName:"VCB",accountNumber:"0123456789",transactionRef:"SHOULD-NOT-SHOW"}, {id:"HC-other",ownerId:999999,unit:"SECRET-UNIT",amount:10,status:"PAID"}];
  memory.set("safespace.approved-workflows.demo.v1", JSON.stringify(workflowFixture));
  window.location.hash = "#/refunds";
  const pendingRefundHtml = renderToStaticMarkup(React.createElement(App));
  for (const text of ["Chờ hoàn", "662.500", "Phí quá hạn", "••••6789", "Chưa có thông tin"]) assert.ok(pendingRefundHtml.includes(text),text);
  for (const text of ["SHOULD-NOT-SHOW", "SECRET-UNIT", "0123456789", "Khoản chưa thanh toán"]) assert.ok(!pendingRefundHtml.includes(text),text);
  workflowFixture.depositRefunds[0].status = "PAID";
  memory.set("safespace.approved-workflows.demo.v1", JSON.stringify(workflowFixture));
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Đã hoàn"));
  delete workflowFixture.depositRefunds[0].amount;
  workflowFixture.depositRefunds[0].status = "PENDING";
  memory.set("safespace.approved-workflows.demo.v1", JSON.stringify(workflowFixture));
  const incompleteRefundHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(incompleteRefundHtml.includes("Chưa có dữ liệu"));
  assert.ok(!incompleteRefundHtml.includes("Không còn cọc hoàn"));
  memory.delete("safespace.approved-workflows.demo.v1");
  // C06: thao tác nhanh không mở QR cho hợp đồng đã kết thúc / đã gửi trả kho.
  const recordData = createSeedData();
  recordData.contracts = [{ ...recordData.contracts[0], status: "ENDED" }];
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: recordData }));
  window.location.hash = "#/units";
  const endedUnits = renderToStaticMarkup(React.createElement(App));
  assert.ok(endedUnits.includes("Xem hợp đồng") && !endedUnits.includes("Xem QR &amp; PIN"));
  recordData.contracts[0].status = "ACTIVE";
  recordData.contracts[0].end_date = "2099-12-31";
  recordData.returns = [{ contract_id: recordData.contracts[0].contract_id, status: "PENDING" }];
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: recordData }));
  const returningUnits = renderToStaticMarkup(React.createElement(App));
  assert.match(returningUnits, /<button[^>]*disabled[^>]*>Xem QR &amp; PIN<\/button>/);
  recordData.contracts = [];
  recordData.reservations = [];
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: recordData }));
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Bạn chưa thuê kho nào"));
  window.location.hash = "#/reservations";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Bạn chưa có đơn đặt chỗ nào"));
  const { default: ConfirmDialog } = await vite.ssrLoadModule("/src/shared/components/ConfirmDialog.jsx");
  const zeroSummary = renderToStaticMarkup(React.createElement(ConfirmDialog, { title: "Xác nhận", rows: [["Số tiền", 0]], onCancel() {}, onConfirm() {} }));
  assert.ok(zeroSummary.includes("<dd>0</dd>"), "Số 0 phải được giữ trong popup");
  const noSummary = renderToStaticMarkup(React.createElement(ConfirmDialog, { title: "Xác nhận", rows: [], onCancel() {}, onConfirm() {} }));
  assert.ok(!noSummary.includes("confirm-summary"), "Không dựng khung thông tin rỗng");
  const d32Data = createSeedData();
  d32Data.ledger.push({ref:"LEGACY-FEE",kind:"DAMAGE_FEE",fee:true,amount:999999,payable:true,status:"UNPAID",label:"LEGACY-FEE-NOT-COLLECTIBLE"});
  d32Data.ledger.push({ref:"REFUND-WAIT",kind:"REFUND",amount:100,status:"REFUND_PENDING",label:"Khoản hoàn mới"});
  memory.set(STORAGE_KEY, JSON.stringify({version:5,authed:true,data:d32Data}));
  window.location.hash = "#/payments";
  const paymentsHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(!paymentsHtml.includes("LEGACY-FEE-NOT-COLLECTIBLE"));
  assert.ok(!paymentsHtml.includes("Thanh toán phí tại quầy"));
  assert.ok(paymentsHtml.includes("Chờ hoàn") && paymentsHtml.includes("Gia hạn"));
  window.location.hash = "#/payments/history";
  const historyHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(!historyHtml.includes("Khoản hoàn mới"), "History không biến khoản chờ hoàn thành giao dịch hoàn tất");
  for (const tone of ["confirm", "danger", "success", "failure", "warning", "info"]) {
    const html = renderToStaticMarkup(React.createElement(ConfirmDialog, {tone, title:"Thông báo", rows:[], onCancel() {}, onConfirm() {}}));
    assert.ok(html.includes(`modal--${tone}`) && html.includes('role="dialog"'));
  }
  seed(true);
  window.location.hash = "#/payments/check/SS-0086-REN";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Kiểm tra trạng thái thanh toán"));
  window.location.hash = "#/units/HĐ-2026-0142/renew";
  const renewalHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(renewalHtml.includes('type="radio"') && renewalHtml.includes('type="checkbox"') && renewalHtml.includes("Chi phí dự kiến"));
  seed(true);
  const lifecycleData = createSeedData();
  lifecycleData.renewals = [{renewal_id:"GH-expired",contract_id:"HĐ-2026-0086",months:3,status:"EXPIRED",old_end:"2026-09-01",new_end:"2026-12-01",amount:1000000,payment_deadline_at:"2026-09-01T03:00:00Z"}];
  memory.set(STORAGE_KEY, JSON.stringify({version:5,authed:true,data:lifecycleData}));
  window.location.hash = "#/units/HĐ-2026-0086/renewal-status";
  const expiredRenewalHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(expiredRenewalHtml.includes("Đã hết hạn thanh toán"));
  assert.ok(!expiredRenewalHtml.includes("Thanh toán PayOS") && !expiredRenewalHtml.includes("Chọn thanh toán tại quầy"));
  window.location.hash = "#/profile";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Tên đăng nhập"));
  window.location.hash = "#/register";
  seed(false);
  assert.match(renderToStaticMarkup(React.createElement(App)), /autoComplete="username"/i);
  seed(true);
  const reviewData = createSeedData();
  const reviewReservation = reviewData.reservations[0];
  reviewReservation.status = "PENDING_PAYMENT";
  reviewReservation.expires_at = new Date(Date.now() + 600000).toISOString();
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: reviewData }));
  window.location.hash = `#/checkout/${reviewReservation.reservation_id}/confirm`;
  const reviewHtml = renderToStaticMarkup(React.createElement(App));
  for (const text of ["Bước 2/3", "Tóm tắt đơn", "Chính sách thuê kho", "Tiếp tục thanh toán", 'type="checkbox"']) assert.ok(reviewHtml.includes(text),text);
  assert.ok(!reviewHtml.includes("Mã QR thanh toán"));
  window.location.hash = `#/checkout/${reviewReservation.reservation_id}`;
  const guardedCheckout = renderToStaticMarkup(React.createElement(App));
  assert.ok(guardedCheckout.includes("xác nhận chính sách"));
  assert.ok(!guardedCheckout.includes("Mã QR thanh toán"));
  window.location.hash = "#/policies?tab=contract";
  const contractPolicyHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(contractPolicyHtml.includes("Chưa có bằng chứng đồng ý"));
  assert.ok(!contractPolicyHtml.includes("100% tiền thuê và 90% cọc"));
  // Exercise actual LocalProvider services: guards also apply to direct calls, not only disabled buttons.
  const { AppProvider, useApp } = await vite.ssrLoadModule("/src/app/state/AppProvider.jsx");
  const { defaultRentalPolicy } = await vite.ssrLoadModule("/src/features/facility-operations/workflows/workflowModel.js");
  let context;
  function Probe() { context = useApp(); return null; }
  renderToStaticMarkup(React.createElement(AppProvider, null, React.createElement(Probe)));
  assert.equal((await context.services.startPayos({kind:"reservation",item:reviewReservation})).code,"POLICY_REQUIRED");
  assert.equal((await context.dispatch("PAY_AT_FACILITY",{reservation_id:reviewReservation.reservation_id})).code,"POLICY_REQUIRED");
  const savedConsent = await context.dispatch("ACCEPT_RESERVATION_POLICY",{reservation_id:reviewReservation.reservation_id,policy_version:1,accepted:true});
  assert.equal(savedConsent.ok,true);
  memory.set("safespace.approved-workflows.demo.v1", JSON.stringify({policy:{...defaultRentalPolicy(),version:2}}));
  assert.equal((await context.services.startPayos({kind:"reservation",item:reviewReservation})).code,"POLICY_REQUIRED");
  memory.delete("safespace.approved-workflows.demo.v1");
  assert.equal((await context.dispatch("PAY_AT_FACILITY",{reservation_id:reviewReservation.reservation_id})).ok,true);
  // Khu vận hành: nhân viên (S01–S09) và quản lý cơ sở (M01–M08)
  const opsRoutes = {
    STAFF: ["staff/incidents","staff/mismatch", "staff/renewal-payments", "staff/overdue", "staff/inquiries",
      "staff", "staff?page=2", "staff/reconcile", "staff/fees", "staff/fees?id=PHI-0086", "staff/verify", "staff/handover", "staff/return", "staff/support",
      "staff/reconcile?id=SS-20260914-0142", "staff/verify?id=XM-0142", "staff/handover?id=BG-0115", "staff/return?id=TK-0098",
      "staff/support?id=HT-0082", "staff/done?kind=payment", "staff/nope",
    ],
    MANAGER: ["manager/incidents", "manager/incidents?id=SC-local-0086", "manager/incidents?id=missing","manager/damage-responses", "manager/damage-responses?id=HH-local-0086", "manager/damage-responses?id=missing", "manager/damage-inspections", "manager/damage-inspections?id=HH-inspect-0086","manager/discrepancies", "manager/discrepancy-detail?id=SL-0001", "manager/overdue", "manager/deposit-refunds","manager", "manager/units", "manager/units?tab=OVERDUE", "manager/units?tab=MAINTENANCE", "manager/allocate", "manager/assign", "manager/renewals", "manager/contracts", "manager/refunds", "manager/report", "manager/done", "staff"],
  };
  for (const acc of OPS_ACCOUNTS) {
    seed(true, acc);
    for (const r of opsRoutes[acc.role]) {
      window.location.hash = `#/${r}`;
      const html = renderToStaticMarkup(React.createElement(App));
      assert.ok(html.includes(acc.full_name), `${r}: thiếu tên ${acc.full_name}`);
      assert.ok(!html.includes("NaN") && !html.includes("undefined"), `${r} chứa NaN/undefined`);
      if (r.startsWith("staff/fees")) assert.ok(html.includes("Không tìm thấy trang") && !html.includes("Xác nhận đã thu đủ"));
      count++;
    }
  }
  // Lưới 3x3: trang 1 có đủ 9 thẻ, có phân trang
  seed(true, OPS_ACCOUNTS[0]);
  window.location.hash = "#/staff";
  const grid = renderToStaticMarkup(React.createElement(App));
  assert.equal((grid.match(/class="panel task-card"/g) || []).length, 9, "S01 hiện 9 thẻ / trang");
  assert.ok(grid.includes("aria-label=\"Phân trang\"") && grid.includes("trên 10"), "D32: S01 còn 10 việc, không có khoản thu phí tại quầy");
  assert.ok(!grid.includes("staff/fees"), "D32: không có link thu phí");
  // Không có việc → thông báo trống (S01-trống, S09a-trống)
  const { OPS_KEY } = await vite.ssrLoadModule("/src/features/facility-operations/state/FacilityOperationsProvider.jsx");
  const { createOpsData } = await vite.ssrLoadModule("/src/features/facility-operations/data/facilityOperationsSeed.js");
  const none = { ...createOpsData(), payments: [], fee_collections: [], verifications: [], handovers: [], returns: [], tickets: [] };
  memory.set(OPS_KEY, JSON.stringify(none));
  for (const [r, text] of [["staff", "Chưa có công việc nào hôm nay"], ["staff/reconcile", "Chưa có đơn nào cần thu tại kho"], ["staff/support", "Chưa có yêu cầu hỗ trợ"]]) {
    window.location.hash = `#/${r}`;
    assert.ok(renderToStaticMarkup(React.createElement(App)).includes(text), `${r}: thiếu "${text}"`);
    count++;
  }
  memory.delete(OPS_KEY);
  // Khách hàng chưa có kho → một dòng thông báo (C01/C06/C14-trống)
  const { createEmptyData } = await vite.ssrLoadModule("/src/app/data/appSeed.js");
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: createEmptyData({ user_id: 9, full_name: "Lê Hoàng Nam", email: "nam@example.com", phone: "0900000000", password: "x" }) }));
  for (const [r, text] of [["units", "Bạn chưa thuê kho nào"], ["overview", "Bạn chưa thuê kho nào"], ["reservations", "Bạn chưa có đơn đặt chỗ nào"]]) {
    window.location.hash = `#/${r}`;
    const html = renderToStaticMarkup(React.createElement(App));
    assert.ok(html.includes(text) && html.includes("empty-line"), `${r}: thiếu thông báo trống`);
    count++;
  }
  // Màn mới (Figma 16/10): C04 chọn QR / tại cửa hàng, C07 chưa bàn giao (F29), C07b có "Mở cửa kho", C11 nút thanh toán gia hạn,
  // C12 phản hồi nhân viên, C14 huỷ đơn, S09 thu tiền tại kho, M02 đổi trạng thái ô
  seed(true);
  const pages = [
    ["units/HĐ-2026-0142", ["Hợp đồng và mã ra vào đã được cấp", "Xem QR &amp; PIN 6 số", "Nhận tại quầy cơ sở"]],
    ["units/HĐ-2026-0086", ["Xem QR &amp; PIN 6 số", "Yêu cầu gia hạn", "Đăng ký trả kho"]],
    ["payments", ["Thanh toán", "Gia hạn B-015 · 3 tháng", "Chờ thanh toán"]],
    ["support", ["Phản hồi của nhân viên", "Thẻ cũ bị lỗi từ"]],
    ["reservations", ["Huỷ đơn SS-0142", "Thao tác", "phí huỷ 10% tiền cọc"]],
    ["find/1", ["Chỉ đường đến cơ sở", "google.com/maps/dir"]],
  ];
  for (const [r, texts] of pages) {
    window.location.hash = `#/${r}`;
    const html = renderToStaticMarkup(React.createElement(App));
    for (const text of texts) assert.ok(html.includes(text), `${r}: thiếu "${text}"`);
    count++;
  }
  window.location.hash = "#/units/HĐ-2026-0142";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Xem QR &amp; PIN 6 số"), "D26: QR hiển thị trước khi nhận chìa khóa");
  seed(true, OPS_ACCOUNTS[0]);
  for (const [r, texts] of [["staff/reconcile", ["Thu tiền tại kho", "Chờ thu khi nhận kho"]], ["staff/reconcile?id=SS-20260914-0142", ["Xác nhận đã thu", "Để sau", "Thuê 3 tháng"]], ["staff", ["Chờ thu tiền tại kho", "THU TIỀN"]]]) {
    window.location.hash = `#/${r}`;
    const html = renderToStaticMarkup(React.createElement(App));
    for (const text of texts) assert.ok(html.includes(text), `${r}: thiếu "${text}"`);
    count++;
  }
  const manager = OPS_ACCOUNTS.find((a) => a.role === "MANAGER");
  seed(true, manager);
  window.location.hash = "#/manager/units";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Đổi trạng thái"), "M02: thiếu nút Đổi trạng thái");
  count++;

  // Damage fixtures are isolated from the settlement store; verify scope and stage UI.
  const { createDamageSeed } = await vite.ssrLoadModule("/src/features/facility-operations/damage/damageModel.js");
  const { DAMAGE_DEMO_KEY } = await vite.ssrLoadModule("/src/features/facility-operations/damage/useDamageCases.js");
  const damageCases = createDamageSeed();
  const saveDamage = () => memory.set(DAMAGE_DEMO_KEY, JSON.stringify({version:1,cases:damageCases}));
  saveDamage(); seed(true);
  window.location.hash = "#/units/HĐ-2026-0086/damage?case=HH-local-0086";
  let damageHtml = renderToStaticMarkup(React.createElement(App));
  for (const text of ["Chọn phương án phản hồi", "Đính kèm ảnh / ảnh hoá đơn", "Gửi phản hồi cho cơ sở"]) assert.ok(damageHtml.includes(text),text);
  assert.ok(!/type="radio"[^>]*checked/.test(damageHtml),"Không tự chọn phản hồi");
  window.location.hash = "#/units/HĐ-2026-0086/damage?case=HH-api-0001";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Không tìm thấy hồ sơ"),"Không lộ hồ sơ khách khác");
  damageCases[0].status="RESPONSE_SUBMITTED";
  damageCases[0].response={choice:"REMEDIATE",note:"Xin khắc phục",files:[]}; saveDamage();
  window.location.hash = "#/units/HĐ-2026-0086/damage?case=HH-local-0086";
  damageHtml=renderToStaticMarkup(React.createElement(App));
  assert.ok(damageHtml.includes("Đã gửi phản hồi") && !damageHtml.includes("Gửi phản hồi cho cơ sở"));
  seed(true,manager);
  window.location.hash = "#/manager/damage-responses?id=HH-local-0086";
  damageHtml=renderToStaticMarkup(React.createElement(App));
  for(const text of ["Xin khắc phục","datetime-local","Lý do (bắt buộc khi từ chối)"]) assert.ok(damageHtml.includes(text),text);
  window.location.hash = "#/manager/damage-inspections?id=HH-inspect-0086";
  damageHtml=renderToStaticMarkup(React.createElement(App));
  for(const text of ["Ghi chú kiểm tra","Ghi nhận kết quả","Đạt · bỏ khấu trừ hư hỏng"]) assert.ok(damageHtml.includes(text),text);
  damageCases.forEach(c=>c.facilityId=999999); saveDamage();
  window.location.hash = "#/manager/damage-responses?id=HH-local-0086";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Không tìm thấy hồ sơ"),"Không lộ hồ sơ cơ sở khác");
  memory.delete(DAMAGE_DEMO_KEY);
  count+=6;

  const { createIncidentSeed, applyIncidentAction } = await vite.ssrLoadModule("/src/features/facility-operations/incidents/incidentModel.js");
  const { INCIDENT_DEMO_KEY } = await vite.ssrLoadModule("/src/features/facility-operations/incidents/useIncidents.js");
  const incidentNow=new Date(),incidentActor={id:manager.user_id,roles:["MANAGER"],facilityId:1};
  let incidentCases=createIncidentSeed(incidentNow);
  const storeIncidents=()=>memory.set(INCIDENT_DEMO_KEY,JSON.stringify({version:1,cases:incidentCases}));
  storeIncidents();seed(true,manager);
  window.location.hash="#/manager/incidents?id=SC-local-0086";
  let incidentHtml=renderToStaticMarkup(React.createElement(App));
  for(const text of ["Gửi phương án cho khách","Lưu ghi nhận sự cố","datetime-local","Ảnh bằng chứng sự cố"])assert.ok(incidentHtml.includes(text),text);
  assert.ok(!/type="radio"[^>]*checked/.test(incidentHtml));
  const sendIncident={id:incidentCases[0].id,expectedVersion:1,description:"Mái kho thấm nước",affectedAt:"2026-10-01T12:00",confirmed:true,proposal:"TRANSFER",targetUnitId:"unit-b016"};
  incidentCases=applyIncidentAction(incidentCases,"SEND_INCIDENT_PROPOSAL",sendIncident,incidentActor,incidentNow);storeIncidents();seed(true);
  window.location.hash="#/units/HĐ-2026-0086/incident?incident=SC-local-0086";
  incidentHtml=renderToStaticMarkup(React.createElement(App));
  for(const text of ["Xác nhận lựa chọn","Chuyển sang kho B-016","Kết thúc hợp đồng"])assert.ok(incidentHtml.includes(text),text);
  assert.ok(!/type="radio"[^>]*checked/.test(incidentHtml),"Khách tự chọn phương án");
  window.location.hash="#/units/HĐ-2026-0086/incident?incident=SC-other-0001";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Không tìm thấy hồ sơ"));
  const who={id:101,roles:["CUSTOMER"]};
  incidentCases=applyIncidentAction(incidentCases,"CHOOSE_INCIDENT_OPTION",{id:incidentCases[0].id,expectedVersion:2,choice:"TRANSFER"},who,new Date(incidentNow.getTime()-120000));storeIncidents();
  seed(true,manager);window.location.hash="#/manager/incidents?id=SC-local-0086";
  incidentHtml=renderToStaticMarkup(React.createElement(App));assert.ok(incidentHtml.includes("Xác nhận hoàn tất chuyển"));
  incidentCases=applyIncidentAction(incidentCases,"COMPLETE_INCIDENT_TRANSFER",{id:incidentCases[0].id,expectedVersion:3,confirmed:true,movedAt:new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(incidentNow).replace(" ","T")},incidentActor,incidentNow);storeIncidents();seed(true);
  window.location.hash="#/units/HĐ-2026-0086/incident?incident=SC-local-0086";
  incidentHtml=renderToStaticMarkup(React.createElement(App));
  for(const text of ["Đã chuyển sang kho B-016","B-015 · đang bảo trì","mã của B-015 đã hết hiệu lực"])assert.ok(incidentHtml.includes(text),text);
  assert.ok(!incidentHtml.includes("Xác nhận lựa chọn"));assert.match(incidentHtml,/<button[^>]*disabled[^>]*>Mở QR kho B-016<\/button>/);
  incidentCases.forEach(i=>i.facilityId=9999);storeIncidents();seed(true,manager);window.location.hash="#/manager/incidents?id=SC-local-0086";
  assert.ok(renderToStaticMarkup(React.createElement(App)).includes("Không tìm thấy hồ sơ"));
  memory.delete(INCIDENT_DEMO_KEY);count+=6;

  // Batch08: missing evidence and explicit checklist cannot be treated as completion.
  const b8ops=createOpsData();
  const keyTask=b8ops.handovers.find(h=>h.status==="WAITING");
  seed(true,OPS_ACCOUNTS.find(a=>a.role==="STAFF"));
  b8ops.verifications=b8ops.verifications.filter(v=>v.id!==keyTask.verification_id);
  memory.set(OPS_KEY,JSON.stringify(b8ops));window.location.hash=`#/staff/keys?id=${keyTask.id}`;
  let b8html=renderToStaticMarkup(React.createElement(App));
  assert.ok(b8html.includes("Thiếu hồ sơ xác minh hợp lệ"));assert.match(b8html,/<button[^>]*disabled[^>]*>Ghi nhận đã giao chìa khóa<\/button>/);
  b8ops.verifications=[{id:keyTask.verification_id,status:"DONE",doc_last4:"1234",doc_type:"CCCD"}];memory.set(OPS_KEY,JSON.stringify(b8ops));
  b8html=renderToStaticMarkup(React.createElement(App));assert.equal((b8html.match(/type="checkbox"/g)||[]).length,3);assert.ok(!/type="checkbox"[^>]*checked/.test(b8html));assert.ok(b8html.includes("Chưa có bằng chứng chính sách"));
  window.location.hash="#/staff/return?id=TK-0098";b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Tải ảnh hiện trạng / hư hỏng")&&b8html.includes("Lưu nháp"));assert.ok(!b8html.includes("Đã chuyển hết đồ khỏi kho"),"Không điền sẵn kết luận kiểm kê");
  seed(true,manager);window.location.hash="#/manager/contracts?id=missing";b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Không tìm thấy hợp đồng"));assert.ok(!b8html.includes("Bước tiếp theo"));assert.ok(!b8html.includes('table--hover'));
  window.location.hash="#/manager/deposit-refunds?id=HC-0098";b8html=renderToStaticMarkup(React.createElement(App));for(const text of ["Mã giao dịch","Thời gian chuyển","đúng tài khoản nhận"])assert.ok(b8html.includes(text),text);assert.match(b8html,/<button[^>]*disabled[^>]*>Ghi nhận đã chuyển tiền<\/button>/);
  delete b8ops.deposit_refunds[0].amount;memory.set(OPS_KEY,JSON.stringify(b8ops));b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Chưa có dữ liệu"));assert.ok(!b8html.includes("Không còn khoản hoàn;"));
  b8ops.deposit_refunds[0].amount=0;b8ops.deposit_refunds[0].status="NO_REFUND";memory.set(OPS_KEY,JSON.stringify(b8ops));b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("không tạo giao dịch chuyển tiền"));assert.ok(!b8html.includes('type="datetime-local"'));
  b8ops.refunds=[{...b8ops.refunds[0],status:"UNKNOWN",amount:undefined}];memory.set(OPS_KEY,JSON.stringify(b8ops));window.location.hash="#/manager/refunds";b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Chưa rõ trạng thái")&&b8html.includes("Chưa có dữ liệu"));assert.ok(!b8html.includes("Đã hoàn"));
  b8ops.verifications=[{id:"XM-check",status:"TODO",customer:"Mai",reservation_id:"SS-check"}];memory.set(OPS_KEY,JSON.stringify(b8ops));seed(true,OPS_ACCOUNTS.find(a=>a.role==="STAFF"));window.location.hash="#/staff/verify?id=XM-check";b8html=renderToStaticMarkup(React.createElement(App));assert.equal((b8html.match(/type="checkbox"/g)||[]).length,4);assert.ok(!b8html.includes("Số giấy tờ"));assert.ok(!/type="checkbox"[^>]*checked/.test(b8html));
  memory.delete(OPS_KEY);count+=9;

  seed(true);
  window.location.hash = "#/overview";
  const overview = renderToStaticMarkup(React.createElement(App));
  for (const t of ["Xin chào, Nguyễn Thị Mai", "Thanh toán &amp; lịch hẹn", "Mốc sắp tới", "Hoạt động gần đây"]) assert.ok(overview.includes(t), t);
  console.log(JSON.stringify({ renderedRoutes: count, result: "PASS" }));
} finally {
  await vite.close();
}
