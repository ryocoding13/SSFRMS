import { verifyPhotoFile } from "../../../shared/utils/refundRequest.js";
import { opsMutationCheck, opsReceiptCheck } from "../settlements/settlementModel.js";
import { supportsReturnPolicy, RETURN_POLICY_PENDING, NO_RETURN_COLLECTION } from "../../../shared/utils/returnPolicy.js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { Button, Modal } from "../../../shared/components/UI.jsx";
import { MANAGER_CONFIRM, opsConfirmation } from "../utils/opsConfirmation.js";
import { ApiError } from "../../../shared/api/httpClient.js";
import { callAction, loadBoard } from "../api/facilityOperationsApi.js";
import { createOpsData } from "../data/facilityOperationsSeed.js";
import { reduceOps } from "./facilityOperationsReducer.js";

// Kho dữ liệu vận hành cho khu Nhân viên & Quản lý cơ sở.
// - mode "api": đọc GET /api/ops/board, mỗi thao tác gọi endpoint tương ứng (ops/api.js) rồi nạp lại.
// - backend không có /api/ops (404, bản backend cũ) hoặc chạy không backend: dữ liệu cục bộ lưu trong trình duyệt, dùng chung
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

const UNSUPPORTED = {
  UPDATE_UNIT_STATUS: "Máy chủ chưa hỗ trợ đổi trạng thái ô kho. Cập nhật backend có PUT /api/staff/units/{mã}/status rồi thử lại.",
  CONFIRM_FEE_COLLECTION: "Máy chủ chưa hỗ trợ ghi nhận thu phí tại quầy (POST /api/ops/fees/{mã}/confirm). Chưa lưu khoản thu này; không thu thêm tiền của khách.",
};

// Nhật ký / thông báo trong ca chỉ giữ ở trình duyệt (backend chưa có API thông báo)
function appendLog(state, text, to) {
  const at = new Date();
  return { ...state, log: [{ id: `L-${at.getTime()}`, text, to, role: "ALL", at: at.toISOString(), read: false }, ...(state.log || [])].slice(0, 60) };
}

