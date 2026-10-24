# SSFRMS — Review các nhánh CI/CD trước khi merge

Ngày kiểm tra: 24/10/2026. Đây là review source và kiểm chứng local; chưa merge, push, commit hay deploy lên repo/server.

## Kết luận

**Chưa nên merge toàn bộ CI01–CI08 vào main.** Có lỗi làm GitHub Actions không chạy, frontend deployment gọi localhost, script deploy chưa kết nối server, và production/rollback chưa bảo đảm chạy đúng release. CI01 riêng có thể cân nhắc sau khi xử lý conflict tài liệu và chạy kiểm chứng trên candidate mới; các nhánh sau cần sửa trước.

Backend build và unit test tốt không đồng nghĩa CD đã hoạt động. Không dùng state `passing` trong feature_list.json thay cho bằng chứng CI/SQL/container/deploy thật.

## 1. Snapshot và quan hệ nhánh

Main được kiểm tra: `48937abe2bdb45587dcb5ad95810838fc78555a0`.

| Task | Remote branch / commit | Nhận định |
|---|---|---|
| CI01 | feature/cicd-ci01 — ea713ff | Phần SDK/tool/init hợp lý; conflict docs/verification.md với main. Có thể tách merge sau kiểm chứng candidate |
| CI02 | feature/cicd-ci02 — 1cc7a66 | Chặn: action SHA không tồn tại, report PASS hardcode |
| CI03 | feature/cicd-ci03 — e0ddad1 | Build/unit pass ở bản cuối; cần sửa proxy trust, cấu hình CORS/default validation; vẫn kế thừa CI02 lỗi |
| CI04 | feature/cicd-ci04 — af0032c | Có integration tests thật trong source; chưa có bằng chứng SQL Server run tại phiên review; kế thừa workflow lỗi |
| CI05 | feature/cicd-ci05 — 7e53130 | Chặn: web image chưa có API URL cùng origin, container gate chưa chạy migrator/stack/smoke |
| CI06 | Không có remote branch riêng; commit b11d908 | Commit nằm trong lịch sử CI07/CI08; chặn: deployment target, manifest/image/env/backup chưa hoàn chỉnh |
| CI07 | feature/cicd-ci07 — 21d4dc8 | Chặn: production provenance, JSON parser, biến chưa khai báo, digest reference và target host |
| CI08 | feature/cicd-ci08 — 703a6a8 | Chứa đủ 8 commit CI01–CI08; chặn: rollback và các lỗi kế thừa; conflict DECISIONS.md + docs/verification.md |

Đây là chuỗi nhánh stacked, không phải 8 bản độc lập. CI08 đã chứa toàn bộ task trước đó. Main có 12 commit sau common ancestor `6d959ae`; CI08 có 8 commit riêng. Khi thử merge-tree với main, CI01/02/03/04/05/07 đều conflict docs/verification.md; CI08 thêm conflict DECISIONS.md.

Đừng dùng “accept theirs” cho toàn bộ tài liệu. Main đã cập nhật AGENTS/quy trình `PROCESS-2026-10-24`: AI không tự commit/push/PR/merge. Giữ quy trình mới và ghép thêm nội dung CI/CD chính xác.

API GitHub công khai tại thời điểm review trả `actions/runs.total_count = 0`; không thấy PR CI/CD trong danh sách PR. Không có bằng chứng Actions đã xanh từ các nguồn truy cập được. Không suy ra branch push đã chạy CI: workflow chỉ trigger PR vào main, push main và manual dispatch, không trigger mọi feature push.

## 2. Những gì đã chạy thật

Trên worktree độc lập ở HEAD CI08, không sửa source:

| Kiểm tra | Kết quả |
|---|---|
| npm ci | PASS |
| npm run check:structure | PASS |
| npm test | 76/76 PASS |
| npm run test:business | 9/9 PASS |
| npm run test:render | 92 lượt render PASS |
| npm run build | PASS; JS output vẫn chứa API mặc định localhost:5151 |
| dotnet tool restore | PASS, EF 10.0.12 |
| dotnet build StorageProject.slnx -c Release -m:1 | PASS, 0 errors; SDK 10.0.402, runtime 10.0.13 |
| dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release --no-build --no-restore | 57/57 PASS |
| dotnet ef migrations has-pending-model-changes --project StorageProject.Infrastructure --startup-project StorageProject.Api --configuration Release --no-build | PASS, không có model drift |
| bash -n các script Bash | PASS về syntax; không chứng minh runtime đúng |
| Kiểm SHA action qua GitHub commits API | 2 reference không tồn tại, xem R01 |
| Generator thiếu digest | Exit 0, tạo digest toàn số 0 và ghi các gate success — lỗi đã tái hiện |
| Production script đọc manifest generator tạo | Exit 1 ở bước parse — lỗi đã tái hiện |
| Production script với manifest tối giản đọc được | Exit 1: CI_GATE unbound variable ở dòng 89 — lỗi đã tái hiện |
| SQL Server integration / Docker / GitHub run / VPS / backup-restore thật | Chưa chạy trong phiên review |

