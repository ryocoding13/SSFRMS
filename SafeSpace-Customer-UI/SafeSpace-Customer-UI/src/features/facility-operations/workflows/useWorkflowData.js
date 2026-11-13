import { requirePublication,verifyPublishedPolicy } from "../../business/policies/policyPublication.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { transferProof, validateRemoval, actualVnTime, removalPhotos, OVERDUE_HOLDING_AREA } from "../settlements/settlementModel.js";
import { useOps } from "../state/FacilityOperationsProvider.jsx";
import { verifyPhotoFile,readPhotoData } from "../../../shared/utils/refundRequest.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { applyWorkflowAction, createWorkflowSeed } from "./workflowModel.js";
import { loadWorkflow, saveWorkflow } from "./workflowApi.js";

export const WORKFLOW_DEMO = String(import.meta.env?.VITE_WORKFLOW_DEMO || "false") === "true";
const KEY = "safespace.approved-workflows.demo.v1";
let memory;
function readDemo() {
  try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved?.policy && Array.isArray(saved.inquiries)) {const ops=JSON.parse(localStorage.getItem("safespace.ops.v1")||"null");return Array.isArray(ops?.deposit_refunds)?{...saved,depositRefunds:ops.deposit_refunds}:saved;} } catch { /* session-only */ }
  const base=memory || (memory = createWorkflowSeed());try{const ops=JSON.parse(localStorage.getItem("safespace.ops.v1")||"null");if(Array.isArray(ops?.deposit_refunds))return {...base,depositRefunds:ops.deposit_refunds};}catch{}return base;
}

