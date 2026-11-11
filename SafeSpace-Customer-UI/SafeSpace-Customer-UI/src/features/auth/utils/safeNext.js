/**
 * SAFE NEXT URL HELPER - BẢO VỆ ĐIỀU HƯỚNG AN TOÀN SAU ĐĂNG NHẬP
 *
 * Ngăn chặn điều hướng lặp vòng vào các trang login/register hoặc URL nguy hiểm từ query param ?next=...
 */
import React from "react";

/**
 * Xác thực và chuẩn hóa đường dẫn đích sau khi đăng nhập thành công.
 * @param {string|null} next - Đường dẫn lấy từ query string (?next=...)
 * @returns {string} Đường dẫn an toàn (mặc định 'overview' nếu không hợp lệ)
 */
export const safeNext = (next) => (next && !/^(login|register)/.test(next) ? next : "overview");
