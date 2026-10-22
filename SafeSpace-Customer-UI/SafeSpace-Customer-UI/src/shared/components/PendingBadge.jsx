import React from "react";

export default function PendingBadge({ count = 0 }) {
  const value = Math.max(0, Number(count) || 0);
  return value > 0 ? <span className="pending-badge" aria-label={`${value} đang chờ`}>{value > 99 ? "99+" : value}</span> : null;
}
