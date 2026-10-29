import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/vietnamese-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/vietnamese-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/vietnamese-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/vietnamese-700.css";
import "@fontsource/inter/latin-800.css";
import "@fontsource/inter/vietnamese-800.css";
import "../shared/styles/ss.css";
import "../shared/styles/auth-support.css";
import "../shared/styles/workflows.css";
import { WORKFLOW_DEMO } from "../features/facility-operations/workflows/useWorkflowData.js";
import { RentalPolicyPage } from "../features/customer/policies/RentalPolicyPage.jsx";
import { RefundTrackingPage } from "../features/customer/payments/RefundTrackingPage.jsx";
import { PaymentHistoryPage } from "../features/customer/history/PaymentHistoryPage.jsx";
import { DepositLedgerPage } from "../features/customer/contracts/DepositLedgerPage.jsx";
import { RenewalStatusPage } from "../features/customer/contracts/RenewalStatusPage.jsx";
import { ReturnProgressPage } from "../features/customer/contracts/ReturnProgressPage.jsx";
import { InquiryListPage } from "../features/customer/support/InquiryListPage.jsx";
import { InquiryDetailPage } from "../features/customer/support/InquiryDetailPage.jsx";
import React, { useEffect } from "react";
import Header from "../shared/components/Header.jsx";
import { Button, Empty, Icon, LinkButton } from "../shared/components/UI.jsx";
import { go, parseRoute, useRoute } from "./router.js";
import { PasswordResetPage } from "../features/auth/PasswordResetPage.jsx";
import { LoginPage } from "../features/auth/LoginPage.jsx";
import { RegisterPage } from "../features/auth/RegisterPage.jsx";
import { CheckoutPage } from "../features/customer/payments/CheckoutPage.jsx";
import { CheckoutFailedPage } from "../features/customer/payments/CheckoutFailedPage.jsx";
import { ReservationDetailPage } from "../features/customer/reservations/ReservationDetailPage.jsx";
import FacilityDetailPage from "../features/customer/facilities/FacilityDetailPage.jsx";
import FacilityListPage from "../features/customer/facilities/FacilityListPage.jsx";
import FacilityMapPage from "../features/customer/facilities/FacilityMapPage.jsx";
import HomePage from "../features/customer/home/HomePage.jsx";
import CustomerDashboardPage from "../features/customer/dashboard/CustomerDashboardPage.jsx";
import DoorScannerPage from "../features/customer/access/DoorScannerPage.jsx";
import { PaymentStatusPage } from "../features/customer/payments/PaymentStatusPage.jsx";
import PaymentListPage from "../features/customer/payments/PaymentListPage.jsx";
import CustomerProfilePage from "../features/customer/profile/CustomerProfilePage.jsx";
import { HelpPage } from "../features/customer/help/HelpPage.jsx";
import { PublicPricingPage } from "../features/customer/pricing/PublicPricingPage.jsx";
import AdminRoutes from "../features/admin/AdminRoutes.jsx";
import BusinessRoutes from "../features/business/BusinessRoutes.jsx";
import { homeFor, isBusinessRoles, isManagerRoles, isOpsRoles, isStaffRoles } from "../shared/utils/roles.js";
import FacilityOperationsRoutes from "../features/facility-operations/FacilityOperationsRoutes.jsx";
import { OpsProvider } from "../features/facility-operations/state/FacilityOperationsProvider.jsx";
import { CancelReservationPage } from "../features/customer/reservations/CancelReservationPage.jsx";
import ReservationListPage from "../features/customer/reservations/ReservationListPage.jsx";
import SupportPage from "../features/customer/support/SupportPage.jsx";
import SupportTicketDetailPage from "../features/customer/support/SupportTicketDetailPage.jsx";
import { RenewalRequestPage } from "../features/customer/contracts/RenewalRequestPage.jsx";
import { ReturnRequestPage } from "../features/customer/contracts/ReturnRequestPage.jsx";
import { RequestSentPage } from "../features/customer/requests/RequestSentPage.jsx";
import { RentedUnitDetailPage } from "../features/customer/contracts/RentedUnitDetailPage.jsx";
import { RentedUnitListPage } from "../features/customer/contracts/RentedUnitListPage.jsx";
import { AppProvider, useApp } from "./state/AppProvider.jsx";