export function OpsProvider({ children, notify, mode = "local", onApiError, role }) {
  // source: "loading" | "api" | "local"
  const [source, setSource] = useState(mode === "api" ? "loading" : "local");
  const [state, setState] = useState(() => (mode === "api" ? null : readOps()));
  const [loadError, setLoadError] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [needsRefresh,setNeedsRefresh]=useState(false);
  // Kết quả sau khi lưu (Figma 03a thành công / 03b thất bại): { kind, title, text, action, detail }
  const [outcome, setOutcome] = useState(null);
  const alive=useRef(true),currentRole=useRef(role);currentRole.current=role;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const activeAction = useRef(false);
  const confirmationRef = useRef(null);
  const outcomeRef = useRef(null);
  const ref = useRef(state);
  ref.current = state;

  const commit = useCallback((next) => {
    ref.current = next;
    setState(next);
  }, []);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const board = await loadBoard(role);
      commit({ ...board, log: ref.current?.log || [] });
      setSource("api");
      setNeedsRefresh(false);
      return board;
    } catch (e) {
      if (mode !== "api" && e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        commit(readOps());
        setSource("local");
      } else {
        onApiError?.(e);
        setLoadError(e?.message || "Không tải được dữ liệu vận hành từ máy chủ.");
        return null;
      }
    }
  }, [commit, onApiError, role, mode]);

  useEffect(() => {
    if (mode === "api") reload();
  }, [mode, reload]);

  // Lưu + đồng bộ giữa các tab khi dùng dữ liệu cục bộ
  useEffect(() => {
    if (source !== "local" || !state) return;
    try {
      localStorage.setItem(OPS_KEY, JSON.stringify(state));
      window.dispatchEvent(new Event("safespace-workflows"));
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

  const execute = useCallback(
    async (type, payload, message) => {
      try { if(needsRefresh)throw new Error("Cần tải lại dữ liệu trước khi gửi tiếp.");opsMutationCheck(type,payload,ref.current,source,role); } catch(error) {return {ok:false,error:error.message};}
      if (type === "CONFIRM_FEE_COLLECTION") return { ok: false, error: NO_RETURN_COLLECTION };
      if (type === "REVOKE_CREDENTIAL") return { ok: false, error: "Không hỗ trợ thu hồi QR/PIN thủ công." };
      if (type === "CONFIRM_REFUND" && source === "api" && !supportsReturnPolicy(ref.current)) return { ok: false, error: RETURN_POLICY_PENDING };
      if (source === "api" && type !== "MARK_READ") {
        try {
          const res = await callAction(type, payload,()=>alive.current&&currentRole.current===role);
          if(!alive.current||currentRole.current!==role)return {ok:false,error:"Phiên làm việc đã thay đổi. Tải lại để kiểm tra kết quả."};
          const board=await reload();
          try {opsReceiptCheck(type,payload,res,board);} catch(error) {error.uncertain=true;throw error;}
          if (message) {
            commit(appendLog(ref.current, message, null));
            notify?.(message);
          }
          // Giữ số liệu backend trả về (vd. số tiền hoàn cọc thực tế) để màn kết quả hiển thị đúng
          return { ok: true, ...(res && typeof res === "object" && !Array.isArray(res) ? res : {}) };
        } catch (e) {
          if(e.uncertain||e.status===0||e.status===409||e.status>=500)setNeedsRefresh(true);
          onApiError?.(e);
          // Route chưa có trên backend: ASP.NET trả 404/405 không kèm nội dung → báo rõ thay vì "Không tìm thấy dữ liệu."
          const missing = e instanceof ApiError && (e.status === 404 || e.status === 405) && !e.data;
          const error = missing ? UNSUPPORTED[type] || "Máy chủ chưa hỗ trợ thao tác này." : e?.message || "Thao tác không thành công.";
          notify?.(error, "error");
          return { ok: false, error };
        }
      }
      if(type==="SUBMIT_RETURN")for(const file of payload.files||[])await verifyPhotoFile(file);
      if(!alive.current||currentRole.current!==role)return {ok:false,error:"Phiên làm việc đã thay đổi."};
      const out = reduceOps(ref.current, { type, payload }, new Date());
      if (out.error) {
        notify?.(out.error.message, "error");
        return { ok: false, error: out.error.message };
      }
      commit(out.state);
      if (message) notify?.(message);
      return { ok: true, ...out.result };
    },
    [source, reload, commit, notify, onApiError, needsRefresh, role],
  );

  // Guard the mutation boundary. Nhân viên: mọi thao tác hỏi xác nhận rồi báo kết quả (S02–S05, S09).
  // Quản lý: phân bổ, phân công, duyệt/từ chối gia hạn (Figma 885:*, M03a–d). Cancel never calls the API.
  const showOutcome = useCallback((next) => new Promise((resolve) => {
    outcomeRef.current = resolve;
    setOutcome(next);
  }), []);
  const run = useCallback(async (type, payload, message) => {
    const guarded = type !== "MARK_READ" && (role === "STAFF" || MANAGER_CONFIRM.has(type));
    if (!guarded) return execute(type, payload, message);
    if (activeAction.current) return { ok: false, cancelled: true };
    activeAction.current = true;
    const spec = opsConfirmation(type, payload, ref.current);
    try {
      if (spec.confirm !== false) {
        const accepted = await new Promise(resolve => {
          confirmationRef.current = resolve;
          setConfirmation(spec);
        });
        confirmationRef.current = null;
        if (!accepted) {
          setConfirmation(null);
          return { ok: false, cancelled: true };
        }
      }
      setSaving(true);
      let result;
      try {
        result = await execute(type, payload, message);
      } catch (error) {
        result = { ok: false, error: error?.message };
      }
      if(!alive.current)return {ok:false,error:"Phiên làm việc đã thay đổi."};
      setSaving(false);
      setConfirmation(null);
      if (!result.ok) {
        const failure = spec.failure || { title: "Chưa lưu được thay đổi", text: "Không lưu được thay đổi. Vui lòng kiểm tra lại trạng thái trước khi thử lại." };
        await showOutcome({ kind: "failure", ...failure, detail: result.error && result.error !== failure.text ? result.error : "" });
        return { ...result, shown: true };
      }
      const success = typeof spec.success === "function" ? spec.success(result) : spec.success;
      if (success) await showOutcome({ kind: "success", ...success });
      return result;
    } finally {
      activeAction.current = false;
      if(!alive.current)return {ok:false,error:"Phiên làm việc đã thay đổi."};
      setSaving(false);
      setConfirmation(null);
    }
  }, [role, execute, showOutcome]);
  const closeOutcome = useCallback(() => {
    setOutcome(null);
    outcomeRef.current?.();
    outcomeRef.current = null;
  }, []);
  useEffect(() => () => { confirmationRef.current?.(false); outcomeRef.current?.(); }, []);
  useEffect(() => {
    if (mode !== "api") return undefined;
    const refresh = () => { if (!activeAction.current && !document.hidden) reload(); };
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [mode, reload]);

  const reset = useCallback(() => commit(createOpsData()), [commit]);

  const value = useMemo(() => ({ ops: state, run, reset, reload, source, saving, needsRefresh }), [state, run, reset, reload, source, saving, needsRefresh]);

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
  return <OpsContext.Provider value={value}>
    {(loadError||needsRefresh)&&<div className="container page"><p role="alert">{loadError||"Chưa xác minh kết quả lần gửi trước. Tải lại trước khi gửi tiếp; không chuyển tiền lần nữa."}</p><Button disabled={saving} onClick={reload}>Tải lại dữ liệu</Button></div>}
    {children}
    {confirmation && <ConfirmDialog {...confirmation} busy={saving} onCancel={() => confirmationRef.current?.(false)} onConfirm={() => confirmationRef.current?.(true)} />}
    {outcome && (
      <ConfirmDialog title={outcome.title} tone={outcome.kind} text={outcome.text} hint={outcome.detail||""} rows={[]} label={outcome.action||"Về hồ sơ"} cancelLabel={null} onCancel={closeOutcome} onConfirm={closeOutcome}/>
    )}
  </OpsContext.Provider>;
}
