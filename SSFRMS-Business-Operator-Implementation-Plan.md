# SSFRMS — Plan sửa lỗi và hoàn thiện flow Business Operator

Ngày soạn: 04/11/2026. Dành cho agent triển khai, người review: Đạt và thành viên phụ trách phần giao nhau.

Repo: https://github.com/ryocoding13/SSFRMS

SHA nền đã fetch/đối chiếu: `bd5736ec19bfc6edf1f20a82f13710a4cad05a31` trên `main`.

Đây là kế hoạch triển khai, không phải báo cáo đã sửa hoặc đã test pass. Những rủi ro concurrency được suy ra từ source phải có test tái hiện trên SQL Server. Khi bắt đầu, agent phải kiểm main mới và bỏ/điều chỉnh mục đã được người khác xử lý.

## 1. Mục tiêu và phạm vi

Hoàn thiện B01 Tổng quan, B02 Chính sách, B03/B03a Giá theo cơ sở, B04 Báo cáo/xuất dữ liệu, B05 Quản lý cơ sở. API chính đã tồn tại: mở rộng service/DTO và nối FE hiện có, không tạo module trùng.

Kết quả cần đạt:

- Cấu hình được lưu có tác dụng đúng với quy tắc đã chốt; các trường chỉ là hướng dẫn được phân biệt rõ với tham số tự động.
- Chính sách nội dung, tham số tính phí và bằng chứng đồng ý không mâu thuẫn.
- Sửa giá, kích hoạt policy, công bố phiên bản và đóng cơ sở an toàn khi nhiều request cạnh tranh.
- Dashboard, báo cáo, CSV và XLSX của FE dùng cùng định nghĩa tiền, cùng phạm vi.
- Mỗi thao tác có readback, audit và cách xử lý retry/timeout rõ ràng.

Tính năng hiện có: F22/F23 `active`; F24 `passing`; F31 `passing` chỉ trong phạm vi FE. Không tự đánh dấu passing cho toàn flow.

Phần ngoài phạm vi sửa chính: damage workflow, ảnh hỗ trợ, yêu cầu chìa khóa, auth/password reset, CI/CD, IoT. Chỉ sửa consumer thanh toán/gia hạn/hoàn tiền khi cần để bảo đảm cấu hình Business thực sự hoạt động. Không làm lại toàn bộ các flow đó.

## 2. Quy tắc giao việc cho agent

1. Đọc `AGENTS.md`, `DECISIONS.md`, feature/progress/TODO hiện tại; in pre-flight có bằng chứng. Nếu sửa FE đọc thêm quy định FE và bản đồ frontend.
2. Làm trên nhánh riêng, ví dụ `feature/dat-business-operator-completion`; giữ thay đổi có sẵn, không reset/stash/clean thay người dùng.
3. AI sửa file và chạy kiểm thử; không commit/push/tạo PR/merge theo AGENTS. Thành viên thực hiện các bước Git cuối.
4. Không sửa migration đã merge. Tạo migration mới, kiểm DB mới và upgrade DB thử có dữ liệu. Không reset DB dùng chung.
5. Không tự sửa tiền đã thu, snapshot giá/cọc hợp đồng cũ, lịch sử consent hay audit. Đề xuất sửa dữ liệu phải có inventory, dry-run, phạm vi và cách phục hồi rõ.
6. Ưu tiên bản vá nhỏ theo các gói bên dưới. Nếu thiếu SQL Server vẫn viết/test phần độc lập, ghi chưa kiểm chứng; không báo concurrency pass bằng SQLite.
7. Quyết định mới về nghiệp vụ phải được nhóm chốt rồi ghi mục mới trong DECISIONS, không lấy đề xuất trong plan làm quyết định đã được duyệt. Chỉ dừng phần phụ thuộc, tiếp tục phần độc lập.
8. D32 thay các rule cũ: cọc một tháng, không nợ vượt cọc sau trả kho, vệ sinh chỉ khi có vi phạm, quá hạn tính trên cọc theo ngày Việt Nam, không khôi phục thu hồi QR thủ công hoặc ân hạn mở QR sau hết hạn.

## 3. Đối chiếu flow FE đang có

Các đường dẫn FE trong bảng thuộc `SafeSpace-Customer-UI/SafeSpace-Customer-UI/src/`.

