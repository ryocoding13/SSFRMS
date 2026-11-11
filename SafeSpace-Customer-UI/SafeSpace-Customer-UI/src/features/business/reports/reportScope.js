/**
 * REPORT SCOPE VALIDATOR - XÁC THỰC PHẠM VI BÁO CÁO VÀ CHUẨN HÓA DỮ LIỆU CSV (B04)
 *
 * Chức năng:
 * - requireReportScope: Kiểm tra định dạng ngày, khoảng thời gian hợp lệ và cơ sở có thật.
 * - csvForDownload: Chuyển mảng dữ liệu thành chuỗi CSV chuẩn hóa RFC 4180, xử lý an toàn
 *   các ký tự đặc biệt nguy hiểm để phòng ngừa CSV Injection trong Excel.
 * - requireReportSummary: Kiểm tra xác thực lại dữ liệu báo cáo trả về từ server khớp đúng phạm vi.
 */
/**
 * Kiểm tra và chuẩn hóa phạm vi tham số truy vấn báo cáo.
 * @param {Object} form - Tham số từ form
 * @param {Array} facilities - Danh mục cơ sở
 * @returns {{ from: string, to: string, view: string, facilityId: number|string }}
 */
export function requireReportScope(form,facilities) {
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||"")&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
 if(!validDate(form.from)||!validDate(form.to)||form.from>form.to)throw new Error("Chọn khoảng ngày hợp lệ, ngày bắt đầu không sau ngày kết thúc.");
 if(!["facilities","unit-types"].includes(form.view))throw new Error("Loại báo cáo này chưa hỗ trợ xuất theo phạm vi đã chọn.");
 if(form.facilityId&&!facilities.some(f=>String(f.facilityId)===String(form.facilityId)))throw new Error("Chọn cơ sở có sẵn trong danh sách.");
 return {from:form.from,to:form.to,view:form.view,facilityId:form.facilityId?Number(form.facilityId):""};
}
/**
 * Chuyển đổi dữ liệu bảng thành chuỗi nội dung file CSV có chống CSV Injection.
 * @param {Array<Array<any>>} rows - Mảng 2 chiều chứa các dòng dữ liệu
 * @returns {string} Chuỗi CSV mã hóa UTF-8
 */
export function csvForDownload(rows) {
 if(!Array.isArray(rows)||rows.length<=1)throw new Error("Không có dữ liệu trong phạm vi đã chọn.");
 return rows.map(row=>row.map(value=>{let s=String(value??"");if(/^\s*[=+@]/.test(s)||/^[\t\r\n]/.test(s)||(/^\s*-/.test(s)&&!/^\s*-\d+(?:\.\d+)?\s*$/.test(s)))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(",")).join("\r\n");
}
/**
 * Kiểm tra đối chiếu kết quả báo cáo từ máy chủ khớp với phạm vi đã yêu cầu.
 * @param {Object} result - Kết quả trả về từ API
 * @param {Object} scope - Phạm vi kỳ vọng
 * @returns {Object} Kết quả hợp lệ
 */
export function requireReportSummary(result,scope) {
 const f=result?.filter;if(!f||String(f.from).slice(0,10)!==scope.from||String(f.to).slice(0,10)!==scope.to||String(f.facilityId??"")!==String(scope.facilityId))throw new Error("Máy chủ chưa xác nhận đúng phạm vi báo cáo.");return result;
}
