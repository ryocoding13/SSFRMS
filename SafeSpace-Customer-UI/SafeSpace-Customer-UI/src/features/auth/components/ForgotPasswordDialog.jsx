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
    <p className="modal__text">Nhận mã xác nhận qua email đã đăng ký để đặt mật khẩu mới.</p>
    <div className="modal__actions"><LinkButton to="reset-password" onClick={onClose}>Đặt lại mật khẩu</LinkButton><Button variant="outline" onClick={onClose}>Đóng</Button></div>
  </Modal>;
}
