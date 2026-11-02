export async function checkedFacilityWrite(api,perform,expected,id) {
 const result=await perform(),target=id??result?.facility?.facilityId??result?.facilityId;
 try {
  if(!Number.isSafeInteger(Number(target))||Number(target)<=0)throw new Error();
  const rows=await api.facilities(),actual=rows.find(f=>f.facilityId===Number(target));if(!actual)throw new Error();
  for(const [key,value] of Object.entries(expected)) {
   let a=actual[key],b=value;
   if(["openingTime","closingTime"].includes(key)){a=String(a||"").slice(0,5);b=String(b||"").slice(0,5);}
   if(key==="contactPhone"){a=String(a||"").replace(/[\s.-]/g,"");b=String(b||"").replace(/[\s.-]/g,"");}
   if(a!==b)throw new Error();
  }
  return result;
 } catch {throw Object.assign(new Error("Chưa xác minh được thay đổi cơ sở. Tải lại danh sách trước khi gửi tiếp."),{uncertain:true});}
}
