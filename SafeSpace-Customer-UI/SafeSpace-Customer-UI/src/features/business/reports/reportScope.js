export function requireReportScope(form,facilities) {
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||"")&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
 if(!validDate(form.from)||!validDate(form.to)||form.from>form.to)throw new Error("Chọn khoảng ngày hợp lệ, ngày bắt đầu không sau ngày kết thúc.");
 if(!["facilities","unit-types"].includes(form.view))throw new Error("Loại báo cáo này chưa hỗ trợ xuất theo phạm vi đã chọn.");
 if(form.facilityId&&!facilities.some(f=>String(f.facilityId)===String(form.facilityId)))throw new Error("Chọn cơ sở có sẵn trong danh sách.");
 return {from:form.from,to:form.to,view:form.view,facilityId:form.facilityId?Number(form.facilityId):""};
}
export function csvForDownload(rows) {
 if(!Array.isArray(rows)||rows.length<=1)throw new Error("Không có dữ liệu trong phạm vi đã chọn.");
 return rows.map(row=>row.map(value=>{let s=String(value??"");if(/^\s*[=+@]/.test(s)||/^[\t\r\n]/.test(s)||(/^\s*-/.test(s)&&!/^\s*-\d+(?:\.\d+)?\s*$/.test(s)))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(",")).join("\r\n");
}
export function requireReportSummary(result,scope) {
 const f=result?.filter;if(!f||String(f.from).slice(0,10)!==scope.from||String(f.to).slice(0,10)!==scope.to||String(f.facilityId??"")!==String(scope.facilityId))throw new Error("Máy chủ chưa xác nhận đúng phạm vi báo cáo.");return result;
}
