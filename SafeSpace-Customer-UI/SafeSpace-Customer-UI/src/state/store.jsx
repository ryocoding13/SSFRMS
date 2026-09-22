import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { paymentTimeoutSeconds } from "../config/media";
import { createEmptyData, createSeedData } from "../data/seed";
import { isEmail } from "../lib/format";
import { reduce, sweepExpired, validateRegister } from "./reducer";

// Kho dữ liệu cục bộ (localStorage). Để nối backend, thay dispatch/login/register
// bằng lời gọi API tương ứng (xem BE-CONTRACT.md); các trang không cần sửa.
export const STORAGE_KEY = "safespace.customer.v4";
const VERSION = 4;

function readStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === VERSION && saved.data?.user && Array.isArray(saved.data.reservations)) {
      return { authed: Boolean(saved.authed), data: saved.data };
    }
  } catch {
    /* Không đọc được storage: dùng dữ liệu khởi tạo trong bộ nhớ. */
  }
  return { authed: false, data: createSeedData() };
}

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [store, setStore] = useState(readStore);
  const ref = useRef(store);
  ref.current = store;
  const [toast, setToast] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const timer = useRef();

  const commit = useCallback((next) => {
    ref.current = next;
    setStore(next);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, ...store }));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [store]);

  const notify = useCallback((message, tone = "success") => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    timer.current = setTimeout(() => setToast(null), 4500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

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
    (type, payload) => {
      const out = reduce(ref.current.data, { type, payload }, { now: new Date(), timeoutSeconds: paymentTimeoutSeconds });
      if (out.state !== ref.current.data) commit({ ...ref.current, data: out.state });
      return out.error ? { ok: false, error: out.error.message, code: out.error.code } : { ok: true, ...out.result };
    },
    [commit],
  );

  const login = useCallback(
    ({ identifier, password }) => {
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
    (form) => {
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

  const logout = useCallback(() => commit({ ...ref.current, authed: false }), [commit]);

  const value = useMemo(
    () => ({
      authed: store.authed,
      data: store.data,
      user: store.authed ? store.data.user : null,
      dispatch,
      login,
      register,
      logout,
      toast,
      notify,
      dismissToast: () => setToast(null),
      storageError,
      timeoutSeconds: paymentTimeoutSeconds,
    }),
    [store, dispatch, login, register, logout, toast, notify, storageError],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