| Màn/route | Điểm vào FE | API hiện có | Việc thực hiện |
|---|---|---|---|
| B01 `#/business` | `features/business/dashboard/BusinessDashboardPage.jsx` | GET operations/facilities, reports/facilities, reports/revenue-trend | Sửa nguồn metric, giữ contract FE hoặc bổ sung có kiểm soát |
| B02 `#/business/policies`, `/policy-status` | `policies/PolicySettingsPage.jsx`, `PolicyStatusPage.jsx`, `policyActions.js`, `policyFields.js` | GET/POST/PUT/DELETE `/api/operations/policies`, POST `/{id}/activate`, `/{id}/deactivate` | Validation theo D32, concurrency, trường cấu hình thật, receipt/readback |
| Nội dung `#/business/policy-content` | `policies/RentalPolicyEditorPage.jsx`, `policyPublication.js`; workflow adapter | GET `/api/rental-policy`, POST `/api/rental-policy/actions` | Publish/version/seed/sync, bảo toàn nội dung khi lỗi |
| B03 `#/business/pricing`, `/rates?facility=...` | `pricing/PricingPage.jsx`, `FacilityRatePage.jsx` | GET `/api/operations/rates`, POST cùng route; GET `/api/unit-types` | Khóa cặp facility/type, ngày VN, stale edit |
| B04 `#/business/reports`, `/export` | `reports/BusinessReportPage.jsx`, `ReportExportPage.jsx`, `reportScope.js`, `reportExport.js` | GET `/api/operations/reports/{facilities,unit-types,revenue-trend,rental-status,export}` | Metric tiền, scope, CSV/XLSX và readback |
| B05 `#/business/facilities` | `facilities/FacilityManagementPage.jsx`, `facilityMutation.js` | GET/POST `/api/operations/facilities`, PUT `/{id}`, PUT `/{id}/status` | Kiểm trạng thái mới, khóa chung, audit nguyên tử, retry create |

Adapter chính: `features/business/api/businessApi.js`. Nội dung policy gọi qua `features/facility-operations/workflows/workflowApi.js` và `useWorkflowData.js`.

**Không ghi lại lỗi cũ không còn đúng:** revenue-trend và rental-status đã nhận facilityId/unitTypeId; facilities và unit-types đã nhận from/to. XLSX được FE tạo từ CSV/snapshot, không cần thêm server XLSX để hoàn tất phạm vi hiện tại. Report trạng thái kho là snapshot hiện tại, không giả là occupancy lịch sử của kỳ được chọn.

## 4. Các điểm cần chốt và cách tiếp tục trong lúc chờ

| Mã | Cần chốt | Đề xuất để nhóm xem xét | Phần tiếp tục được ngay |
|---|---|---|---|
| Q1 | Global policy D33 và các scope facility/type cũ cùng tồn tại: nguồn nào điều khiển rate khách nhìn thấy? | Với rule toàn hệ thống theo D32/D33: một nguồn chuẩn, chặn ghi scope không được hỗ trợ. Không tự chuyển hết scope cũ; xuất danh sách ngoại lệ. Nếu giữ override thì GET policy/consent phải biểu diễn đúng scope/version thực áp dụng. | Bản vá khóa, lỗi 409, validation input, kiểm kê dữ liệu |
| Q2 | Định nghĩa doanh thu sau khi có hoàn tiền thuê, cọc bị khấu trừ | Giữ `rentalAndFeeRevenue` là thu thuê/phí gộp theo D16 cho đến quyết định thay thế; thêm trường hoàn thuê/phí và doanh thu ròng nếu được chốt. Định nghĩa cọc giữ, cọc hoàn, cọc đã dùng bù phí để không đếm hai lần. | Loại REFUND khỏi phải thu, chuẩn bị dữ liệu phân bổ hoàn, fixture và đối soát |
| Q3 | Publish policy có bắt khách đang thanh toán đồng ý lại ngay không? | Phân biệt bằng chứng đã chấp thuận và policy hiện áp dụng. Chốt reservation đã consent trước publish, link đã tạo trước publish, renewal mới và webhook tiền đã về. Không phủ nhận khoản tiền thật chỉ vì version đổi giữa chừng. | Kiểm owner, accepted, consent bắt buộc trước tạo giao dịch mới; không mất audit |
| Q4 | BUSINESS_OPERATOR là alias cũ hay role độc lập? | Giữ OPERATIONS là role chính; chuẩn hóa alias/rollout theo quyết định nhóm. Không tự mở thêm ADMIN hoặc bỏ quyền cũ chỉ vì muốn test pass. | Lập ma trận quyền thực tế; regression role hiện tại |

Không cần hỏi lại về các rule D32 đã chốt. Không đổi văn bản bất biến của policy version cũ để làm nó khớp rate mới.

## 5. Thứ tự triển khai và ánh xạ lỗi

| Mã | Kết quả cần đạt | Gói |
|---|---|---|
| BO01 | Cọc một tháng, cấu hình và DB cũ không làm lệch số tiền | W2 |
| BO02 | Rate và mốc quá hạn lấy cùng nguồn trên các consumer | W3 |
| BO03 | Nội dung policy và tham số áp dụng không lệch scope/version | W3 |
| BO04 | Publish cạnh tranh trả đúng 409, không tạo nhiều current | W3 |
| BO05 | Seed Reference có version thật, bỏ fallback FK giả | W3 |
| BO06 | Activate/replace đồng thời không chồng hiệu lực | W3 |
| BO07 | Consent DB được kiểm tại các cổng giao dịch | W4 |
| BO08 | Rate không chồng lịch, stale edit không ghi đè | W5 |
| BO09 | Ngày hiệu lực nhất quán theo Việt Nam | W1 |
| BO10 | Hoàn thuê/phí/cọc được phân loại đúng trong báo cáo | W7 |
| BO11 | Phải thu khách không bao gồm khoản đang phải hoàn | W7 |
| BO12 | Đơn PENDING_AT_FACILITY chặn INACTIVE | W6 |
| BO13 | Đóng cơ sở và đặt kho dùng cùng protocol khóa | W6 |
| BO14 | Tạo cơ sở/audit nguyên tử, retry không tạo trùng | W6 |

