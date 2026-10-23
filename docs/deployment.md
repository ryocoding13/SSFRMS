# Sổ tay Hướng dẫn Triển khai Hệ thống — SafeSpace SSFRMS

> **Dành cho:** Kỹ sư DevOps, Quản trị viên Hệ thống (System Admin), Đội ngũ Vận hành Kỹ thuật SafeSpace.  
> **Mục tiêu:** Cung cấp quy trình chuẩn hóa để chuẩn bị môi trường, cấu hình dịch vụ, thiết lập hạ tầng mạng, sao lưu và vận hành triển khai Staging & Production.

---

## 1. Kiến trúc Hạ tầng Triển khai

SafeSpace SSFRMS triển khai theo mô hình Container hóa hoàn chỉnh dựa trên Docker Compose:

```
[ Internet / Clients ]
         │ (HTTPS 443 / HTTP 80)
         ▼
[ Edge Proxy: Caddy / Nginx ]
         │
         ├───► [ Web Container (Nginx Alpine) ] (Lắng nghe loopback 127.0.0.1:8080)
         │       └── Phục vụ React SPA (dist/), hỗ trợ HTML5 Hash/History fallback
         │
         └───► Proxy pass /api/* ───► [ API Container (.NET 10 Noble-Chiseled) ]
                                              │ (Chạy quyền non-root 'app')
                                              ▼
                                     [ SQL Server 2022 ] (Port 1433 nội bộ bridge net)
                                              ▲
                                              │ (Chỉ kết nối khi nâng cấp schema)
                                     [ Migrator Container ] (One-shot Linux Bundle)
```

### Nguyên tắc An toàn Hạ tầng:
1. **Không Expose Cổng Nội bộ:** Cổng `1433` (SQL Server) và `8080` (API) tuyệt đối không được map ra `0.0.0.0` trên host; chỉ giao tiếp qua Docker network nội bộ (`prod-net` / `staging-net`).
2. **Quyền Thực thi Non-Root:** API container chạy dưới tài khoản `app` (UID 1654) của Ubuntu Chiseled, loại bỏ hoàn toàn các công cụ shell/package manager không cần thiết trong runtime layer.
3. **Volume Lưu trữ Bền vững:** Dữ liệu SQL Server được mount vào Docker named volume (`prod_sql_data` / `staging_sql_data`). Tuyệt đối **không bao giờ sử dụng cờ `-v` (`docker compose down -v`)** trong các tác vụ bảo trì.

---

## 2. Chuẩn bị Môi trường & Cấu hình Bí mật

### 2.1. Yêu cầu Máy chủ (Host Requirements)
- **Hệ điều hành:** Ubuntu Server 22.04 LTS / 24.04 LTS (hoặc Windows Server 2022).
- **Phần mềm:** Docker Engine >= 24.0, Docker Compose Plugin >= 2.20, `curl`, `jq`.
- **Cấu hình tối thiểu:** 2 vCPU, 4GB RAM (cho stack SQL Server + API + Web), ổ cứng SSD tối thiểu 30GB.

