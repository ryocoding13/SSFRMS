import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { customerNotifications } from "../../features/customer/notifications/customerNotifications.js";
import { api } from "../../shared/api/customerApi.js";
import { ApiError, setToken } from "../../shared/api/httpClient.js";
import { isUnsupported, localAccessCode, normAccess, normCancelPreview, normPayos, normScan } from "../../features/customer/access/accessApi.js";
import { bankAccount } from "../config/payment.js";
import { vietQrPayload } from "../../shared/utils/vietqr.js";
import { composeData, emptyOverlay, mapCatalog, reservationCode, reservationsToExpire, ticketCode, usernameFromEmail } from "../../shared/api/apiMappers.js";
import { API_URL, USE_API } from "../config/api.js";
import { paymentTimeoutSeconds } from "../config/media.js";
import { createEmptyData, createSeedData } from "../data/appSeed.js";
import { RENTAL_PLANS, offerByKey } from "../../shared/utils/catalog.js";
import { isEmail, localDate, shortCode, timeoutLabel } from "../../shared/utils/format.js";
import { TICKET_TOPICS, ticketTitle } from "../../shared/utils/status.js";
import { isAdminRoles, isCustomerRoles, isOpsRoles, isBusinessRoles, rolesFromToken } from "../../shared/utils/roles.js";
import { OPS_ACCOUNTS, OPS_PASSWORD } from "../../features/facility-operations/data/facilityOperationsSeed.js";
import { cancelPreviewOf, reduce, sweepExpired, validateRegister } from "./appReducer.js";
import { pendingRenewal, pendingReturn } from "./appSelectors.js";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export const STORAGE_KEY = "safespace.customer.v5";
const SESSION_KEY = "safespace.customer.session";
const overlayKey = (userId) => `safespace.customer.overlay.${userId}`;
const VERSION = 5;

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const writeJson = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const notify = useCallback((message, tone = "success") => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const dismissToast = useCallback(() => setToast(null), []);
  return { toast, notify, dismissToast };
}

export function AppProvider({ children }) {
  return USE_API ? <ApiProvider>{children}</ApiProvider> : <LocalProvider>{children}</LocalProvider>;
}

// =====================================================================
// Chế độ dữ liệu trong trình duyệt (VITE_USE_API không bật)
// =====================================================================
function readLocalStore() {
  const saved = readJson(STORAGE_KEY);
  if (saved?.version === VERSION && saved.data?.user && Array.isArray(saved.data.reservations)) {
    return { authed: Boolean(saved.authed), data: saved.data, opsUser: saved.authed ? saved.opsUser || null : null };
  }
  return { authed: false, data: createSeedData(), opsUser: null };
}