| Gói | Công việc | Mã review | Phụ thuộc |
|---|---|---|---|
| W0 | Inventory, baseline, contract, kiểm kê dữ liệu | Tất cả | Không |
| W1 | Clock VN và khóa dùng chung | BO09, nền cho BO04/06/08/13 | W0 |
| W2 | Tiền cọc đúng D32 và cấu hình không mâu thuẫn | BO01 | W0/W1 |
| W3 | Policy tham số/nội dung/worker/version/seed | BO02–BO06 | W1, Q1 cho phần sync |
| W4 | Consent thực thi qua các cổng thanh toán | BO07 | W3, Q3 cho trường hợp chuyển phiên bản |
| W5 | Giá thuê không chồng lịch, stale edit | BO08 | W1 |
| W6 | Cơ sở: trạng thái, atomic audit, retry | BO12–BO14 | W1 |
| W7 | Báo cáo đúng phân loại tiền | BO10–BO11 | Q2 cho metric đổi nghĩa; W2/W3 để kiểm luồng tiền |
| W8 | Nối FE, E2E thật, tài liệu bàn giao | Tất cả | Các gói liên quan |

Thực hiện tuần tự theo dependency. Mỗi gói có diff, test và ghi nhận riêng để review, không cần đợi toàn bộ xong mới kiểm chứng. Không yêu cầu agent mở nhiều nhánh hoặc chạy nhiều agent.

### W0 — Kiểm kê trước khi sửa

- Ghi SHA thực tế, git status, .NET/Node/SQL Server, lệnh baseline và lỗi sẵn có.
- Trace từng route Business đến HTTP request thật. Xác định `VITE_USE_API` và mock/demo; tuyệt đối không dùng demo để nghiệm thu BE.
- Đọc service consumer: ReservationService, public availability service thực tế tìm bằng `rg`, PayOSService, RenewalService/RenewalSettlement, RefundPolicy, các nhánh hoàn tiền/sự cố, OverdueProcessor và FacilityOpsService.Overdue.
- Kiểm kê read-only: DEPOSIT cũ, OVERDUE scoped/không hợp lệ, số policy current, lịch rate trùng, consent trùng, refund không phân bổ được, đơn PENDING_AT_FACILITY.
- Tạo fixture SQL Server riêng, tối thiểu hai cơ sở, hai loại kho, hai operator, khách và các role bị cấm. Không dùng dữ liệu nhóm làm dữ liệu reset test.
- Tái hiện công thức/HTTP lỗi đã thấy; concurrency phải có barrier và DbContext riêng, không dựa vào request tuần tự.

### W1 — Clock Việt Nam và khóa transaction

Điểm sửa: `StorageProject.Infrastructure/Services/OpsRules.cs`, `CheckoutTransaction.cs` và caller liên quan. Helper clock mới, nếu cần, phải ghi là file mới và đăng ký DI đúng convention.

- Tái sử dụng `TimeProvider`/clock hiện có nếu tìm thấy; nếu chưa có tạo một abstraction nhỏ dùng được trong test. Timestamp lưu UTC; ngày nghiệp vụ/range hiệu lực dùng Việt Nam.
- Không đổi máy móc mọi `TodayUtc`. Phân loại ngày báo cáo, ngày giá có hiệu lực, ngày thuê và timestamp trước khi thay.
- Tái sử dụng `CheckoutTransaction`/`sp_getapplock`, không dùng semaphore RAM thay khóa đa instance. Lấy khóa trước query kiểm điều kiện; reload entity nếu từng load trước khóa.
- Resource đã có `inventory:{facilityId}` cho đặt chỗ/provisioning và `contract:{contractId}` cho một số nhánh gia hạn. BO13 phải dùng cùng khóa inventory, không tạo tên khóa riêng chỉ có Business dùng.
- Định nghĩa khóa mới cho cặp giá và policy scope/publish. Nếu cần nhiều khóa, lập thứ tự toàn cục sau khi inventory caller cũ; không áp một thứ tự mới trái luồng đang có gây deadlock.
- Có timeout/cancellation và trả conflict phù hợp; rollback không lưu nửa dữ liệu. Không gọi gateway mạng kéo dài trong transaction chỉ để giải quyết concurrency.

Nghiệm thu: 23:59:59/00:00:00 VN, 06:59/07:00 VN; hai connection SQL thật cạnh tranh cùng resource; lỗi/timeout không để dữ liệu dở dang.

### W2 — Tiền cọc và validation cấu hình (BO01)

Điểm sửa: OpsRules, DbSeeder, OperationsService, ReservationService và consumer availability tìm được. Không viết lại endpoint đang có.

