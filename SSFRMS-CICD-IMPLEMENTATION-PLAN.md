# SSFRMS — Kế hoạch triển khai CI/CD bằng GitHub Actions

> Tài liệu giao trực tiếp cho coding agent. Ngôn ngữ làm việc: tiếng Việt.
> Repo: https://github.com/ryocoding13/SSFRMS
> Baseline đã kiểm tra: nhánh `main`, commit `6d959aef4b54e4e9558e2db772fd1d50dda85c13` — `Merge pull request #22 from ryocoding13/feat/d27-refund`.
> Đây là kế hoạch triển khai, chưa phải thay đổi đã áp dụng lên GitHub hay server. Agent phải đối chiếu HEAD mới trước khi sửa.

## 1. Mục tiêu và phạm vi

Thiết lập pipeline để mọi PR được build/test tự động; commit trên main đạt kiểm chứng được đóng gói thành image; staging được cập nhật tự động khi hạ tầng đã sẵn sàng; production được phát hành bằng thao tác chọn release đã kiểm chứng. Có report, migration độc lập, smoke test và hướng dẫn rollback.

Triển khai lần lượt, mỗi phiên chỉ một task trong feature_list.json theo AGENTS.md. Không sửa nghiệp vụ thuê kho, PayOS, hoàn tiền, QR hoặc UI ngoài phần cấu hình cần thiết cho triển khai. Không tự nâng/hạ major framework.

**Chưa có thông tin nhà cung cấp hosting, server, domain, ngân sách hoặc database production.** Phương án bên dưới lấy Linux VPS x86_64 + Docker Compose + GHCR làm giả định thiết kế. Đây chưa phải hạ tầng đã tồn tại hay lựa chọn đã được chủ repo xác nhận. Hoàn thành CI, container, script, tài liệu và kiểm chứng local trước; chỉ phần kết nối hạ tầng thật phụ thuộc thông tin này. Không tạo cloud resource có phí.

## 2. Kết quả rà soát repo

Đã kiểm tra inventory 344 file được Git theo dõi và các vùng liên quan đến build/test/deploy: project manifests, package scripts/lockfiles, entrypoint, endpoints, service integrations, database/migrations/seeders, test suites, init scripts, AGENTS và tài liệu kiến trúc/quyết định. Đây không phải cam kết đã kiểm thử mọi use case.

| Hạng mục | Hiện trạng theo source | Ý nghĩa cho pipeline |
|---|---|---|
| Backend | `StorageProject.slnx`; Api, Core, Infrastructure, Tests đều `net10.0` | Cài .NET SDK 10, không lấy .NET 8 từ mô tả cũ |
| Database | EF Core SQL Server 10.0.12; 6 migration Up/Down, snapshot và các Designer | Giữ SQL Server; kiểm migration thật, không thay bằng SQLite |
| Backend tests | xUnit tại `StorageProject.Tests`, phần lớn dùng SQLite in-memory, gateway PayOS giả | Chạy nhanh không cần SQL Server; chưa chứng minh SQL Server migration/locking chạy đúng |
| Frontend | React 19, Vite 8; Node engine >=22.12 | Đề xuất Node 24 cho CI/container, ghi version thống nhất |
| FE root thật | `SafeSpace-Customer-UI/SafeSpace-Customer-UI` | Working-directory và npm cache phải trỏ đúng thư mục lồng này |
| Root package.json | Chủ yếu `concurrently`, lệnh backend/frontend/ngrok | Không chạy `npm run dev` để build, test hoặc deploy |
| FE tests | `npm test`, `test:business`, `test:render`, `check:structure` | Business test và structure check phải thêm riêng; init.sh chưa gọi cả hai |
| Render test | SSR bằng Vite + mock globals, chủ động đặt `VITE_USE_API=false` | Không gọi đây là browser E2E hay tích hợp API thật |
| API URL | `src/app/config/api.js`, mặc định localhost:5151; client nối `${API_URL}${path}` | Deployment phải cung cấp URL khác localhost; path đã có `/api` |
| Startup | `Program.cs` luôn MigrateAsync, DbSeeder, FacilityCoordinateSeeder | Tách migration và seed khỏi startup trên môi trường deploy |
| Health | `/health` chỉ trả JSON Healthy, chưa kiểm DB | Thêm readiness kiểm DB; health hiện tại là liveness |
| CORS / HTTPS | AllowAnyOrigin; UseHttpsRedirection; chưa cấu hình proxy tin cậy | Cần cấu hình phù hợp TLS termination, tránh redirect loop |
| Background job | ExpiredCashHoldWorker chạy mỗi phút, bắt đầu xử lý ngay | Không cho chạy trong lệnh migration/seed; ban đầu deploy 1 replica API |
| PayOS | Hai webhook `/api/payments/payos-webhook` và `/api/v1/payments/payos-webhook` | Giữ contract, dùng HTTPS public ổn định, không chạy giao dịch thật trong CI |
| Cấu hình bí mật | `StorageProject.Api/appsettings.json` đang được track; các trường PayOS có giá trị không giống placeholder | Xử lý như khóa có khả năng đã lộ; không sao chép giá trị vào report/log/image |
| Docker / Actions / E2E | Chưa thấy Dockerfile, Compose, workflow Actions hoặc cấu hình Playwright được track | Đây là các phần cần bổ sung |
| Tài liệu cũ | docs/verification và F28 còn ghi chưa có backend test, trong source đã có | Cập nhật tài liệu đúng bằng chứng; không tự đánh dấu F28 passing |
| init.sh | File mode 100644; dùng dotnet tool restore; tool manifest ở root `dotnet-tools.json` | Dùng `bash init.sh` hoặc sửa executable bit; restore EF tool bằng manifest rõ ràng |

