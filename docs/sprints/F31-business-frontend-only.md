# F31 — Frontend Quản lý vận hành KD

Nguồn: yêu cầu mới 15/10/2026; SSFRMS(1).zip; operations-api(3).md;
Figma SX8EvOf1TJkxfMl90bZsGN, section 436:13803, B01–B05.

Phạm vi: src/business, src/api/business, assets KD, adapter role và route đăng nhập,
mock frontend bật riêng qua dev:business, test và tài liệu.
Ngoài phạm vi: tất cả StorageProject.*, schema, migrations, seeder, cấu hình DB và code nghiệp vụ các role khác.

B02 có 8 ô nhưng API chỉ cho 1 chính sách active/type/scope. Các quy định bổ sung được
lưu thành các dòng có nhãn trong ruleDescription của cùng chính sách, không tạo nhiều
bản cùng loại rồi tự động ghi đè. 409 phải có xác nhận trước replaceExisting=true.

Kiểm chứng: bộ test gốc, build, render, 8 test business, browser với API giả lập,
kiểm tra hồi quy các role khác, so byte toàn bộ source backend so với ZIP đầu vào.
