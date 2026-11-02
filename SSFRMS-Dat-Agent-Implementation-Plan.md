# Kế hoạch triển khai backend cho Đạt

Phạm vi T02 T03 T04 T20 của SafeSpace ngày 27 đến 31 tháng 10 năm 2026

Tài liệu này là đầu bài thực thi cho coding agent. Mục tiêu là hoàn thành gia hạn có thanh toán PayOS hoặc tại quầy và quản lý phiên bản chính sách có bằng chứng khách đồng ý. Chỉ kéo dài hợp đồng sau khi thu đủ tiền đúng một lần. Đây là kế hoạch, chưa phải bằng chứng code đã được sửa hay kiểm thử.

## 1. Căn cứ và những điểm phải đọc đúng

- Nguồn phân công: `SafeSpace — Kế hoạch hoàn thiện cập nhật 26–31 10 2026.docx`, đặc biệt bảng phân công cuối: Đạt phụ trách **T02, T03, T04 và T20 backend**. Dòng T20 trong danh sách việc ghi chưa thống nhất; bảng người phụ trách và BACKEND-TODO hiện hành xác nhận Đạt làm BE, Thắng làm FE.
- Repo: https://github.com/ryocoding13/SSFRMS. Đã đọc snapshot `main` **0f0194b9d04fd95016315934df85190a94c61a09** khi lập kế hoạch. Agent phải đọc lại HEAD và diff tại thời điểm làm, không coi snapshot này là mới nhất mãi.
- DOCX dựa trên main `e43c1f3`, gọi chính sách 26/10 là D31. Repo hiện có **D31 dành cho đăng nhập email**, còn chính sách mới là **D32**. Không tạo lại D31, không đổi số quyết định cũ.
- Thứ tự ưu tiên: chỉ đạo mới của người dùng → `AGENTS.md` và quyết định nghiệp vụ hiện hành → BACKEND-TODO mục D32 → API contract đang dùng → tài liệu lịch sử/mô phỏng FE. D23–D26 tiếp tục áp dụng cho thanh toán và cấp hợp đồng trừ chỗ bị D32 thay.
- D32 nói áp dụng quy tắc mới cho mọi hợp đồng, đồng thời phải giữ bằng chứng phiên bản khách từng chấp nhận. Không sửa/xoá snapshot lịch sử để giả khách đã đồng ý bản mới. Nếu việc áp dụng một thay đổi chính sách tương lai cho hợp đồng đang chạy chưa được quyết định rõ, ghi câu hỏi cụ thể; không tự suy ra từ fixture FE cũ.
- Feature hiện hành: F06, F18, F35, F39 `passing`; F22 `not_started`; F40 `active`; F41 `blocked`; F28 `not_started` dù repo đã có test backend. Trạng thái lịch sử không chứng minh các yêu cầu D32 đã được làm. Không tự nâng cả F22/F41 hoặc sửa F28 ngoài phạm vi.

### Quy định bắt buộc cho agent

Đọc bằng công cụ trong chính lượt triển khai: `AGENTS.md`, `DECISIONS.md`, `feature_list.json`, phần mới nhất `progress.md`, `SafeSpace-Customer-UI/SafeSpace-Customer-UI/BACKEND-TODO.md`. Đọc thêm `BE-CONTRACT.md`, `APPROVED-FE-API-GAPS.md`, `docs/conventions.md`, `docs/verification.md` và các file mục tiêu trước khi sửa. In receipt `[PRE-FLIGHT CHECK]` với đường dẫn, quyết định, feature/trạng thái thực tế và file dự kiến sửa.

Kiểm tra `git status`, giữ thay đổi có sẵn. Làm nhánh riêng nếu chưa có nhánh phù hợp. **AI không commit, push, tạo PR hay merge; không reset/xoá database; không sửa migration đã merge/áp dụng.** Thành viên tự review và thực hiện Git. Không ghi bí mật PayOS/DB vào repo hoặc báo cáo. Chỉ dừng phần phụ thuộc khi thiếu quyết định/môi trường; tiếp tục các phần độc lập đã được giao.

## 2. Kết quả phải bàn giao

1. Khách gửi gia hạn trước khi hợp đồng hết hiệu lực, kèm đồng ý bản chính sách hiện hành.
2. Quản lý đúng cơ sở duyệt: chốt giá, tạo một khoản `RENEWAL PENDING`, lưu hạn thanh toán; **EndDate vẫn là ngày cũ**.
3. Khách trả đủ qua PayOS hoặc nhân viên đúng cơ sở xác nhận đã thu tại quầy: khoản thu và renewal thành `PAID`; EndDate chuyển đúng một lần sang NewEndDate đã được duyệt.
4. Quá hạn thanh toán: renewal thành `EXPIRED`, không kéo dài hợp đồng. Webhook đến muộn không làm sống lại yêu cầu; tiền thực về phải có hồ sơ xử lý.
5. GET chính sách công khai; chỉ OPERATIONS xuất bản bản mới. Khách xem lại được bản đã chấp nhận; reservation, hợp đồng và renewal có bằng chứng phiên bản/thời điểm/người đồng ý.
6. Có migration mới, test SQL Server thật cho transaction/concurrency, API contract cho Thắng, và báo cáo tách rõ mock/SQLite/SQL Server/PayOS thật.

Ngoài phạm vi: T05–T19 của Mai/Tiến, sửa UI toàn bộ, tính công nợ sau trả kho, thu phí phát sinh sau trả kho, thu hồi QR thủ công, nâng cấp kiến trúc lớn, tự bật CD hoặc thay chiến lược Docker. Chỉ chạm các điểm tích hợp dùng chung cần thiết và ghi rõ lý do.

## 3. Những gì đã xác minh từ source