### Baseline đã chạy

- `bash init.sh --fe-only`: PASS, gồm `npm test` **76/76**, render **92 lượt route**, build FE.
- `npm run check:structure`: PASS.
- `npm run test:business`: **9/9 PASS**.
- Node tại môi trường kiểm tra: 24.19.0.
- Build có cảnh báo đường dẫn 2 font Manrope và chunk >500 kB. Không chặn baseline, nhưng cần smoke test font khi serve bản build. Không refactor code splitting trong task CI/CD.
- Chưa chạy build/test backend, SQL Server, Docker hay deployment vì môi trường rà soát không có .NET SDK và chưa có hạ tầng deploy. Agent triển khai phải bổ sung bằng chứng, không viết “toàn bộ pass” từ kết quả FE.

## 3. Kiến trúc triển khai đề xuất

Trình duyệt truy cập một origin HTTPS. Reverse proxy phục vụ FE static và chuyển tiếp `/api/*`, `/health`, `/health/ready` đến API. API truy cập SQL Server qua mạng riêng.

| Thành phần | Đề xuất |
|---|---|
| Registry | GHCR: `ghcr.io/ryocoding13/ssfrms-api`, `ghcr.io/ryocoding13/ssfrms-web`, `ghcr.io/ryocoding13/ssfrms-migrator` |
| API image | Multi-stage .NET 10 SDK -> ASP.NET runtime, publish Release, chạy user không phải root |
| Web image | Node 24 build -> Nginx phục vụ dist; proxy giữ nguyên `/api` prefix |
| Migrator image | EF migration bundle + runtime thích hợp; entrypoint chạy xong và thoát |
| TLS edge | Caddy hoặc proxy TLS sẵn có; chỉ chọn một cách trong implementation |
| Database | Ưu tiên SQL Server hiện có/managed có kết nối riêng; tùy chọn SQL Server container cho staging/CI |
| Môi trường | Hai Compose project/config riêng, DB riêng, secrets riêng, domain riêng |
| API frontend | Build `VITE_API_URL=/`, `VITE_USE_API=true`; code hiện tại bỏ slash cuối thành chuỗi rỗng, client gọi `/api/...` cùng origin. Thêm regression test cho cách cấu hình này |

Không gán `VITE_API_URL=/api`: các endpoint đã bắt đầu bằng `/api`, sẽ tạo `/api/api/...`. Không để chuỗi rỗng ở env với code hiện tại vì `|| localhost` sẽ quay lại localhost. Nếu thay quy tắc config, sửa tối thiểu và test rõ.

VITE là cấu hình **build-time**. Env đặt lúc `docker compose up` không thay được JS đã build. Thiết kế cùng origin giúp staging và production dùng đúng cùng web image digest. Tuyệt đối không đưa JWT, SQL password hoặc PayOS key vào VITE_*/Docker build args.

