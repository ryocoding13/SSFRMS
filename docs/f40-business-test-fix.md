# F40 — Sửa cách ly kiểm thử chính sách (24/10/2026)

## Phạm vi và bằng chứng

Người dùng gặp business 8/9 ở cả commit đợt 1 và đợt 2: không tìm thấy OVERDUE, sau đó lỗi đọc `status`. Test gốc trong nền 6d959ae dựng lại từ ZIP đạt 9/9 trên Linux sạch; chưa tái hiện chính xác môi trường Windows của người dùng. Không có căn cứ khẳng định database thật thiếu chính sách.

Test cũ dùng cố định localhost:5151, trùng cổng API thật, và không kiểm tra token/fixture trước khi dùng. Bản sửa dùng mock riêng cổng OS cấp (port 0), transport chỉ gọi mock đó, kiểm tra đăng nhập/OVERDUE trước khi chạy và dùng ngày hiệu lực của fixture thay cho ngày 15/10 cố định. Các assertion nghiệp vụ được giữ, bổ sung kiểm tra request: huỷ không gửi replaceExisting; chỉ retry sau xác nhận gửi replaceExisting=true. Không bỏ test hoặc đổi kết quả nghiệp vụ mong đợi.

## Kết quả chạy trong phiên sửa

Nền tái dựng: main 6d959ae từ gói Mai main-tested, đảo patch Mai rồi áp dụng đúng patch F40 gốc. Chưa có bản checkout 6dc64f6 của máy người dùng trong phiên này.

| Kiểm tra | Đợt 1 | Đợt 1 + 2 |
|---|---:|---:|
| check:structure | PASS | PASS |
| npm test | 77/77 | 78/78 |
| test:business | 9/9 | 9/9 |
| test:render | 93 route | 95 route |
| build | PASS | PASS |
| init.sh --fe-only | PASS | PASS |
| Business khi cổng 5151 bị chiếm, MOCK_OPS=1, MOCK_LEGACY=1 | 9/9 | 9/9 |

Kiểm tra bổ sung: máy chủ khác ở cổng 5151 không nhận request nào; test strict contract vẫn PASS khi Date.now chuyển sang tháng 6/2028.

Không đổi logic sản phẩm, SQL Server, schema/migration, backend, .env hoặc appsettings. Chưa chạy Windows, SQL Server hay kiểm lại hình ảnh Figma trong phiên sửa. Không xác nhận các phần backend còn thiếu trong BACKEND-TODO đã hoàn thành. Cảnh báo font Manrope và chunk >500kB vẫn có. init trên bản ZIP không có .git có thể in cảnh báo trạng thái Git; bước FE đạt và exit code 0.

## Lệnh chạy lại

Từ gốc repository:

```bash
npm --prefix SafeSpace-Customer-UI/SafeSpace-Customer-UI run test:business
```

Nếu vẫn lỗi, gửi toàn bộ failing tests và phiên bản mock/mock-api.mjs, mock/mock-business.mjs hiện tại để đối chiếu; không thêm ?.status hoặc bỏ test. Không cần chạy lệnh cập nhật database cho bản sửa test này.
