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
import React, { useState, useEffect, useCallback, useRef } from "react";
import { CustomerContext } from "./context";
import { createDemoData } from "./data";
import { reduceCustomer } from "./domain";
import { Icon, Empty, LinkButton, Button, Modal } from "./components/UI";
import ActionModal from "./components/ActionModal";
import AuthModal from "./components/AuthModal";
import Overview from "./pages/Overview";
import FindStorage from "./pages/FindStorage";
import { Reservations, Units, Payments, Appointments } from "./pages/Records";
import Support, { Profile } from "./pages/Support";
import {
  authService,
  authStorage,
  facilityService,
  reservationService,
  contractService,
  renewalService,
  supportService,
} from "./services";
import {
  mapFacilityFromApi,
  mapUnitTypeFromApi,
  mapRateFromApi,
  mapReservationFromApi,
  mapContractFromApi,
  mapTicketFromApi,
  mapHandoverFromApi,
  mapPaymentFromApi,
} from "./services/adapters";
import "./customer.css";

const NAV = [
  ["overview", "grid", "Tổng quan"],
  ["find", "search", "Tìm & đặt kho"],
  ["units", "box", "Kho của tôi"],
  ["reservations", "file", "Đơn đặt kho"],
  ["payments", "card", "Thanh toán"],
  ["appointments", "calendar", "Lịch nhận kho"],
  ["support", "help", "Yêu cầu hỗ trợ"],
];

const VERSION = 1;

function readData(storageKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (
      saved?.version === VERSION &&
      saved.data?.user &&
      Array.isArray(saved.data?.contracts) &&
      saved.data?.paymentNotices
    )
      return saved.data;
  } catch {
    /* Storage unavailable: keep demo in memory. */
  }
  return createDemoData();
}

