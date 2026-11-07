import { useEffect, useState } from "react";

// Đồng hồ cập nhật mỗi `ms` mili giây (dùng cho đếm ngược ở màn C04)
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const shortName = (facility) => (facility?.name || "").replace(/^SafeSpace\s+/, "");

// Trả về tên cơ sở hiển thị (dùng tên chuẩn của cơ sở, ví dụ "SafeSpace Nguyễn Lương Bằng", không tự gán tên quận)
export const siteLabel = (facility) => facility?.name || "SafeSpace";