- Cọc một tháng theo D32 ở quote → reservation → thu QR/cash, gói 1/3/6 tháng.
- Seed DEPOSIT đúng nghĩa một tháng; không chỉ sửa seed rồi cho rằng DB nhóm tự được sửa.
- Trong phạm vi D32, không để Business kích hoạt cấu hình tạo mức cọc trái rule. Nếu phải giữ parser legacy thì giới hạn nó ở đọc/compatibility và ghi rõ, không tự đổi nghĩa phần trăm lịch sử.
- Có công cụ/bước dữ liệu idempotent, dry-run trước, chỉ nhắm policy đã xác định; ghi before/after và không sửa snapshot hợp đồng/tiền đã thu. Dữ liệu custom mâu thuẫn đưa vào danh sách cần review.

Nghiệm thu: giá tháng 1.150.000, gói 3 tháng: thuê 3.450.000 + cọc 1.150.000 = 4.600.000. Quote, reservation và gateway amount thống nhất. DB cũ và DB mới đều được kiểm; retry bước chuyển cấu hình không tác động lần hai.

### W3 — Chính sách nhất quán và publish/version an toàn (BO02–BO06)

Điểm sửa: OperationsService, RentalPolicyService, OpsRules, DbSeeder, OverdueProcessor, FacilityOpsService.Overdue, RentalPolicyEndpoints, DTOs Policy/Operations, configuration policy/version; FE B02 và policy-content.

1. Lập bảng tham số có kiểu: rate mỗi ngày, ngày nhắc bắt đầu/kết thúc, ngày xử lý đồ. Mặc định 5/10/14/20 theo D32, validation thứ tự mốc. Không suy ngày xử lý đồ từ ngày cọc về 0 khi rate đổi.
2. Không parse chuỗi tiếng Việt `ruleDescription` để điều khiển tiền. Các trường hướng dẫn tiếp tục là text; trường tự động phải có DTO/storage/consumer thật. Chuẩn hóa cách nhập rate `DEPOSIT_PERCENT_PER_DAY` ở FE, không để bộ parse tiền biến số thập phân thành số khác.
3. Sau Q1, chọn một command/service điều phối mọi đường ghi rate OVERDUE, nội dung và version. Ghi nguyên tử, đúng scope/ngày, audit; không sửa bản ACTIVE tùy ý và không `FirstOrDefault` không xác định.
4. Worker, quyết toán và API xử lý đồ đọc cùng nguồn/rule. Tránh mỗi hợp đồng tự query một bộ policy khác thời điểm trong cùng lần xử lý. Đồng thời return/renewal/worker dùng cùng protocol khóa/state đã có hoặc được hoàn thiện trong phạm vi.
5. Publish yêu cầu expected version; validation rate/7 sections, độ dài mỗi section không quá 3.000 theo FE. Dùng exception/code có kiểu, không phân loại conflict theo nội dung tiếng Việt.
6. Lấy khóa publish trước đọc current/maxVersion. Mỗi lần publish chỉ có một current; thêm unique filtered index `IsCurrent = 1` bằng migration mới sau khi xử lý dữ liệu trùng có kiểm soát. Không tự chọn/xóa lịch sử trùng nếu không biết bản đúng.
7. Kích hoạt/replace policy khóa scope trước đọc conflicts; stale edit không ghi đè bản mới. Transaction bao kiểm điều kiện, supersede, activate và audit.
8. Seed Reference tạo được policy version thật với publisher hợp lệ; không bịa FK user/version = 1. Bỏ GET version giả. Nếu seed chưa sẵn sàng, trả lỗi/trạng thái có nghĩa và FE không cho publish từ dữ liệu giả; chốt response trong docs.
9. Retry publish: xác định operation ID/hash request và version gốc để cùng thao tác không tạo hai version khi response bị mất. Có thể trả receipt cũ hoặc conflict + readback chứng minh kết quả; không tự retry mutation mù.

Nghiệm thu: rate 6%, hai ngày trễ/cọc 1 triệu → 120.000 trên các consumer; cap 1 triệu, ngày xử lý đồ vẫn theo mốc riêng. Hai editor cùng version: một thành công, request stale nhận 409. GET current/version đọc đúng dữ liệu đã lưu. Cập nhật qua cả hai đường không lệch policy. DB Reference mới hoàn thành consent không lỗi FK.

### W4 — Consent thật tại cổng giao dịch (BO07)

Điểm sửa: RentalPolicyService, PayOSService, ReservationService/ReservationSettlement/ContractProvisioning, RenewalService/RenewalSettlement và DTO đọc consent liên quan. Đây là phần giao nhau; phối hợp owner thanh toán/gia hạn, không nhân đôi thay đổi đã có ở nhánh khác.

- Kiểm consent từ DB, owner và version/channel hợp lệ trước tạo link mới, chọn trả quầy và thu tiền. Nhân viên không tự đồng ý thay khách.
- Gửi gia hạn mới bắt buộc accepted/policyVersion theo D32; lưu renewal + consent cùng transaction. Consent retry không tạo bản ghi trùng cùng chủ thể/version theo định nghĩa đã chốt.
- Trả bằng chứng consent thật trong DTO reservation/contract cần đọc lại, giữ version cũ để khách xem lại.
- Áp dụng Q3 cho version đổi giữa consent, checkout và webhook. Webhook đã xác minh có tiền phải được ghi nhận/đưa review idempotent trước ACK theo luồng hiện có; không bỏ tiền thật, không tự hoàn qua ngân hàng, không trả lỗi vĩnh viễn chỉ vì policy mới.
- Giữ chữ ký, orderCode, kiểm amount và protocol khóa hiện tại. Không biến task này thành viết lại gateway.

