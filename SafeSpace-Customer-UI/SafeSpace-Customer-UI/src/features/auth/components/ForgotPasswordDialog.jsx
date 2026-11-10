/**
 * FORGOT PASSWORD DIALOG - HỘP THOẠI QUÊN MẬT KHẨU
 *
 * Hướng dẫn người dùng chuyển hướng tới trang đặt lại mật khẩu qua email (/reset-password)
 * hoặc liên hệ trực tiếp với quản trị viên/nhân viên cơ sở khi cần trợ giúp.
 */
import React from "react";
import { Button, LinkButton, Modal } from "../../../shared/components/UI.jsx";

/**
 * Modal popup hướng dẫn xử lý khi quên mật khẩu đăng nhập.
 * @param {{ onClose: Function }} props
 */
export function ForgotPassword({ onClose }) {
  return <Modal title="Quên mật khẩu?" onClose={onClose}>
    <p className="modal__text">Mở biểu mẫu để nhận mã xác nhận qua email. Nếu máy chủ chưa hỗ trợ, liên hệ quản trị viên hoặc nhân viên cơ sở.</p>
    <div className="modal__actions"><LinkButton to="reset-password" onClick={onClose}>Đặt lại mật khẩu</LinkButton><Button variant="outline" onClick={onClose}>Đóng</Button></div>
  </Modal>;
}
