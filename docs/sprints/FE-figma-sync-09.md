# Figma–FE Batch09 — Phiên 6, 28/10/2026

## Nền, nguồn và phạm vi

Tiếp nguyên source Batch08 trên main c1a9b05b67a96972cbf44d039b9acb4e15307781. Đã đọc lại branch main/DECISIONS qua GitHub (blob13b2eea528949844dd708bd00ee53d58be3c966c), giữ D33 local. Đọc AGENTS/FE AGENTS, feature_list, progress, BACKEND-TODO, FRONTEND-MAP, naming, verification và target files. F40 active/F41 blocked giữ nguyên. Không sửa BE/schema/Figma; không commit/push/PR/merge.

Design context high-fidelity + screenshot trực tiếp: A02 `436:14276`, A03 `436:14317`; panel A02a `1171:12048`, A05a `1171:12176`, A05b `1171:12701`, A05c `1171:12904`; B05 `436:14109`, trạng thái chính sách `923:10626`, phiên bản chính sách `1052:12950`, xuất CSV `938:11028`; đối chiếu thêm B01 `436:13804`, B04 `436:14019`.

Dùng shared Modal/ConfirmDialog và token/font hiện có. Panel chọn là drawer560px bên phải, list cuộn và footer cố định, co về chiều rộng màn nhỏ; thao tác quan trọng vẫn popup560px 6tone. Không thêm thư viện/asset tĩnh. Danh sách chỉ dữ liệu API, không chép tên/tiền/ngày minh họa; header/nav reuse shared layout. Chưa xác nhận visual khớp pixel vì chưa browser thực thi.

## Admin

- A03 thay ma trận sửa PermissionCode bằng bảng chỉ xem đúng D32/Figma. Bỏ checkbox/toggle/save/mutation khỏi Page, chỉ GET roles. API permission legacy vẫn còn trên backend: cần BE owner rà/khóa theo D32; FE không phải cơ chế bảo vệ server.
- A02/A05 dùng SelectionPanel chọn cơ sở đang ACTIVE từ API; không nhập tên thủ công. Chọn tạm trong panel rồi 'Dùng cơ sở này' mới cập nhật form; đóng giữ giá trị trước. Đổi vai trò trên form tạo mới xóa lựa chọn cơ sở cũ; role/facility ID không có trong catalog bị từ chối. Không mặc định cơ sở đầu tiên.
- A05 có panel Đổi vai trò/Cấp lại vai trò; vai trò đang có không chọn thêm. Nếu nhiều vai trò, phải chọn rõ vai trò cần thay; không sửa ma trận quyền. Gỡ/cấp lại dùng endpoint có sẵn và đọc lại đúng tập roles; giữ các vai trò khác. Kiểm last-active-admin và quyền/scope vẫn ở backend.
- Đổi vai trò dùng **một endpoint atomic đề xuất** `/api/admin/users/{id}/role-change`. Main chưa có; 404/405 báo chưa hỗ trợ, không fallback assign rồi revoke. Panel đã có FE; không tuyên bố đổi vai trò chạy xuyên server. Server cần expectedRoleIds/version/transaction và xử lý assignment/JWT đúng khi đổi role.
- Tạo tài khoản kiểm receipt id/username/name/email/role trước phân công. Tạo thành công nhưng phân công lỗi hiển thị rõ 'Đã tạo tài khoản · Chưa phân công cơ sở', giữ thông tin đăng nhập một lần và dẫn sang hồ sơ; không gọi create lần hai. Receipt/mạng không xác minh được thì chặn tạo tiếp và yêu cầu kiểm danh sách. Đây vẫn là hai request hiện có, chưa atomic create+assign.
- Phân công/readback kiểm đúng cơ sở/ngày và một assignment ACTIVE giao nhau; trạng thái assignment đọc lại trước báo thành công. Role readback sai/thiếu cũng buộc tải lại. Role toàn hệ thống không mở phân công mới; giữ lịch sử để đối chiếu.
- useLoad hủy response cũ khi đổi ID/unmount, không xử lý401 từ request cũ lên màn mới. Chi tiết khóa các fieldset khi reload/error, tránh sửa snapshot cũ. Refetch user không ghi đè form InfoCard chỉ vì object roles đổi nhưng thông tin cá nhân không đổi.

## Vận hành và popup