| Điểm | Hiện trạng | Hệ quả cho triển khai |
|---|---|---|
| `RenewalService.RequestRenewalAsync` | Chỉ chống trùng `PENDING`; tính giá lúc gửi, ngày giá theo UTC; chưa có consent/deadline | Chống trùng cả chờ duyệt lẫn chờ thanh toán, kiểm thời hạn giờ Việt Nam; giá cuối phải chốt lúc duyệt |
| `FacilityOpsService.Actions.cs` → `ApproveRenewalAsync` | Đổi EndDate, ACTIVE ngay; sau đó tạo payment PENDING | Bỏ đổi kỳ thuê lúc duyệt, dùng service nghiệp vụ chung |
| `ManagerService.ApproveRenewalAsync` | Route cũ cũng đổi EndDate ngay; truy vấn chưa lọc cơ sở ở method | Không để route cũ trở thành đường vòng; delegate về cùng service và kiểm cơ sở |
| `PayOSService.ProcessWebhookAsync` | Tìm orderCode trong Reservations, chỉ settlement đơn đặt chỗ | Thêm định tuyến checkout gia hạn, giữ nguyên nhánh reservation đã có |
| `Payment` | Có RenewalId, DueDate kiểu DateOnly; chưa có cấu trúc checkout gia hạn/TTL theo giờ | Cần dữ liệu bền vững cho hạn UTC chính xác và checkout attempt |
| CHECK renewal | Chỉ có PENDING, APPROVED, REJECTED, PAID, CANCELLED | Migration mới bổ sung EXPIRED, không sửa migration cũ |
| CHECK payment | Không có EXPIRED/CANCELLED | Không gán trạng thái lạ nếu chưa đổi CHECK; kế hoạch dùng FAILED cho payment hết hạn và audit lý do |
| `CheckoutTransaction` | Serializable + `sp_getapplock` transaction-owned trên SQL Server | Tái dùng theo resource hợp đồng, tránh chỉ dùng Semaphore trong RAM |
| `Policy` | Chính sách tính toán theo type/scope; chưa có version nội dung/consent | Không nhét bằng chứng khách đồng ý vào bản Policy có thể bị sửa |
| FE | Có adapter payos theo payment, chọn counter, workflow policy/counterRenewals; chưa gửi consent trong request gia hạn | Đạt chốt DTO và giao Thắng bổ sung FE trước khi bật bắt buộc |

Đường dẫn tất cả file trên đã được mở khi lập kế hoạch; file mới ở mục 11 là đề xuất, chưa tồn tại/triển khai.

## 4. Thứ tự và lịch thực hiện

T02 có hạn 27/10, T03 và T20 ngày 28/10, T04 ngày 29/10. Bắt đầu từ 27/10 thì không dựng lại lịch 26/10 như chưa diễn ra.

| Gói | Thời gian mục tiêu | Sản phẩm và cổng kiểm tra |
|---|---|---|
| A | 27/10 đầu phiên | Pre-flight, baseline, sprint contract, DTO/schema chốt với Thắng và Tiến |
| B | 27/10 | Nền policy version/consent tối thiểu + migration; T02 dùng chung cả route chuẩn/cũ; duyệt không đổi EndDate |
| C | 28/10 | T03 checkout/webhook/expiry; T20 đầy đủ, SQL Server tests; bàn giao FE ngay khi DTO ổn định |
| D | 29/10 | T04 tại quầy, race PayOS/cash, kiểm tích hợp FE; ngừng mở rộng tính năng |
| E | 30/10 | Kiểm thử chéo và PayOS thật nếu có cấu hình, log lỗi có bước tái hiện |
| F | 31/10 | Chỉ sửa lỗi chặn luồng; báo cáo bằng chứng và demo |

Nếu thiếu thời gian: giữ T02/T03/T20 P0, hạ T04 P1 vào backlog có trạng thái rõ. Không hy sinh kiểm chữ ký/chống trùng/consent để làm đủ số endpoint. T20 là dependency của luồng thanh toán nên không để đến cuối mới tích hợp.

## 5. Thiết kế dữ liệu và giao dịch

Đây là thiết kế đề xuất để agent cụ thể hoá theo convention repo, không phải schema đã được nhóm merge. Ưu tiên thay đổi nhỏ nhưng phải đủ bảo đảm bất biến dưới đây.

### 5.1 Renewal và khoản thu

- Bổ sung `PaymentDeadlineAt` UTC chính xác tới giây; `AppliedAt` nullable để biết kỳ thuê đã được áp dụng; `ExpiredAt` nếu cần audit. Không dùng `Payment.DueDate` DateOnly để quyết định hạn 24 giờ.
- `OldEndDate`, `NewEndDate`, `NewMonthlyRate`, `RenewalAmount` là snapshot cuối sau duyệt; không tính lại khi thanh toán.
- Filtered unique index: tối đa một renewal đang mở (`PENDING` hoặc `APPROVED`) trên một ContractId. Nếu SQL Server yêu cầu biểu thức filter khác cú pháp dự kiến thì chọn biểu thức được hỗ trợ, kiểm bằng migration thật.
- Unique filtered index trên RenewalId cho PaymentType RENEWAL, RenewalId khác null: mỗi renewal chỉ có một khoản phải thu. Đổi phương thức dùng cùng payment, không tạo payment mới.
- Renewals thêm `EXPIRED`; payment hết hạn chuyển `FAILED` và audit reason. DTO có thể trả lý do `PAYMENT_DEADLINE_EXCEEDED` để FE hiện đúng chữ. Không mở rộng ý nghĩa FAILED sang khoản tiền thực đã nhận.
- Không thay DepositAmount khi gia hạn, không thu lại cọc. Không ghi đè giá lịch sử kỳ cũ chỉ vì duyệt kỳ mới. Lưu giá kỳ mới ở renewal; nếu repo cần cập nhật AgreedMonthlyRate khi PAID, phải kiểm các báo cáo/RefundPolicy đang đọc nó và bảo toàn giá từng kỳ bằng dữ liệu đã có hoặc một biểu diễn kỳ thuê rõ ràng.

### 5.2 Checkout gia hạn

