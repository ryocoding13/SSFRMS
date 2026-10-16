import { useCallback } from "react";
import { useApp } from "./store";
import { USE_API } from "../config/api";
import { today } from "../lib/format";
import { accessError, validateAccess } from "../lib/access";

// Local simulator is explicitly restricted to VITE_USE_API=false.
// Replace this boundary with authenticated backend operations when Ops is ready.
export function useAccessQr(id) {
  const { data } = useApp();
  const getCredential = useCallback(async () => {
    if (USE_API) throw new Error("Chức năng QR chưa được máy chủ hỗ trợ. Vui lòng liên hệ nhân viên cơ sở.");
    const contract = data.contracts.find(c => c.contract_id === id);
    const error = accessError(contract, today());
    if (error) throw new Error(error);
    const credential = { owner: data.user.user_id, contractId: id, unit: contract.unit_number, date: today(), code: crypto.randomUUID(), backupCode: String(crypto.getRandomValues(new Uint32Array(1))[0] % 100000000).padStart(8, "0") };
    return credential;
  }, [data, id]);
  const scan = useCallback(async (credential, code, unit) => {
    if (USE_API) throw new Error("Chức năng quét QR chưa được máy chủ hỗ trợ.");
    const result = validateAccess({ contract: data.contracts.find(c => c.contract_id === id), credential, code, unit, owner: data.user.user_id, date: today() });
    const at = new Date().toISOString();
    // Separate simulator journal; no changes to contract, payment or Ops state.
    const key = `safespace.access.scans.${data.user.user_id}`;
    let journal;
    try { journal = JSON.parse(localStorage.getItem(key) || "[]"); } catch { journal = []; }
    if (!Array.isArray(journal)) journal = [];
    localStorage.setItem(key, JSON.stringify([...journal.slice(-99), { contractId: id, unit, allowed: result.allowed, message: result.message, at }]));
    return { ...result, at };
  }, [data, id]);
  return { getCredential, scan };
}
