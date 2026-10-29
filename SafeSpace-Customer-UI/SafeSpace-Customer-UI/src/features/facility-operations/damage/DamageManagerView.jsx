import React from "react";
import { Empty, LinkButton } from "../../../shared/components/UI.jsx";
import { DAMAGE_STATUS } from "./damageModel.js";
export function DamageCaseList({ items, route, inspect = false }) {
  return items.length ? <div className="customer-records__list">{items.map(item => <article className="panel customer-detail__card damage-list-item" key={item.id}><div><h2>{item.customer || item.ownerId} · Kho {item.unit}</h2><p>{item.contractId} · {item.item}</p><p className="hint">{DAMAGE_STATUS[item.status]}</p></div><LinkButton to={`${route}?id=${encodeURIComponent(item.id)}`} variant="outline">{inspect?"Xem kết quả / kiểm tra":"Xem phản hồi"}</LinkButton></article>)}</div> : <Empty title="Chưa có hồ sơ hư hỏng" text="Hồ sơ chỉ hiển thị trong cơ sở bạn phụ trách." />;
}
