---
name: resetdb
description: >-
  Reset toàn bộ cơ sở dữ liệu SSFRMS (SQL Server) về trạng thái hệ thống mới mở (zero customer activity).
  Sử dụng khi người dùng yêu cầu reset database, làm sạch giao dịch, hoặc gõ /resetdb, /reset-db.
---

# Reset SSFRMS Database to Fresh Launch State

This skill automates the complete reset of the SafeSpace (SSFRMS) SQL Server database (`SSFRMS`) to a Day 1 fresh operational state:
- Zero customer transactions (reservations, contracts, payments, tickets, handovers, return inspections, overdue cases, assignments).
- All 144 physical storage units (K01–K12 across 12 facilities) reset to `AVAILABLE` (decommissioned legacy units and non-K units removed).
- All temporary test accounts and activity/login logs deleted.
- Preserves all essential system master data: facilities, unit types, rental rates, policies, roles, permissions.
- Preserves default system accounts: `admin`, `manager01`, `staff01`, `ops01` (`OPERATIONS`), `customer01`, `customer02`.

---

## Instructions for Agent

When the user invokes `/resetdb` or asks to reset the database:

### Step 1: Execute the Automated Reset Script
Run the PowerShell reset script located in `scripts/reset-db.ps1`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .agents/skills/resetdb/scripts/reset-db.ps1
```

### Step 2: Validate Verification Output
Check the output from the script:
- All transaction tables must display `[PASS] <table_name> : 0 rows`.
- Storage units status must show `AVAILABLE 144`.
- Active seed accounts must list `admin`, `staff01`, `customer01`, `customer02`, `manager01`, `ops01`.

### Step 3: Respond to User
Inform the user that the database has been cleanly reset, and provide the credential table from [references/credentials.md](./references/credentials.md):
- `admin` / `Admin@123`
- `ops01` / `Ops@123` (`OPERATIONS`)
- `manager01` / `Manager@123`
- `staff01` / `Staff@123`
- `customer01` / `Customer@123`
- `customer02` / `Customer@123`