- B05 ID lạ không tự chọn cơ sở đầu tiên. Đổi trạng thái không chọn sẵn. Lưu/thêm/đổi trạng thái có readback đối chiếu trường vừa gửi; thiếu/sai thì báo chưa xác minh và chặn gửi lặp đến khi tải lại. Đóng/cancel bị chặn lúc đang ghi. Không tự xóa cơ sở hoặc đổi điều kiện nghiệp vụ server.
- Trạng thái chính sách: chỉ DRAFT được xóa, ACTIVE được ngừng; xác nhận nguy hiểm khi xóa, readback đúng trạng thái, thiếu/unknown không mặc định đã ngừng. Không thêm chính sách giảm giá từ số minh họa Figma.
- Chính sách chi tiết chuyển layout hai cột thông tin phiên bản/thông số/phạm vi, sửa đủ7 nhóm, xem trước và tick kiểm tra trước công bố. Dùng DTO T20 main `{action,rate:number,sections,version:number}`; receipt phải là version mới, đúng rate và7 nội dung, raw200 thiếu không thành công. Không dùng policy mặc định để che lỗi API. API hiện tạo version có hiệu lực ngay; không dựng input ngày công bố tương lai hoặc số phiên bản tự nhập không được backend lưu.
- Giữ bằng chứng version khách đã đồng ý; wording Figma về 'hợp đồng đang chạy giữ phiên bản' không được dùng để đảo phạm vi D32 cho mọi hợp đồng. UI diễn giải bằng tiếng Việt, không hiện mã quyết định nội bộ.
- Xuất CSV có tổng quan từ API theo đúng from/to/facility/view; kiểm ngày thực, catalog cơ sở, summary filter khớp. Snapshot khi xác nhận khóa phạm vi đến khi tải xong; các trường được giữ khi lỗi. Chỉ 2 view có scope đầy đủ (`facilities`, `unit-types`), không để bộ lọc cơ sở/ngày giả ở revenue-trend global. Kiểm Content-Type CSV, chặn metadata-only khi summary không có hàng dữ liệu; escape công thức gồm khoảng trắng đầu ô/quote/newline, giữ số âm hợp lệ. Không nhận HTML/JSON200 làm CSV.
- B01/B04 giữ dữ liệu/đồ thị/XLSX hiện có, sửa định dạng tiền thiếu để không thành0, tỷ lệ thiếu không thànhNaN. B04 chặn bấm xuất lặp/đổi tab khi xuất, không tải file muộn sau unmount. B04 revenue/status vẫn là báo cáo global theo API hiện tại; không tuyên bố có filter cơ sở chưa được server hỗ trợ.
- useChangeFlow có guard xuyên xác nhận→saving→kết quả, không cho hai mutation cùng hook, cleanup resolver khi unmount, trạng thái chờ không cho đóng, failure phân biệt chưa xác minh. useConfirm xung đột chính sách cũng reuse ConfirmDialog và cleanup resolver. Giữ nội dung/form khi hủy/lỗi. Không gọi kết quả mock thành API thành công.

## Kiểm chứng

- FE **155/155**, gồm10 test mới: active catalog/ngày, assignment chồng/receipt, atomic role không fallback, quyền còn lại, partial create, facility readback, report scope/summary/CSV, publication receipt. Business **9/9**, workflows **12/12**.
- SSR **173 lượt route/scenario**: thêm11 admin/business route và4 assertions render bảng chỉ xem/panel chọn/disabled/empty. Không gọi đây là browser test.
- Structure/build/init.sh --fe-only/git diff --check PASS; build còn chunk>500KB. Hai patch after-batch08/main apply + byte-match source cuối trên bản export sạch; PowerShell chưa chạy trên Windows.
- Chromium launch trong phiên này thiếu executable Playwright. Chưa kiểm browser/visual/focus/drawer cuộn/file download/clipboard, API .NET/SQL Server/PayOS thật hoặc thiết bị cửa. Request stub/pure helper/HTTP mock không chứng minh BE thật đã triển khai đúng contract/readback.

## Blocker / điểm tiếp tục

Đọc BACKEND-TODO mục Batch09: atomic role-change, khóa permission mutation legacy theo D32, consistency create+assignment/idempotency và scope báo cáo; metadata scheduled publication nếu nhóm muốn đầy đủ Figma. Không tự triển khai endpoint/schema hoặc nâng passing.

Phiên còn lại **Batch10 — browser và tích hợp**. Cần kiểm1440/768/390, bàn phím/focus/scroll, đóng/mở panel và popup lồng, lỗi/gửi lặp/đổi session, role+facility/last-admin, upload/refund/return/incident+policy/payment xuyên server. Chưa hoàn thành toàn bộ hệ thống chỉ từ các test FE.

Bàn giao after-batch08.patch cho nền có Batch08, hoặc main.patch gộp01–09 cho main c1a9b05; chỉ áp một patch. Thành viên tự review/test tích hợp rồi commit/push/PR/merge.