Đề xuất entity/table mới `PaymentCheckout` cho khoản RENEWAL, quan hệ PaymentId, gồm OrderCode unique, Provider, Amount snapshot, ExpiresAt UTC, trạng thái link, CheckoutUrl/QrCode, CreatedAt/UpdatedAt. Hỗ trợ lưu attempt cũ khi đổi phương thức để còn đối chiếu tiền về muộn.

- Không dùng `TransactionReference` vừa làm orderCode lúc chưa thu vừa làm mã giao dịch lúc PAID.
- OrderCode phải được tạo bền vững, unique và không trùng namespace reservation. Có thể dùng DB sequence và cơ chế cấp mã chung, kèm unique index/migration cho reservation orderCode sau khi kiểm dữ liệu cũ. Không chỉ dùng milliseconds + random rồi coi là không thể trùng.
- Webhook tra cả reservation/checkout. Nếu một orderCode khớp hơn một đích, chặn xử lý và ghi lỗi vận hành, không chọn đích đầu tiên.
- SDK/gateway hiện nhận reservationId để tạo description. Bổ sung phương thức cho renewal hoặc request gateway có ngữ nghĩa rõ; không truyền paymentId giả thành reservationId.
- Cần tra trạng thái PayOS khi retry timeout và đổi phương thức; mở rộng gateway/fake gateway đồng bộ. Dùng phiên bản SDK hiện repo cài, đọc API chính thức tương ứng trước khi gọi field/method mới.

### 5.3 Policy version và consent

Đề xuất `RentalPolicyVersion`: version ID bất biến, display label, rate, sections JSON/structured, người xuất bản và thời điểm UTC. Nội dung đã xuất bản không sửa tại chỗ; mỗi lần lưu hợp lệ tạo bản mới. Tách rõ version ID và nhãn hiển thị như 11/2026; không dùng D32 làm nhãn sản phẩm.

Đề xuất `PolicyConsent`: CustomerId, PolicyVersionId FK, ReservationId hoặc RenewalId, AcceptedAt server UTC, Channel do server xác định, và liên kết truy nguyên đến hợp đồng. Có thể contract tham chiếu consent của reservation thay vì sao chép/mất dấu vết. Unique chống ghi cùng một consent khi API retry; index phục vụ tra cứu owner.

- Client chỉ gửi version và ý chí chấp nhận; **không** được tự đặt acceptedAt/customerId/channel để giả bằng chứng.
- Hợp đồng cũ thiếu consent: để thiếu/legacy có giải thích, không backfill AcceptedAt = CreatedAt hoặc tự đồng ý thay khách. Khoản thu mới/gia hạn mới cần quy tắc consent mới.
- Dữ liệu tính toán `Policy OVERDUE` do Tiến phụ trách phải đồng bộ với nội dung rate hiển thị. GET không được quảng cáo tỷ lệ mới trong khi settlement vẫn dùng tỷ lệ khác.
- Thống nhất với Tiến một nguồn rate có thẩm quyền và điểm xuất bản: cập nhật version và tham chiếu/cấu hình OVERDUE tương ứng trong cùng transaction khi thay đổi áp dụng ngay theo D32; giữ nguyên lịch sử. Phần thay đổi tương lai chưa rõ phạm vi hiệu lực thì ghi quyết định bổ sung trước khi áp dụng, không tự sửa hợp đồng.

### 5.4 Migration và dữ liệu đang chạy

1. Báo cáo trước migration: renewal APPROVED nhưng EndDate đã tăng, payment trùng RenewalId, nhiều yêu cầu đang mở, orderCode trùng/thiếu, hợp đồng không có consent.
2. Không xoá bản ghi để ép unique index. Có dữ liệu bất thường thì dừng bước áp dụng ràng buộc và xuất danh sách cần người phụ trách xử lý; không giảm/xoá giao dịch thật.
3. Không tự kéo EndDate hợp đồng cũ về OldEndDate. Những renewal đã bị code cũ áp dụng cần đối soát thủ công hoặc migration bù được duyệt theo bằng chứng thanh toán.
4. Migration mới phải nullable/default an toàn cho dữ liệu cũ; backfill chỉ dựa dữ liệu chứng minh được. Bổ sung CHECK/index/FK, snapshot EF; không chỉnh migration đã merge.
5. Kiểm trên DB trống và bản DB thử có dữ liệu đại diện. Không test phá huỷ trên DB nhóm. Backup trước khi áp dụng migration ở môi trường có dữ liệu thật, theo D29.

## 6. T02 với state machine và bất biến

| Sự kiện | Renewal | Payment RENEWAL | EndDate |
|---|---|---|---|
| Khách gửi hợp lệ | PENDING | Chưa tạo | Giữ nguyên |
| Quản lý duyệt | APPROVED | PENDING, một dòng | Giữ nguyên |
| Khách chọn tại quầy | APPROVED | PENDING, CASH và dấu chọn kênh | Giữ nguyên |
| Xác nhận đủ tiền hợp lệ | PAID | PAID | Gán NewEndDate đúng một lần |
| Hết hạn khi chờ thu | EXPIRED | FAILED với lý do hết hạn | Giữ nguyên |
| Quản lý từ chối | REJECTED | Không tạo khoản thu | Giữ nguyên |

### Bước triển khai