Nghiệm thu: request trực tiếp không consent/sai owner/version/accepted=false; cash khi khách chưa consent; hai lần gửi cùng renewal; publish trong lúc checkout đang mở; tiền về sau publish vẫn có bằng chứng xử lý, không ghi thu hai lần.

### W5 — Giá theo cơ sở không chồng lịch (BO08)

Điểm sửa: OperationsService.SetRateAsync/GetRatesAsync, DTOs Operations; FE FacilityRatePage/businessApi.

- Khóa cặp facility/type trước đọc giá cũ và kiểm lại PRICE_RANGE có hiệu lực. Dùng ngày VN từ W1.
- Giữ quy tắc đã có: monthlyRate dương, bội 1.000; không hồi tố; kết thúc rate cũ; không đổi snapshot hợp đồng.
- Thêm expected revision/token của tập giá để phát hiện stale form. Phải phủ trường hợp chưa có rate và thay lịch tương lai; không chỉ so một rateId bất kỳ.
- GET trả token; POST FE gửi token. Request thiếu token từ caller cũ cần rollout rõ, không âm thầm bypass bảo vệ sau cutover.
- Hai editor cùng token: một thành công, một 409; response/readback chứa đúng pair, amount và ngày. Retry cùng operation không tạo nhiều lịch. Không cho auto-retry ghi đè ý định người khác.

Nghiệm thu: cùng ngày, ngày tương lai, thay lịch tương lai, hai request song song, ngoài khung giá, UTC/VN boundary và hợp đồng cũ giữ giá. Không có hai khoảng rate ACTIVE giao nhau cho cùng pair.

### W6 — Cơ sở đúng trạng thái, audit và retry (BO12–BO14)

Điểm sửa: OperationsService, OpsRules.OpenReservationStatuses và caller dùng danh sách này; ReservationService, ContractProvisioning, DTOs Operations; FE facilityMutation/businessApi.

- BO12: bổ sung PENDING_AT_FACILITY vào điều kiện đơn còn mở; rà tất cả status thực tế và nơi dùng hằng chung. Không thay nghĩa một hằng để vô tình đổi luồng khác.
- BO13: mọi đường đổi sang INACTIVE, kể cả PUT thông tin kèm status, lấy `inventory:{facilityId}` trước đọc lại facility và đếm đơn/hợp đồng. Đặt mới cũng đọc lại trạng thái facility sau khóa; kiểm ACTIVE trước khóa hiện chưa đủ.
- Inventory việc tạo hợp đồng/provisioning và đơn tại quầy; mọi writer có thể làm vô hiệu điều kiện đóng cơ sở phải tham gia protocol. Với request xảy ra sau đóng, xử lý theo quyết định đóng cơ sở, không âm thầm tạo mới.
- TEMPORARILY_CLOSED chặn đặt mới nhưng không chặn phục vụ khách hiện hữu. Không xóa cơ sở hoặc lịch sử.
- BO14: facility create + audit cùng transaction. Warnings là thông tin không chặn; lỗi sau commit/serialization không được khiến retry tạo thêm bản ghi.
- Bổ sung operation ID cho create cùng request hash. Lưu receipt nguyên tử, retry cùng key trả cùng facilityId, cùng key khác payload trả conflict. Unique tên không thay được idempotency vì tên gần giống hiện chỉ là cảnh báo.
- Expected version cho update/status nếu thêm phải cập nhật cả FE, lỗi 409 giữ form. Giữ response `{facility, warnings}` và GET readback đã có.

Nghiệm thu: đơn PENDING_AT_FACILITY chưa có hợp đồng chặn INACTIVE; race create reservation vs INACTIVE cho một kết quả tuần tự hợp lệ; create lỗi audit rollback toàn bộ; commit xong mất response rồi retry chỉ một facility/audit tương ứng. Test PUT kèm status, không chỉ /status.

### W7 — Báo cáo phân loại tiền đúng (BO10–BO11)

Điểm sửa: OperationsReportService, DTOs Operations; Payment và nơi tạo/xác nhận refund; config/migration mới nếu thêm allocation; FE dashboard/report/export.

**Bản vá độc lập làm trước:** loại REFUND khỏi phải thu, sửa cùng predicate ở Compute và GetFacilityContractsAsync. Phân biệt khoản khách thực còn phải trả với renewal đã hết hiệu lực/đơn hủy/phí sau trả kho đã bị D32 loại. Không xóa khoản tiền lịch sử để làm báo cáo đẹp.

**Mô hình hoàn tiền:** đề xuất lưu allocation của một refund vào một hoặc nhiều khoản gốc/thành phần, vì một refund có thể gồm cọc + nhiều kỳ thuê. FK original_payment_id đơn lẻ không đủ cho mọi trường hợp. Tổng allocation bằng refund amount; không trùng, không vượt phần được hoàn; lưu cùng transaction lúc tạo refund, trạng thái PAID mới tác động tiền đã hoàn. Quyền xác nhận hoàn giữ như hiện tại.

