# Kiểm chứng — thế nào là "xong"

"Xong" nghĩa là **có bằng chứng chạy được**, không phải AI nói "code trông ổn".

## Lệnh kiểm chứng

| Phạm vi | Lệnh | Hiện trạng (2026-09-26) |
|---|---|---|
| Toàn bộ | `./init.sh` hoặc `.\init.ps1` | FE pass; BE chưa chạy trên máy thiết lập |
| Nghiệp vụ FE | `npm test` (trong thư mục frontend) | 28/28 pass |
| Render mọi route | `npm run test:render` | 38 route PASS |
| Build FE | `npm run build` | OK |
| Build BE | `dotnet build StorageProject.slnx` | — |
| Test BE | `dotnet test StorageProject.slnx` | Chưa có project test (F28) |
| Gọi thử API | `StorageProject.Api/StorageProject.Api.http` hoặc Swagger `http://localhost:5151/index.html` | Thủ công |

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
