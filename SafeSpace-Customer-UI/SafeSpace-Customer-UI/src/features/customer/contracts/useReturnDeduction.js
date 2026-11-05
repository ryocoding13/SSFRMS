import { api } from "../../../shared/api/customerApi.js";
import { useCustomerData } from "../../../shared/hooks/useCustomerData.js";
// D39/D40 · khoản khấu trừ trên biên bản trả kho của một hợp đồng (contractApiId: số hợp đồng ở BE)
export function useReturnDeduction(contractApiId) {
  const load = useCustomerData(() => api.returnDeduction(contractApiId), [contractApiId]);
  const decide = (decision, note) => api.decideReturnDeduction(contractApiId, { decision, note });
  return { ...load, decide };
}