- Dữ liệu cũ: suy phân bổ chỉ khi chứng minh duy nhất qua hồ sơ nguồn. Không thể suy thì ghi unclassified/needs review, trả số tiền chưa phân loại để người xem biết giới hạn, không tự trừ tất cả vào cọc.
- Với cọc bị bù phí, tránh vừa cộng vào doanh thu như tiền mặt mới vừa giữ nguyên cọc đang giữ. Sau Q2, mô tả rõ gross/net và chuyển loại nội bộ. Không tự thay định nghĩa `rentalAndFeeRevenue` D16 thành net.
- Định nghĩa riêng metric theo kỳ (PaidAt trong range) và balance tại snapshot/as-of. `depositHeld` hiện là balance tại snapshot, không tự gắn nhãn số dư cuối kỳ lịch sử nếu chưa có ledger đủ dữ liệu.
- Cùng predicate tiền/quyền/scope dùng cho report theo facility, type, trend, drilldown và CSV. CSV/FE XLSX giữ tiếng Việt, unit, filter, thời điểm; cập nhật đủ metric mới khi có.
- Validate facility/type không tồn tại nhất quán. Không bỏ filter rồi trả dữ liệu toàn hệ thống với nhãn một cơ sở.

Fixture nghiệm thu sau khi Q2 chốt:

| Ca | Kết quả cần chứng minh |
|---|---|
| Thu thuê 3 triệu + cọc 1 triệu, hoàn 4 triệu do sự cố | Phân biệt hoàn thuê 3 triệu và cọc 1 triệu; cọc giữ 0; tổng hoàn 4 triệu. Gross revenue không bị đổi nghĩa âm thầm |
| Refund 500.000 còn PENDING | Không tăng outstanding của khách; chưa cộng refunded đã chuyển; có mục phải hoàn nếu thêm metric |
| Trả kho khấu trừ 200.000 từ cọc, hoàn 800.000 | Không còn giữ 200.000 như cọc vô thời hạn; không ghi thu tiền mặt mới hai lần |
| Hai cơ sở, hai loại kho, hoàn ở kỳ khác kỳ thu | Totals cùng scope bằng tổng dòng; thu/hoàn đúng kỳ; balance có nhãn đúng |
| Refund legacy không thể phân bổ | Không đoán số; expose phần chưa phân loại và đưa vào danh sách review |

### W8 — Tích hợp FE và bàn giao

- B02 phân biệt text hướng dẫn và tham số được server thi hành. Bỏ/khóa wording cũ trái D32, đặc biệt grace truy cập. Không gửi nhiều mutation rồi báo toàn form thành công nếu một nhóm chưa áp dụng.
- Nếu giữ nhiều command trong một form: báo partial theo nhóm và giữ draft chưa lưu. Nếu cần atomic toàn form, bổ sung command server có transaction rồi nối FE; không giả atomic bằng Promise.all.
- Gửi expectedVersion/revision và operation ID; giữ cùng ID khi retry cùng ý định, tạo ID mới khi đổi ý định. 409 giữ form và hướng dẫn tải bản mới; lỗi mạng sau mutation yêu cầu xác minh kết quả.
- FE không fallback mock khi API 404/403/500. Readback sau reload, trình duyệt/thiết bị khác có cùng dữ liệu.
- Test role theo Q4. BUSINESS_OPERATOR đang được operations API cho phép nhưng publish chỉ OPERATIONS/ADMIN; không tuyên bố mọi tài khoản alias đã dùng đầy đủ flow trước khi xử lý sự lệch này.
- Cập nhật docs/operations-api.md, BACKEND-TODO, feature/progress đúng phạm vi, lược bỏ nhận định API còn thiếu đã lỗi thời. Chỉ chuyển F22/F23 passing sau bằng chứng và thành viên xác nhận.

## 6. Contract, lỗi và tương thích

| Hành vi | Contract cần giữ/bổ sung |
|---|---|
| API đang có | Giữ đường dẫn hiện có, camelCase, tiền VND dạng số, ngày yyyy-MM-dd, timestamp UTC có timezone |
| Input sai | 400 với mã lỗi ổn định và nội dung tiếng Việt |
| Chưa đăng nhập / sai role | 401 / 403, không lộ dữ liệu qua response lỗi |
| Không tìm thấy | 404 theo resource hiện có |
| Version cũ, policy/rate chồng, trạng thái không còn hợp lệ | 409 `{error, code, details?}`; giữ details.conflictingPolicyIds cho FE activation hiện tại |
| Retry cùng thao tác | operation ID + hash payload, kết quả đọc lại hoặc receipt cùng resource; khác payload cùng key trả conflict |
| Publish | expected version bắt buộc sau cutover; trả RentalPolicyDto đầy đủ với version mới, rate, 7 sections, displayVersion, updatedAt |
| Rate/facility update | DTO đọc có revision/token; DTO ghi có expected revision, không dùng timestamp làm token mà không bảo đảm độ chính xác/concurrency |
| Metric mới | Additive nếu có thể; không đổi nghĩa trường cũ không thông báo; cập nhật FE và CSV đồng thời |

