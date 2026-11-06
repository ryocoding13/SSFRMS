import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "../../../shared/api/httpClient.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

// Phiên 6 · đọc/ghi các API vận hành mới (D41/D42): tiền mặt, kiểm tra lại, báo cáo cuối ngày, xung đột đổi kho.
// Chế độ trình duyệt không có dữ liệu thật → báo rõ, không giả lập thành công.
export function useOpsEndpoint(path) {
  const { mode, onApiError } = useApp();
  const demo = mode !== "api";
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0), guard = useRef(false);
  const reload = useCallback(async () => {
    if (demo || !path) { setLoading(false); return; }
    const n = ++seq.current;
    setLoading(true); setError(""); setErrorStatus(0);
    try { const res = await request(path); if (n === seq.current) setData(res); }
    catch (e) {
      if (n === seq.current) { setError([404, 405].includes(e.status) ? "Máy chủ chưa cung cấp dữ liệu cho chức năng này." : e.message); setErrorStatus(e.status || 0); }
      onApiError?.(e);
    } finally { if (n === seq.current) setLoading(false); }
  }, [demo, path, onApiError]);
  useEffect(() => { reload(); return () => { seq.current++; }; }, [reload]);
  const post = useCallback(async (url, body) => {
    if (demo) return { ok: false, error: "Chế độ mô phỏng không ghi được thao tác này. Vui lòng dùng chế độ kết nối máy chủ." };
    if (guard.current) return { ok: false, error: "Đang lưu, vui lòng chờ." };
    guard.current = true; setBusy(true);
    try { const res = await request(url, { method: "POST", body }); await reload(); return { ok: true, result: res }; }
    catch (e) { onApiError?.(e); return { ok: false, error: e.message }; }
    finally { guard.current = false; setBusy(false); }
  }, [demo, reload, onApiError]);
  return { data, loading, error, errorStatus, busy, reload, post, demo, needsRefresh: false };
}
