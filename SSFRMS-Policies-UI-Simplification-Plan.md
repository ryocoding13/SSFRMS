# SSFRMS — Kế hoạch tinh gọn màn Policies của Business Operator

**Nhánh đối chiếu:** [feature/dat-renewal-policy-d32 tại 9499fec](https://github.com/ryocoding13/SSFRMS/tree/9499fec00aa2ed70fafdf0623d6eefdf6e5b40b6), commit “Sua policies”. Đây là nhánh tìm thấy đúng bốn nhóm đang được mô tả; `main` tại `fd78114` vẫn có form cũ. Agent kiểm tra SHA và nhánh thực tế trước khi sửa. Đây là kế hoạch dựa trên đọc source, chưa triển khai hay chạy thử UI.

## 1. Vấn đề cần xử lý

| Vấn đề | Bằng chứng trong code | Yêu cầu |
|---|---|---|
| Màn quá nhiều chữ | `PolicySettingsPage.jsx` hiện mô tả dài, badge, chú thích từng ô, từng thẻ quy định và mã quyết định. | Mặc định chỉ hiện dữ liệu cần xem/sửa. Chuyển giải thích kỹ thuật sang tài liệu; giữ một dòng hướng dẫn nếu cần để hiểu đơn vị hoặc phạm vi. |
| Ô nhập yêu cầu chuỗi có đơn vị | Form lấy `fieldValue` đã định dạng đưa vào input. `numericValue` cắt chữ rồi có thể dùng `parseMoney`; policy chưa tồn tại còn mặc định kiểu `FIXED` cho ô số. | Ô nhận giá trị số thuần, đơn vị ở ngoài input, lưu JSON number với đúng kiểu policy. |
| Hướng dẫn vẫn sửa được | `GUIDELINE_SECTIONS` dùng chung `drafts` và `policyJobs`, nên có thể ghi `ruleDescription` dù không đổi hành vi tự động. | Chỉ đọc trên màn cấu hình; không có input, không tham gia lưu. |
| Khối legacy chiếm chỗ và dễ phân loại nhầm | `legacyPolicies` nhận diện RENEWAL bằng số 24 hoặc từ khóa; một policy hợp lệ có thể tình cờ trùng. | Bỏ khối legacy khỏi màn chính. Giữ bản ghi và lịch sử; không đánh dấu/xóa hàng chỉ dựa trên giá trị 24. |

## 2. Bố cục đích

1. **Chính sách cho thuê**: tiêu đề, phạm vi “Toàn hệ thống”, liên kết **Nội dung khách đọc** và **Trạng thái chính sách**. Dùng lại điều hướng hiện tại.
2. **Quy tắc vận hành tự động**: một nhóm ngắn gồm tên, giá trị, đơn vị và lỗi ngay dưới ô. Chỉ có nút **Lưu thay đổi** cho nhóm này; vô hiệu khi chưa có thay đổi hoặc đang lưu. Tóm tắt trước xác nhận bằng giá trị cũ → mới và đơn vị, thay cho giải thích kỹ thuật.
3. **Quy định cố định** và **Hướng dẫn nghiệp vụ**: dùng danh sách tên–giá trị hoặc mục thu gọn **Xem thêm**. Không lặp các dòng đã xuất hiện. Mã quyết định, tên service/worker và mô tả dài đưa về tài liệu. Chỉ hiển thị số liệu xác minh được; ví dụ mốc EXPIRING không tự gọi là “gửi thông báo” nếu chưa xác minh có gửi.
4. **Không có thẻ Legacy trên màn chính.** Nếu cần tra soát, bản ghi vẫn nằm ở danh sách trạng thái/lịch sử; có thể bổ sung bộ lọc riêng sau khi có cách nhận diện đáng tin cậy. Không cần tạo tab mới chỉ để chứa một dòng cũ.

## 3. Hợp đồng nhập liệu và validation

| Quy tắc | UI | Quy tắc gửi/lưu |
|---|---|---|
| Tỷ lệ quá hạn | Nhập `5` hoặc `5,25`; hậu tố **% cọc/ngày** đặt bên cạnh. | Gửi số 5 hoặc 5.25, kiểu `DEPOSIT_PERCENT_PER_DAY`. Tối đa 2 chữ số thập phân, không vượt 100. Xác minh và thống nhất cận dưới: API cấu hình ở SHA rà soát chấp nhận 0 nhưng editor công bố yêu cầu dương. Đề xuất 0.01–100 nếu 0 không có nghĩa “tắt phí” được chốt. Nếu 0 hợp lệ, phải kiểm các consumer không fallback thành 5 hoặc chia cho 0. |
| Ngày đệm cho thuê lại | Nhập `3`; hậu tố **ngày**. | Số nguyên 0–60, kiểu `FIXED`. `0` là giá trị hợp lệ, khác ô trống. Nếu chưa có bản ghi, phân biệt “Mặc định: 3 ngày” với giá trị đã lưu. |
| Cọc | Khuyến nghị hiện **1 tháng tiền thuê** chỉ đọc nếu nghiệp vụ chốt cọc cố định một tháng. | Kiểm quyết định mới nhất trước khi mở sửa. Backend hiện còn hiểu `FIXED` theo nhiều nghĩa. Nếu nghiệp vụ cho chỉnh, cần chọn rõ đơn vị tháng hay VND, số thuần trong ô, ánh xạ rõ và test trên cả báo giá lẫn tạo đơn. Không tự đổi nghĩa bản ghi cũ; nếu dữ liệu hiện hành khác quy tắc đã chốt, hiển thị/cảnh báo đúng và đưa vào đối soát. |

- Dùng input số hoặc `inputMode="numeric"`/`"decimal"` với parser chặt nếu cần hỗ trợ dấu phẩy tiếng Việt. Dấu phẩy thập phân được chuẩn hóa thành dấu chấm, không dùng parser tiền để bỏ dấu phân cách. Không tự đổi `5,25` thành `525`. Không nhận chữ, hậu tố, dấu phân cách hàng nghìn, dạng số mũ, chuỗi nhiều dấu phân cách, giá trị âm, trống hoặc ngoài khoảng.
- Dữ liệu nạp vào ô là giá trị thô, không lấy chuỗi định dạng từ `fieldValue`. Đơn vị hiện trong label/hậu tố và có nhãn trợ năng. Chỉ gửi các trường thực sự thay đổi; kiểm hết form trước request đầu tiên.
- Kiểm lại trên backend tại đường ghi/activate tương ứng; FE validation chỉ hỗ trợ nhập. Khi tạo policy chưa có bản ghi, khai báo loại tính theo từng trường, không dùng `FIXED` chung. Không âm thầm chuyển policy hiện có kiểu không tương thích; báo rõ để kiểm tra dữ liệu.
- Giữ flow tạo bản nháp → kích hoạt/thay thế, kiểm xung đột và tải lại từ API. Nếu lưu nhiều mục và chỉ thành công một phần, thông báo mục nào đã áp dụng, mục nào chưa; không báo thành công toàn bộ.

## 4. Hướng dẫn chỉ đọc và xử lý legacy

- Render hướng dẫn bằng text/danh sách tên–giá trị, không dùng input bị khóa. Với mục không có dữ liệu, hiện “Chưa có hướng dẫn” hoặc ẩn dòng rỗng theo cùng một quy tắc.
- Tách metadata hiển thị khỏi whitelist chỉnh sửa. `policyJobs` chỉ nhận khóa quy tắc được phép sửa; payload không cập nhật `ruleDescription` từ form. Khi thay policy, bảo toàn mô tả và các thuộc tính cần thiết của bản gốc. Không để các trường hướng dẫn cùng loại OVERDUE/RENEWAL tạo job phụ hoặc mất mô tả.
- Giữ editor **Nội dung khách đọc** riêng; yêu cầu chỉ đọc áp dụng cho **hướng dẫn nghiệp vụ trên màn cấu hình**, không tự khóa quy trình soạn/công bố nội dung hoặc sửa lịch sử consent.
- Bỏ render `legacyList` trên trang chính; dọn helper/constants chỉ dùng cho khối đó sau khi tìm tất cả tham chiếu. Không dùng RENEWAL 24 giờ làm giá trị mặc định cho nhắc hạn, gia hạn hay giữ chỗ. Không xóa DB, không tự ngừng ACTIVE, không bỏ API lịch sử và không thêm migration chỉ để ẩn một khối UI. Nếu sau này cần ngừng bản legacy trong DB, đối chiếu consumer và định danh chính xác rồi xử lý riêng.

## 5. Trình tự triển khai

1. **Xác nhận baseline:** đọc `AGENTS.md`, quyết định mới nhất và nhánh thực tế. Kiểm tra tên route, các kiểu policy, khoảng hợp lệ và việc tỷ lệ còn chỉnh từ editor công bố hay không. Báo rõ nếu gặp khác biệt với SHA trên.
2. **Gọn UI trước:** sửa `PolicySettingsPage.jsx` và style liên quan; gom phần chỉ đọc, bỏ khối legacy, giữ điều hướng và trạng thái tải/lỗi. Đồng thời gỡ guidance khỏi state lưu và `policyJobs`.
3. **Chuyển form sang số:** cập nhật metadata, parser/validation và payload trong `policyFields.js`, giữ luồng trong `policyActions.js`. Kiểm `businessFormat.js` để không làm ảnh hưởng các màn khác. Đồng bộ validation trong `OperationsService` nếu phát hiện lệch; chỉ sửa backend trong phạm vi cần bảo đảm hợp đồng nhập.
4. **Kiểm thử và bàn giao:** chạy test FE/BE liên quan theo lệnh repo; kiểm chế độ API với DB test, kiểm cả request/response và tải lại. Không đánh dấu xong chỉ bằng mock. Kế hoạch này không bao gồm tái cấu trúc nguồn tính quá hạn hay thay đổi workflow công bố, trừ khi cần chặn một lỗi validation trực tiếp và ghi rõ phạm vi.

## 6. Tiêu chí nghiệm thu

| Ca | Kết quả |
|---|---|
| Mở màn Policies desktop/mobile | Quy tắc chỉnh được thấy ngay; mục chỉ đọc gọn; không lặp mô tả dài; không có thẻ legacy. |
| Rate `5`, `5,25`, `5.25`; tạo OVERDUE khi chưa có bản ghi | API nhận JSON number tương ứng; đúng `DEPOSIT_PERCENT_PER_DAY`; reload giữ đúng số và đơn vị. |
| Rate trống, âm, >100, hơn 2 chữ số thập phân, có chữ/hậu tố hoặc dấu sai | Lỗi tại ô, không gửi mutation. Giá trị 0 theo quyết định được chốt và kiểm cả FE/BE. |
| Ngày đệm `0`, `3`, `60`; thử `-1`, `61`, `3.5` | Ba giá trị đầu lưu được; ba giá trị sau bị chặn. Gọi API trực tiếp cũng không kích hoạt giá trị sai. |
| Xem hướng dẫn và sửa rate cạnh mục hướng dẫn | Hướng dẫn là text, không có trường chỉnh; nội dung mô tả cũ được giữ sau khi lưu. |
| DB có RENEWAL legacy hoặc có RENEWAL hợp lệ cùng giá trị 24 | Không có thẻ legacy, không sửa/xóa nhầm bản ghi, không dùng dữ liệu legacy cho quy tắc tự động. |
| Hủy xác nhận hoặc API lỗi/xung đột khi lưu | Không báo đã áp dụng; giữ dữ liệu người dùng đang nhập nếu chưa lưu, hiển thị đúng kết quả nếu chỉ lưu một phần. |

**Bàn giao cho reviewer:** Ghi nhánh/SHA, danh sách file, quyết định về cọc và rate 0, ảnh trước/sau nếu đã chạy UI, request mẫu đã loại dữ liệu nhạy cảm, lệnh test và kết quả thực tế. Tôn trọng quy định repo về commit/push/PR.
