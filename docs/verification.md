# Kiểm chứng — thế nào là "xong"

"Xong" nghĩa là **có bằng chứng chạy được**, không phải AI nói "code trông ổn".

## Lệnh kiểm chứng

| Phạm vi | Lệnh | Hiện trạng (Baseline CI01 - 2026-10-23) |
|---|---|---|
| Toàn bộ | `./init.sh` hoặc `.\init.ps1` | Toàn bộ PASS (FE 4 suite + BE build/test) |
| FE Cấu trúc | `npm run check:structure` | PASS (kiểm tra cấu trúc module và quy tắc đặt tên) |
| FE Nghiệp vụ | `npm test` (trong thư mục frontend) | 76/76 test PASS |
| FE Vận hành KD | `npm run test:business` (trong thư mục frontend) | 9/9 test PASS |
| FE Render mọi route | `npm run test:render` | 92 route SSR PASS |
| FE Build | `npm run build` | PASS (Vite production bundle) |
| BE Build | `dotnet build StorageProject.slnx` | PASS (0 Error, .NET 10) |
| BE Test | `dotnet test StorageProject.slnx` | 52/52 test xUnit PASS (StorageProject.Tests) |
| BE EF Tool | `dotnet tool restore` | PASS (dotnet-ef 10.0.12 từ .config/dotnet-tools.json) |
| Gọi thử API | `StorageProject.Api/StorageProject.Api.http` hoặc Swagger `/index.html` | Thủ công |

## Mức kiểm chứng theo loại thay đổi

| Thay đổi | Tối thiểu phải chạy |
|---|---|
| Chỉ giao diện | `npm test` + `npm run test:render` + `npm run build` + mở màn hình đó xem thật |
| Nghiệp vụ trong `reducer.js` | Như trên + test mới trong `tests/reducer.test.js` |
| Mapper / gọi API | Như trên + test trong `tests/api-mappers.test.js` + chạy với backend thật |
| Backend | `dotnet build` + gọi thử endpoint (thành công và lỗi) + `dotnet test` khi đã có F28 |
| Schema / migration | Như backend + `dotnet ef database update` trên database mới tạo |

## Định nghĩa "xong" cho một tính năng

1. Lệnh `verification` của tính năng trong `feature_list.json` pass.
2. `./init.sh` pass toàn bộ.
3. Kịch bản chính và ít nhất một kịch bản lỗi đã thử (ví dụ: gia hạn khi đã có yêu cầu chờ → báo lỗi đúng).
4. Đúng tiêu chí nghiệm thu trong SRS mục 13 và đặc tả UC ở mục 15.
5. Đã ghi `evidence` (ngày, lệnh, kết quả, commit) vào `feature_list.json`.

## Người làm ≠ người kiểm

Sau khi AI báo xong, một người khác trong nhóm (hoặc một phiên AI mới chưa thấy code) kiểm lại theo mục trên
trước khi merge PR. AI thường tự khen công việc của mình.
