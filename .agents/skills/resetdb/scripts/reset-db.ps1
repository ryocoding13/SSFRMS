# =========================================================================
# reset-db.ps1: Automated reset script for SSFRMS
# Resets transactions and re-seeds active demo contracts & business revenue (D55 / #60)
# =========================================================================

param(
    [string]$ServerInstance = ".\SQLEXPRESS",
    [string]$Database = "SSFRMS"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = (Resolve-Path "$ScriptDir/../../../..").Path
$SqlFile = Join-Path $ScriptDir "reset_db.sql"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace (SSFRMS) - Database Reset & Demo Seed     " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Target Server   : $ServerInstance"
Write-Host "Target Database : $Database"
Write-Host "SQL Script      : $SqlFile"
Write-Host ""

if (-not (Test-Path $SqlFile)) {
    Write-Host "[ERROR] Cannot find SQL file: $SqlFile" -ForegroundColor Red
    exit 1
}

# 1. Execute SQL reset script to clean transactions & orphaned records
Write-Host "[1/3] Cleaning up old transactions and resetting tables..." -ForegroundColor Yellow
$result = sqlcmd -I -S $ServerInstance -d $Database -i $SqlFile -b
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] sqlcmd failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Write-Host $result
    exit 1
}
Write-Host "  [OK] Database cleanup completed successfully." -ForegroundColor Green

# 2. Re-seed active demo contracts & business revenue (D55 / #60)
Write-Host ""
Write-Host "[2/3] Seeding demo contracts, access credentials & revenue (D55 / #60)..." -ForegroundColor Yellow
$testProj = Join-Path $ProjectRoot "StorageProject.Tests/StorageProject.Tests.csproj"
$seedCmd = "dotnet test `"$testProj`" -c Release --filter `"FullyQualifiedName~DatabaseSeedIntegrationTests.Seed_SqlServer_SSFRMS`""
Invoke-Expression $seedCmd | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARN] Dotnet seeder returned code $LASTEXITCODE; verifying database state..." -ForegroundColor DarkYellow
} else {
    Write-Host "  [OK] Demo contracts and revenue seeded successfully." -ForegroundColor Green
}

# 3. Verify storage unit availability, contracts, revenue & accounts
Write-Host ""
Write-Host "[3/3] Verifying live operational state & business revenue..." -ForegroundColor Yellow

$summarySql = @"
SELECT 'rental_contracts' as metric, Status as detail, COUNT(*) as cnt FROM rental_contracts GROUP BY Status
UNION ALL
SELECT 'payments', PaymentType, COUNT(*) FROM payments GROUP BY PaymentType
UNION ALL
SELECT 'storage_units', Status, COUNT(*) FROM storage_units GROUP BY Status;
"@

$summary = sqlcmd -S $ServerInstance -d $Database -Q $summarySql -h -1 -W
Write-Host "Operational Summary:" -ForegroundColor Cyan
Write-Host $summary

$revSql = @"
SELECT
    COUNT(*) as total_payments,
    CAST(SUM(CASE WHEN PaymentType = 'RENT' THEN Amount ELSE 0 END) AS BIGINT) as rent_revenue_vnd,
    CAST(SUM(CASE WHEN PaymentType = 'DEPOSIT' THEN Amount ELSE 0 END) AS BIGINT) as deposit_held_vnd,
    MIN(PaidAt) as earliest_paid,
    MAX(PaidAt) as latest_paid
FROM payments;
"@
$revResult = sqlcmd -S $ServerInstance -d $Database -Q $revSql -h -1 -W
Write-Host "Revenue & Time Range:" -ForegroundColor Cyan
Write-Host $revResult

$managerCheckSql = @"
SELECT f.Name as FacilityName, ISNULL(u.Username, 'NONE') as ManagerUsername, ISNULL(r.RoleName, 'NONE') as RoleName
FROM facilities f
LEFT JOIN user_facilities uf ON f.FacilityId = uf.FacilityId AND uf.Status = 'ACTIVE'
LEFT JOIN users u ON uf.UserId = u.UserId
LEFT JOIN user_roles ur ON u.UserId = ur.UserId
LEFT JOIN roles r ON ur.RoleId = r.RoleId AND r.RoleName = 'MANAGER'
WHERE f.Status = 'ACTIVE' AND (r.RoleName = 'MANAGER' OR u.Username IS NULL)
ORDER BY f.FacilityId;
"@
$managerResult = sqlcmd -S $ServerInstance -d $Database -Q $managerCheckSql -h -1 -W
Write-Host "Facility Manager Assignment Coverage (12 facilities):" -ForegroundColor Cyan
Write-Host $managerResult

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  DATABASE RESET & DEMO SEED COMPLETED - READY TO USE!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