1. Dùng clock có thể giả lập, ví dụ TimeProvider, và helper ngày/giờ Việt Nam dùng chung cho tính deadline/test. Theo D26, quyền sử dụng là [StartDate, EndDate), nên mốc hết hiệu lực là **00:00 EndDate giờ Việt Nam**, chuyển sang UTC. `PaymentDeadlineAt = min(ApprovedAt + 24h, ContractExpiryInstant)`. Kiểm `now < deadline`; đúng deadline là hết hạn. Nếu source mới đã đổi nghĩa EndDate thì phải đối chiếu và thống nhất trước, không tự cộng thêm một ngày.
2. Khi gửi: owner CUSTOMER, hợp đồng còn hiệu lực và không RETURN_PENDING/đóng/hết hạn; duration theo hợp đồng API hiện hành (FE dùng 1/3/6, xác minh rule trước khi giới hạn thêm). Yêu cầu đồng ý policy hiện hành, ngăn hai request đồng thời.
3. Khi duyệt: MANAGER đúng cơ sở, renewal PENDING; contract chưa hết hiệu lực/chưa gửi trả kho; OldEndDate còn khớp EndDate hiện tại; không có hợp đồng khác đã chiếm ô trong kỳ gia hạn. Khoá inventory/unit chung với logic phân bổ của repo khi kiểm xung đột kỳ thuê; không chỉ query rồi tin sẽ không có race.
4. Chốt giá ACTIVE có hiệu lực lúc duyệt theo ngày Việt Nam, cùng facility/unit type. Không dùng giá đã bị INACTIVE hoặc giá preview lúc gửi. Thiếu giá hợp lệ: giữ PENDING và trả lỗi rõ, không âm thầm lấy giá tuỳ ý. Dùng decimal, kiểm tiền VND phù hợp gateway; không nhận amount từ FE làm nguồn chuẩn.
5. Trong một transaction: status APPROVED, approvedBy/approvedAt, giá và kỳ mới, deadline, một payment PENDING, audit. Không đổi EndDate/AgreedMonthlyRate/credential lúc này.
6. Route chuẩn `/api/ops/renewals/{id}/approve` và route legacy `/api/manager/renewals/{id}/approve` dùng cùng service; retry duyệt trả kết quả hiện tại hoặc conflict đã tài liệu hoá, không thêm payment. Reject cũng phải kiểm cơ sở và trạng thái để không reject một renewal đã PAID.
7. Tạo worker expiry mới theo pattern worker hiện tại; cùng lock với settlement. Worker chạy lại không ghi audit/đổi trạng thái lặp. Các API approve/payos/counter/collect tự kiểm deadline để không phụ thuộc worker chạy đúng giây.
8. Sau PAID, dùng `EndDate = snapshot.NewEndDate`, không `EndDate.AddMonths()` theo ngày đã bị đổi. Bảo toàn StartDate/cọc/đồ thuê; kiểm cơ chế QR/PIN hiện có để quyền ra vào nhìn thấy EndDate mới mà không cấp lại mã ngoài phạm vi.

### Khoá và settlement chung

Đề xuất service `RenewalSettlement` được PayOS và counter cùng gọi. Cả approval, payment, expiry và các mutation xung đột cần dùng cùng resource `contract:{contractId}` trong transaction; nếu thêm unit/inventory lock thì quy định thứ tự cố định và tái dùng convention hiện có để tránh deadlock. Phối hợp Tiến/Mai để return/termination dùng cùng resource hoặc optimistic concurrency tương đương.

Settlement phải đọc lại dữ liệu sau khi lấy khoá, kiểm owner/actor hoặc provider, renewal/payment/deadline/contract trạng thái, snapshot kỳ, amount, phương thức. Khi đã PAID + AppliedAt thì trả kết quả idempotent cho cùng giao dịch, không cập nhật lần nữa. Giao dịch thứ hai khác nguồn là tiền cần đối soát, không âm thầm báo như đã thu lần đầu.

## 7. T03 với PayOS cho khoản gia hạn

### Tạo link

`POST /api/payments/{id}/payos` chỉ nhận khoản RENEWAL thuộc khách đang đăng nhập; payment PENDING, renewal APPROVED, còn deadline, consent hợp lệ. Không mở đường thanh toán lại phí trả kho mà D32 đã bỏ.

Trả DTO camelCase tương thích FE: `orderCode`, `amount`, `description`, `status`, `qrCode`, `checkoutUrl`, `expiredAt`. Bổ sung paymentId/renewalId nếu cần nhưng không bắt FE đoán. GET payment trả trạng thái và các trường deadline/renewal cần để polling. Không nhận amount khách tự gửi.

- Hết hạn link không vượt PaymentDeadlineAt. Hạn hiển thị theo UTC có Z.
- Retry trả cùng checkout đang hoạt động. Lưu identifier trước khi gọi hệ thống ngoài; nếu timeout thì tra lại cùng orderCode trước khi tạo attempt khác.
- Không giữ transaction DB dài chỉ để chờ mạng nếu có thể tách pha an toàn. Khi mạng trả về, lấy khoá và kiểm lại renewal/deadline/phương thức trước khi publish kết quả.
- Không xác nhận PAID từ returnUrl, nút FE hoặc redirect; chỉ webhook đã verify hoặc đối soát server có bằng chứng provider.

### Webhook

1. SDK verify chữ ký từ payload đúng định dạng; không tin raw amount/orderCode hoặc description chưa verify. Hai endpoint webhook đang tồn tại phải gọi cùng logic xác minh/định tuyến, có regression test.
2. Xác định đích bằng orderCode bền vững. Reservation giữ nguyên luồng D23/D26. Checkout RENEWAL gọi settlement chung.
3. Đối chiếu đúng tiền, VND và đích; đủ tiền chính xác theo snapshot mới được kéo dài. Thiếu/thừa tiền phải ghi nhận ngoại lệ vận hành; không tự cộng nhiều khoản/ghi PAID nếu chưa có rule hỗ trợ partial payments.
4. Trong transaction: payment PAID + method PAYMENT_GATEWAY + reference/PaidAt, renewal PAID + AppliedAt, EndDate mới, audit. Commit hoặc rollback toàn bộ.
5. Webhook trùng/đồng thời không tăng kỳ thuê hay doanh thu. Tiền về muộn sau deadline/đổi kênh/trả kho/đóng hợp đồng: ghi sự kiện review dedupe theo giao dịch; không gia hạn, không giả đã hoàn tiền.
6. Phân biệt retry cùng một giao dịch với một giao dịch tiền mới trên order đã paid. Mở rộng verified gateway DTO để có provider transaction reference/time khi SDK thực sự cung cấp; không dedupe mọi giao dịch khác nhau chỉ bằng orderCode.
7. Quy định ACK: duplicate đã xử lý và ngoại lệ đã lưu bền vững có thể ACK success; signature sai/body lỗi trả lỗi phù hợp, lỗi lưu DB phải retry được. Không trả success nếu sự kiện tiền thật chưa được lưu. Không log checksum/key/body chứa thông tin nhạy cảm đầy đủ.