const TITLES = {
  home: "Trang chủ",
  login: "Đăng nhập",
  register: "Đăng ký",
  pricing: "Bảng giá",
  guide: "Hướng dẫn & hỗ trợ",
  find: "Tìm & đặt kho",
  checkout: "Đặt chỗ & thanh toán",
  confirmation: "Xác nhận đặt chỗ",
  overview: "Tổng quan",
  units: "Kho của tôi",
  reservations: "Đơn đặt chỗ",
  payments: "Thanh toán & lịch hẹn",
  sent: "Đã gửi yêu cầu",
  business: "Quản lý vận hành kinh doanh",
  admin: "Quản trị hệ thống",
  staff: "Nhân viên cơ sở",
  manager: "Quản lý cơ sở",
  support: "Hỗ trợ",
  profile: "Tài khoản",
  door: "Máy quét cửa kho",
};

// Trang cần đăng nhập. Các trang công khai: home, login, register, pricing, guide, find (xem cơ sở).
const PRIVATE = ["refunds", "inquiries","overview", "units", "reservations", "payments", "support", "profile", "checkout", "confirmation", "sent"];

function renderPage({ page, parts, query }) {
  const [a, b] = parts;
  switch (page) {
    case "home": return <HomePage />;
    case "refunds": return <RefundTrackingPage />;
    case "policies": return <RentalPolicyPage />;
    case "inquiries": return a ? <InquiryDetailPage id={a} /> : <InquiryListPage />;
    case "reset-password": return <PasswordResetPage />;
    case "login": return <LoginPage query={query} />;
    case "register": return <RegisterPage query={query} />;
    case "pricing": return <PublicPricingPage />;
    case "guide": return <HelpPage />;
    case "find": return a === "map" ? <FacilityMapPage query={query} /> : a ? <FacilityDetailPage id={a} query={query} /> : <FacilityListPage query={query} />;
    case "checkout": return b === "failed" ? <CheckoutFailedPage id={a} /> : <CheckoutPage id={a} />;
    case "confirmation": return <ReservationDetailPage id={a} />;
    case "overview": return <CustomerDashboardPage />;
    case "reservations": return a && b === "cancel" ? <CancelReservationPage key={a} id={a} /> : a ? <ReservationDetailPage id={a} mode="detail" /> : <ReservationListPage />;
    case "units":
      if (a && b === "renewal-status") return <RenewalStatusPage id={a} />;
      if (a && b === "deposit") return <DepositLedgerPage id={a} />;
      if (a && b === "progress") return <ReturnProgressPage id={a} />;
      if (a && b === "renew") return <RenewalRequestPage id={a} />;
      if (a && b === "return") return <ReturnRequestPage key={a} id={a} />;
      return a ? <RentedUnitDetailPage id={a} /> : <RentedUnitListPage />;
    case "sent": return <RequestSentPage query={query} />;
    case "payments": return a === "history" ? <PaymentHistoryPage /> : a === "check" ? <PaymentStatusPage key={b} id={b} /> : <PaymentListPage />;
    case "support": return a ? <SupportTicketDetailPage id={a} /> : <SupportPage query={query} />;
    case "profile": return <CustomerProfilePage />;
    // C07r: máy quét ở cửa kho (mô phỏng), không cần đăng nhập như thiết bị gắn tại cơ sở
    case "door": return <DoorScannerPage query={query} />;
    default:
      return (
        <main className="container page">
          <Empty title="Không tìm thấy trang" text="Đường dẫn này không tồn tại.">
            <LinkButton to="home">Về trang chủ</LinkButton>
          </Empty>
        </main>
      );
  }
}

