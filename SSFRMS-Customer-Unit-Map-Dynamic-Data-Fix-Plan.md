# SSFRMS — Sửa sơ đồ kho Customer không nhận ô kho mới

**Ngày:** 13/11/2026.  
**Repo:** https://github.com/ryocoding13/SSFRMS  
**Mốc kiểm tra:** main, commit [518666f](https://github.com/ryocoding13/SSFRMS/tree/518666fbb5fa09d8bfd95b9738cefe33cc1a0dd4), “Merge branch fix/thang-luot1-7”.  
**Mức xác minh:** đã đọc code FE/BE mới nhất tại mốc trên; chưa chạy app hoặc test trên DB của nhóm. Agent phải xác nhận SHA và quy định repo trước sửa.

## 1. Vấn đề và ảnh hưởng

Manager có thể thêm ô kho trong màn quản lý, nhưng sơ đồ ở màn chi tiết cơ sở/đặt kho của Customer vẫn dựng từ danh sách cố định **K01–K12**. Ví dụ cơ sở vốn có 12 ô, Manager thêm K13 thành công: dù API công khai trả K13, sơ đồ vẫn không vẽ K13. Không phải giới hạn số lượng kho của backend mà là giới hạn cách frontend dựng dữ liệu và bố cục.

Hậu quả:
- Ô mới không hiện; ô bị đổi mã hoặc không còn trong kết quả API có thể vẫn bị vẽ bằng dữ liệu mẫu.
- Số ô, trạng thái và vị trí/loại/diện tích trên sơ đồ có thể lệch DB.
- API lỗi hoặc trả danh sách rỗng có thể bị hiểu như cần sinh lại 12 ô mẫu.
- Những cập nhật gần đây về khả dụng theo kỳ thuê phải được giữ khi sửa, không quay lại dùng trạng thái hiện tại để suy khả dụng.

## 2. Nguyên nhân đã tìm thấy

| Điểm vào | Bằng chứng và tác động |
|---|---|
| `shared/utils/units.js` | `LAYOUT` chứa K01–K12. `unitsFor` luôn chạy `LAYOUT.map`; dữ liệu API chỉ dùng để tìm ô trùng mã. `hasReal` yêu cầu mảng không rỗng; ô không khớp mã dùng `PATTERN`/stock mẫu. Loại và diện tích lấy từ offer gán theo layout thay vì ánh xạ từng ô thật. |
| `shared/components/UnitMap.jsx` | Chỉ tách `rowA` và `rowB`, vẽ hai dãy và ghi “Tầng trệt”. Chỉ đổi hàm tạo dữ liệu chưa đủ: ô dãy/tầng khác vẫn có nguy cơ không được vẽ. |
| `features/customer/facilities/FacilityDetailPage.jsx` | Gọi `getFacilityUnits(facilityId, { startDate: start, months })` khi vào sơ đồ và đổi ngày/kỳ thuê. Đang đưa dữ liệu vào `unitsFor`; chưa tách rõ loading/error/empty ở sơ đồ. |
| `app/state/AppProvider.jsx` | `getFacilityUnits` bắt mọi lỗi rồi trả null; UI mất thông tin phân biệt lỗi với chưa có dữ liệu. |
| API `GET /api/facilities/{id}/units` và `FacilityService.GetUnitsByFacilityIdAsync` | Đã đọc StorageUnits theo cơ sở, loại OUT_OF_SERVICE khỏi kết quả, không giới hạn 12 ô. Đã có tham số kỳ thuê và dữ liệu khả dụng. Tận dụng API hiện có, không tạo endpoint danh sách trùng. |
| Manager `UnitManagementPage.jsx` | Thêm bằng action CREATE_UNIT, gửi mã, vị trí, loại và diện tích. Cần test API thực để xác nhận bản ghi và FacilityId trước khi đánh giá sơ đồ. |

## 3. Phạm vi và hành vi đích

- Chế độ API: danh sách ô và số lượng lấy hoàn toàn từ endpoint công khai cho đúng cơ sở. Không sinh thêm ô K01–K12, không giới hạn 12, không fallback sang trạng thái mẫu khi tải lỗi.
- Vẽ tất cả ô API cho phép hiển thị, gồm 0, 1, 12, 13 và nhiều hơn; nhóm theo dữ liệu tầng/khu vực. Thiếu vị trí thì vào nhóm “Chưa phân khu”, không loại bỏ ô.
- Sau Manager tạo thành công, Customer mở lại/tải lại sơ đồ phải thấy ô mới. Không yêu cầu WebSocket, polling hoặc đồng bộ tức thì giữa hai trình duyệt.
- Giữ sơ đồ minh họa, không yêu cầu layout mặt bằng tỷ lệ chính xác hay trình chỉnh vị trí.
- Giữ chế độ demo nếu repo còn hỗ trợ, nhưng tách rõ nguồn demo khỏi nguồn API. Mảng API rỗng là trạng thái rỗng hợp lệ.
- Không đổi nghiệp vụ phân bổ kho, giá, đặt chỗ hoặc thêm DB migration nếu API hiện tại đủ dữ liệu.

## 4. Gói MAP-01 — Chuẩn hóa dữ liệu thật

Đọc DTO và adapter hiện hành, kiểm JSON thực tế (camelCase/snake_case) trước khi viết mapper. DTO hiện có: UnitId, FacilityId, UnitTypeId, UnitNumber, Floor, Zone, LocationDescription, SizeM2, ClimateControlled, Status, FreeFrom, Overdue, CurrentContractEndDate, BookableForPeriod, PeriodUnavailableReason.

- Tạo mapper riêng cho mảng API; mỗi bản ghi hợp lệ tạo đúng một ô. Khóa ổn định theo UnitId, mã ô chỉ để hiển thị/tìm trên URL. Tránh làm tròn ID bigint qua Number nếu adapter hiện giữ dạng chuỗi.
- Loại kho, diện tích, vị trí, trạng thái và ngày khả dụng phải lấy từ ô thật. Match offer/giá theo UnitTypeId và dữ liệu catalog thực tế, không lấy gói đầu tiên hoặc cùng cỡ để gán nhầm loại/giá.
- Nếu thiếu offer/giá tương ứng: vẫn hiện ô với thông tin thật, báo “Chưa có giá phù hợp”, không cho dùng giá giả để tiếp tục. Backend vẫn là nơi xác nhận giá và khả dụng.
- Giữ `bookableForPeriod`, `periodUnavailableReason`, `freeFrom`, `overdue`, `currentContractEndDate` trong view model. Phân biệt trạng thái vận hành hiện tại với đặt được trong kỳ đang tìm.
- Nếu payload sai cấu trúc, coi là lỗi tải. Với status lạ, dùng trạng thái an toàn “Chưa xác định”, không coi là FREE.

**Xong khi:** API trả 13 ô thì mapper tạo 13 ô, API trả [] tạo [], không gán nhầm loại/diện tích khi thứ tự API thay đổi.

## 5. Gói MAP-02 — Bố cục theo dữ liệu

- Thay hai dãy A/B cố định bằng nhóm Floor → Zone hoặc nhóm vị trí phù hợp schema. Dùng “Chưa phân khu” khi thiếu dữ liệu; không tự suy mã K13 thuộc tầng/dãy nào.
- Render bằng grid responsive, hỗ trợ xuống dòng; tầng/dãy mới vẫn hiện. Giữ legend, nhãn chọn, thông tin từng ô, tổng số và chú thích “Sơ đồ minh họa”.
- Bỏ nhãn “Tầng trệt” nếu không đúng dữ liệu. Tổng số/legend tính từ chính danh sách đang vẽ.
- Tôn trọng OUT_OF_SERVICE: endpoint hiện không trả trạng thái này; Customer không phải vẽ bản ghi đã bị loại. Các trạng thái bảo trì/kiểm tra do API trả vẫn phải hiện với khả dụng tương ứng.

**Xong khi:** K13, dãy C và tầng 2 xuất hiện nếu có trong API, không bị mất vì layout.

## 6. Gói MAP-03 — Tải, làm mới và lựa chọn

- Tách 4 trạng thái: loading, success có dữ liệu, success rỗng, error có nút thử lại. Sửa catch trả null bằng lỗi có thể phân biệt; kiểm caller khác trước khi đổi chữ ký.
- Reset danh sách/lựa chọn khi đổi cơ sở; chống response cũ ghi đè response mới khi đổi cơ sở/ngày/kỳ nhanh bằng AbortController hoặc request token theo convention.
- Có nút tải lại sơ đồ; mở lại chế độ sơ đồ sẽ gọi API theo cơ sở/ngày/kỳ hiện tại. Chặn thao tác dựa trên dữ liệu đang tải hoặc dữ liệu của kỳ cũ.
- Sau dữ liệu về, giữ lựa chọn nếu còn tồn tại; mã URL không tồn tại không làm crash. Nếu lựa chọn không còn hợp lệ để đặt, hiện lý do và không cho tiếp tục với dữ liệu cũ. Có thể vẫn chọn ô không khả dụng để xem thông tin.
- API lỗi không hiện ô mẫu; thiếu giá hoặc không có ô không được tạo đơn dựa trên giá trị fallback.

**Xong khi:** Manager thêm kho → Customer bấm tải lại/mở lại sơ đồ → ô mới hiện. Đổi cơ sở hoặc kỳ không giữ ô/khả dụng sai từ response cũ.

## 7. Gói MAP-04 — Giữ đúng khả dụng và ý nghĩa chọn ô

Source mới đã kiểm theo khoảng kỳ thuê. Không chỉ dựa trên Status AVAILABLE; dùng BookableForPeriod và lý do từ API, sau đó backend kiểm lại lúc tạo đơn. Giữ nguyên các quyết định về kho quá hạn, buffer, các khoản giữ chỗ và bảo trì.

**Điểm cần nói đúng:** `proceed` ở SHA này gửi CREATE_RESERVATION với cơ sở, offer, tháng và ngày bắt đầu; không gửi UnitId của ô đang chọn. Do đó, sửa sơ đồ không đồng nghĩa khách được bảo đảm nhận đúng K13. Trong phạm vi task:
- Giữ hành vi phân bổ hiện hành; dùng lựa chọn để xem đúng loại/giá/khả dụng.
- Không thêm `unitId` vào request một cách hình thức khi backend không hỗ trợ.
- Đối chiếu quyết định repo; nếu khách chỉ chọn loại kho thì UI không hứa cấp đúng ô, có thể chú thích gọn khi cần.
- Nếu nhóm muốn giữ đích danh ô khách chọn, báo thành hạng mục riêng cần thay hợp đồng API, kiểm quyền/khả dụng và khóa chống đặt trùng; không âm thầm mở rộng task.

## 8. Kiểm thử nghiệm thu

| Ca | Kỳ vọng |
|---|---|
| Cơ sở 12 ô, Manager thêm K13 bằng API thật | DB/API có đúng FacilityId; Customer reload thấy 13 ô nếu cả 13 được API trả. |
| Thêm ô ở cơ sở B | Sơ đồ A không đổi; B có ô mới. |
| API chỉ có 2 ô mã bất kỳ hoặc [] | Chỉ vẽ đúng 2 ô hoặc empty state, không có K01–K12 tự sinh. |
| Thêm tầng 2/dãy C/ô thiếu Zone | Vẽ đầy đủ, nhóm đúng hoặc “Chưa phân khu”, tổng số khớp. |
| Đổi mã, loại, diện tích hoặc trạng thái ô | Reload dùng dữ liệu API mới; không giữ bản mẫu theo mã cũ. |
| API lỗi/timeout, payload sai | Báo lỗi và thử lại; không tạo dữ liệu giả, không cho đặt dựa trên state cũ. |
| Đổi ngày/kỳ/cơ sở liên tục, response đảo thứ tự | Chỉ dữ liệu request mới nhất được hiển thị. |
| Kho đang thuê nhưng có thể đặt trong tương lai; kho quá hạn/bảo trì | Giữ đúng BookableForPeriod và lý do của backend; không suy từ màu trạng thái đơn lẻ. |
| Không có giá cho loại ô mới | Thông tin ô vẫn đúng, không gán bừa giá/offer; không tiếp tục bằng giá giả. |
| Nhấn tiếp tục đặt kho | Không làm hỏng tạo đơn/checkout hiện hành; UI không hứa nhận đích danh ô khi API chỉ đặt theo loại. |

Ưu tiên unit test mapper và UI states cùng integration/E2E thực sự cần cho lỗi này. Chạy các test frontend liên quan, check:structure/build theo package.json; backend test nếu đổi API. Ghi riêng các ca đã chạy trên API/DB thật và ca chưa chạy. Test mock không chứng minh Manager tạo và Customer nhận dữ liệu xuyên suốt.

## 9. Bàn giao

Đọc AGENTS.md và quyết định mới nhất; không reset DB nhóm, sửa migration cũ hay tự commit/push/PR/merge nếu repo cấm. Ghi nhánh/SHA, nguyên nhân, file sửa, request/response đã loại dữ liệu nhạy cảm, lệnh kiểm chứng và kết quả. Không cần sửa schema nếu DTO hiện đủ.

**Definition of done:** Customer không còn bị giới hạn bởi LAYOUT 12 ô trong chế độ API; số lượng, loại, diện tích, nhóm vị trí và khả dụng khớp nguồn backend. Kho mới nhìn thấy sau reload; lỗi/rỗng không sinh ô mẫu; checkout và kiểm khả dụng theo kỳ được giữ.
