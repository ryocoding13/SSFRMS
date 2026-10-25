# ==============================================================================
# SafeSpace SSFRMS -- SQL Server Database Backup Script (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$BackupDir = "deploy/backups",
    [string]$DatabaseName = "SSFRMS",
    [string]$ContainerName = "safespace-staging-sqlserver",
    [string]$ConnectionString = $env:ConnectionStrings__DefaultConnection
)

$ErrorActionPreference = "Stop"

$timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$backupFileName = "${DatabaseName}_backup_${timestamp}.bak"
$fullBackupFile = Join-Path $BackupDir $backupFileName

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace SSFRMS -- Database Backup               " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Database:  $DatabaseName"
Write-Host "Container: $ContainerName"
Write-Host "Backup to: $fullBackupFile"

# 1. Neu co SQL Server cuc bo hoac connection string
if (-not $ConnectionString) {
    $ConnectionString = "Server=.\SQLEXPRESS;Database=master;Trusted_Connection=True;TrustServerCertificate=True;"
}

try {
    # Dung SqlClient thuc hien backup neu co the
    Add-Type -AssemblyName "System.Data" -ErrorAction SilentlyContinue
    $conn = New-Object System.Data.SqlClient.SqlConnection($ConnectionString)
    $conn.Open()
    $cmd = $conn.CreateCommand()
    $cmd.CommandTimeout = 120
    $cmd.CommandText = "BACKUP DATABASE [$DatabaseName] TO DISK = N'$fullBackupFile' WITH INIT, STATS = 10"
    $cmd.ExecuteNonQuery() | Out-Null
    $conn.Close()

    if (Test-Path $fullBackupFile) {
        $size = (Get-Item $fullBackupFile).Length
        Write-Host "Backup completed successfully! Size: $size bytes" -ForegroundColor Green
        Write-Host "Backup file: $fullBackupFile" -ForegroundColor Green
    } else {
        throw "Backup file was not created!"
    }
}
catch {
    Write-Host "SqlClient backup failed: $_" -ForegroundColor Yellow
    Write-Host "Trying docker container backup fallback..." -ForegroundColor Gray

    # Fallback container
    $saPass = $env:SA_PASSWORD
    if (-not $saPass) { $saPass = "SafeSpace!Dev2026_StrongPassword" }

    docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd -b `
        -S localhost -U sa -P $saPass -C `
        -Q "BACKUP DATABASE [$DatabaseName] TO DISK = N'/var/opt/mssql/data/$backupFileName' WITH INIT"

    docker cp "${ContainerName}:/var/opt/mssql/data/$backupFileName" $fullBackupFile
    docker exec $ContainerName rm -f "/var/opt/mssql/data/$backupFileName"

    if (Test-Path $fullBackupFile) {
        $size = (Get-Item $fullBackupFile).Length
        Write-Host "Container backup successful! Size: $size bytes" -ForegroundColor Green
    } else {
        throw "Failed to create database backup!"
    }
}