VPS/SQL Server container cần kiểm tra RAM, kiến trúc CPU, backup và license phù hợp; không mặc định SQL Server Developer là license production. Nếu chưa chọn host, bàn giao đầy đủ các file và đánh dấu phần deploy thật chờ cấu hình.

## 4. Quy tắc bắt buộc cho agent

1. Đọc AGENTS.md, progress.md, feature_list.json, DECISIONS.md, docs/architecture.md, docs/verification.md. Khi sửa FE đọc thêm AGENTS frontend, docs/frontend-naming.md, FRONTEND-MAP.md.
2. Tạo các task CI/CD với ID mới không trùng; mỗi phiên active một task. Dùng sprint contract vì thay đổi nhiều file. Không chọn một tính năng nghiệp vụ unrelated chỉ vì nằm đầu danh sách.
3. Làm trên `feature/cicd-<task>`. **Không tự push, mở PR hay merge** theo quy định repo. Bàn giao commit/patch và lệnh để thành viên nhóm tự chạy.
4. Không sửa migration cũ, không xóa test để xanh, không dùng `continue-on-error` để bỏ qua build/test bắt buộc.
5. Không đổi hai cấp thư mục FE, không đưa ngrok vào deployment, không dùng SQL Express/Windows integrated auth của laptop trên runner/server.
6. Mọi bằng chứng ghi commit, tool version, lệnh, kết quả; không khẳng định Actions đã xanh nếu chỉ mới chạy local.
7. Thiếu host/domain/secrets không chặn việc làm CI/container/test/docs. Không tự deploy hay sửa settings GitHub trong nhiệm vụ chuẩn bị code.

## 5. Các task triển khai theo thứ tự

### Task CI01 — Chốt baseline và cấu hình tái lập

**File:** `global.json` mới, `dotnet-tools.json`, `init.sh`, tài liệu kiểm chứng; metadata feature/progress.

- Kiểm tra HEAD mới và chạy baseline đầy đủ trước sửa. Nếu lỗi có sẵn, lưu nguyên lỗi và phân biệt với lỗi do CI/CD.
- Pin SDK 10.0.x bằng global.json theo patch khả dụng đã kiểm chứng; khớp policy `rollForward` với image SDK và setup-dotnet. Không điền version đoán.
- Pin Node 24 nhất quán trong workflow/Docker/docs. npm ci dùng lockfile frontend thực tế.
- Đọc tool manifest hiện tại `dotnet-tools.json` (dotnet-ef 10.0.12); dùng `dotnet tool restore --tool-manifest dotnet-tools.json`. Kiểm tra cách gọi tool ở bước sau thực sự tìm đúng manifest; nếu chuẩn hóa sang `.config/dotnet-tools.json`, cập nhật tất cả reference trong cùng task.
- Sửa executable bit hoặc thống nhất tài liệu/lệnh `bash init.sh`.
- Không cài root npm dependencies cho job frontend nếu không sử dụng root scripts.

**Nghiệm thu:** clean checkout chạy được restore/build/test với versions đã ghi; không phụ thuộc node_modules, .env.local, SQL Server laptop hay ngrok.

### Task CI02 — Workflow CI cho PR và main

**File mới:** `.github/workflows/ci.yml`; có thể thêm script gom lệnh CI để local và Actions dùng chung.

**Triggers:** pull_request vào main; push main; workflow_dispatch để kiểm thử CI. Ban đầu không dùng workflow-level path filters nhằm tránh required check bị pending với PR chỉ sửa docs. Nếu repo bật merge queue, bổ sung merge_group và kiểm chứng riêng.

**Jobs bắt buộc:**

| Job / check name ổn định | Lệnh và kết quả |
|---|---|
| `frontend` | setup Node; npm ci đúng FE root; check:structure; npm test; npm run test:business; npm run test:render; npm run build |
| `backend` | setup .NET; restore solution/tool; build Release; test xUnit, xuất TRX; publish API Release |
| `sqlserver-integration` | SQL Server tạm; migration chain; seed staging; gọi API thật; kiểm chứng ở CI04 |
| `container-smoke` | Sau khi có Dockerfile: build image không push, chạy stack tạm và readiness/browser smoke |
| `ci-gate` | needs tất cả job bắt buộc, chạy always và fail nếu bất kỳ dependency failed/cancelled/skipped không hợp lệ |

Giai đoạn đầu có thể giao CI02 với frontend/backend và ci-gate; CI04/CI05 bổ sung gate còn lại trước khi bật CD. Không cấu hình check name chưa tồn tại thành required check.

