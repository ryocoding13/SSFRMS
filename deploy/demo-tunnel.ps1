<#
.SYNOPSIS
  Chay demo SafeSpace bang deploy/compose.yml va public ra Internet qua Tailscale Funnel (link co dinh).

.DESCRIPTION
  1. Bat Docker Desktop neu chua chay; kiem tra Tailscale da cai va dang nhap.
  2. Tao deploy/.env (SA_PASSWORD, JWT_SECRET ngau nhien, SEED_MODE=Development) neu chua co.
  3. Bat "tailscale funnel --bg <port>" va lay link https://<ten-may>.<tailnet>.ts.net tu "tailscale funnel status".
  4. Ghi link vao FRONTEND_URL, docker compose up (compose tu recreate api neu gia tri doi).
  5. Kiem tra /health/ready o localhost va qua link public.

  Yeu cau: da cai Tailscale cho Windows, da "tailscale up", tailnet da bat HTTPS va Funnel.
  File nay chi dung ky tu ASCII de chay duoc tren Windows PowerShell 5.1.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\demo-tunnel.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\demo-tunnel.ps1 -NoBuild
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\demo-tunnel.ps1 -Stop
#>
[CmdletBinding()]
param(
    # Ghi de link public. Bo trong thi tu lay link ts.net tu "tailscale funnel status".
    [string]$PublicUrl,
    # Bo qua buoc build lai image (dung image da co).
    [switch]$NoBuild,
    # Tat Funnel (tailscale funnel reset) va dung cac container, giu nguyen du lieu SQL.
    [switch]$Stop
)

$ErrorActionPreference = 'Stop'

$deployDir    = $PSScriptRoot
$composeFile  = Join-Path $deployDir 'compose.yml'
# compose.demo.yml bo cong 1433 ra host (tranh dung SQL Server cai san tren may).
$demoOverride = Join-Path $deployDir 'compose.demo.yml'
$envFile      = Join-Path $deployDir '.env'
$stateDir     = Join-Path $env:LOCALAPPDATA 'SafeSpaceDemoTunnel'

if ($PublicUrl) {
    $PublicUrl = $PublicUrl.Trim().TrimEnd('/')
    if ($PublicUrl -notmatch '^https://[A-Za-z0-9.-]+$') {
        throw '-PublicUrl phai co dang https://ten-may.tailnet.ts.net (khong co duong dan phia sau).'
    }
}

function Write-Step([string]$Message) { Write-Host "==> $Message" -ForegroundColor Cyan }

function New-Secret([int]$Length) {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'.ToCharArray()
    $bytes = New-Object byte[] $Length
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

function Write-EnvLines([string[]]$Lines) {
    # UTF-8 khong BOM: BOM lam docker compose doc sai khoa dau tien.
    [System.IO.File]::WriteAllLines($envFile, $Lines, (New-Object System.Text.UTF8Encoding($false)))
}

function Get-EnvValue([string]$Key) {
    foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=(.*)$") { return $Matches[1].Trim() }
    }
    return $null
}

function Set-EnvValue([string]$Key, [string]$Value) {
    $lines = [System.Collections.Generic.List[string]]::new()
    $found = $false
    foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
        if ($line -match "^\s*$([regex]::Escape($Key))\s*=") {
            if (-not $found) { $lines.Add("$Key=$Value") }
            $found = $true
        } else {
            $lines.Add($line)
        }
    }
    if (-not $found) { $lines.Add("$Key=$Value") }
    Write-EnvLines $lines.ToArray()
}

function Test-Docker {
    cmd /c "docker info >nul 2>&1"
    return ($LASTEXITCODE -eq 0)
}

function Invoke-Compose {
    # docker compose ghi tien trinh ra stderr; khong de PowerShell 5.1 coi do la loi.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker compose -f $composeFile -f $demoOverride --env-file $envFile @args
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($LASTEXITCODE -ne 0) { throw "docker compose $($args -join ' ') that bai (ma thoat $LASTEXITCODE)." }
}

