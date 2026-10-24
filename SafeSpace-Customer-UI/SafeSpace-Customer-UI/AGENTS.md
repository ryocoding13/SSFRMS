# Hướng dẫn AI khi sửa frontend

1. Đọc `../../AGENTS.md` và `../../docs/frontend-naming.md` trước khi sửa. Quy định gốc áp dụng cho mọi công cụ AI.
2. Tra `FRONTEND-MAP.md` để xác định vai trò, chức năng, route, provider và API.
3. Dùng `src/features/<role>/<feature>/<Name>Page.jsx`; mỗi file một màn hình.
4. Code chung Staff/Manager ở `features/facility-operations`; code toàn app ở `app`, tiện ích chung ở `shared`.
5. Không tái tạo thư mục nguồn cũ; không giữ file copy/re-export ở đường dẫn cũ để né chuẩn cấu trúc.
6. Cập nhật import, test và bản đồ khi thêm/đổi tên màn hình. Giữ URL, API và localStorage trừ khi task yêu cầu.
7. Chọn kiểm tra theo `../../docs/verification.md`. Sửa source/route/import phải kiểm cấu trúc và build;
   nghiệp vụ/API chạy thêm test liên quan và luồng thành công/lỗi. Sửa tài liệu không bắt buộc build ứng dụng.
8. Trước merge code, thành viên chạy bộ FE: `npm run check:structure`, `npm test`, `npm run test:business`,
   `npm run test:render`, `npm run build`; kiểm backend/tích hợp nếu bị ảnh hưởng. `init` hiện tại chưa bao gồm mọi lệnh FE này.
9. Figma chuẩn về bố cục/tương tác; nghiệp vụ/quyền theo quyết định nhóm. Có mâu thuẫn phải báo để chốt.
10. API lỗi không được báo thành công bằng dữ liệu giả; mock/offline cần được chọn rõ và nhận biết khi kiểm thử.
    Đây là yêu cầu quy trình, không xác nhận code hiện tại đã có đầy đủ dấu hiệu này.
11. AI không tạo commit/push/PR/merge, không đổi tác giả hoặc cấu hình danh tính Git. Thành viên tự thực hiện sau kiểm tra.
12. Bàn giao ZIP/patch có đủ file thêm/sửa/xóa và hướng dẫn áp dụng; không kèm secrets, dependencies hoặc output build.
