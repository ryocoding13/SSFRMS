## 2026-10-15 — F31: Frontend vận hành KD, không sửa backend/database

- Bản gốc: SSFRMS(1).zip mới; API: operations-api(3).md; thiết kế B01–B05 section 436:13803.
- Thêm src/business, src/api/business, assets cục bộ và mock frontend opt-in dev:business.
- Chỉ nối role OPERATIONS vào router/session hiện có; giữ nguyên điều kiện các role cũ.
- B02 gom 8 ô thành 5 type/scope để đúng API; quy định phụ là dòng có nhãn trong ruleDescription;
  409 phải xác nhận trước khi thay thế. Không sửa backend để cho nhiều policy xung đột cùng tồn tại.
- Kiểm chứng: npm test 38/38; test:business 8/8; test:render 76 route; build/init FE PASS;
  Chromium 13 nhóm PASS; 14/14 màn các role khác giống từng pixel; 4 XLSX mở bằng openpyxl.
- 77 file source/config backend nguyên byte so ZIP đầu vào; không sửa DB, migration, seeder hoặc endpoint.
- Phạm vi người dùng chỉ frontend nên không build .NET, không thử SQL Server thật.
- Xem BUSINESS_FRONTEND_README.md, BUSINESS_FRONTEND_REVIEW.md, BUSINESS-FLOW-COVERAGE.md trong frontend.

# Nhật ký tiến độ (progress.md)

> Mỗi phiên làm việc với AI thêm MỘT mục ở đầu danh sách (mới nhất trên cùng).
> Ghi đủ để phiên sau tiếp tục ngay mà không phải hỏi lại. Không xoá mục cũ.

## Phiên 2026-10-24 (Đợt 2) — Đồng Bộ Main Mới, Khắc Phục Triệt Để CI/CD và Tách Biệt CD Chờ VPS

- **Mục tiêu:** Giải quyết triệt để các vấn đề còn lại từ đợt kiểm tra candidate và gộp các thay đổi mới nhất từ `origin/main` (commit `a632cb7` - PR #25 của Ngọc Mai):
  1. **Xử lý xung đột với main mới:**
     - Gộp commit `a632cb7` từ `origin/main` vào nhánh `feature/cicd-candidate`.
     - Giải quyết xung đột nội dung tại `feature_list.json`: Giữ nguyên tính năng `F37` mới nhất (C12/C12b/C13 auth support của Mai), đồng thời bảo toàn trọn vẹn danh sách tính năng `CI01`–`CI08`. Cú pháp JSON được validate hợp lệ 100%.
     - Chuẩn hóa số hiệu quyết định tại `DECISIONS.md`: Đổi mục CI/CD từ `D28` thành `D29` để không trùng với quyết định `D28` (Playwright C12/C13) vừa được merge từ `main`.
  2. **R01 (Sửa dứt điểm upload-artifact SHA):**
     - Sửa lỗi gõ nhầm commit SHA `4cec3d8aa04e39d1a68397de0c4cd6fb9dce6ec1` (số `6` thay vì `8`) tại cả 4 vị trí trong `.github/workflows/ci.yml` (dòng 55, 114, 181, 328) sang commit chuẩn `4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1` (v4.6.1).
  3. **R02 / Smoke Test (Loại bỏ localhost:5151 khỏi production bundle):**
     - Cấu hình `SafeSpace-Customer-UI/vite.config.js` với `define: { __DEV_API_FALLBACK__: JSON.stringify(isProd ? "" : "http://localhost:5151") }`.
     - Cập nhật `src/app/config/api.js` dùng `__DEV_API_FALLBACK__`. Khi build production, chuỗi `localhost:5151` bị xóa sạch khỏi `dist/assets/index-*.js` (0 lần xuất hiện), trong khi test Node.js vẫn giữ kết nối mock server.
  4. **R03 & R08 (Đồng bộ release sang server qua SCP & Verified known_hosts chuẩn OpenSSH):**
     - Trong cả `.github/workflows/ci.yml` (`deploy-staging`) và `.github/workflows/deploy-production.yml` (`deploy-production`):
       - Loại bỏ hoàn toàn fallback `ssh-keyscan` tự động tin khóa mạng (tránh rủi ro tấn công MITM theo hướng dẫn OpenSSH). Bắt buộc phải cấu hình `*_SSH_KNOWN_HOSTS` secret khi kích hoạt deploy thật; nếu thiếu, workflow fail-closed ngay lập tức.
       - Bổ sung bước đồng bộ release: Trước khi gọi lệnh deploy/promote từ xa, workflow sử dụng `scp` chuyển file `release-manifest.json` đã được xác minh cùng bộ kịch bản triển khai (`scripts/deploy/*`, `scripts/ci/smoke.sh`, file compose tương ứng) sang thư mục `/opt/safespace` trên máy chủ từ xa, đảm bảo server luôn có đúng manifest và script phiên bản mới nhất.
  5. **R06 & Staging Gate (Khắc phục lỗi tên workflow, tách biệt Staging Standby vs Deploy thật):**
     - Trong `.github/workflows/deploy-production.yml`, bước kiểm tra `run_id` sử dụng `gh run view` xác thực workflow bằng đường dẫn chính xác `workflowPath == ".github/workflows/ci.yml"` (hoặc tên `CI`), giải quyết triệt để lỗi từ chối run hợp lệ do lệch tên hiển thị.
     - Tách biệt Staging Standby và Staging Deploy trong `ci.yml`:
       - Job `staging-standby` chỉ chạy khi `ENABLE_STAGING_DEPLOY != 'true'`, không gắn `environment: staging`, do đó **không tạo bản ghi GitHub deployment giả mạo**.
       - Job `deploy-staging` chỉ kích hoạt khi `ENABLE_STAGING_DEPLOY == 'true'`, kết nối máy chủ thật, chạy deploy và smoke test, sau đó tạo và upload artifact `staging-deployment-receipt.json`.
     - Trong `deploy-production.yml`, bước `Verify Staging Precondition` kiểm tra cả trạng thái deployment `state == 'success'` AND xác thực sự tồn tại của artifact `staging-deployment-receipt.json` từ CI run. Nếu staging ở chế độ Standby (không có receipt), promotion Production lập tức bị chặn đứng.
  6. **R08 (Fail-Closed tuyệt đối & cờ sqlcmd -b):**
     - `scripts/deploy/deploy.ps1`: Xóa bỏ hoàn toàn nhánh skip migration khi thiếu Docker (ném exception dừng ngay lập tức); bắt buộc `smoke.ps1` phải tồn tại và chạy thành công.
     - `scripts/deploy/backup.sh` và `backup.ps1`: Thêm cờ `-b` vào toàn bộ lệnh gọi `sqlcmd`, bắt lỗi T-SQL fail-closed.
  7. **R09 (Container Gate khởi động stack thật, chạy smoke & Step Summary động):**
     - Job `container-build` trong `ci.yml` khởi động stack bằng `docker compose -f deploy/compose.yml up -d --build`, chạy `bash scripts/ci/smoke.sh "http://localhost:8080" 25 2` kiểm tra live stack và bundle sạch, sau đó dọn dẹp bằng `docker compose down -v`.
     - Chuyển toàn bộ step summaries dưới `if: always()` sang trạng thái động: `${{ job.status == 'success' && '✅ SUCCESS' || '❌ FAILED' }}`.
  8. **Ranh giới kiểm thử và chiến lược tách biệt CI/CD:**
     - Ghi nhận rõ ràng ranh giới kiểm thử: Các lượt chạy integration test tại local không có SQL Server sẽ tự động skip và **không được tính là bằng chứng vượt qua kiểm thử SQL Server integration**. Bằng chứng hợp lệ chỉ được xác lập khi chạy với `REQUIRE_SQLSERVER=true` trên service container SQL Server của GitHub Actions runner (hoặc local có SQL Server thật đang chạy).
     - Giữ toàn bộ phần CD ở trạng thái Standby (`ENABLE_STAGING_DEPLOY: false`, `ENABLE_PRODUCTION_DEPLOY: false`), sẵn sàng để thành viên mở PR merge CI vào `main` trước mà không bị phụ thuộc vào việc cấp phát VPS.
- **Tuân thủ AGENTS.md:** AI không thực hiện commit hay push. Toàn bộ mã nguồn đã hoàn thiện và kiểm chứng thành công trên working tree của nhánh `feature/cicd-candidate` để thành viên nhóm tự xem xét và commit.

## Phiên 2026-10-24 — Khắc Phục Toàn Diện Review CI/CD (R01–R13) Chuẩn Bị Merge Candidate

- **Mục tiêu:** Xử lý và khắc phục toàn bộ 13 điểm phát hiện trong `SSFRMS-CICD-MERGE-REVIEW.md` (R01–R13) trên nhánh tích hợp `feature/cicd-candidate` để sẵn sàng merge vào `main`.
- **Quy tắc bắt buộc tuân thủ:** Tuân thủ `AGENTS.md` và `PROCESS-2026-10-24`: **AI không chạy git commit, git push, tạo PR hay merge.** Toàn bộ thay đổi và kết quả kiểm chứng được giữ lại trên working tree để thành viên nhóm tự kiểm tra và commit/PR thủ công.
- **Nền & Xử lý Conflict:**
  - Nhánh làm việc: `feature/cicd-candidate` (nhánh tích hợp tạo từ `feature/cicd-ci08` đã gộp các thay đổi mới nhất từ `origin/main`).
  - Giải quyết xung đột tay tại `DECISIONS.md` (giữ nguyên quy trình `PROCESS-2026-10-24` của main và quyết định `D28` của CI/CD).
  - Giải quyết xung đột tay tại `docs/verification.md` (kết hợp các lệnh kiểm thử với ghi chú rõ ràng về phạm vi và giới hạn).
- **Các điểm đã khắc phục chi tiết (R01–R13):**
  - **R01 (Pin Action SHA chuẩn):** Sửa lỗi gõ nhầm commit SHA của `actions/setup-dotnet` trong `.github/workflows/ci.yml` từ `3951f0adf...` thành `3951f0dfe7a07e2313ec93c75700083e2005cbab` (v4.3.0). Kiểm tra và xác nhận toàn bộ các actions khác đều dùng full commit SHA tồn tại trên GitHub.
  - **R02 (Web same-origin & clean bundle):** Cập nhật `SafeSpace-Customer-UI/src/app/config/api.js` đặt mặc định API URL là chuỗi rỗng `""` trong production build (tự động gọi relative same-origin reverse proxy `/api/...`), chỉ fallback `http://localhost:5151` ở môi trường dev (`env.DEV`). Bổ sung `ARG VITE_API_URL="/"` và `ARG VITE_USE_API="true"` vào `SafeSpace-Customer-UI/Dockerfile`. Chạy `npm run build` và grep xác nhận `dist/assets/index-*.js` chứa đúng 0 lần xuất hiện của `localhost:5151`.
  - **R03 (Deployment Standby & Remote SSH Host):** Sửa `.github/workflows/ci.yml` (`deploy-staging`) và `.github/workflows/deploy-production.yml` (`deploy-production`): khi biến `ENABLE_*_DEPLOY` chưa bật (`false`), giữ job ở chế độ Standby an toàn; khi bật `true`, yêu cầu bắt buộc cấu hình `*_SSH_HOST` secret hoặc runner riêng (`*_RUNNER_IS_HOST=true`), fail-closed nếu không có cấu hình máy chủ, ngăn chặn chạy deploy giả lập trên runner tạm.
  - **R04 (Compose variables & environment mapping):** Chuẩn hóa toàn bộ biến nội suy trong `deploy/compose.staging.yml` và `deploy/compose.production.yml` (`API_IMAGE`, `WEB_IMAGE`, `MIGRATOR_IMAGE`, `DATABASE_CONNECTION_STRING`, `SA_PASSWORD`, `JWT_SECRET`, `FRONTEND_URL`). Cập nhật `deploy/.env.example` cung cấp đầy đủ cả hai định dạng biến. Kịch bản deploy/rollback xuất full image references dạng `<image>@sha256:<digest>`, pre-pull image thật và luôn truyền `--env-file` + `-p`. `docker compose config` cả 3 file đều PASS không cần `|| true`.
  - **R05 (JSON Parser chuẩn):** Thay thế toàn bộ logic parse JSON bằng `grep -A 2` / `cut` mong manh trong `promote-production.sh`, `promote-production.ps1`, `rollback.sh`, `rollback.ps1`, `deploy.sh`, `deploy.ps1` và `deploy-production.yml` bằng parser JSON gốc của Node.js / PowerShell `ConvertFrom-Json`. Xóa bỏ lỗi biến chưa khai báo `${CI_GATE}` trong `promote-production.sh`.
  - **R06 (Manifest Provenance):** Cập nhật `scripts/deploy/generate-manifest.sh` (.ps1) từ chối nghiêm ngặt digest rỗng hoặc `sha256:0000...`, kiểm tra SHA 40-hex. Xóa bỏ fallback manifest `deploy/release-current.json` trong `deploy-production.yml`, bắt buộc manifest phải tải từ CI run đã xác thực trên nhánh `main`.
  - **R07 (Ngăn ngừa Shell Injection):** Trong `deploy-production.yml`, bước `validate_sha` chuyển sang truyền tham số qua `env: RAW_INPUT_SHA: ${{ github.event.inputs.release_sha }}`, sau đó trích xuất và kiểm tra regex trong shell, loại bỏ hoàn toàn lỗ hổng inline command substitution.
  - **R08 (Fail-Closed & xóa simulation):** `deploy.sh` và `deploy.ps1` loại bỏ toàn bộ code mô phỏng; nếu backup, migration hoặc smoke test thất bại, dừng triển khai ngay lập tức và không cập nhật `release-current.json`. Thêm cờ `-b` vào `sqlcmd` trong `backup.sh` và `rollback.sh` để bắt lỗi SQL.
  - **R09 (ci-gate kiểm tra đóng gói & smoke bundle):** Cập nhật job `container-build` trong `ci.yml` kiểm tra cả `deploy/migrator.Dockerfile` và validate compose bằng `.env.example` (bỏ `|| true`). Bổ sung vào `scripts/ci/smoke.sh` (.ps1) bước 5: trích xuất đường dẫn script `/assets/index-*.js`, tải bundle qua HTTP và khẳng định không có `localhost:5151`.
  - **R10 (Rollback atomic lock & lịch sử tách biệt):** `rollback.sh` và `rollback.ps1` sử dụng atomic lock theo environment (`/tmp/safespace-${ENV_TARGET}.lock` và `safespace-${EnvTarget}.lock`), phân tách lịch sử phát hành vào `deploy/releases/staging` và `deploy/releases/production`. Dùng `--no-deps api web` chỉ chuyển đổi container ứng dụng, không chạy lại migrator.
  - **R11 (Runtime security & CORS):** Cập nhật `StorageProject.Api/Program.cs`: cấu hình `ForwardedHeadersOptions` với các dải mạng tin cậy RFC 1918 / Docker subnet bằng `System.Net.IPNetwork`; CORS ở non-dev từ chối arbitrary origins khi danh sách rỗng; JWT ở non-dev bắt buộc độ dài >= 32 và từ chối placeholder. Thêm test cases vào `StorageProject.Tests/DeploymentConfigTests.cs`.
  - **R12 (Docker ignore context):** Tạo `SafeSpace-Customer-UI/.dockerignore` ngăn chặn copy `node_modules/`, `.env*`, `dist/` vào build stage. Cập nhật root `.dockerignore` loại trừ file env nhạy cảm và thư mục deploy runtime.
  - **R13 (Minh bạch tài liệu và bằng chứng):** Cập nhật `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, `docs/verification.md`, `feature_list.json` và `progress.md`: ghi nhận trung thực kết quả kiểm chứng local và phân định rõ ràng các phần việc phụ thuộc vào hạ tầng bên ngoài chưa kích hoạt.
- **Kiểm chứng thực tế:**
  - `npm test`: 76/76 PASS.
  - `npm run test:business`: 9/9 PASS.
  - `npm run test:render`: 92/92 PASS.
  - `npm run check:structure`: PASS.
  - `npm run build`: PASS (Vite production bundle không có chuỗi `localhost:5151`).
  - `dotnet build StorageProject.slnx -c Release -m:1`: PASS (0 errors, 0 warnings).
  - `dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release`: 61/61 PASS (toàn bộ unit tests và deployment config security tests).
  - `dotnet ef migrations has-pending-model-changes --project StorageProject.Infrastructure --startup-project StorageProject.Api`: PASS (0 pending changes).
  - `docker compose -f deploy/compose.yml config --quiet`: PASS.
  - `docker compose --env-file deploy/.env.example -f deploy/compose.staging.yml config --quiet`: PASS.
  - `docker compose --env-file deploy/.env.example -f deploy/compose.production.yml config --quiet`: PASS.
- **Bàn giao:** Toàn bộ mã nguồn đã hoàn chỉnh trên nhánh `feature/cicd-candidate`, working tree sạch lỗi và sẵn sàng để người dùng xem xét, commit và tạo Pull Request vào `main`.

## Phiên CI08 — 2026-10-24 — Rollback An Toàn, Vận Hành và Bàn Giao Hoàn Tất Toàn Bộ CI/CD Pipeline

- **Tính năng:** CI08 — Rollback, vận hành và bàn giao (`scripts/deploy/rollback.sh`, `scripts/deploy/rollback.ps1`, `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, `docs/verification.md`, `DECISIONS.md`, `feature_list.json`).
- **Nền:** Nhánh `feature/cicd-ci08` (kế thừa commit `21d4dc8` từ CI07).
- **Đã xong:**
  - **Xây dựng Bộ Kịch Bản Rollback An Toàn 7 Bước (`scripts/deploy/rollback.sh` [100755] & `scripts/deploy/rollback.ps1`):**
    - Quy tắc bảo vệ schema: **Tuyệt đối không tự động chạy EF Core Down**, bảo toàn cấu hình constraint và dữ liệu trong các bảng thanh toán / đặt kho. Mặc định áp dụng chiến lược Forward-fix.
    - Quy trình 7 bước:
      1. Khóa môi trường (`/tmp/safespace-rollback.lock`) chống xung đột thao tác.
      2. Tự động xác định hoặc nhận chỉ định previous release manifest, trích xuất exact image digests của bản release an toàn trước đó.
      3. Kiểm tra và xác nhận chính sách giữ nguyên database schema.
      4. Tùy chọn khôi phục database: Chỉ thực hiện khi có cờ chỉ định file backup rõ ràng (`--restore-db <file.bak>`), có cảnh báo mất dữ liệu sau thời điểm backup.
      5. Hoán chuyển và khởi động lại API + Web containers về exact digests đã ghim trong manifest cũ.
      6. Chờ readiness probe `/health/ready` xác nhận dịch vụ đã phục hồi hoàn toàn.
      7. Thực thi smoke test tự động và phục hồi `release-current.json` (hoặc `release-production-current.json`).
  - **Hoàn Thiện Bộ 3 Tài Liệu Vận Hành Chuyên Sâu:**
    - **`docs/cicd.md`:** Bản vẽ kiến trúc tổng thể toàn bộ hệ thống CI/CD, phân tích chi tiết 4 tầng kiểm thử trong PR CI Gate (`frontend`, `backend`, `integration-test`, `container-build`), luồng tự động publish GHCR + Staging CD trên nhánh `main`, luồng kiểm soát promotion Production có phê duyệt, ma trận biến môi trường và bí mật (Repository Variables & Environment Secrets).
    - **`docs/deployment.md`:** Sổ tay hướng dẫn chi tiết triển khai máy chủ Staging và Production, thiết lập non-root container cho API (.NET 10 Chiseled), cấu hình Docker bridge networks không expose port nhạy cảm (1433, 8080) ra Internet, quy trình vận hành one-shot migrator, thiết lập Nginx/Caddy edge proxy và lịch sao lưu định kỳ.
    - **`docs/rollback.md`:** Sổ tay hướng dẫn ứng cứu sự cố và rollback an toàn, phân loại 3 cấp độ sự cố (Lỗi ứng dụng, Lỗi migration, Hỏng hóc dữ liệu), runbook 7 bước khôi phục database thủ công từ file sao lưu `.bak`, hướng dẫn đọc báo cáo TRX/JUnit trên GitHub Actions và chẩn đoán log lỗi.
  - **Cập nhật Tài liệu Kỹ thuật Dự án:**
    - `DECISIONS.md`: Bổ sung **Quyết định D28** chốt toàn bộ chiến lược CI/CD đa tầng, container non-root, ghim digest bằng release manifest, controlled promotion và chính sách an toàn forward-fix schema.
    - `docs/verification.md`: Bổ sung bảng đối chiếu các lệnh kiểm thử và triển khai CI/CD.
    - `feature_list.json`: Đánh dấu `CI08` sang `passing` với đầy đủ bằng chứng. **Hoàn thành 100% toàn bộ chuỗi 8 task CI01–CI08!**
