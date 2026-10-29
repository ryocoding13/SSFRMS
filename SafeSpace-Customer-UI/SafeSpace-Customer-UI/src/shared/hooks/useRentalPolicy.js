import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../app/state/AppProvider.jsx";

export function useRentalPolicy(version) {
  const { services } = useApp();
  const key = version === undefined ? "current" : version;
  const [state, setState] = useState({ key, data: null, loading: version !== null, error: "" });
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const seq = ++generation.current;
    if (version === null) { setState({ key, data: null, loading: false, error: "" }); return; }
    setState({ key, data: null, loading: true, error: "" });
    try {
      const result = await services.rentalPolicy(version);
      if (seq !== generation.current) return;
      setState(result.ok ? { key, data: result.policy, loading: false, error: "" } : { key, data: null, loading: false, error: result.error || "Chưa tải được chính sách. Vui lòng thử lại." });
    } catch { if (seq === generation.current) setState({ key, data: null, loading: false, error: "Không kết nối được máy chủ. Vui lòng thử lại." }); }
  }, [services, version]);
  useEffect(() => { reload(); return () => { generation.current++; }; }, [reload]);
  return state.key === key ? { ...state, reload } : { data: null, loading: version !== null, error: "", reload };
}