**Mốc tiền về và webhook trễ:** D32 chưa nói rõ trường hợp ngân hàng nhận đúng hạn nhưng webhook giao trễ. Mặc định an toàn để triển khai/test là sau deadline không tự áp dụng renewal, đưa review; nếu nhóm muốn dùng provider paidAt để chấp nhận thì ghi quyết định trước và xác minh timestamp đáng tin cậy. Không dùng timestamp FE.

## 8. T04 với thu gia hạn tại quầy

1. `POST /api/renewals/{id}/counter-payment`: CUSTOMER owner chọn kênh, renewal APPROVED, còn hạn, consent hợp lệ. Chưa ghi PAID/chưa đổi EndDate.
2. Nếu có link PayOS: server phải kiểm chưa nhận tiền và xác nhận cancel/không tồn tại, theo pattern gateway hiện có. Không đổi sang CASH khi provider timeout hoặc đã nhận một phần/đủ tiền. Giữ attempt cũ để xử lý webhook muộn.
3. GET `/api/ops/counter-renewals` trả mảng, lọc cơ sở STAFF/MANAGER. Bổ sung `counterRenewals[]` trên board nếu component hiện tại đọc board; hai nguồn phải phản ánh cùng dữ liệu.
4. `POST /api/ops/counter-renewals/actions` body `{action:"COLLECT_RENEWAL", id:"<id từ GET>"}`. Nhân viên/quản lý bấm sau khi thực nhận tiền; server tự xác định đủ số đã chốt, ghi CASH qua settlement chung.
5. ID fixture GHQ-0142 là minh hoạ FE, không mặc nhiên bằng RenewalId. Chốt schema ID với Thắng, trả đúng ID để FE gửi lại, parser không rút bừa số từ một mã bất kỳ.
6. Thu trùng, khác cơ sở, đã hết hạn, đã PAID qua PayOS, chưa đồng ý policy, hợp đồng RETURN_PENDING/đóng đều không được áp dụng kỳ thêm.
7. Race webhook và đổi kênh/collect phải có kiểm thử riêng. Nếu giao dịch thứ hai thực sự nhận tiền, ghi review; không tạo payment PAID mới, không thu lại cọc và không giả hoàn tiền tự động.

## 9. T20 với phiên bản chính sách và khách đồng ý

### API contract phải giữ cho FE

| API | Quyền | Hành vi |
|---|---|---|
| GET `/api/rental-policy` | Public | Object `{rate,sections,version,updatedAt}`; bản published hiện hành, không trả fixture khi DB lỗi |
| GET `/api/rental-policy/versions/{version}` | Public với nội dung policy | Trả nội dung bản bất biến, không trả dữ liệu consent/customer công khai |
| POST `/api/rental-policy/actions` | OPERATIONS | Action SAVE_RENTAL_POLICY; tạo version mới, optimistic concurrency theo baseVersion; 409 khi ghi đè bản đã bị người khác cập nhật |
| POST `/api/reservations/{id}/policy-consent` | CUSTOMER owner | Chính khách chấp nhận phiên bản, server ghi thời điểm/kênh; nhân viên không chấp nhận thay |
| POST `/api/contracts/{id}/renewals` | CUSTOMER owner | Body mở rộng consent khi tạo yêu cầu gia hạn, lưu phiên bản và thời điểm cùng transaction |
| GET reservation/contract/renewal liên quan | Owner hoặc vận hành đúng phạm vi | Trả policyVersion/acceptedAt/channel và đường tra bản cũ theo contract đã thống nhất |

Thống nhất body consent, ví dụ `{policyVersion: 2, accepted: true}`. Đây là schema đề xuất cần đưa vào tài liệu và chuyển cho Thắng; không tuyên bố FE hiện đã gửi. `accepted:false`, thiếu/không tồn tại version hoặc version không còn là bản hiện hành ở lúc chấp nhận phải bị từ chối rõ. Có thể thêm `displayVersion` để không đổi kiểu numeric version FE đang dùng.

### Bắt buộc ở các cổng thanh toán

- Reservation: trước tạo link PayOS và trước ghi nhận thu tại quầy phải có consent đúng owner. Reservation chuyển thành contract phải giữ liên kết bản đã đồng ý.
- Renewal: phải chấp nhận bản hiện hành lúc gửi; lưu snapshot không sửa. Nếu policy xuất bản tiếp sau đó, không âm thầm đổi consent yêu cầu đang mở; quy tắc có cần khách chấp nhận lại trước trả tiền phải được ghi rõ với nhóm. Mặc định giữ consent đã ghi cho cùng yêu cầu, renewal mới nhận bản hiện hành mới.
- Không tái sử dụng consent của hợp đồng cũ cho một renewal mới.
- Chính sách legacy chưa có bằng chứng: chưa bật cổng bắt buộc trên bản dùng chung khi FE chưa có checkbox/API; phối hợp phát hành đồng thời hoặc dùng cờ rollout cấu hình rõ ràng trong môi trường thử. Không có bypass luôn bật trong production, không dùng cờ để báo T20 hoàn tất giả.
- Khách cần xem bản đã đồng ý của hợp đồng: GET contract có accepted version rồi dùng version endpoint; GET current không đủ để đáp ứng yêu cầu này.
- `sections` tối thiểu theo FE: payment, access, renewal, overdue, return, cancellation, support. Validate nội dung/độ dài theo contract; không nhận createdBy/version/time từ client làm nguồn chuẩn.
- Nội dung publish seed phải phản ánh D32, không bê nguyên fixture cũ có chữ công nợ/trừ khoản chưa thanh toán sai phạm vi.

