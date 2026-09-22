import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/endpoints";
import { ApiError, setToken } from "../api/http";
import { composeData, emptyOverlay, mapCatalog, reservationCode, reservationsToExpire, ticketCode, usernameFromEmail } from "../api/mappers";
import { API_URL, USE_API } from "../config/api";
import { paymentTimeoutSeconds } from "../config/media";
import { createEmptyData, createSeedData } from "../data/seed";
import { RENTAL_PLANS, offerByKey } from "../lib/catalog";
import { isEmail, localDate, shortCode, timeoutLabel } from "../lib/format";
import { TICKET_TOPICS } from "../lib/status";
import { isAdminRoles, isCustomerRoles, rolesFromToken } from "../lib/roles";
import { reduce, sweepExpired, validateRegister } from "./reducer";
import { pendingRenewal, pendingReturn } from "./selectors";

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
    return { authed: Boolean(saved.authed), data: saved.data };
  }
  return { authed: false, data: createSeedData() };
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
        commit({ ...ref.current, authed: true });
        return { ok: true };
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

  const logout = useCallback(async () => commit({ ...ref.current, authed: false }), [commit]);

  const value = useMemo(
    () => ({
      mode: "local",
      ready: true,
      loadError: null,
      retry: () => {},
      authed: store.authed,
      data: store.data,
      user: store.authed ? store.data.user : null,
      dispatch,
      login,
      register,
      logout,
      checkAvailability: null,
      onApiError: () => {},
      roles: store.authed ? ["CUSTOMER"] : [],
      isAdmin: false,
      supports: { changePassword: true, forgotPassword: true },
      toast,
      notify,
      dismissToast,
      storageError,
      timeoutSeconds: paymentTimeoutSeconds,
    }),
    [store, dispatch, login, register, logout, toast, notify, dismissToast, storageError],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// =====================================================================
// Chế độ API (VITE_USE_API=true)
// Luồng backend đã có → gọi API. Luồng backend chưa có (báo chuyển khoản, trả kho, lịch trả kho,
// thông báo, đổi tên hiển thị) → lưu trong trình duyệt theo từng tài khoản ("overlay").
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
    const [reservations, contracts, tickets] = await Promise.all([api.reservations(), api.contracts(), api.tickets()]);
    const [reservationDetails, contractDetails, ticketDetails] = await Promise.all([
      Promise.all(reservations.filter((r) => r.status !== "CANCELLED").map((r) => api.reservation(r.reservationId).catch(() => null))),
      Promise.all(contracts.map((c) => api.contract(c.contractId).catch(() => ({ ...c, payments: [], renewals: [] })))),
      Promise.all(tickets.map((t) => api.ticket(t.ticketId).catch(() => t))),
    ]);
    if (!refs.current.session) return;
    const next = {
      reservations,
      reservationDetails: Object.fromEntries(reservationDetails.filter(Boolean).map((d) => [d.reservationId, d])),
      contracts: contractDetails,
      tickets: ticketDetails,
    };
    refs.current.remote = next;
    setRemote(next);
    setNow(new Date());
  }, []);

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

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      await loadCatalog();
      if (refs.current.session) {
        if (isAdminRoles(refs.current.session.roles)) setRemote(EMPTY_REMOTE);
        else await loadCustomer();
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) endSession("expired");
      else setLoadError(e?.message || "Không tải được dữ liệu.");
    }
  }, [loadCatalog, loadCustomer, endSession]);

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
          .cancelReservation(r.reservationId, `Quá ${timeoutLabel(seconds)} chưa xác nhận chuyển khoản`)
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
      if (isAdminRoles(next.roles)) {
        refs.current.remote = EMPTY_REMOTE;
        setRemote(EMPTY_REMOTE);
      } else await loadCustomer();
    },
    [loadCustomer],
  );

  const login = useCallback(
    async ({ identifier, password }) => {
      const id = String(identifier || "").trim();
      if (!id || !password) return fail("Vui lòng nhập tên đăng nhập hoặc email và mật khẩu.");
      try {
        const res = await api.login(id.includes("@") ? id.toLowerCase() : id, password);
        const roles = rolesFromToken(res.token);
        if (!isAdminRoles(roles) && !isCustomerRoles(roles)) {
          return fail("Tài khoản Nhân viên / Quản lý dùng giao diện theo vai trò riêng, hiện chưa mở trên trang này.");
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
          case "CONFIRM_TRANSFER": {
            const r = d.reservations.find((x) => x.reservation_id === p.reservation_id);
            if (!r) return fail("Không tìm thấy đơn đặt chỗ.", "NOT_FOUND");
            if (r.status === "CANCELLED") return fail("Đơn đặt chỗ đã hết thời gian giữ chỗ.", "EXPIRED");
            if (r.status !== "PENDING_PAYMENT") return { ok: true, reservation_id: r.reservation_id };
            updateOverlay((o) => ({ ...o, transfers: { ...o.transfers, [r.api_id]: Date.now() } }));
            remember("Đã nhận thông tin đặt chỗ", `${shortCode(r.reservation_id)} · Chờ nhân viên đối soát chuyển khoản.`, "reservations", `Đơn ${shortCode(r.reservation_id)} đã gửi — chờ đối soát thanh toán`);
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
                  .cancelReservation(r.api_id, `Quá ${timeoutLabel(r.timeout_seconds || paymentTimeoutSeconds)} chưa xác nhận chuyển khoản`)
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
            const description = String(p.description || "").trim();
            if (!description) return fail("Vui lòng mô tả vấn đề.");
            if (description.length > 1000) return fail("Mô tả không quá 1000 ký tự.");
            const c = d.contracts.find((x) => x.contract_id === p.contract_id);
            if (!c) return fail("Cần có hợp đồng thuê kho để gửi yêu cầu hỗ trợ. Vui lòng chọn kho liên quan.");
            const dto = await api.createTicket({
              contractId: c.api_id,
              unitId: null,
              issueType: p.topic,
              title: topic.title,
              description,
              priority: ["ACCESS", "LOCK"].includes(p.topic) ? "HIGH" : "NORMAL",
            });
            const names = (p.attachments || []).slice(0, 3);
            if (names.length) updateOverlay((o) => ({ ...o, attachments: { ...o.attachments, [dto.ticketId]: names } }));
            remember("Đã gửi yêu cầu hỗ trợ", `${ticketCode(dto.ticketId)} · ${topic.title}`, "support", `Yêu cầu hỗ trợ ${ticketCode(dto.ticketId)} đã được gửi`, "blue");
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
          case "CHANGE_PASSWORD":
            return fail("Máy chủ chưa hỗ trợ đổi mật khẩu. Vui lòng liên hệ quản trị viên SafeSpace.", "UNSUPPORTED");
          case "REQUEST_RETURN":
          case "UPDATE_NAME":
          case "MARK_READ": {
            const out = runLocal(type, p);
            return out.error ? fail(out.error.message, out.error.code) : { ok: true, ...out.result };
          }
          default:
            return fail(`Thao tác không được hỗ trợ: ${type}`, "UNKNOWN");
        }
      } catch (e) {
        return handleError(e);
      }
    },
    [loadCustomer, updateOverlay, remember, runLocal, handleError],
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
      onApiError,
      roles: session?.roles || [],
      isAdmin: isAdminRoles(session?.roles),
      session,
      supports: { changePassword: false, forgotPassword: false },
      toast,
      notify,
      dismissToast,
      storageError,
      timeoutSeconds: paymentTimeoutSeconds,
    }),
    [ready, loadError, loadAll, session, data, dispatch, login, register, logout, checkAvailability, onApiError, toast, notify, dismissToast, storageError],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