Lần build mặc định đầu tiên gặp giới hạn MSBuild trong môi trường review; chạy serial `-m:1` thành công. Không quy lỗi môi trường đó cho repo. NuGet cũng phát NU1902/NU1903 cho System.Security.Cryptography.Pkcs 9.0.11; cần truy dependency và xử lý phù hợp, chưa kết luận đây là hồi quy từ CI/CD.

## 3. Findings cần sửa

### R01 — P1: CI pin vào action commit không tồn tại

File `.github/workflows/ci.yml`, dòng 83/154 và 55/114/181/324:

- setup-dotnet: `3951f0adf7a4399ed659394f4f7140f92f89a7ab`.
- upload-artifact: `4cec3d8aa04e39d1a68397de0c4cd6fb9dce6ec1`.

GitHub API trả 422, `No commit found for SHA`. Workflow không resolve được actions này. Production workflow đang dùng upload-artifact SHA khác, tồn tại: `4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1`.

**Sửa:** xác minh và thay từng full SHA chính thức, đồng bộ workflows. Chạy PR CI thật. YAML lint hoặc độ dài 40 ký tự không chứng minh SHA tồn tại.

### R02 — P1: Frontend đóng gói vẫn gọi localhost

Web Dockerfile dòng 13–15 chỉ COPY rồi build, không cung cấp `VITE_API_URL` hoặc cấu hình cùng origin. `src/app/config/api.js` fallback `http://localhost:5151`.

Clean build đã tạo `dist/assets/index-DYcxDIMg.js` với logic fallback localhost. Không có env override trong clean Docker context thì browser người dùng sẽ gọi backend trên máy của chính họ.

**Sửa:** build web với `VITE_API_URL=/`, `VITE_USE_API=true` hoặc sửa config cùng origin được test. Không đặt `/api` vì request path đã có `/api`. Env khi chạy Nginx không thay đổi Vite bundle đã build. Kiểm bằng browser/network trên bản container.

### R03 — P1: Deploy workflow chạy trên máy GitHub tạm, chưa tới VPS

ci.yml dòng 369 và deploy-production.yml dòng 196 gọi script Docker trực tiếp trên `ubuntu-latest`. Không có SSH, remote Docker context hay self-hosted deployment runner. Không có bước map secrets cần thiết vào runtime/env file.

Bật ENABLE_STAGING_DEPLOY/ENABLE_PRODUCTION_DEPLOY không biến runner thành VPS. Các lệnh hiện tại sẽ thao tác Docker của runner và không có deployment state/DB/env trên server thật.

**Sửa:** chọn explicit SSH đến host đã xác minh host key hoặc deployment runner riêng được kiểm soát. Chuyển manifest/config/script tới release directory trên host; secrets giữ tại host/secret store; thực thi và smoke public URL. Không chạy PR code trên runner production.

### R04 — P1: Manifest digests, Compose variables và env file không nối đúng

- deploy.sh dòng 39–41 đọc digest vào shell variables nhưng không export cho Compose; staging cần API_IMAGE/WEB_IMAGE/MIGRATOR_IMAGE.
- Production dòng 95–97 export chỉ `sha256:<hex>`. Compose image cần `ghcr.io/.../api@sha256:<hex>`, không phải một digest trần. Rollback mắc cùng lỗi.
- Tham số ENV_FILE được nhận nhưng không dùng `--env-file` ở các lệnh Compose. Riêng `.env.production` sẽ không tự được chọn chỉ vì biến này có giá trị.
- deploy/.env.example dùng `ConnectionStrings__DefaultConnection`, `JwtSettings__Secret`, `PayOS__*`; Compose lại yêu cầu `DATABASE_CONNECTION_STRING`, `JWT_SECRET`, `PAYOS_*`, `SA_PASSWORD`... Copy template không đáp ứng required variables.
- Pre-pull đang comment; không có kiểm chứng registry image thực sự tồn tại trước khi stop app.

**Sửa:** parser trả full image references theo `images.<service>.image + '@' + digest`; validate registry/repository/digest; export đúng key hoặc tạo file config release không chứa secret; mọi lệnh dùng cùng `--env-file`/project name; thống nhất template và biến, pull thật và fail nếu pull lỗi.