### Điểm giao với Tiến và Thắng

Tiến sở hữu công thức OVERDUE. Đạt chịu trách nhiệm version/consent/API và không tạo một nơi cấu hình rate độc lập. Thắng bổ sung checkbox/đọc version/hiện lỗi stale policy ở đặt kho, gia hạn và xác nhận khi chọn thu tại quầy; sửa adapter requestRenewal để gửi consent. Không ghi T20 end-to-end passing khi chỉ GET/POST policy chạy nhưng FE chưa gửi bằng chứng.

## 10. API lỗi và dữ liệu bàn giao cho frontend

- 401 chưa đăng nhập; 403 sai vai trò/chưa được phân công; 404 dữ liệu không thuộc owner/cơ sở để không lộ dữ liệu; 400 đầu vào không hợp lệ; 409 xung đột trạng thái/version hoặc yêu cầu đang mở. Giữ `{error:"Thông báo tiếng Việt"}` tương thích repo; có thể bổ sung `code` mà không phá client.
- Nếu route legacy đang dùng BadRequest cho domain error, chuẩn hoá có kiểm chứng và báo Thắng; không để thay đổi mã HTTP ngoài phạm vi làm hỏng FE.
- Không trả 200 khi không tìm thấy hoặc chưa lưu. Retry thành công cũ có thể 200 với cùng kết quả nhưng không có mutation thêm.
- DTO renewal nên có paymentId, paymentDeadlineAt, appliedAt, policyVersion, acceptedAt, channel ngoài trường hiện có; GET payment có đủ deadline để countdown. Dùng kiểu id/field nhất quán với mapper đã đọc.
- Counter row tối thiểu: id, renewalId, paymentId, contractId/code, facilityId, unit, customer, amount, months, deadline, status. Không lộ full thông tin ngân hàng ra danh sách không cần thiết.
- Bàn giao Thắng ví dụ JSON thật cho request/response/error và trạng thái sau mỗi bước; cài OpenAPI hoặc tài liệu theo convention sẵn có, không dựng endpoint thứ hai chỉ vì DOCX ghi shorthand POST khác với FE adapter.

## 11. Bản đồ file cho agent

### File đã xác minh tồn tại cần xem hoặc sửa theo phạm vi

- `StorageProject.Core/Entities/ContractRenewal.cs`, `Payment.cs`, `RentalContract.cs`, `Reservation.cs`, `Policy.cs`.
- `StorageProject.Core/DTOs/Renewal/RenewalDtos.cs`, `DTOs/Payment/PayOSDtos.cs`, `DTOs/Payment/PaymentDtos.cs`, `DTOs/Reservation/ReservationDtos.cs`.
- `StorageProject.Core/Interfaces/IServices.cs`, `IPayOSService.cs`, `IFacilityOpsService.cs`, `IManagerService.cs`.
- `StorageProject.Infrastructure/Services/RenewalService.cs`, `FacilityOpsService.Actions.cs`, `FacilityOpsService.Board.cs`, `ManagerService.cs`, `PaymentService.cs`, `PayOSService.cs`, `PayOSGateway.cs`, `CheckoutTransaction.cs`.
- `StorageProject.Infrastructure/Data/AppDbContext.cs`, `Data/Configurations/ReservationContractConfigurations.cs`, `Migrations/AppDbContextModelSnapshot.cs`.
- `StorageProject.Api/Endpoints/RenewalEndpoints.cs`, `PaymentEndpoints.cs`, `FacilityOpsEndpoints.cs`, `ManagerEndpoints.cs`, `Program.cs`.
- Đọc để tích hợp, chỉ sửa nếu cần consent/settlement: `ReservationService.cs`, `ReservationSettlement.cs`, `ReservationAllocation.cs`; kiểm tra thêm ContractProvisioning và route thu tiền hiện hành trước khi sửa.
- `StorageProject.Tests/CheckoutTests.cs`, `StorageProject.IntegrationTests/Tests/PaymentConcurrencyAndLockTests.cs`, `Infrastructure/FakePayOSGateway.cs`, `Infrastructure/SqlServerFixture.cs`.
- FE tham chiếu: `SafeSpace-Customer-UI/SafeSpace-Customer-UI/src/shared/api/customerApi.js`, `src/features/facility-operations/workflows/workflowApi.js`, `workflowModel.js`, `src/features/business/policies/RentalPolicyEditorPage.jsx`, `src/features/customer/policies/RentalPolicyPage.jsx`.
- Tài liệu: root `progress.md`, `feature_list.json`; FE `BACKEND-TODO.md`, `BE-CONTRACT.md`, `APPROVED-FE-API-GAPS.md`. Không sửa DECISIONS để tự hợp thức hoá giả định chưa chốt.

### File mới đề xuất

Sau khi xác minh thư mục cha và convention: entities/configurations cho PaymentCheckout, RentalPolicyVersion, PolicyConsent; service RenewalSettlement, RentalPolicyService/PolicyConsentService; DTO/interface cần thiết; `StorageProject.Api/Endpoints/RentalPolicyEndpoints.cs`; `StorageProject.Api/Workers/ExpiredRenewalWorker.cs`; migration mới; test mới về renewal/payment/policy.

Tạo sprint contract từ `docs/templates/sprint-contract.md` trong `docs/sprints/` nếu thư mục đã có hoặc tạo mới có ghi chú. Tên gợi ý `dat-renewal-policy-d32.md`, không bịa feature F42 nếu chưa rà feature list lúc làm. Evidence gợi ý `docs/verification/dat-renewal-policy-2026-10.md` (xác minh/tạo thư mục trước).

Không sửa workflow CI/Docker ngoài nhu cầu tích hợp thật; thay schema cần migrator container build được, nhưng không tự bật CD.

## 12. Ma trận kiểm thử bắt buộc

Mỗi ca quan trọng phải có request/response, dữ liệu DB trước/sau và số lượng bản ghi, không chỉ assert HTTP 200.

