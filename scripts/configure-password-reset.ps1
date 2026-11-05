# Chạy ở PowerShell: .\scripts\configure-password-reset.ps1
$ErrorActionPreference = 'Stop'
$project = Join-Path $PSScriptRoot '../StorageProject.Api/StorageProject.Api.csproj'
$senderEmail = (Read-Host 'Email Gmail dùng gửi mã').Trim()
if ($senderEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$') { throw 'Email chưa hợp lệ.' }
$securePassword = Read-Host 'Mật khẩu ứng dụng Gmail 16 ký tự (không phải mật khẩu đăng nhập)' -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $appPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr).Replace(' ', '')
    if ($appPassword.Length -ne 16) { throw 'Mật khẩu ứng dụng Gmail cần đủ 16 ký tự, không tính khoảng trắng.' }
    # Giữ HashKey nếu đã cấu hình để không vô hiệu hoá mã còn hạn khi chạy lại script.
    $secretsPath = Join-Path $env:APPDATA 'Microsoft/UserSecrets/ssfrms-local-development/secrets.json'
    $hashKey = $null
    if (Test-Path $secretsPath) {
        $existing = Get-Content $secretsPath -Raw | ConvertFrom-Json
        $hashKey = $existing.'PasswordReset:HashKey'
    }
    if ([string]::IsNullOrWhiteSpace($hashKey) -or $hashKey.Length -lt 32) {
        $bytes = New-Object byte[] 32
        $random = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $random.GetBytes($bytes) } finally { $random.Dispose() }
        $hashKey = [Convert]::ToBase64String($bytes)
    }
    $settings = @{
        'Smtp:Host' = 'smtp.gmail.com'; 'Smtp:Port' = '587'; 'Smtp:Security' = 'StartTls'
        'Smtp:Username' = $senderEmail; 'Smtp:FromEmail' = $senderEmail
        'Smtp:Password' = $appPassword; 'PasswordReset:HashKey' = $hashKey
    } | ConvertTo-Json -Compress
    # Truyền JSON qua stdin, không ghi mật khẩu vào đối số hay file trong repo.
    $settings | dotnet user-secrets set --project $project
    if ($LASTEXITCODE -ne 0) { throw 'Không lưu được cấu hình SMTP.' }
    Write-Host 'Đã lưu cấu hình trên máy này. Khởi động lại backend rồi thử Quên mật khẩu.'
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
    $appPassword = $null; $settings = $null
}
