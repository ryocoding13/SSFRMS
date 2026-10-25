# FE bổ sung theo thiết kế đã duyệt — 25/10/2026

Bản gốc: main 54abba6 (đã gồm PR #39 sửa C11, C14a, S04, S09, M07; gói ban đầu làm trên c5aa79a và đã được gộp lại). Nhánh local: feature/figma-approved-fe-completion. Figma: https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN

## Chạy kiểm duyệt

Yêu cầu Node >=22.12. Trong PowerShell:

```powershell
cd SafeSpace-Customer-UI\SafeSpace-Customer-UI
npm ci
npm run dev:demo
```

Mở http://127.0.0.1:5173. Tài khoản demo: customer01 / Customer@123; staff01 / Staff@123; manager01 / Manager@123; ops01 / Ops@123; admin / Admin@123. Demo hiện nhãn rõ, dữ liệu nghiệp vụ bổ sung nằm trong localStorage `safespace.approved-workflows.demo.v1`. Xoá khóa này để bắt đầu lại; khởi động lại server để reset dữ liệu API mô phỏng. Không dùng demo cho giao dịch thật. Các fixture bổ sung là kịch bản độc lập, chưa đồng bộ hạch toán với mọi hợp đồng API mô phỏng.

Chạy API hiện có: cấu hình theo .env.example rồi `npm run dev`. Không bật VITE_WORKFLOW_DEMO. Endpoint thiếu báo lỗi; không tự chuyển sang demo. Không có thay đổi backend, DB hoặc migration trong gói này.

## Các màn bổ sung

| Vai trò | Đường dẫn sau #/ | Hành vi |
|---|---|---|
| Công khai | reset-password | Nhập email, mã xác nhận, mật khẩu mới, gửi lại, lỗi, thành công |
| Khách | policies | 7 nhóm chính sách chi tiết |
| Khách | payments/history | Lọc lịch sử và xem chi tiết giao dịch |
| Khách | refunds | Tiến độ hoàn cọc, chi tiết, trạng thái chưa hoàn/đã hoàn/0đ |
| Khách | units/:id/deposit | Lịch trừ cọc theo ngày; ghi rõ bản xem trước chính sách |
| Khách | units/:id/progress | Tiến độ trả kho và đối soát |
| Khách | units/:id/renewal-status | Chờ duyệt/từ chối/thanh toán/gia hạn tại quầy |
| Khách | inquiries, inquiries/:id | Hỗ trợ chưa có hợp đồng, chọn cơ sở, trao đổi |
| Nhân viên | staff/mismatch | Báo sai lệch thực nhận và lý do |
| Nhân viên | staff/renewal-payments | Thu gia hạn tại quầy, chặn thu lần hai |
| Nhân viên | staff/overdue | Biên bản đưa đồ ra ngoài sau 20 ngày |
| Nhân viên | staff/inquiries | Tiếp nhận và phản hồi yêu cầu tư vấn |
| Quản lý | manager/discrepancies, manager/discrepancy-detail?id=… | Danh sách và kết luận đối soát |
| Quản lý | manager/overdue | Khấu trừ cọc, phân công, xem biên bản |
| Quản lý | manager/deposit-refunds | Đối soát và xác nhận hoàn cọc; bắt buộc mã giao dịch |
| Vận hành KD | business/policy-content | Sửa 7 nhóm nội dung, tỷ lệ, xem trước và lưu |
| Vận hành KD | business/policy-status | Theo dõi chính sách; ngừng áp dụng/xóa bản nháp |
| Vận hành KD | business/rates | Bảng giá cơ sở, lọc, tạo/sửa giá theo ngày |
| Vận hành KD | business/export | Chọn phạm vi, xác nhận, xuất CSV |

Các màn sẵn có vẫn giữ đủ 5 vai trò. Đăng ký thêm thông báo thành công. Hoàn đơn hủy đổi thành từng thẻ khách hàng với chi tiết và nút đúng từng hồ sơ. Không có trang thông báo khách hàng riêng hoặc trang thu hồi QR; khách dùng chuông trên header. QR bị chặn trên FE ngay khi yêu cầu trả kho thành công hoặc hợp đồng hết hạn.

## Kiểm chứng

- `TZ=Asia/Ho_Chi_Minh bash init.sh --fe-only`: test 81/81, render 115 route, build đạt. Bộ mapper cũ phụ thuộc múi giờ Việt Nam; host UTC có một kỳ vọng ngày cũ lệch ngày.
- `npm run check:structure`: đạt; `npm run test:business`: 9/9; `npm run test:workflows`: 10/10.
- `npm run test:auth-support`: 14/14 luồng auth/hỗ trợ đạt. Cập nhật bài kiểm tra S05 theo modal xác nhận/kết quả và quay về danh sách hiện hành trên main.
- `node scripts/check-approved-ui.mjs`: 25 route trên desktop/mobile; không tràn ngang hoặc lỗi runtime trong lượt kiểm tra.
- `node scripts/check-workflow-actions.mjs`: 10 nhóm thao tác xác nhận/hủy/lỗi/lặp/cross-role/CSV.
- `node scripts/check-api-pending.mjs`: API thiếu không giả thành công, giữ nội dung đang nhập.
- `node scripts/check-password-reset.mjs`: sai OTP, đúng OTP, đăng nhập bằng mật khẩu mới.

Các script trình duyệt dùng Chromium của Playwright (`npx playwright install chromium`). Có thể truyền PLAYWRIGHT_EXECUTABLE_PATH nếu máy đã có binary. Script tự mở server; đóng server dev đang chạy cổng 5173 trước khi kiểm tra. Những kiểm tra này dùng API mô phỏng/DTO, chưa chứng minh tích hợp SQL Server, PayOS thật hoặc thiết bị mở cửa. Build còn cảnh báo bundle lớn hơn 500kB. Không đổi trạng thái tính năng sang passing thay người phụ trách.

## Tích hợp

Gói có toàn bộ source FE, changes.patch và repo-changes chứa các file sửa/thêm theo đường dẫn gốc. Dùng trên main 54abba6; nếu main đã đổi, review diff trước khi áp dụng. Không chép node_modules/dist. Cài lại bằng npm ci. AI không commit/push/PR; thành viên đọc diff, kiểm tra API gap rồi tự tích hợp.