| Nhóm | Ca cần kiểm | Kết quả cần chứng minh |
|---|---|---|
| T02 | Gửi request hợp lệ, không có consent, sai owner, 2 request đồng thời | Chỉ tạo một yêu cầu mở hợp lệ; lỗi không tạo dữ liệu rác |
| T02 | Duyệt trên route chuẩn và route cũ | EndDate/giá kỳ cũ giữ nguyên; một payment PENDING |
| T02 | Gọi duyệt hai lần/đồng thời | Không tạo payment trùng, không tăng kỳ |
| T02 | Giá đổi giữa lúc gửi và lúc duyệt; rate INACTIVE/thiếu | Giá chốt lúc duyệt, lỗi thiếu giá không tự fallback |
| T02 | Trước hết hạn 1 giây, đúng hạn, sau hạn; duyệt còn 2 giờ | Deadline min chính xác; không cấp thêm 24 giờ vượt EndDate |
| T02 | Cuối tháng/năm nhuận, UTC khác ngày Việt Nam | NewEndDate/AddMonths và cutoff theo quy tắc thống nhất |
| T02 | Đã RETURN_PENDING/đóng, ô có booking kỳ tiếp theo | Chặn gia hạn sai; không làm hỏng reservation đã giữ |
| Expiry | Worker lặp/2 instance, API đến sau hạn trước worker | Một transition EXPIRED; không áp dụng kỳ mới |
| T03 | Checkout đúng owner/khoản; amount FE giả; retry | Tiền server, cùng link đang mở; sai owner không lộ |
| T03 | Provider timeout sau tạo link, retry/restart app | Tìm lại orderCode bền vững, không tạo đơn thu thứ hai |
| T03 | Chữ ký sai, JSON lỗi, order lạ/collision | Không cập nhật khoản thu/hợp đồng |
| T03 | Webhook đúng tiền | Payment PAID, renewal PAID, AppliedAt, EndDate mới cùng transaction |
| T03 | Webhook lặp/đồng thời, DB fault giữa settlement | Một lần áp dụng; failure rollback được và retry không mất dữ liệu |
| T03 | Thiếu/thừa tiền, về muộn, hợp đồng đã trả kho | Không gia hạn tự động; ngoại lệ tiền thật được lưu/dedupe |
| T03 | Giao dịch mới khác reference trên order PAID | Có review cho tiền mới; duplicate cũ không cộng lại |
| T04 | Chọn counter; reload | Vẫn PENDING, chưa đổi EndDate, xuất hiện queue đúng cơ sở |
| T04 | Link có tiền/không cancel được | Không đổi kênh, không cho thu tiền lại |
| T04 | Nhân viên thu đúng, thu lặp, nhân viên cơ sở khác | Ghi CASH một lần, ngày tăng một lần; khác cơ sở bị chặn |
| T04 | Race webhook với chọn/thu counter và expiry | Không double payment/double extend; tiền đến sau đi review |
| T20 | GET policy không token, version cũ | Đọc đúng nội dung bất biến, không lộ consent |
| T20 | OPERATIONS lưu, role khác ghi, 2 editor cùng version | Chỉ người có quyền xuất bản; một bản mới và conflict đúng |
| T20 | accepted false/thiếu/stale, acceptedAt/channel giả | Không tạo consent giả; server ghi actor/time/channel |
| T20 | STAFF cố đồng ý thay khách hoặc owner khác | Bị từ chối, không ghi consent |
| T20 | Consent đặt kho PayOS, đặt kho cash, gia hạn | Tất cả cổng thu kiểm và giữ bằng chứng liên kết |
| T20 | Policy đổi sau consent, khách xem contract cũ | Lịch sử consent không bị đổi sang current |
| T20 | Rate hiển thị và nguồn tính OVERDUE | Không có hai số rate khác nhau do hai nơi lưu độc lập |
| Dữ liệu cũ | APPROVED đã tăng EndDate, thiếu consent, trùng payment | Báo cáo đối soát; không tự reset/xoá/thu hai lần |
| Regression | Đặt kho PayOS/cash, webhook lặp, auto allocation D26 | RENT/DEPOSIT và hợp đồng cũ không bị gãy |
| Regression | Huỷ đơn, trả kho, access trước/sau paid/return | Không khôi phục nợ/thu hồi thủ công; QR theo kỳ hợp lệ |

### Cấp bằng chứng

1. Unit/HTTP test bằng fake clock và FakePayOSGateway: chứng minh rule và routing, không phải tiền thật.
2. SQL Server 2022 thật: migration, CHECK/FK/unique index, sp_getapplock, race với **DbContext riêng cho mỗi request**. Không dùng SQLite để kết luận concurrency đã an toàn. Giới hạn test DB riêng do fixture tạo; không đưa chuỗi kết nối DB nhóm để thử phá huỷ.
3. API/UI tích hợp với backend + SQL Server: C08, manager approve, C11 QR/counter, S09/queue, trang policy. Đạt phối hợp Thắng; mock/offline không thay cho bước này.
4. PayOS thật: tạo link, thanh toán thử được người dùng cho phép, webhook tới HTTPS/ngrok, replay cùng payload đã nhận để kiểm idempotency an toàn. Không tự chuyển tiền hoặc hoàn tiền; thiếu keys/cấu hình thì ghi chưa kiểm chứng.

### Lệnh kiểm tra nền cho Windows

Chạy theo SDK/công cụ thực tế trong repo; không in secrets ra console.

```powershell
dotnet tool restore
dotnet restore StorageProject.slnx
dotnet build StorageProject.slnx -c Release --no-restore -m:1
dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release --no-build

# Chuỗi kết nối tới SQL Server thử nghiệm riêng; truyền qua môi trường cục bộ.
$env:REQUIRE_SQLSERVER = 'true'
# SSFRMS_TEST_CONNECTION_STRING được cấu hình riêng, không ghi vào file commit.
dotnet test StorageProject.IntegrationTests/StorageProject.IntegrationTests.csproj -c Release --no-build

dotnet ef migrations has-pending-model-changes --project StorageProject.Infrastructure --startup-project StorageProject.Api
.\init.ps1
git diff --check
```

