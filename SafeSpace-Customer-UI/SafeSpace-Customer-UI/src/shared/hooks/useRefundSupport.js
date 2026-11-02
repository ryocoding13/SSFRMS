import { useCallback, useEffect, useState } from "react";
import { useApp } from "../../app/state/AppProvider.jsx";
import { api } from "../api/customerApi.js";
export function useRefundSupport(capability) {
  const { mode } = useApp();
  const [state, setState] = useState({ ready: mode === "local", loading: mode !== "local", error: "" });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt(a => a + 1), []);
  useEffect(() => {
    let alive = true;
    if (mode === "local") { setState({ ready: true, loading: false, error: "" }); return; }
    setState({ ready: false, loading: true, error: "" });
    api.currentRentalPolicy().then(policy => { if (alive) setState({ready: policy?.[capability] === true, loading:false, error:""}); }).catch(() => { if (alive) setState({ready:false,loading:false,error:"Chưa kiểm tra được chức năng hoàn tiền. Vui lòng tải lại hoặc liên hệ cơ sở."}); });
    return () => { alive = false; };
  }, [mode, capability, attempt]);
  return { ...state, reload, demo: mode === "local" };
}