**Backend command baseline:**

```bash
dotnet restore StorageProject.slnx
dotnet tool restore --tool-manifest dotnet-tools.json
dotnet build StorageProject.slnx -c Release --no-restore
dotnet test StorageProject.Tests/StorageProject.Tests.csproj -c Release --no-build --no-restore --logger "trx;LogFileName=backend.trx" --results-directory artifacts/test-results/backend
dotnet publish StorageProject.Api/StorageProject.Api.csproj -c Release --no-build --no-restore -o artifacts/api
```

Nếu thêm project integration sau này, build solution trước rồi chạy tách project/unit và project/integration, không vô tình chạy integration thiếu SQL trong unit job.

**Chất lượng workflow:**

- Permissions mặc định contents:read; PR không có deploy/registry secrets. Chỉ job publish tin cậy có packages:write.
- Không dùng pull_request_target để checkout/chạy code PR. Không execute trực tiếp title/body/branch input qua shell interpolation.
- Pin action bằng full commit SHA đã xác minh kèm comment major version; không chép SHA giả. Setup SDK/Node minh bạch.
- Cache npm theo lockfile FE, không cache node_modules. NuGet cache dùng glob csproj hiện có, hoặc tạo lockfiles thật rồi mới cache theo packages.lock.json. Không dùng locked-mode khi chưa có lockfile.
- timeout hữu hạn, fail-fast hợp lý, concurrency hủy CI cũ theo PR/ref; deployment concurrency riêng và không hủy migration đang chạy.
- Upload reports với if:always, retention khoảng 14 ngày; không upload .env, connection string, DB backup, JWT hay appsettings chứa khóa.
- Node test xuất log/JUnit qua reporter tương thích phiên bản Node, giữ exit code gốc; render test có log riêng vì không phải node:test runner.
- Ghi `$GITHUB_STEP_SUMMARY`: commit, versions, kết quả từng suite, link artifact. Chưa yêu cầu coverage threshold vì repo chưa có baseline/collector; không báo coverage giả.

**Nghiệm thu:** test sai làm CI đỏ và ci-gate đỏ; PR fork chạy không cần secrets; PR chỉ sửa docs vẫn kết thúc check. Thành viên nhóm cấu hình required check `ci-gate` sau run thật đầu tiên.

### Task CI03 — Chuẩn hóa API cho deployment

**File:** `StorageProject.Api/Program.cs`, AuthService nếu cần đồng bộ cấu hình JWT, seeders, health/config helpers mới, appsettings template, .gitignore, tests.

1. **Bí mật:** loại giá trị PayOS có khả năng là khóa thật khỏi appsettings được track. Giữ template an toàn theo convention repo. Tạo env example chỉ chứa tên biến/placeholder. Người sở hữu tự revoke/rotate khóa đã có trong Git history; xóa khỏi HEAD không thu hồi khóa. Không rewrite history trong task này.
2. **Cấu hình:** bind và validate connection string/JWT ở staging/production. JWT secret thiếu hoặc placeholder => fail startup, không dùng fallback công khai. Nếu sửa validation ở Program, bảo đảm AuthService không dùng cấu hình signing khác.
3. **Migration:** thêm `Database:AutoMigrate` với default true chỉ Development, false ngoài Development. Production không tự gọi MigrateAsync.
4. **Seed:** thêm `Database:SeedMode=None|Reference|Staging`; ngoài Development mặc định None. Reference chỉ vai trò/quyền và dữ liệu nền tối thiểu đã xác định; Staging có tài khoản fixture và catalog. Không chạy nguyên DbSeeder hiện tại trên production vì tạo tài khoản mật khẩu cố định và dữ liệu minh họa.
5. **Bootstrap:** tạo lệnh seed riêng chạy xong thoát trước app.Run và trước worker hoạt động. Production bootstrap admin nhận password một lần từ secret, không hardcode hoặc in password. Seed phải chạy lặp không nhân đôi, không reset password tài khoản đã tồn tại. Không chỉ tắt seeder mà bỏ quên tạo roles/permissions cần thiết.
6. **Readiness:** giữ /health liveness, thêm /health/ready kiểm SQL kết nối và schema/migration cần thiết, timeout ngắn; DB unavailable/schema thiếu => 503, không lộ connection string hay exception chi tiết.
7. **Proxy:** cấu hình forwarded headers từ proxy/network thực sự tin cậy, xử lý trước HTTPS redirection. Không trust tất cả forwarded headers từ Internet. Container API chỉ mở qua network nội bộ; CORS đọc allowed origins khi có cross-origin và không AllowAnyOrigin trên production.
8. **Payment URLs:** loại fallback localhost trong môi trường deploy bằng public frontend base URL/config validation. Đọc đường gọi thực tế FE/BE để tránh sửa contract; không tin arbitrary return/cancel URL nếu thêm allowlist. CI dùng fake gateway; không cần PayOS thật để health/login hoạt động.

