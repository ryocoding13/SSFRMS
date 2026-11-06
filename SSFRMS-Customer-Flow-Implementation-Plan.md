# SSFRMS — Kế hoạch hoàn thiện flow Customer

**Ngày lập:** 06/11/2026 (giờ Việt Nam). **Nguồn:** sheet Customer trong SSFRMS-User-Mainflow-Issues-No-BusinessOps-2026-11-04.xlsx, rà trên main `bd5736e`. Đây là danh sách việc dựa trên bản rà soát, chưa xác nhận trạng thái commit mới hoặc chạy lại ứng dụng.

**Mục tiêu:** xử lý C01–C17, kiểm chứng C18. Staff và Manager chỉ tham gia ở các bước cần để hoàn tất flow khách. Không mở rộng Business Operator, Admin hay CI/CD.

## Phân gói giao agent

| Gói | Mã Excel | Phạm vi | Điều kiện tích hợp |
|---|---|---|---|
| KH-00 | C01–C18 | Đối chiếu repo hiện tại, chốt contract và fixture | Làm trước |
| KH-01 | C01 | Đăng ký và đăng nhập | Sau KH-00 |
| KH-02 | C02 | Giá và tiền cọc đặt kho | Sau KH-00 |
| KH-03 | C03, C04, C05 | Phiên bản chính sách và consent đặt kho | Sau KH-00; phối hợp KH-02 khi test checkout |
| KH-04 | C06–C07 | Yêu cầu chìa khóa, bàn giao và QR/PIN | Có thể phát triển bằng fixture đã trả tiền; E2E sau KH-02/03 |
| KH-05 | C08–C09 | Gửi và duyệt gia hạn | Dùng contract consent của KH-03 |
| KH-06 | C10, C11, C12 | Thu gia hạn qua QR/cash, hết hạn và tiền về muộn | Sau KH-05 |
| KH-07 | C13–C14 | Trả kho, hư hỏng và hoàn cọc | Chia 07A → 07B → kiểm lại quyết toán |
| KH-08 | C15, C16, C17 | Hỗ trợ chung, ticket và ảnh | Sau KH-00; độc lập luồng tiền |
| KH-09 | C18 + hồi quy | Hủy trước kỳ thuê và E2E xuyên vai trò | Sau các gói ảnh hưởng flow |

Ưu tiên **KH-02/03, KH-05/06 và KH-07A** vì ảnh hưởng số tiền, bằng chứng đồng ý và ghi nhận giao dịch. KH-01/08 có thể giao riêng. Nếu nhiều người làm, thống nhất người sở hữu thay đổi ở checkout/settlement, migration và dữ liệu seed trước khi chia nhánh. Không để hai gói tự tạo hai quy tắc consent, hai bộ khóa cho cùng khoản thu hoặc hai công thức hoàn cọc.

## KH-00 — Kiểm kê trước khi giao code

- Đọc AGENTS.md và hướng dẫn repo, DECISIONS.md (nhất là D27/D32/D34/D35/D36), feature_list.json, progress.md, BACKEND-TODO.md và API hiện tại. Ghi SHA, branch, trạng thái working tree; không mặc định C01–C18 vẫn còn nguyên.
- Với từng mã, ghi đã sửa / còn lỗi / cần tái hiện; chỉ sửa phần còn thiếu. Trace FE → API → service → DB, gồm route Staff/Manager có cùng nghiệp vụ.
- Chốt URL/DTO yêu cầu chìa khóa, trạng thái và quyền xử lý hồ sơ hư hỏng; xác định mốc version consent cho giao dịch đang mở khi chính sách đổi. Nếu chưa chốt, tiếp tục phần độc lập.
- Chuẩn bị DB thử riêng: hai khách, hai cơ sở, staff/manager đúng và sai cơ sở, giá hiệu lực, chính sách thật, hợp đồng trước/trong/sau kỳ. Dùng clock kiểm thử giờ Việt Nam và gateway giả cho ca timeout/race. Không reset DB dùng chung.

**Bàn giao:** bảng C01–C18 theo SHA mới, API/service thực tế, test tái hiện, contract cần chốt và file dự kiến từng gói.

## KH-01 — Đăng ký (C01)

Sửa validation BE username: không chứa khoảng trắng hoặc @, tối đa 50 ký tự. Trả lỗi nhất quán để FE hiển thị. Giữ tương thích đăng nhập bằng username/email hiện có và tài khoản cũ.

**Nghiệm thu:** gọi API trực tiếp với username sai bị từ chối, không tạo user; dữ liệu hợp lệ đăng ký rồi đăng nhập được. Kiểm biên 50/51 ký tự và khoảng trắng.

## KH-02 — Báo giá, đặt kho và cọc (C02, P0)

Đối chiếu quote, tạo đơn, PayOS và tiền mặt. Cọc phải bằng một tháng thuê theo D32. Dùng chung phép tính và snapshot số tiền cho đơn, không tính lại từ giá mới lúc thu. Sửa seed/cấu hình kích hoạt sai; với DB cũ lập phương án chuyển cấu hình có kiểm kê và review, không sửa ngược hợp đồng hay tiền đã thu.

