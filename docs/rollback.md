# Sổ tay Hướng dẫn Rollback & Xử lý Sự cố — SafeSpace SSFRMS

> **Dành cho:** Kỹ sư Vận hành, Trực ban Kỹ thuật (On-call Engineer), Quản trị viên SafeSpace.  
> **Cam kết:** An toàn dữ liệu là ưu tiên số một; mọi thao tác phục hồi phải tuân thủ đúng quy trình đã được kiểm nghiệm.

---

## 1. Phân loại Sự cố và Cấp độ Phản ứng

| Cấp độ | Tình huống sự cố | Chiến lược xử lý | Thời gian gián đoạn dự kiến |
|---|---|---|---|
| **Cấp 1: Lỗi Ứng dụng** | Web hiển thị lỗi màn hình trắng, API phát sinh lỗi 500, lỗi giao diện người dùng. | **Rollback Container Images:** Hoán chuyển API & Web về bản release trước bằng digest đã ghim. Giữ nguyên database schema. | < 1 phút |
| **Cấp 2: Lỗi Migration** | Container migrator one-shot thất bại trong quá trình triển khai, exit code khác 0. | **Forward-Fix:** Pipeline đã tự động dừng, API chưa đổi sang bản mới. Giữ nguyên schema hiện tại, phân tích log và tạo migration sửa lỗi mới. | Không gián đoạn (App cũ vẫn phục vụ) |
| **Cấp 3: Hỏng hóc Dữ liệu** | Dữ liệu giao dịch hoặc bảng quan trọng bị sai lệch nghiêm trọng sau khi phát hành. | **Restore Database từ Backup:** Kích hoạt Runbook khôi phục database từ file `.bak` đã lưu ngay trước khi deploy. | 5 – 15 phút (Maintenance window) |

---

## 2. Nguyên tắc Bất Di Bất Dịch về Database Schema

> [!CAUTION]
> **TUYỆT ĐỐI KHÔNG CHẠY `dotnet ef database update <migration_cũ>` HOẶC EF DOWN TỰ ĐỘNG.**
> 
> **Lý do kỹ thuật:**
> 1. Migration `20261020154838_ReservationPaymentIntegrity` và các migration nghiệp vụ đã thiết lập các ràng buộc toàn vẹn dữ liệu chặt chẽ (Check Constraints, Foreign Keys). Lệnh hạ schema tự động sẽ thất bại hoặc xóa mất các bảng/cột chứa dữ liệu khách hàng thực tế.
> 2. **Chiến lược Forward-Fix:** Mọi sai sót schema trong môi trường production đều được xử lý bằng cách viết một migration mới tiến lên (`dotnet ef migrations add Fix...`), kiểm thử và đẩy qua CI/CD pipeline chuẩn.

---

## 3. Quy trình Rollback Container Nhanh (Cấp độ 1)

Khi ứng dụng gặp lỗi logic nhưng database schema vẫn tương thích ngược với phiên bản trước:

### 3.1. Rollback trên Môi trường Staging
```bash
# Thực thi trên máy chủ Staging:
bash scripts/deploy/rollback.sh staging deploy/releases/<bản_manifest_cũ>.json

# Hoặc trên PowerShell:
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\rollback.ps1 -EnvTarget staging -PreviousManifest deploy/releases/<bản_manifest_cũ>.json
```

### 3.2. Rollback trên Môi trường Production
```bash
# Thực thi trên máy chủ Production:
bash scripts/deploy/rollback.sh production deploy/releases/<bản_manifest_cũ>.json

# Hoặc trên PowerShell:
powershell -ExecutionPolicy Bypass -File .\scripts\deploy\rollback.ps1 -EnvTarget production -PreviousManifest deploy/releases/<bản_manifest_cũ>.json
```

**Các bước tự động của kịch bản:**
1. Khóa môi trường để tránh xung đột thao tác (`/tmp/safespace-rollback.lock`).
2. Trích xuất exact digests của API và Web từ bản manifest trước.
3. Chuyển đổi và khởi động lại API + Web containers về exact digests đó.
4. Chờ readiness probe `/health/ready` xác nhận hệ thống sẵn sàng.
5. Chạy bộ smoke test kiểm tra xác thực và phục hồi `release-current.json`.

---

## 4. Runbook Khôi phục Database từ Bản Sao lưu (Cấp độ 3)

> [!WARNING]
> Phục hồi database từ bản sao lưu `.bak` sẽ ghi đè toàn bộ dữ liệu hiện tại bằng dữ liệu tại thời điểm sao lưu. Mọi giao dịch phát sinh sau thời điểm tạo backup sẽ bị mất vĩnh viễn. Chỉ thực hiện khi có sự phê duyệt của Trưởng nhóm Kỹ thuật.

