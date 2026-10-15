import { businessApi } from '../api/business.js';
import { ApiError } from '../api/http.js';
import { POLICY_TYPES } from './format.js';
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
export async function createPolicy(body,activate,ask){
  const created=await businessApi.createPolicy(body);
  if(!activate)return {created,active:false};
  return {created,active:await activateWithConfirm(created,ask)};
}
export async function replacePolicy(policy,body,ask){
  if(policy.status==='DRAFT'){await businessApi.updatePolicy(policy.policyId,body);return true;}
  const created=await businessApi.createPolicy(body);
  return activateWithConfirm(created,ask);
}
