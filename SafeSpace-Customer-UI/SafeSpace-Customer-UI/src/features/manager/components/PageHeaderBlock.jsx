/**
 * PAGE HEADER BLOCK - KHỐI TIÊU ĐỀ TRANG CHUẨN KHU VỰC QUẢN LÝ
 */
import React from "react";

/**
 * Component hiển thị breadcrumb, tiêu đề lớn và mô tả ngắn gọn cho các trang quản lý.
 * @param {{ title: string, subtitle?: string, action?: React.ReactNode }} props
 */
export function PageHeaderBlock({ title, text }) {
  return (
    <header className="page-header page-header--tight">
      <div>
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
    </header>
  );
}
