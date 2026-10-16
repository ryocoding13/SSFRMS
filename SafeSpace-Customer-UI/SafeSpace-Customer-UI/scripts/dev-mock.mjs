// Chạy giao diện ở chế độ API với máy chủ giả lập (không cần .NET / SQL Server):
//   npm run dev:mock
// → API giả lập ở http://localhost:5151 (in ra từng lời gọi API) + giao diện ở http://127.0.0.1:5173
import { createServer } from "vite";
import { startMockApi } from "../mock/mock-api.mjs";

const API_PORT = Number(process.env.MOCK_API_PORT) || 5151;
const AUTOPAY = Number(process.env.MOCK_PAYOS_AUTOPAY ?? 10);

// Biến VITE_* có sẵn trong môi trường được Vite ưu tiên hơn file .env
process.env.VITE_USE_API = "true";
process.env.VITE_API_URL = `http://localhost:${API_PORT}`;

try {
  // PayOS giả lập tự báo "đã thanh toán" sau 10 giây (đổi bằng MOCK_PAYOS_AUTOPAY, 0 = chỉ khi gọi /__payos/paid)
  await startMockApi(API_PORT, { verbose: true, ops: process.env.MOCK_OPS === "1", payosAutoPaySeconds: AUTOPAY });
} catch (e) {
  console.error(`Không mở được cổng ${API_PORT} (có thể backend thật đang chạy). Đặt MOCK_API_PORT=5199 rồi chạy lại.`);
  process.exit(1);
}
const vite = await createServer({ server: { host: "127.0.0.1", port: 5173 } });
await vite.listen();
console.log("\n  API giả lập (theo StorageProject.Api):  http://localhost:" + API_PORT);
vite.printUrls();
console.log(`
  Tài khoản có sẵn:
    admin       / Admin@123      → Quản trị hệ thống (#/admin)
    customer01  / Customer@123   → Khách hàng
    staff01     / Staff@123      → Nhân viên cơ sở (#/staff)
    manager01   / Manager@123    → Quản lý cơ sở (#/manager) — chỉ khi chạy với MOCK_OPS=1
  MOCK_OPS=1 bật các endpoint /api/ops/* (giống backend thật, xem docs/facility-ops-api.md).
  Không bật: khu vận hành dùng dữ liệu cục bộ trong trình duyệt.
  PayOS giả lập: mã QR tự được "thanh toán" sau ${AUTOPAY} giây (MOCK_PAYOS_AUTOPAY=0 để tắt; gọi
    http://localhost:${API_PORT}/__payos/paid để báo đã trả ngay). Máy quét cửa kho: #/door.
  Mỗi lời gọi API sẽ hiện bên dưới (xanh = thành công, đỏ = lỗi từ máy chủ).
`);
