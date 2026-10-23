# ==============================================================================
# SafeSpace SSFRMS — SQL Server Database Backup Script (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$BackupDir = "backups",
    [string]$DatabaseName = "SSFRMS",
    [string]$ConnectionString = $env:ConnectionStrings__DefaultConnection,
    [string]$ContainerName = "safespace-sqlserver"
)

$ErrorActionPreference = "Stop"

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  SafeSpace SSFRMS — Database Backup                " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFileName = "${DatabaseName}_backup_${timestamp}.bak"
$backupFilePath = Join-Path $BackupDir $backupFileName
$resolvedBackupPath = (Resolve-Path $BackupDir).Path
$fullBackupFile = Join-Path $resolvedBackupPath $backupFileName

Write-Host "Target: $fullBackupFile" -ForegroundColor Gray

# Nếu có SQL Server cục bộ hoặc connection string
if (-not $ConnectionString) {
    $ConnectionString = "Server=.\SQLEXPRESS;Database=master;Trusted_Connection=True;TrustServerCertificate=True;"
}

try {
    # Dùng SqlClient thực hiện backup nếu có thể
    Add-Type -AssemblyName "Microsoft.Data.SqlClient" -ErrorAction SilentlyContinue
    $conn = New-Object Microsoft.Data.SqlClient.SqlConnection($ConnectionString)
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
    
    docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd `
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