**Nghiệm thu:** startup production không migrate/seed; thiếu secret bắt buộc fail rõ; bootstrap không khởi động worker; readiness phát hiện DB down và schema thiếu; local Development vẫn chạy theo luồng hiện có. Test các nhánh cấu hình này.

### Task CI04 — Kiểm chứng SQL Server thật và API integration

**File mới:** project integration tests hoặc scripts integration có exit code rõ; cập nhật solution, workflow và docs.

- SQL Server container trên runner Linux có image/tag đã kiểm chứng, password ngẫu nhiên chỉ cho run CI, ACCEPT_EULA, database tạm riêng. Wait bằng truy vấn SQL thật có timeout; không sleep cố định và không mặc định đã có sqlcmd ở một đường dẫn cụ thể.
- Cấp connection string bằng env; không dùng Windows authentication. Trong CI chỉ cho phép TrustServerCertificate trong network tạm nếu cần; production ghi chính sách TLS DB riêng.
- Tạo database rỗng, áp dụng đủ 6 migration hiện tại bằng đúng bundle/tool của release. Chạy lại phải không có migration mới, không lỗi. Ghi ID migration cuối vào report.
- Chạy check model drift (`dotnet ef migrations has-pending-model-changes` đúng project/startup). Nếu fail có sẵn, báo bằng chứng; không sửa migration lịch sử, không suppress cảnh báo để cho pass.
- Seed fixture riêng; kiểm roles/permissions và login 5 nhóm người dùng, catalog lấy từ SQL Server; kiểm endpoint riêng tư không token => 401 và sai role => 403.
- Có test SQL Server cho đường payment/hold transaction dùng sp_getapplock và unique index RENT/DEPOSIT; fake gateway qua DI cho test, không gọi PayOS thật, không public fake payment endpoint trong production.
- Tối thiểu một test gửi xác nhận trùng và một test cạnh tranh cùng đơn/ô, chứng minh không tạo trùng khoản thu hay phân bổ. Không chỉ lặp lại test SQLite.
- Kiểm health ready, API thật từ process/published output; không chỉ instantiate service và gọi EnsureCreated.
- Worker cần tắt được trong fixture để kiểm soát thời gian; giữ worker bật cho smoke staging riêng. Mọi resource tạm cleanup kể cả test fail.

**Nghiệm thu:** migration fail làm pipeline đỏ; unit test xanh không che SQL integration đỏ; schema dùng migrations chứ không EnsureCreated; không chạm DB local/production.

### Task CI05 — Container và smoke test bản đóng gói

**File mới dự kiến:**

```text
StorageProject.Api/Dockerfile
SafeSpace-Customer-UI/SafeSpace-Customer-UI/Dockerfile
deploy/migrator.Dockerfile
.dockerignore
deploy/compose.yml
deploy/compose.staging.yml
deploy/compose.production.yml
deploy/nginx.conf
deploy/Caddyfile
deploy/.env.example
scripts/ci/smoke.sh
```