Các tên `code`, operation ID, revision và allocation trong plan là contract đề xuất, không khẳng định đã tồn tại. Agent chọn tên theo convention repo và cập nhật tài liệu trước khi nối FE. Không cần tạo REST endpoint mới cho mọi helper nội bộ.

## 7. File và schema dự kiến

Các điểm source đã xác định:

- `StorageProject.Api/Endpoints/OperationsEndpoints.cs`, `RentalPolicyEndpoints.cs`.
- `StorageProject.Core/DTOs/Operations/OperationsDtos.cs`, `StorageProject.Core/DTOs/Policy/RentalPolicyDtos.cs`.
- `StorageProject.Infrastructure/Services/OperationsService.cs`, `OperationsReportService.cs`, `RentalPolicyService.cs`, `OpsRules.cs`, `CheckoutTransaction.cs`.
- Consumer: `ReservationService.cs`, `ReservationSettlement.cs`, `ContractProvisioning.cs`, `PayOSService.cs`, `RenewalService.cs`, `RenewalSettlement.cs`, `OverdueProcessor.cs`, `FacilityOpsService.Overdue.cs`, `FacilityOpsService.Incidents.cs` trong thư mục Services.
- `StorageProject.Infrastructure/Data/DbSeeder.cs`, `Data/Configurations/RentalPolicyConfigurations.cs`; entity Payment/Policy/RentalPolicyVersion và config liên quan phải đọc trước sửa.
- Các FE ở bảng mục 3, `docs/operations-api.md`, `docs/verification.md`, `DECISIONS.md`, `feature_list.json`, `progress.md`.

**File mới đề xuất:** business clock/helper nếu chưa có; entity/config receipt idempotency nếu chọn DB receipt; refund allocation entity/config; migration mới; tests OperationsPolicy/Rate/Facility/Report trong hai test project hiện có. Không giả các tên này đã có trên repo. Trước tạo, kiểm parent và tránh trùng helper có sẵn.

Migration chia theo dependency; không gom mọi schema thay đổi vào một migration khó review. Trước unique index phải có kiểm tra duplicate; có dữ liệu không phân loại được thì dừng bước áp constraint đó với danh sách lỗi rõ. Migration không tự sửa/xóa lịch sử tài chính không đủ bằng chứng.

## 8. Bộ test bắt buộc và lệnh chạy

| Lớp | Nội dung |
|---|---|
| Unit/domain | Công thức cọc, cap khấu trừ, typed policy validation, clock boundary, allocation/metric predicate |
| HTTP | Role, 400/404/409, expected version thiếu/cũ, receipt, input trực tiếp bỏ guard FE, GET sau POST |
| SQL Server | Upgrade migration, seed Reference, unique current, khóa policy/rate/inventory, rollback audit, idempotency retry với DbContext/connection riêng |
| FE | Parse rate, policy payload/receipt, partial save, 409 giữ draft, metric mới và scope export |
| E2E API thật | Operator sửa → khách đặt/consent → cash/fake gateway xác nhận → report → reload/export; chạy hai operator stale edit |

Tái sử dụng `StorageProject.IntegrationTests/Infrastructure/SqlServerFixture.cs`, `CustomWebApplicationFactory.cs`, FakePayOSGateway và mẫu PaymentConcurrencyAndLockTests. Test có fake gateway phải ghi rõ không chứng minh PayOS thật. Dùng barrier thay sleep để tạo race có thể lặp lại.

Lệnh BE từ gốc repo, tùy công cụ của nhánh thực tế:

```bash
dotnet tool restore
dotnet build StorageProject.slnx -c Release
dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release
dotnet ef migrations has-pending-model-changes --project StorageProject.Infrastructure --startup-project StorageProject.Api
# Cấu hình SSFRMS_TEST_CONNECTION_STRING cho SQL Server thử nghiệm trước.
# Không in chuỗi kết nối có mật khẩu vào log.
REQUIRE_SQLSERVER=true bash scripts/ci/run-integration.sh
```

Lệnh FE trong `SafeSpace-Customer-UI/SafeSpace-Customer-UI`:

```bash
npm ci
npm run check:structure
npm test
npm run test:business
npm run test:workflows
npm run test:render
npm run build
```

Chạy các lệnh E2E mới được agent đăng ký cho Business với backend thật, không lấy `test:batch10`/dev:demo làm bằng chứng SQL Server. Khi sửa đóng gói/config thêm chạy container smoke phù hợp, không bật CD ngoài phạm vi.

Các ca regression phải giữ: khách hiện hữu tại cơ sở tạm đóng vẫn được phục vụ; giá hợp đồng cũ không đổi; QR theo D32/D36; refund hai bước và mã giao dịch không trùng; không thu nợ sau trả kho trái D32; aliases/role theo quyết định đã chốt.

## 9. Điều kiện hoàn tất và cách báo cáo

