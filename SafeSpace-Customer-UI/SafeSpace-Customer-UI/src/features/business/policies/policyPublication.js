import {requireRentalPolicy,POLICY_KEYS} from "../../../shared/utils/rentalPolicy.js";
export function requirePublication(payload) {
 const p=requireRentalPolicy(payload);if(!(Number(p.rate)>0&&Number(p.rate)<=100))throw new Error("Tỷ lệ khấu trừ phải lớn hơn 0, tối đa 100%.");
 if(POLICY_KEYS.some(k=>typeof p.sections[k]!=="string"||p.sections[k].length>3000))throw new Error("Mỗi nhóm chính sách cần nội dung, không quá 3.000 ký tự.");return {rate:Number(p.rate),sections:{...p.sections},version:p.version};
}
export function verifyPublishedPolicy(result,payload) {
 let saved;try{saved=requireRentalPolicy(result);}catch(error){error.uncertain=true;throw error;}if(saved.version<=Number(payload.version)||Number(saved.rate)!==Number(payload.rate)||POLICY_KEYS.some(k=>saved.sections[k]!==payload.sections[k]))throw Object.assign(new Error("Máy chủ chưa xác nhận đúng phiên bản và nội dung đã công bố. Tải lại trước khi gửi tiếp."),{uncertain:true});return saved;
}
