# AGENTS.md — Sổ tay vận hành cho AI coding agent (SSFRMS / SafeSpace)

> Đọc file này ĐẦU TIÊN trong mọi phiên. File này là bản đồ, không phải bách khoa:
> chi tiết nằm trong `docs/` và các file được liên kết bên dưới. Giữ file dưới 200 dòng.

## 1. Quy tắc bắt buộc (không được vi phạm)

1. **Mỗi phiên chỉ làm MỘT tính năng** trong `feature_list.json` (WIP = 1). Không "tiện tay" sửa tính năng khác.
2. **"Xong" = kiểm chứng pass**, không phải "code trông ổn". Chạy lệnh `verification` của tính năng + `./init.sh`.
3. **Không tự đổi `state` sang `passing`** khi chưa có bằng chứng (output lệnh, commit). `passing` không bao giờ lùi về trạng thái khác nếu không có lý do ghi trong `progress.md`.
4. **Figma là chuẩn cho giao diện khách hàng.** Backend sửa theo giao diện, không sửa giao diện cho khớp backend (xem `DECISIONS.md` D01).
   Figma đã rà hết mâu thuẫn ngày 26/09/2026 (D11). Ảnh, giá, số liệu trong Figma chỉ là minh hoạ — lấy từ backend.
5. **Không đưa chữ "demo", "dữ liệu mẫu", "sample"… lên giao diện.** Sản phẩm phải trông như sản phẩm chính thức (D07).
6. **Không commit bí mật**: chuỗi kết nối thật, JWT secret thật, `.env.local`, `appsettings.*.json`.
7. **Không sửa migration đã có.** Thay đổi schema → tạo migration mới (`dotnet ef migrations add <Tên>`).
8. **Không đảo ngược quyết định trong `DECISIONS.md`** mà không ghi quyết định mới kèm lý do.
9. **Không xoá/sửa test để cho pass.** Test sai → ghi lý do trong `progress.md` rồi mới sửa.
10. Làm trên nhánh `feature/<tên>` → Pull Request vào `main`. Không push thẳng `main`.
11. Tiếng Việt cho giao diện và tài liệu; tên biến, hàm, API bằng tiếng Anh.

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
| `SafeSpace-Customer-UI/SafeSpace-Customer-UI/` | React 19 + Vite: khách hàng + quản trị |
| `…/src/state/reducer.js` | Nghiệp vụ phía giao diện (hàm thuần, có test) |
| `…/src/state/store.jsx` | Phiên đăng nhập, 2 chế độ: API / lưu trình duyệt |
| `…/src/api/` | Gọi API + `mappers.js` chuyển dữ liệu backend → giao diện |
| `…/BE-CONTRACT.md` | Endpoint giao diện cần backend bổ sung |
| `…/CUSTOMER-FLOW-COVERAGE.md`, `ADMIN-FLOW-COVERAGE.md` | Đối chiếu màn Figma ↔ route ↔ component ↔ API |

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
dotnet run --project StorageProject.Api --launch-profile http     # API: http://localhost:5151
cd SafeSpace-Customer-UI/SafeSpace-Customer-UI && npm run dev     # UI:  http://127.0.0.1:5173
```

Cần: .NET SDK 10 (project đặt `net10.0`), Node ≥ 22.12, SQL Server (mặc định `.\SQLEXPRESS`).
Tài khoản seed: `customer01`/`Customer@123`, `staff01`/`Staff@123`, `admin`/`Admin@123`.
Không có backend: tạo `.env.local` với `VITE_USE_API=false`.

## 6. Vòng đời một phiên làm việc

**Bắt đầu**
1. Đọc `AGENTS.md` (file này).
2. Chạy `./init.sh` (hoặc `./init.ps1`). Nếu fail → sửa môi trường trước, KHÔNG code tính năng.
3. Đọc `progress.md` — phiên trước làm gì, dừng ở đâu.
4. Đọc `feature_list.json` — chọn tính năng `active`; nếu không có, chọn `not_started` đầu tiên
   có `depends_on` đã `passing`. Tính năng `blocked` chỉ làm khi đã gỡ được lý do chặn.
5. `git log --oneline -10` để xem thay đổi gần đây.

**Làm việc**
6. Đổi `state` tính năng đó sang `active`.
7. Chỉ sửa những file cần cho tính năng đó.
8. Chạy lệnh `verification` của tính năng; fail → sửa → chạy lại.

**Kết thúc**
9. Chạy lại `./init.sh` — toàn bộ phải pass.
10. Cập nhật `feature_list.json` (`state`, `evidence`) và thêm một mục vào `progress.md`.
11. Có quyết định kỹ thuật mới → thêm vào `DECISIONS.md`.
12. Commit rõ ràng (`feat(F05): …`). Chỉ commit khi repo ở trạng thái chạy được.

## 7. Checklist trước khi nói "xong"

- [ ] `npm test` pass (thư mục frontend)
- [ ] `npm run test:render` pass
- [ ] `npm run build` pass
- [ ] `dotnet build StorageProject.slnx` pass (khi có sửa backend)
- [ ] Lệnh `verification` riêng của tính năng pass
- [ ] Không còn `console.log`, `debugger`, TODO tạm, dữ liệu cứng để thử
- [ ] Không có chữ "demo"/"sample" mới trên giao diện
- [ ] Đã cập nhật `feature_list.json`, `progress.md` (và `DECISIONS.md` nếu có)
- [ ] Tài liệu liên quan (`BE-CONTRACT.md`, `*-FLOW-COVERAGE.md`) khớp với code

## 8. Khi bị kẹt

Ghi rõ vào `progress.md`: đang kẹt ở đâu, đã thử gì, cần ai quyết định. Đổi `state` thành `blocked`
kèm `blocked_reason`. Không đoán nghiệp vụ — nếu SRS, Figma và code mâu thuẫn, hỏi nhóm và ghi vào `DECISIONS.md`.

## 9. Nguồn tham khảo

Bộ tài liệu harness này được soạn theo hướng dẫn từ hai trang do thầy Hoàng giới thiệu ngày 25/09/2026:
- https://learnharness.org/#dinh-nghia — Harness Engineering: làm chủ AI coding agent
- https://skills.learnharness.org/ — bộ skill cho AI coding agent
