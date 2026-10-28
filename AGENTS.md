# 🚨 MANDATORY PRE-FLIGHT PROTOCOL — BẮT BUỘC TRƯỚC KHI CODE

**CRITICAL INSTRUCTION FOR ALL AI AGENTS:** You are **STRICTLY FORBIDDEN** from writing, modifying, or suggesting any code until you complete the Pre-Flight Check below using file-reading tools.

## Step 1 — Mandatory Context Loading
Before answering any implementation, bug-fixing, or business-logic task, you **MUST** open and read with tools in the current turn:
1. `DECISIONS.md`: latest business rules, especially D21, D26, D27, subsequent replacements and Out-of-Scope items.
2. `feature_list.json`: exact related feature IDs and current states. Read the actual IDs present; do not assume the list stops at F38.
3. `progress.md`: recent changes and evidence, to avoid breaking completed flows.
4. `SafeSpace-Customer-UI/SafeSpace-Customer-UI/BACKEND-TODO.md` when touching API/backend: exact JSON contracts and endpoints. This is the actual repository path of `BACKEND-TODO.md`.
Also open existing target files before claiming their paths or modifying them. For new files, verify the parent directory and label them as new.

## Step 2 — Mandatory Output Receipt
At the very beginning of the first user-facing response after reading, before explanations or code, output this block filled with real evidence:

> **[PRE-FLIGHT CHECK]**
> - **Files Read:** (Exact repository paths opened with tools in this turn.)
> - **Active Decisions Applied:** (Specific IDs and relevant rules; account for newer decisions that replace older ones.)
> - **Related Feature ID:** (Actual IDs and current states from feature_list.json; for process-only documentation, say not applicable and do not invent a feature.)
> - **Files to Modify:** (Verified exact paths; explicitly mark proposed new files.)

**STOP RULE:** If `DECISIONS.md` has not been read with a tool in the current turn, **STOP IMMEDIATELY** and read it first. Prior chat memory, earlier-session reads, guessed paths, line numbers or business rules do not satisfy this check. Do not claim to have read a missing or unreadable file; report the blocker.

## 🚫 Anti-Rationalization Table
| Nếu AI định nghĩ rằng… | Quy tắc bắt buộc phản bác lại |
| --- | --- |
| “Task nhỏ, sửa UI chút thôi không cần đọc DECISIONS.md.” | **SAI.** UI gắn với nghiệp vụ, D26 bỏ bàn giao kích hoạt, D27 và các quyết định thay thế quy định cọc/hoàn tiền. Bắt buộc đọc. |
| “Tôi nhớ nội dung từ các câu chat trước rồi.” | **SAI.** File có thể vừa được cập nhật; bắt buộc đọc lại bằng tool trong lượt hiện tại. |
| “Build/test SQLite pass nghĩa là hoàn thành 100%.” | **SAI.** Không xác nhận hoàn thành toàn bộ khi chưa kiểm SQL Server thật và luồng API thực tế; ghi rõ môi trường, giới hạn và phần chưa kiểm chứng. |
| “Plan cũ có bàn giao kích hoạt nên tôi code lại.” | **SAI.** Tài liệu cũ mâu thuẫn với quyết định mới có hiệu lực không được dùng để khôi phục luồng đã bỏ. |
| “Tự in receipt là đủ, không cần đọc file.” | **SAI.** Receipt chỉ ghi bằng chứng thực sự đọc được qua tool; không được bịa ID, trạng thái hoặc đường dẫn. |

Yêu cầu này bổ sung các quy định dưới đây, không thay quy định bảo vệ dữ liệu, kiểm thử, nhánh riêng hoặc việc thành viên tự commit/push/PR/merge. Quyết định mới được người dùng chốt phải ghi mục thay thế trong DECISIONS.md trước khi triển khai; không xoá lịch sử hoặc tự suy ra nghiệp vụ.

---

# AGENTS.md — Sổ tay vận hành cho AI coding agent (SSFRMS / SafeSpace)

> Đọc file này ĐẦU TIÊN trong mọi phiên. File này là bản đồ, không phải bách khoa:
> chi tiết nằm trong `docs/` và các file được liên kết bên dưới. Giữ file dưới 200 dòng.

## 1. Quy tắc bắt buộc

1. **Mỗi task/PR có một mục tiêu rõ ràng.** Được sửa các phần liên quan cần thiết để hoàn thành mục tiêu;
   không tự thêm tính năng, đổi cấu trúc hay format file ngoài phạm vi. Bản vá tài liệu không cần tạo tính năng sản phẩm giả.