- Build context rõ ràng: API/migrator cần root vì references sibling projects; web có thể dùng FE root. COPY csproj/lockfile trước source để cache đúng.
- .dockerignore loại .git, node_modules, bin/obj, .env*, overrides chứa secrets, artifacts; giữ chính xác file template cần dùng. Không COPY khóa vào build stage vì vẫn có thể tồn tại trong layer/cache.
- API publish Release, listen port nội bộ 8080; runtime user không root. Web serve dist, không chạy vite dev hoặc npm run dev. Kiểm image không chứa tool phát triển không cần thiết.
- Migrator dùng bundle Linux tương thích runtime/image, appsettings an toàn nếu bundle cần; connection string nhận runtime, không bake secret. Lệnh chạy xong thoát đúng exit code.
- Compose tách web/API/migration/seed; migration và seed chỉ chạy explicit one-shot, không tự chạy khi restart web/API. API không publish port ra Internet; SQL không expose public 1433.
- SQL persistent volume nếu dùng container; giữ nguyên khi đổi app image. Tuyệt đối không có `docker compose down -v` trong deploy/rollback.
- Nginx giữ nguyên `/api` prefix khi proxy_pass; forward Host/X-Forwarded headers có kiểm soát. /health/ready proxy đến API; FE route hash vẫn hoạt động.
- TLS edge theo domain/env thật, không ghi domain giả như đã hoạt động. Production Compose không build source trên server; chỉ pull image digest.
- Smoke bản đóng gói: readiness; `/api/facilities`; FE HTML; JS/CSS/images/font trả đúng content-type; browser mở login và gọi API cùng origin; không gọi localhost:5151, không /api/api, không mixed content/redirect loop.
- Có thể dùng Playwright Chromium cho smoke nhỏ với API thật, credentials fixture staging; lưu report/trace khi fail, tránh lưu token/PII. Không mở rộng sang toàn bộ nghiệp vụ trong task này.

**Nghiệm thu:** clean checkout build/run stack bằng tài liệu; restart API giữ dữ liệu; DB down => readiness fail; smoke chạy từ browser trên host khác không cần backend trên laptop. Nếu sửa cảnh báo font, chỉ sửa đường dẫn asset tối thiểu và kiểm browser.

### Task CI06 — Publish release và tự deploy staging

**File:** mở rộng ci.yml hoặc reusable workflow nội bộ, `scripts/deploy/deploy.sh`, `scripts/deploy/backup.sh`, release manifest schema.

- Chỉ push main của repo gốc và ci-gate success mới publish/deploy. workflow_dispatch chạy CI không tự deploy nếu không có điều kiện release rõ ràng. PR chỉ build/test image, không push registry.
- Build API/web/migrator từ **cùng SHA đã test**. Push tag `sha-<full commit>`; resolve digest từng image và dùng digest ở mọi bước deploy. Không deploy theo latest.
- Ghi release manifest: commit, repository, CI run ID, image digests, timestamp, migration head, kết quả gate. Không chứa secret. Lưu artifact/metadata có thể truy ra đúng run để promotion production.
- Release job có packages:write; host chỉ có credential đọc image nếu GHCR private. Không giả định GITHUB_TOKEN của workflow tồn tại lâu dài trên host.
- Cache build image an toàn, không xuất secret vào cache. Lưu OCI revision labels và kiểm labels/digest khớp manifest.
- Staging gate bằng repo variable `ENABLE_STAGING_DEPLOY`; chưa bật thì báo “chưa cấu hình deploy”, không ghi đã deploy thành công. Chỉ bật sau khi stack và host bootstrap pass.
- SSH host key được pin trong known_hosts đã xác minh; không StrictHostKeyChecking=no. Deploy user quyền giới hạn, lưu ý quyền Docker tương đương quản trị host; không dùng credential cá nhân rộng quyền.
- Workflow gọi script đã review với dữ liệu qua env/arguments đã validate; không nội suy tùy ý workflow input vào shell.

**Thứ tự deploy staging:**

1. Lock theo environment, không cho 2 deploy/migration chạy đồng thời.
2. Validate manifest; pull cả 3 image bằng digest trước khi đổi service.
3. Ghi release hiện tại và chạy backup có kiểm exit code; có cách restore đã thử. Với DB container, backup phải được lấy ra ngoài volume/host theo chính sách, không chỉ để cùng ổ đĩa.
4. Xác nhận schema strategy tương thích app cũ hoặc vào maintenance/stop API trước migration để worker/request không race. Phiên bản đầu chấp nhận downtime ngắn và ghi rõ.
5. Chạy migrator one-shot; fail => dừng, không đổi sang app mới, không seed tiếp.
6. Seed staging explicit khi bootstrap/cần fixture, không reset dữ liệu sau mỗi deploy.
7. Up API/web image mới; wait readiness timeout; smoke từ public URL.
8. Thành công mới cập nhật release-current manifest. Lỗi => xử lý rollback theo CI08, report trạng thái thật.

**Nghiệm thu:** PR fail không publish/deploy; staging chạy đúng SHA/digests; deploy lỗi hiển thị failed; rerun cùng SHA an toàn; không reset DB; run report có URL và commit.

