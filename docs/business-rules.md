# Quy tắc nghiệp vụ — bản tóm tắt cho AI

> Nguồn đầy đủ: `srs_content.txt` mục 2 (A01–A10), 7 (BR01–BR30), 8 (trạng thái), 10 (thanh toán, báo cáo).
> File này chỉ là chỉ mục nhanh. Khi sửa nghiệp vụ, đọc đúng mục SRS được dẫn và ghi mã quy tắc vào commit/test.

## Quy ước chung

- Tiếng Việt, tiền VND, `DECIMAL(15,2)`. Khoá chính BIGINT tự tăng. Tên bảng/trường snake_case (Data Dictionary).
- Thuê theo số tháng nguyên. Khoảng thuê là **[start_date, end_date)**; cộng tháng theo lịch, chặn về cuối tháng (A02).
- Hai khoảng trùng khi `s1 < e2 && s2 < e1` (BR16). Không bao giờ gán một unit cho hai quyền sử dụng chồng nhau (BR01).
- Mọi thay đổi vai trò, phạm vi, giá, chính sách, phân bổ, hợp đồng, thanh toán phải ghi audit (BR13).
- Giá trên hợp đồng/gia hạn là giá **chụp tại thời điểm**; đổi bảng giá không sửa ngược (BR14).
- Thiếu cấu hình phí/chính sách → từ chối thao tác, không tự dùng mức mặc định (SRS mục 2).
- Các bước đặt chỗ, gán unit, thanh toán, gia hạn, bàn giao chạy trong **một giao dịch**; gọi lặp trả kết quả cũ (7.1).

## Phân quyền

| Vai trò | Phạm vi dữ liệu |
|---|---|
| Khách hàng | Dữ liệu công bố + bản ghi của chính mình |
| Nhân viên / Quản lý cơ sở | Chỉ cơ sở đang được phân công ACTIVE (BR12); tối đa 1 phân công ACTIVE/người (A06) |
| Quản lý vận hành KD | Toàn hệ thống, phần kinh doanh |
| Quản trị hệ thống | Toàn hệ thống, phần tài khoản/quyền; không mặc định duyệt tiền hay sửa hợp đồng |

Kiểm tra quyền ở **máy chủ**, không tin giao diện.

## Trạng thái chính (SRS mục 8)

| Đối tượng | Chuyển tiếp |
|---|---|
| Reservation | PENDING_PAYMENT → UNIT_ASSIGNED → CONFIRMED → CHECKED_IN; huỷ → CANCELLED; hết giờ → EXPIRED; không đến → NO_SHOW |
| Contract | DRAFT → ACTIVE → EXPIRING → OVERDUE; → RETURN_PENDING → COMPLETED; DRAFT → CANCELLED; → TERMINATED |
| Unit | AVAILABLE → ASSIGNED → OCCUPIED → RETURN_PENDING → INSPECTION → AVAILABLE hoặc MAINTENANCE; OUT_OF_SERVICE |
| Payment | PENDING → PAID / FAILED; PAID → REFUNDED |
| Renewal | PENDING → APPROVED / REJECTED / CANCELLED; APPROVED → PAID |
| Handover | SCHEDULED → VERIFIED → HANDED_OVER; → CANCELLED |
| Ticket | OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED; OPEN/ASSIGNED → CANCELLED |
| Credential | ACTIVE → RETURNED / LOST / REVOKED / REPLACED |

Giao diện khách hàng hiện dùng tập trạng thái đơn giản hơn (vd. `PENDING_VERIFICATION`, `ENDED`) — bảng đối chiếu ở
`BE-CONTRACT.md` mục 2. Khi thêm trạng thái mới, sửa cả `src/lib/status.js` và `src/api/mappers.js`.

## Quy tắc hay bị làm sai

- **Bàn giao** chỉ khi reservation hợp lệ, contract DRAFT, unit sẵn sàng, đã đáp ứng thanh toán (BR07); thành công thì
  đồng thời unit OCCUPIED, contract ACTIVE, reservation CHECKED_IN (BR08).
- **Trả kho**: unit chỉ AVAILABLE sau inspection COMPLETED (BR09); trả kho vật lý và công nợ là hai việc riêng (A10).
- **Gia hạn**: Manager duyệt và thanh toán đủ rồi mới cập nhật `end_date`, chỉ một lần (A09, BR24); mỗi hợp đồng chỉ một
  renewal PENDING/APPROVED chưa xong.
- **Quá hạn**: hết kỳ chưa có bằng chứng trả → contract OVERDUE, không tự thành kho trống (BR11); không tạo trùng overdue_case (BR26).
- **Tiền**: giá kỳ = giá tháng × số tháng, sau giảm/miễn không âm; cọc ghi riêng (BR22). Không hoàn một phần, không trừ cọc tự động (BR27–BR28).
- **Ticket** bắt buộc gắn contract của khách (A07).
- **Bảo trì** chưa có ngày kết thúc → loại unit khỏi phân bổ (BR30).

## Luồng đặt chỗ đã chốt theo Figma

Chuyển khoản QR lúc đặt → "Chờ đối soát" → nhân viên đối soát → quản lý phân bổ kho → nhận kho theo lịch (D02).
SRS mục A03 cần sửa cho khớp. Hợp đồng chưa bàn giao không cho gia hạn / trả kho (D11).