### R05 — P1: Parser JSON làm production và rollback dừng ngay

deploy-production.yml dòng 109–111, promote-production.sh dòng 60–62 và rollback.sh dòng 80–81 dùng `grep -A 2` từ dòng `"api": {`. Generator ghi `image`, `tag`, rồi mới `digest` ở dòng thứ ba sau header nên parser bỏ mất digest. Với pipefail script dừng.

Khi dùng manifest tối giản để vượt qua parser, promote-production.sh dòng 89 lại truy cập `${CI_GATE}` chưa khai báo và dừng vì set -u.

**Sửa:** dùng jq hoặc parser JSON chuẩn, validate schema thật và bỏ biến lỗi. Thêm kiểm tra generator -> parser -> config dùng cùng manifest để bắt lỗi kết nối giữa các script.

### R06 — P1: Production chưa xác minh đúng provenance của release

deploy-production.yml dòng 60–89: nhập run_id sẽ bỏ qua bước tìm successful CI theo SHA/main; workflow tải artifact nhưng không xác minh run đúng workflow/event/branch/conclusion/head SHA. Parser không đối chiếu commit trong manifest với release_sha input, repository/runId với run metadata. Có fallback repository manifest khi tải thất bại. Không có bằng chứng staging thật đã pass; staging disabled vẫn exit 0.

Generator còn tự điền all-zero digests khi thiếu đầu vào và ghi gateResults success cố định. Generator không phải nguồn chứng thực job đã pass.

**Sửa:** fail closed. Kiểm GitHub run metadata và exact artifact, SHA/repo/runId, successful trusted main push, deployment staging success riêng cho cùng digest. Bỏ fallback giả lập khỏi production, từ chối digest zero/missing, lấy kết quả gate thật. Standby không được coi là staging đã test.

### R07 — P1: release_sha bị nội suy vào shell trước khi validate

deploy-production.yml dòng 43 gán trực tiếp expression vào source Bash. Regex ở dòng sau không ngăn command substitution đã diễn ra khi shell chạy dòng gán.

**Sửa:** truyền input qua `env: INPUT_SHA: ${{ inputs.release_sha }}`, sau đó regex/quote `$INPUT_SHA` trong script. Đây là cách tránh script injection theo GitHub secure-use docs. Không thực thi input để “kiểm tra” nó.

### R08 — P1: Có đường báo deploy thành công dù backup/migration/smoke chưa đạt

- deploy.sh dòng 63–65 nuốt backup failure, dòng 87 nuốt seed failure và gọi --seed-reference trong bước tự mô tả là staging fixture seed.
- deploy.ps1 dòng 45–47 chỉ in `Simulating migration run`; không migrate/up services thật. Dòng 51–55 bắt lỗi smoke rồi vẫn copy current manifest và báo completed.
- Production có nhánh cho phép tiếp tục nếu backup script mất. Backup SQL command không dùng chế độ fail-on-SQL-error như sqlcmd -b; kiểm file tồn tại chưa chứng minh restore được.

**Sửa:** backup bắt buộc có exit code và verify/restore test. Migration, seed khi được yêu cầu, smoke đều phải fail pipeline. Bỏ simulation khỏi script production-ready hoặc tách rõ file mock không được workflow/runbook gọi. Không ghi current release khi chưa deploy thật.

### R09 — P1: ci-gate chưa kiểm bản đóng gói như tài liệu mô tả

ci.yml container-build chỉ build API/web; không build migrator, không up stack, không gọi smoke, không browser test. Staging/production compose config errors bị bỏ qua bằng `|| true` ở dòng 211–212. Các Step Summary if:always hardcode PASS kể cả bước trước fail.

smoke.sh bước 5 chỉ grep index.html; không tải JS/CSS/font hoặc quan sát browser API request. Nó không thể phát hiện lỗi localhost nằm trong JS bundle (R02).

**Sửa:** cung cấp dummy config hợp lệ để validate mọi Compose file, không bỏ lỗi; build cả migrator; chạy SQL+stack tạm, health/readiness, asset và browser smoke; summary lấy outcome/result và test report thật. Cổng tổng ci-gate hiện đã có cách tổng hợp dependency hợp lý, cần giữ lại.

### R10 — P1: Rollback có thể chọn sai bản và chạy đồng thời với deploy

rollback.sh dùng lock `/tmp/safespace-rollback.lock`; deploy staging/prod dùng hai lock khác. Rollback không ngăn deploy cùng environment. Check-then-write PID file cũng không phải atomic lock.