### Task CI07 — Promotion production có kiểm soát

**File mới:** `.github/workflows/deploy-production.yml`; hướng dẫn Environments/Secrets/branch rules.

- Trigger workflow_dispatch, input release SHA hoặc release ID được validate chặt. Workflow/script chạy từ default branch tin cậy; không checkout/executable arbitrary input ref với production secrets.
- Chỉ nhận manifest từ successful CI push main của chính repo, exact SHA/run ID, staging đã pass. Kiểm chứng bằng GitHub API/metadata, không tin một file manifest do người gọi gửi.
- Promote đúng image digests đã test ở staging; **không rebuild** web/API/migrator cho production. Nếu staging/production cần frontend URL khác, giải quyết cấu hình cùng origin/runtime trước, không lén rebuild khi promotion.
- Job environment production, secrets riêng, deployment branch restrictions. Required reviewer nếu gói/tính chất repo hỗ trợ; tài liệu nêu thao tác manual dispatch hiện vẫn là điểm kiểm soát nếu reviewer feature không có.
- Backup, migration, readiness, smoke và lock theo cùng quy trình staging. SeedMode None; reference/admin bootstrap là thao tác riêng có ghi nhận.
- Không tự thu tiền hay thực hiện giao dịch PayOS thật trong smoke. Webhook provider/return/cancel URLs phải được chủ kênh cập nhật và kiểm chứng riêng với URL HTTPS đã cấp.

**Nghiệm thu:** không deploy PR SHA/failed SHA/arbitrary image; manifest cũ còn nguyên digests; production secrets không xuất hiện trong CI PR; release thành công có image ID, URL, migration head và smoke result.

### Task CI08 — Rollback, vận hành và bàn giao

**File:** `scripts/deploy/rollback.sh`, `docs/cicd.md`, `docs/deployment.md`, `docs/rollback.md`, updates docs/verification, progress, feature list, quyết định mới trong DECISIONS.

- Ghi current/previous release theo digest; rollback app về previous chỉ khi schema hiện tại tương thích app cũ.
- **Không tự chạy EF Down hoặc database update về migration cũ.** Migration ReservationPaymentIntegrity có guard có thể từ chối hạ schema khi đã phát sinh dữ liệu. Mặc định giữ schema và dùng forward fix.
- Migration fail có thể để DB cần kiểm tra dù service chưa đổi. Không giả định mọi DDL/SQL đều rollback toàn bộ. Đóng traffic nếu không chứng minh DB an toàn.
- Restore DB từ backup chỉ theo runbook có chấp nhận mất dữ liệu từ thời điểm backup; dừng writes/worker, kiểm DB restore, đồng bộ release. Không tự restore mù khi smoke fail.
- Test rollback ở staging: app image lỗi, readiness fail, migration fail, DB mất kết nối; kiểm release-current không bị cập nhật sai.
- Ghi downtime dự kiến; Compose một replica chưa bảo đảm zero downtime. Không thêm Kubernetes chỉ để đạt checklist.
- Viết hướng dẫn debug Actions report/TRX/Node/JUnit/browser trace, container logs đã lọc bí mật, DB connection, mixed content, GHCR auth, migration errors.
- Ghi rõ việc nào agent đã chạy local, việc nào đã chạy GitHub, việc nào cần chủ repo/host làm.

## 6. Cấu hình cần chuẩn bị

Agent viết template và hướng dẫn; chủ repo cấp giá trị thật qua GitHub Environment/host secret file, không qua commit hoặc nội dung chat công khai.

| Nơi | Tên đề xuất | Mục đích |
|---|---|---|
| GitHub variables | ENABLE_STAGING_DEPLOY, STAGING_URL, PRODUCTION_URL, DEPLOY_PATH | Cổng bật deploy và địa chỉ/path không bí mật |
| Environment secrets | DEPLOY_HOST, DEPLOY_USER, DEPLOY_SSH_KEY, DEPLOY_KNOWN_HOSTS | Truy cập host và pin host key |
| Host hoặc secret manager | ConnectionStrings__DefaultConnection | Kết nối database theo environment |
| Host | JwtSettings__Secret, JwtSettings__Issuer, JwtSettings__Audience | Signing và kiểm JWT, ổn định qua các lần deploy |
| Host | AccessQr__Secret | Khóa QR độc lập, giữ ổn định để không đổi quyền mở cửa ngoài ý muốn |
| Host | PayOS__ClientId, PayOS__ApiKey, PayOS__ChecksumKey | Khóa PayOS đã rotate; tách staging/prod nếu provider hỗ trợ |
| Host | ASPNETCORE_ENVIRONMENT, Database__AutoMigrate=false, Database__SeedMode=None | Runtime staging/production; đổi SeedMode chỉ cho one-shot phù hợp |
| Host | AllowedOrigins / public frontend base URL | Key cuối cùng phải khớp tên agent triển khai trong code |
| Host | Registry read credential nếu image private | Pull GHCR, quyền read:packages tối thiểu |
| Bootstrap one-shot | Initial admin password / fixture password | Không dùng seed password cố định trên production |

