# Ngọc Mai — bàn giao cộng dồn ngày 06/11/2026

Nền: `0b42aafc45623f81ba156a4d2adf7830c8a64ea8` (main, PR #74). Phân công theo BACKEND-TODO và D34/D37: T05–T08, T18/T19, R1, C12/C12b/C13 và quên mật khẩu; H1 đồng phụ trách. Giữ các quyết định thay thế D38–D45, phần đăng ký KH-01, ảnh hỗ trợ KH-08, gia hạn và trạng thái trả kho của main mới.

| Task | Công việc bàn giao | Kiểm chứng / giới hạn |
|---|---|---|
| T05 | Bắt buộc gửi rõ damageFee và cleaningRequired; 0/false vẫn hợp lệ. Giữ route chuẩn /api/ops, route staff cũ 410 theo phiên 6. | Test thiếu trường, biên bản, phí, ảnh và quyền; SQLite. |
| T06 | Giữ tính khấu trừ tối đa trong cọc, không Debt; phí vượt cọc CANCELLED; không tự trừ vệ sinh khi chỉ quá hạn. | Bộ RefundPolicy/D32 và hoàn cọc đạt. |
| T07 | Giữ kho cần vệ sinh/sửa ở MAINTENANCE cả với biên bản cũ; sửa mốc giờ kiểm kê. Giữ bước xác nhận khấu trừ, tiền mặt, đặt trước của main. | Bộ D32 gồm lịch sử, trạng thái và xác nhận hoàn. |
| T08 | Số tài khoản chuyển khoản chỉ gồm 6–19 chữ số ASCII, tên chính chủ. Giữ lựa chọn tiền mặt D42/D44. | Test tài khoản, ảnh trả kho, quyền và H1. |
| T18 | Giữ đăng nhập email/username, từ chối định danh trùng. Không ghi đè validation đăng ký mới KH-01. | Login/Auth/Registration tests. |
| T19 | Kiểm expectedVersion dương trước cả nhánh replay; UUID cùng nội dung không thêm phản hồi; tiếp tục hội thoại theo D43. | Service/HTTP, quyền khách/cơ sở và version/replay. |
| R1, C12/C12b | Giữ phản hồi theo đúng chủ sở hữu, thứ tự, nhân viên và lịch sử; giữ ảnh hỗ trợ mới của nhóm. | AuthSupport/HTTP tests và FE tests. Browser chưa xác minh. |
| C13 | Đổi tên đúng tài khoản; đổi mật khẩu giới hạn 72 byte UTF-8 và dùng khóa DB chung với login/reset. | AuthSupport/HTTP tests. Khóa SQL Server cần nghiệm thu riêng. |
| Quên mật khẩu | Sau khi SMTP đã nhận thư, hủy HTTP hoặc lỗi ngắt SMTP không làm rollback OTP đã gửi. Lỗi gửi trước đó vẫn rollback. | OTP hết hạn, dùng lại, giới hạn gửi/nhập sai, đóng phiên cũ; SMTP loopback và HTTP/SQLite. Gmail thật chưa thử. |
| H1 | Giữ phí huỷ 5% cọc D40, kiểm preview và quyền sở hữu. | Ca trả 4 triệu, cọc 1 triệu: phí 50 nghìn, hoàn 3,95 triệu. |

## Kiểm thử trên chính nền bàn giao

- .NET SDK 10.0.403: restore solution và build tuần tự thành công.
- `dotnet test StorageProject.Tests --no-build --no-restore -m:1`: 270 đạt, 0 lỗi, 0 bỏ qua. Dùng SQLite và HTTP/SMTP thử nghiệm, không phải SQL Server nhóm/Gmail thật.
- Main gốc chỉ thêm cùng bốn file test hồi quy: 87 ca, 15 lỗi, 72 đạt. Bản sửa xử lý đủ 15 lỗi đó.
- `dotnet ef migrations has-pending-model-changes --no-build`: model khớp snapshot; không tạo/sửa migration.
- FE `npm test`: 158/158; business: 10/10; workflows: 11/11 ở `TZ=Asia/Ho_Chi_Minh`; render: 181 route; structure/build: đạt.
- Workflow nền có một test sử dụng ngày máy: máy Asia/Seoul đã sang ngày mới trong khi Việt Nam chưa sang ngày nên ca RECORD_REMOVAL thất bại. Chạy đúng múi giờ Việt Nam thì đạt. Không sửa/nới assertion hoặc logic nghiệp vụ để che lỗi; ghi cả hai log.
- Build PasswordResetBrowserHost và kiểm cú pháp hai script local/T19: đạt.
- 14 ca Playwright không chạy được vì Chromium bị môi trường chặn Unix socket (`Operation not permitted`). Đây là giới hạn khởi tạo trình duyệt, không phải kết quả đạt giao diện.
- Cảnh báo có sẵn: CS8604 ở FacilityOpsService.Board.cs, CS0649 ở RenewalPolicyD32Tests, chunk/font frontend. Không chặn build.

## Phần chưa nghiệm thu

SQL Server thật (migration với dữ liệu, khóa đồng thời), Gmail thật, browser và PowerShell/Windows local chưa được chạy trong môi trường này. Cần chạy `kiem-tra-local.ps1 -Browser -SqlServer` với SQL Server test riêng; bộ integration tạo rồi xóa database tạm SSFRMS_CI_<UUID>. Dùng database demo riêng khi setup/start vì startup có thể áp migration còn chờ. Không reset database nhóm.

F37/F42/F43 giữ active; chưa đủ bằng chứng hoặc xác nhận owner để đổi passing. Gói hoàn thành phần rà soát, sửa code và kiểm thử có thể chạy tại đây; không đồng nghĩa nghiệm thu toàn bộ hệ thống.

## Đồng bộ

Dùng một gói cộng dồn trên worktree mới. Không áp chồng đợt 1/đợt 2/gói 54f2339. Script kiểm SHA main, hash patch/payload, git apply --check --index và hash sau áp; main thay đổi thì dừng. Giữ nguyên worktree đang sửa của thành viên. Chỉ đưa phần diff Ngọc Mai lên nhánh riêng sau khi kiểm thử/review. Không cam kết không xung đột với các commit tương lai; kiểm main lại trước push và trước merge. Nếu còn PR đợt cũ thì phối hợp reviewer dùng một PR cộng dồn, tránh merge hai bản vá trùng nhau.
