# Rà soát Figma ngày 26/09/2026

File: "SafeSpace - Modern UI" (https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN/SafeSpace---Modern-UI).
Phạm vi: mâu thuẫn về luồng, trạng thái, nhân vật, liên kết prototype giữa các màn.
**Không** xét ảnh, giá tiền, số liệu thống kê — các thứ này lấy từ backend.

## Mốc dữ liệu chung đã chốt

Mọi màn dùng chung một câu chuyện tại **14/09/2026**, sau khi nhân viên đối soát (09:20) và quản lý phân bổ kho (10:03):

| Đối tượng | Trạng thái tại 14/09 |
|---|---|
| Đơn SS-20260914-0142 / HĐ-2026-0142 / Kho A-102 (Nguyễn Thị Mai) | Đã đối soát, đã phân bổ A-102, **chờ nhận kho** 20/09 09:00. Chưa bàn giao → chưa gia hạn / trả kho được |
| Kho B-015 / HĐ-2026-0086 (Nguyễn Thị Mai) | Đang thuê, sắp hết hạn 25/09. **Chưa gửi** yêu cầu gia hạn (hạn gửi 18/09) |
| HT-0082 | Lỗi thẻ ra vào tại **B-015**, nhân viên Trần Văn Long xử lý |
| Kho C-012 (Lê Văn An) | Hợp đồng quá hạn 4 ngày, hẹn kiểm tra trả kho 20/09 10:00 |
| Kho C-208 (Lê Văn Tùng), F-077 (Đỗ Minh Khang) | Yêu cầu gia hạn đang chờ quản lý duyệt |
| Kho A-045, D-019 | Quá hạn thanh toán 3 ngày |
| Tên cơ sở | Một tên duy nhất "SafeSpace Nguyễn Lương Bằng" (bỏ "SafeSpace Quận 7" vì Quận 7 có 2 cơ sở) |
| Nhân viên cơ sở | Một người: Trần Văn Long (bỏ "Trần Minh", "Lê Anh") |

## Đã sửa trong Figma

**Khách hàng**
- C01: kho A-102 → "Chờ nhận kho"; "Kho đang thuê" 2 → 1; bỏ các dòng nói gia hạn B-015 "đã gửi / chờ duyệt"; quy tắc "gia hạn chậm nhất 7 ngày trước khi kết thúc"; 4 ô "Hành động nhanh" nay có liên kết (C07b, C07, C11, C12).
- C06, C07: A-102 "Chờ nhận kho", khóa/mã bàn giao khi nhận kho. Nút ở C07 đổi thành "Xem lịch nhận kho" (→ C11) và "Đổi lịch nhận kho" (→ C12).
- C08, C09: đổi tên thành "(sau khi nhận kho)" — chỉ dùng khi hợp đồng đã bàn giao, như C07b → C08b / C09b.
- C08, C08b: câu tiền cọc thống nhất "Tiền cọc đang giữ được chuyển sang kỳ mới, không thu thêm" (C08 cũ ghi "Không hoàn lại tiền cọc").
- C10: "Xem hợp đồng" → C07b (trước trỏ C07 dù yêu cầu là của B-015).
- C11: bỏ dòng "Gia hạn đề xuất SS-0142-REN" (gắn nhầm đơn A-102, và B-015 chưa gửi gia hạn); ghi rõ khoản thuộc kho nào.
- C12: kho liên quan A-102 → B-015; tiêu đề "Lỗi thẻ ra vào" khớp S05 / M06.
- C14: SS-0142 "Chờ đối soát" → "Đã xác nhận" (khớp C11, C01); "Xem đơn SS-0142" → C11.
- A02 (đăng ký): "Tạo tài khoản" → C02 thay vì dashboard đã có kho của khách khác.
- P01: bậc diện tích "2–5 m²" → "Dưới 10 m²" (không còn khoảng trống 5–10 m²).

**Nhân viên / Quản lý / Quản trị**
- S01: việc kiểm tra trả kho khớp với S04 (C-012, Lê Văn An, 20/09 10:00).
- S09: "Xác nhận đã thu" → S01 (bước tiếp là quản lý phân bổ, không phải xác minh khách); thêm liên kết "Báo sai lệch" → S06, S03 "Xác nhận bàn giao" → S01.
- S05, M06: HT-0082 thuộc B-015; nhân viên phụ trách Trần Văn Long.
- M02: A-102 "Chờ bàn giao". M03: bỏ B-015 khỏi danh sách chờ duyệt (thay bằng C-208). M07: bỏ A-102 (không có gì cần xử lý), tên khách B-015 sai → thay bằng A-045 và F-077. M03 "Từ chối" có liên kết.
- A02: bỏ "gửi lời mời qua email" → mật khẩu tạm thời hiển thị một lần (khớp A05 và SRS: chưa gửi email).
- A04: 10:03 là "Phân bổ kho A-102" (không phải duyệt gia hạn B-015); đăng nhập sai của Lê Quang Huy chuyển sau lúc tài khoản được tạo.
- A05: ngày tạo tài khoản 01/08/2026 (khớp lịch sử phân công); phân công cũ là "SafeSpace Him Lam". A01: bấm dòng Phạm Thu Hà → A05.

## Còn lệch nhưng thuộc dữ liệu (không sửa)

Giá, số tiền (vd. C04 3.450.000 đ và tổng ban đầu 4.600.000 đ), ảnh (C03c "x trên 4"), danh sách / khu vực cơ sở,
số liệu thống kê, tham số chính sách (B02). Các giá trị này lấy từ backend.

## Hoàn tác

Figma lưu lịch sử phiên bản (File → Show version history): chọn bản trước 20:50 ngày 26/09/2026 để xem hoặc khôi phục.