**Nghiệm thu:** gói 1/3/6 tháng ở giá 1.150.000đ/tháng đều cọc 1.150.000đ; gói 3 tháng tổng 4.600.000đ. Quote, đơn và số tiền QR/cash khớp. Test DB seed mới và DB cũ đã có policy lỗi.

## KH-03 — Policy và consent khi đặt kho (C03–C05)

1. Tạo version/publisher thật ở seed Reference; bỏ fallback version/FK giả. Khi chưa có policy, trả trạng thái rõ để FE không cho khách đồng ý vào dữ liệu không tồn tại.
2. Ghi consent từ khách đúng owner/đơn/version, chống ghi trùng khi retry. Staff không đồng ý thay. Kiểm ở BE trước tạo giao dịch mới, chọn kênh và thu tại quầy, gồm route legacy nếu còn dùng.
3. Trả bằng chứng consent trong chi tiết reservation/contract; đọc lại đúng bản bất biến khách đã đồng ý, kèm thời điểm/channel đã lưu.
4. Nếu policy đổi sau khi link đã mở, áp dụng contract đã chốt ở KH-00. Webhook tiền thật đã xác minh phải ghi nhận hoặc đưa review theo luồng chuẩn, không làm mất tiền vì version đổi.

**Nghiệm thu:** DB Reference mới ghi consent không lỗi FK; gọi API trực tiếp thiếu consent/sai owner/version bị chặn trước khi tạo link hoặc ghi thu. Khách đổi phiên vẫn đọc đúng bằng chứng. Cash và QR hợp lệ ghi nhận một lần.

## KH-04 — Nhận chìa khóa và quyền mở kho (C06–C07)

Chốt API/DTO và màn khách theo D36. Khách đủ điều kiện chủ động gửi yêu cầu; service tạo một việc đúng cơ sở, cho staff xác minh và bàn giao, rồi trả trạng thái cho khách. Xử lý lịch SCHEDULED cũ có chủ đích trước khi ngừng auto-create. Không xóa lịch lịch sử hay thay rule hủy khi chưa nhận chìa khóa.

Ở API đọc QR/PIN, kiểm owner, trạng thái hợp đồng và StartDate theo giờ Việt Nam. Trước kỳ thuê không trả mã/PIN kể cả khách gọi trực tiếp. Rà quyền quét và hết hiệu lực khi trả kho theo rule hiện hành.

**Nghiệm thu:** đã trả tiền → yêu cầu → staff đúng cơ sở thấy một việc → bàn giao → khách đọc lại; retry không thêm lịch. Sai owner/cơ sở bị chặn. Kiểm trước/đúng mốc StartDate và sau khi mã hết hiệu lực.

## KH-05 — Yêu cầu và duyệt gia hạn (C08–C09)

Yêu cầu accepted/version hợp lệ; lưu renewal + consent nguyên tử và chống trùng. Gom các đường duyệt vào service chuẩn; sau khóa đọc lại hợp đồng, kỳ thuê, giá ACTIVE, lịch kho và deadline. Duyệt chỉ chốt giá/hạn thanh toán, **chưa tăng EndDate**. Ghi rõ trạng thái/response để KH-06 sử dụng.

**Nghiệm thu:** thiếu/sai consent bị từ chối; lỗi ghi consent không để renewal mồ côi. Yêu cầu hợp lệ duyệt đúng giá/hạn, hợp đồng hết hiệu lực hoặc lịch trùng bị chặn. EndDate không đổi sau duyệt.

## KH-06 — Thanh toán gia hạn (C10–C12, giao chung một agent)

- Dùng cùng protocol khóa và trạng thái cho tạo QR, chọn CASH, thu quầy, webhook và expiry. Đọc lại sau khóa; đối chiếu kênh, hạn, số tiền và attempt. Không giữ transaction dài qua gọi mạng.
- Nếu gateway đã tạo link nhưng response mất, phục hồi cùng attempt/orderCode theo khả năng gateway; không mở link mới khi kết quả cũ chưa rõ. Thu quầy chỉ khi khách đã chọn CASH và còn đủ điều kiện.
- Worker không ghi EXPIRED đè PAID. Webhook hợp lệ về muộn được lưu đối soát/audit bền vững trước ACK thành công, chống lặp. Chỉ settlement hợp lệ và đủ tiền mới tăng kỳ đúng một lần.

**Nghiệm thu trên SQL Server:** hai request tạo QR đồng thời; timeout sau khi gateway tạo link; chọn CASH cạnh tranh webhook; thu quầy khi chưa chọn CASH; replay webhook; worker chạy trước/trong/sau settlement. Đọc lại số payment, EndDate và audit, không chỉ assert HTTP.

## KH-07 — Trả kho và hoàn cọc (C13–C14)