Kiểm script init có chạy cả suites FE mới trước khi kết luận; nếu chưa thì tại thư mục FE chạy `npm test`, `npm run test:business`, `npm run test:workflows`, `npm run test:render`, `npm run check:structure`, `npm run build`. Container gate phải build migrator và khởi động stack/smoke sau khi thêm migration.

Không coi IntegrationTests exit 0 với fixture `IsAvailable=false` là SQL Server pass. Ghi rõ REQUIRE_SQLSERVER=true, SQL Server version, migrations mới, số ca thật chạy, kết quả và giới hạn. Không hardcode số test bằng báo cáo cũ.

## 13. Điều kiện nghiệm thu và bàn giao

### Definition of Done từng việc

- **T02:** cả đường duyệt mới/cũ dùng cùng quy tắc; không đổi EndDate khi duyệt; giá/deadline đúng; expiration hoạt động; test SQL concurrency qua.
- **T03:** tạo/retry link an toàn, verify SDK, exact amount, settlement atomic/idempotent, tiền muộn có review; regression reservation giữ nguyên. Tách trạng thái chưa kiểm PayOS thật nếu còn thiếu.
- **T04:** chọn kênh chưa thu, cancel PayOS an toàn, queue đúng cơ sở, collect cash một lần, race được test.
- **T20:** published versions bất biến, public read/OPERATIONS write, consent owner/time/server channel, enforce đủ cổng thu, lịch sử contract truy được; Thắng đã tích hợp hoặc ghi rõ phần FE còn thiếu.

Một task chỉ được ghi hoàn thành đầy đủ khi chạy SQL Server thật với bằng chứng; báo riêng “code và test fake xong, chưa PayOS thật” nếu đúng hiện trạng. Việc sửa schema/API không tự chuyển toàn bộ F41 từ blocked thành passing vì còn nhiều nhóm API của người khác.

### Bộ bàn giao cho Đạt review

1. Danh sách file thêm/sửa và mục đích; `git diff --stat`/`git diff --check`.
2. Tên migration, SQL review, ảnh hưởng legacy, hướng backup và forward-fix; không có lệnh down/reset dữ liệu.
3. API contract + JSON thật + lỗi mẫu cho Thắng; danh sách phối hợp Tiến/Mai về lock, policy rate, return/termination.
4. Test matrix đánh dấu PASS/FAIL/NOT RUN kèm môi trường/lệnh/bằng chứng. Không dùng PASS cho thiếu công cụ.
5. `progress.md` thêm một mục mới ở đầu, không xoá lịch sử; `feature_list.json` chỉ thay đúng phạm vi và theo quy tắc xác nhận thành viên.
6. Hướng dẫn demo: policy → khách consent → gửi gia hạn → duyệt và chứng minh EndDate chưa tăng → trả đủ → chứng minh tăng đúng một lần → replay webhook → chứng minh không tăng tiếp → case hết hạn → counter nếu có.
7. AI để thay đổi ở working tree và hướng dẫn người phụ trách tự kiểm/commit/push/PR; không tự thực hiện các thao tác đó.

## 14. Prompt giao agent

Sao chép đoạn sau và đính kèm toàn bộ kế hoạch này, không chỉ gửi prompt rút gọn.

> Bạn là coding agent triển khai phần backend của Đạt trong SSFRMS: T02, T03, T04, T20 theo kế hoạch đính kèm. Trước khi code, đọc AGENTS.md và toàn bộ pre-flight hiện hành bằng công cụ, đọc source mục tiêu, kiểm git status/HEAD và in receipt có bằng chứng. Chính sách 26/10 hiện là D32; D31 trong repo là đăng nhập email, không đánh số lại.
>
> Thực thi theo gói A → B → C → D, ưu tiên P0 và hoàn thành các phần độc lập trong phạm vi. T20 nền phải nối vào gia hạn/thanh toán; không để consent là API trang trí. Duyệt gia hạn tuyệt đối không đổi EndDate; chỉ settlement đủ tiền atomic/idempotent từ PayOS hoặc cash mới áp dụng NewEndDate một lần. Sửa cả route legacy để không bypass. Dùng SQL Server transaction/lock và unique constraints, không chỉ khóa RAM.
>
> Bảo toàn reservation PayOS/cash/auto allocation D23–D26. Không làm phí trả kho/công nợ mà D32 đã bỏ. Giữ snapshot chính sách và consent lịch sử; không giả khách đã đồng ý. Đọc frontend adapters và bàn giao DTO cho Thắng; phối hợp nguồn policy rate và lock với Tiến/Mai, không làm lại phần của họ.
>
> Agent tự giải quyết lựa chọn kỹ thuật trong thiết kế đã giao; chỉ hỏi khi có mâu thuẫn nghiệp vụ thực sự hoặc hành động dữ liệu cần người dùng quyết định. Nêu chính xác phần bị chặn và tiếp tục phần độc lập. Không thêm thư viện/kiến trúc lớn ngoài nhu cầu. Không commit/push/tạo PR/merge, không reset/xoá DB, không sửa migration đã merge, không để lộ secrets.
>
> Hoàn thành code, migration mới, unit/HTTP tests và integration SQL Server với REQUIRE_SQLSERVER=true khi môi trường có. Nếu thiếu SQL/PayOS thật, ghi NOT RUN và lệnh để thành viên chạy, không báo hoàn tất giả. Cuối phiên bàn giao diff, API JSON, migration/data risks, test evidence, giới hạn, cập nhật tài liệu/progress đúng phạm vi. Không tự nâng feature passing khi thiếu bằng chứng và owner xác nhận.

---

Kế hoạch được lập từ tài liệu phân công người dùng cung cấp và source main tại SHA nêu trên. Không có thay đổi code repo, migration, giao dịch PayOS hoặc chạy thử ứng dụng trong lượt lập kế hoạch này.
