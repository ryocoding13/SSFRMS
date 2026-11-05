import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../app/state/AppProvider.jsx";
// Dữ liệu khách đọc trực tiếp từ BE cho các luồng Phiên 3–4 (khấu trừ trả kho, hoàn tiền mặt, đổi kho).
// Chế độ lưu trình duyệt chưa có dữ liệu mô phỏng cho các luồng này → báo rõ, không giả thành công.
export function useCustomerData(loader, deps = []) {
  const { mode, onApiError } = useApp();
  const demo = mode !== "api";
  const [data, setData] = useState(null), [loading, setLoading] = useState(!demo), [error, setError] = useState("");
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (demo) return;
    const id = ++seq.current;
    setLoading(true); setError("");
    try { const result = await loader(); if (id === seq.current) setData(result); }
    catch (e) { if (id === seq.current) setError(e?.status === 404 ? "Chưa có dữ liệu cho mục này." : e?.message || "Chưa tải được dữ liệu."); onApiError?.(e); }
    finally { if (id === seq.current) setLoading(false); }
  }, [demo, onApiError, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); return () => { seq.current++; }; }, [reload]);
  return { data, loading, error, reload, demo };
}
