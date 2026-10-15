# Quản lý vận hành KD — frontend B01–B05

Nguồn: Figma section 436:13803; operations-api(3).md do người dùng cung cấp.

| Màn | Component | Route | API |
|---|---|---|---|
| B01 Tổng quan | business/Overview.jsx | business | GET facilities, reports/facilities, reports/revenue-trend |
| B02 Chính sách | business/Policies.jsx | business/policies | GET/POST policies; POST policies/{id}/activate; PUT cho DRAFT |
| B03 Giá & phí | business/Pricing.jsx | business/pricing | GET unit-types, policies, facilities; POST policies và activate |
| B04 Báo cáo | business/Reports.jsx | business/reports | GET reports/facilities, unit-types, revenue-trend, rental-status, export |
| B05 Cơ sở | business/Facilities.jsx | business/facilities | GET facilities, rates; điều hướng sang reports với facilityId |
| Header/session | business/BusinessShell.jsx | các route KD | JWT và logout của store chung; notice tổng hợp từ API được tài liệu mô tả |

Không thêm endpoint ngoài hợp đồng. Không sửa endpoint hay schema backend.
Màn Figma không có nút CRUD cơ sở hoặc bảng giá từng cơ sở nên không thêm các nút này vào UI.
Lớp businessApi vẫn cung cấp các phương thức tương ứng hợp đồng để backend/frontend mở rộng về sau.

B02 gom các ô cùng type/phạm vi vào một chính sách; phần quy định bổ sung dùng ruleDescription.
Khi tạo/thay chính sách gặp 409, frontend hỏi xác nhận trước khi replaceExisting=true.
Đổi số tiền hoặc quy định không tự chỉnh hợp đồng/đơn đặt chỗ trên frontend.

Xuất XLSX: ba chế độ đầu gọi CSV backend và đóng gói OOXML ở client;
chế độ trạng thái xuất snapshot đã tải. Không giả định có endpoint xuất trạng thái.
managerName là trường bổ sung tùy chọn, không tự suy từ assignedStaff.
Chỉ tiêu quá hạn dùng đúng overdueContracts trong tài liệu và ghi nhãn Hợp đồng quá hạn.

Các luồng thật sẽ gọi API theo VITE_API_URL; dev:business là mock HTTP opt-in cho phát triển frontend,
không phải chế độ fallback tự động khi API thật gặp lỗi.
