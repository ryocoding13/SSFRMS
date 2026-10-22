# Quy tắc cấu trúc và đặt tên frontend

Áp dụng cho mọi người và AI sửa FE. Đường dẫn bên dưới tính từ thư mục FE `SafeSpace-Customer-UI/SafeSpace-Customer-UI/`.

## Chọn chỗ đặt code

1. Tìm chức năng trong `FRONTEND-MAP.md` trước khi tạo file. Mở route và lần theo import.
2. Màn hình đặt ở `src/features/<vai-tro>/<chuc-nang>/<Ten>Page.jsx`.
3. Vai trò: `customer`, `staff`, `manager`, `business`, `admin`. Đăng nhập dùng chung ở `auth`.
4. Phần nghiệp vụ dùng chung riêng cho Staff/Manager nằm ở `facility-operations`; không nhân đôi store/API giữa hai vai trò.
5. `src/app/`: entry ứng dụng, router, cấu hình và trạng thái toàn ứng dụng. AppProvider hiện phục vụ nhiều vai trò; không sao chép nó vào từng feature.
6. `src/shared/`: UI, hook, API nền và hàm tiện ích thực sự dùng chung. Trước khi chuyển code vào đây, kiểm tra nơi sử dụng; code chỉ thuộc một feature để trong feature đó.
7. `src/assets/` chứa tài nguyên import; `public/` chứa tài nguyên phục vụ trực tiếp. Không đổi URL ảnh khi chỉ tổ chức code.
8. Giữ hai cấp thư mục gốc FE hiện tại: lệnh chạy dự án, script và CI đang dùng đường dẫn này.

## Bảng tên

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Thư mục | tiếng Anh, chữ thường, kebab-case khi nhiều từ | `facility-operations`, `payments` |
| Trang | PascalCase, hậu tố Page, tên component chính trùng tên file | `UnitAllocationPage.jsx` |
| Component | PascalCase, tên chỉ chức năng | `AccessQrModal.jsx` |
| Layout / route | PascalCase + Layout / Routes | `BusinessLayout.jsx`, `AdminRoutes.jsx` |
| Provider | PascalCase + Provider | `AppProvider.jsx` |
| Hook | camelCase, bắt đầu bằng use | `useAccessQr.js` |
| Module API | camelCase + Api | `businessApi.js` |
| Reducer / selector | camelCase + Reducer / Selectors | `appReducer.js`, `appSelectors.js` |
| Hàm, biến | camelCase; hàm bắt đầu bằng động từ; boolean dùng is/has/can | `confirmPayment`, `isPaid` |
| Hằng số module | UPPER_SNAKE_CASE | `POLL_MS` |
| CSS | kebab-case, tên gắn feature/chức năng | `business.css`, `access-qr.css` |
| Test | tên chức năng + .test.js hoặc .test.mjs | `payment-api.test.mjs` |

## Quy tắc bắt buộc cho AI

- Một file Page chỉ chứa một màn hình; component phụ nhỏ dùng riêng có thể cùng file. Không gom nhiều màn vào `StaffPages.jsx`, `ManagerPages.jsx`, `Units.jsx`.
- Không tạo `NewPage`, `Page2`, `Final`, `Copy`, `temp`, `test123`; không dùng mã Figma như C01 làm tên file. Mã Figma ghi trong tài liệu.
- Không tái tạo `src/pages`, `src/ops`, `src/business`, `src/admin`, `src/state`, `src/lib`, `src/api`, `src/components`, `src/config`, `src/data`, `src/styles` hoặc `src/CustomerApp.jsx`.
- Tên import/export phân biệt hoa thường chính xác. Dùng đường dẫn tương đối có đuôi file; tránh barrel re-export để che bản sao cũ hoặc tạo vòng phụ thuộc.
- Đổi tên/di chuyển phải cập nhật mọi import, dynamic import, test, script, tài liệu và FRONTEND-MAP. Xóa file nguồn cũ sau khi chuyển; không giữ hai bản hoạt động.
- Không đổi URL hash, endpoint, payload, key localStorage, nội dung giao diện hoặc nghiệp vụ chỉ để đổi tên file.
- Không gọi fetch trực tiếp trong Page. Dùng provider/API đang có và giữ mapper dữ liệu.
- Không sửa assertion để kiểm thử pass do việc đổi cấu trúc; chỉ cập nhật import hoặc tên component tương ứng.
- File tiện ích dùng chung đã có như `UI.jsx`, `format.js` được giữ để tránh thay đổi không cần thiết; ưu tiên tên cụ thể cho module mới.
- Ngoại lệ phải có lý do trong DECISIONS.md và cập nhật bản đồ. Không tự đổi quy tắc để bỏ qua lỗi kiểm tra.

## Trước khi bàn giao

Chạy trong thư mục FE:

```bash
npm run check:structure
npm test
npm run test:business
npm run test:render
npm run build
```

Chạy thêm `./init.sh` ở gốc repo theo AGENTS.md. Kiểm tra route thực tế nếu thay đổi tương tác; SSR không thay cho kiểm thử trình duyệt hoặc API thật.

`check:structure` kiểm tra vị trí cấp gốc, thư mục cũ, định dạng tên thư mục/file và component Page trùng tên file. Nó không thể tự đánh giá ngữ nghĩa tên hoặc ép mọi công cụ AI tuân thủ; reviewer vẫn cần đọc diff.
