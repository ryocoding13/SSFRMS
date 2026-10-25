import { useCallback } from "react";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { USE_API } from "../../../app/config/api.js";
import { api } from "../../../shared/api/customerApi.js";
import { today } from "../../../shared/utils/format.js";
import { accessError, validateAccess } from "../../../shared/utils/access.js";

export function useAccessQr(id) {
  const { data } = useApp();
  const getCredential = useCallback(async () => {
    if (data.returns.some(r => r.contract_id === id && !["CANCELLED", "REJECTED"].includes(r.status))) throw new Error("QR đã hết hiệu lực do đã gửi trả kho.");
    if (USE_API) {
      const contract = data.contracts.find(c => c.contract_id === id);
      const targetId = contract?.api_id || id;
      const res = await api.accessQr(targetId);
      return {
        owner: data.user.user_id,
        contractId: id,
        unit: res.unitNumber,
        date: today(),
        code: res.code,
        backupCode: res.backupCode,
      };
    }
    const contract = data.contracts.find(c => c.contract_id === id);
    const error = accessError(contract, today());
    if (error) throw new Error(error);
    const credential = {
      owner: data.user.user_id,
      contractId: id,
      unit: contract.unit_number,
      date: today(),
      code: crypto.randomUUID(),
      backupCode: String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0"),
    };
    return credential;
  }, [data, id]);

  const scan = useCallback(async (credential, code, unit) => {
    if (USE_API) {
      const res = await api.scanAccess({ code, unitNumber: unit });
      const allowed = res.result === "OPEN";
      const at = res.scannedAt || new Date().toISOString();
      const key = `safespace.access.scans.${data.user.user_id}`;
      let journal;
      try { journal = JSON.parse(localStorage.getItem(key) || "[]"); } catch { journal = []; }
      if (!Array.isArray(journal)) journal = [];
      localStorage.setItem(key, JSON.stringify([...journal.slice(-99), { contractId: id, unit, allowed, message: res.reason || "", at }]));
      return {
        allowed,
        message: res.reason || (allowed ? "Mở cửa thành công" : "Mã không hợp lệ"),
        at,
      };
    }
    const result = validateAccess({
      contract: data.contracts.find(c => c.contract_id === id),
      credential,
      code,
      unit,
      owner: data.user.user_id,
      date: today(),
    });
    const at = new Date().toISOString();
    const key = `safespace.access.scans.${data.user.user_id}`;
    let journal;
    try { journal = JSON.parse(localStorage.getItem(key) || "[]"); } catch { journal = []; }
    if (!Array.isArray(journal)) journal = [];
    localStorage.setItem(key, JSON.stringify([...journal.slice(-99), { contractId: id, unit, allowed: result.allowed, message: result.message, at }]));
    return { ...result, at };
  }, [data, id]);

  return { getCredential, scan };
}