Rollback tìm file gần nhất thứ hai trong thư mục chung hoặc fallback current, không chứng minh đó là previous release cùng environment. Staging deploy không lưu lịch sử previous. Compose api phụ thuộc migrator; `up api web` không tách dependency nên không bảo đảm rollback app-only, và production rollback chưa quản lý migrator image phù hợp.

**Sửa:** một atomic lock chung theo environment cho deploy/rollback; current/previous state riêng có release ID; chọn explicit previous manifest, validate full image references; chỉ recreate app/web sau khi chứng minh schema compatible, không rerun migration/seed trong rollback. Thử rollback lỗi readiness trên staging và kiểm state cuối.

### R11 — P2: Runtime production config chưa chặt như mô tả

Program.cs dòng 101–102 clear cả KnownIPNetworks/KnownProxies, thành trust mọi forwarded header; dòng 113 cho AllowAnyOrigin khi danh sách origins trống dù production. JWT chỉ loại null/empty và đúng một placeholder, chưa kiểm đủ độ dài/placeholder khác. Caddyfile chưa được ghép thành dịch vụ hoặc cấu hình host tương ứng trong Compose/runbook đủ để chạy end-to-end.

**Sửa:** proxy/network allowlist có kiểm chứng, cấu hình same-origin/CORS rõ ràng, fail invalid production JWT. Kiểm TLS termination/forwarded scheme không bị Nginx ghi đè thành http, redirect loop và IP rate-limit qua edge thật.

### R12 — P2: Docker ignore chưa bảo vệ đúng web build context

Root .dockerignore không áp dụng cho web build context là thư mục frontend. Context này không có .dockerignore riêng và Dockerfile COPY . .; local env/node_modules có thể bị copy vào build stage/cache. Root ignore cũng chưa loại mọi appsettings override/private env pattern.

**Sửa:** thêm ignore theo context hoặc đổi về root context có rule phù hợp. Test context không mang .env.local, .env.production, appsettings overrides hoặc credential thật. Không chỉ kiểm final runtime layer.

### R13 — P2: Tài liệu và trạng thái completion vượt bằng chứng

docs/cicd.md nói feature push chạy CI, container gate build migrator/up stack/smoke, provenance/staging được bảo vệ và deploy pull digest; source hiện chưa làm đầy đủ. feature_list đánh dấu mọi CI task passing nhưng không có Actions run được truy cập để đối chiếu, một số script chỉ simulate.

**Sửa:** cập nhật theo behavior thực; ghi local-pass / chưa kiểm chứng external, không dùng câu “hoàn thành toàn bộ” trước khi có run ID, staging release state và restore/rollback evidence. Giữ lịch sử và bổ sung mục sửa sai, không xóa evidence cũ để che vấn đề.

## 4. Cách tổ chức sửa và merge

Khuyến nghị một candidate tích hợp từ CI08 vì đã chứa 8 task. Trước tiên đưa main mới vào candidate, giải quyết conflict tài liệu bằng tay và giữ AGENTS mới của main. Sau đó sửa R01–R10 và các cấu hình deployment liên quan; chạy lại quality gates. Chủ repo tự commit/push/mở PR theo AGENTS.

Không cần merge 7 nhánh tuần tự chỉ để có đủ tính năng; CI08 chứa cả CI06. Nếu muốn review từng task, tạo stacked PR có base là nhánh trước, chỉ thay base về main khi dependency đã merge. Squash từng nhánh vào main rồi merge các nhánh kế thừa có thể làm lịch sử/diff lặp khó review; nên thống nhất chiến lược trước.

Có thể tách thành hai PR dễ nghiệm thu:

1. **CI:** SDK/init/workflow, backend config tối thiểu, SQL integration và container smoke thực; main chỉ nhận sau khi ci-gate xanh trên merge candidate. Chưa bật CD.
2. **CD:** host execution, verified manifests, full digest refs, env, backup, production promotion và rollback; chỉ nhận khi script có kiểm chứng thật ở staging.

Điều kiện merge cuối:

- Không conflict với main và không ghi đè quy trình mới.
- Actual Actions ci-gate success cho HEAD mới; thử một lỗi test để thấy gate fail đúng.
- SQL integration chạy với REQUIRE_SQLSERVER=true, không return sớm rồi báo pass.
- Docker build cả API/web/migrator, chạy health/API/browser smoke thật.
- Thiếu config/image/artifact, digest zero, run/SHA không khớp, backup/migration/smoke lỗi đều chặn đúng.
- CD chưa đủ bằng chứng phải disabled rõ; không tuyên bố sẵn sàng production.
- Có staging evidence cho deploy/rollback đúng image, DB không reset; backup restore test.

## 5. Cách pipeline phải hoạt động sau khi sửa

