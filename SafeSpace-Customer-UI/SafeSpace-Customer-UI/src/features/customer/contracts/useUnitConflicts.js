import { api } from "../../../shared/api/customerApi.js";
import { useCustomerData } from "../../../shared/hooks/useCustomerData.js";
import { refundChoicePayload } from "../../../shared/utils/refundRequest.js";
// D41 · đề xuất đổi kho của khách (mốc 5 ngày trước ngày nhận kho)
export function useUnitConflicts() {
  const load = useCustomerData(() => api.unitConflicts(), []);
  const choose = (contractApiId, choice, extra = {}) => {
    const body = { choice };
    if (choice === "RESCHEDULE") body.newStartDate = extra.newStartDate;
    if (choice === "CANCEL") {
      const p = refundChoicePayload(extra.bank);
      body.refundBank = p.refundMethod ? { method: p.refundMethod } : p;
    }
    return api.chooseUnitConflict(contractApiId, body);
  };
  return { ...load, choose };
}
