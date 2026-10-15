// Frontend-only preview: mock requests follow operations-api(3).md; no .NET/SQL Server needed.
import { createServer } from 'vite';
import { startMockApi } from '../mock/mock-api.mjs';
const apiPort = Number(process.env.MOCK_API_PORT) || 5199;
process.env.VITE_USE_API = 'true';
process.env.VITE_API_URL = `http://localhost:${apiPort}`;
const {server} = await startMockApi(apiPort, {business:true,ops:true});
const vite = await createServer({server:{host:'127.0.0.1',port:5173}});
await vite.listen();vite.printUrls();
console.log('Đăng nhập ops01 / Ops@123 để mở #/business. Chế độ này chỉ dùng API giả lập trong bộ nhớ để kiểm tra frontend.');
const close = async () => { await vite.close();server.close();process.exit(0); };
process.on('SIGINT',close);process.on('SIGTERM',close);