**07A — Sửa quyết toán trước.** Dùng một công thức D32: chỉ trừ vệ sinh khi vi phạm, tổng trừ không vượt cọc, không tạo nợ ngoài cọc. Reference bù trừ riêng cho từng giao dịch. Chuẩn hóa dữ liệu kiểm kê ở các route đang phục vụ flow; xử lý phí legacy theo rule đã chốt, không xóa lịch sử. Giữ hoàn hai bước: tạo khoản chờ, sau đó ghi nhận chuyển tiền.

**07B — Khép nhánh hư hỏng.** Chốt DTO, trạng thái, quyền khách/manager, version và deadline. Khách phản hồi → manager quyết định → khách gửi bằng chứng khắc phục → kiểm tra lại → bỏ đúng khoản trừ nếu đạt. Tính DamageWorkflowResolved từ hồ sơ thật. Chặn chốt trong cùng transaction nếu còn case mở; kiểm cả route legacy và race xử lý case/chốt.

**Nghiệm thu:** kho sạch trễ một ngày, cọc 1 triệu/rate 5% hoàn 950.000đ; phí vượt cọc không sinh nợ; nhiều khoản bù trừ không lỗi unique. Case đang mở không chốt được; kiểm tra đạt cập nhật đúng hạng mục; hoàn PENDING → PAID sau xác nhận, retry không ghi hoàn trùng. Phối hợp Staff/Manager ở bước kiểm kê và quyết toán.

## KH-08 — Hỗ trợ (C15–C17)

- Bổ sung hỗ trợ chung không gắn hợp đồng theo contract FE; khách chọn cơ sở, staff đúng cơ sở nhận và phản hồi, khách xem thread.
- Với ticket gắn kho, kiểm kỳ thuê ở BE theo D36. Trước/sau kỳ hướng sang hỗ trợ chung; kiểm ca đang thuê, quá hạn hoặc chờ trả theo quyết định hiện hành.
- Nối upload và đọc ảnh thực vào DTO tạo/chi tiết/vận hành theo D35. Lưu private evidence; kiểm chủ hồ sơ/cơ sở khi đọc. Không trộn owner type giữa các loại hồ sơ.

**Nghiệm thu:** khách chưa thuê gửi hỗ trợ chung và nhận phản hồi; API trực tiếp gắn hợp đồng future/ended bị chặn. Khách và staff đúng cơ sở đọc ảnh trên phiên khác; khách khác hoặc staff sai cơ sở không đọc được.

## KH-09 — Hủy trước kỳ thuê và nghiệm thu toàn luồng (C18)

C18 là ca **kiểm chứng chức năng đã có theo bản rà soát**, chỉ mở fix riêng nếu tái hiện lỗi. Test hủy trước StartDate khi chưa nhận chìa khóa theo rule hiện hành: phí 10% cọc, tài khoản nhận hoàn hợp lệ, trả ô/vô hiệu mã, hoàn PENDING → PAID khi quản lý ghi nhận chuyển. Retry không hoàn hoặc giải phóng ô hai lần.

Chạy các kịch bản từ UI với API/DB thử thật:

| Kịch bản | Bằng chứng cuối |
|---|---|
| Đăng ký → đặt kho → PayOS/tiền mặt | Cọc, consent, khoản thu và hợp đồng đúng sau reload |
| Yêu cầu chìa khóa → bàn giao → quét | Board đúng cơ sở, một lịch, mã theo kỳ thuê |
| Gia hạn → duyệt → QR/cash | EndDate chỉ tăng sau thu đủ, không tăng hai lần |
| Hết hạn → webhook muộn | Đối soát bền vững, không gia hạn sai |
| Trả kho sạch / có hư hỏng | Quyết toán đúng, không nợ ngoài cọc, hai bước hoàn |
| Hủy trước kỳ thuê | Đơn/kho/mã/khoản hoàn cập nhật đúng |
| Hỗ trợ chung / ticket có ảnh | Thread và ảnh đọc lại, đúng quyền |

## Quy cách giao và nhận lại từng gói

> Chỉ triển khai gói KH-xx và các mã C được giao. Đọc hướng dẫn repo, kiểm SHA hiện tại và tái hiện trước khi sửa. Giữ API tương thích hoặc ghi rõ thay đổi contract và nối cả FE/BE. Nếu cần quyết định nghiệp vụ, nêu phần bị chặn và tiếp tục phần độc lập. Bàn giao diff, migration nếu có, lệnh test và kết quả thực tế; không commit/push/merge thay thành viên.

Mỗi gói trả: **mã C → lỗi tái hiện → file/API đã đổi → test thành công/thất bại → điều chưa kiểm → phụ thuộc còn lại**. Kiểm test domain/HTTP cho điều kiện sai và phân quyền, SQL Server cho transaction/race, rồi E2E liên vai trò. Dùng migration mới nếu schema thay đổi; thử cả DB mới và upgrade DB thử có dữ liệu. Gateway giả kiểm logic ứng dụng; ghi riêng nếu chưa kiểm PayOS thật.

