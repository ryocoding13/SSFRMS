/**
 * POLICY ACTIONS - CÁC THAO TÁC THAY THẾ VÀ ÁP DỤNG CHÍNH SÁCH THUÊ (B02)
 *
 * Xử lý xung đột chính sách:
 * - Khi kích hoạt chính sách gặp lỗi 409 (xung đột phiên bản đang áp dụng), hiển thị hộp thoại
 *   hỏi xác nhận ghi đè theo quy tắc backend.
 * - Hỗ trợ tạo mới, cập nhật bản nháp (DRAFT) hoặc kích hoạt chính sách thay thế.
 */
import { businessApi } from "../api/businessApi.js";
import { ApiError } from "../../../shared/api/httpClient.js";
import { POLICY_TYPES } from "../utils/businessFormat.js";
/**
 * Kích hoạt chính sách với cơ chế hỏi xác nhận khi xảy ra xung đột phiên bản cũ (HTTP 409).
 * @param {Object} policy - Chính sách cần kích hoạt
 * @param {Function} ask - Hàm mở hộp thoại xác nhận
 * @returns {Promise<boolean>}
 */
export async function activateWithConfirm(policy,ask){
  try{await businessApi.activatePolicy(policy.policyId);return true;}
  catch(e){
    if(!(e instanceof ApiError && e.status===409))throw e;
    const ids=e.data?.details?.conflictingPolicyIds || [];
    const ok=await ask({title:'Thay chính sách đang áp dụng?',message:`API báo xung đột chính sách ${POLICY_TYPES[policy.policyType]?.toLowerCase()||''} cùng loại và phạm vi${ids.length?` (mã ${ids.join(', ')})`:''}. Nếu xác nhận, các bản xung đột sẽ được thay thế theo quy tắc backend.`,actionLabel:'Thay chính sách'});
    if(!ok)return false;
    await businessApi.activatePolicy(policy.policyId,true);return true;
  }
}
/**
 * Tạo chính sách mới và tùy chọn kích hoạt ngay lập tức.
 * @param {Object} body - Dữ liệu chính sách
 * @param {boolean} activate - Có kích hoạt ngay hay không
 * @param {Function} ask - Hàm mở hộp thoại xác nhận
 * @returns {Promise<{ created: Object, active: boolean }>}
 */
export async function createPolicy(body,activate,ask){
  const created=await businessApi.createPolicy(body);
  if(!activate)return {created,active:false};
  return {created,active:await activateWithConfirm(created,ask)};
}
/**
 * Thay thế chính sách hiện hành bằng phiên bản mới.
 * @param {Object} policy - Chính sách cũ
 * @param {Object} body - Dữ liệu chính sách mới
 * @param {Function} ask - Hàm hỏi xác nhận
 * @returns {Promise<boolean>}
 */
export async function replacePolicy(policy,body,ask){
  if(policy.status==='DRAFT'){await businessApi.updatePolicy(policy.policyId,body);return true;}
  const created=await businessApi.createPolicy(body);
  return activateWithConfirm(created,ask);
}
