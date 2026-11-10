/**
 * CLIENT ROUTER - BỘ ĐIỀU HƯỚNG DỰA TRÊN URL HASH (#/PATH)
 *
 * Tương thích Single Page Application không cần cấu hình server rewrite:
 * - go(path, options): Chuyển trang (hỗ trợ replace history).
 * - href(path): Tạo URL hash an toàn.
 * - useRoute(): Hook lắng nghe sự kiện window.hashchange và bóc tách path/query params.
 */
import { useEffect, useState } from "react";

// Route dạng #/find/1?type=normal  (tiền tố cũ "#/customer/" vẫn được chấp nhận)
export function parseRoute(hash = "") {
  const raw = hash.replace(/^#\/?/, "").replace(/^customer\//, "");
  const [path, search = ""] = raw.split("?");
  const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
  return { raw, page: parts[0] || "home", parts: parts.slice(1), query: new URLSearchParams(search) };
}

/**
 * Hook lắng nghe sự thay đổi của hash URL và bóc tách các thành phần đường dẫn.
 * @returns {{ path: string, parts: string[], query: URLSearchParams }}
 */
export function useRoute() {
  const read = () => (typeof window === "undefined" ? parseRoute("") : parseRoute(window.location.hash));
  const [route, setRoute] = useState(read);
  useEffect(() => {
    let lastPath = read().raw.split("?")[0];
    const onChange = () => {
      const next = read();
      const path = next.raw.split("?")[0];
      setRoute(next);
      // Chỉ cuộn lên đầu khi đổi trang; đổi bộ lọc / ?id trong cùng trang thì giữ vị trí để không bị nhảy
      if (path !== lastPath) window.scrollTo(0, 0);
      lastPath = path;
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const href = (to) => `#/${to}`;

/**
 * Chuyển hướng trang ứng dụng qua URL hash.
 * @param {string} to - Đường dẫn đích
 * @param {{ replace?: boolean }} [options] - Thay thế lịch sử duyệt thay vì đẩy mới
 */
export function go(to, { replace = false } = {}) {
  if (replace) window.location.replace(`#/${to}`);
  else window.location.hash = `/${to}`;
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== "" && v !== false && v !== null && v !== undefined) p.set(k, v === true ? "1" : v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};
