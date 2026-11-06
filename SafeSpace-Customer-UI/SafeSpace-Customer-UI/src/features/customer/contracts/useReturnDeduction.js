import { api } from "../../../shared/api/customerApi.js";
import { useCustomerData } from "../../../shared/hooks/useCustomerData.js";
import { readPhotoData } from "../../../shared/utils/refundRequest.js";
// D39/D40 · khoản khấu trừ trên biên bản trả kho của một hợp đồng (contractApiId: số hợp đồng ở BE)
export function useReturnDeduction(contractApiId) {
  const load = useCustomerData(() => api.returnDeduction(contractApiId), [contractApiId]);
  // Câu 7: ảnh hoá đơn / vật dụng thay thế (không bắt buộc) gửi kèm khi tự thay thế hoặc khiếu nại
  const decide = async (decision, note, files = []) => {
    const photos = files.length ? await Promise.all(files.map(readPhotoData)) : [];
    return api.decideReturnDeduction(contractApiId, { decision, note, ...(photos.length ? { photos } : {}) });
  };
  return { ...load, decide };
}