2. **Báo đúng mức hoàn thành.** Kiểm tra theo phạm vi trong `docs/verification.md`; ghi lệnh, kết quả và giới hạn.
   Thiếu công cụ, backend, SQL Server hoặc khóa PayOS thì ghi chưa kiểm chứng, không báo pass thay.
3. Chỉ chuyển tính năng sang `passing` khi có bằng chứng đáp ứng tiêu chí và thành viên phụ trách xác nhận.
   Nếu phát hiện lỗi hồi quy, được đổi trạng thái kèm lý do/bằng chứng trong `progress.md`.
4. **Figma là chuẩn về bố cục và tương tác khách hàng.** Nghiệp vụ, quyền truy cập, trạng thái và tính tiền theo
   các quyết định nhóm đang có hiệu lực trong `DECISIONS.md`; không sửa API/quyền chỉ để giống ảnh.
   Nếu Figma, SRS và quyết định mâu thuẫn thì nêu rõ để nhóm chốt. Ảnh/giá/số liệu minh họa không thay dữ liệu thật.
5. Bản chạy chính giữ giao diện sản phẩm và không dùng dữ liệu giả để báo thao tác API thành công.
   Chế độ mock/offline phải được chọn rõ và có dấu hiệu nhận biết cho người kiểm thử; API lỗi phải báo đúng.
   Đây là yêu cầu cho các lần sửa liên quan, không khẳng định mọi màn hiện tại đã đáp ứng.
6. **Cấu hình ngân hàng và PayOS của dự án:** theo yêu cầu người dùng ngày 28/10/2026,
   cho phép lưu/chia sẻ thông tin tài khoản nhận tiền (ngân hàng, số tài khoản, tên chủ tài khoản)
   và cấu hình PayOS backend do nhóm cung cấp, kể cả khóa thật trong `StorageProject.Api/appsettings.json`.
   AI được đọc, cấu hình và kiểm thử PayOS; không tự xóa, che hoặc thay giá trị nhóm cung cấp bằng placeholder
   chỉ vì quy định tránh lộ thông tin ngân hàng/PayOS. Xem PROCESS-2026-10-28-PAYOS trong DECISIONS.md.
   Giữ quy định không commit mật khẩu DB, khóa JWT, token và bí mật khác ngoài phạm vi ngoại lệ trên.
   Khóa PayOS vẫn chỉ dùng ở backend; không đưa vào `VITE_*` hoặc bundle frontend.
7. Không sửa migration đã merge hoặc áp dụng trên database dùng chung. Thay đổi schema sau đó phải tạo migration mới.
   Migration chỉ ở nhánh riêng, chưa chia sẻ/chưa áp dụng trên DB dùng chung được chỉnh cùng model/snapshot.
   Không tự xóa/reset database hoặc dữ liệu để xử lý lỗi; phải được người dùng cho phép rõ ràng.
8. Không tự đảo ngược quyết định nghiệp vụ. Thay đổi đã được yêu cầu/chốt phải ghi mục mới trong `DECISIONS.md`
   nêu phạm vi và quyết định bị thay thế; giữ nguyên lịch sử cũ.
9. Không bỏ/nới test để che lỗi. Được sửa test khi yêu cầu thay đổi hoặc test sai, kèm lý do và kiểm chứng thay thế.
10. Thành viên làm trên nhánh riêng (`feature/`, `fix/`, `docs/`, `chore/`) → PR vào `main`.
    Không push thẳng `main`; merge PR vào `main` là bước tích hợp bình thường sau kiểm tra/review.
11. Giao diện và tài liệu dùng tiếng Việt; tên biến/hàm/API dùng tiếng Anh. Comment ngắn, cần thiết, theo quy ước file.
12. **AI chỉ hỗ trợ phân tích, sửa file và chạy kiểm thử. AI không tạo commit, push, tạo PR hoặc merge.**
    Thành viên đọc hiểu, kiểm tra thay đổi rồi tự commit/push/tạo PR/merge bằng tài khoản của mình.
    AI không đổi `user.name`/`user.email`, gán tác giả/đồng tác giả hay sửa lịch sử commit để thay danh tính.
    Không cam kết số contributor chỉ bằng cách hạn chế push; sử dụng AI và ghi nhận đóng góp theo yêu cầu môn học.