### 2.2. Thiết lập Biến Môi trường (.env)
Tại thư mục `deploy/` trên máy chủ, tạo file cấu hình tương ứng từ mẫu [deploy/.env.example](file:///d:/StorageProject/deploy/.env.example):
- Staging: `deploy/.env`
- Production: `deploy/.env.production`

```ini
# ==============================================================================
# Cấu hình Môi trường Production (deploy/.env.production)
# ==============================================================================
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:8080

# 1. SQL Server
SA_PASSWORD=ThayTheBangMatKhauSieuManh_TốiThiểu16KýTự!
ConnectionStrings__DefaultConnection=Server=sqlserver,1433;Database=SSFRMS;User Id=sa;Password=${SA_PASSWORD};TrustServerCertificate=True;

# 2. Quy tắc Migration & Seeding
Database__AutoMigrate=false
Database__SeedMode=None

# 3. JWT & Bảo mật Token
JwtSettings__Secret=ChuoiBiMatNgauNhienToiThieu32KyTuChoJWTToken2026!
JwtSettings__Issuer=SSFRMSApi
JwtSettings__Audience=SSFRMSClients
JwtSettings__ExpiryMinutes=1440

# 4. Khóa QR Mở Cửa Kho
AccessQr__Secret=KhoaBiMatDocLapChoMaQRMOCuaKhoKhongDoiQuaCacLanDeploy!
AccessQr__DenyOverdue=true

# 5. Cổng Thanh Toán PayOS (Từ https://my.payos.vn/)
PayOS__ClientId=YOUR_PRODUCTION_CLIENT_ID
PayOS__ApiKey=YOUR_PRODUCTION_API_KEY
PayOS__ChecksumKey=YOUR_PRODUCTION_CHECKSUM_KEY

# 6. Domain Công Khai & CORS
AppSettings__FrontendUrl=https://safespace.vn
Cors__AllowedOrigins__0=https://safespace.vn
```

---

## 3. Quy trình Triển khai Chi tiết

### 3.1. Triển khai Tự động Môi trường Staging (CI/CD Push `main`)

1. Cấu hình biến repository trên GitHub (**Settings > Secrets and variables > Actions > Variables**):
   - `ENABLE_STAGING_DEPLOY=true`
   - `STAGING_URL=https://staging.safespace.vn`
2. Cấu hình SSH Secrets hoặc GitHub Runner trên máy chủ Staging:
   - `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.
3. Khi merge PR vào `main`, GitHub Actions tự động:
   - Build và push images lên GHCR theo SHA digest.
   - Gọi script `scripts/deploy/deploy.sh` trên Staging runner.
   - Thực thi tuần tự: Lock -> Pull digest -> Backup DB -> One-shot Migrator -> Up Web/API -> Healthcheck `/health/ready` -> Smoke test -> Ghi nhận `release-current.json`.

### 3.2. Triển khai Môi trường Production (Thủ công có Phê duyệt)

1. **Bước 1: Phê duyệt Promotion trên GitHub:**
   - Truy cập tab **Actions > Production Promotion & Deployment**.
   - Bấm **Run workflow**, nhập `release_sha` (commit 40 ký tự hex cần promote).
   - Người có thẩm quyền (Reviewer) xem xét manifest, kiểm tra kết quả staging rồi bấm **Approve and deploy**.
2. **Bước 2: Thực thi trên Máy chủ Production:**
   - Kịch bản [scripts/deploy/promote-production.sh](file:///d:/StorageProject/scripts/deploy/promote-production.sh) được kích hoạt:
   ```bash
   bash scripts/deploy/promote-production.sh \
     artifacts/release-manifest.json \
     deploy/.env.production \
     deploy/compose.production.yml
   ```
   - Quá trình này **tuyệt đối không rebuild image** mà kéo chính xác các image SHA-256 digest đã được ghim trong release manifest.
   - Kiểm tra liveness & readiness tại `https://safespace.vn/health/ready`.
   - Kết quả triển khai và digests được lưu vào `deploy/release-production-current.json`.

---

## 4. Vận hành Nâng cấp Database Schema & Seed

### 4.1. Quy tắc Nâng cấp Schema
- Ứng dụng ASP.NET Core đặt `Database__AutoMigrate=false` để tránh việc nhiều replica cùng lúc tranh chấp chạy DDL.
- Việc nâng cấp database do container `migrator` (build từ [deploy/migrator.Dockerfile](file:///d:/StorageProject/deploy/migrator.Dockerfile)) chạy one-shot:
  ```bash
  docker compose -f deploy/compose.production.yml run --rm migrator
  ```
- Nếu lệnh migration gặp lỗi (exit code khác 0), script sẽ hủy bỏ triển khai ngay lập tức, giữ nguyên database hiện hữu và **không đổi sang API container mới**.

### 4.2. Khởi tạo Dữ liệu Ban đầu (Bootstrap Reference Data)
- Trên Production, `Database__SeedMode` mặc định là `None`.
- Khi dựng hệ thống mới lần đầu tiên cần nạp bảng giá và danh mục cơ sở:
  ```bash
  docker compose -f deploy/compose.production.yml run --rm \
    -e Database__SeedMode=Reference \
    api
  ```
- Sau khi khởi tạo xong, trả `Database__SeedMode` về `None`.

---

## 5. Chiến lược Sao lưu Dữ liệu Định kỳ

1. Kịch bản [scripts/deploy/backup.sh](file:///d:/StorageProject/scripts/deploy/backup.sh) tự động tạo file `.bak` kèm timestamp:
   ```bash
   bash scripts/deploy/backup.sh "/var/backups/safespace/prod" "SSFRMS" "safespace-prod-sqlserver"
   ```
2. File backup được sao chép **ra ngoài container và volume host**, lưu tại đường dẫn an toàn được cấu hình.
3. Thiết lập cron job trên máy chủ chạy sao lưu tự động hàng ngày vào 02:00 sáng:
   ```cron
   0 2 * * * /bin/bash /opt/safespace/scripts/deploy/backup.sh /var/backups/safespace/daily SSFRMS safespace-prod-sqlserver >> /var/log/safespace-backup.log 2>&1
   ```