export default function CustomerApp({
  onLogout,
  storageKey = "safespace.customer.demo.v1",
}) {
  const [data, setData] = useState(() => readData(storageKey));
  const dataRef = useRef(data);
  dataRef.current = data;

  const [authUser, setAuthUser] = useState(() => authService.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isLiveApi, setIsLiveApi] = useState(false);
  const [loading, setLoading] = useState(false);

  const [route, setRoute] = useState(
    window.location.hash || "#/customer/overview",
  );
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  const timer = useRef();
  const notify = useCallback((message, error = false) => {
    clearTimeout(timer.current);
    setToast({ message, error });
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Listen for unauthorized events to prompt login
  useEffect(() => {
    authStorage.onUnauthorized(() => {
      setAuthUser(null);
      notify("Phiên làm việc hết hạn. Vui lòng đăng nhập lại.", true);
      setAuthModalOpen(true);
    });
  }, [notify]);

  // Handle hash route changes
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash || "#/customer/overview");
      setMobile(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);

  // Save demo data to localStorage if not using live API
  useEffect(() => {
    if (!isLiveApi) {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ version: VERSION, data }),
        );
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    }
  }, [data, storageKey, isLiveApi]);

  // Fetch Live Data from .NET Backend API
  const loadServerData = useCallback(async () => {
    try {
      setLoading(true);
      const [facilitiesRes, unitTypesRes, ratesRes] = await Promise.all([
        facilityService.getFacilities().catch(() => null),
        facilityService.getUnitTypes().catch(() => null),
        facilityService.getRates().catch(() => null),
      ]);

      if (!facilitiesRes || !unitTypesRes) {
        // Backend offline or unreachable, retain demo state
        setIsLiveApi(false);
        return;
      }

      const facilities = facilitiesRes.map((f, idx) => mapFacilityFromApi(f, idx));
      const unitTypes = unitTypesRes.map((t) => mapUnitTypeFromApi(t));
      const rates = ratesRes ? ratesRes.map((r) => mapRateFromApi(r)) : [];

      let reservations = [];
      let contracts = [];
      let tickets = [];
      let handovers = [];
      let payments = [];

      // If user is authenticated, fetch personalized customer records
      if (authService.isAuthenticated()) {
        try {
          const [resList, contractsList, ticketsList] = await Promise.all([
            reservationService.getMyReservations().catch(() => []),
            contractService.getMyContracts().catch(() => []),
            supportService.getMyTickets().catch(() => []),
          ]);

          reservations = resList.map((r) => mapReservationFromApi(r));
          contracts = contractsList.map((c) => mapContractFromApi(c));
          tickets = ticketsList.map((t) => mapTicketFromApi(t));

          // Load detailed contracts to collect handovers and payments
          if (contracts.length > 0) {
            const detailPromises = contracts.map(async (c) => {
              try {
                const detail = await contractService.getContract(c.contract_id);
                if (detail?.handover) {
                  handovers.push(mapHandoverFromApi(detail.handover, c.contract_id));
                }
                if (Array.isArray(detail?.payments)) {
                  payments.push(...detail.payments.map((p) => mapPaymentFromApi(p)));
                }
              } catch {
                /* Ignore single contract error */
              }
            });
            await Promise.all(detailPromises);
          }
        } catch {
          // Keep empty lists on auth fetch error
        }
      }

      const currentStoredUser = authService.getCurrentUser();
      const nextUser = currentStoredUser
        ? {
            user_id: currentStoredUser.userId || 101,
            full_name: currentStoredUser.fullName || currentStoredUser.username,
            email: currentStoredUser.email,
            phone: currentStoredUser.phone || "",
          }
        : dataRef.current.user;

      const nextData = {
        user: nextUser,
        facilities,
        unitTypes,
        rates: rates.length ? rates : dataRef.current.rates,
        units: dataRef.current.units,
        contracts: contracts.length > 0 ? contracts : (authService.isAuthenticated() ? [] : dataRef.current.contracts),
        reservations: reservations.length > 0 ? reservations : (authService.isAuthenticated() ? [] : dataRef.current.reservations),
        payments: payments.length > 0 ? payments : (authService.isAuthenticated() ? [] : dataRef.current.payments),
        handovers: handovers.length > 0 ? handovers : (authService.isAuthenticated() ? [] : dataRef.current.handovers),
        tickets: tickets.length > 0 ? tickets : (authService.isAuthenticated() ? [] : dataRef.current.tickets),
        renewals: [],
        returnRequests: [],
        paymentNotices: dataRef.current.paymentNotices || {},
      };

      dataRef.current = nextData;
      setData(nextData);
      setIsLiveApi(true);
    } catch (err) {
      console.warn("Backend API not reachable. Using fallback local demo data.", err);
      setIsLiveApi(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServerData();
  }, [loadServerData]);

  // Central command handler (API or Mock fallback)
  const command = useCallback(
    async (type, payload) => {
      if (isLiveApi && authService.isAuthenticated()) {
        try {
          switch (type) {
            case "BOOK": {
              const res = await reservationService.createReservation({
                facilityId: payload.facility_id,
                unitTypeId: payload.unit_type_id,
                startDate: payload.start_date,
                rentalPeriodMonths: payload.rental_period_months,
              });
              await loadServerData();
              return mapReservationFromApi(res);
            }
            case "CANCEL_RESERVATION": {
              await reservationService.cancelReservation(payload.id, payload.reason);
              await loadServerData();
              return true;
            }
            case "RENEW": {
              await renewalService.requestRenewal(payload.contract_id, payload.months);
              await loadServerData();
              return true;
            }
            case "CONFIRM_HANDOVER": {
              await contractService.confirmHandover(payload.id);
              await loadServerData();
              return true;
            }
            case "TICKET": {
              const res = await supportService.createTicket({
                contractId: payload.contract_id,
                issueType: payload.issue_type,
                title: payload.title,
                description: payload.description,
                priority: "NORMAL",
              });
              await loadServerData();
              return mapTicketFromApi(res);
            }
            case "CANCEL_TICKET": {
              await supportService.cancelTicket(payload.id);
              await loadServerData();
              return true;
            }
            case "PROFILE": {
              setData((prev) => ({
                ...prev,
                user: { ...prev.user, full_name: payload.full_name, phone: payload.phone },
              }));
              return true;
            }
            case "PAYMENT_NOTICE": {
              setData((prev) => ({
                ...prev,
                paymentNotices: {
                  ...prev.paymentNotices,
                  [payload.id]: { method: payload.method, sent_at: new Date().toISOString() },
                },
              }));
              return true;
            }
            default:
              break;
          }
        } catch (e) {
          notify(e.message || "Lỗi xử lý yêu cầu phía máy chủ.", true);
          return false;
        }
      }

      // Check if action requires auth when live API is available
      if (isLiveApi && !authService.isAuthenticated()) {
        if (["BOOK", "CANCEL_RESERVATION", "RENEW", "CONFIRM_HANDOVER", "TICKET"].includes(type)) {
          notify("Vui lòng đăng nhập để thực hiện thao tác này.", true);
          setAuthModalOpen(true);
          return false;
        }
      }

      // Fallback local reducer execution
      try {
        const next = reduceCustomer(dataRef.current, { type, payload });
        dataRef.current = next;
        setData(next);
        return true;
      } catch (e) {
        notify(e.message, true);
        return false;
      }
    },
    [isLiveApi, loadServerData, notify],
  );

  const closeModal = useCallback(() => setModal(null), []);
  const closeReset = useCallback(() => setResetOpen(false), []);
  const navigate = (to) => {
    window.location.hash = `/customer/${to}`;
  };
  const openModal = (type, payload) => {
    if (isLiveApi && !authService.isAuthenticated() && ["book", "renew", "cancel", "handover"].includes(type)) {
      notify("Vui lòng đăng nhập tài khoản trước.", true);
      setAuthModalOpen(true);
      return;
    }
    setModal({ type, payload });
  };

  const handleLogout = async () => {
    await authService.logout();
    setAuthUser(null);
    notify("Đã đăng xuất thành công.");
    await loadServerData();
    navigate("overview");
    if (onLogout) onLogout();
  };

  const handleAuthSuccess = (user) => {
    setAuthUser(user);
    notify(`Xin chào, ${user.fullName || user.username}!`);
    loadServerData();
  };

  const [path, search = ""] = route.replace(/^#\/?/, "").split("?");
  const parts = path.split("/");
  const page = parts[0] === "customer" ? parts[1] || "overview" : "overview",
    id = parts[2],
    query = new URLSearchParams(search);

  useEffect(() => {
    document.title = `${NAV.find((n) => n[0] === page)?.[2] || "Tài khoản"} · SafeSpace`;
  }, [page]);

  const value = {
    data,
    user: authUser,
    isAuthenticated: !!authUser,
    isLiveApi,
    loading,
    openAuthModal: () => setAuthModalOpen(true),
    command,
    refreshData: loadServerData,
    notify,
    navigate,
    openModal,
  };

  const pending = data.payments.filter((p) =>
    ["PENDING", "FAILED"].includes(p.status),
  ).length;

  let content;
  switch (page) {
    case "overview":
      content = <Overview />;
      break;
    case "find":
      content = <FindStorage id={id} />;
      break;
    case "reservations":
      content = <Reservations id={id} />;
      break;
    case "units":
      content = <Units id={id} />;
      break;
    case "payments":
      content = <Payments id={id} query={query} />;
      break;
    case "appointments":
      content = <Appointments />;
      break;
    case "support":
      content = <Support id={id} query={query} />;
      break;
    case "profile":
      content = <Profile />;
      break;
    default:
      content = (
        <Empty title="Không tìm thấy trang">
          <LinkButton to="overview">Về tổng quan</LinkButton>
        </Empty>
      );
  }

  const userDisplayName = authUser
    ? authUser.fullName || authUser.username
    : data.user.full_name;

  const initials = userDisplayName
    .split(" ")
    .slice(-2)
    .map((s) => s[0] || "")
    .join("") || "KH";

  return (
    <CustomerContext.Provider value={value}>
      <div className="ss-app">
        <a
          className="ss-skip"
          href="#ss-main"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById("ss-main")?.focus();
          }}
        >
          Chuyển đến nội dung
        </a>

        <header className="ss-topbar">
          <div className="ss-brand-group">
            <button
              className="ss-icon-btn ss-mobile-toggle"
              onClick={() => setMobile(!mobile)}
              aria-label="Mở menu"
              aria-expanded={mobile}
            >
              <Icon name="menu" />
            </button>
            <a className="ss-brand" href="#/customer/overview">
              <span>
                <Icon name="box" size={25} />
              </span>
              Safe<span className="ss-brand-blue">Space</span>
            </a>
          </div>

          <nav className="ss-top-nav" aria-label="Điều hướng nhanh">
            <a href="#/customer/find">Vị trí cơ sở</a>
            <a href="#/customer/find/1">Bảng giá</a>
            <a href="#/customer/support">Hỗ trợ</a>
          </nav>

          <div className="ss-top-right">
            <span className="ss-portal-label">Khu vực khách hàng</span>
            <a
              href="#/customer/payments"
              className="ss-icon-btn ss-bell"
              aria-label={`${pending} khoản cần thanh toán`}
            >
              <Icon name="bell" />
              {pending > 0 && <i />}
            </a>

            {authUser ? (
              <a className="ss-top-user" href="#/customer/profile">
                <span className="ss-avatar">{initials}</span>
                <span>
                  {userDisplayName}
                  <small>Khách hàng</small>
                </span>
              </a>
            ) : (
              <button
                className="ss-auth-btn"
                onClick={() => setAuthModalOpen(true)}
              >
                <Icon name="user" size={16} />
                <span>Đăng nhập / Đăng ký</span>
              </button>
            )}
          </div>
        </header>

        {mobile && (
          <button
            className="ss-nav-scrim"
            aria-label="Đóng menu"
            onClick={() => setMobile(false)}
          />
        )}

        <aside
          className={`ss-sidebar ${mobile ? "open" : ""}`}
          aria-label="Menu khách hàng"
        >
          <span className="ss-nav-label">KHÔNG GIAN CỦA TÔI</span>
          <nav>
            {NAV.map(([key, icon, label]) => (
              <a
                key={key}
                href={`#/customer/${key}`}
                className={page === key ? "active" : ""}
                aria-current={page === key ? "page" : undefined}
              >
                <Icon name={icon} size={19} />
                <span>{label}</span>
                {key === "payments" && pending > 0 && <b>{pending}</b>}
              </a>
            ))}
          </nav>

          <div className="ss-sidebar-bottom">
            <div className="ss-sidebar-help">
              <span className="ss-soft-icon">
                <Icon name="help" />
              </span>
              <h4>Cần một bàn tay?</h4>
              <p>Cơ sở luôn sẵn sàng hỗ trợ bạn.</p>
              <a href="#/customer/support/new">
                Gửi yêu cầu <Icon name="arrow" size={15} />
              </a>
            </div>

            {authUser ? (
              <>
                <a
                  href="#/customer/profile"
                  className={`ss-account-link ${page === "profile" ? "active" : ""}`}
                >
                  <Icon name="user" size={19} /> Tài khoản của tôi
                </a>
                <button className="ss-account-link" onClick={handleLogout}>
                  <Icon name="logout" size={19} /> Đăng xuất
                </button>
              </>
            ) : (
              <button
                className="ss-account-link"
                onClick={() => setAuthModalOpen(true)}
              >
                <Icon name="user" size={19} /> Đăng nhập / Đăng ký
              </button>
            )}
          </div>
        </aside>

        <div className="ss-workspace">
          <div className="ss-breadcrumb">
            <span>SafeSpace</span>
            <Icon name="chevron" size={13} />
            <span>{NAV.find((n) => n[0] === page)?.[2] || "Tài khoản"}</span>
            <span className={`ss-demo-tag ${isLiveApi ? "live" : ""}`}>
              {isLiveApi ? "● KẾT NỐI API .NET" : "BẢN DEMO UI"}
            </span>
          </div>

          <main
            id="ss-main"
            tabIndex={-1}
            key={`${page}/${id || ""}/${search}`}
          >
            {loading && !data.facilities.length ? (
              <div className="ss-loading-overlay">
                <div className="ss-spinner" />
                <p>Đang đồng bộ dữ liệu từ máy chủ...</p>
              </div>
            ) : (
              content
            )}
          </main>

          <footer className="ss-footer">
            <span>© 2026 SafeSpace. Không gian cho cuộc sống của bạn.</span>
            {!isLiveApi && (
              <button onClick={() => setResetOpen(true)}>
                Đặt lại dữ liệu mẫu
              </button>
            )}
            {isLiveApi && (
              <button onClick={loadServerData}>
                Làm mới dữ liệu API
              </button>
            )}
          </footer>

          {storageError && (
            <p className="ss-storage-warning" role="status">
              Trình duyệt không cho lưu dữ liệu. Thao tác hiện tại chỉ được giữ
              trong phiên này.
            </p>
          )}
        </div>

        {modal && <ActionModal modal={modal} onClose={closeModal} />}
        {authModalOpen && (
          <AuthModal
            onClose={() => setAuthModalOpen(false)}
            onAuthSuccess={handleAuthSuccess}
          />
        )}

        {resetOpen && (
          <Modal title="Đặt lại dữ liệu mẫu?" onClose={closeReset}>
            <div className="ss-modal-content">
              <p>
                Các đơn đặt kho, thông báo thanh toán và yêu cầu bạn vừa tạo
                trong bản demo sẽ bị xóa. Dữ liệu ví dụ ban đầu sẽ được khôi
                phục.
              </p>
              <div className="ss-form-actions">
                <Button variant="outline" onClick={closeReset}>
                  Quay lại
                </Button>
                <Button
                  onClick={() => {
                    setData(createDemoData());
                    closeReset();
                    navigate("overview");
                    notify("Đã khôi phục dữ liệu mẫu.");
                  }}
                >
                  Đặt lại demo
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {toast && (
          <div
            className={`ss-toast ${toast.error ? "error" : ""}`}
            role={toast.error ? "alert" : "status"}
          >
            <Icon name={toast.error ? "alert" : "check"} />
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} aria-label="Đóng thông báo">
              <Icon name="close" size={17} />
            </button>
          </div>
        )}
      </div>
    </CustomerContext.Provider>
  );
}
