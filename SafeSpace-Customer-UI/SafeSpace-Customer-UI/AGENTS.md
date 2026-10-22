# Hướng dẫn AI khi sửa frontend

1. Đọc `../../AGENTS.md` và `../../docs/frontend-naming.md` trước khi sửa.
2. Tra `FRONTEND-MAP.md` để xác định đúng vai trò, chức năng, route, provider và API.
3. Dùng `src/features/<role>/<feature>/<Name>Page.jsx`; mỗi file một màn hình.
4. Code chung Staff/Manager đặt ở `features/facility-operations`; code toàn app ở `app`, tiện ích chung ở `shared`.
5. Không tái tạo các thư mục nguồn cũ. Không giữ file copy hoặc re-export ở đường dẫn cũ.
6. Cập nhật import, test và bản đồ khi thêm/đổi tên màn hình. Giữ nguyên URL, API và localStorage trừ khi task yêu cầu.
7. Chạy `npm run check:structure`, `npm test`, `npm run test:business`, `npm run test:render`, `npm run build` và init theo hướng dẫn gốc.
8. Không tự push/PR/merge. Bàn giao patch chứa cả thao tác xóa file cũ và thêm file mới.
