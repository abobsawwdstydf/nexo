param([switch]$Force,[switch]$SkipGitPush)

$ErrorActionPreference = "Continue"
$LogDir = Join-Path $PSScriptRoot ".auto-improve-logs"
$LogFile = Join-Path $LogDir "auto-improve-$(Get-Date -Format 'yyyy-MM-dd_HH-mm-ss').log"
$StateFile = Join-Path $LogDir "state.json"
$LockFile = Join-Path $LogDir "running.lock"
$MaxRetries = 3

if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

function Write-Log { param([string]$Message)
    $t = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $l = "[$t] $Message"
    Write-Host $l; Add-Content -Path $LogFile -Value $l
}

function Write-State { param($Status,$SessionId="",$ErrorMessage="",$RetryCount=0)
    @{status=$Status;sessionId=$SessionId;errorMessage=$ErrorMessage;retryCount=$RetryCount;lastRun=(Get-Date -Format "o")} | ConvertTo-Json | Set-Content $StateFile -Force -Encoding UTF8
}

function Read-State {
    if (Test-Path $StateFile) { try { return Get-Content $StateFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return $null } }
    return $null
}

function Invoke-Opencode { param($Prompt, $SessionId="")
    # Build argument list, escaping the prompt for inline PowerShell -Command
    $argsList = @("run")
    if ($SessionId) { $argsList += "--continue" }
    $argsList += "--model"; $argsList += "opencode/big-pickle"
    $argsList += "--auto"
    $argsList += "--print-logs"

    # Quote the prompt for safe command-line passing
    $escapedPrompt = $Prompt -replace "'", "''"
    $psCmd = "opencode $($argsList -join ' ') '$escapedPrompt'"

    $pPrev = if ($Prompt.Length -gt 100) { $Prompt.Substring(0,100)+"..." } else { $Prompt }
    Write-Log "Running: opencode run --model opencode/big-pickle --auto"
    Write-Log "Prompt: $pPrev"

    $start = Get-Date
    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "powershell.exe"
        $psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -Command $psCmd"
        $psi.WorkingDirectory = $PSScriptRoot
        $psi.UseShellExecute = $true
        $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
        $proc = [System.Diagnostics.Process]::Start($psi)
        if ($proc) {
            Write-Log "PID: $($proc.Id)"
            $exited = $proc.WaitForExit(7200000) # 2 hour timeout
            $dur = (Get-Date) - $start
            if ($exited) {
                Write-Log "Exit code: $($proc.ExitCode), duration: $($dur.TotalMinutes.ToString('F1'))min"
                if ($proc.ExitCode -eq 0) { return @{Success=$true} }
                return @{Success=$false; ExitCode=$proc.ExitCode; Duration=$dur}
            } else {
                Write-Log "TIMEOUT after 2h"
                try { $proc.Kill() } catch {}
                return @{Success=$false; ExitCode=-999; Duration=$dur}
            }
        }
    } catch { Write-Log "Exception: $_"; return @{Success=$false; ExitCode=-1} }
    return @{Success=$false; ExitCode=-1}
}

function Invoke-GitOps {
    Write-Log "=== GIT ==="; Push-Location $PSScriptRoot
    git add -A 2>&1 | % { Write-Log "add: $_" }
    $d = git diff --cached --stat 2>&1
    if (-not $d) { Write-Log "No changes"; Pop-Location; return $true }
    git commit -m "auto-improve: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" 2>&1 | % { Write-Log "commit: $_" }
    if ($LASTEXITCODE -gt 1) { Write-Log "commit FAILED"; Pop-Location; return $false }
    if (-not $SkipGitPush) {
        git push 2>&1 | % { Write-Log "push: $_" }
        if ($LASTEXITCODE) { Start-Sleep 5; git push 2>&1 | % { Write-Log "push-retry: $_" } }
    }
    Pop-Location; return $true
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
    $st = Read-State; $sid = if ($st) { $st.sessionId } else { "" }
    Write-Log "Starting opencode run..."

    $prompt = "Ты - автономный агент по улучшению кода проекта Нексо (защищённый мессенджер). КРИТИЧЕСКИЕ ПРАВИЛА: 1) НИКОГДА не трогай nexo.db, uploads/, backend/uploads/, JWT токены, пароли, личные данные пользователей. 2) НИКОГДА не изменяй AGENTS.md, PLANS.md, README.md. 3) Фокус ТОЛЬКО на: качество кода, производительность, баг-фиксы, рефакторинг, оптимизация. Выполняй по порядку: ФАЗА 1 - Диагностика: git status, cd frontend && npx tsc --noEmit, cd backend && go build ./.... ФАЗА 2 - Исправь все найденные ошибки компиляции и баги. ФАЗА 3 - Удали мёртвый код, упрости сложные выражения, вынеси повторяющуюся логику в функции, оптимизируй React ре-рендеры, улучши обработку ошибок в Go. ФАЗА 4 - Добавь ErrorBoundary где нужно, улучши TypeScript типы, поправь null/undefined проверки. ФАЗА 5 - Перезапусти tsc и go build для проверки. После завершения сделай git add -A && git commit -m 'auto-improve: список изменений' (НЕ пушить, этим занимается скрипт). Отчитайся на русском языке что было сделано."

    $result = Invoke-Opencode -Prompt $prompt -SessionId $sid

    if (-not $result.Success) {
        Write-Log "Failed (exit:$($result.ExitCode)), retrying with --continue..."
        Start-Sleep 30
        $result2 = Invoke-Opencode -Prompt "Продолжи предыдущую сессию авто-улучшения. Проверь что уже сделано и что осталось. Заверши оставшиеся задачи: исправь ошибки компиляции, отрефактори код, оптимизируй производительность. Сделай git add -A && git commit -m 'auto-improve: продолжение улучшений'. Отчитайся на русском." -SessionId $sid
    }

    Write-Log "=== Git Operations ==="
    Invoke-GitOps | Out-Null
    Write-Log "=== DONE ==="
    Write-State "completed" "" "" 0
} catch { Write-Log "FATAL: $_" } finally {
    if (Test-Path $LockFile) { Remove-Item $LockFile -Force }
    Write-Log "Finished: $(Get-Date)"
}