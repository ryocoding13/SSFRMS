# Kiểm chứng và điều kiện merge

Báo kết quả dựa trên lệnh đã chạy và kịch bản đã thử. Không lấy kết quả của phiên/nhánh khác làm bằng chứng cho bản hiện tại.
Hướng dẫn cập nhật ngày 24/10/2026 theo cấu trúc `main`; số lượng test/route ghi ở bằng chứng từng lần chạy, không cố định tại đây.

## Lệnh kiểm tra hiện có

Các lệnh FE chạy trong `SafeSpace-Customer-UI/SafeSpace-Customer-UI`; lệnh BE/init chạy ở gốc repo.

| Phạm vi | Lệnh | Ý nghĩa và giới hạn |
|---|---|---|
| Cấu trúc FE | `npm run check:structure` | Kiểm thư mục/đặt tên; không xác nhận nghiệp vụ |
| Test FE | `npm test` | Chạy các test được đăng ký trong package.json của nhánh |
| Test vận hành KD | `npm run test:business` | Bộ kiểm tra riêng, không nằm trọn trong npm test |
| Render route | `npm run test:render` | Kiểm render; không thay kiểm thao tác trên trình duyệt |
| Build FE | `npm run build` | Kiểm đóng gói; không chứng minh API thật hoạt động |
| Build BE | `dotnet build StorageProject.slnx` | Solution dùng .NET 10 |
| Test BE | `dotnet test StorageProject.slnx` | Đã có StorageProject.Tests; ghi rõ provider/database thực tế |
| Kiểm tra nền | `bash init.sh` hoặc `.\init.ps1` | Theo nội dung script hiện có ở nhánh đang làm |
| Chỉ FE | `bash init.sh --fe-only` hoặc `.\init.ps1 -FeOnly` | Không xác nhận backend đạt |
| API thủ công | Swagger hoặc `StorageProject.Api/StorageProject.Api.http` | Kiểm cả quyền, đầu vào đúng/sai và đọc lại dữ liệu |

`init` trên nền main dùng cho bản vá này chạy npm test, render, build FE và build/test BE;
chưa chạy check:structure/test:business. Chạy riêng hai lệnh đó trước merge code FE.
Các nhánh CI/CD có thể bổ sung lệnh; khi được merge cần đọc script thực tế và cập nhật hướng dẫn.
Nếu lockfile thay đổi, chạy lại `npm ci`; việc thư mục node_modules tồn tại không chứng minh dependencies đã đồng bộ.

## Mức kiểm tra theo thay đổi

| Thay đổi | Kiểm tra trong quá trình làm |
|---|---|
| Chỉ tài liệu/quy định | Đọc diff, kiểm đường dẫn/lệnh/tham chiếu và tính nhất quán; không bắt buộc npm/dotnet build |
| Giao diện/CSS/route | Kiểm cấu trúc, render, build; xem màn bị đổi ở desktop/mobile và thử tương tác liên quan |
| Nghiệp vụ FE | Như giao diện + test chức năng bị ảnh hưởng; thêm/sửa test khi có hành vi hoặc ca lỗi cần bảo vệ |
| Mapper/gọi API | Test mapper/API liên quan; thử request/response, lỗi mạng, quyền và giữ dữ liệu khi lỗi với backend thật |
| Backend | Build + test BE + endpoint thành công/lỗi, quyền sở hữu/phạm vi cơ sở và đọc lại dữ liệu |
| Schema/migration | Như backend + thử nâng cấp DB thử nghiệm có dữ liệu và DB mới; kiểm model/snapshot, không reset DB dùng chung |
| Cấu hình triển khai/container | Build/test liên quan + build container, chạy stack và smoke test; lint YAML không thay cho kiểm chạy |

Thiếu môi trường thì vẫn được bàn giao phần độc lập, nhưng ghi rõ chưa kiểm chứng.
Lỗi nền không liên quan cần được ghi nhận; không sửa ngoài phạm vi hoặc che lỗi để báo mọi thứ pass.
Trước merge thay đổi code, thành viên chạy đầy đủ bộ FE hoặc BE tương ứng, cùng kiểm tra tích hợp bị ảnh hưởng.
Thay đổi dùng chung FE/BE cần cả hai bộ. `init` là trợ giúp, không thay các kiểm tra còn thiếu.
Nếu thiếu kiểm tra bắt buộc hoặc có lỗi mới do PR gây ra, chưa coi PR đủ điều kiện merge.

## Điều kiện xác nhận tính năng hoàn thành

1. Đạt tiêu chí người dùng/nhóm đã chốt và quyết định nghiệp vụ hiện hành; nếu SRS/Figma mâu thuẫn phải chốt trước.
2. Lệnh verification của tính năng và bộ kiểm tra cần thiết đạt trên bản đang bàn giao.
3. Đã thử luồng chính và ca lỗi/quyền liên quan. Không báo toàn hệ thống đạt từ một vài ca riêng lẻ.
4. Ghi ngày, nhánh hoặc SHA nền, lệnh, số pass/fail/skip, môi trường dữ liệu, kết quả và giới hạn trong progress/evidence.
5. Thành viên phụ trách xác nhận trước khi chuyển passing. Một thành viên khác review trước merge.

## Phân biệt bằng chứng

- Mock chỉ kiểm giao diện/hợp đồng dữ liệu giả; không xác nhận backend hay database thật.
- Test SQLite không chứng minh migration, khóa đồng thời và hành vi SQL Server đã đạt.
- PayOS giả lập không chứng minh chữ ký/webhook bằng khóa thật và URL public đã hoạt động.
- Đóng gói Docker không chứng minh đã triển khai online; cần chạy stack và smoke test môi trường đích.
- Hướng dẫn này không tuyên bố các bước trên đã chạy trong lần cập nhật tài liệu.

## Trách nhiệm review và Git

AI có thể hỗ trợ rà soát/test nhưng không thay người review trong nhóm. Thành viên tự đọc hiểu diff,
commit/push/tạo PR/merge; AI không thực hiện các thao tác đó hoặc thay đổi danh tính Git.
Không tạo tính năng sản phẩm hoặc đổi trạng thái passing chỉ để ghi nhận một task tài liệu.
