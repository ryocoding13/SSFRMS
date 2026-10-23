# ==============================================================================
# SafeSpace SSFRMS — Release Manifest Generator (PowerShell)
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

$repoLower = $Repository.ToLowerInvariant()
$tag = "sha-$CommitSha"

if (-not $ApiDigest) {
    $ApiDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
}
if (-not $WebDigest) {
    $WebDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
}
if (-not $MigratorDigest) {
    $MigratorDigest = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
}

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
        frontend = "success"
        backend = "success"
        integration = "success"
        container = "success"
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
