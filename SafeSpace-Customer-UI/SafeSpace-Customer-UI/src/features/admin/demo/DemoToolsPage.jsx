/**
 * DEMO TOOLS PAGE - TRANG THẺ CHỌN CÔNG CỤ DEMO (Lượt 6b · Figma A-DEMO)
 * Ấn "Công cụ demo" trên thanh menu admin → 4 thẻ: Máy quét, Chỉnh giá, Chỉnh ngày hợp đồng, Nhật ký cửa.
 * Không có hàng tab dưới menu; mỗi công cụ là một trang riêng có link "← Công cụ demo".
 */
import React from "react";
import { Tag } from "../../../shared/components/UI.jsx";
import { href } from "../../../app/router.js";
import { DemoHead } from "./DemoShared.jsx";
import { TOOLS } from "./demoModel.js";
import "./demo-tools.css";

export default function DemoToolsPage() {
  return (
    <main className="container page demo-tools">
      <DemoHead hub title="Công cụ demo" description="Chọn công cụ để trình diễn các tình huống: mở và đóng cửa kho, đổi giá, đổi ngày hợp đồng và xem nhật ký cửa.">
        <Tag tone="gray">{TOOLS.length} công cụ</Tag>
      </DemoHead>
      <div className="demo-hub">
        {TOOLS.map(([key, icon, title, desc, meta, link], i) => (
          <a key={key} className="panel demo-hub__card" href={href(`admin/demo/${key}`)} style={{ animationDelay: `${i * 50}ms` }}>
            <span className="demo-hub__head"><span className="demo-hub__icon" aria-hidden="true">{icon}</span><strong>{title}</strong></span>
            <span className="demo-hub__desc">{desc}</span>
            <span className="demo-hub__foot"><small>{meta}</small><span className="demo-hub__link">{link}</span></span>
          </a>
        ))}
      </div>
      <p className="demo-hub__note">Mọi thay đổi ở Chỉnh giá và Chỉnh ngày hợp đồng được ghi vào Nhật ký hoạt động kèm giá trị trước/sau và người chỉnh.</p>
    </main>
  );
}