Agent bàn giao các mục sau:

1. Bảng BO01–BO14: fixed / reproduced-not-fixed / blocked-by-decision / not-reproduced, kèm file/test/evidence, không đánh đồng chưa tái hiện với đã sửa.
2. Ghi Q1–Q4 đã chốt hoặc còn mở, kèm phạm vi bị ảnh hưởng. Các chức năng mở rộng ở mục 10 không được cộng vào hoàn thành flow hiện tại.
3. Danh sách diff, contract mới, migration và plan chuyển dữ liệu; số bản ghi được thay/sẽ review trong dry-run.
4. Lệnh chạy thực tế, pass/fail/skip, môi trường, SHA nền và giới hạn. SQL bị skip/không có DB không tính PASS.
5. Evidence FE gọi API thật, GET đọc lại sau restart, concurrency SQL Server thật, CSV/XLSX mở được và scope đúng. Không cần chụp bí mật/tài khoản ngân hàng vào báo cáo.
6. Hướng dẫn thứ tự apply migrations → seed/reference → backfill được duyệt → deploy BE/FE tương thích → smoke. Nếu chưa chốt phân loại refund, không phát hành metric mới như thể đã đủ dữ liệu.
7. Rollback ứng dụng phải tương thích schema additive; ưu tiên forward-fix, không EF Down tự động trên dữ liệu dùng chung. Không xóa consent/refund/allocation để rollback.
8. Thành viên review rồi tự commit/push/PR/merge. Không sửa feature passing chỉ để hoàn thành tài liệu.

Một gói chỉ được coi hoàn tất khi hành vi chính + ca lỗi + concurrency liên quan có bằng chứng. Toàn flow chỉ chốt khi không còn P0, các quyết định ảnh hưởng tiền đã rõ và không còn fallback giả thành công.

## 10. Backlog mở rộng — chỉ triển khai sau khi chốt phạm vi

### X1. Giảm giá/miễn phí tự động

Đã có CRUD policy DISCOUNT/FEE_WAIVER, chưa có engine tính giao dịch. Trước triển khai chốt đối tượng đủ điều kiện, phạm vi, cộng dồn/ưu tiên, trần, cơ sở tính cọc, approval, hiệu lực và refund. Sau đó mới làm calculation service + snapshot breakdown + FE preview + payment/report integration. Không chỉ tạo hai endpoint mới rồi báo hoàn thành.

### X2. Nháp/lịch công bố nội dung chính sách

T20 hiện publish ngay. Nếu chọn mở rộng: chốt DRAFT/SCHEDULED/PUBLISHED/CANCELLED, publishAt UTC/VN, changeNote, quyền, worker idempotent, conflict giữa nhiều lịch, version consent tại thời điểm áp dụng. Tách khỏi policy EffectiveFrom/To đang có để không hiểu nhầm server đã hỗ trợ lịch nội dung.

### X3. Revenue trend theo from/to

Đã hỗ trợ months + facility/type. Nếu cần range tùy chọn: chốt bucket tháng/ngày, partial month, timezone, validate range và filter metadata; cùng scope cho UI/export. Rental-status vẫn là snapshot hiện tại nếu chưa có nguồn trạng thái lịch sử.

Không mở rộng server XLSX, module danh mục loại kho hoặc trang thông báo trong task này nếu không có yêu cầu thêm.

## 11. Prompt bàn giao có thể gửi nguyên văn cho agent

> Đọc toàn bộ plan này và quy định repo trước khi sửa. Mục tiêu là hoàn thiện flow Business Operator trên source mới nhất, không viết lại các API đang có. Bắt đầu W0, xác nhận lại BO01–BO14 bằng source/test hiện tại rồi triển khai theo W1–W8. Dùng các quyết định D32/D33 và thay thế mới nhất làm chuẩn. Với Q1–Q4, chuẩn bị đề xuất cụ thể và hỏi đúng phần chưa được chốt; tiếp tục các việc độc lập, không tự đổi nghĩa báo cáo, policy scope hoặc từ chối tiền thật sau publish. Mọi thay đổi consumer ngoài Business chỉ để bảo đảm flow đúng và có regression. Không reset DB, sửa migration đã merge, fake API success, bỏ test, commit/push/PR/merge. Bàn giao diff, test, migration/backfill và bảng trạng thái từng BO. Chỉ báo PASS cho lệnh và môi trường đã thực sự chạy.

## 12. Nguồn tham chiếu

- Quy định và quyết định: AGENTS.md; DECISIONS.md D16/D20/D27/D32/D33/D34–D36.
- Tiến độ/phạm vi: feature_list.json F22/F23/F24/F31; progress.md; BACKEND-TODO Batch09.
- Contract: docs/operations-api.md, businessApi.js, workflowApi.js, policyPublication.js.
- Source nền: https://github.com/ryocoding13/SSFRMS/tree/bd5736ec19bfc6edf1f20a82f13710a4cad05a31

Lượt soạn plan chỉ đọc source và kiểm tra tài liệu; không sửa repo, không chạy build/test ứng dụng. Tài liệu chỉ định kiểm thử cho lần triển khai tiếp theo.
