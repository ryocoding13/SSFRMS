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

  const { DamagePhotos, safeImageUrl } = await vite.ssrLoadModule("/src/features/facility-operations/damage/DamageComponents.jsx");
  assert.equal(safeImageUrl("http://localhost:5151/photo.jpg"), true);
  assert.equal(safeImageUrl("https://safespace.vn/photo.jpg"), true);
  assert.equal(safeImageUrl("/images/inside/ben-trong-1.jpg"), true);
  assert.equal(safeImageUrl("data:image/png;base64,abc"), true);
  assert.equal(safeImageUrl("javascript:alert(1)"), false);
  assert.equal(safeImageUrl("//evil.com/pic.jpg"), false);
  assert.equal(safeImageUrl(null), false);

  const emptyDamagePhotos = renderToStaticMarkup(React.createElement(DamagePhotos, { photos: [], emptyText: "Không có ảnh kho trống." }));
  assert.ok(emptyDamagePhotos.includes("Không có ảnh kho trống."));

  const populatedDamagePhotos = renderToStaticMarkup(React.createElement(DamagePhotos, { photos: [{ url: "http://localhost:5151/photo1.jpg", caption: "Kho trống K04" }] }));
  assert.ok(populatedDamagePhotos.includes("http://localhost:5151/photo1.jpg"));
  assert.ok(populatedDamagePhotos.includes("Kho trống K04"));

  const publicRoutes = ["reset-password","home", "login", "register", "pricing", "guide", "find", "find?type=climate&band=M", "find/map", "find/map?type=climate", "find/map?area=Kh%C3%B4ng%20c%C3%B3", "find/1", "find/1?view=map&unit=K02", "find/8?type=climate&view=map", "find/999", "nope", "door", "door?unit=B-015"];
  const privateRoutes = ["units/HĐ-2026-0086/renew-other", "units/unknown/renew-other", "units/HĐ-2026-0086/incident", "units/HĐ-2026-0086/incident?incident=missing", "units/unknown/incident","units/HĐ-2026-0086/damage", "units/HĐ-2026-0086/damage?case=missing", "units/unknown/damage","reservations/SS-20260914-0142/cancel", "reservations/missing/cancel","refunds","refunds/cash","units/HĐ-2026-0086/deduction","units/unknown/deduction","units/HĐ-2026-0142/unit-change","sent?type=return&contract=HĐ-2026-0086","support?topic=KEY_PICKUP","policies", "payments/check/SS-0086-REN", "payments/check/missing", "payments/history", "inquiries", "inquiries/HT-0091", "units/HĐ-2026-0142/deposit", "units/HĐ-2026-0086/progress", "units/HĐ-2026-0086/renewal-status",
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
  // D42 + Task #8/#9: trả kho chỉ chọn ngày, không bắt ảnh hay khung giờ; chọn cách nhận hoàn (chuyển khoản / tiền mặt tại quầy)
  for (const text of ["Lịch trả kho", "Ngày mong muốn trả kho", "Nhận tiền hoàn", "Nhận hoàn qua", "Tiền mặt tại quầy", "Số tài khoản", "Không thể huỷ yêu cầu", "QR/PIN khoá ngay", "48 giờ"]) assert.ok(returnHtml.includes(text), text);
  for (const text of ["Tải ảnh kho trống", "Khung giờ"]) assert.ok(!returnHtml.includes(text), text);
  window.location.hash = "#/reservations/SS-20260914-0142/cancel";
  const cancelHtml = renderToStaticMarkup(React.createElement(App));
  for (const text of ["Nhận tiền hoàn", "Tiền mặt tại quầy", "Số tài khoản", "Chủ tài khoản", "Khoản hoàn dự kiến"]) assert.ok(cancelHtml.includes(text), text);
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
  assert.ok(endedUnits.includes("Xem hợp đồng") && !endedUnits.includes("Mã QR mở cửa"));
  recordData.contracts[0].status = "ACTIVE";
  recordData.contracts[0].end_date = "2099-12-31";
  // #59 (thay L13): trước ngày thuê vẫn xem được mã, chưa có nút Đóng cửa; mã chỉ mở cửa từ 00:00 ngày bắt đầu
  recordData.contracts[0].start_date = "2099-01-01";
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: recordData }));
  const prestartUnits = renderToStaticMarkup(React.createElement(App));
  assert.match(prestartUnits, /<button type="button" class="btn btn--outline ">Mã QR mở cửa<\/button>/);
  assert.ok(prestartUnits.includes("Chưa đến ngày sử dụng"));
  assert.ok(!prestartUnits.includes(">Đóng cửa<"), "chưa đến ngày thuê thì chưa có nút Đóng cửa");
  recordData.contracts[0].start_date = "2026-01-01";
  recordData.returns = [{ contract_id: recordData.contracts[0].contract_id, status: "PENDING" }];
  memory.set(STORAGE_KEY, JSON.stringify({ version: 5, authed: true, data: recordData }));
  const returningUnits = renderToStaticMarkup(React.createElement(App));
  assert.match(returningUnits, /<button[^>]*disabled[^>]*>Mã QR mở cửa<\/button>/);
  assert.match(returningUnits, /<button[^>]*disabled[^>]*>Đóng cửa<\/button>/, "đã gửi trả kho thì không điều khiển cửa");
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
  // 3.2 · C07b-L5c: yêu cầu gia hạn chờ duyệt → nút Xem yêu cầu + Huỷ yêu cầu; trả kho ghi lý do khoá.
  lifecycleData.renewals = [{renewal_id:"GH-0043",contract_id:"HĐ-2026-0086",months:3,status:"PENDING",old_end:"2026-09-25",new_end:"2026-12-25",amount:1500000}];
  memory.set(STORAGE_KEY, JSON.stringify({version:5,authed:true,data:lifecycleData}));
  window.location.hash = "#/units/HĐ-2026-0086";
  const pendingRenewalHtml = renderToStaticMarkup(React.createElement(App));
  for (const text of ["Xem yêu cầu", "Huỷ yêu cầu", "GH-0043 đang được kiểm tra · huỷ được trước khi xác nhận"]) assert.ok(pendingRenewalHtml.includes(text), text);
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
    STAFF: ["staff/incidents","staff/renewal-payments", "staff/cash-refunds", "staff/recheck", "staff/unit-moves", "staff/overdue", "staff/inquiries",
      "staff", "staff?page=2", "staff/reconcile", "staff/fees", "staff/fees?id=PHI-0086", "staff/verify", "staff/handover", "staff/return", "staff/support",
      "staff/reconcile?id=SS-20260914-0142", "staff/verify?id=XM-0142", "staff/handover?id=BG-0115", "staff/return?id=TK-0098",
      "staff/support?id=HT-0082", "staff/done?kind=payment", "staff/nope",
    ],
    MANAGER: ["manager/incidents", "manager/incidents?id=SC-local-0086", "manager/incidents?id=missing","manager/overdue", "manager/cash-refunds", "manager/unit-conflicts", "manager/daily-report", "manager/deposit-refunds","manager", "manager/units", "manager/units?tab=OVERDUE", "manager/units?tab=MAINTENANCE", "manager/allocate", "manager/assign", "manager/renewals", "manager/contracts", "manager/refunds", "manager/report", "manager/done", "staff"],
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
  // Báo cáo doanh thu Manager: kiểm tra trường hợp doanh thu 0/0 và 3/1
  seed(true, OPS_ACCOUNTS[1]);
  const zeroReportOps = {
    ...createOpsData(),
    revenue: {
      months: [{ month: 9, year: 2026, value: 0, label: "Tháng 9" }],
      by_type: [
        { label: "Kho thường", value: 0 },
        { label: "Kho lạnh", value: 0 },
      ],
    },
  };
  memory.set(OPS_KEY, JSON.stringify(zeroReportOps));
  window.location.hash = "#/manager/report";
  const zeroHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(!zeroHtml.includes("NaN"), "Báo cáo doanh thu 0/0 không được có NaN");
  assert.ok(zeroHtml.includes("Kho thường") && zeroHtml.includes("0 đ · 0%"));
  assert.ok(zeroHtml.includes("Kho lạnh") && zeroHtml.includes("0 đ · 0%"));
  assert.ok(zeroHtml.includes('style="width:0%"'), "Thanh doanh thu 0% có chiều rộng 0%");
  assert.ok(zeroHtml.includes("Tỷ lệ lấp đầy kho"), "Tỷ lệ lấp đầy kho là chỉ số riêng");

  const shareReportOps = {
    ...createOpsData(),
    revenue: {
      months: [{ month: 9, year: 2026, value: 4_000_000, label: "Tháng 9" }],
      by_type: [
        { label: "Kho thường", value: 3_000_000 },
        { label: "Kho lạnh", value: 1_000_000 },
      ],
    },
  };
  memory.set(OPS_KEY, JSON.stringify(shareReportOps));
  window.location.hash = "#/manager/report";
  const shareHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(shareHtml.includes("3.000.000 đ · 75%"));
  assert.ok(shareHtml.includes("1.000.000 đ · 25%"));
  assert.ok(shareHtml.includes('style="width:75%"'));
  assert.ok(shareHtml.includes('style="width:25%"'));

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
    // D36: chìa khóa vật lý giao theo yêu cầu "Nhận chìa khóa"; D40: hợp đồng chưa tới ngày thuê vẫn gửi hỗ trợ được
    ["units/HĐ-2026-0142", ["Hợp đồng và mã ra vào đã được cấp", "Đã cấp · mở cửa từ 00:00 ngày", "Có thể mở cửa từ 00:00 ngày", "Nhận chìa khóa"]],
    ["units/HĐ-2026-0086", ["Mã QR mở cửa", "Đóng cửa", "Gia hạn", "Trả kho"]],
    ["payments", ["Thanh toán", "Gia hạn B-015 · 3 tháng", "Chờ thanh toán"]],
    ["support", ["Phản hồi của nhân viên", "Thẻ cũ bị lỗi từ", "Yêu cầu gần đây", "Lưu ý khi gửi"]],
    ["reservations", ["Huỷ đơn SS-0142", "Thao tác", "miễn phí huỷ"]], // D49
    ["find/1", ["Chỉ đường đến cơ sở", "google.com/maps/dir"]],
  ];
  for (const [r, texts] of pages) {
    window.location.hash = `#/${r}`;
    const html = renderToStaticMarkup(React.createElement(App));
    for (const text of texts) assert.ok(html.includes(text), `${r}: thiếu "${text}"`);
    count++;
  }
  window.location.hash = "#/units/HĐ-2026-0142";
  // D26 vẫn cấp mã sau thanh toán; D35–D36 (L13) chỉ mở QR/PIN từ ngày bắt đầu thuê
  const prestartDetail = renderToStaticMarkup(React.createElement(App));
  assert.ok(prestartDetail.includes("Đã cấp · mở cửa từ 00:00 ngày") && prestartDetail.includes("Mã QR mở cửa") && !prestartDetail.includes(">Đóng cửa<"), "#59: trước ngày thuê xem được mã, chỉ mở cửa từ 00:00 ngày bắt đầu");
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

  // D48: màn hồ sơ hư hỏng cũ (Batch06) đã gỡ; route cũ không còn mở màn phản hồi/khắc phục.
  seed(true);
  window.location.hash = "#/units/HĐ-2026-0086/damage";
  assert.ok(!renderToStaticMarkup(React.createElement(App)).includes("Gửi phản hồi cho cơ sở"), "Route hư hỏng cũ vẫn mở màn phản hồi");
  window.location.hash = "#/units/HĐ-2026-0086/progress";
  assert.ok(!renderToStaticMarkup(React.createElement(App)).includes("Đối chiếu hư hỏng / khắc phục"), "Còn nút hư hỏng cũ");
  seed(true, manager);
  window.location.hash = "#/manager/contracts";
  const contractsHtml = renderToStaticMarkup(React.createElement(App));
  assert.ok(!contractsHtml.includes("Phản hồi hư hỏng") && !contractsHtml.includes("Kiểm tra khắc phục"), "Còn nút hư hỏng cũ ở quản lý");
  count+=3;

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
  const { inspectionFlags } = await vite.ssrLoadModule("/src/features/staff/returns/ReturnInspectionPage.jsx");
  const fewItems = inspectionFlags({ items: "Đạt · còn ít đồ", walls: "Đạt tiêu chuẩn", keys: "Đã nhận đủ chìa" });
  assert.equal(fewItems.clean, 3); assert.equal(fewItems.dirty, false);
  window.location.hash="#/staff/return?id=TK-0098";b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Tải ảnh hiện trạng / hư hỏng · Bắt buộc")&&b8html.includes("Lưu nháp"));assert.ok(!b8html.includes("Ảnh kho trống do khách gửi"),"Task #8 bỏ khung ảnh khách gửi");assert.ok(!b8html.includes("Đã chuyển hết đồ khỏi kho"),"Không điền sẵn kết luận kiểm kê");
  seed(true,manager);window.location.hash="#/manager/contracts?id=missing";b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Không tìm thấy hợp đồng"));assert.ok(!b8html.includes("Bước tiếp theo"));assert.ok(!b8html.includes('table--hover'));
  window.location.hash="#/manager/deposit-refunds?id=HC-0098";b8html=renderToStaticMarkup(React.createElement(App));for(const text of ["Mã giao dịch","Thời gian chuyển","đúng tài khoản nhận"])assert.ok(b8html.includes(text),text);assert.match(b8html,/<button[^>]*disabled[^>]*>Ghi nhận đã chuyển tiền<\/button>/);assert.ok(!b8html.includes("Tạo lại mã")&&!b8html.includes('value="FT'),"Task #21 bỏ nút Tạo lại mã và tự sinh mã");assert.ok(!b8html.includes("Tiền mặt tại quầy"),"Task #20 khóa hình thức hoàn theo khách");
  delete b8ops.deposit_refunds[0].amount;memory.set(OPS_KEY,JSON.stringify(b8ops));b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Chưa có dữ liệu"));assert.ok(!b8html.includes("Không còn khoản hoàn;"));
  b8ops.deposit_refunds[0].amount=0;b8ops.deposit_refunds[0].status="NO_REFUND";memory.set(OPS_KEY,JSON.stringify(b8ops));b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("không tạo giao dịch chuyển tiền"));assert.ok(!b8html.includes('type="datetime-local"'));
  b8ops.refunds=[{...b8ops.refunds[0],status:"UNKNOWN",amount:undefined}];memory.set(OPS_KEY,JSON.stringify(b8ops));window.location.hash="#/manager/refunds";b8html=renderToStaticMarkup(React.createElement(App));assert.ok(b8html.includes("Chưa rõ trạng thái")&&b8html.includes("Chưa có dữ liệu"));assert.ok(!b8html.includes("Đã hoàn"));
  b8ops.verifications=[{id:"XM-check",status:"TODO",customer:"Mai",reservation_id:"SS-check"}];memory.set(OPS_KEY,JSON.stringify(b8ops));seed(true,OPS_ACCOUNTS.find(a=>a.role==="STAFF"));window.location.hash="#/staff/verify?id=XM-check";b8html=renderToStaticMarkup(React.createElement(App));assert.equal((b8html.match(/type="checkbox"/g)||[]).length,4);assert.ok(!b8html.includes("Số giấy tờ"));assert.ok(!/type="checkbox"[^>]*checked/.test(b8html));
  memory.delete(OPS_KEY);count+=9;

  // Batch09: readonly access table and selection panels are rendered with actual metadata props.
  const {RoleAccessTable}=await vite.ssrLoadModule("/src/features/admin/permissions/PermissionListPage.jsx");
  const {default:SelectionPanel}=await vite.ssrLoadModule("/src/features/admin/components/SelectionPanel.jsx");
  let b9html=renderToStaticMarkup(React.createElement(RoleAccessTable,{roles:[{roleId:1,roleName:"ADMIN"},{roleId:2,roleName:"STAFF"}]}));
  assert.ok(b9html.includes("Cố định"));assert.ok(!b9html.includes('type="checkbox"')&&!b9html.includes("Lưu cấu hình"));
  b9html=renderToStaticMarkup(React.createElement(SelectionPanel,{title:"Chọn cơ sở phụ trách",description:"Chọn từ danh sách",items:[{id:1,label:"Cơ sở A"},{id:2,label:"Cơ sở B"}],value:2,onClose(){},onSelect(){},confirmLabel:"Dùng cơ sở này"}));
  assert.ok(b9html.includes("overlay--drawer")&&b9html.includes('role="dialog"')&&b9html.includes("Cơ sở B"));assert.match(b9html,/aria-pressed="true"/);assert.ok(!b9html.includes("<input"));
  b9html=renderToStaticMarkup(React.createElement(SelectionPanel,{title:"Đổi vai trò",items:[{id:1,label:"Quản trị",disabled:true},{id:2,label:"Nhân viên"}],onClose(){},onSelect(){}}));
  assert.match(b9html,/<button[^>]*disabled[^>]*>Dùng lựa chọn này<\/button>/);
  b9html=renderToStaticMarkup(React.createElement(SelectionPanel,{title:"Cấp lại vai trò",items:[],onClose(){},onSelect(){}}));assert.ok(b9html.includes("Chưa có lựa chọn phù hợp"));count+=4;
  for(const [role,routes] of [["ADMIN",["admin","admin/new","admin/users/3","admin/permissions","admin/logs"]],["OPERATIONS",["business","business/facilities","business/policy-status","business/policy-content","business/reports","business/export","business/facility-report?id=1","business/facility-report"]]]) {
   seed(true,{user_id:991,username:"qa",full_name:"QA vận hành",role});
   for(const route of routes){window.location.hash=`#/${route}`;const html=renderToStaticMarkup(React.createElement(App));assert.ok(html.includes("QA vận hành"),route);assert.ok(!html.includes("NaN")&&!html.includes("undefined"),route);count++;}
  }

  seed(true);
  window.location.hash = "#/overview";
  const overview = renderToStaticMarkup(React.createElement(App));
  for (const t of ["Xin chào, Nguyễn Thị Mai", "Thanh toán &amp; lịch hẹn", "Mốc sắp tới", "Hoạt động gần đây"]) assert.ok(overview.includes(t), t);
  console.log(JSON.stringify({ renderedRoutes: count, result: "PASS" }));
} finally {
  await vite.close();
}
