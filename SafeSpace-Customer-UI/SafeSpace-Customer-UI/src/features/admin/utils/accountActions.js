export const roleIds=user=>(user.roles||[]).map(r=>Number(r.roleId)).sort((a,b)=>a-b);
export function activeFacility(facilities,id) {const item=facilities.find(f=>String(f.facilityId)===String(id)&&f.status==="ACTIVE");if(!item)throw new Error("Chọn cơ sở đang hoạt động từ danh sách.");return item;}
const uncertain=message=>Object.assign(new Error(message),{uncertain:true});
export async function assignFacilityChecked(api,body) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(body.assignedFrom||"")||!Number.isFinite(Date.parse(`${body.assignedFrom}T00:00:00Z`))||new Date(`${body.assignedFrom}T00:00:00Z`).toISOString().slice(0,10)!==body.assignedFrom)throw new Error("Chọn ngày phân công hợp lệ.");
 await api.assignFacility(body);
 try {const rows=await api.userFacilities(body.userId);if(!Array.isArray(rows)||rows.filter(r=>r.status==="ACTIVE"&&(!r.assignedTo||String(r.assignedTo).slice(0,10)>=body.assignedFrom)).length!==1||!rows.some(r=>r.status==="ACTIVE"&&(r.userId==null||r.userId===body.userId)&&r.facilityId===body.facilityId&&String(r.assignedFrom).slice(0,10)===body.assignedFrom))throw new Error();return rows;}
 catch {throw uncertain("Chưa xác minh được phân công cơ sở. Tải lại tài khoản trước khi gửi tiếp.");}
}
export async function roleActionChecked(api,user,kind,targetRoleId,previousRoleId) {
 const before=roleIds(user),target=Number(targetRoleId),previous=Number(previousRoleId);
 if(!Number.isSafeInteger(target)||target<=0)throw new Error("Chọn vai trò hợp lệ.");
 if(kind==="change") {
  if(!before.includes(previous)||before.includes(target))throw new Error("Chọn đúng vai trò cần thay và vai trò mới chưa có.");
  await api.changeRole(user.userId,{previousRoleId:previous,roleId:target,expectedRoleIds:before});
 } else if(kind==="grant") {if(before.includes(target))throw new Error("Tài khoản đã có vai trò này.");await api.assignRole(user.userId,target);}
 else if(kind==="revoke") {if(!before.includes(target))throw new Error("Vai trò không còn trên tài khoản.");await api.revokeRole(user.userId,target);}
 else throw new Error("Thao tác vai trò không hợp lệ.");
 const expected=(kind==="change"?before.filter(id=>id!==previous).concat(target):kind==="grant"?before.concat(target):before.filter(id=>id!==target)).sort((a,b)=>a-b);
 try {const result=await api.user(user.userId);if(result?.userId!==user.userId||JSON.stringify(roleIds(result))!==JSON.stringify(expected))throw new Error();return result;}
 catch {throw uncertain("Chưa xác minh được vai trò sau thao tác. Tải lại tài khoản; không gửi lặp.");}
}
export async function createAccountChecked(api,body,facilityId,shouldContinue=()=>true) {
 if(!shouldContinue())throw new Error("Phiên làm việc đã thay đổi.");
 const created=await api.createUser(body);
 if(!Number.isSafeInteger(created?.userId)||created.userId<=0||created.username!==body.username||created.fullName!==body.fullName||created.email!==body.email||!created.roles?.some(r=>r.roleId===body.initialRoleId))throw uncertain("Máy chủ chưa trả thông tin tài khoản vừa tạo hợp lệ. Kiểm tra danh sách trước khi tạo lại.");
 let facilityError=null;
 if(facilityId&&!shouldContinue())return {user:created,facilityError:"Phiên làm việc đã thay đổi; kiểm tra phân công trong hồ sơ."};
 if(facilityId)try{await assignFacilityChecked(api,{userId:created.userId,facilityId:facilityId.id,assignedFrom:facilityId.from,assignedTo:null});}catch(error){facilityError=error.message;}
 return {user:created,facilityError};
}
