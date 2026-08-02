# Deploy Nexo backend to production server (192.168.0.64).
# Usage:  powershell -ExecutionPolicy Bypass -File backend/deploy-backend.ps1
# From repo root:  ./backend/deploy-backend.ps1
#
# Steps: cross-compile -> scp -> chmod +x -> sudo restart -> version check.

$ErrorActionPreference = 'Stop'
$SSH_HOST = 'dh-s-1@192.168.0.64'
$SUDO_PASS = '0611 .com'
$API_URL = 'https://neexxoo.hakerone.ru/api/version'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$BackendDir = Join-Path $RepoRoot 'backend'
$Binary = Join-Path $BackendDir 'nexo-linux'

if (-not (Test-Path $Binary)) { $Binary = Join-Path $BackendDir 'nexo-linux' }

Write-Host '=== Nexo backend deploy ===' -ForegroundColor Cyan

# 1. Get commit info from git
Push-Location $RepoRoot
try {
    $Sha = (git rev-parse HEAD).Trim()
    $Iso = (git log -1 --format=%ci).Trim() -replace ' ', 'T' -replace '\+.*', 'Z'
} finally {
    Pop-Location
}
Write-Host "Commit: $Sha" -ForegroundColor Green

# 2. Cross-compile for linux/amd64 (modernc SQLite = pure Go, no CGO)
Push-Location $BackendDir
try {
    $env:GOOS = 'linux'
    $env:GOARCH = 'amd64'
    $env:CGO_ENABLED = '0'
    Write-Host 'Building nexo-linux...' -ForegroundColor Yellow
    go build -ldflags "-X main.buildVersion=$Sha -X main.buildCommit=$Sha -X main.buildTime=$Iso" -o nexo-linux .
    if ($LASTEXITCODE -ne 0) { throw 'go build failed' }
    $Len = (Get-Item $Binary).Length
    Write-Host "Built: $([math]::Round($Len/1MB,1)) MB" -ForegroundColor Green
} finally {
    Pop-Location
}

# 3. Upload to server (goes to repo dir; deploy swaps via .new + mv to avoid Text-file-busy)
Write-Host 'Uploading via scp...' -ForegroundColor Yellow
scp $Binary "${SSH_HOST}:/opt/nexo-repo/backend/nexo-linux"
if ($LASTEXITCODE -ne 0) { throw 'scp failed' }

# 4. chmod +x, swap binary, restart service
Write-Host 'Swapping binary and restarting service...' -ForegroundColor Yellow
$SwapCmd = "chmod +x /opt/nexo/nexo /opt/nexo-repo/backend/nexo-linux && " +
           "cp /opt/nexo-repo/backend/nexo-linux /opt/nexo/nexo.new && " +
           "mv -f /opt/nexo/nexo.new /opt/nexo/nexo && " +
           "echo '$SUDO_PASS' | sudo -S systemctl restart nexo.service 2>/dev/null && " +
           "sleep 3 && systemctl is-active nexo.service"
$State = (ssh $SSH_HOST $SwapCmd).Trim()
if ($LASTEXITCODE -ne 0) { throw "ssh deploy failed: $State" }
Write-Host "Service state: $State" -ForegroundColor Green
if ($State -ne 'active') { throw "Service not active (state: $State)" }

# 5. Verify public API reports the new commit
Write-Host 'Verifying /api/version...' -ForegroundColor Yellow
$Ver = (curl.exe -s -H 'Accept: application/json' $API_URL | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0) { throw 'version check failed' }
Write-Host "Deployed: $($Ver.version) (commit $($Ver.commit))" -ForegroundColor Green
if ($Ver.commit -ne $Sha) { Write-Warning "API reports $($Ver.commit), expected $Sha" }

Write-Host '=== Deploy complete ===' -ForegroundColor Cyan