function Shell() {
  const route = useRoute();
  const { authed, toast, dismissToast, storageError, ready, loadError, retry, isAdmin, mode, roles, notify, onApiError } = useApp();
  const isAdminPage = route.page === "admin";
  const isOpsPage = route.page === "staff" || route.page === "manager";
  const opsRole = route.page === "staff" ? "STAFF" : "MANAGER";
  const isBusinessPage = route.page === "business";
  const businessAllowed = isBusinessRoles(roles);
  const isOps = isOpsRoles(roles);
  const opsAllowed = route.page === "staff" ? isStaffRoles(roles) || isManagerRoles(roles) : isManagerRoles(roles);
  const needsLogin = (PRIVATE.includes(route.page) || isOpsPage || ((isAdminPage || isBusinessPage) && mode === "api")) && !authed;

  useEffect(() => {
    document.title = `${TITLES[route.page] || "SafeSpace"} · SafeSpace`;
  }, [route.page]);
  useEffect(() => {
    if (!needsLogin) return;
    // Đăng xuất rồi chuyển trang: hash có thể đã đổi sang trang công khai, khi đó không ép quay lại đăng nhập
    const current = parseRoute(window.location.hash);
    if (!PRIVATE.includes(current.page) && !["admin", "staff", "manager", "business"].includes(current.page)) return;
    go(`login?next=${encodeURIComponent(current.raw)}`, { replace: true });
  }, [needsLogin, route.raw]);

  // Tài khoản quản trị / nhân viên / quản lý không dùng các trang khách hàng
  useEffect(() => {
    if ((isAdmin || isOps || businessAllowed) && (PRIVATE.includes(route.page) || route.page === "login" || route.page === "register")) go(homeFor(roles), { replace: true });
  }, [isAdmin, isOps, businessAllowed, roles, route.page]);

  const businessBody = mode !== "api" ? (
    <main className="container page"><Empty title="Khu vận hành kinh doanh cần kết nối máy chủ" text="Chạy npm run dev:business để xem giao diện khi chưa có backend, hoặc bật chế độ API và chạy máy chủ của bạn." /></main>
  ) : authed && !businessAllowed ? (
    <main className="container page"><Empty title="Không có quyền truy cập" text="Khu này dành cho tài khoản Quản lý vận hành kinh doanh."><LinkButton to={homeFor(roles)}>Về trang của tôi</LinkButton></Empty></main>
  ) : null;

  const adminBody =
    mode !== "api" ? (
      <main className="container page">
        <Empty title="Khu quản trị cần kết nối máy chủ" text="Bật VITE_USE_API=true và chạy backend SSFRMS để quản lý tài khoản, vai trò và nhật ký.">
          <LinkButton to="home">Về trang chủ</LinkButton>
        </Empty>
      </main>
    ) : authed && !isAdmin ? (
      <main className="container page">
        <Empty title="Không có quyền truy cập" text="Khu quản trị chỉ dành cho tài khoản có vai trò Quản trị.">
          <LinkButton to="overview">Về trang của tôi</LinkButton>
        </Empty>
      </main>
    ) : null;

  return (
    <div className={`app${!isAdminPage && !isOpsPage && !isBusinessPage ? " customer-app" : ""}${["profile", "support"].includes(route.page) ? " app--auth-support" : ""}`}>
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Chuyển đến nội dung</a>
      {!(isAdminPage && !adminBody && authed) && !(isOpsPage && authed && opsAllowed) && !(isBusinessPage && !businessBody && authed) && <Header page={route.page} />}
      {(WORKFLOW_DEMO || mode === "local") && <p className="demo-banner" role="status">MÔ PHỎNG FE · Dữ liệu thử nghiệm, không thanh toán / chuyển tiền thật.</p>}
      <div id="main" tabIndex={-1} key={route.raw.split("?")[0]}>
        {needsLogin ? null : loadError && !ready ? (
          <main className="container page">
            <Empty title="Không tải được dữ liệu" text={loadError}>
              <Button onClick={retry}>Thử lại</Button>
            </Empty>
          </main>
        ) : !ready ? (
          <main className="container page loading" aria-busy="true">
            <span className="loading__spinner" aria-hidden="true" />
            <p>Đang tải dữ liệu…</p>
          </main>
        ) : isAdminPage ? (
          adminBody || <AdminRoutes parts={route.parts} />
        ) : isBusinessPage ? (
          businessBody || <BusinessRoutes parts={route.parts} query={route.query} />
        ) : isOpsPage ? (
          opsAllowed ? (
            <OpsProvider notify={notify} mode={mode} onApiError={onApiError} role={opsRole}>
              <FacilityOperationsRoutes role={opsRole} parts={route.parts} query={route.query} />
            </OpsProvider>
          ) : (
            <main className="container page">
              <Empty title="Không có quyền truy cập" text={route.page === "staff" ? "Khu này dành cho nhân viên và quản lý cơ sở." : "Khu này dành cho quản lý cơ sở."}>
                <LinkButton to={homeFor(roles)}>Về trang của tôi</LinkButton>
              </Empty>
            </main>
          )
        ) : (
          renderPage(route)
        )}
      </div>
      {storageError && <p className="storage-warning" role="status">Trình duyệt không cho lưu dữ liệu, thao tác chỉ giữ trong phiên này.</p>}
      {toast && (
        <div className={`toast toast--${toast.tone}`} role={toast.tone === "error" ? "alert" : "status"}>
          <Icon name={toast.tone === "error" ? "info" : "check"} size={18} />
          <span>{toast.message}</span>
          <button type="button" onClick={dismissToast} aria-label="Đóng thông báo"><Icon name="close" size={16} /></button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
