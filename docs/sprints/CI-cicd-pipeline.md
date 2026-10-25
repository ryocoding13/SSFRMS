# Sprint Contract: Triển khai CI/CD pipeline cho SafeSpace SSFRMS (CI01 – CI08)

> Căn cứ: `SSFRMS-CICD-IMPLEMENTATION-PLAN.md`, `AGENTS.md`.
> Baseline HEAD: commit `6d959aef4b54e4e9558e2db772fd1d50dda85c13` (Merge pull request #22 from ryocoding13/feat/d27-refund).

## 1. Mục tiêu
Thiết lập pipeline GitHub Actions tự động hóa:
- Kiểm thử và build toàn bộ PR và commit trên `main` (Frontend 4 suites, Backend build & 52 xUnit tests, Integration & Container smoke).
- Đóng gói container image đưa lên GHCR (API, Web Nginx, Migrator).
- Tự động triển khai Staging khi bật cờ cấu hình.
- Triển khai Production có kiểm soát (Manual dispatch release đã được kiểm chứng qua Staging, không rebuild image).
- Cung cấp runbook backup, health readiness và rollback an toàn (không hạ migration, forward-fix).

## 2. Nguồn yêu cầu
- `SSFRMS-CICD-IMPLEMENTATION-PLAN.md`
- `AGENTS.md` (Quy tắc 1: WIP = 1, Quy tắc 2: pass kiểm chứng, Quy tắc 7: không sửa migration cũ, Quy tắc 12: không tự push/PR/merge)
- `docs/architecture.md`, `docs/verification.md`, `docs/business-rules.md`

## 3. Danh sách task chi tiết (CI01 – CI08)
- **CI01:** Chốt baseline và cấu hình tái lập (`global.json`, `.config/dotnet-tools.json`, cập nhật `init.sh`/`init.ps1` đồng bộ 4 suite FE + BE, `docs/verification.md`).
- **CI02:** Workflow CI cho PR và main (`.github/workflows/ci.yml`, script chạy CI local, matrix job frontend/backend/ci-gate).
- **CI03:** Chuẩn hóa API cho deployment (loại bỏ secret theo dõi khỏi repo, `Database:AutoMigrate=false` ngoài Development, `Database:SeedMode`, endpoint `/health/ready`, proxy forwarded headers).
- **CI04:** Kiểm chứng SQL Server thật và API integration (SQL Server container tạm, chạy đủ migration chain, seed fixture, kiểm tra đăng nhập 5 nhóm vai trò và app lock / concurrency thanh toán).
- **CI05:** Container và smoke test bản đóng gói (`Dockerfile` API, `Dockerfile` Web Nginx, `deploy/migrator.Dockerfile`, `deploy/compose*.yml`, `deploy/nginx.conf`, `scripts/ci/smoke.sh`).
- **CI06:** Publish release và tự deploy staging (workflow push main -> build sha digest -> GHCR -> staging deploy script có backup database).
- **CI07:** Promotion production có kiểm soát (workflow `deploy-production.yml`, manual release selection, tái sử dụng digest, gate phê duyệt).
- **CI08:** Rollback, vận hành và bàn giao (`scripts/deploy/rollback.sh`, `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`).

## 4. Phạm vi được phép sửa
- Cấu hình runtime và build: `global.json`, `.config/dotnet-tools.json`, `dotnet-tools.json`, `init.sh`, `init.ps1`.
- Workflow CI/CD: thư mục `.github/workflows/`.
- Cấu hình deploy và container: thư mục `deploy/`, scripts CI/CD `scripts/`.
- Backend startup / health: `StorageProject.Api/Program.cs`, appsettings template, cấu hình logging/readiness.
- Tài liệu liên quan: `docs/verification.md`, `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, `progress.md`, `feature_list.json`, `DECISIONS.md`.

## 5. Ngoài phạm vi (TUYỆT ĐỐI KHÔNG LÀM)
- Không sửa logic nghiệp vụ thuê kho, giá cước, thanh toán PayOS, hoàn tiền D27, QR mở cửa hay logic UI.
- Không sửa 6 migration đã có trong Git history.
- Không thay đổi cấu trúc hai cấp thư mục Frontend (`SafeSpace-Customer-UI/SafeSpace-Customer-UI`).
- Không tạo cloud resource có phí (AWS, Azure, GCP, VPS có phí...).
- Không hardcode bí mật (JWT secret, PayOS key, database password) vào repo hay image.
- Không tự `git push`, tạo Pull Request hay merge lên remote repository.

## 6. Tiêu chí nghiệm thu phiên CI01
- [x] Baseline sạch: `dotnet build` 0 lỗi, `dotnet test` 52/52 PASS, Frontend `check:structure`, `test` (76/76), `test:business` (9/9), `test:render` (92/92), `build` PASS.
- [x] Tạo `global.json` pin .NET 10.0.100 với rollForward `latestFeature`.
- [x] Chuẩn hóa `.config/dotnet-tools.json` (dotnet-ef 10.0.12).
- [x] Bổ sung `npm run check:structure` và `npm run test:business` vào `init.sh` và `init.ps1`.
- [x] Cấp quyền thực thi `100755` cho `init.sh`.
- [x] Cập nhật `docs/verification.md` phản ánh chính xác số lượng test backend và frontend hiện có.
- [x] Cập nhật `feature_list.json` thêm CI01–CI08, chuyển trạng thái CI01 = active.
