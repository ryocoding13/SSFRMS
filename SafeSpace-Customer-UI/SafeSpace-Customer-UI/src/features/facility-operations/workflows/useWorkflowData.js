import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { applyWorkflowAction, createWorkflowSeed } from "./workflowModel.js";
import { loadWorkflow, saveWorkflow } from "./workflowApi.js";

export const WORKFLOW_DEMO = String(import.meta.env?.VITE_WORKFLOW_DEMO || "false") === "true";
const KEY = "safespace.approved-workflows.demo.v1";
let memory;
function readDemo() {
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved?.policy && Array.isArray(saved.inquiries)) return saved; } catch { /* session-only */ }
  return memory || (memory = createWorkflowSeed());
}

export function useWorkflowData(resource) {
  const { mode, user, roles, onApiError } = useApp();
  const demo = WORKFLOW_DEMO || mode === "local";
  const [data, setData] = useState(() => demo ? readDemo()[resource] : resource === "policy" ? null : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useRef(false), generation = useRef(0);
  const reload = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true); setError("");
    try { const result = demo ? readDemo()[resource] : await loadWorkflow(resource); if (seq === generation.current) setData(result); }
    catch (e) { if (seq === generation.current) setError(e.message); onApiError?.(e); }
    finally { if (seq === generation.current) setLoading(false); }
  }, [demo, resource, onApiError]);
  useEffect(() => { reload(); return () => { generation.current++; }; }, [reload]);
  useEffect(() => {
    if (!demo) return undefined;
    const update = () => setData(readDemo()[resource]);
    window.addEventListener("storage", update); window.addEventListener("safespace-workflows", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("safespace-workflows", update); };
  }, [demo, resource]);
  const run = useCallback(async (action, payload) => {
    if (guard.current) return { ok: false, error: "Đang lưu, vui lòng chờ." };
    guard.current = true; setBusy(true); setError("");
    try {
      if (demo) {
        const next = applyWorkflowAction(readDemo(), action, payload, { id: user?.user_id, name: user?.full_name, roles: roles || [] });
        memory = next;
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* retained only in memory */ }
        setData(next[resource]); window.dispatchEvent(new Event("safespace-workflows"));
      } else { await saveWorkflow(resource, action, payload); await reload(); }
      return { ok: true };
    } catch (e) { setError(e.message); onApiError?.(e); return { ok: false, error: e.message }; }
    finally { guard.current = false; setBusy(false); }
  }, [demo, resource, user, roles, onApiError, reload]);
  return { data, loading, error, busy, reload, run, demo };
}