Không cần PayOS secrets cho PR CI. SQL CI password là secret tạm của job. Không ghi connection string trong log chạy EF. Giữ backup ngoài app artifact; report chỉ lưu thông tin backup đã thành công, không lưu nội dung database.

## 7. Tiêu chí nghiệm thu tổng thể

1. PR clean checkout tự động chạy FE 4 suite/check + build, BE build/test, SQL integration và container smoke sau khi đầy đủ task; lỗi bất kỳ chặn ci-gate.
2. Root và FE lockfile không bị dùng nhầm; frontend business suite không bị bỏ sót; dùng .NET 10.
3. Không cần laptop, ngrok hoặc SQL Express cá nhân; không cần secrets production trên PR/fork.
4. Main đạt gate tạo release theo SHA/digests và staging deploy đúng release khi cấu hình bật.
5. Production chỉ promote release đã pass, không rebuild, không tự seed tài khoản mật khẩu mặc định.
6. Migration áp dụng vào DB mới và rerun pass; có SQL Server thật, không chỉ SQLite.
7. Health ready phản ánh DB/schema; browser FE gọi API thật cùng origin, không fallback localhost/mock.
8. Backup/restore và rollback đã thử staging; không down -v, không tự hạ migration.
9. Có report và runbook đủ để thành viên khác xử lý deploy lỗi.
10. Chỉ đánh dấu từng task passing khi có bằng chứng đúng tầng. Chưa có GitHub run/host thì ghi local-ready hoặc blocked phần external, không tuyên bố CD đã chạy thật.

## 8. Prompt khởi động cho agent

> Hãy triển khai CI/CD cho https://github.com/ryocoding13/SSFRMS theo toàn bộ tài liệu này. Đầu tiên đọc AGENTS.md và tài liệu liên quan, kiểm tra HEAD và baseline, rồi tạo sprint contract và các task CI01–CI08 với ID không trùng. Mỗi phiên chỉ active một task. Bắt đầu CI01 rồi CI02; sau đó lần lượt chuẩn hóa runtime, kiểm SQL Server thật, container, staging CD, production promotion và rollback. Giữ .NET 10/React/Vite và hai cấp thư mục frontend. Không refactor nghiệp vụ hay sửa migration lịch sử. Không tự push, tạo PR hoặc merge theo AGENTS.md. Không tạo cloud resource có phí. Nếu thiếu hosting/domain/secrets, tiếp tục hoàn thành mọi phần code/script/test/docs không phụ thuộc chúng và báo chính xác phần deploy thật còn chờ. Không yêu cầu cung cấp bí mật qua chat; viết tên config và nơi đặt. Không báo pass nếu chưa chạy. Bàn giao danh sách file thay đổi, lệnh và output kiểm chứng, patch/commit, hướng dẫn GitHub/host cần chủ repo thực hiện, giới hạn còn lại.

## 9. Tài liệu chính thức đã đối chiếu

- GitHub .NET build/test: https://docs.github.com/actions/guides/building-and-testing-net
- GitHub deployments/environments: https://docs.github.com/actions/deployment/about-deployments/deploying-with-github-actions và https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment
- GitHub Actions secure use: https://docs.github.com/en/actions/reference/security/secure-use
- EF Core migrations/bundles và giới hạn rollback: https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/applying
- Vite env build-time và việc VITE_* được đưa vào client bundle: https://vite.dev/guide/env-and-mode

Version action, SDK patch, container image và khả năng Environment protection phải xác minh lại tại thời điểm implementation; tài liệu này không ghim version/SHA chưa được kiểm chứng.