function Get-ApiContainerId {
    return (cmd /c "docker inspect --format {{.Id}} safespace-api 2>nul" | Select-Object -First 1)
}

function Wait-Http200([string]$Url, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $code = ''
    while ((Get-Date) -lt $deadline) {
        $code = (& curl.exe -s -o NUL -m 10 -w '%{http_code}' $Url)
        if ($code -eq '200') { return $true }
        Start-Sleep -Seconds 3
    }
    Write-Host "    Lan thu cuoi: HTTP $code ($Url)" -ForegroundColor Yellow
    return $false
}

function Find-Tailscale {
    $command = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    $candidate = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (Test-Path $candidate) { return $candidate }
    throw 'Khong tim thay tailscale.exe. Hay cai Tailscale cho Windows va dang nhap truoc.'
}

function Get-FunnelStatus([string]$Tailscale) {
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { return (& $Tailscale funnel status 2>&1 | Out-String) } finally { $ErrorActionPreference = $previous }
}

function Enable-Funnel([string]$Tailscale, [string]$Port) {
    $status = Get-FunnelStatus $Tailscale
    if ($status -match 'Funnel on' -and $status -match "127\.0\.0\.1:$Port\b") { return $status }

    # Neu tailnet chua bat Funnel/HTTPS, lenh nay in link Enable roi dung cho; gioi han 30 giay de khong treo.
    $out = Join-Path $stateDir 'funnel.out'
    $err = Join-Path $stateDir 'funnel.err'
    Remove-Item $out, $err -Force -ErrorAction SilentlyContinue
    $process = Start-Process -FilePath $Tailscale -ArgumentList 'funnel', '--bg', $Port `
        -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru
    $null = $process.Handle   # giu handle, neu khong PowerShell 5.1 tra ExitCode rong
    $finished = $process.WaitForExit(30000)
    if (-not $finished) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    $text = ((Get-Content $out, $err -ErrorAction SilentlyContinue) -join "`n").Trim()
    if (-not $finished) {
        throw "tailscale funnel chua bat duoc. Lam theo huong dan duoi day (bam Enable tren trinh duyet) roi chay lai:`n$text"
    }
    if ($process.ExitCode -ne 0) { throw "tailscale funnel --bg $Port that bai:`n$text" }

    $status = Get-FunnelStatus $Tailscale
    if ($status -notmatch 'Funnel on') { throw "Funnel chua bat sau khi chay lenh:`n$status" }
    return $status
}

New-Item -ItemType Directory -Force $stateDir | Out-Null

# --- Che do dung ---------------------------------------------------------------
if ($Stop) {
    Write-Step 'Tat Tailscale Funnel (tailscale funnel reset)'
    & (Find-Tailscale) funnel reset
    if ((Test-Path $envFile) -and (Test-Docker)) {
        Write-Step 'Dung cac container (giu du lieu SQL)'
        Invoke-Compose stop
    }
    Write-Host 'Da dung demo.' -ForegroundColor Green
    return
}

# --- 1. Docker ------------------------------------------------------------------
Write-Step 'Kiem tra Docker'
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Khong tim thay lenh docker. Hay cai Docker Desktop truoc.' }
if (-not (Test-Docker)) {
    $desktop = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\Docker Desktop.exe'),
        (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe')
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $desktop) { throw 'Docker chua chay va khong tim thay Docker Desktop.exe. Hay mo Docker Desktop roi chay lai.' }
    Write-Host '    Docker chua chay, dang mo Docker Desktop...'
    Start-Process -FilePath $desktop
    $deadline = (Get-Date).AddMinutes(4)
    while (-not (Test-Docker)) {
        if ((Get-Date) -gt $deadline) { throw 'Docker Desktop khong san sang sau 4 phut.' }
        Start-Sleep -Seconds 5
    }
}

