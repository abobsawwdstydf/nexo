param(
    [switch]$Force,
    [switch]$SkipGitPush
)

$ErrorActionPreference = "Continue"
$LogDir = Join-Path $PSScriptRoot ".auto-improve-logs"
$LogFile = Join-Path $LogDir "auto-improve-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').log"
$StateFile = Join-Path $LogDir "state.json"
$LockFile = Join-Path $LogDir "running.lock"
$MaxRetries = 3

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $Message"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Write-State {
    param($Status, $SessionId = "", $ErrorMessage = "", $RetryCount = 0)
    $state = @{ status=$Status; sessionId=$SessionId; errorMessage=$ErrorMessage; retryCount=$RetryCount; lastRun=(Get-Date -Format "o") }
    $state | ConvertTo-Json | Set-Content -Path $StateFile -Force -Encoding UTF8
}

function Read-State {
    if (Test-Path $StateFile) { try { return Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null } }
    return $null
}

function Invoke-Opencode {
    param($Prompt, $SessionId = "", $RetryNumber = 0)
    $args = @("run")
    if ($SessionId) { $args += "--continue" }
    $args += "--model"; $args += "opencode/big-pickle"
    $args += "--auto"; $args += "--print-logs"
    $args += $Prompt

    $pPreview = if ($Prompt.Length -gt 100) { $Prompt.Substring(0,100)+"..." } else { $Prompt }
    Write-Log "Running: opencode run --model opencode/big-pickle --auto"
    Write-Log "Prompt: $pPreview"

    $start = Get-Date
    $sLog = Join-Path $LogDir "session-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

    try {
        $proc = Start-Process -FilePath "opencode" -ArgumentList $args -NoNewWindow -Wait -PassThru -RedirectStandardOutput $sLog -RedirectStandardError "$sLog.err"
        $dur = (Get-Date) - $start
        if ($proc.ExitCode -eq 0) {
            Write-Log "OK (exit:0, $($dur.TotalMinutes.ToString('F1'))min)"
            return @{ Success=$true }
        } else {
            Write-Log "FAIL (exit:$($proc.ExitCode), $($dur.TotalMinutes.ToString('F1'))min)"
            return @{ Success=$false; ExitCode=$proc.ExitCode }
        }
    } catch {
        Write-Log "Exception: $_"
        return @{ Success=$false; ExitCode=-1 }
    }
}

function Invoke-GitOps {
    Write-Log "=== GIT ==="
    Push-Location $PSScriptRoot
    git add -A 2>&1 | % { Write-Log "add: $_" }
    $d = git diff --cached --stat 2>&1
    if (-not $d) { Write-Log "No changes"; Pop-Location; return $true }
    git commit -m "auto-improve: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1 | % { Write-Log "commit: $_" }
    if ($LASTEXITCODE -gt 1) { Write-Log "commit FAILED"; Pop-Location; return $false }
    if (-not $SkipGitPush) {
        git push 2>&1 | % { Write-Log "push: $_" }
        if ($LASTEXITCODE) { Start-Sleep 5; git push 2>&1 | % { Write-Log "push-retry: $_" } }
    }
    Pop-Location
    return $true
}

Write-Log "============================="
Write-Log " NEXO AUTO-IMPROVE"
Write-Log " Start: $(Get-Date)"
Write-Log " CWD: $PSScriptRoot"
Write-Log " Model: opencode/big-pickle"
Write-Log "============================="

if (Test-Path $LockFile) {
    $age = (Get-Date) - (Get-Item $LockFile).LastWriteTime
    if ($age.TotalHours -lt 6 -and -not $Force) { Write-Log "LOCKED"; exit 1 }
    else { Write-Log "Stale lock" }
}
"pid=$pid" | Out-File $LockFile -Force -Encoding UTF8

try {
    $st = Read-State
    $sid = if ($st) { $st.sessionId } else { "" }
    $rc = if ($st) { [int]$st.retryCount } else { 0 }
    Write-Log "State: status=$($st.status) sid=$sid retry=$rc"

    Write-Log "Starting opencode run..."
    $result = Invoke-Opencode -Prompt "You are an autonomous code improvement agent for the Nexo project. CRITICAL: NEVER touch nexo.db, uploads/, AGENTS.md, PLANS.md, README.md. Execute in order: 1) git status, npx tsc --noEmit, go build 2) Fix errors found 3) Remove dead code, optimize 4) Verify with tsc+go build again 5) Report changes made." -SessionId $sid -RetryNumber 0

    if ($result.Success) {
        Write-Log "=== SUCCESS ==="
        Write-State "" "" "" 0
    } else {
        Write-Log "=== RETRY ==="
        Start-Sleep 30
        $result2 = Invoke-Opencode -Prompt "Continue the previous auto-improvement session. Run diagnostics, fix remaining issues, verify, and report." -SessionId $sid -RetryNumber 1
    }

    Write-Log "=== Git ==="
    Invoke-GitOps | Out-Null
} finally {
    if (Test-Path $LockFile) { Remove-Item $LockFile -Force }
    Write-Log "DONE: $(Get-Date)"
}