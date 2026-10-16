# =========================================================================
# reset-db.ps1: Automated reset script for SSFRMS
# Can be run standalone or invoked by Antigravity /resetdb skill
# =========================================================================

param(
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "SSFRMS"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SqlFile = Join-Path $ScriptDir "reset_db.sql"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace (SSFRMS) - Database Reset to Fresh State  " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Target Server   : $ServerInstance"
Write-Host "Target Database : $Database"
Write-Host "SQL Script      : $SqlFile"
Write-Host ""

if (-not (Test-Path $SqlFile)) {
    Write-Host "[ERROR] Cannot find SQL file: $SqlFile" -ForegroundColor Red
    exit 1
}

# 1. Execute SQL reset script
Write-Host "[1/3] Executing database cleanup..." -ForegroundColor Yellow
$result = sqlcmd -I -S $ServerInstance -d $Database -i $SqlFile -b
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] sqlcmd failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host $result
    exit 1
}
Write-Host "Cleanup completed successfully." -ForegroundColor Green

# 2. Verify transaction table counts
Write-Host ""
Write-Host "[2/3] Verifying clean transaction state..." -ForegroundColor Yellow
$verifySql = @"
SELECT 'reservations' as tbl, COUNT(*) as cnt FROM reservations
UNION ALL SELECT 'rental_contracts', COUNT(*) FROM rental_contracts
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'support_tickets', COUNT(*) FROM support_tickets
UNION ALL SELECT 'handover_records', COUNT(*) FROM handover_records
UNION ALL SELECT 'return_inspections', COUNT(*) FROM return_inspections
UNION ALL SELECT 'unit_assignments', COUNT(*) FROM unit_assignments
UNION ALL SELECT 'maintenance_requests', COUNT(*) FROM maintenance_requests
UNION ALL SELECT 'contract_renewals', COUNT(*) FROM contract_renewals
UNION ALL SELECT 'overdue_cases', COUNT(*) FROM overdue_cases
UNION ALL SELECT 'access_credentials', COUNT(*) FROM access_credentials
UNION ALL SELECT 'activity_logs', COUNT(*) FROM activity_logs;
"@

$counts = sqlcmd -S $ServerInstance -d $Database -Q $verifySql -h -1 -W
$allZero = $true
$lines = $counts -split "`r?`n" | Where-Object { $_ -match '^\w+\s+\d+' }
foreach ($line in $lines) {
    $parts = $line.Trim() -split '\s+'
    if ($parts.Length -ge 2) {
        $table = $parts[0]
        $cnt = [int]$parts[1]
        if ($cnt -ne 0) {
            Write-Host "  [FAIL] $table : $cnt rows" -ForegroundColor Red
            $allZero = $false
        } else {
            Write-Host "  [PASS] $table : 0 rows" -ForegroundColor Gray
        }
    }
}

if (-not $allZero) {
    Write-Host "[ERROR] Some tables still have remaining rows!" -ForegroundColor Red
    exit 1
}

# 3. Verify storage unit availability & accounts
Write-Host ""
Write-Host "[3/3] Checking storage units & seed accounts..." -ForegroundColor Yellow

$unitSql = "SELECT Status, COUNT(*) as cnt FROM storage_units GROUP BY Status;"
$unitResult = sqlcmd -S $ServerInstance -d $Database -Q $unitSql -h -1 -W
Write-Host "Storage Units status:" -ForegroundColor Cyan
Write-Host $unitResult

$userSql = "SELECT u.Username, r.RoleName FROM users u JOIN user_roles ur ON u.UserId = ur.UserId JOIN roles r ON ur.RoleId = r.RoleId ORDER BY u.UserId;"
$userResult = sqlcmd -S $ServerInstance -d $Database -Q $userSql -h -1 -W
Write-Host "Active Seed Accounts:" -ForegroundColor Cyan
Write-Host $userResult

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  DATABASE RESET COMPLETED - 100% CLEAN & READY!      " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
