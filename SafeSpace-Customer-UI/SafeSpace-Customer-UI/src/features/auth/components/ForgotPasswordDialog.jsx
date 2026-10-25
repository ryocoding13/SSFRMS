import React from "react";
import { Button, LinkButton, Modal } from "../../../shared/components/UI.jsx";

export function ForgotPassword({ onClose }) {
  return <Modal title="Quên mật khẩu?" onClose={onClose}>
    <p className="modal__text">Mở biểu mẫu để nhận mã xác nhận qua email. Nếu máy chủ chưa hỗ trợ, liên hệ quản trị viên hoặc nhân viên cơ sở.</p>
    <div className="modal__actions"><LinkButton to="reset-password" onClick={onClose}>Đặt lại mật khẩu</LinkButton><Button variant="outline" onClick={onClose}>Đóng</Button></div>
  </Modal>;
}
