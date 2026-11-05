import { api } from "../../../shared/api/customerApi.js";
import { useCustomerData } from "../../../shared/hooks/useCustomerData.js";
import { cleanRefundBank } from "../../../shared/utils/refundRequest.js";
// D42/D44 · khoản hoàn tiền mặt của khách; đổi sang chuyển khoản trong 30 ngày
export function useCashRefunds() {
  const load = useCustomerData(() => api.cashRefunds(), []);
  const switchToBank = (id, bank) => api.switchCashRefundToBank(id, cleanRefundBank(bank));
  return { ...load, switchToBank };
}