### Quy trình 7 bước thực hiện thủ công:

#### Bước 1: Dừng ứng dụng và đưa hệ thống vào Bảo trì
```bash
docker compose -f deploy/compose.production.yml stop api web
```

#### Bước 2: Xác định file sao lưu hợp lệ
Kiểm tra danh sách các bản backup được tạo trước lần deploy gần nhất:
```bash
ls -lh /var/backups/safespace/prod/
# Chọn file: SSFRMS_backup_YYYYMMDD_HHMMSS.bak
```

#### Bước 3: Đưa Database về Single User và Restore
```bash
# Sao chép file backup vào container SQL Server:
docker cp /var/backups/safespace/prod/SSFRMS_backup_20261024_000000.bak safespace-prod-sqlserver:/var/opt/mssql/data/restore.bak

# Thực thi lệnh RESTORE WITH REPLACE:
docker exec safespace-prod-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "${SA_PASSWORD}" -C \
  -Q "
    ALTER DATABASE [SSFRMS] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    RESTORE DATABASE [SSFRMS] FROM DISK = N'/var/opt/mssql/data/restore.bak' WITH REPLACE;
    ALTER DATABASE [SSFRMS] SET MULTI_USER;
  "

# Dọn dẹp file tạm trong container:
docker exec safespace-prod-sqlserver rm -f /var/opt/mssql/data/restore.bak
```

#### Bước 4: Kiểm tra Tính Toàn vẹn Dữ liệu (DBCC CHECKDB)
```bash
docker exec safespace-prod-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "${SA_PASSWORD}" -C \
  -Q "DBCC CHECKDB ([SSFRMS]) WITH NO_INFOMSGS;"
```

#### Bước 5: Kiểm tra Bảng Lịch sử Migration
```bash
docker exec safespace-prod-sqlserver /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P "${SA_PASSWORD}" -C \
  -Q "SELECT MigrationId, ProductVersion FROM [SSFRMS].[dbo].[__EFMigrationsHistory] ORDER BY MigrationId;"
```

#### Bước 6: Khởi động lại Dịch vụ với Phiên bản Container Tương thích
```bash
docker compose -f deploy/compose.production.yml up -d api web
```

#### Bước 7: Thực hiện Smoke Test Xác minh
```bash
bash scripts/ci/smoke.sh "https://safespace.vn" 10 2
```

---

## 5. Hướng dẫn Troubleshooting & Chẩn đoán Nhanh

### 5.1. Kiểm tra Lỗi trên GitHub Actions Runner
- **Xem báo cáo TRX:** Báo cáo chi tiết các bài test .NET nằm trong artifact `test-results` của workflow CI.
- **Xem log Container Build:** Kiểm tra log từng layer build trong job `container-build`.
- **Step Summary:** Kiểm tra bảng tóm tắt tiến trình và digests tại trang Run Summary của GitHub Actions.

### 5.2. Chẩn đoán Container Logs trên Máy chủ
```bash
# Xem log API thời gian thực:
docker compose -f deploy/compose.production.yml logs -f --tail 100 api

# Xem log Nginx Proxy:
docker compose -f deploy/compose.production.yml logs -f --tail 100 web

# Kiểm tra log Migrator container (one-shot):
docker compose -f deploy/compose.production.yml logs migrator
```

### 5.3. Xử lý Lỗi Readiness Probe `/health/ready` trả về "Unhealthy"
Nếu `/health/ready` trả về HTTP 503 hoặc JSON chứa `Unhealthy`:
1. Kiểm tra container SQL Server: `docker compose ps sqlserver`.
2. Kiểm tra chuỗi kết nối: Mở log API tìm từ khóa `SqlException` hoặc `Connection refused`.
3. Kiểm tra số lượng migration đã áp dụng:
   ```bash
   docker exec -it safespace-prod-sqlserver /opt/mssql-tools18/bin/sqlcmd \
     -S localhost -U sa -P "${SA_PASSWORD}" -C \
     -Q "SELECT TOP 1 MigrationId FROM [SSFRMS].[dbo].[__EFMigrationsHistory] ORDER BY MigrationId DESC;"
   ```

### 5.4. Xử lý Lỗi CORS hoặc Reverse Proxy Headers
Nếu Frontend báo lỗi kết nối API hoặc redirect sai URL sau khi thanh toán PayOS:
1. Đảm bảo Nginx chuyển tiếp đủ các header:
   - `proxy_set_header Host $host;`
   - `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
   - `proxy_set_header X-Forwarded-Proto $scheme;`
2. Kiểm tra biến `AppSettings__FrontendUrl` trong file `.env` đã khớp với tên miền HTTPS công khai chưa.