### PR/CI — kiểm tra code trước khi merge

Developer push feature rồi mở PR vào main. Workflow chạy frontend, backend, SQL integration và container gate. ci-gate chỉ xanh khi tất cả bắt buộc thành công. Chủ repo bật branch rule/ruleset yêu cầu ci-gate và review; có file workflow không tự tạo branch protection.

Xem repo -> Actions -> CI -> run tương ứng -> từng job/log; tải TRX/report khi fail. Chưa có server/domain vẫn chạy CI được. Với trigger hiện tại, chỉ push feature mà chưa có PR sẽ không chạy CI.

### Main/release — tạo bản đóng gói

Sau merge, CI chạy lại trên main SHA. Gate pass mới push API/web/migrator lên GHCR và sinh manifest chứa SHA, run ID, image names + digests, migration head và kết quả thật. Tag giúp tìm bản; digest xác định chính xác bytes được phát hành.

### Staging — môi trường kiểm thử triển khai

Staging là site/database riêng để thử trước production. Chuẩn bị host Docker/Compose, quyền pull GHCR, DB, domain/TLS, env thật tại host; kiểm thử bootstrap một lần. Không copy nguyên env example hiện tại rồi bật deploy vì key đang lệch.

Giữ ENABLE_STAGING_DEPLOY=false cho đến khi R03/R04/R08/R09 đã sửa và host sẵn sàng. Khi bật true, runner gửi release tới host, lock, pull digest, backup, maintenance/migrate, up, readiness, smoke public URL, rồi mới ghi deployment success/current release. Không dùng database production cho staging.

### Production — promote bản staging đã pass

Chuẩn bị Environment production, secrets tách staging và required reviewer/branch restriction nếu tài khoản hỗ trợ. Sau staging success thật cho release, vào Actions -> Production Promotion & Deployment -> Run workflow, chọn main, nhập full release_sha và run_id nếu cần. Workflow phải xác minh run và staging receipt trước khi dùng production credentials.

Production dùng nguyên image digest đã test, không rebuild. Backup fail thì dừng; migration fail thì không bật app mới; readiness/smoke fail thì không ghi current success. PayOS webhook/return URLs cấu hình theo domain HTTPS thật. Manual dispatch không thay thế kiểm chứng provenance.

### Rollback — đưa app về bản trước khi phát hành lỗi

Dùng previous manifest đã xác minh cùng environment sau khi xác nhận schema tương thích. Giữ DB schema, không chạy EF Down tự động; không down -v. Restore database từ backup là thao tác riêng có chấp nhận mất writes sau backup. **Chưa chạy các lệnh rollback hiện có cho dữ liệu thật trước khi sửa R04/R05/R10.**

## 6. Prompt giao agent sửa

> Review đã xác nhận các nhánh CI01–CI08 chưa sẵn sàng merge. Làm trên candidate chứa CI08 và cập nhật main mới, đọc AGENTS.md hiện tại của main (AI không commit/push/PR/merge). Giải quyết conflict DECISIONS.md/docs/verification.md, giữ quy trình PROCESS-2026-10-24. Sửa findings R01–R13 trong báo cáo này theo thứ tự ưu tiên: SHA actions, API URL web build, gate/container smoke thật, JSON parser/schema/provenance, full image@digest và env mapping, target server, backup fail-closed, loại simulation PowerShell, rollback atomic lock/state riêng. Không thay nghiệp vụ hoặc migration lịch sử. Không cấp pass dựa trên report hardcode hoặc integration test return khi thiếu SQL. Kiểm chứng FE, BE, model drift, SQL Server REQUIRE_SQLSERVER=true, API/web/migrator containers và browser smoke; test fail paths cho missing digest/run mismatch/backup/migration/smoke. Thiếu hạ tầng thì hoàn thành code kiểm chứng được và ghi rõ external chưa chạy, không tự deploy. Bàn giao diff, bằng chứng lệnh/run ID, hướng dẫn chủ repo tự tạo PR và cấu hình host/Secrets. Không tự tạo commit hay sửa trạng thái passing nếu chưa đáp ứng bằng chứng và quy trình repo.

## Tham khảo

- Source snapshot: https://github.com/ryocoding13/SSFRMS/tree/703a6a8039a9ddcb215f8c17ac3e11f027890d43
- GitHub secure use / shell input: https://docs.github.com/en/actions/reference/security/secure-use
- Docker Compose env interpolation: https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/

Các đường dẫn/dòng trong findings chỉ tới snapshot CI08; khi agent sửa phải dùng số dòng mới và kiểm chứng lại. Không xem đây là kết quả kiểm thử deployment thật.
