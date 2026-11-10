/**
 * POLICY PUBLICATION VALIDATOR - KIỂM TRA ĐIỀU KIỆN CÔNG BỐ CHÍNH SÁCH THUÊ (B02)
 *
 * Kiểm tra các ràng buộc:
 * - Tỷ lệ khấu trừ đặt cọc phải trong khoảng (0%, 100%].
 * - Mỗi điều khoản trong các mục chính sách không được để trống và không vượt quá 3.000 ký tự.
 * - Xác thực phiên bản trả về sau khi công bố phải lớn hơn phiên bản trước đó.
 */
import {requireRentalPolicy,POLICY_KEYS} from "../../../shared/utils/rentalPolicy.js";
/**
 * Xác thực dữ liệu chính sách trước khi phát hành lên hệ thống.
 * @param {Object} payload - Dữ liệu chính sách cần công bố
 * @returns {{ rate: number, sections: Object, version: number }}
 */
export function requirePublication(payload) {
 const p=requireRentalPolicy(payload);if(!(Number(p.rate)>0&&Number(p.rate)<=100))throw new Error("Tỷ lệ khấu trừ phải lớn hơn 0, tối đa 100%.");
 if(POLICY_KEYS.some(k=>typeof p.sections[k]!=="string"||p.sections[k].length>3000))throw new Error("Mỗi nhóm chính sách cần nội dung, không quá 3.000 ký tự.");return {rate:Number(p.rate),sections:{...p.sections},version:p.version};
}
/**
 * Đối chiếu kết quả trả về từ máy chủ sau khi công bố để đảm bảo phiên bản mới đã được lưu.
 * @param {Object} result - Kết quả API trả về
 * @param {Object} payload - Dữ liệu đã gửi đi
 * @returns {Object} Chính sách hợp lệ đã lưu
 */
export function verifyPublishedPolicy(result,payload) {
 let saved;try{saved=requireRentalPolicy(result);}catch(error){error.uncertain=true;throw error;}if(saved.version<=Number(payload.version)||Number(saved.rate)!==Number(payload.rate)||POLICY_KEYS.some(k=>saved.sections[k]!==payload.sections[k]))throw Object.assign(new Error("Máy chủ chưa xác nhận đúng phiên bản và nội dung đã công bố. Tải lại trước khi gửi tiếp."),{uncertain:true});return saved;
}
