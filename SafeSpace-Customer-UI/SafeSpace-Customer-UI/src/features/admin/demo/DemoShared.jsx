/** Lượt 6b · đầu trang chung của các công cụ demo: link quay lại trang thẻ chọn, breadcrumb, tiêu đề, nhãn. */
import React from "react";
import { PageHeader } from "../../../shared/components/UI.jsx";
import { href } from "../../../app/router.js";

export function DemoHead({ title, description, children, hub = false }) {
  return <>
    {!hub && <a className="demo-tools__back" href={href("admin/demo")}>← Công cụ demo</a>}
    <p className="customer-records__breadcrumb">SafeSpace / Quản trị hệ thống / Công cụ demo{hub ? "" : ` / ${title}`}</p>
    <PageHeader title={title} description={description}>{children}</PageHeader>
  </>;
}