export function useWorkflowData(resource) {
  const { mode, user, roles, onApiError } = useApp();
  const opsContext=useOps(),facilityId=opsContext?.ops?.facility?.facility_id;
  const actorKey=`${user?.user_id??user?.username??user?.full_name}:${roles?.join(",")}:${facilityId}:${resource}`,activeActor=useRef(actorKey);activeActor.current=actorKey;
  const [needsRefresh,setNeedsRefresh]=useState(false);
  const storageResource = resource === "customerRefunds" ? "depositRefunds" : resource;
  const demo = WORKFLOW_DEMO || mode === "local";
  const [data, setData] = useState(() => demo ? readDemo()[storageResource] : resource === "policy" ? null : []);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  const [errorStatus, setErrorStatus] = useState(0);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false), generation = useRef(0);
  const inquiryRequest = useRef(null);
  const reload = useCallback(async () => {
    const seq = ++generation.current;
    setLoading(true); setError(""); setErrorStatus(0);
    if (resource === "inquiries") {
      try {
        const result = demo ? readDemo()[storageResource] : await loadWorkflow(resource);
        if (!Array.isArray(result)) throw new Error("Máy chủ chưa trả danh sách hợp lệ.");
        if (seq === generation.current) { setData(result); setNeedsRefresh(false); }
      } catch (e) {
        if (seq === generation.current) { setError(e.message); setErrorStatus(e?.status || 0); }
        onApiError?.(e);
      } finally {
        if (seq === generation.current) setLoading(false);
      }
      return;
    }
    try { const result = demo ? readDemo()[storageResource] : await loadWorkflow(resource); if(["depositRefunds","overdue"].includes(resource)&&!Array.isArray(result))throw new Error("Máy chủ chưa trả danh sách hợp lệ."); if (seq === generation.current) {setData(result);setNeedsRefresh(false);} }
    catch (e) { if (seq === generation.current) { setError(e.message); setErrorStatus(e?.status || 0); } onApiError?.(e); }
    finally { if (seq === generation.current) setLoading(false); }
  }, [demo, resource, storageResource, onApiError, actorKey]);
  useEffect(() => { reload(); return () => { generation.current++; }; }, [reload]);
  useEffect(() => {
    if (!demo) return undefined;
    const update = () => setData(readDemo()[storageResource]);
    window.addEventListener("storage", update); window.addEventListener("safespace-workflows", update);
    return () => { window.removeEventListener("storage", update); window.removeEventListener("safespace-workflows", update); };
  }, [demo, resource, storageResource]);
  const run = useCallback(async (action, payload) => {
    if(needsRefresh)return {ok:false,error:"Tải lại dữ liệu trước khi gửi tiếp; không chuyển tiền lần nữa."};
    if (guard.current) return { ok: false, error: "Đang lưu, vui lòng chờ." };
    guard.current = true; setBusy(true); setError("");
    try {
      if(action==="SAVE_RENTAL_POLICY")requirePublication(payload);
      if(!demo&&action==="RECORD_REMOVAL"&&!Number.isSafeInteger(data.find(r=>r.id===payload.id)?.removalDay))throw new Error("Máy chủ chưa trả mốc xử lý quá hạn hợp lệ.");
      if(!demo&&action==="RECORD_REMOVAL"&&roles?.includes("STAFF")&&(user?.user_id==null||String(data.find(r=>r.id===payload.id)?.assigneeId)!==String(user.user_id)))throw new Error("Chưa có phân công nhân viên hợp lệ từ máy chủ.");
      if(action==="RECORD_REMOVAL")validateRemoval((data||[]).find(r=>r.id===payload.id),payload,demo?readDemo().policy:{removalDay:data.find(r=>r.id===payload.id)?.removalDay},{id:user?.user_id,name:user?.full_name,roles:roles||[],facilityId});
      if(action==="CONFIRM_DEPOSIT_REFUND") {const item=(data||[]).find(r=>r.id===payload.id);if(!roles?.includes("MANAGER")||item?.facilityId!==facilityId)throw new Error("Khoản hoàn không thuộc cơ sở phụ trách.");transferProof(item,payload);if(!demo&&(!Number.isSafeInteger(item.version)||payload.expectedVersion!==item.version))throw new Error("Thiếu phiên bản khoản hoàn hợp lệ. Tải lại trước khi gửi.");}
      if (demo) {
        if(action==="RECORD_REMOVAL")for(const file of removalPhotos(payload))await verifyPhotoFile(file);
        if(activeActor.current!==actorKey)throw new Error("Tài khoản đã thay đổi. Tải lại trước khi gửi.");
        const next = applyWorkflowAction(readDemo(), action, payload, { id: user?.user_id, name: user?.full_name, roles: roles || [],facilityId });
        memory = next;
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* retained only in memory */ }
        setData(next[storageResource]); window.dispatchEvent(new Event("safespace-workflows"));
      } else {
        let requestPayload=action==="CONFIRM_DEPOSIT_REFUND"?{...payload,transactionRef:payload.transactionRef.trim(),transferredAt:actualVnTime(payload.transferredAt)}:payload;
        if(action==="RECORD_REMOVAL") {requestPayload={...payload,location:payload.location?.trim()||OVERDUE_HOLDING_AREA,photos:[],beforePhotos:undefined,afterPhotos:undefined};for(const file of removalPhotos(payload)){await verifyPhotoFile(file);requestPayload.photos.push(await readPhotoData(file));}}
        if(activeActor.current!==actorKey)throw new Error("Tài khoản đã thay đổi. Tải lại trước khi gửi.");
        if(action==="RECORD_REMOVAL")requestPayload.performedAt=actualVnTime(payload.performedAt);
        if (resource === "inquiries") {
          const fingerprint = JSON.stringify({ actorKey, action, payload });
          if (inquiryRequest.current?.fingerprint !== fingerprint)
            inquiryRequest.current = { fingerprint, id: crypto.randomUUID() };
          requestPayload = { ...requestPayload, clientRequestId: inquiryRequest.current.id,
            ...(action === "REPLY_INQUIRY" ? { expectedVersion: data.find(item => item.id === payload.id)?.version } : {}) };
        }
        const result=await saveWorkflow(resource, action, requestPayload);
        if(activeActor.current!==actorKey)throw new Error("Tài khoản đã thay đổi. Tải lại để xem kết quả.");
        if (resource === "inquiries") {
          const item = result?.item;
          if (!item || !Number.isSafeInteger(item.version) || !Array.isArray(item.responses) ||
            (action === "REPLY_INQUIRY" && item.id !== payload.id)) {
            const error = new Error("Máy chủ chưa xác nhận yêu cầu hỗ trợ. Tải lại trước khi gửi tiếp.");
            error.uncertain = true; throw error;
          }
          inquiryRequest.current = null;
        }
        if(action==="CONFIRM_DEPOSIT_REFUND") {const item=result?.item;if(item?.id!==payload.id||item.status!=="PAID"||item.transactionRef!==payload.transactionRef.trim()||!Number.isFinite(Date.parse(item.paidAt))||item.amount!==data.find(r=>r.id===payload.id)?.amount||item.facilityId!==facilityId||!Number.isSafeInteger(item.version)||item.version<=data.find(r=>r.id===payload.id)?.version||["contractId","ownerId","customer","bankName","accountNumber","accountHolder"].some(k=>item[k]!==data.find(r=>r.id===payload.id)?.[k])){const error=new Error("Máy chủ chưa xác nhận bằng chứng chuyển tiền; tải lại trước khi gửi tiếp.");error.uncertain=true;throw error;}setData(previous=>previous.map(r=>r.id===item.id?item:r));}
        else if(action==="RECORD_REMOVAL") {if(result?.item?.id!==payload.id||result.item.status!=="DONE"||!result.item.record?.savedAt||result.item.facilityId!==facilityId||!(result.item.record?.photos?.length||result.item.record?.afterPhotos?.length)){const error=new Error("Máy chủ chưa xác nhận biên bản và bằng chứng xử lý.");error.uncertain=true;throw error;}setData(previous=>previous.map(r=>r.id===result.item.id?result.item:r));}
        else if (resource === "inquiries") setData(previous => {
          const item = result.item;
          return previous.some(row => row.id === item.id)
            ? previous.map(row => row.id === item.id ? item : row) : [item, ...previous];
        });
        else if(action==="SAVE_RENTAL_POLICY")setData(verifyPublishedPolicy(result,payload));
        else await reload();
      }
      return { ok: true };
    } catch (e) { if(e.uncertain||e.status===0||e.status===409||e.status>=500)setNeedsRefresh(true); onApiError?.(e); return e?.status === 403 ? { ok: false, code: "FORBIDDEN", error: "Quyền tài khoản hoặc trạng thái phân công vừa thay đổi. Tải lại dữ liệu và kiểm tra quyền hiện tại trước khi tiếp tục." } : { ok: false, error: e.message }; }
    finally { guard.current = false; setBusy(false); }
  }, [demo, resource, storageResource, user, roles, onApiError, reload, needsRefresh, facilityId, data, actorKey]);
  const scoped = ["depositRefunds","overdue"].includes(resource) ? (data||[]).filter(r=>facilityId!=null&&r.facilityId===facilityId) : data;
  return { data:scoped, loading, error, errorStatus, busy, reload, run, demo,needsRefresh };
}
