---
name: resetdb
description: >-
  Reset cơ sở dữ liệu SSFRMS (SQL Server) và nạp lại trạng thái hoạt động thực tế với hợp đồng thuê mẫu và doanh thu Business Ops (D55 / #60).
  Sử dụng khi người dùng yêu cầu reset database, làm sạch giao dịch, nạp lại dữ liệu demo, hoặc gõ /resetdb, /reset-db.
---

# Reset SSFRMS Database & Initialize Operational Demo State (D55 / #60)

This skill automates resetting the SafeSpace SQL Server database (`SSFRMS`) and initializing live operational demo data:
- Cleans up old orphaned transactions, test reservations, and temporary users.
- Re-seeds **42 active rental contracts** across all 12 facilities with QR & PIN smart access credentials.
- Re-seeds **358,890,000 VND in rental revenue** and **60,760,000 VND in deposit** distributed over the last 6 months (June–November 2026) for Business Operations financial reporting and occupancy charts.
- Resets **102 physical storage units to `AVAILABLE`** (preserving over 70% free units for booking tests) and **42 units to `OCCUPIED`**.
- Preserves full Manager and Staff coverage across all 12 facilities (`Manager_<CODE>`, `Staff_<CODE>`), ensuring zero missing managers on the Business Operator board.
- Preserves all core accounts: `admin`, `ops01`, `manager01`, `staff01`, `staff02`, `customer01`, `customer02`.

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
  - `rental_contracts ACTIVE : 42`
  - `storage_units OCCUPIED : 42`, `AVAILABLE : 102`
  - `payments RENT : 42`, `DEPOSIT : 42`
- `Revenue`: Rent revenue ~358M+ VND, Deposit ~60M+ VND.
- `Facility Manager Assignment Coverage`: 12/12 facilities with active managers.

### Step 3: Respond to User
Inform the user that the database has been cleanly reset and loaded with live operational demo data, referencing [references/credentials.md](./references/credentials.md):
- `admin` / `Admin@123` (Quản trị viên)
- `ops01` / `Ops@123` (Quản lý vận hành KD - xem báo cáo doanh thu 358M+)
- `manager01` / `Manager@123` & `Manager_<CODE>` / `Manager@123` (Quản lý 12 cơ sở)
- `Staff_<CODE>` / `Staff@123` (Nhân viên 12 cơ sở)
- `Customer<MÃ>01` / `Customer@123` (Khách hàng đang thuê kho)
- `customer01`, `customer02` / `Customer@123` (Khách hàng sạch để đặt kho mới)