# --- 2. Tailscale ---------------------------------------------------------------
Write-Step 'Kiem tra Tailscale'
$tailscale = Find-Tailscale
cmd /c "`"$tailscale`" status >nul 2>&1"
if ($LASTEXITCODE -ne 0) { throw 'Tailscale chua dang nhap hoac chua chay. Chay "tailscale up" roi chay lai.' }
Write-Host "    $tailscale"

# --- 3. deploy/.env -------------------------------------------------------------
Write-Step 'Kiem tra deploy/.env'
if (-not (Test-Path $envFile)) {
    cmd /c "docker volume inspect deploy_sql_data >nul 2>&1"
    if ($LASTEXITCODE -eq 0) {
        Write-Warning 'Volume deploy_sql_data da ton tai voi mat khau SA cu. Mat khau moi trong .env se khong dang nhap duoc SQL Server; hay khoi phuc .env cu.'
    }
    Write-EnvLines @(
        '# Tao boi deploy/demo-tunnel.ps1 - KHONG commit file nay.',
        ('SA_PASSWORD=Aa1' + (New-Secret 24)),
        ('JWT_SECRET=' + (New-Secret 48)),
        'SEED_MODE=Development',
        'FRONTEND_URL=http://localhost:8080',
        'PORT=8080'
    )
    Write-Host '    Da tao deploy/.env voi SA_PASSWORD va JWT_SECRET ngau nhien.'
}
foreach ($required in 'SA_PASSWORD', 'JWT_SECRET') {
    if (-not (Get-EnvValue $required)) { throw "deploy/.env thieu $required." }
}
if ((Get-EnvValue 'JWT_SECRET').Length -lt 32) { throw 'JWT_SECRET trong deploy/.env phai co it nhat 32 ky tu.' }
if (-not (Get-EnvValue 'SEED_MODE')) { Set-EnvValue 'SEED_MODE' 'Development' }
$port = Get-EnvValue 'PORT'
if (-not $port) { $port = '8080' }
$localBase = "http://127.0.0.1:$port"

# --- 4. Funnel va link public ---------------------------------------------------
Write-Step "Bat Tailscale Funnel cho cong $port"
$funnelStatus = Enable-Funnel $tailscale $port
$funnelUrl = ([regex]::Match($funnelStatus, 'https://[A-Za-z0-9.-]+\.ts\.net')).Value
if (-not $PublicUrl) {
    if (-not $funnelUrl) { throw "Khong doc duoc link ts.net tu 'tailscale funnel status':`n$funnelStatus" }
    $PublicUrl = $funnelUrl
} elseif ($funnelUrl -and $funnelUrl -ne $PublicUrl) {
    Write-Warning "Funnel dang phuc vu $funnelUrl, khac -PublicUrl ($PublicUrl)."
}
Write-Host "    $PublicUrl"

# --- 5. Chay stack --------------------------------------------------------------
Set-EnvValue 'FRONTEND_URL' $PublicUrl
$apiBefore = Get-ApiContainerId
Write-Step 'docker compose up'
if ($NoBuild) { Invoke-Compose up -d } else { Invoke-Compose up -d --build }
if ($apiBefore -and (Get-ApiContainerId) -ne $apiBefore) {
    # nginx giu IP cu cua container api vua duoc recreate; restart de phan giai lai.
    Invoke-Compose restart web
}

Write-Step "Cho $localBase/health/ready"
if (-not (Wait-Http200 "$localBase/health/ready" 240)) {
    throw "Stack chua san sang o localhost. Xem log: docker logs safespace-api ; docker logs safespace-migrator"
}

# --- 6. Kiem tra qua link public -----------------------------------------------
Write-Step "Kiem tra $PublicUrl/health/ready (DNS moi co the mat toi 10 phut)"
if (-not (Wait-Http200 "$PublicUrl/health/ready" 600)) {
    throw "Link public chua tra 200 cho /health/ready. Funnel van dang bat, thu lai sau: $PublicUrl/health/ready"
}

Write-Host ''
Write-Host "Demo san sang: $PublicUrl" -ForegroundColor Green
Write-Host "Health:        $PublicUrl/health/ready"
Write-Host 'Funnel chay nen va tu bat lai sau khi khoi dong may. Tat bang: deploy\demo-tunnel.ps1 -Stop'
