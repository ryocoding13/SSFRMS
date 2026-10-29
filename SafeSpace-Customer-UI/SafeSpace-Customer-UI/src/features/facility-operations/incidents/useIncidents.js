import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { WORKFLOW_DEMO } from "../workflows/useWorkflowData.js";
import { applyIncidentAction, createIncidentSeed, selectIncidents } from "./incidentModel.js";
import { validateDamageFiles } from "../damage/damageModel.js";
import { verifyPhotoFile } from "../../../shared/utils/refundRequest.js";
import { loadIncidents, saveIncidentAction } from "./incidentApi.js";
export const INCIDENT_DEMO_KEY = "safespace.incident-workflow.demo.v1";
const readDemo = () => { try { const value = JSON.parse(localStorage.getItem(INCIDENT_DEMO_KEY)); if (value?.version === 1 && Array.isArray(value.cases)) return value.cases; } catch { /* opt-in demo only */ } return createIncidentSeed(); };

export function useIncidents(scope, facilityId) {
  const { mode, user, roles, onApiError } = useApp();
  const demo = WORKFLOW_DEMO || mode === "local";
  const actor = { id: user?.user_id, name: user?.full_name || user?.username, roles: roles || [], facilityId };
  const key = `${scope}:${actor.id ?? actor.name}:${facilityId ?? ""}:${actor.roles.join(",")}`;
  const [state, setState] = useState(() => ({ key, data: demo ? selectIncidents(readDemo(), actor, scope) : [], loading: !demo, error: "" }));
  const [busy, setBusy] = useState(false), [needsRefresh, setNeedsRefresh] = useState(false);
  const current = useRef({}), generation = useRef(0), guard = useRef(false);
  current.current = { key, actor, state };
  const reload = useCallback(async () => {
    const seq = ++generation.current;
    setState({ key, data: [], loading: true, error: "" });
    try {
      if (scope === "manager" && facilityId == null) throw new Error("Chưa xác định cơ sở phụ trách. Vui lòng tải lại dữ liệu cơ sở.");
      const cases = demo ? readDemo() : await loadIncidents(scope);
      if (seq === generation.current) { setState({ key, data: selectIncidents(cases, current.current.actor, scope), loading: false, error: "" }); setNeedsRefresh(false); }
    } catch (error) { if (seq === generation.current) setState({ key, data: [], loading: false, error: error.message }); onApiError?.(error); }
  }, [key, scope, facilityId, demo, onApiError]);
  useEffect(() => { reload(); return () => { generation.current++; }; }, [reload]);
  useEffect(() => {
    if (!demo) return undefined;
    const update = event => { if (!event.key || event.key === INCIDENT_DEMO_KEY) setState({key,data:selectIncidents(readDemo(),current.current.actor,scope),loading:false,error:""}); };
    window.addEventListener("storage", update); window.addEventListener("safespace-incident", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("safespace-incident", update); };
  }, [demo, reload]);
  const run = useCallback(async (id, action, payload) => {
    if (guard.current || needsRefresh) return { ok: false, error: "Đang xử lý hoặc cần tải lại hồ sơ trước khi gửi tiếp." };
    const active = current.current, item = active.state.key === key && active.state.data.find(c => c.id === id);
    const seq = generation.current;
    guard.current = true; setBusy(true);
    try {
      let result;
      if (demo) {
        validateDamageFiles(payload.files || []);
        applyIncidentAction(readDemo(), action, { ...payload, id }, active.actor);
        for (const file of payload.files || []) await verifyPhotoFile(file);
        if (current.current.key !== key || generation.current !== seq) throw new Error("Màn hình hoặc tài khoản đã thay đổi. Tải lại hồ sơ trước khi gửi.");
        const next = applyIncidentAction(readDemo(), action, { ...payload, id }, active.actor);
        localStorage.setItem(INCIDENT_DEMO_KEY, JSON.stringify({ version: 1, cases: next }));
        result = next.find(c => c.id === id);
      } else result = await saveIncidentAction(scope, item, action, payload, active.actor, new Date(), () => current.current.key === key && generation.current === seq);
      if (current.current.key !== key || generation.current !== seq) return { ok: false, error: "Màn hình hoặc tài khoản đã thay đổi. Tải lại hồ sơ để xem kết quả." };
      setState(previous => ({ ...previous, data: previous.data.map(c => c.id === result.id ? result : c) }));
      if (demo) window.dispatchEvent(new Event("safespace-incident"));
      return { ok: true, incident: result };
    } catch (error) {
      if (current.current.key === key && (error.uncertain || error.status === 0 || error.status === 409 || error.status >= 500)) setNeedsRefresh(true);
      onApiError?.(error);
      return { ok: false, error: error.message };
    } finally { guard.current = false; if (current.current.key === key) setBusy(false); }
  }, [key, scope, demo, needsRefresh, onApiError]);
  const visible = state.key === key ? state : { data: [], loading: true, error: "" };
  return { ...visible, busy, needsRefresh, demo, reload, run };
}
