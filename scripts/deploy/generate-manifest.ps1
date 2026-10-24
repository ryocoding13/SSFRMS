# ==============================================================================
# SafeSpace SSFRMS - Release Manifest Generator (PowerShell)
# ==============================================================================
[CmdletBinding()]
param(
    [string]$OutputFile = "artifacts/release-manifest.json",
    [string]$CommitSha = "",
    [string]$Repository = $env:GITHUB_REPOSITORY,
    [string]$RunId = $env:GITHUB_RUN_ID,
    [string]$ApiDigest = "",
    [string]$WebDigest = "",
    [string]$MigratorDigest = ""
)

$ErrorActionPreference = "Stop"

if (-not $CommitSha) {
    $CommitSha = (git rev-parse HEAD).Trim()
}
if (-not $Repository) {
    $Repository = "ryocoding13/SSFRMS"
}
if (-not $RunId) {
    $RunId = "manual-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
}

if ($CommitSha -notmatch "^[0-9a-fA-F]{40}$") {
    throw "CommitSha must be 40 hexadecimal characters: '$CommitSha'"
}

$repoLower = $Repository.ToLowerInvariant()
$tag = "sha-$CommitSha"

$shaPattern = "^sha256:[0-9a-f]{64}$"
$zeroPattern = "^sha256:0{64}$"

if (-not $ApiDigest -or $ApiDigest -notmatch $shaPattern -or $ApiDigest -match $zeroPattern) {
    throw "ApiDigest is missing, invalid or all-zero: '$ApiDigest'. Valid sha256 digest is required."
}
if (-not $WebDigest -or $WebDigest -notmatch $shaPattern -or $WebDigest -match $zeroPattern) {
    throw "WebDigest is missing, invalid or all-zero: '$WebDigest'. Valid sha256 digest is required."
}
if (-not $MigratorDigest -or $MigratorDigest -notmatch $shaPattern -or $MigratorDigest -match $zeroPattern) {
    throw "MigratorDigest is missing, invalid or all-zero: '$MigratorDigest'. Valid sha256 digest is required."
}

$gateFe = if ($env:GATE_FE) { $env:GATE_FE } else { "success" }
$gateBe = if ($env:GATE_BE) { $env:GATE_BE } else { "success" }
$gateInt = if ($env:GATE_INT) { $env:GATE_INT } else { "success" }
$gateCont = if ($env:GATE_CONT) { $env:GATE_CONT } else { "success" }

$manifest = [ordered]@{
    schemaVersion = "1.0.0"
    commit = $CommitSha
    repository = $Repository
    runId = [string]$RunId
    timestamp = [DateTime]::UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ")
    migrationHead = "20261020154838_ReservationPaymentIntegrity"
    images = [ordered]@{
        api = [ordered]@{
            image = "ghcr.io/$repoLower/api"
            tag = $tag
            digest = $ApiDigest
        }
        web = [ordered]@{
            image = "ghcr.io/$repoLower/web"
            tag = $tag
            digest = $WebDigest
        }
        migrator = [ordered]@{
            image = "ghcr.io/$repoLower/migrator"
            tag = $tag
            digest = $MigratorDigest
        }
    }
    gateResults = [ordered]@{
        frontend = $gateFe
        backend = $gateBe
        integration = $gateInt
        container = $gateCont
    }
}

$dir = Split-Path -Parent $OutputFile
if ($dir -and -not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
}

$json = $manifest | ConvertTo-Json -Depth 5
Set-Content -Path $OutputFile -Value $json -Encoding UTF8
Write-Host "Release manifest generated at: $OutputFile" -ForegroundColor Green
Write-Host $json -ForegroundColor Gray
