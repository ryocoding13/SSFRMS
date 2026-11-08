import { api } from "../../../shared/api/customerApi.js";
import { useCustomerData } from "../../../shared/hooks/useCustomerData.js";

// D46 · ô trống chọn được khi gia hạn sang ô khác (contractApiId: số hợp đồng ở BE)
export function useRenewalUnitOptions(contractApiId) {
  const load = useCustomerData(() => api.renewalUnits(contractApiId), [contractApiId]);
  const send = (months, consent, targetUnitId) => api.requestRenewal(contractApiId, months, consent, targetUnitId);
  return { ...load, send };
}

// D46 · trạng thái chuyển ô của hợp đồng (null = không có) và thao tác "Đã chuyển đồ"
export function useUnitMove(contractApiId) {
  const load = useCustomerData(() => api.unitMove(contractApiId), [contractApiId]);
  const markMoved = () => api.markUnitMoved(contractApiId);
  return { ...load, markMoved };
}
