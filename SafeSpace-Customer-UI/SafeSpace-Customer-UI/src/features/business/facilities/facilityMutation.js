/**
 * FACILITY MUTATION HELPER - XÁC THỰC KẾT QUẢ GHI DỮ LIỆU CƠ SỞ (B05)
 *
 * Kiểm tra xác thực lại (readback check):
 * - Đảm bảo dữ liệu sau khi PUT/POST đã được lưu thành công trên cơ sở dữ liệu trước khi cập nhật UI.
 * - Ngăn chặn tình trạng hiển thị sai lệch khi mạng bị ngắt quãng hoặc cập nhật bất đồng bộ.
 */
/**
 * Thực thi hàm ghi cơ sở và đối chiếu lại dữ liệu trên máy chủ để đảm bảo tính nhất quán.
 * @param {Object} api - businessApi client
 * @param {Function} perform - Thao tác gọi API ghi
 * @param {Object} expected - Các trường dữ liệu kỳ vọng sau khi ghi
 * @param {number} [id] - ID cơ sở
 * @returns {Promise<any>}
 */
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