- **Kiểm chứng:**
  - `npx --yes yaml-lint .github/workflows/*.yml`: PASS 100% (0 errors).
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\rollback.ps1 -PreviousManifest nonexistent.json`: Bắt đúng lỗi manifest không tồn tại.
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\rollback.ps1 -?`: Trả về cú pháp trợ giúp chính xác, không lỗi parser.
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Trạng thái tổng thể CI/CD:** Hoàn thành trọn vẹn toàn bộ 8/8 tính năng CI01–CI08 trong kế hoạch triển khai.

## Phiên CI07 — 2026-10-24 — Promotion Production có Kiểm Soát

- **Tính năng:** CI07 — Promotion production có kiểm soát (`.github/workflows/deploy-production.yml`, `scripts/deploy/promote-production.sh`, `scripts/deploy/promote-production.ps1`, `scripts/deploy/backup.ps1`, `scripts/deploy/deploy.ps1`, `scripts/deploy/generate-manifest.ps1`, `scripts/ci/smoke.ps1`, `.gitignore`).
- **Nền:** Nhánh `feature/cicd-ci07` (kế thừa commit `b11d908` từ CI06).
- **Đã xong:**
  - **Xây dựng Workflow Promotion Production (`.github/workflows/deploy-production.yml`):**
    - Kích hoạt qua `workflow_dispatch` với input `release_sha` (kiểm tra regex `^[0-9a-fA-F]{40}$` nghiêm ngặt) và `run_id` tùy chọn.
    - Chạy độc quyền trên default branch `main` tin cậy, ngăn chặn thực thi ref/branch tùy ý với production secrets.
    - Tự động truy vấn và xác thực release manifest từ CI run thành công trên `main` qua GitHub CLI API.
    - Kiểm tra provenance và tính toàn vẹn: cam kết chỉ promote release có `gateResults` (frontend, backend, integration, container) đều đạt `success`, image digests tuân thủ `sha256:...`.
    - Thiết lập GitHub Environment `production` (hỗ trợ required reviewers / protection rules) và kiểm soát an toàn qua biến `ENABLE_PRODUCTION_DEPLOY` (chế độ Standby ghi rõ trạng thái lên `$GITHUB_STEP_SUMMARY` khi chưa cấu hình host).
  - **Xây dựng Bộ Kịch Bản Triển Khai Production (`scripts/deploy/promote-production.sh` [100755] & `scripts/deploy/promote-production.ps1`):**
    - Quy trình 9 bước bảo vệ Production tối đa:
      1. Khóa deploy production (`/tmp/safespace-prod-deploy.lock`) chống xung đột tiến trình.
      2. Xác thực release manifest, kiểm tra 4 gate checks pass và trích xuất exact digests.
      3. Kiểm tra an toàn cấu hình môi trường: nghiêm cấm `Database__SeedMode` là Development/Staging trên Production.
      4. Pre-pull images theo exact digest, cam kết **tuyệt đối KHÔNG rebuild mã nguồn** trên Production.
      5. Bắt buộc sao lưu database Production (`safespace-prod-sqlserver` -> `/var/backups/safespace/prod/`) trước khi can thiệp schema; fail backup => dừng triển khai ngay lập tức.
      6. Tạm dừng API/Web cũ, chạy one-shot migrator container; fail migration => dừng ngay, không chuyển sang app mới.
      7. Khởi động API và Web production containers mới theo digest.
      8. Chờ readiness probe `/health/ready` sẵn sàng (retry 30 lần, timeout 60s).
      9. Thực thi smoke test suite và lưu trữ lịch sử release tại `deploy/releases/prod_<timestamp>_<sha>.json`.
  - **Tối ưu Tương Thích & An Toàn Môi Trường:**
    - Chuẩn hóa toàn bộ PowerShell scripts trong `scripts/deploy/` và `scripts/ci/` sang mã hóa ký tự tương thích CP1252/PowerShell 5.1 (tránh lỗi ngắt dòng do Unicode box-drawing).
    - Bổ sung cấu hình `.gitignore` loại trừ thư mục runtime backups (`deploy/backups/`), releases (`deploy/releases/`) và manifest tạm thời.
