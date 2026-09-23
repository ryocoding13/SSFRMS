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
import "./styles/ss.css";
import React, { useEffect } from "react";
import Header from "./components/Header";
import { Button, Empty, Icon, LinkButton } from "./components/UI";
import { go, href, parseRoute, useRoute } from "./lib/router";
import { Login, Register } from "./pages/Auth";
import { Checkout, CheckoutFailed, ReservationSummary } from "./pages/Checkout";
import FacilityDetail from "./pages/FacilityDetail";
import FindList from "./pages/FindList";
import Home from "./pages/Home";
import Overview from "./pages/Overview";
import Payments from "./pages/Payments";
import Profile from "./pages/Profile";
import { Guide, Pricing } from "./pages/Public";
import AdminApp from "./admin/AdminApp";
import Reservations from "./pages/Reservations";
import Support from "./pages/Support";
import { Renew, Return, Sent, UnitDetail, Units } from "./pages/Units";
import { AppProvider, useApp } from "./state/store";

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
  admin: "Quản trị hệ thống",
  support: "Hỗ trợ",
  profile: "Tài khoản",
};

// Trang cần đăng nhập. Các trang công khai: home, login, register, pricing, guide, find (xem cơ sở).
const PRIVATE = ["overview", "units", "reservations", "payments", "support", "profile", "checkout", "confirmation", "sent"];

function renderPage({ page, parts, query }) {
  const [a, b] = parts;
  switch (page) {
    case "home": return <Home />;
    case "login": return <Login query={query} />;
    case "register": return <Register query={query} />;
    case "pricing": return <Pricing />;
    case "guide": return <Guide />;
    case "find": return a ? <FacilityDetail id={a} query={query} /> : <FindList query={query} />;
    case "checkout": return b === "failed" ? <CheckoutFailed id={a} /> : <Checkout id={a} />;
    case "confirmation": return <ReservationSummary id={a} />;
    case "overview": return <Overview />;
    case "reservations": return a ? <ReservationSummary id={a} mode="detail" /> : <Reservations />;
    case "units":
      if (a && b === "renew") return <Renew id={a} />;
      if (a && b === "return") return <Return id={a} />;
      return a ? <UnitDetail id={a} /> : <Units />;
    case "sent": return <Sent query={query} />;
    case "payments": return <Payments />;
    case "support": return <Support query={query} />;
    case "profile": return <Profile />;
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
  const { authed, toast, dismissToast, storageError, ready, loadError, retry, isAdmin, mode } = useApp();
  const isAdminPage = route.page === "admin";
  const needsLogin = (PRIVATE.includes(route.page) || (isAdminPage && mode === "api")) && !authed;

  useEffect(() => {
    document.title = `${TITLES[route.page] || "SafeSpace"} · SafeSpace`;
  }, [route.page]);
  useEffect(() => {
    if (!needsLogin) return;
    // Đăng xuất rồi chuyển trang: hash có thể đã đổi sang trang công khai, khi đó không ép quay lại đăng nhập
    const current = parseRoute(window.location.hash);
    if (!PRIVATE.includes(current.page) && current.page !== "admin") return;
    go(`login?next=${encodeURIComponent(current.raw)}`, { replace: true });
  }, [needsLogin, route.raw]);

  // Tài khoản quản trị không dùng các trang khách hàng
  useEffect(() => {
    if (isAdmin && (PRIVATE.includes(route.page) || route.page === "login" || route.page === "register")) go("admin", { replace: true });
  }, [isAdmin, route.page]);

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
    <div className="app">
      <a className="skip" href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Chuyển đến nội dung</a>
      {!(isAdminPage && !adminBody && authed) && <Header page={route.page} />}
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
          adminBody || <AdminApp parts={route.parts} />
        ) : (
          renderPage(route)
        )}
      </div>
      <footer className="footer">
        <span>© 2026 SafeSpace · Không gian cho cuộc sống của bạn.</span>
        <nav className="footer__links" aria-label="Liên kết cuối trang">
          <a href={href("find")}>Cơ sở</a>
          <a href={href("pricing")}>Bảng giá</a>
          <a href={href("guide")}>Hướng dẫn</a>
          <a href={href(authed ? "support" : "guide")}>Hỗ trợ</a>
        </nav>
      </footer>
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

export default function CustomerApp() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
