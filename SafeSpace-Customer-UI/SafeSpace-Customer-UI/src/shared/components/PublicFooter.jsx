import React from "react";
import { href } from "../../app/router.js";

// Figma "SafeSpace / Footer công khai": dùng chung cho trang chủ và các màn chưa đăng nhập
// (đăng nhập, đăng ký, quên mật khẩu, bảng giá, hướng dẫn). Hotline dùng khi khách quên cả mật khẩu và email.
export const SUPPORT_HOTLINE = "0825123676";

export function PublicFooter({ hours = "06:00–22:00", address = "Số 12 Nguyễn Lương Bằng, Quận 7" }) {
  const headOffice = String(address || "").trim();
  const addressLabel = /^Trụ sở\s*:/i.test(headOffice) ? headOffice : `Trụ sở : ${headOffice}`;
  return (
    <footer className="home-footer">
      <div className="container">
        <div className="home-footer__cols">
          <div>
            <strong className="home-footer__brand">SafeSpace</strong>
            <p>Kho tự phục vụ tại TP. Hồ Chí Minh.</p>
            <p>Ra vào {hours} · Camera 24/7</p>
          </div>
          <nav aria-label="Khám phá">
            <strong>Khám phá</strong>
            <a href={href("find")}>Tìm kho theo khu vực</a>
            <a href={href("pricing")}>Bảng giá</a>
            <a href={href("guide")}>Hướng dẫn đặt kho</a>
          </nav>
          <nav aria-label="Hỗ trợ">
            <strong>Hỗ trợ</strong>
            <a href={href("guide")}>Câu hỏi thường gặp</a>
            <a href={href("support")}>Gửi yêu cầu hỗ trợ</a>
            <a href={href("policies")}>Chính sách thuê kho</a>
            <a href={href("reset-password")}>Quên mật khẩu</a>
          </nav>
          <div className="home-footer__contact">
            <strong>Liên hệ &amp; hỗ trợ khẩn cấp</strong>
            <a className="home-footer__hotline" href={`tel:${SUPPORT_HOTLINE.replace(/\s/g, "")}`}>Hotline: {SUPPORT_HOTLINE}</a>
            <p className="home-footer__note">Quên mật khẩu và cả email đăng ký? Gọi hotline để xác minh danh tính và khôi phục tài khoản.</p>
            <p>{addressLabel}</p>
          </div>
        </div>
        <p className="home-footer__copy">© {new Date().getFullYear()} SafeSpace. Hệ thống quản lý và cho thuê kho tự phục vụ.</p>
      </div>
    </footer>
  );
}