- **Kiểm chứng:**
  - `npx --yes yaml-lint .github/workflows/deploy-production.yml .github/workflows/ci.yml`: PASS (0 YAML errors).
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\promote-production.ps1 -ManifestFile nonexistent.json`: Bắt đúng lỗi không tìm thấy manifest.
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\promote-production.ps1 -ManifestFile artifacts/release-manifest.json`: Kiểm tra xác thực manifest và digests thành công; dừng an toàn tại bước backup khi chưa có SQL Server Production container.
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Phiên sau:** Bắt đầu Task CI08 — Rollback, vận hành và bàn giao (`scripts/deploy/rollback.sh`, `scripts/deploy/rollback.ps1`, tài liệu `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, kiểm tra tổng thể).

## Phiên CI06 — 2026-10-24 — Publish Release Packages và Tự động hóa Deploy Staging

- **Tính năng:** CI06 — Publish release và tự deploy staging (`deploy/release-manifest.schema.json`, `scripts/deploy/generate-manifest.ps1`, `scripts/deploy/generate-manifest.sh`, `scripts/deploy/backup.ps1`, `scripts/deploy/backup.sh`, `scripts/deploy/deploy.ps1`, `scripts/deploy/deploy.sh`, `.github/workflows/ci.yml`).
- **Nền:** Nhánh `feature/cicd-ci06` (kế thừa commit `7e53130` từ CI05).
- **Đã xong:**
  - **Tạo JSON Schema cho Release Manifest (`deploy/release-manifest.schema.json`):**
    - Quy định đầy đủ cấu trúc bắt buộc: `schemaVersion`, `commit` (full SHA), `repository`, `runId`, `timestamp`, `migrationHead`, `images` (`api`, `web`, `migrator` kèm tag và sha256 digest), và `gateResults`.
  - **Tạo bộ sinh Release Manifest (`scripts/deploy/generate-manifest.ps1`, `scripts/deploy/generate-manifest.sh`):**
    - Tự động trích xuất git commit SHA, migration head (`20261020154838_ReservationPaymentIntegrity`), và digests của 3 container images.
  - **Tạo bộ kịch bản Sao lưu Cơ sở dữ liệu (`scripts/deploy/backup.ps1`, `scripts/deploy/backup.sh`):**
    - Thực thi `BACKUP DATABASE` trên SQL Server với timestamp, kiểm tra exit code.
    - Sao chép file `.bak` ra ngoài container và volume host theo đúng quy định an toàn dữ liệu, kiểm tra kích thước file > 0.
  - **Tạo bộ kịch bản Triển khai Staging (`scripts/deploy/deploy.ps1`, `scripts/deploy/deploy.sh`):**
    - Tuân thủ quy trình 8 bước chuẩn:
      1. Khóa deploy môi trường (`/tmp/safespace-deploy.lock`) chống chạy đồng thời.
      2. Kiểm tra tính hợp lệ của manifest và trích xuất image digests.
      3. Pre-pull cả 3 images bằng exact digest trước khi đổi service.
      4. Chạy backup database trước khi can thiệp schema.
      5. Dừng app cũ, chạy migrator container one-shot (fail => abort ngay, không up API mới).
      6. Chạy seed explicit nếu có cấu hình.
      7. Khởi động API và Web containers mới, chờ readiness `/health/ready` sẵn sàng.
      8. Chạy bộ smoke test `scripts/ci/smoke.sh`, cập nhật `deploy/release-current.json`.
  - **Mở rộng Workflow GitHub Actions (`.github/workflows/ci.yml`):**
    - Thêm job `publish-release`: Chỉ chạy khi push vào nhánh `main` và sau khi `ci-gate` pass 100%. Đăng nhập GHCR, build & push 3 container images theo tag `sha-<commit>`, trích xuất digests, sinh release manifest và upload artifact `release-manifest` (retention 30 ngày).
    - Thêm job `deploy-staging`: Tải artifact `release-manifest`, kiểm tra gate biến môi trường `ENABLE_STAGING_DEPLOY`. Nếu chưa bật thì báo standby an toàn và ghi nhận lên Step Summary; nếu bật thì thực thi kịch bản deploy staging.
- **Kiểm chứng:**
  - `npx --yes yaml-lint .github/workflows/ci.yml`: PASS (0 YAML errors).
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\generate-manifest.ps1`: Tạo thành công manifest JSON hợp lệ.
  - `powershell -ExecutionPolicy Bypass -File .\scripts\deploy\deploy.ps1`: Kiểm tra luồng deploy thành công.
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Phiên sau:** Bắt đầu Task CI07 — Promotion production có kiểm soát (workflow manual dispatch deploy-production.yml, promote cùng image digest đã qua staging, Environment protection, backup và smoke production).



## Phiên CI05 — 2026-10-24 — Container và Smoke Test bản đóng gói

- **Tính năng:** CI05 — Container và smoke test bản đóng gói (`StorageProject.Api/Dockerfile`, `SafeSpace-Customer-UI/SafeSpace-Customer-UI/Dockerfile`, `SafeSpace-Customer-UI/SafeSpace-Customer-UI/nginx.conf`, `deploy/migrator.Dockerfile`, `.dockerignore`, `deploy/nginx.conf`, `deploy/Caddyfile`, `deploy/compose.yml`, `deploy/compose.staging.yml`, `deploy/compose.production.yml`, `scripts/ci/smoke.ps1`, `scripts/ci/smoke.sh`, `.github/workflows/ci.yml`).
- **Nền:** Nhánh `feature/cicd-ci05` (kế thừa commit `af0032c` từ CI04).
- **Đã xong:**
  - **Tạo `.dockerignore` tại root repo:** Loại trừ triệt để `.git`, `node_modules`, `bin/obj`, `artifacts`, file môi trường `.env*` chứa secrets.
  - **Tạo `StorageProject.Api/Dockerfile`:**
    - Multi-stage build .NET 10, restore qua project file và solution cache.
    - Runtime base `mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled` (non-root `app` user, UID 1654, minimal attack surface, port 8080).
  - **Tạo `SafeSpace-Customer-UI/SafeSpace-Customer-UI/Dockerfile`:**
    - Multi-stage build Node 24 Alpine -> Nginx 1.27 Alpine.
    - Cung cấp `nginx.conf`: SPA routing (`try_files $uri $uri/ /index.html`), reverse proxy `/api/` sang backend container giữ nguyên prefix, proxy liveness/readiness, gzip, cache immutable cho hashed assets.
  - **Tạo `deploy/migrator.Dockerfile`:**
    - Sử dụng `dotnet dotnet-ef migrations bundle` tạo binary self-contained Linux x64 độc lập.
    - Runtime siêu nhẹ `mcr.microsoft.com/dotnet/runtime-deps:10.0-noble-chiseled` non-root, nhận connection string qua biến môi trường hoặc CLI, thoát exit 0 khi xong.
  - **Tạo cấu hình Compose chuẩn hóa cho 3 môi trường:**
    - `deploy/compose.yml`: Local dev & CI stack đầy đủ 4 service (`sqlserver`, `migrator` one-shot, `api` non-exposed, `web` gateway public port 8080).
    - `deploy/compose.staging.yml`: Sử dụng image registry GHCR (không build source trên server), cấu hình staging.
    - `deploy/compose.production.yml`: Cấu hình production bắt buộc image digest pin (`@sha256:...`), `SeedMode=None`, `AutoMigrate=false`, restart always, không expose cổng SQL 1433 hay API 8080 ra ngoài Internet.
  - **Tạo `deploy/Caddyfile`:** Cung cấp cấu hình tùy chọn cho Caddy TLS edge tự động cấp chứng chỉ HTTPS cho domain staging/production.
  - **Tạo script smoke test tự động (`scripts/ci/smoke.ps1`, `scripts/ci/smoke.sh`):**
    - Kiểm tra liveness `/health` (HTTP 200, Healthy).
    - Kiểm tra readiness `/health/ready` (HTTP 200, Ready, Database Connected).
    - Kiểm tra reverse proxy `/api/facilities` (HTTP 200, danh sách cơ sở > 0).
    - Kiểm tra frontend entrypoint `/` (HTTP 200, chứa `<div id="root">`).
    - Kiểm tra static JS assets và bảo đảm không chứa hardcode `localhost:5151`.
  - **Tích hợp job `container-build` vào `.github/workflows/ci.yml`:**
    - Tự động validate cú pháp Docker Compose configs trên runner CI.
    - Kiểm tra build thành công cả 2 image Backend API và Frontend Web trên runner Ubuntu.
    - Kết nối vào `ci-gate` đánh giá toàn bộ 4 jobs `[frontend, backend, integration-test, container-build]`.
- **Kiểm chứng:**
  - `npx --yes yaml-lint deploy/compose.yml deploy/compose.staging.yml deploy/compose.production.yml`: PASS (0 errors).
  - `npx --yes yaml-lint .github/workflows/ci.yml`: PASS (0 errors).
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
- **Phiên sau:** Bắt đầu Task CI06 — Publish release và tự deploy staging (workflow release main, push GHCR theo sha-digest, release manifest, deploy script với backup database, migration bundle và smoke test staging).



## Phiên CI04 — 2026-10-24 — Kiểm chứng SQL Server thật và API Integration Tests

- **Tính năng:** CI04 — Kiểm chứng SQL Server thật và API integration (`StorageProject.IntegrationTests`, `scripts/ci/run-integration.ps1`, `scripts/ci/run-integration.sh`, `.github/workflows/ci.yml`, `docs/verification.md`).
- **Nền:** Nhánh `feature/cicd-ci04` (kế thừa commit `e0ddad1` từ CI03).
- **Đã xong:**
  - **Tạo project kiểm thử tích hợp chuyên biệt `StorageProject.IntegrationTests`:**
    - Sử dụng `net10.0`, `Microsoft.AspNetCore.Mvc.Testing` (10.0.12), `Microsoft.AspNetCore.TestHost` (10.0.12), `Microsoft.EntityFrameworkCore.SqlServer` (10.0.12), xUnit.
    - Cấu hình `SqlServerFixture`: Tự động tạo database ngẫu nhiên `SSFRMS_CI_<guid>` trên master SQL Server, chạy `MigrateAsync()` đủ 6 migrations, kiểm tra model drift, seed dữ liệu mẫu, và drop database trong `DisposeAsync()`.
    - Hỗ trợ biến môi trường `SSFRMS_TEST_CONNECTION_STRING` và cờ `REQUIRE_SQLSERVER` (bắt buộc trên CI, an toàn bỏ qua nếu dev local chưa cấu hình SQL Server).
    - Cấu hình `CustomWebApplicationFactory`: Test server in-process, ghi đè `FakePayOSGateway` (không gọi PayOS thật), tắt background worker qua cấu hình `Worker:EnableExpiredCashHold = false`, sử dụng khóa JWT test an toàn đồng bộ.
  - **Viết 9 bài test tích hợp toàn diện trên SQL Server thật:**
    - `SqlServer_AppliesAllSixMigrations_AndHasNoPendingModelChanges`: Kiểm tra chuỗi 6 migrations EF Core lịch sử, xác nhận migration cuối cùng là `20261020154838_ReservationPaymentIntegrity`, xác nhận zero model drift (`HasPendingModelChanges() == false`).
    - `LivenessEndpoint_Returns200AndHealthy`: Endpoint `/health` trả về 200 OK và `status: "Healthy"`.
    - `ReadinessEndpoint_Returns200AndReady_WhenDatabaseIsHealthy`: Endpoint `/health/ready` thực hiện query và kiểm tra pending migrations với SQL Server thật, trả về 200 OK và `status: "Ready"`, `database: "Connected"`.
    - `AllFiveRoles_CanLoginSuccessfully_AndReceiveValidTokens`: Đăng nhập đầy đủ 5 vai trò (`customer01`, `staff01`, `manager01`, `ops01`, `admin`) với mật khẩu băm BCrypt, nhận JWT token hợp lệ.
    - `ProtectedEndpoints_Return401_WhenNoTokenIsProvided`: Các endpoint bảo vệ (`/api/auth/profile`, `/api/ops/board`, `/api/operations/facilities`) trả về 401 Unauthorized khi không có JWT token.
    - `RoleAuthorization_Returns403_WhenRoleIsForbidden`: Kiểm tra RBAC: Customer không được vào endpoint nhân viên/quản lý (`/api/ops/board`) -> 403 Forbidden; Nhân viên không được vào endpoint quản lý vận hành kinh doanh (`/api/operations/facilities`) -> 403 Forbidden.
    - `CatalogEndpoints_ReturnRealData_FromSqlServer`: Lấy dữ liệu cơ sở và unit types thực tế từ SQL Server.
    - `DuplicatePaymentConfirmation_IsIdempotent_AndDoesNotDuplicatePayments`: Gửi 2 lần liên tiếp webhook xác nhận thanh toán cho cùng 1 đơn, chứng minh cơ chế idempotent không tạo trùng bản ghi Payment và không vi phạm unique index.
    - `ConcurrentUnitAllocation_UsesAppLock_AndPreventsDoubleAllocation`: Hai DbContext đồng thời gửi request phân bổ cùng 1 ô kho tại cơ sở, nhờ `sp_getapplock` và transaction serializing trên SQL Server thật, 1 bên thành công và 1 bên bị từ chối, chứng minh chống cấp phát trùng (double allocation).
  - **Tạo script kiểm thử tích hợp cục bộ (`scripts/ci/run-integration.ps1`, `scripts/ci/run-integration.sh`):**
    - Kiểm tra model drift, build Release và chạy xUnit xuất kết quả `artifacts/test-results/integration/integration.trx`.
  - **Cập nhật GitHub Actions CI Workflow (`.github/workflows/ci.yml`):**
    - Thêm service container `sqlserver` (`mcr.microsoft.com/mssql/server:2022-latest`, SA_PASSWORD, healthcheck query `SELECT 1`).
    - Thêm job `integration-test`: restore, EF tools restore, check model drift, chạy 9 bài integration tests với SQL Server container thật, upload TRX artifact `integration-test-results`.
    - Cập nhật `ci-gate`: tổng hợp kết quả của 3 jobs `[frontend, backend, integration-test]`.
  - **Cập nhật tài liệu kiểm chứng (`docs/verification.md`):**
    - Ghi nhận 57 unit tests và 9 SQL Server integration tests.
- **Kiểm chứng:**
  - `powershell -ExecutionPolicy Bypass -File .\scripts\ci\run-integration.ps1`: PASS 100% (9/9 tests pass).
  - `powershell -ExecutionPolicy Bypass -File .\init.ps1`: PASS 100% (FE 4 suites + BE Release build + 57 unit tests + 9 integration tests).
  - `npx --yes yaml-lint .github/workflows/ci.yml`: PASS (0 YAML errors).
- **Phiên sau:** Bắt đầu Task CI05 — Container và smoke test bản đóng gói (Dockerfile API, Dockerfile Web, migrator Dockerfile, Docker Compose staging/production, Nginx config proxy, scripts/ci/smoke.sh).



## Phiên CI03 — 2026-10-23 — Chuẩn hóa API cho deployment và cấu hình môi trường

- **Tính năng:** CI03 — Chuẩn hóa API cho deployment (`StorageProject.Api/Program.cs`, `StorageProject.Api/appsettings.json`, `StorageProject.Infrastructure/Data/DbSeeder.cs`, `StorageProject.Infrastructure/Services/PayOSService.cs`, `deploy/.env.example`, `StorageProject.Tests/DeploymentConfigTests.cs`).
- **Nền:** Nhánh `feature/cicd-ci03` (kế thừa commit `1cc7a66` từ CI02).
- **Đã xong:**
  - **Loại bỏ secret thật khỏi git:**
    - Thay thế các secret PayOS cứng trong `appsettings.json` bằng placeholder an toàn (`YOUR_PAYOS_CLIENT_ID`, `YOUR_PAYOS_API_KEY`, `YOUR_PAYOS_CHECKSUM_KEY`).
    - Tạo `deploy/.env.example` đầy đủ và chuẩn hóa toàn bộ các biến môi trường cấu hình: `ASPNETCORE_ENVIRONMENT`, `ConnectionStrings__DefaultConnection`, `Database__AutoMigrate`, `Database__SeedMode`, `ADMIN_INITIAL_PASSWORD`, `JwtSettings__*`, `PayOS__*`, `AppSettings__FrontendUrl`, `Cors__AllowedOrigins__*`.
  - **Validation cấu hình khi khởi động (`Program.cs`):**
    - Kiểm tra chuỗi kết nối SQL Server (bắt buộc).
    - Kiểm tra `JwtSettings:Secret`: yêu cầu tối thiểu 32 ký tự, cấm secret mặc định/placeholder khi chạy ở môi trường ngoài Development (Staging, Production...).
  - **Tách biệt AutoMigrate và SeedMode:**
    - `Database:AutoMigrate` (bool): cho phép bật ở Dev hoặc CI container, mặc định tắt ở Production.
    - `Database:SeedMode` (enum: `None`, `Reference`, `Staging`, `Development`): điều khiển seeding linh hoạt.
    - Tách nhỏ hàm `DbSeeder`: `EnsureRolesAndPermissionsAsync`, `EnsurePoliciesAsync`, `SeedReferenceAsync`, `SeedStagingAsync`, `SeedByModeAsync`.
    - Hỗ trợ CLI commands trước khi khởi chạy web server: `--bootstrap` (tạo role/permission + admin khởi tạo) và `--seed-reference` (chỉ nạp danh mục).
  - **Reverse Proxy & Forwarded Headers:**
    - Cấu hình `UseForwardedHeaders` với `ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto`, xóa `KnownIPNetworks` và `KnownProxies` để nhận diện IP và Scheme đúng phía sau Docker/Nginx/Ingress.
    - Cấu hình CORS `DefaultCorsPolicy` đọc từ `Cors:AllowedOrigins` kèm fallback mặc định cho local frontend và ngrok.
  - **Health Checks & Readiness (`/health` & `/health/ready`):**
    - Endpoint `/health`: Liveness probe (trả về 200 OK ngay).
    - Endpoint `/health/ready`: Readiness probe thực hiện `CanConnectAsync()` và `GetPendingMigrationsAsync()` tới SQL Server. Trả về HTTP 200 kèm danh sách migration nếu sẵn sàng, hoặc HTTP 503 Service Unavailable kèm chi tiết lỗi nếu DB chưa sẵn sàng hoặc còn migration đang chờ.
  - **Động hóa URL thanh toán PayOS (`PayOSService.cs`):**
    - Hỗ trợ đọc `AppSettings:FrontendUrl` (hoặc `Frontend:BaseUrl`) thay vì fix cứng `http://localhost:5173`.
  - **Bổ sung Unit Tests kiểm chứng cấu hình (`DeploymentConfigTests.cs`):**
    - 5 bài test bao phủ: JWT secret validation (pass dev, fail prod khi dùng secret yếu hoặc placeholder), AutoMigrate & SeedMode default values, và PayOS ReturnUrl fallback khi có `FrontendUrl`.
- **Kiểm chứng:**
  - `dotnet test StorageProject.Tests/StorageProject.Tests.csproj`: 57/57 tests PASS (toàn bộ 5 test mới pass).
  - `powershell .\init.ps1`: 100% PASS (check:structure, 76 unit test FE, 9 business test FE, 92 route render FE, build FE dist, build Release BE, 57 unit test BE).
- **Phiên sau:** Bắt đầu Task CI04 — Kiểm chứng SQL Server thật và API integration test (migration chain 6 migrations, check model drift, concurrency lock payment).


## Phiên CI02 — 2026-10-23 — Xây dựng GitHub Actions CI workflow cho PR và main

- **Tính năng:** CI02 — Workflow CI cho PR và main (`.github/workflows/ci.yml`, `scripts/ci/run-ci.ps1`, `scripts/ci/run-ci.sh`).
- **Nền:** Nhánh `feature/cicd-ci02` (kế thừa commit `ea713ff` từ CI01).
- **Đã xong:**
  - **Tạo workflow `.github/workflows/ci.yml`:**
    - Triggers: `pull_request` (vào `main`), `push` (trên `main`), và `workflow_dispatch`.
    - Concurrency: Nhóm theo workflow và git ref, tự động hủy run cũ khi có push mới trên PR (`cancel-in-progress: true`).
    - Quyền tối thiểu: `permissions: contents: read`.
    - Pin Action bằng full SHA-1 đã xác thực: `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2), `actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a` (v4.2.0), `actions/setup-dotnet@3951f0adf7a4399ed659394f4f7140f92f89a7ab` (v4.3.0), `actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce6ec1` (v4.6.1).
    - Job `frontend`: Chạy đúng thư mục lồng `SafeSpace-Customer-UI/SafeSpace-Customer-UI`, cache npm theo lockfile FE, chạy đủ 4 suite: `check:structure`, `test` (76 test), `test:business` (9 test), `test:render` (92 routes), build dist và upload artifact `frontend-dist`.
    - Job `backend`: Cài .NET 10 qua `global.json`, `dotnet restore`, `dotnet tool restore`, `dotnet build -c Release --no-restore`, `dotnet test -c Release --no-build --no-restore --logger "trx;LogFileName=backend.trx" --results-directory artifacts/test-results/backend` (52 xUnit tests), `dotnet publish -c Release --no-build --no-restore -o artifacts/api`, upload artifact `backend-test-results`.
    - Job `ci-gate`: Tổng hợp kết quả frontend và backend, fail nếu có bất kỳ job nào thất bại/bị hủy/bị skip không hợp lệ, xuất báo cáo ra `$GITHUB_STEP_SUMMARY`.
  - **Tạo script mô phỏng CI local (`scripts/ci/run-ci.ps1`, `scripts/ci/run-ci.sh`):** Hỗ trợ chạy toàn bộ 10 bước CI cục bộ giống hệt runner Actions.
  - **Cập nhật `.gitignore`:** Thêm `artifacts/` để không theo dõi file kết quả test `.trx` và publish output.
- **Kiểm chứng:**
  - `npx --yes yaml-lint .github/workflows/ci.yml`: YAML Lint successful (0 syntax errors).
  - Chạy `scripts\ci\run-ci.ps1` hoàn tất 10/10 bước:
    - Frontend: check:structure PASS, 76/76 unit tests PASS, 9/9 business tests PASS, 92/92 routes render PASS, production bundle build PASS.
    - Backend: dotnet restore PASS, dotnet tool restore PASS, Release build PASS (0 errors), 52/52 xUnit tests PASS (xuất kết quả `artifacts\test-results\backend\backend.trx`), Release publish PASS (`artifacts\api`).
  - `powershell .\init.ps1`: PASS toàn bộ.
- **Phiên sau:** Bắt đầu Task CI03 — Chuẩn hóa API cho deployment (tách secret khỏi appsettings.json, AutoMigrate, SeedMode, health ready kiểm tra DB, proxy forwarded headers).

## Phiên CI01 — 2026-10-23 — Chốt baseline và cấu hình tái lập pipeline CI/CD

- **Tính năng:** CI01 — Chốt baseline môi trường và cấu hình tái lập (sprint contract `docs/sprints/CI-cicd-pipeline.md`, kế hoạch `SSFRMS-CICD-IMPLEMENTATION-PLAN.md`).
- **Nền:** HEAD commit `6d959ae` (Merge pull request #22 from ryocoding13/feat/d27-refund). Nhánh `feature/cicd-ci01`.
- **Đã xong:**
  - **Tạo `global.json`:** Ghim SDK `10.0.100` với chính sách rollForward `latestFeature`, bảo đảm khớp các patch `10.0.401` trên local và các runner CI có .NET 10.
  - **Chuẩn hóa công cụ EF Core:** Thêm `.config/dotnet-tools.json` định nghĩa `dotnet-ef` phiên bản `10.0.12`, giúp `dotnet tool restore` hoạt động chuẩn theo quy ước .NET không cần truyền tham số thủ công.
  - **Phân quyền thực thi `init.sh`:** Cập nhật git index mode `100755` cho `init.sh` để runner Linux/macOS có thể thực thi trực tiếp `./init.sh`.
  - **Bổ sung kiểm thử vào init scripts (`init.sh` và `init.ps1`):** Thêm 2 bước kiểm tra bị thiếu: `npm run check:structure` (kiểm tra phân tách mô đun và quy tắc đặt tên FE) và `npm run test:business` (9/9 kiểm thử chính sách kinh doanh).
  - **Cập nhật tài liệu kiểm chứng (`docs/verification.md`):** Cập nhật bảng kiểm chứng phản ánh đúng số lượng test thực tế: 4 suite frontend (structure check, 76 unit/integration test, 9 business test, 92 route SSR render) và 52 bài test xUnit của backend trong `StorageProject.Tests`.
  - **Lập danh sách tính năng CI/CD (`feature_list.json`):** Thêm đầy đủ 8 task `CI01`–`CI08`, tạo sprint contract `docs/sprints/CI-cicd-pipeline.md`.
- **Kiểm chứng:**
  - `.\init.ps1` chạy pass 100%:
    - Node v24.21.0 & .NET 10.0.401: OK
    - Frontend `check:structure`: PASS
    - Frontend `npm test`: 76/76 PASS
    - Frontend `npm run test:business`: 9/9 PASS
    - Frontend `npm run test:render`: 92/92 routes PASS
    - Frontend `npm run build`: Vite build thành công
    - Backend `dotnet tool restore`: OK
    - Backend `dotnet build StorageProject.slnx`: 0 Error, 4 Warnings (vulnerability NuGet đã biết)
    - Backend `dotnet test StorageProject.slnx`: 52/52 tests PASS (xUnit)
  - `node -e "JSON.parse(...)"` kiểm tra `feature_list.json`: cú pháp JSON hoàn toàn hợp lệ.
- **Phiên sau:** Bắt đầu Task CI02 — Viết workflow GitHub Actions `.github/workflows/ci.yml` và script chạy CI nội bộ.

## Phiên 9 — 2026-10-16 — Sửa lỗi tính tiền thanh toán đơn đặt chỗ (tiền thuê + cọc)

- **Vấn đề:** Khách hàng vào màn hình thanh toán đơn đặt chỗ (PayOS QR), tổng thanh toán hiển thị chỉ có tiền cọc (1.000 đ) mà không cộng tiền thuê 3 tháng (3.000 đ), link PayOS cũng chỉ thu 1.000 đ thay vì 4.000 đ.
- **Nguyên nhân:**
  - Trong `StorageProject.Infrastructure/Services/PayOSService.cs` (dòng 128), biểu thức tính `amount` sử dụng toán tử 3 ngôi sai:
    `int amount = (int)(reservation.RequiredDeposit > 0 ? reservation.RequiredDeposit : reservation.EstimatedAmount);`
    Khi có tiền cọc (`RequiredDeposit > 0`), hệ thống chỉ lấy tiền cọc mà bỏ qua toàn bộ tiền thuê (`EstimatedAmount`).
  - Trong `SafeSpace-Customer-UI/SafeSpace-Customer-UI/mock/mock-api.mjs` (dòng 618), fallback cho mock endpoint cũng có biểu thức toán tử 3 ngôi tương tự.
- **Đã sửa:**
  - `PayOSService.cs`: Sửa thành `int amount = (int)(reservation.EstimatedAmount + (reservation.RequiredDeposit > 0 ? reservation.RequiredDeposit : 0));`.
  - `mock-api.mjs`: Sửa dòng fallback khớp logic tính tổng `estimatedAmount + (requiredDeposit > 0 ? requiredDeposit : 0)`.
- **Kiểm chứng:**
  - Chạy script kiểm thử API thực tế với SQL Server & backend (`POST /api/reservations/create-payos-qr`):
    - Đơn 3 tháng: Tiền thuê = 3.000 đ, Tiền cọc = 1.000 đ.
    - Kết quả trả về `amount = 4000` đúng tổng tiền thuê + cọc, link PayOS sinh đúng 4.000 đ.
  - Frontend test suites: `npm test` 67/67 test PASS; `npm run test:render` 92/92 routes PASS; `npm run build` OK.
  - Backend: `dotnet build StorageProject.slnx` 0 Warning 0 Error.
  - Chạy `./init.ps1` kiểm tra toàn bộ môi trường và test: PASS toàn bộ.

## Phiên 8 — 2026-10-16 — Triển khai Backend QR mở cửa (C07q, C07r) và kết nối Frontend

- **Tính năng:** F34 — Backend QR mở cửa kho: sinh mã HMAC-SHA256 và mã dự phòng 8 số; endpoint máy quét mô phỏng tại cửa kho; kết nối trực tiếp với nút "Mở cửa kho" trên frontend.
- **Đã xong:**
  - **Core DTOs (`StorageProject.Core/DTOs/Access/AccessDtos.cs`):** Khai báo `AccessQrDto`, `ScanAccessRequest`, `ScanResultDto`, `AccessQrOptions`.
  - **Core Interface (`StorageProject.Core/Interfaces/IServices.cs`):** Bổ sung `IAccessService` (`GetQrAsync`, `ScanAsync`).
  - **Infrastructure Service (`StorageProject.Infrastructure/Services/AccessService.cs`):**
    - Sinh mã bảo mật HMAC-SHA256 không trạng thái từ `ContractId + CredentialId + IssuedAt` và Secret key (`JwtSettings:Secret` hoặc `AccessQr:Secret`).
    - Format mã QR: `SSQR-<contractId>-<8 ký tự hex>` (ví dụ: `SSQR-1-1733D3D0`).
    - Format mã PIN dự phòng: 8 chữ số (ví dụ: `03502103`, hiển thị dạng `0350 2103`).
    - Endpoint kiểm mã `POST /api/access/scan` kiểm tra đa dạng (mã QR hoặc mã 8 số có/không có dấu cách), kiểm tra thứ tự từ chối nghiệp vụ chuẩn (thẻ thu hồi, đã trả kho, chưa bàn giao, hợp đồng quá hạn/hết hiệu lực) và ghi nhật ký ra vào `ACCESS_SCANNED` vào bảng `activity_logs`.
  - **API Endpoints (`StorageProject.Api/Endpoints/AccessEndpoints.cs`):**
    - `GET /api/contracts/{id}/access-qr`: Yêu cầu xác thực chủ hợp đồng, hỗ trợ cả `id` số nguyên lẫn mã chuỗi `HĐ-...`.
    - `POST /api/access/scan`: Endpoint công khai cho máy quét/thiết bị tại cửa, luôn trả về 200 kèm `result: "OPEN" | "DENIED"` và lý do từ chối.
  - **Cấu hình & DI (`Program.cs`):** Đăng ký `AccessQrOptions`, `IAccessService` và map `app.MapAccessEndpoints()`.
  - **Cải thiện `StaffService.CompleteHandoverAsync`:** Hỗ trợ hoàn tất bàn giao theo `HandoverId` và tự động kích hoạt `AccessCredential` với `Status = "ACTIVE"`.
  - **Frontend Integration (`endpoints.js` & `useAccessQr.js`):**
    - Thêm `accessQr` và `scanAccess` vào `src/api/endpoints.js`.
    - Cập nhật `src/state/useAccessQr.js` kết nối trực tiếp API khi `USE_API = true`, đồng thời bảo toàn logic giả lập ngoại tuyến khi `USE_API = false`.
- **Kiểm chứng:**
  - `dotnet build StorageProject.slnx` thành công 0 lỗi.
  - Chạy `test_full_flow.ps1` kiểm chứng luồng thực tế trên máy chủ Backend & SQL Server:
    - Nhân viên `staff01` hoàn tất bàn giao kho K01 (`POST /api/staff/handovers/1/complete`).
    - Khách hàng `customer01` gọi `GET /api/contracts/1/access-qr` nhận thành công mã `SSQR-1-1733D3D0` và mã dự phòng `03502103`.
    - Quét mã QR trả về `OPEN` | Cửa kho K01 | Khách hàng Nguyễn Văn An.
    - Quét mã dự phòng (kể cả có dấu cách `0350 2103`) trả về `OPEN`.
    - Quét mã sai trả về `DENIED` kèm lý do rõ ràng.
    - SQL Server bảng `activity_logs` ghi nhận đầy đủ các bản ghi hành động `ACCESS_SCANNED`.
  - Frontend test suites:
    - `npm test`: 42/42 unit test PASS.
    - `node --test tests/access.test.js`: 10/10 access test PASS.
    - `npm run test:render`: 76/76 routes SSR PASS.
    - `npm run build`: Production bundle Vite build thành công 100%.

## 2026-10-16 — F32 + F29: đồng bộ giao diện Figma 16/10 (việc 9 của Thắng) — Claude

- Nhánh làm việc gộp `main` + `feature/ops-backend` + `feature/facility-coordinates` (xung đột duy nhất ở `DECISIONS.md`: giữ cả D17–D18 và D20).
- Khách: C04 chọn Thanh toán QR (PayOS, hỏi trạng thái 3 giây, tự sang C05) / Tại cửa hàng (C04c → C05c); bỏ "Tôi đã chuyển khoản";
  giữ chỗ QR 10 phút. C07 theo F29 + "Mở cửa kho" (C07q) + màn máy quét `#/door` (C07r1/r2). C11 nút "Thanh toán" khoản gia hạn
  (C11q → C11b). C12 dòng phản hồi nhân viên. C14 "Huỷ đơn" + hộp thoại C14a (số tiền hoàn), C14b. C03b / C02m nút "Chỉ đường".
- Nhân viên / quản lý: S09 "Thu tiền tại kho", S01 ô "Chờ thu tiền tại kho", thẻ "THU TIỀN"; M02 cột "Thao tác" + hộp thoại M02a (F12 phía giao diện).
- Chữ "đối soát" đổi sang "thanh toán" / "thu tiền" ở mọi màn (khách, nhân viên, quản lý, Vận hành KD).
- API: endpoint mới gọi sẵn theo `SafeSpace-Customer-UI/BACKEND-TODO.md` mục "Mới 16/10" (P PayOS – Đạt, Q QR – Tiến,
  R/H phản hồi + hoàn tiền – Ngọc Mai, U trạng thái ô – Thắng). Backend chưa có → thông báo thay thế, không lỗi (D21).
- Mock: đủ endpoint mới, PayOS giả lập tự trả sau `MOCK_PAYOS_AUTOPAY` giây; `MOCK_LEGACY=1` tắt endpoint mới để thử như backend hiện tại.
- Test: sửa 1 kiểm tra trong `tests/reducer.test.js` (seed SS-0142 nay là đơn đã thanh toán QR theo Figma C14, không còn `PENDING_VERIFICATION`);
  thêm `tests/payment-access.test.js`, `tests/payment-api.test.mjs`, mở rộng `tests/render.test.mjs` (92 route).
- Kiểm chứng: `npm test` 56/56, `npm run test:render` 92 route PASS, `npm run test:business` PASS, `npm run build` PASS.
  Chromium + `dev:mock`: đi hết C04 → C05, C04c → C05c, C11q → C11b, C07q → máy quét, C14a, S09, M02a; với `MOCK_LEGACY=1`
  mọi màn mới hiện thông báo thay thế, không lỗi JavaScript. **Chưa chạy với .NET + SQL Server** (môi trường AI không có .NET).
- Phiên sau: Đạt chạy thử trên máy có .NET (flow cũ + thanh toán tại cửa hàng dùng `confirm-transfer`); từng người làm endpoint
  của mình theo BACKEND-TODO mục "Mới 16/10", chạy `tests/payment-api.test.mjs` vẫn pass với mock để giữ đúng hợp đồng.

## 2026-10-15 — Toạ độ bản đồ (B05a, C02m) — Claude (việc của Thắng)

- Figma: B05 thêm dòng "Vị trí bản đồ" + nút "Sửa thông tin cơ sở"; hộp thoại mới B05a.
- Backend: `Facility.Latitude/Longitude` + check constraint, trả trong `FacilityDto` và `OpsFacilityDto`, nhận trong
  `UpsertFacilityRequest` (kiểm tra trong khung Việt Nam), `FacilityCoordinateSeeder` điền 12 cơ sở còn trống.
- Frontend: `mapCatalog` gán `lat/lng`; B05a (`src/business/facility-form.js` + `Facilities.jsx`); mock business có toạ độ.
- Kiểm chứng: `npm test` 39/39, `npm run test:business` 9/9, `npm run test:render` PASS, `npm run build` PASS;
  biên dịch thử các service bằng stub EF (không tải được NuGet trong môi trường AI); Playwright: sửa toạ độ ở B05a qua mock → lưu thành công.
- Phiên sau: `dotnet ef migrations add AddFacilityCoordinates --project StorageProject.Infrastructure --startup-project StorageProject.Api`,
  `dotnet build StorageProject.slnx`, chạy API, kiểm tra `GET /api/facilities` có toạ độ và bản đồ Tìm kho đúng vị trí.

## Mẫu một mục

```
## Phiên N — YYYY-MM-DD — <người / công cụ AI>
- Tính năng: Fxx — <tên>
- Đã xong: …
- Đang dở: …
- Kiểm chứng: <lệnh đã chạy> → <kết quả>
- Bị chặn / rủi ro: …
- Phiên sau nên: …
```

---

## Phiên 7 — 2026-10-16 — Cập nhật DbSeeder, tạo role BUSINESS_OPERATOR và reset dữ liệu hệ thống mới mở

- Tính năng: Reset toàn bộ dữ liệu giao dịch/hoạt động khách hàng trong SQL Server về trạng thái hệ thống mới mở; thêm role `BUSINESS_OPERATOR` và tài khoản `operator01`; giữ nguyên đầy đủ seed data cấu hình ban đầu để khách hàng và vận hành sẵn sàng sử dụng.
- Đã xong:
  - **Cập nhật `DbSeeder.cs`:**
    - Thêm Role `BUSINESS_OPERATOR` (tên hiển thị: Quản lý vận hành kinh doanh toàn hệ thống) cùng các quyền: `REPORT_VIEW`, `AUDIT_LOG_VIEW`, `FACILITY_MANAGE`, `UNIT_MANAGE`, `RENEWAL_MANAGE`.
    - Thêm tài khoản người dùng `operator01` (email: `operator01@storage.vn`, mật khẩu: `Operator@123`, họ tên: `Lê Vận Hành Kinh Doanh`, phone: `0900000004`, trạng thái: `ACTIVE`) được gán role `BUSINESS_OPERATOR` và liên kết cơ sở.
    - Chuyển ô kho `TB-M-103` (và toàn bộ 72 ô kho trên 12 cơ sở) về trạng thái `AVAILABLE`.
    - Loại bỏ hoàn toàn Section 8 & 8b (các đơn đặt chỗ mẫu, hợp đồng mẫu, khoản thanh toán mẫu, vé hỗ trợ mẫu của khách hàng).
    - Bảo toàn toàn bộ dữ liệu nền tảng: 12 cơ sở (`facilities`), 4 loại ô kho (`unit_types`), 72 ô kho (`storage_units`), biểu phí thuê (`rental_rates`), chính sách vận hành (`policies`), các tài khoản nhân sự và khách hàng sạch (`admin`, `manager01`, `staff01`, `customer01`, `customer02`).
  - **Cập nhật Frontend Role Mapping (`roles.js`):**
    - Bổ sung `BUSINESS_OPERATOR` và `BUSSINESS_OPERATOR` vào `ROLE_LABELS`, `ROLE_ORDER`, `ROLE_SCOPE`, `isBusinessRoles`, `isOpsRoles`, `homeFor` để giao diện nhận diện và điều hướng đúng phân quyền.
  - **Dọn dẹp và nạp mới dữ liệu trên SQL Server (`SSFRMS`):**
    - Xoá sạch toàn bộ dữ liệu giao dịch cũ: `reservations`, `rental_contracts`, `payments`, `handover_records`, `return_inspections`, `support_tickets`, `unit_assignments`, `maintenance_requests`, `contract_renewals`, `overdue_cases`, `access_credentials`, `activity_logs`.
    - Chạy nạp lại dữ liệu chuẩn từ `DbSeeder.cs`.
- Kiểm chứng:
  - Kiểm tra SQL Server:
    - Bảng `reservations`, `rental_contracts`, `payments`, `support_tickets`, `handover_records`, `return_inspections`: 0 rows.
    - Bảng `storage_units`: 72/72 ô kho ở trạng thái `AVAILABLE` (100%).
    - Bảng `roles`: Đã có role `BUSINESS_OPERATOR`.
    - Bảng `users`: Đã có `operator01` với role `BUSINESS_OPERATOR`.
  - Kiểm tra API:
    - Đăng nhập `operator01` / `Operator@123` qua `POST /api/auth/login` → Trả về JWT Token với claim role `BUSINESS_OPERATOR`.
    - Gọi `GET /api/auth/profile` bằng token của `operator01` → Trả về thông tin họ tên `Lê Vận Hành Kinh Doanh`, role `BUSINESS_OPERATOR`.
    - Đăng nhập `customer01` / `Customer@123` → Trả về tài khoản sạch, 0 hợp đồng, 0 đặt chỗ, sẵn sàng đặt kho.
  - `powershell .\init.ps1` → PASS (38/38 unit tests, 76 render routes, Vite build 0 errors, .NET build 0 errors).
- Bị chặn / rủi ro: Không.
- Phiên sau nên: Tiếp tục hoàn thiện các báo cáo và chức năng dành riêng cho vai trò Business Operator nếu có yêu cầu.

## Phiên 6 — 2026-10-16 — Kết nối 100% dữ liệu frontend trực tiếp từ Database (SQL Server), loại bỏ dữ liệu mock

- Tính năng: Toàn bộ hiển thị phía Client/Ops/Admin lấy trực tiếp từ `AppDbContext` (SQL Server), loại bỏ hoàn toàn mock RAM / mock fallback.
- Đã xong:
  - **Loại bỏ in-memory state & mock fallback:**
    - Xoá bỏ hoàn toàn `GetOrCreateState` và `OpsBoardDataState` (vốn chứa 2 khoản đối soát mock `SS-20260913-0147` và `SS-20260914-0021`).
    - Trong `StaffService.cs` và `ManagerService.cs`: Tất cả các danh sách (kho `StorageUnits`, đối soát `Reservations`, phân bổ `UnitAssignments`, xác minh & bàn giao `HandoverRecords`, kiểm tra trả kho `ReturnInspections`, khiếu nại hỗ trợ `SupportTickets`, nhân sự cơ sở `UserFacilities`, doanh thu `Payments`) đều query trực tiếp từ `AppDbContext`.
    - Sửa `ParseIdNumber` và `FindReservationByIdAsync` để trích xuất chính xác ID từ chuỗi mã SafeSpace (`SS-yyyyMMdd-xxxx`, `XM-xxxx`, `BG-xxxx`, `TK-xxxx`, `OrderCode`) và tìm kiếm trên cơ sở dữ liệu thật.
    - Mọi thao tác ghi nhận (Xác nhận đối soát thanh toán, Phân bổ ô kho, Cập nhật trạng thái ô kho, Hoàn cọc, Gửi biên bản kiểm tra trả kho, Duyệt gia hạn) đều lưu vĩnh viễn vào SQL Server qua `dbContext.SaveChangesAsync()`.
  - **Frontend kết nối API thật:**
    - Cập nhật `OpsProvider` trong `src/ops/store.jsx` nhận prop `role` và gọi `loadBoard(role)` trực tiếp tới `/api/staff/board` hoặc `/api/manager/board`.
    - Chặn hoàn toàn fallback về `readOps()` khi đang ở chế độ API: nếu có lỗi sẽ hiển thị thông báo lỗi và nút thử lại, không tự động nạp mock trong local storage.
    - Kết nối các luồng khách hàng còn dở trong `store.jsx` trực tiếp vào API backend:
      - `REQUEST_RETURN` gọi `POST /api/contracts/{id}/move-out`.
      - `UPDATE_NAME` gọi `PUT /api/auth/profile`.
      - `CHANGE_PASSWORD` gọi `POST /api/auth/change-password`.
- Kiểm chứng:
  - `powershell .\init.ps1` → PASS (38/38 unit tests, 76 render routes, Vite build 0 errors, .NET build 0 errors).
  - Test trực tiếp `GET /api/staff/board` & `GET /api/manager/board` bằng tài khoản `staff01` và `manager01`: dữ liệu trả về 100% từ bảng SQL Server `Reservations`, `StorageUnits`, `UserFacilities`.
  - Test `POST /api/staff/payments/SS-20261007-0013/confirm` xác nhận thành công và kiểm tra trực tiếp row trong SQL Server: `ReservationId 13` chuyển `Status = CONFIRMED`, `PaidAt = 2026-10-16 13:55:16`.
- Bị chặn / rủi ro: Không.
- Phiên sau nên: Tiếp tục hoàn thiện các luồng nghiệp vụ còn lại hoặc viết thêm test tự động backend (F28).

## Phiên 5 — 2026-10-16 — Tái cấu trúc phân tách Staff/Manager và hoàn thiện chức năng còn thiếu

- Tính năng: F06, F10, F11–F20, refactor `OpsEndpoints` & `OpsService`.
- Đã xong:
  - **Tái cấu trúc backend theo vai trò (Role-based Refactoring):**
    - Tách `OpsService` và `OpsEndpoints` thành:
      - `IStaffService.cs` + `StaffService.cs` + `StaffEndpoints.cs` (nhóm route `/api/staff/*`, phục vụ nhân viên cơ sở).
      - `IManagerService.cs` + `ManagerService.cs` + `ManagerEndpoints.cs` (nhóm route `/api/manager/*`, phục vụ quản lý cơ sở).
      - `FacilityOpsStateStore.cs` quản lý trạng thái in-memory dùng chung giữa nhân viên và quản lý cơ sở.
      - Hỗ trợ đầy đủ routing fallback `/api/ops/*` trên backend để tương thích ngược 100%.
  - **Bổ sung các chức năng còn thiếu của các lớp user có sẵn:**
    - **Khách hàng (Customer):**
      - Thêm `POST /api/contracts/{id}/move-out`: Đăng ký lịch trả kho (ngày, khung giờ, ghi chú), tự tạo `ReturnInspection` và chuyển trạng thái hợp đồng sang `RETURN_PENDING` (F06 -> `passing`).
      - Thêm `GET /api/auth/profile`, `PUT /api/auth/profile`: Xem và cập nhật thông tin cá nhân (F10 -> `passing`).
      - Thêm `POST /api/auth/change-password`: Đổi mật khẩu cá nhân có kiểm tra mật khẩu hiện tại bằng BCrypt.
    - **Nhân viên cơ sở (Staff):**
      - Thêm `PUT /api/staff/units/{id}/status`: Đổi trạng thái ô kho độc lập (AVAILABLE, MAINTENANCE, CLEANING, OCCUPIED) (UC09).
      - Thêm `POST /api/staff/credentials/{id}/revoke`: Thu hồi quyền/mã truy cập cũ (UC08).
      - Thêm `POST /api/staff/credentials/reissue`: Cấp lại quyền/mã truy cập mới (UC08).
    - **Quản lý cơ sở (Manager):**
      - Thêm `GET /api/manager/units`: Danh sách ô kho cơ sở (UC13).
      - Thêm `POST /api/manager/units`: Tạo ô kho mới tại cơ sở (UC13).
      - Thêm `PUT /api/manager/units/{id}`: Cập nhật thông số/trạng thái ô kho (UC13).
      - Thêm `POST /api/manager/units/{id}/lock`: Khóa ô kho khi bảo trì/sự cố (UC13).
  - **Đồng bộ Frontend:**
    - Cập nhật `src/ops/api.js` gọi các endpoint mới theo vai trò (`/api/staff/*` và `/api/manager/*`).
    - Cập nhật `mock/mock-api.mjs` hỗ trợ song song `/api/staff/*`, `/api/manager/*`, `/api/ops/*`, `profile`, `change-password`, và `move-out`.
- Kiểm chứng:
  - `.\init.ps1` PASS toàn bộ:
    - Frontend: `npm test` 38/38 PASS, `npm run test:render` 76/76 PASS, `npm run build` OK.
    - Backend: `dotnet build StorageProject.slnx` 0 Warning, 0 Error.
- Phiên sau nên: Tiếp tục thực hiện các chức năng tiếp theo hoặc chuẩn bị giao diện Vận hành KD khi có yêu cầu.

## Phiên 4b — 2026-10-14 — Sửa mã QR thanh toán PayOS đúng chuẩn liên kết thanh toán

- Tính năng: F02, F03 (thanh toán PayOS QR).
- Đã xong:
  - Cập nhật `PaymentQr.jsx`: phân biệt giữa URL trang thanh toán PayOS (`checkoutUrl`) và file ảnh (`isImageUrl`); tạo mã QR chuẩn SVG từ liên kết thanh toán PayOS (`https://pay.payos.vn/web/...`) qua `QRCode.toString()`. Khách hàng quét mã bằng camera/app sẽ mở đúng liên kết PayOS. Mã QR có thể bấm trực tiếp để mở trang thanh toán.
  - Sửa `PayOSEmbeddedModal.jsx`: dùng `PaymentQr` thay vì thẻ `<img>` trực tiếp (tránh lỗi broken image khi link là webpage URL hoặc chuỗi dữ liệu).
  - Cập nhật `Checkout.jsx`: truyền `checkoutUrl` và trạng thái `loadingPayOS` vào `PaymentQr` để không bị nhấp nháy tài khoản mẫu khi đang tải từ backend.
  - Cập nhật `PayOSService.cs`: kiểm tra nếu `checkoutUrl` chưa phải là link PayOS thật (`https://pay.payos.vn`) thì gọi PayOS SDK sinh mới và lưu vào đơn đặt chỗ.
  - Hỗ trợ mock endpoints cho `/create-payos-qr` và `/status` trong `mock-api.mjs`.
- Kiểm chứng:
  - `.\init.ps1` → pass toàn bộ:
    - Frontend: `npm test` 38/38 PASS, `npm run test:render` 76 route PASS, `npm run build` OK.
    - Backend: `dotnet build StorageProject.slnx` 0 Warning 0 Error.
- Phiên sau nên: Tiếp tục thực hiện các việc ưu tiên 2 trong `BACKEND-TODO.md` (mục B).

## Phiên 5a — 2026-10-14 — Backend khu Nhân viên / Quản lý cơ sở + seed D17 (Claude)

- Tính năng: F03, F11–F21 (phần backend) + seed theo D17. Nhánh `feature/ops-backend` (tách từ `feature/figma-1410-sync`). Quyết định D18.
- Đã xong:
  - `DbSeeder` tách 3 file: 4 loại kho (thường/lạnh × M 15 m²/L 30 m²), 12 cơ sở, 12 ô K01–K12 mỗi cơ sở, giá theo
    `lib/catalog.js`; loại kho / cơ sở đời cũ chuyển ngừng dùng. Quyền STAFF, MANAGER; tài khoản `manager01`, `staff02`,
    `customer03`–`customer06`; gán cơ sở Nguyễn Lương Bằng; dữ liệu vận hành mẫu (2 khoản chờ đối soát, 1 đơn chờ phân bổ,
    1 khách chờ bàn giao, 1 gia hạn chờ duyệt, 1 hợp đồng quá hạn, 1 lịch trả kho, 1 yêu cầu hỗ trợ).
  - `/api/ops/*` (`FacilityOpsEndpoints.cs`, `FacilityOpsService*.cs`): board + 12 thao tác đúng `src/ops/api.js`.
  - `POST /api/reservations/{id}/confirm-transfer` + trạng thái `PENDING_VERIFICATION` (migration viết tay).
  - Sửa lỗi CHECK cũ: `HandoverService` (`COMPLETED` → `HANDED_OVER`), `RenewalService` (`PENDING_PAYMENT` → `PENDING`).
  - Giao diện: "Tôi đã chuyển khoản" gọi API thật; `ops/data.js` còn 12 ô; bỏ chữ "dữ liệu mẫu" trên banner khu vận hành.
  - Tài liệu: `docs/facility-ops-api.md`, `BACKEND-TODO.md` mục A, README / AGENTS (tài khoản).
- Kiểm chứng:
  - `npm test` → 41/41 pass (thêm test confirm-transfer qua mock, test mapper PENDING_VERIFICATION, test 12 ô)
  - `npm run test:render` → 76 route PASS · `npm run build` → OK
- Bị chặn / rủi ro: Đã chạy với SQL Server và kiểm chứng thành công.

## Phiên 4a — 2026-10-14 — Đồng bộ giao diện với Figma 14/10 (Claude)

- Tính năng: F30 (sơ đồ ô kho) + trang chủ, danh mục kho, header khu vận hành. Nhánh `feature/figma-1410-sync`. Quyết định D17.
- Đã xong (chỉ frontend):
  - Trang chủ mới (`pages/Home.jsx`): hero ảnh + tìm theo khu vực / loại / cỡ, dải số liệu, 4 loại kho, 3 bước,
    cơ sở theo chip khu vực, khối kêu gọi, footer. Bỏ CSS trang chủ cũ không còn dùng.
  - Sơ đồ 12 ô (`lib/units.js`, `UnitMap.jsx`): dãy A cỡ M, dãy B cỡ L; dữ liệu backend gắn ô theo loại + cỡ.
  - Bỏ cỡ S (`lib/catalog.js`), 2 cỡ M 15 m² / L 30 m²; bảng giá P01 còn 2 thẻ, có giá kho lạnh.
  - Bỏ "Gần bạn nhất", "Cách bạn … km", `distance_km`, `distanceLabel`.
  - 12 cơ sở đều có kho lạnh; sửa quận Tân Thuận, Phú Mỹ Hưng về Quận 7; đơn mẫu B-015 đổi sang kho lạnh cỡ M.
  - Header khu Nhân viên / Quản lý hiện tên cơ sở phụ trách dưới vai trò.
- Test đã sửa theo quy tắc mới (không phải để cho pass): `units.test.js` (10 → 12 ô), `reducer.test.js`
  (Quận 7 có 5 cơ sở, cả 12 có kho lạnh, giá B-015 mới, thêm kiểm tra cỡ S bị từ chối), `api-mappers.test.js`
  (loại kho ≤ 20 m² là cỡ M), `render.test.mjs` (lọc cỡ M thay cỡ S).
- Kiểm chứng: `npm test` → 39/39 pass; `npm run test:render` → 76 route PASS; `npm run build` → OK.

## Phiên 3a — 2026-10-14 — Backend khu Quản lý vận hành KD (Claude)

- Tính năng: F24 (role OPERATIONS), F22 (cơ sở, chính sách, bảng giá), F23 (báo cáo + xuất CSV) — phía backend.
  Nhánh `feature/operations-backend`.
- Đã xong:
  - Role `OPERATIONS`, quyền `POLICY_MANAGE`, `REPORT_SYSTEM`, `REPORT_EXPORT`, tài khoản `ops01` / `Ops@123`
    (`DbSeeder.EnsureOperationsRoleAsync`, chạy lại được với DB cũ).
  - `/api/operations/*`: cơ sở (UC19), chính sách (UC20–21), bảng giá (UC21), báo cáo theo cơ sở / loại kho / tháng /
    trạng thái, drill-down hợp đồng, xuất CSV (UC22–23). Hợp đồng API: `docs/operations-api.md`. Không có migration mới.
  - Đặt chỗ: chặn cơ sở không ACTIVE; tiền cọc và giá chỉ lấy chính sách / giá `ACTIVE` còn hiệu lực (D16).

## Phiên 2 — 2026-10-01 — Giao diện theo Figma 30/09, khu Nhân viên / Quản lý cơ sở

- Tính năng: F30 (mới), F21, F11–F20 (phía giao diện). Nhánh `feature/figma-3009-staff-manager`.
- Đã xong (chỉ frontend, không sửa backend):
  - Figma: ô trống màu xanh, bỏ ảnh sơ đồ mặt bằng khỏi thư viện ảnh, sửa nút đen, xếp frame theo vai trò và thứ tự luồng.
  - Khách hàng: sơ đồ ô kho trong chi tiết cơ sở (D13), tìm kho trên bản đồ + nút Danh sách / Bản đồ (D12),
    bỏ footer mọi trang, một dòng thông báo khi chưa có kho.
  - Khu Nhân viên `#/staff` (S01–S05, S09) và Quản lý cơ sở `#/manager` (M01–M07) trong `src/ops/`, lưới 3×3 (D14).
  - Hợp đồng `/api/ops/*` + dự phòng lưu trình duyệt (D15); việc backend còn thiếu: `BACKEND-TODO.md`.
- Kiểm chứng: `npm test` → 38/38 pass; `npm run test:render` → 76 route PASS; `npm run build` → OK;
  chạy tay luồng khách / nhân viên / quản lý trên mock (`MOCK_OPS=1`). **Chưa chạy với backend .NET thật.**
- Bị chặn / rủi ro:
  - Backend chưa có `/api/ops/*`, tài khoản seed MANAGER, lọc theo cơ sở (UserFacility) → F11–F21 để `blocked`.
  - D13 cần nhóm chốt có cho khách giữ đúng ô đã chọn không.
  - Luồng nghiệp vụ D02 không đổi. F29 chưa kiểm lại, giữ nguyên trạng thái.
- Phiên sau nên: người phụ trách backend làm `BACKEND-TODO.md` mục A, chạy `npm run dev` với backend thật
  và đi hết luồng đặt → đối soát → phân bổ → xác minh → bàn giao; pass thì đổi F11–F21 sang `passing`.

## Phiên 1 — 2026-09-26 — Rà mâu thuẫn Figma

- Tính năng: (không có — rà soát thiết kế trước khi chốt "Figma là chuẩn")
- Đã xong: đọc chữ và liên kết prototype của toàn bộ màn trong Figma "SafeSpace - Modern UI"; sửa trực tiếp
  trong Figma các chỗ mâu thuẫn về luồng / trạng thái / nhân vật / liên kết (bỏ qua ảnh, giá, số liệu).
  Danh sách đầy đủ: `docs/figma-review-2026-09-26.md`. Chốt D02 theo Figma, thêm D11.
- Kiểm chứng: quét lại toàn file Figma không còn "SafeSpace Quận 7", "Trần Minh", "Lê Anh", gia hạn B-015 "đã gửi";
  chụp lại C01, C07, C11, C14, M03, M07, A04 để kiểm tra bố cục.
- Bị chặn / rủi ro: code giao diện còn cho gia hạn / trả kho khi hợp đồng chưa bàn giao và câu tiền cọc cũ → F29.
  SRS mục A03 cần sửa cho khớp D02.
- Phiên sau nên: làm F29 (nhỏ, chỉ giao diện) hoặc F28.

## Phiên 0 — 2026-09-26 — Thiết lập harness

- Tính năng: (không có — phiên khởi tạo, chưa viết code tính năng)
- Căn cứ: hướng dẫn Harness Engineering tại https://learnharness.org/#dinh-nghia và https://skills.learnharness.org/
  (thầy Hoàng Giáo Làng giới thiệu tại Build With AI #3: From Working Code To Reliable Product).
- Đã xong: thêm `AGENTS.md`, `CLAUDE.md`, `feature_list.json`, `progress.md`, `DECISIONS.md`,
  `init.sh`, `init.ps1`, `docs/` (architecture, business-rules, conventions, verification, templates/sprint-contract).
- Hiện trạng code (commit `5177812`, main):
  - Giao diện khách hàng C01–C14 và quản trị A01–A04 đã có, gọi API thật cho các luồng backend đã hỗ trợ.
  - Backend .NET: auth, facilities/rates/availability, reservations, contracts, payments, renewals,
    handover confirm, tickets, toàn bộ `/api/admin/*`.
  - Chưa có: giao diện Nhân viên / Quản lý cơ sở / Quản lý vận hành KD (UC07–UC23).
- Kiểm chứng:
  - `npm test` → 28/28 pass
  - `npm run test:render` → 38 route PASS
  - `npm run build` → OK
  - `dotnet build` → **chưa chạy** (máy thiết lập không có .NET). Phiên sau chạy `./init.sh` trên máy có .NET để xác nhận.
- Bị chặn / rủi ro:
  - Backend không có test tự động → kiểm chứng backend yếu (F28).
  - Luồng thanh toán lúc đặt (Figma) lệch SRS A03 → đã chốt theo Figma ở Phiên 1 (D02).
  - `README.md` gốc chưa khớp code: ghi .NET 9 (project là `net10.0`); mục cấu trúc frontend còn tên cũ
    (`services/`, `customer.css`); nhắc tag "BẢN DEMO UI" không còn trong code.
- Phiên sau nên: chạy `./init.sh` đầy đủ trên máy có .NET; sau đó làm F28 (test backend) hoặc F21
  (khu Nhân viên / Quản lý) tuỳ nhóm ưu tiên.

## C07 QR frontend — 2026-10-16 — Tiến / Codex
- Thêm component QR riêng + 2 dòng vào Units.jsx; không sửa nghiệp vụ cũ, API hoặc DB.
- C07q xem QR, C07r1/C07r2 kết quả quét; mô phỏng chỉ VITE_USE_API=false, API thật báo chưa hỗ trợ.
- Kiểm chứng: 42 test gốc, 10 test QR, 9 test business pass; 76 route SSR pass; Vite build pass.
- Browser Chromium: popup 480x598, QR, kết quả mở cửa, từ chối hết hạn, icon 96px, Escape, Đóng, khóa chưa bàn giao, mobile 390px, không pageerror.
- Chưa có backend QR; hướng dẫn C07-QR-HUONG-DAN.md.

## 2026-10-20 — F35 kiểm khoản thu và phân bổ, thanh toán tại kho, F12

- Theo yêu cầu người dùng sửa cùng gói: PayOS kiểm số tiền và orderCode, ghi RENT/DEPOSIT vào payments trước khi có hợp đồng; gắn lại PaymentId khi phân bổ, không thu thêm. Bỏ phân bổ tự động khỏi webhook. Chuyển trả tại kho huỷ link trước khi đổi, S09 thu tiền mặt, xử lý callback muộn bằng PAYMENT_REVIEW_REQUIRED.
- D23–D24 bổ sung, không sửa số/nội dung D19–D22. Trạng thái ô bằng tay có lý do, quy tắc và unit_status_history. Xoá các route /api/ops trùng trong Staff/Manager để giữ một bộ đăng ký; các thao tác thu tiền/phân bổ tương thích dùng chung xử lý.
- Migration mới 20261020154838_ReservationPaymentIntegrity: PaymentMethod, PENDING_AT_FACILITY, Payment.ReservationId, ContractId optional, unique index khoản thu. Nối các dòng cũ không mơ hồ; không xoá database/dữ liệu. Worker thu hồi giữ chỗ tại kho hết hạn. Không sửa migration cũ.
- Chặn xác minh/bàn giao chưa có đủ khoản thu, đồng bộ trạng thái xác minh từ HandoverRecord thay vì đánh dấu CHECKED_IN trước khi bàn giao. Test luồng chọn trả tại kho → phân bổ → thu → xác minh → bàn giao giữ nguyên hai khoản thu.
- Kiểm chứng: .NET SDK 10.0.100; dotnet build StorageProject.slnx -m:1 PASS; xUnit 15/15 PASS (SQLite, adapter SDK chữ ký sai, model SQL Server khớp snapshot, route không trùng); npm test 67/67 PASS; test:business 9/9 PASS; test:render 92 route PASS; npm run build PASS; bash init.sh PASS với dotnet build/test chạy m:1 do giới hạn tiến trình của môi trường; git diff --check PASS; sinh được SQL upgrade từ migration toạ độ tới migration mới.
- Giới hạn kiểm chứng: chưa chạy SQL Server thật, chưa thử PayOS/ngrok bằng key thật, chưa kiểm khoá/đồng thời trên SQL Server hay migration trên dữ liệu DB của nhóm. F35 giữ active, không tuyên bố 7 flow hoàn tất. Các cảnh báo dependency NU1902/NU1903 và nullable Board.cs:317 đã có từ nguồn.
- Chỉ bàn giao ZIP/bản vá để người dùng áp dụng và chạy thử trước khi tự push nhánh. Không push/PR/merge từ phiên này.


## 2026-10-20 — F36: Cấu trúc frontend và quy tắc đặt tên

- Nền: nhánh thanh toán người dùng đã push, b482840; giữ sửa DbSeeder. Chỉ đổi cấu trúc FE và hướng dẫn, không đổi nghiệp vụ/URL/API/localStorage.
- Chuyển 79 file; tách 6 module gom trang thành từng Page theo chức năng. Phần chung Staff/Manager dùng facility-operations; app chứa router/provider chung; shared chứa UI/API nền/utils.
- Tên component Page khớp tên file. Thêm FRONTEND-MAP.md, docs/frontend-naming.md, hướng dẫn AGENTS trong FE và chỉ dẫn Copilot; CLAUDE.md hiện trỏ AGENTS gốc. Có npm run check:structure.
- Test chỉ cập nhật import/module path, giữ assertion. Kiểm tra 532 khai báo AST tương đương sau đổi tên identifier/import/export.
- Kiểm chứng: check:structure PASS; npm test 67/67; test:business 9/9; test:render 92 routes; build PASS; init.sh PASS (dotnet dùng -m:1 do giới hạn môi trường); git diff --check PASS. Các cảnh báo dependency/nullable/chunk size cũ vẫn còn.
- Chưa kiểm thử lại tương tác trình duyệt/API thật; SSR không bao phủ thao tác. ZIP dùng git apply để thêm file mới và xoá file cũ, có kiểm tra trước khi áp dụng. Không push/PR/merge.


## 2026-10-21 — F37 tách backend C13 và S05/C12

- Theo yêu cầu mới nhất của người dùng, chỉ chuẩn bị hai luồng đã kiểm tra đạt để push trước; gói backend độc lập trên main fc83c3a. Không đưa phí trả kho, huỷ/hoàn tiền, migration hay frontend vào bản vá. Giữ các công việc đang làm dở ở thư mục/nhánh cũ.
- C13 kiểm tên và mật khẩu, lỗi đầu vào trả 400; test đọc lại database và kiểm tài khoản khác không đổi. S05/C12 ánh xạ chủ đề hợp lệ, đọc ticket theo cơ sở hợp đồng, chuẩn hoá trạng thái/ghi chú, lưu audit phản hồi và trả nội dung cho chủ ticket.
- Gộp phần hỗ trợ từ bản bổ sung đã bàn giao; loại bỏ các hunk S04 dùng chung trong StaffService để không phụ thuộc FinanceService. Giữ nguyên hàm trả kho của main. Code cũ giữ trong comment // ở các đoạn thay đổi.
- Kiểm chứng: .NET SDK 10.0.402; build -m:1 PASS; xUnit 34/34 (15 test main + 19 trường hợp AuthSupport, SQLite); check:structure PASS; FE 68/68; business 9/9; SSR 92 route PASS; build FE và init.sh PASS. init dùng wrapper dotnet thêm -m:1 do giới hạn tiến trình; không sửa init.sh.
- Cảnh báo có sẵn NU1902/NU1903, nullable Board.cs và kích thước chunk/font frontend vẫn còn. Chưa chạy SQL Server thật cho bản tách riêng. Người dùng đã báo C13 và S05/C12 đạt trước khi tách; cần kiểm tra lại sau khi áp dụng. F37 giữ active.
- Figma từ chối quyền đọc thiết kế/ảnh; không có thay đổi giao diện và không tuyên bố đã đối chiếu thiết kế trực tiếp.
- Không push/PR/merge. Bàn giao patch, danh sách file và hướng dẫn tạo worktree riêng để người dùng tự kiểm tra, commit và push.

## 2026-10-22 — F38 đồng bộ giao diện và luồng Figma
- Nền 0e70026, giữ thay đổi quản trị và Auth/Support mới trên main. Tính năng phiên này duy nhất F38; không đổi trạng thái F35/F37 đang chờ nhóm kiểm chứng.
- Người dùng chọn "Hệ thống tự chọn" khi hỏi cách phân bổ sau PayOS. D26 thay yêu cầu bàn giao, PIN8 và phân bổ thủ công thường lệ. Vì vậy các assertion cũ yêu cầu webhook không phân bổ, bàn giao kích hoạt, PIN8, QR bị khóa trước nhận chìa khóa cần cập nhật theo nghiệp vụ mới; giữ kiểm tiền, quyền sở hữu, chống trùng và các kiểm chứng khác.
- Đang kiểm chứng toàn bộ FE/BE, tương tác trình duyệt và ZIP. Chưa tuyên bố PayOS/SQL Server/thiết bị thật đạt.

- Bàn giao F38: frontend cuối 76/76, SSR 92 route, check:structure/build đạt; business 9/9; backend build + 40 test SQLite trong phiên. Browser 13 nhóm PASS, so ảnh header trước/sau cuộn ở 5 role không đổi; hủy xác nhận không request, xử lý xong giảm badge, thất bại giữ draft, mobile không tràn. Chưa xác nhận SQL Server/PayOS/thiết bị thật; xem docs/figma-ui-sync-2026-10-22.md.

## 2026-10-22 — D27 chốt chính sách cọc và hoàn tiền

- Nhóm chốt theo D27 (DECISIONS.md): cọc 1 tháng thuê, hủy trước StartDate giữ 10% cọc, dừng sau StartDate hoàn 70% cọc, phương án B cho tiền thuê khi dừng giữa kỳ, phạt quá hạn theo tham số OVERDUE ở B02, DamageFee và OverdueFee trừ thêm vào cọc.
- Chưa có code: feature_list.json không đổi trạng thái vì chưa có bằng chứng chạy. Phần cần làm đã ghi trong BACKEND-TODO.md mục D27.
- Cần đổi: H1 cancel-preview và CANCEL_FEE_RATE đang tính 10% tiền thuê, không theo D27. T05 trong doc vẫn để "theo chính sách đã chốt".

## 2026-10-22 — F39 code chính sách cọc và hoàn tiền D27 (T01, T05, T08)

- Tính năng phiên này duy nhất F39; nền origin/main 248a083. Làm theo D27, không đổi quyết định.
- Backend: RefundPolicy (hàm thuần), cancel-preview, huỷ đơn đã thanh toán ghi một khoản REFUND PENDING, M07 xác nhận hoàn cho đơn đã huỷ, ConfirmRefundAsync hợp đồng tính theo D27 và chỉ trừ trong phạm vi cọc (phần thiếu giữ thành công nợ). Chính sách OVERDUE seed đổi mô tả thành 5% tiền thuê tháng mỗi ngày trễ.
- Frontend: cancelPreviewOf đổi sang 10% tiền cọc; test huỷ đơn (C14a) cập nhật số mong đợi 4.600.000 − 115.000. Không sửa test nào để cho qua; chỉ đổi số liệu theo D27.
- Kiểm chứng: FE npm test 76/76. Backend: phiên này không có .NET SDK nên chưa biên dịch và chưa chạy test; đã thêm RefundPolicyTests (11 trường hợp) và đối chiếu công thức tháng bằng bản tính độc lập. F39 giữ active, chưa passing.
- Giả định cần nhóm xác nhận: (1) dừng sớm thì khấu trừ cố định 30% đã bao gồm khoản vệ sinh 10%; (2) khoản CLEANING_FEE chờ thanh toán được coi là đã nằm trong khoản khấu trừ cố định; (3) quá hạn tính từ EndDate đến ngày biên bản trả kho; (4) khoản gia hạn (RENEWAL) không nằm trong phần hoàn tiền thuê.
- Không push/PR/merge.
- Bổ sung cùng F39 (cùng đợt, trước khi merge): (a) F12 ô kho RESERVED → OCCUPIED khi đến StartDate, qua UnitStartActivation chạy trong worker hiện có, có test ReservedUnitBecomesOccupiedOnStartDateOnly; (b) đường hoàn cọc cũ của quản lý gọi chung logic D27, bỏ ManagerService.ConfirmRefundAsync (lỗi: đặt trạng thái ENDED, không theo D27). Cả hai chưa biên dịch trong phiên viết code; cần dotnet build/test của nhóm. Còn lại: nút xác nhận hoàn đơn huỷ ở M07 trên giao diện.


## 2026-10-23 — F37 hoàn thiện nối API C13 và kiểm C12/S05

- Nền main 6d959ae. Người dùng yêu cầu hai task của Ngọc Mai; không sửa trả kho, thanh toán, cọc hay Figma.
- Phát hiện và sửa CHANGE_PASSWORD đọc sai tên trường (UI gửi current/next, provider đọc current_password/new_password). Sai mật khẩu hiện tại trả BAD_PASSWORD và hiện đúng trường.
- GET profile được dùng khi đăng nhập và khôi phục phiên; bỏ tên overlay cũ, đọc số điện thoại thật, cập nhật session từ response; bỏ closure session cũ trong UPDATE_NAME. Biểu mẫu khóa khi đang lưu và giữ dữ liệu nếu lỗi.
- C12/S05 đã có backend lưu/đọc activity_logs, ánh xạ responses và giao diện lịch sử. Bỏ fallback âm thầm che lỗi GET chi tiết ticket.
- Thêm 2 HTTP test Kestrel/JWT/SQLite file riêng và browser script với host .NET riêng. Host dùng endpoint/service thật; reservations trống chỉ để khởi động FE, không dùng chứng minh đặt kho/thanh toán.
- Kiểm chứng: .NET 10.0.100; build PASS; 54/54 xUnit (52 trước sửa + 2 HTTP); FE 76/76; business 9/9; SSR 92 route; check:structure/build PASS; init.sh PASS qua wrapper dotnet thêm -m:1 vì môi trường giới hạn tiến trình. Không sửa init.sh.
- Chromium Headless Shell 145: 10 nhóm browser PASS: profile API; tên sai/lưu/reload; mật khẩu xác nhận sai và mật khẩu hiện tại sai; JSON password chính xác + login lại; overlay cũ; lỗi mạng; gửi ticket; staff phản hồi; lịch sử + mobile; tài khoản khác và không pageerror.
- Trong lúc xây browser test, chỉnh selector theo chủ đề UNIT đang hiển thị (LOCK là legacy bị ẩn), đợi login staff trước khi điều hướng và chọn li lịch sử chứa timestamp. Không đổi nghiệp vụ hay giảm assertion.
- Cảnh báo dependency NU1902/NU1903, nullable Board.cs, font/chunk frontend có sẵn từ main. Chưa chạy SQL Server của nhóm. F37 giữ active; không nói hệ thống không có lỗi.
- Chỉ bàn giao ZIP + patch. Không push/PR/merge.


## 2026-10-23 — F37 ghép frontend Mai C12/C12b/C13 trên main mới

- Nguồn task ZIP SSFRMS_Frontend_AuthSupport_Figma_2026-10-22, 29 file khớp e615dad. Nền main 6d959ae; chỉ lấy thay đổi C12/C12b/C13 và guard phản hồi S05, không merge lịch sử nhánh cũ.
- Giữ StickyHeader/PendingBadge, polling/thông báo, OTHER subject, yêu cầu cấp lại QR/PIN/key, modal STAFF, /api/ops chuẩn và RECORD_KEY_RECEIPT. Thêm timeline, preview, retry, asset/CSS theo gói đã có, trạng thái thiếu thông tin C13. Không gọi hay sửa Figma trong phiên.
- Provider kiểm token/userId khi applyProfile, đọc hồ sơ qua API, không ghi đè phone khi chỉ đổi tên; mật khẩu dùng đúng payload và BAD_PASSWORD/400 tương thích. Ticket detail lỗi có cờ lỗi/retry, giữ dữ liệu đã tải được; vẫn truyền 401. Normalize danh sách null của board mà không thay API.
- Thêm D28 cho Playwright devDependency để tránh trùng D26. Giữ toàn bộ các test main; thêm 3 test ghép API/mapper/null board; SSR thêm 2 route. Test mock của Mai đổi sang /api/ops, bấm xác nhận staff và giữ phone khi request không chứa phone; không nới assertion. Thông báo tên trống đồng bộ câu chữ gói Mai; sai mật khẩu tương thích cả error code mới và message backend cũ.
- Kiểm: FE 79/79, Business 9/9, SSR 94, Playwright mock 14/14; .NET 54/54, 10 nhóm Chromium gọi backend Kestrel/JWT/SQLite riêng. Build/structure/init PASS, init wrapper thêm -m:1. Đã xem C12b desktop/C13 mobile. Chưa chạy SQL Server của nhóm; F37 giữ active.
- Không thay backend tài chính, schema/migration hoặc config. Chỉ ZIP/patch, không push/PR/merge. Xem docs/mai-auth-support-integration.md.
## 2026-10-24 — Cập nhật quy định AI/Git và tài liệu kiểm chứng

- Theo yêu cầu thành viên: sửa quy định một lượt và bàn giao ZIP để thành viên tự push; không thao tác commit/push/PR/merge.
- Phạm vi chỉ tài liệu: AGENTS gốc/FE, README, docs/conventions.md, docs/verification.md, DECISIONS.md và nhật ký này.
- AI không tạo commit, không đổi danh tính Git. Giữ PR → main và review bởi thành viên khác; task có mục tiêu rõ, kiểm thử theo phạm vi, nêu giới hạn môi trường.
- Figma chuẩn bố cục/tương tác, nghiệp vụ/quyền theo quyết định hiện hành; yêu cầu mock/offline nhận biết khi kiểm thử, không giả API thành công.
- Sửa hướng dẫn .NET 10/Node >=22.12, bản đồ apiMappers.js và cấu trúc FE; bỏ số test cũ và khẳng định fallback/API badge đã lỗi thời.
- Không sửa code/config/migration, không đổi trạng thái tính năng hoặc ghi đè nhật ký cũ. Ghi quy tắc thay thế tại PROCESS-2026-10-24, không sửa quyết định lịch sử.
- Kiểm chứng gói tài liệu: đọc diff, kiểm đường dẫn/lệnh với nguồn, kiểm whitespace, áp dụng bản vá vào bản nguồn sạch và so byte đầu ra; kiểm tính toàn vẹn ZIP. Không chạy ứng dụng, npm/dotnet build/test hoặc SQL Server vì không đổi code; không nhận kết quả từ PR khác làm bằng chứng.
