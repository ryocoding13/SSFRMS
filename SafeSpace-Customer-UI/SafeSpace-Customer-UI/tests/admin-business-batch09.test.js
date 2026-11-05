import test from 'node:test';
import assert from 'node:assert/strict';
import {activeFacility,assignFacilityChecked,createAccountChecked,roleActionChecked} from '../src/features/admin/utils/accountActions.js';
import {adminApi} from '../src/features/admin/api/adminApi.js';
import {checkedFacilityWrite} from '../src/features/business/facilities/facilityMutation.js';
import {csvForDownload,requireReportScope,requireReportSummary} from '../src/features/business/reports/reportScope.js';
import {requirePublication,verifyPublishedPolicy} from '../src/features/business/policies/policyPublication.js';
import {defaultRentalPolicy} from '../src/features/facility-operations/workflows/workflowModel.js';
import {shortMoney} from '../src/features/business/utils/businessFormat.js';
const user={userId:3,roles:[{roleId:2}]};
test('chỉ chọn cơ sở ACTIVE có thật và ngày phân công hợp lệ trước POST',async()=>{
 const rows=[{facilityId:1,status:'ACTIVE'},{facilityId:2,status:'INACTIVE'}];assert.equal(activeFacility(rows,1).facilityId,1);assert.throws(()=>activeFacility(rows,2));assert.throws(()=>activeFacility(rows,999));let sent=false;
 await assert.rejects(assignFacilityChecked({assignFacility:async()=>{sent=true;}},{assignedFrom:'2026-02-30'}));assert.equal(sent,false);
});
test('phân công đọc lại đúng cơ sở, không báo thành công khi thiếu receipt hoặc chồng assignment',async()=>{
 const body={userId:3,facilityId:1,assignedFrom:'2026-10-28'},row={facilityId:1,assignedFrom:body.assignedFrom,status:'ACTIVE'},api={assignFacility:async()=>({}),userFacilities:async()=>[row]};assert.equal((await assignFacilityChecked(api,body)).length,1);
 for(const result of [[],[{...row,facilityId:2}],[row,{...row,facilityId:2}]])await assert.rejects(assignFacilityChecked({...api,userFacilities:async()=>result},body),e=>e.uncertain);
});
test('đổi vai trò dùng một thao tác nguyên tử, không gán/gỡ nối tiếp; đọc lại tập vai trò',async()=>{
 const calls=[],api={changeRole:async(...args)=>calls.push(['change',...args]),assignRole:async()=>calls.push('assign'),revokeRole:async()=>calls.push('revoke'),user:async()=>({userId:3,roles:[{roleId:4}]})};
 await roleActionChecked(api,user,'change',4,2);assert.equal(calls.length,1);assert.deepEqual(calls[0],['change',3,{previousRoleId:2,roleId:4,expectedRoleIds:[2]}]);
 await assert.rejects(roleActionChecked({...api,user:async()=>user},user,'change',4,2),e=>e.uncertain);
});
test('API đổi vai trò 404 không fallback các endpoint gán/gỡ',async()=>{
 const old=globalThis.fetch,calls=[];globalThis.fetch=async(url,opt)=>{calls.push([url,opt.method]);return new Response('{}',{status:404});};try{await assert.rejects(adminApi.changeRole(3,{previousRoleId:2,roleId:4}),/chưa hỗ trợ/);assert.equal(calls.length,1);assert.ok(calls[0][0].endsWith('/api/admin/users/3/role-change'));}finally{globalThis.fetch=old;}
});
test('cấp lại/gỡ kiểm vai trò tồn tại và giữ các vai trò khác',async()=>{
 let current={userId:3,roles:[{roleId:2},{roleId:5}]};const api={assignRole:async(_,id)=>current.roles.push({roleId:id}),revokeRole:async(_,id)=>{current.roles=current.roles.filter(r=>r.roleId!==id);},user:async()=>current};
 const next=await roleActionChecked(api,structuredClone(current),'grant',4);assert.deepEqual(next.roles.map(r=>r.roleId),[2,5,4]);await assert.rejects(roleActionChecked(api,next,'grant',4));const out=await roleActionChecked(api,structuredClone(next),'revoke',2);assert.deepEqual(out.roles.map(r=>r.roleId),[5,4]);
});
test('tạo tài khoản nhưng phân công lỗi trả kết quả một phần, không tạo tài khoản lần hai',async()=>{
 const body={username:'nv',fullName:'Nhân viên',email:'nv@example.com',initialRoleId:2},created={...body,userId:3,roles:[{roleId:2}]};let count=0;const api={createUser:async()=>{count++;return created;},assignFacility:async()=>{throw new Error('Lỗi phân công');}};
 const out=await createAccountChecked(api,body,{id:1,from:'2026-10-28'});assert.equal(count,1);assert.equal(out.user.userId,3);assert.match(out.facilityError,/Lỗi/);await assert.rejects(createAccountChecked({...api,createUser:async()=>({ok:true})},body,null),e=>e.uncertain);
});
test('cơ sở ghi xong nhưng readback thiếu/sai phải tải lại',async()=>{
 const api={facilities:async()=>[{facilityId:1,status:'ACTIVE',name:'A'}]};assert.deepEqual(await checkedFacilityWrite(api,async()=>({facilityId:1}),{name:'A'}),{facilityId:1});await assert.rejects(checkedFacilityWrite(api,async()=>({}),{status:'INACTIVE'},1),e=>e.uncertain);
});
test('phạm vi báo cáo kiểm ngày thực/cơ sở/view và summary phải khớp bộ lọc',()=>{
 const f={from:'2026-10-01',to:'2026-10-28',facilityId:'1',view:'facilities'},scope=requireReportScope(f,[{facilityId:1}]);assert.equal(scope.facilityId,1);
 for(const patch of [{from:'2026-02-30'},{to:'2026-09-01'},{facilityId:'999'},{view:'revenue-trend'}])assert.throws(()=>requireReportScope({...f,...patch},[{facilityId:1}]));assert.doesNotThrow(()=>requireReportSummary({filter:scope},scope));assert.throws(()=>requireReportSummary({filter:{...scope,facilityId:2}},scope));
});
test('CSV không biến ô có khoảng trắng/công thức thành formula, giữ số âm và quote/newline',()=>{
 const csv=csvForDownload([['Tên','Giá'],['  =HYPERLINK("x")','-32'],['a\nb','+cmd']]);assert.ok(csv.includes("'  =HYPERLINK"));assert.ok(csv.includes('"-32"'));assert.ok(csv.includes("'+cmd"));assert.ok(csv.includes('"a\nb"'));assert.throws(()=>csvForDownload([['Tên']]));assert.equal(shortMoney(undefined),'Chưa có dữ liệu');assert.equal(shortMoney(0),'0 đ');
});
test('công bố đúng DTO/version, không nhận 200 thiếu/sai nội dung là đã lưu',()=>{
 const draft=defaultRentalPolicy(),payload=requirePublication(draft);assert.equal(typeof payload.rate,'number');assert.doesNotThrow(()=>verifyPublishedPolicy({...payload,version:2},payload));assert.throws(()=>requirePublication({...draft,sections:{}}));for(const result of [{},payload,{...payload,version:2,rate:10}])assert.throws(()=>verifyPublishedPolicy(result,payload));
});
