import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/http";
import { callAction, loadBoard } from "./api";
import { createOpsData } from "./data";
import { reduceOps } from "./reducer";

// Kho dữ liệu vận hành cho khu Nhân viên & Quản lý cơ sở.
// - mode "api": đọc GET /api/ops/board, mỗi thao tác gọi endpoint tương ứng (ops/api.js) rồi nạp lại.
// - backend chưa có API (404) hoặc chạy không backend: dữ liệu mẫu lưu trong trình duyệt, dùng chung
//   giữa nhân viên và quản lý (thao tác bên này hiện ngay bên kia, kể cả khác tab).
export const OPS_KEY = "safespace.ops.v1";
const OpsContext = createContext(null);
export const useOps = () => useContext(OpsContext);

function readOps() {
  try {
    const saved = JSON.parse(localStorage.getItem(OPS_KEY));
    if (saved?.version === 1 && Array.isArray(saved.units)) return saved;
  } catch {
    /* dữ liệu hỏng → khởi tạo lại */
  }
  return createOpsData();
}

// Nhật ký / thông báo trong ca chỉ giữ ở trình duyệt (backend chưa có API thông báo)
function appendLog(state, text, to) {
  const at = new Date();
  return { ...state, log: [{ id: `L-${at.getTime()}`, text, to, role: "ALL", at: at.toISOString(), read: false }, ...(state.log || [])].slice(0, 60) };
}

export function OpsProvider({ children, notify, mode = "local", onApiError }) {
  // source: "loading" | "api" | "local"
  const [source, setSource] = useState(mode === "api" ? "loading" : "local");
  const [state, setState] = useState(() => (mode === "api" ? null : readOps()));
  const [loadError, setLoadError] = useState(null);
  const ref = useRef(state);
  ref.current = state;

  const commit = useCallback((next) => {
    ref.current = next;
    setState(next);
  }, []);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const board = await loadBoard();
      commit({ ...board, log: ref.current?.log || [] });
      setSource("api");
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        // Backend chưa có endpoint vận hành → dữ liệu mẫu
        commit(readOps());
        setSource("local");
      } else {
        onApiError?.(e);
        setLoadError(e?.message || "Không tải được dữ liệu vận hành.");
      }
    }
  }, [commit, onApiError]);

  useEffect(() => {
    if (mode === "api") reload();
  }, [mode, reload]);

  // Lưu + đồng bộ giữa các tab khi dùng dữ liệu mẫu
  useEffect(() => {
    if (source !== "local" || !state) return;
    try {
      localStorage.setItem(OPS_KEY, JSON.stringify(state));
    } catch {
      /* trình duyệt chặn lưu: giữ trong phiên */
    }
  }, [state, source]);
  useEffect(() => {
    if (source !== "local" || typeof window === "undefined") return undefined;
    const onStorage = (e) => {
      if (e.key !== OPS_KEY || !e.newValue) return;
      try {
        commit(JSON.parse(e.newValue));
      } catch {
        /* bỏ qua */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [source, commit]);

  const run = useCallback(
    async (type, payload, message) => {
      if (source === "api" && type !== "MARK_READ") {
        try {
          await callAction(type, payload);
          await reload();
          if (message) {
            commit(appendLog(ref.current, message, null));
            notify?.(message);
          }
          return { ok: true };
        } catch (e) {
          onApiError?.(e);
          const error = e?.message || "Thao tác không thành công.";
          notify?.(error, "error");
          return { ok: false, error };
        }
      }
      const out = reduceOps(ref.current, { type, payload }, new Date());
      if (out.error) {
        notify?.(out.error.message, "error");
        return { ok: false, error: out.error.message };
      }
      commit(out.state);
      if (message) notify?.(message);
      return { ok: true, ...out.result };
    },
    [source, reload, commit, notify, onApiError],
  );

  const reset = useCallback(() => commit(createOpsData()), [commit]);

  const value = useMemo(() => ({ ops: state, run, reset, reload, source }), [state, run, reset, reload, source]);

  if (!state)
    return (
      <main className="container page loading" aria-busy={!loadError}>
        {loadError ? (
          <>
            <p>{loadError}</p>
            <button type="button" className="btn btn--primary" onClick={reload}>Thử lại</button>
          </>
        ) : (
          <>
            <span className="loading__spinner" aria-hidden="true" />
            <p>Đang tải dữ liệu vận hành…</p>
          </>
        )}
      </main>
    );
  return <OpsContext.Provider value={value}>{children}</OpsContext.Provider>;
}