function LocalProvider({ children }) {
  const [store, setStore] = useState(readLocalStore);
  const ref = useRef(store);
  ref.current = store;
  const [storageError, setStorageError] = useState(false);
  const { toast, notify, dismissToast } = useToast();

  const commit = useCallback((next) => {
    ref.current = next;
    setStore(next);
  }, []);

  useEffect(() => {
    setStorageError(!writeJson(STORAGE_KEY, { version: VERSION, ...store }));
  }, [store]);

  // Tự huỷ đơn chờ chuyển khoản quá hạn giữ chỗ, kể cả khi người dùng đóng tab rồi quay lại
  useEffect(() => {
    const sweep = () => {
      const next = sweepExpired(ref.current.data, new Date(), paymentTimeoutSeconds);
      if (next !== ref.current.data) commit({ ...ref.current, data: next });
    };
    sweep();
    const id = setInterval(sweep, 5000);
    return () => clearInterval(id);
  }, [commit]);

  const dispatch = useCallback(
    async (type, payload) => {
      const out = reduce(ref.current.data, { type, payload }, { now: new Date(), timeoutSeconds: paymentTimeoutSeconds });
      if (out.state !== ref.current.data) commit({ ...ref.current, data: out.state });
      return out.error ? { ok: false, error: out.error.message, code: out.error.code } : { ok: true, ...out.result };
    },
    [commit],
  );

  const login = useCallback(
    async ({ identifier, password }) => {
      const id = String(identifier || "").trim().toLowerCase();
      if (!id || !password) return { ok: false, error: "Vui lòng nhập tên đăng nhập hoặc email và mật khẩu." };
      const { user } = ref.current.data;
      const username = user.email.split("@")[0].toLowerCase();
      if ((id === user.email.toLowerCase() || id === username) && password === user.password) {
        commit({ ...ref.current, authed: true, opsUser: null });
        return { ok: true, roles: ["CUSTOMER"] };
      }
      // Tài khoản nhân viên / quản lý cơ sở (khu vận hành)
      const ops = OPS_ACCOUNTS.find((a) => id === a.email || id === a.username);
      if (ops && password === OPS_PASSWORD) {
        commit({ ...ref.current, authed: true, opsUser: ops });
        return { ok: true, roles: [ops.role] };
      }
      return { ok: false, error: "Tên đăng nhập / email hoặc mật khẩu chưa đúng." };
    },
    [commit],
  );

  const register = useCallback(
    async (form) => {
      const errors = validateRegister(form);
      if (Object.keys(errors).length) return { ok: false, errors };
      const { user } = ref.current.data;
      if (isEmail(form.email) && form.email.trim().toLowerCase() === user.email.toLowerCase())
        return { ok: false, errors: { email: "Email này đã có tài khoản. Vui lòng đăng nhập." } };
      const next = {
        user_id: Date.now(),
        full_name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.replace(/[\s.-]/g, ""),
        password: form.password,
      };
      commit({ authed: true, data: createEmptyData(next) });
      return { ok: true };
    },
    [commit],
  );

  const logout = useCallback(async () => commit({ ...ref.current, authed: false, opsUser: null }), [commit]);

  // Thanh toán QR / QR mở cửa khi chạy không có backend: mô phỏng phía trình duyệt.
  // Mã QR là VietQR tới tài khoản cấu hình trong config/payment.js; sau vài giây tự ghi nhận "đã thanh toán"
  // giống webhook PayOS để đi hết luồng C04 → C05 và C11q → C11b.
  const simulated = useRef(new Set());
  const services = useMemo(
    () => ({
      async startPayos({ kind, item }) {
        const content = kind === "payment" ? item.ref.replaceAll("-", "") : item.reservation_id.replaceAll("-", "");
        const key = kind === "payment" ? `p:${item.ref}` : `r:${item.reservation_id}`;
        if (!simulated.current.has(key)) {
          simulated.current.add(key);
          setTimeout(() => {
            simulated.current.delete(key);
            const out = reduce(ref.current.data, { type: "PAYOS_PAID", payload: kind === "payment" ? { ref: item.ref } : { reservation_id: item.reservation_id } }, { now: new Date(), timeoutSeconds: paymentTimeoutSeconds });
            if (!out.error && out.state !== ref.current.data) commit({ ...ref.current, data: out.state });
          }, 8000);
        }
        return {
          ok: true,
          checkout: { order_code: content, amount: item.amount ?? item.initial_total, qr: vietQrPayload({ bin: bankAccount.bin, accountNo: bankAccount.accountNo, amount: item.amount ?? item.initial_total, content }), url: null, expires_at: null, description: content, paid: false },
        };
      },
      async checkPaid({ kind, item }) {
        const d = ref.current.data;
        if (kind === "payment") return { ok: true, paid: d.ledger.find((l) => l.ref === item.ref)?.status === "RECONCILED" };
        const r = d.reservations.find((x) => x.reservation_id === item.reservation_id);
        return { ok: true, paid: Boolean(r && ["CONFIRMED", "CHECKED_IN"].includes(r.status)), cancelled: r?.status === "CANCELLED" };
      },
      async accessQr(contract) {
        if (ref.current.data.returns.some(r => r.contract_id === contract.contract_id && !["CANCELLED", "REJECTED"].includes(r.status))) return { ok: false, error: "QR đã hết hiệu lực do đã gửi trả kho." };
        if (contract.access_issued === false || ["DRAFT", "ENDED"].includes(contract.status)) return { ok: false, error: "QR mở cửa chỉ được cấp khi hợp đồng đã được xác nhận." };
        return { ok: true, access: localAccessCode(contract) };
      },
      async scan(code, unit) {
        const d = ref.current.data;
        const clean = String(code || "").replace(/\s/g, "");
        const c = d.contracts.find((x) => {
          const a = localAccessCode(x);
          return (!unit || x.unit_number === unit) && (a.code === code || a.backup.replace(/\s/g, "") === clean);
        });
        const now = new Date().toISOString();
        if (!c) return { ok: true, scan: { result: "DENIED", unit: null, customer: null, contract: null, at: now, reason: "Mã không đúng. Kiểm tra lại mã trên ứng dụng hoặc mã dự phòng." } };
        if (d.returns.some(r => r.contract_id === c.contract_id && !["CANCELLED", "REJECTED"].includes(r.status))) return { ok: true, scan: { result: "DENIED", at: now, reason: "QR đã hết hiệu lực do đã gửi trả kho." } };
        if (c.status === "ENDED") return { ok: true, scan: { result: "DENIED", unit: c.unit_number, customer: d.user.full_name, contract: c.contract_id, at: now, reason: "Mã đã hết hiệu lực — hợp đồng đã trả kho." } };
        if (c.access_issued === false || c.start_date > localDate(new Date())) return { ok: true, scan: { result: "DENIED", unit: c.unit_number, customer: d.user.full_name, contract: c.contract_id, at: now, reason: "Chưa đến ngày bắt đầu hợp đồng hoặc mã chưa được cấp." } };
        if (c.end_date <= localDate(new Date())) return { ok: true, scan: { result: "DENIED", unit: c.unit_number, customer: d.user.full_name, contract: c.contract_id, at: now, reason: "Hợp đồng đã quá hạn. Vui lòng gia hạn hoặc liên hệ cơ sở." } };
        return { ok: true, scan: { result: "OPEN", unit: c.unit_number, customer: d.user.full_name, contract: c.contract_id, at: now, reason: null } };
      },
      async cancelPreview(r) {
        return { ok: true, preview: r.status === "CONFIRMED" ? cancelPreviewOf(r) : { paid: 0, fee: 0, refund: 0, policy: null } };
      },
    }),
    [commit],
  );

  const value = useMemo(
    () => ({
      mode: "local",
      ready: true,
      loadError: null,
      retry: () => {},
      authed: store.authed,
      data: store.data,
      user: store.authed ? store.opsUser || store.data.user : null,
      dispatch,
      login,
      register,
      logout,
      checkAvailability: null,
      getFacilityUnits: null,
      onApiError: () => {},
      roles: store.authed ? (store.opsUser ? [store.opsUser.role] : ["CUSTOMER"]) : [],
      isAdmin: false,
      supports: { changePassword: true, forgotPassword: true },
      services,
      toast,
      notify,
      dismissToast,
      storageError,
      timeoutSeconds: paymentTimeoutSeconds,
    }),
    [store, dispatch, login, register, logout, services, toast, notify, dismissToast, storageError],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// =====================================================================
// Chế độ API (VITE_USE_API=true)
// Hồ sơ, mật khẩu, hỗ trợ và trả kho gọi API thật.
// Thông báo phía khách và dữ liệu phụ dùng overlay riêng theo từng tài khoản.
// =====================================================================
function readSession() {
  const s = readJson(SESSION_KEY);
  if (!s?.token || !s.user) return null;
  if (s.expiresAt && new Date(s.expiresAt).getTime() <= Date.now()) return null;
  return { ...s, roles: s.roles || rolesFromToken(s.token) };
}
const EMPTY_REMOTE = { reservations: [], reservationDetails: {}, contracts: [], tickets: [] };

const fail = (error, code) => ({ ok: false, error, code });
const readOverlay = (userId) => ({ ...emptyOverlay(), ...(readJson(overlayKey(userId)) || {}) });

function ApiProvider({ children }) {
  const [session, setSession] = useState(() => {
    const s = readSession();
    setToken(s?.token);
    return s;
  });
  const [catalog, setCatalog] = useState(null);
  const [remote, setRemote] = useState(null);
  const [overlay, setOverlay] = useState(() => (session ? readOverlay(session.user.userId) : emptyOverlay()));
  const [loadError, setLoadError] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [storageError, setStorageError] = useState(false);
  const { toast, notify, dismissToast } = useToast();

  const refs = useRef({});
  refs.current.session = session;
  refs.current.overlay = overlay;
  refs.current.remote = remote;
  const cancelling = useRef(new Set());

  const data = useMemo(
    () => composeData({ catalog, remote, overlay, session, timeoutSeconds: paymentTimeoutSeconds, now }),
    [catalog, remote, overlay, session, now],
  );
  refs.current.data = data;

  const updateOverlay = useCallback((fn) => {
    const next = fn(refs.current.overlay);
    refs.current.overlay = next;
    const s = refs.current.session;
    if (s) setStorageError(!writeJson(overlayKey(s.user.userId), next));
    setOverlay(next);
  }, []);

  const endSession = useCallback(
    (reason) => {
      setToken(null);
      writeJson(SESSION_KEY, null);
      refs.current.session = null;
      refs.current.remote = null;
      setSession(null);
      setRemote(null);
      setOverlay(emptyOverlay());
      if (reason === "expired") notify("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "error");
    },
    [notify],
  );

  const loadCatalog = useCallback(async () => {
    const [facilities, unitTypes, rates] = await Promise.all([api.facilities(), api.unitTypes(), api.rates()]);
    setCatalog(mapCatalog({ facilities, unitTypes, rates }));
  }, []);

  const loadCustomer = useCallback(async () => {
    const activeSession = refs.current.session;
    const [reservations, contracts, tickets] = await Promise.all([api.reservations(), api.contracts(), api.tickets()]);
    const [reservationDetails, contractDetails, ticketDetails] = await Promise.all([
      Promise.all(reservations.filter((r) => r.status !== "CANCELLED").map((r) => api.reservation(r.reservationId).catch(() => null))),
      Promise.all(contracts.map((c) => api.contract(c.contractId).catch(() => ({ ...c, payments: [], renewals: [] })))),
      Promise.all(tickets.map((t) => api.ticket(t.ticketId).catch(e => {
        if (e.status === 401) throw e;
        const previous = refs.current.session?.token === activeSession?.token
          ? refs.current.remote?.tickets.find(x => x.ticketId === t.ticketId) : null;
        return { ...previous, ...t, responsesError: true };
      }))),
    ]);
    if (!activeSession || refs.current.session?.token !== activeSession.token) return;
    const next = {
      reservations,
      reservationDetails: Object.fromEntries(reservationDetails.filter(Boolean).map((d) => [d.reservationId, d])),
      contracts: contractDetails,
      tickets: ticketDetails,
    };
    const events = customerNotifications({ contracts: contractDetails, tickets: ticketDetails, reservations });
    updateOverlay(o => {
      const ids = new Set(o.notifications.map(n => n.id));
      const incoming = events.filter(n => !ids.has(n.id));
      return incoming.length ? { ...o, notifications: [...incoming, ...o.notifications] } : o;
    });
    refs.current.remote = next;
    setRemote(next);
    setNow(new Date());
  }, [updateOverlay]);

  useEffect(() => {
    if (!session || !isCustomerRoles(session.roles || [])) return undefined;
    const refresh = () => { if (!document.hidden) loadCustomer().catch(() => {}); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [session, loadCustomer]);

  const handleError = useCallback(
    (e) => {
      if (e instanceof ApiError && e.status === 401 && refs.current.session) endSession("expired");
      return fail(e?.message || "Đã có lỗi xảy ra.", e?.status);
    },
    [endSession],
  );

  // Lỗi từ các màn tự gọi API (khu quản trị): 401 → kết thúc phiên
  const onApiError = useCallback(
    (e) => {
      if (e instanceof ApiError && e.status === 401 && refs.current.session) endSession("expired");
    },
    [endSession],
  );

  const applyProfile = useCallback((profile, activeSession) => {
    if (!activeSession || refs.current.session?.token !== activeSession.token) return false;
    if (String(profile.userId) !== String(activeSession.user.userId)) return false;
    const next = { ...refs.current.session, user: { ...refs.current.session.user, ...profile } };
    refs.current.session = next;
    setStorageError(!writeJson(SESSION_KEY, next));
    setSession(next);
    updateOverlay(o => ({ ...o, name: null }));
    return true;
  }, [updateOverlay]);

  const loadProfile = useCallback(async () => {
    const current = refs.current.session;
    if (!current) return;
    const profile = await api.getProfile();
    applyProfile(profile, current);
  }, [applyProfile]);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      await loadCatalog();
      if (refs.current.session) {
        await loadProfile();
        if (isAdminRoles(refs.current.session.roles) || isOpsRoles(refs.current.session.roles) || isBusinessRoles(refs.current.session.roles)) setRemote(EMPTY_REMOTE);
        else await loadCustomer();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) endSession("expired");
      else setLoadError(e?.message || "Không tải được dữ liệu.");
    }
  }, [loadCatalog, loadCustomer, loadProfile, endSession]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Đồng hồ + huỷ trên máy chủ các đơn đã hết giờ giữ chỗ
  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);
      if (!refs.current.session) return;
      const due = reservationsToExpire({ remote: refs.current.remote, overlay: refs.current.overlay, timeoutSeconds: paymentTimeoutSeconds, now: current });
      for (const r of due) {
        if (cancelling.current.has(r.reservationId)) continue;
        cancelling.current.add(r.reservationId);
        const seconds = refs.current.overlay.holds[r.reservationId] ? paymentTimeoutSeconds : 24 * 3600;
        api
          .cancelReservation(r.reservationId, `Quá ${timeoutLabel(seconds)} chưa thanh toán`)
          .catch(() => {})
          .then(() => loadCustomer().catch(() => {}));
      }
    };
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, [loadCustomer]);

  const startSession = useCallback(
    async (res, extra = {}) => {
      const next = { token: res.token, expiresAt: res.expiresAt, user: res.user, roles: rolesFromToken(res.token) };
      setToken(next.token);
      writeJson(SESSION_KEY, next);
      refs.current.session = next;
      const saved = { ...readOverlay(res.user.userId), ...extra };
      writeJson(overlayKey(res.user.userId), saved);
      refs.current.overlay = saved;
      setOverlay(saved);
      setSession(next);
      await loadProfile();
      if (isAdminRoles(next.roles) || isOpsRoles(next.roles) || isBusinessRoles(next.roles)) {
        refs.current.remote = EMPTY_REMOTE;
        setRemote(EMPTY_REMOTE);
      } else await loadCustomer();
    },
    [loadCustomer, loadProfile],
  );

  const login = useCallback(
    async ({ identifier, password }) => {
      const id = String(identifier || "").trim();
      if (!id || !password) return fail("Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.");
      try {
        const res = await api.login(id.includes("@") ? id.toLowerCase() : id, password);
        const roles = rolesFromToken(res.token);
        if (!isAdminRoles(roles) && !isCustomerRoles(roles) && !isOpsRoles(roles) && !isBusinessRoles(roles)) {
          return fail("Tài khoản này chưa được gán vai trò trên giao diện SafeSpace. Vui lòng liên hệ quản trị viên.");
        }
        await startSession(res);
        return { ok: true, roles };
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return fail("Tên đăng nhập / email hoặc mật khẩu chưa đúng.");
        return fail(e.message);
      }
    },
    [startSession],
  );

  const register = useCallback(
    async (form) => {
      const errors = validateRegister(form);
      if (Object.keys(errors).length) return { ok: false, errors };
      const email = form.email.trim().toLowerCase();
      const username = usernameFromEmail(email);
      const phone = form.phone.replace(/[\s.-]/g, "");
      try {
        await api.register({ username, email, password: form.password, fullName: form.name.trim(), phone });
      } catch (e) {
        if (/tồn tại/i.test(e.message)) return { ok: false, errors: { email: "Email này đã có tài khoản. Vui lòng đăng nhập." } };
        return { ok: false, errors: { form: e.message } };
      }
      try {
        const res = await api.login(username, form.password);
        await startSession(res, { phone });
        return { ok: true };
      } catch (e) {
        return { ok: false, errors: { form: `Đã tạo tài khoản nhưng chưa đăng nhập được: ${e.message}` } };
      }
    },
    [startSession],
  );

  const logout = useCallback(async () => {
    api.logout().catch(() => {});
    endSession();
  }, [endSession]);

  // Thêm thông báo + hoạt động vào phần lưu cục bộ
  const remember = useCallback(
    (title, detail, to, activity, tone = "amber") => {
      const at = new Date();
      updateOverlay((o) => ({
        ...o,
        notifications: [{ id: `N-${at.getTime()}`, title, detail, to, created_at: at.toISOString(), read: false }, ...o.notifications].slice(0, 50),
        activities: activity ? [{ id: `A-${at.getTime()}`, text: activity, tone, at: localDate(at) }, ...o.activities].slice(0, 30) : o.activities,
      }));
    },
    [updateOverlay],
  );

  // Chạy nghiệp vụ cục bộ trên dữ liệu đã ghép rồi giữ lại phần thuộc overlay
  const runLocal = useCallback(
    (type, payload) => {
      const prev = refs.current.data;
      const out = reduce(prev, { type, payload }, { now: new Date(), timeoutSeconds: paymentTimeoutSeconds });
      if (out.error) return { error: out.error };
      const next = out.state;
      updateOverlay((o) => ({
        ...o,
        returns: next.returns,
        notifications: next.notifications,
        activities: next.activities,
        appointments: [...next.appointments.filter((a) => !prev.appointments.some((x) => x.appointment_id === a.appointment_id)), ...o.appointments],
        name: next.user?.full_name !== prev.user?.full_name ? next.user.full_name : o.name,
      }));
      return { result: out.result };
    },
    [updateOverlay],
  );

  const dispatch = useCallback(
    async (type, p = {}) => {
      const d = refs.current.data;
      try {
        switch (type) {
          case "CREATE_RESERVATION": {
            const facility = d.facilities.find((f) => f.facility_id === Number(p.facility_id));
            const offer = offerByKey(facility, p.offer_key);
            if (!facility || !offer?.unit_type_id) return fail("Cơ sở này chưa có loại kho bạn chọn.");
            const months = Number(p.months);
            if (!RENTAL_PLANS.includes(months)) return fail("Gói thuê chỉ gồm 1, 3 hoặc 6 tháng.");
            if (!p.start_date || p.start_date < localDate(new Date())) return fail("Ngày bắt đầu không được ở quá khứ.");
            const dto = await api.createReservation({ facilityId: facility.facility_id, unitTypeId: offer.unit_type_id, startDate: p.start_date, rentalPeriodMonths: months });
            updateOverlay((o) => ({ ...o, holds: { ...o.holds, [dto.reservationId]: Date.now() } }));
            await loadCustomer();
            return { ok: true, reservation_id: reservationCode(dto) };
          }
          case "PAY_AT_FACILITY":
          case "CONFIRM_TRANSFER": {
            const r = d.reservations.find((x) => x.reservation_id === p.reservation_id);
            if (!r) return fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
            if (r.status === "CANCELLED") return fail("Đơn đặt chỗ đã hết thời gian giữ chỗ.", "EXPIRED");
            if (r.status !== "PENDING_PAYMENT") return { ok: true, reservation_id: r.reservation_id };
            const expired = async (e) => {
              if (e instanceof ApiError && e.data?.code === "EXPIRED") {
                await loadCustomer().catch(() => {});
                return fail(e.message, "EXPIRED");
              }
              return null;
            };
            try { await api.payAtFacility(r.api_id); }
            catch (e) { const exp = await expired(e); if (exp) return exp; throw e; }
            const done = true;
            updateOverlay((o) => ({
              ...o,
              atFacility: { ...o.atFacility, [r.api_id]: Date.now() },
              transfers: done ? o.transfers : { ...o.transfers, [r.api_id]: Date.now() },
            }));
            await loadCustomer().catch(() => {});
            remember("Đã giữ chỗ cho bạn", `${shortCode(r.reservation_id)} · Thanh toán tại cửa hàng khi nhận kho.`, `reservations/${r.reservation_id}`, `Đơn ${shortCode(r.reservation_id)} chờ thanh toán tại cửa hàng`);
            return { ok: true, reservation_id: r.reservation_id };
          }
          case "EXPIRE_RESERVATION": {
            const r = d.reservations.find((x) => x.reservation_id === p.reservation_id);
            if (!r) return fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
            if (!r.transfer_confirmed_at && ["PENDING_PAYMENT", "CANCELLED"].includes(r.status)) {
              updateOverlay((o) => ({ ...o, expired: { ...o.expired, [r.api_id]: Date.now() } }));
              if (!cancelling.current.has(r.api_id)) {
                cancelling.current.add(r.api_id);
                api
                  .cancelReservation(r.api_id, `Quá ${timeoutLabel(r.timeout_seconds || paymentTimeoutSeconds)} chưa thanh toán`)
                  .catch(() => {})
                  .then(() => loadCustomer().catch(() => {}));
              }
            }
            return { ok: true, status: "CANCELLED" };
          }
          case "CANCEL_RESERVATION": {
            const r = d.reservations.find((x) => x.reservation_id === p.reservation_id);
            if (!r) return fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
            await api.cancelReservation(r.api_id, p.reason || "Khách hàng huỷ đặt chỗ");
            await loadCustomer();
            return { ok: true, reservation_id: r.reservation_id };
          }
          case "REQUEST_RENEWAL": {
            const c = d.contracts.find((x) => x.contract_id === p.contract_id);
            if (!c) return fail("Không tìm thấy hợp đồng.");
            const months = Number(p.months);
            if (!RENTAL_PLANS.includes(months)) return fail("Gói gia hạn chỉ gồm 1, 3 hoặc 6 tháng.");
            if (pendingRenewal(d, c.contract_id)) return fail("Đã có yêu cầu gia hạn đang chờ cơ sở duyệt.");
            if (pendingReturn(d, c.contract_id)) return fail("Hợp đồng đang có yêu cầu trả kho.");
            const dto = await api.requestRenewal(c.api_id, months);
            remember("Đã gửi yêu cầu gia hạn", `Kho ${c.unit_number} · chờ cơ sở duyệt.`, `units/${c.contract_id}`, `Yêu cầu gia hạn ${c.unit_number} đã gửi — chờ duyệt`);
            await loadCustomer();
            return { ok: true, renewal_id: `GH-${String(dto.renewalId).padStart(4, "0")}` };
          }
          case "CREATE_TICKET": {
            const topic = TICKET_TOPICS[p.topic];
            if (!topic) return fail("Vui lòng chọn chủ đề.");
            const title = ticketTitle(p);
            if (p.topic === "OTHER" && (!title || title.length > 100)) return fail("Chủ đề của bạn phải có từ 1 đến 100 ký tự.");
            const description = String(p.description || "").trim();
            if (!description) return fail("Vui lòng mô tả vấn đề.");
            if (description.length > 1000) return fail("Mô tả không quá 1000 ký tự.");
            const c = d.contracts.find((x) => x.contract_id === p.contract_id);
            if (!c) return fail("Cần có hợp đồng thuê kho để gửi yêu cầu hỗ trợ. Vui lòng chọn kho liên quan.");
            const dto = await api.createTicket({
              contractId: c.api_id,
              unitId: null,
              issueType: topic.issueType || p.topic,
              title,
              description,
              priority: ["ACCESS", "LOCK"].includes(p.topic) ? "HIGH" : "NORMAL",
            });
            const names = (p.attachments || []).slice(0, 3);
            if (names.length) updateOverlay((o) => ({ ...o, attachments: { ...o.attachments, [dto.ticketId]: names } }));
            remember("Đã gửi yêu cầu hỗ trợ", `${ticketCode(dto.ticketId)} · ${title}`, "support", `Yêu cầu hỗ trợ ${ticketCode(dto.ticketId)} đã được gửi`, "blue");
            await loadCustomer();
            return { ok: true, ticket_id: ticketCode(dto.ticketId) };
          }
          case "CANCEL_TICKET": {
            const t = d.tickets.find((x) => x.ticket_id === p.ticket_id);
            if (!t) return fail("Không tìm thấy yêu cầu.", "NOT_FOUND");
            await api.cancelTicket(t.api_id);
            await loadCustomer();
            return { ok: true, ticket_id: t.ticket_id };
          }
          case "CONFIRM_HANDOVER": {
            const c = d.contracts.find((x) => x.contract_id === p.contract_id);
            if (!c?.handover_api_id) return fail("Không tìm thấy biên bản bàn giao.");
            await api.confirmHandover(c.handover_api_id);
            await loadCustomer();
            return { ok: true };
          }
          case "CHANGE_PASSWORD": {
            try {
              await api.changePassword({ currentPassword: p.current, newPassword: p.next });
            } catch (e) {
              if (e instanceof ApiError && (e.data?.code === "BAD_PASSWORD" || (e.status === 400 && /mật khẩu hiện tại/i.test(e.message)))) return fail(e.message, "BAD_PASSWORD");
              throw e;
            }
            return { ok: true };
          }
          case "UPDATE_NAME": {
            const current = refs.current.session;
            if (!current) return fail("Vui lòng đăng nhập lại.");
            const profile = await api.updateProfile({ fullName: String(p.name || "").trim() });
            if (!applyProfile(profile, current)) return fail("Phiên đăng nhập đã thay đổi. Vui lòng thử lại.");
            return { ok: true, name: profile.fullName };
          }
          case "REQUEST_RETURN": {
            const c = d.contracts.find((x) => x.contract_id === p.contract_id);
            if (!c) return fail("Không tìm thấy hợp đồng.");
            if (pendingRenewal(d, c.contract_id)) return fail("Hợp đồng đang có yêu cầu gia hạn.");
            if (p.date < localDate(new Date())) return fail("Ngày hẹn không được ở quá khứ.");
            await api.requestMoveOut(c.api_id, { date: p.date, slot: p.slot, note: p.notes });
            updateOverlay(o => ({ ...o, returns: [{ return_id: `TK-${c.api_id}`, contract_id: c.contract_id, date: p.date, slot: p.slot, notes: p.notes, status: "PENDING" }, ...o.returns.filter(r => r.contract_id !== c.contract_id)] }));
            remember("Đã đặt lịch trả kho", `Kho ${c.unit_number} · ${p.date} (${p.slot || "giờ hành chính"})`, `units/${c.contract_id}`, `Lịch trả kho ${c.unit_number} đã được ghi nhận`);
            await loadCustomer();
            return { ok: true, return_id: `TK-${c.api_id}` };
          }
          case "MARK_READ": {
            const out = runLocal(type, p);
            return out.error ? fail(out.error.message, out.error.code) : { ok: true, ...out.result };
          }
          // C11fc: backend chưa có API chọn trả phí tại quầy → ghi trong trình duyệt; nhân viên thu ở S09f
          case "CHOOSE_RENEWAL_AT_COUNTER": {
            const renewal = d.renewals.find(x => x.renewal_id === p.renewal_id);
            if (!renewal || renewal.status !== "APPROVED") return fail("Yêu cầu chưa được duyệt hoặc đã thanh toán.");
            await api.chooseRenewalCounter(renewal.api_id);
            await loadCustomer();
            return { ok: true };
          }
          case "CHOOSE_FEE_AT_COUNTER": {
            const rows = d.ledger.filter((l) => p.refs.includes(l.ref) && l.fee && ["UNPAID", "AT_COUNTER"].includes(l.status));
            if (!rows.length) return fail("Không còn khoản phí cần thanh toán.", "NOT_FOUND");
            updateOverlay((o) => ({ ...o, feesAtCounter: { ...(o.feesAtCounter || {}), ...Object.fromEntries(rows.map((l) => [l.api_id, Date.now()])) } }));
            return { ok: true, refs: rows.map((l) => l.ref) };
          }
          default:
            return fail(`Thao tác không được hỗ trợ: ${type}`, "UNKNOWN");
        }
      } catch (e) {
        return handleError(e);
      }
    },
    [loadCustomer, updateOverlay, remember, runLocal, handleError, applyProfile],
  );

  const checkAvailability = useCallback(async ({ facility_id, offer, start_date, months }) => {
    if (!offer?.unit_type_id) return null;
    try {
      const r = await api.availability({ facilityId: facility_id, unitTypeId: offer.unit_type_id, startDate: start_date, rentalPeriodMonths: months });
      return { available: Boolean(r.isAvailable), count: r.availableUnitCount };
    } catch {
      return null;
    }
  }, []);

  const getFacilityUnits = useCallback(async (facilityId) => {
    try {
      return await api.facilityUnits(facilityId);
    } catch {
      return null;
    }
  }, []);


  // Màn mới gọi API trực tiếp: PayOS (C04, C11q), QR mở cửa (C07q), máy quét (C07r), xem trước hoàn tiền (C14a).
  // Backend chưa có endpoint (404/405) → trả { unsupported: true } để màn hiện thông báo phù hợp, không báo lỗi.
  const services = useMemo(() => {
    const guard = async (fn) => {
      try {
        return await fn();
      } catch (e) {
        if (isUnsupported(e)) return { ok: false, unsupported: true };
        return handleError(e);
      }
    };
    return {
      startPayos: ({ kind, item }) =>
        guard(async () => {
          const dto = kind === "payment" ? await api.paymentPayos(item.api_id) : await api.reservationPayos(item.api_id);
          const checkout = normPayos(dto);
          if (!checkout) return fail("Máy chủ chưa trả mã QR thanh toán. Vui lòng thử lại.");
          if (checkout.paid) await loadCustomer().catch(() => {});
          return { ok: true, checkout };
        }),
      checkPaid: ({ kind, item }) =>
        guard(async () => {
          if (kind === "payment") {
            const p = await api.payment(item.api_id);
            const paid = p?.status === "PAID";
            if (paid) await loadCustomer().catch(() => {});
            return { ok: true, paid };
          }
          const r = await api.reservation(item.api_id);
          const status = String(r?.status || "");
          const paid = ["PAID", "CONFIRMED", "UNIT_ASSIGNED", "CHECKED_IN", "COMPLETED"].includes(status);
          const cancelled = ["CANCELLED", "EXPIRED"].includes(status);
          if (paid || cancelled) await loadCustomer().catch(() => {});
          return { ok: true, paid, cancelled };
        }),
      accessQr: (contract) =>
        guard(async () => {
          if (refs.current.data.returns?.some(r => r.contract_id === contract.contract_id && !["CANCELLED", "REJECTED"].includes(r.status))) return { ok: false, error: "QR đã hết hiệu lực do đã gửi trả kho." };
          const access = normAccess(await api.accessQr(contract.api_id));
          return access ? { ok: true, access } : fail("Máy chủ chưa trả mã mở cửa.");
        }),
      scan: (code, unit) => guard(async () => ({ ok: true, scan: normScan(await api.scanAccess({ code: String(code || "").trim(), unitNumber: unit || null })) })),
      cancelPreview: (r) =>
        guard(async () => {
          const preview = normCancelPreview(await api.cancelPreview(r.api_id));
          return preview ? { ok: true, preview } : { ok: false, unsupported: true };
        }),
    };
  }, [handleError, loadCustomer]);

  const ready = Boolean(catalog) && (!session || Boolean(remote));

  const value = useMemo(
    () => ({
      mode: "api",
      apiUrl: API_URL,
      ready,
      loadError,
      retry: loadAll,
      authed: Boolean(session),
      data,
      user: session ? data.user : null,
      dispatch,
      login,
      register,
      logout,
      checkAvailability,
      getFacilityUnits,
      onApiError,
      roles: session?.roles || [],
      isAdmin: isAdminRoles(session?.roles),
      session,
      supports: { changePassword: true, forgotPassword: false },
      services,
      toast,
      notify,
      dismissToast,
      storageError,
      timeoutSeconds: paymentTimeoutSeconds,
    }),
    [ready, loadError, loadAll, session, data, dispatch, login, register, logout, checkAvailability, getFacilityUnits, onApiError, services, toast, notify, dismissToast, storageError],
  );


  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
