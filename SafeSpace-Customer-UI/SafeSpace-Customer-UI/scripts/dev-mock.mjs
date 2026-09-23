// Chạy giao diện ở chế độ API với máy chủ giả lập (không cần .NET / SQL Server):
//   npm run dev:mock
// → API giả lập ở http://localhost:5151 (in ra từng lời gọi API) + giao diện ở http://127.0.0.1:5173
import { createServer } from "vite";
import { startMockApi } from "../mock/mock-api.mjs";

const API_PORT = Number(process.env.MOCK_API_PORT) || 5151;

// Biến VITE_* có sẵn trong môi trường được Vite ưu tiên hơn file .env
process.env.VITE_USE_API = "true";
process.env.VITE_API_URL = `http://localhost:${API_PORT}`;

try {
  await startMockApi(API_PORT, { verbose: true });
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
  Mỗi lời gọi API sẽ hiện bên dưới (xanh = thành công, đỏ = lỗi từ máy chủ).
`);
