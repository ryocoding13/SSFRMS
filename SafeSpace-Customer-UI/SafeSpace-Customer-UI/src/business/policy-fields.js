import { policyValueLabel, replacementOf, parseMoney } from './format.js';
export const POLICY_SECTIONS = [
  {title:'Đặt cọc',fields:[{key:'deposit',label:'Mức đặt cọc mặc định',type:'DEPOSIT',numeric:true},{key:'refund',label:'Hoàn cọc trong vòng',type:'RETURN'}]},
  {title:'Gia hạn',fields:[{key:'reminder',label:'Thông báo trước khi hết hạn',type:'RENEWAL',numeric:true},{key:'renewals',label:'Số lần gia hạn tối đa',type:'RENEWAL'}]},
  {title:'Huỷ đặt chỗ & Trả kho',fields:[{key:'cancel',label:'Phí huỷ trước ngày nhận kho',type:'CANCELLATION'},{key:'inspection',label:'Thời gian kiểm tra sau khi trả kho',type:'RETURN'}]},
  {title:'Xử lý quá hạn',fields:[{key:'grace',label:'Số ngày ân hạn trước khi khoá quyền truy cập',type:'OVERDUE'},{key:'overdue',label:'Phí phạt quá hạn / ngày',type:'OVERDUE',numeric:true}]},
];
export const policyFields = POLICY_SECTIONS.flatMap(s=>s.fields);
export function fieldPolicy(policies,field,day){
  return policies.filter(p=>p.status==='ACTIVE' && p.facilityId==null && p.unitTypeId==null && p.policyType===field.type
    && p.effectiveFrom<=day && (!p.effectiveTo || p.effectiveTo>=day)).sort((a,b)=>b.effectiveFrom.localeCompare(a.effectiveFrom)||b.policyId-a.policyId)[0];
}
function descriptionField(p,field){
  const prefix=field.label+': ';
  return p?.ruleDescription?.split('\n').find(line=>line.startsWith(prefix))?.slice(prefix.length);
}
export function fieldValue(p,field){
  if(!p)return '';
  if(field.key==='reminder' && p.calculationType==='FIXED')return `${p.value} ngày`;
  if(field.numeric)return policyValueLabel(p,field.key==='overdue'?'/ ngày':'');
  const explicit=descriptionField(p,field);if(explicit!==undefined)return explicit;
  if(['refund','cancel'].includes(field.key) && !p.ruleDescription?.includes('Thời gian kiểm tra sau khi trả kho: '))return p.ruleDescription||'';
  return '';
}
function numericValue(p,field,text){
  const raw=text.replace(/tháng tiền thuê|(?:\/\s*)?ngày|[đ₫%]/g,'').trim();
  if(!/^[\d.,\s]+$/.test(raw))throw new Error(`${field.label}: nhập một mức cụ thể, ví dụ 500.000đ hoặc 1 tháng tiền thuê.`);
  const n=(field.key==='deposit' && /tháng/.test(text) || p?.calculationType==='PERCENTAGE')?Number(raw.replace(',','.')):parseMoney(raw);
  if(!Number.isFinite(n)||n<0||p?.calculationType==='PERCENTAGE'&&n>100)throw new Error(`${field.label}: giá trị không hợp lệ.`);
  return n;
}
// One job per policy TYPE/scope, matching the API's conflict rule. Extra guidance
// shares ruleDescription with that policy rather than creating conflicting rows.
export function policyJobs(policies,drafts,day){
  const types=[...new Set(policyFields.filter(f=>f.key in drafts).map(f=>f.type))];
  return types.map(type=>{
    const fields=policyFields.filter(f=>f.type===type),p=fieldPolicy(policies,fields[0],day);
    const edited=fields.filter(f=>f.key in drafts);
    for(const f of edited)if(!String(drafts[f.key]).trim())throw new Error(`${f.label}: không được để trống.`);
    const numeric=fields.find(f=>f.numeric),values={};
    if(numeric && numeric.key in drafts){
      if(p?.calculationType==='RANGE')throw new Error(`${numeric.label}: chính sách khoảng giá hiện tại cần được kiểm tra trước khi sửa.`);
      if(p?.calculationType==='RULE')values.ruleDescription=drafts[numeric.key].trim();
      else values.value=numericValue(p,numeric,drafts[numeric.key]);
    }
    const textFields=fields.filter(f=>!f.numeric);
    if(textFields.some(f=>f.key in drafts)){
      const knownPrefixes=fields.map(f=>f.label+': ');
      const existing=(p?.ruleDescription||'').split('\n').filter(line=>line && !knownPrefixes.some(prefix=>line.startsWith(prefix)));
      // Existing unstructured RETURN/CANCELLATION description is surfaced in its first field.
      const unstructuredOwned=fields.some(f=>['refund','cancel'].includes(f.key));
      const preserved=unstructuredOwned?[]:existing;
      values.ruleDescription=[...preserved,...textFields.map(f=>[f.label,String(drafts[f.key]??fieldValue(p,f)).trim()]).filter(([,v])=>v).map(([label,v])=>`${label}: ${v}`)].join('\n');
    }
    const calculationType=p?.calculationType || (numeric?'FIXED':'RULE');
    if(!p && numeric && values.value===undefined){
      // Do not invent a fee/reminder/deposit amount just to save a text instruction.
      throw new Error(`Vui lòng thiết lập ${numeric.label.toLowerCase()} trước khi lưu quy định cùng nhóm.`);
    }
    const body=p?replacementOf(p,values,day):{policyName:fields[0].label,policyType:type,calculationType,value:null,minValue:null,maxValue:null,ruleDescription:values.ruleDescription||fields.map(f=>[f.label,String(drafts[f.key]??'').trim()]).filter(([,v])=>v).map(([label,v])=>`${label}: ${v}`).join('\n'),facilityId:null,unitTypeId:null,effectiveFrom:day,effectiveTo:null,...values};
    return {p,body,keys:edited.map(f=>f.key)};
  });
}
