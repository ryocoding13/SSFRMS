# SSFRMS — Rà soát và tái cấu trúc chính sách Business Operator

**Mốc đối chiếu:** 09/11/2026 · [main tại a6fe069](https://github.com/ryocoding13/SSFRMS/tree/a6fe0693d5e990db422ec3d5ae9a0be36b2cee0a).  
**Bằng chứng:** đọc source ở commit trên và đối chiếu ba dòng DB do người dùng cung cấp. Chưa chạy truy vấn trên DB thật, chưa kiểm thử runtime và chưa sửa code. Agent phải kiểm lại SHA, schema và quyết định nghiệp vụ mới hơn trước khi triển khai.

## 1. Kết luận và mục tiêu

Hai cấu hình đang có nơi đọc để vận hành là **tiền cọc** và **tỷ lệ quá hạn**. Dòng “Thời gian giữ chỗ đặt trước” được lưu dưới loại `RENEWAL`, có thể xuất hiện trên form nhưng không điều khiển hạn giữ chỗ. Một số ô cho sửa chỉ lưu mô tả. Riêng tỷ lệ quá hạn tồn tại ở hai nguồn: backend tính tiền đọc bảng policy, còn một số màn tự tính từ tỷ lệ của phiên bản nội dung.

Mục tiêu: Operator nhìn được tham số nào thực sự có hiệu lực, ở đâu, từ ngày nào; khách thấy số tiền thống nhất với backend và vẫn đọc được đúng nội dung mình từng đồng ý. Phân rõ **quy tắc chạy tự động**, **nội dung công bố** và **lịch sử thay đổi**.

## 2. Audit ba dòng trong DB

| ID | Dữ liệu được cung cấp | Nơi đọc và tác dụng | Kết luận |
|---|---|---|---|
| 1 | `DEPOSIT / FIXED / 1.00`, toàn hệ thống, ACTIVE từ 16/08/2026 | `FacilityService` báo giá, `ReservationService` tạo đơn, `RenewalUnitMove` xử lý cọc khi đổi ô. `OpsRules.CalculateDeposit` hiểu giá trị này là 1 tháng tiền thuê. Khi không có policy phù hợp, mặc định cũng là 1 tháng. | Có tác dụng. UI ra 1 tháng không đủ chứng minh đã chọn đúng ID 1 vì mặc định trùng giá trị. |
| 2 | `RENEWAL / FIXED / 24.00`, toàn hệ thống, ACTIVE từ 16/08/2026; tên và mô tả nói giữ chỗ 24 giờ | `policyFields.js` dùng loại RENEWAL cho ô “Thông báo trước khi hết hạn”, có thể định dạng thành **24 ngày**. Đơn mới đặt hạn 15 phút ở `ReservationService`; chuyển sang thu tại quầy thì `PayOSService` đặt hạn đến hết ngày hẹn nhận kho theo giờ Việt Nam. `OverdueProcessor` dùng 30 ngày để đánh dấu EXPIRING. `RenewalApproval` đặt hạn tối đa 24 giờ kể từ duyệt, không vượt hạn hợp đồng. | Có thể đọc/lưu/hiển thị, nhưng các luồng trên không đọc dòng này để chạy. Các mốc 15 phút, cuối ngày, 30 ngày và 24 giờ là bốn khái niệm khác nhau. |
| 3 | `OVERDUE / DEPOSIT_PERCENT_PER_DAY / 5.00`, toàn hệ thống, ACTIVE từ 09/11/2026 | `OverdueProcessor` và các nhánh trả kho trong `FacilityOpsService` đọc OVERDUE. Tỷ lệ 5% cọc ban đầu/ngày, tối đa bằng cọc. Chọn theo trạng thái, ngày hiệu lực và phạm vi cơ sở/loại kho; dòng toàn hệ thống có thể bị bản cụ thể hơn thay thế. | Có tác dụng khi được chọn. Mốc nhắc ngày 10–14 và xử lý đồ ngày 20 vẫn là hằng số riêng; sửa rate không đổi các mốc này. |

Ngày hiệu lực nghiệp vụ và dấu thời gian lưu DB là hai trường khác nhau. Khi xác minh một giao dịch cụ thể, ghi rõ ngày được consumer dùng để chọn policy và ID policy thực sự được chọn.

## 3. Ma trận màn hình, dữ liệu và CRUD

| Mục | Đang lưu/đọc gì? | Có đổi hành vi không? |
|---|---|---|
| Mức cọc | `DEPOSIT` | Có consumer thực; bị giới hạn bởi quy tắc cọc một tháng. |
| Ngày đệm cho thuê lại | `RELET_BUFFER` | `UnitAvailability` dùng khi tính khả dụng. Số nguyên 0–60; mặc định 3 ngày. Không thấy dòng này trong ba bản ghi được cung cấp. |
| Phí quá hạn/ngày | `OVERDUE` trong form chung; thêm `RentalPolicyVersion.Rate` trong editor | Có, nhưng hai đường chỉnh có thể lệch. |
| Nhắc trước khi hết hạn | Giá trị `RENEWAL` | Chưa nối với mốc EXPIRING đã kiểm. |
| Số lần gia hạn tối đa | `ruleDescription` | Chưa thấy kiểm giới hạn từ ô này. |
| Thời gian hoàn cọc / kiểm tra khi trả kho | `ruleDescription` của `RETURN` | Không cấu hình deadline. |
| Phí hủy trước ngày nhận kho | `ruleDescription` của `CANCELLATION` | Không cấu hình công thức. Luồng hủy có thể vẫn tính phí theo quy tắc riêng. |
| Mốc xử lý quá hạn | `ruleDescription` của `OVERDUE` | Không đổi các mốc worker. |

- **Chính sách cấu hình:** API `/api/operations/policies` có đọc, tạo, sửa/xóa nháp, kích hoạt/ngừng áp dụng. Form chung đọc bản toàn hệ thống đang hiệu lực và lưu bằng cách tạo bản thay thế rồi kích hoạt. Màn trạng thái có ngừng bản ACTIVE, xóa DRAFT; thiếu luồng mở sửa/kích hoạt lại nháp đã lưu, thiếu bộ chọn quản lý phạm vi riêng. Giữ lịch sử các bản đã áp dụng.
- **Phiên bản chính sách thuê kho:** API đọc bản hiện hành, đọc theo phiên bản và công bố bản mới. UI có soạn, xem trước, công bố; thiếu danh sách lịch sử trong editor. Không sửa đè hoặc xóa bản công bố có thể đã được dùng làm bằng chứng.
- **Bảy nhóm nội dung:** thanh toán, QR, gia hạn, quá hạn, trả kho, hủy, hỗ trợ lưu trong `RentalPolicyVersion.SectionsJson`. Đây là nội dung khách đọc, có thể xem theo phiên bản đồng ý. Sửa văn bản không tự đổi công thức, deadline hoặc điều kiện nghiệp vụ. Các cổng giao dịch có chỗ kiểm consent; trạng thái đầy đủ của từng route cần kiểm riêng, không suy từ nội dung hiển thị.
- **Ngoại lệ ở editor:** công bố lưu `RentalPolicyVersion.Rate` và hiện còn cập nhật bản OVERDUE ACTIVE đầu tiên tìm thấy hoặc tạo bản mới. Đường này không chọn rõ theo phạm vi/ngày như lúc tính phí; có nguy cơ ghi nhầm bản và tạo lệch giữa các màn.

## 4. Dữ liệu viết cứng hoặc dùng sai mục đích

1. **Frontend:** `workflowModel.js` có nội dung mẫu và fallback 5%; `RentalPolicyPage.jsx` và `RentalPolicyEditorPage.jsx` có các dòng tóm tắt viết trực tiếp. Editor hiển thị các quy định như trần 100% cọc, phí vệ sinh 10%, mốc 10–14/20, hạn gia hạn 24 giờ, hoàn do sự cố. Một số có logic backend riêng; giá trị trên UI chưa được đồng bộ từ nguồn quy tắc. Không dùng mock làm bằng chứng backend.
2. **Deadline:** `VITE_PAYMENT_TIMEOUT_SECONDS` mặc định 900 giây, tách biệt với bảng policy; checkout có đọc `expires_at` từ API. Rà thêm các nhánh overlay, countdown và tự hủy ở frontend; chế độ API phải dùng hạn backend trả, không suy từ đồng hồ trình duyệt.
3. **Backend trả rate nhưng frontend dùng nguồn không khớp quyết toán:** `DepositLedgerPage` và `OverdueCasePage` lấy rate bản nội dung để tự tính. Backend tra OVERDUE theo phạm vi/ngày. UI dùng `ceil(100 / rate)` để suy ngày cạn cọc rồi gắn với xử lý đồ. Ví dụ 6% cạn cọc ngày 17 nhưng mốc xử lý đồ backend vẫn là ngày 20.
4. **Backend viết cứng:** hạn đặt chỗ, mốc EXPIRING, giới hạn thanh toán sau duyệt và mốc nhắc/xử lý đồ nêu ở trên. Chỉ đưa chúng thành ô chỉnh được khi có quyết định nghiệp vụ và consumer thực.

## 5. Thiết kế đích

| Khu vực | Hiển thị | Cách thay đổi |
|---|---|---|
| **Quy tắc vận hành** | Giá trị, đơn vị, phạm vi, ngày hiệu lực, nguồn, luồng chịu tác động. Phân biệt “Có thể chỉnh” và “Quy định cố định”. | Một đường quản lý cho mỗi tham số. Nháp → kiểm tra → kích hoạt; giữ lịch sử và audit. |
| **Nội dung công bố cho khách** | Bảy nhóm nội dung, phiên bản hiện hành, xem trước và lịch sử. | Công bố tạo bản bất biến; không tự sửa quy tắc vận hành. Nếu cần hiển thị con số lịch sử, lưu snapshot lúc công bố; bản cũ không đọc ngược giá trị hiện hành. |
| **Lịch sử thay đổi** | Ai sửa, trước/sau, phạm vi, thời điểm hiệu lực và trạng thái. | Xem lại bản cũ; nếu cần áp dụng lại thì tạo thay đổi mới có audit. |

Phân biệt **phiên bản khách đồng ý** với **phiên bản quy tắc dùng để tính**. Chốt với nhóm thời điểm xác định quy tắc cho hồ sơ đang mở trước khi triển khai; không hồi tố khoản đã chốt, không tự đổi deadline đã cấp, không gán consent thay khách.

## 6. Gói triển khai tuần tự

### P0 — Kiểm kê và sửa giao diện gây hiểu nhầm

- Ghi SHA, đọc AGENTS.md và quyết định mới nhất. Đối chiếu API và DB test theo từng tham số: loại, scope, giá trị, consumer và số liệu hiển thị. Dùng chế độ API, không dùng demo để nghiệm thu.
- Bỏ ánh xạ RENEWAL=24 sang ô “Thông báo trước khi hết hạn”. Gắn nhãn legacy/chưa áp dụng cho dòng đó, giữ bản ghi và lịch sử. Không đổi 24 giờ thành 24 ngày hoặc chuyển nó sang tham số mới.
- Chuyển ô chỉ lưu văn bản sang nội dung hướng dẫn hoặc ghi rõ “Chỉ hiển thị, không thay đổi xử lý tự động”. Hiển thị quy định cố định dưới dạng chỉ đọc.

**Xong khi:** operator không thể nhầm văn bản đã lưu với cấu hình đang chạy; dữ liệu DB cũ vẫn đọc được.

### P1 — Thống nhất tính quá hạn từ backend

- Dùng `Policies.OVERDUE` làm nguồn vận hành. Dùng chung bộ chọn policy và tính phí giữa worker, dự tính trả kho, quyết toán và API báo cáo quá hạn. Chốt ngày áp dụng cho từng luồng và ưu tiên phạm vi; nếu có trường hợp cố ý dùng ngày khác, ghi rõ quy tắc và test.
- API trả ID/scope hoặc nguồn mặc định, tỷ lệ, ngày tính, số ngày trễ, tiền khấu trừ, cọc còn lại, mốc nhắc/xử lý đồ và trạng thái dự tính/đã chốt. Đối chiếu DTO hiện có trước khi thêm trường; thống nhất làm tròn và giới hạn tiền cọc.
- Customer và Manager dùng kết quả server. Chuyển hoặc bỏ công thức frontend khỏi chế độ API. Ngày cạn cọc và ngày đủ điều kiện xử lý đồ là hai giá trị riêng.
- Tắt đường công bố nội dung tự cập nhật OVERDUE sau khi giao diện dùng nguồn vận hành mới. Giữ rate cũ trong các phiên bản để đọc lịch sử; không xóa hoặc sửa nội dung đã công bố.

**Xong khi:** rate 6%, cọc 1.000.000 đ, trễ 2 ngày → 120.000 đ ở worker, màn Customer/Manager và quyết toán trong cùng điều kiện; xử lý đồ vẫn theo mốc riêng.

### P2 — Chuẩn hóa các tham số khác

- Tách rõ giữ chỗ online (phút), hạn thu tại quầy (cuối ngày hẹn theo giờ VN), mốc EXPIRING (ngày), hạn thanh toán gia hạn (giờ), ngày đệm cho thuê lại (ngày), cọc (tháng hoặc quy tắc cố định). Giữ mặc định hiện có trong đợt chuyển đổi.
- Với mỗi mục, chỉ mở chỉnh sửa sau khi có quyết định: ai được sửa, phạm vi, đơn vị, giá trị hợp lệ, thời điểm hiệu lực, xử lý giao dịch đang mở. Nếu chưa chốt, hiển thị chỉ đọc và tiếp tục phần độc lập.
- Các mục phí hủy, SLA hoàn cọc/kiểm tra và giới hạn gia hạn chỉ trở thành cấu hình sau khi có quy tắc được duyệt, trường dữ liệu có kiểu, validation và consumer. Không lấy số bằng cách phân tích văn bản.
- Dùng migration mới nếu cần; chuẩn bị kiểm kê trước/sau, chạy thử không ghi, chuyển đổi có thể chạy lại. Không xóa dòng legacy hoặc sửa migration đã merge. Không tự thay dữ liệu tài chính hoặc policy tùy chỉnh chưa được đối soát.

### P3 — Hoàn thiện quản lý nháp và lịch sử

- Thêm sửa nháp, kích hoạt nháp, bộ lọc trạng thái/phạm vi phù hợp quyền. Tận dụng API sẵn có; backend kiểm trạng thái, scope và xung đột, không chỉ ẩn nút trên UI. Giữ các bản đã kích hoạt, chỉ xóa nháp.
- Editor nội dung thêm danh sách lịch sử và xem bản công bố. Công bố kiểm phiên bản đang chỉnh để tránh ghi đè khi hai người cùng thao tác. UI báo xung đột rõ và giữ nội dung đang soạn.
- Chốt cơ chế tránh một thao tác tạo hai bản/để lại nháp trùng khi mất phản hồi. Nếu lưu nhiều nhóm độc lập, báo nhóm nào đã áp dụng, nhóm nào còn nháp hoặc thất bại.

## 7. Ma trận kiểm thử và bàn giao

| Kiểm thử | Kỳ vọng |
|---|---|
| Dữ liệu ba dòng như trên | RENEWAL legacy không đổi deadline; cọc và rate có thể truy ra nguồn được chọn. |
| Thay rate 5% → 6%, rate riêng theo cơ sở/loại kho, policy chưa đến ngày hoặc đã hết hiệu lực | API/worker chọn đúng bản; UI và quyết toán thống nhất. |
| Cọc 1 triệu, quá hạn 17 ngày ở 6% | Khấu trừ không vượt cọc; ngày cạn cọc không thay thế mốc xử lý đồ ngày 20. |
| Kiểm các hạn online, tại quầy và gia hạn, gồm sát nửa đêm VN | UI dùng hạn server, hết hạn đúng quy tắc, deadline hồ sơ đang mở không bị đổi khi sửa cấu hình. |
| Sửa nội dung hoặc công bố phiên bản mới | Khách thấy bản mới ở trang hiện hành; bằng chứng cũ vẫn đọc đúng bản cũ; số tiền không tự đổi. |
| Tạo/sửa/kích hoạt/ngừng nháp và hai operator thao tác đồng thời | Đúng quyền, lịch sử giữ nguyên, xung đột rõ, không sinh hai bản hiệu lực chồng nhau trong cùng phạm vi. |
| Đổi một tham số thực sự cho chỉnh và chạy lại nghiệp vụ | Hành vi đổi đúng tham số, scope và thời điểm; chỉ đổi chữ trên UI không được tính là đạt. |

**Điểm vào source:** Frontend `features/business/policies/{PolicySettingsPage,PolicyStatusPage,RentalPolicyEditorPage}.jsx`, `policyFields.js`, `policyActions.js`, `workflowModel.js`, `DepositLedgerPage.jsx`, `OverdueCasePage.jsx`, `CheckoutPage.jsx`. Backend `OperationsEndpoints`, `RentalPolicyEndpoints`, `OperationsService`, `RentalPolicyService`, `OpsRules`, `OverdueProcessor`, `FacilityOpsService`, `ReservationService`, `PayOSService`, `RenewalApproval`, `UnitAvailability`.

**Bàn giao:** Ghi SHA, file/API/migration thay đổi, ma trận **trường → nguồn → consumer → hành vi → bằng chứng test**, lệnh và kết quả chạy thực tế, các quyết định còn mở và hướng triển khai dữ liệu. Tách rõ “đã đọc source”, “đã test” và “chưa xác minh”. Không reset DB nhóm hoặc tự commit/push/PR/merge.
