---
name: resetdb
description: >-
  Reset cơ sở dữ liệu SSFRMS (SQL Server) và nạp lại trạng thái hoạt động thực tế với hợp đồng thuê mẫu và doanh thu Business Ops (D55 / #60).
  Sử dụng khi người dùng yêu cầu reset database, làm sạch giao dịch, nạp lại dữ liệu demo, hoặc gõ /resetdb, /reset-db.
---

# Reset SSFRMS Database & Initialize Operational Demo State (D55 / #60)

This skill automates resetting the SafeSpace SQL Server database (`SSFRMS`) and initializing live operational demo data:
- Cleans up old orphaned transactions, test reservations, and temporary users.
- Re-seeds **45 active rental contracts** across all 12 facilities with QR & PIN smart access credentials — all owned by the **only customer, `customer01`**.
- Re-seeds **~384,780,000 VND in rental revenue** and **~65,710,000 VND in deposit** distributed over the last 6 months (June–November 2026) for Business Operations financial reporting and occupancy charts.
- Resets **99 physical storage units to `AVAILABLE`** (preserving ~69% free units for booking tests) and **45 units to `OCCUPIED`**.
- Preserves full Manager and Staff coverage across all 12 facilities (`Manager_<CODE>`, `Staff_<CODE>`, each with a real full name), ensuring zero missing managers on the Business Operator board.
- Preserves core accounts: `admin`, `ops01`, `customer01`. Deletes `staff01`, `staff02`, `manager01`, `customer02`–`customer06` and `Customer<CODE>01` (D61).

---

## Instructions for Agent

When the user invokes `/resetdb` or asks to reset the database:

### Step 1: Execute the Automated Reset & Seed Script
Run the PowerShell reset script located in `scripts/reset-db.ps1`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/resetdb/scripts/reset-db.ps1
```

### Step 2: Validate Verification Output
Check the output from the script:
- `[OK] Database cleanup completed successfully.`
- `[OK] Demo contracts and revenue seeded successfully.`
- `Operational Summary`:
  - `rental_contracts ACTIVE : 45`
  - `storage_units OCCUPIED : 45`, `AVAILABLE : 99`
  - `payments RENT : 45`, `DEPOSIT : 45`
- `Revenue`: Rent revenue ~384M+ VND, Deposit ~65M+ VND.
- `Facility Manager Assignment Coverage`: 12/12 facilities with active managers.

### Step 3: Respond to User
Inform the user that the database has been cleanly reset and loaded with live operational demo data, referencing [references/credentials.md](./references/credentials.md):
- `admin` / `Admin@123` (Quản trị viên)
- `ops01` / `Ops@123` (Quản lý vận hành KD - xem báo cáo doanh thu 384M+)
- `Manager_<CODE>` / `Manager@123` (Quản lý 12 cơ sở)
- `Staff_<CODE>` / `Staff@123` (Nhân viên 12 cơ sở)
- `customer01` / `Customer@123` (Khách hàng duy nhất — đứng tên cả 45 hợp đồng đang thuê ở 12 cơ sở)