13. Khi sửa FE, đọc `docs/frontend-naming.md`, `SafeSpace-Customer-UI/SafeSpace-Customer-UI/AGENTS.md`
    và `FRONTEND-MAP.md` cùng thư mục FE. Không tạo lại thư mục nguồn cũ.

Quy tắc quy trình mới được ghi tại `DECISIONS.md` mục `PROCESS-2026-10-24`.

## 2. Dự án là gì

Hệ thống quản lý và cho thuê kho tự phục vụ **SafeSpace** cho 5 nhóm người dùng
(Khách hàng, Nhân viên cơ sở, Quản lý cơ sở, Quản lý vận hành kinh doanh, Quản trị hệ thống),
27 use case (UC01–UC27), 7 luồng nghiệp vụ. Nguồn yêu cầu: `srs_content.txt` (SRS v2.0) và
`dd_content.txt` (Data Dictionary, 25 bảng). Giao diện: Figma "SafeSpace - Modern UI"
(https://www.figma.com/design/SX8EvOf1TJkxfMl90bZsGN/SafeSpace---Modern-UI).

## 3. Bản đồ repo

| Thư mục / file | Nội dung |
|---|---|
| `StorageProject.Api/` | .NET Minimal API: `Program.cs`, `Endpoints/*Endpoints.cs` |
| `StorageProject.Core/` | Entities, DTOs, `Interfaces/IServices.cs` |
| `StorageProject.Infrastructure/` | EF Core `AppDbContext`, `Migrations/`, `DbSeeder.cs`, `Services/*Service.cs` |
| `SafeSpace-Customer-UI/SafeSpace-Customer-UI/` | React 19 + Vite: khách hàng, nhân viên, quản lý cơ sở, vận hành KD, quản trị |
| `…/src/features/facility-operations/` | Khu Nhân viên `#/staff` + Quản lý cơ sở `#/manager` (gọi `/api/ops/*`, D15) |
| `…/src/app/state/appReducer.js` | Nghiệp vụ phía giao diện (hàm thuần, có test) |
| `…/src/app/state/AppProvider.jsx` | Phiên đăng nhập, 2 chế độ: API / lưu trình duyệt |
| `…/src/shared/api/` | Gọi API + `apiMappers.js` chuyển dữ liệu backend → giao diện |
| `…/BE-CONTRACT.md` | Endpoint giao diện cần backend bổ sung |
| `…/BACKEND-TODO.md` | Việc backend còn thiếu, xếp ưu tiên A/B/C, mẫu JSON `GET /api/ops/board` |
| `docs/facility-ops-api.md`, `docs/operations-api.md` | API khu Nhân viên / Quản lý cơ sở và khu Vận hành KD |
| `…/CUSTOMER-FLOW-COVERAGE.md`, `ADMIN-FLOW-COVERAGE.md`, `OPS-FLOW-COVERAGE.md` | Đối chiếu màn Figma ↔ route ↔ component ↔ API |

## 4. Đọc thêm khi cần (tiết lộ dần)

| Khi làm việc này | Đọc |
|---|---|
| Hiểu kiến trúc, luồng request, chế độ API / trình duyệt | `docs/architecture.md` |
| Sửa trạng thái, cách tính tiền, quy tắc nghiệp vụ | `docs/business-rules.md` + SRS mục 7–8 |
| Viết code FE hoặc BE mới | `docs/conventions.md` |
| Kiểm chứng, viết test, định nghĩa "xong" | `docs/verification.md` |
| Thêm / sửa endpoint | `BE-CONTRACT.md` + `docs/conventions.md` mục Backend |
| Dựng màn hình từ Figma | `CUSTOMER-FLOW-COVERAGE.md` / `ADMIN-FLOW-COVERAGE.md` + `docs/figma-review-2026-09-26.md` |
| Tính năng lớn, nhiều file | Tạo sprint contract từ `docs/templates/sprint-contract.md` |

## 5. Chạy dự án

```bash
./init.sh                     # Linux/macOS/Git Bash — kiểm tra môi trường + test + build
./init.ps1                    # Windows PowerShell — tương đương
npm run dev                   # Khởi chạy đồng thời Backend (:5151), Frontend (:5173) và Ngrok tunnel
dotnet run --project StorageProject.Api --launch-profile http     # API riêng lẻ: http://localhost:5151
cd SafeSpace-Customer-UI/SafeSpace-Customer-UI && npm run dev     # UI riêng lẻ:  http://127.0.0.1:5173
```

Cần: .NET SDK 10 (project đặt `net10.0`), Node ≥ 22.12, SQL Server (mặc định `.\SQLEXPRESS`).
Tài khoản seed: `customer01`…`customer06`/`Customer@123`, `staff01`, `staff02`/`Staff@123`, `manager01`/`Manager@123`
(cả ba phụ trách SafeSpace Nguyễn Lương Bằng), `ops01`/`Ops@123` (Vận hành KD), `admin`/`Admin@123`.
Không có backend: tạo `.env.local` với `VITE_USE_API=false`, hoặc `MOCK_OPS=1 npm run dev:mock` (máy chủ giả có cả `/api/ops/*`,
thêm `manager01`/`Manager@123`).

## 6. Vòng đời một task

**Bắt đầu**
1. Đọc quy định, yêu cầu hiện tại và phần liên quan trong `progress.md`, `feature_list.json`, `DECISIONS.md`.
2. Kiểm tra `git status` và lịch sử gần đây; giữ các thay đổi có sẵn của thành viên. Không tự stash/reset/clean.
3. Ưu tiên task người dùng giao. Nếu chưa có task, đề xuất phần việc từ danh sách; không tự nhận việc của người khác.
4. Chạy kiểm tra nền phù hợp. Nếu lỗi, phân biệt lỗi sẵn có/môi trường với lỗi do thay đổi mới.
   Có thể tiếp tục phần độc lập, nhưng phải ghi giới hạn; không tuyên bố phần bị chặn đã đạt.

**Làm việc**
5. Với tính năng sản phẩm, cập nhật trạng thái đúng phạm vi; task chỉ tài liệu không đổi trạng thái tính năng khác.
6. Chỉ sửa phần cần thiết. Chạy kiểm tra theo `docs/verification.md`, sửa lỗi do task gây ra.

**Kết thúc**
7. Ghi thay đổi, kết quả và giới hạn trong `progress.md`; cập nhật tài liệu/quyết định khi có thay đổi liên quan.
8. AI bàn giao ZIP/patch, danh sách file, hướng dẫn áp dụng và kiểm tra; không commit/push/PR/merge.
9. Thành viên kiểm diff và tác giả dự kiến trước khi tự commit; không tự thay tác giả của commit có sẵn.
10. Trước merge code, chạy bộ kiểm tra đầy đủ phù hợp với nhánh hiện tại và kịch bản tích hợp liên quan.
    Một thành viên khác review/xác nhận. Task chỉ tài liệu kiểm diff, đường dẫn và tính nhất quán, không cần build ứng dụng.

## 7. Checklist bàn giao

- [ ] Đúng phạm vi; không ghi đè thay đổi có sẵn của thành viên.
- [ ] Các kiểm tra cần thiết đã chạy; phần không chạy/thất bại có lý do cụ thể.
- [ ] Thay đổi code có build/test tương ứng; thay đổi giao diện đã xem màn hình nếu môi trường cho phép.
- [ ] Phân biệt kiểm thử mock, SQLite, SQL Server và PayOS thật; không dùng kết quả này thay cho kết quả khác.
- [ ] Cấu hình ngân hàng/PayOS theo ngoại lệ tại quy tắc 6; bí mật khác vẫn được bảo vệ. Không thêm `debugger`, log thử hoặc hành vi giả thành công. TODO còn lại phải được ghi rõ.
- [ ] Tài liệu và bằng chứng đúng hiện trạng; không tự nâng tính năng sang `passing`.
- [ ] Thành viên tự commit/push/PR/merge; có người khác trong nhóm review trước merge.

## 8. Khi bị kẹt

Ghi rõ vào `progress.md`: đang kẹt ở đâu, đã thử gì, cần ai quyết định. Với tính năng sản phẩm thực sự bị chặn,
đổi `state` thành `blocked` kèm `blocked_reason`; không đổi trạng thái phần khác cho task chỉ tài liệu. Không đoán nghiệp vụ — nếu SRS, Figma và code mâu thuẫn, hỏi nhóm và ghi vào `DECISIONS.md`.

## 9. Nguồn tham khảo

Bộ tài liệu harness này được soạn theo hướng dẫn từ hai trang do thầy Hoàng giới thiệu ngày 25/09/2026:
- https://learnharness.org/#dinh-nghia — Harness Engineering: làm chủ AI coding agent
- https://skills.learnharness.org/ — bộ skill cho AI coding agent
