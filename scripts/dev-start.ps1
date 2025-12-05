<#
  Windows launcher for Impetus Lock (requires WSL).

  Changes:
  - Fail-fast prechecks for WSL + poetry/npm inside WSL
  - Opens two interactive windows so backend/frontend logs stream live
  - Keeps outputs visible; no background/hidden processes
#>

param(
    [string]$Distribution = "",
    [switch]$NoWT,
    [switch]$WT
)

$ErrorActionPreference = 'Stop'

function Invoke-WslCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Command
    )

    if ($Distribution) {
        wsl.exe -d $Distribution bash -lc $Command
    }
    else {
        wsl.exe bash -lc $Command
    }
}

function Convert-ToWslPath {
    param([Parameter(Mandatory = $true)][string]$WindowsPath)
    $result = Invoke-WslCommand "wslpath -a `"$WindowsPath`""
    return $result.Trim()
}

function Require-InWsl {
    param([Parameter(Mandatory = $true)][string]$Bin)
    $exists = Invoke-WslCommand "command -v $Bin >/dev/null 2>&1 && echo ok || echo miss"
    if ($exists.Trim() -ne 'ok') {
        throw "Missing required command in WSL: $Bin"
    }
}

function Open-NewWindow {
    param(
        [Parameter(Mandatory = $true)][string]$Title,
        [Parameter(Mandatory = $true)][string]$WslCommand
    )
    # Generate a temp ps1 to avoid quoting pitfalls
    $tmp = Join-Path $env:TEMP ("impetus-" + [Guid]::NewGuid().ToString("N") + ".ps1")
    $lines = @()
    $lines += "`$Host.UI.RawUI.WindowTitle = '$Title'"
    $lines += '$args = @()'
    if ($Distribution) {
        $lines += '$args += "-d"'
        $lines += "$" + "args += `"$Distribution`""
    }
    $escaped = $WslCommand.Replace('"','\"')
    $lines += '$args += "bash"'
    $lines += '$args += "-lc"'
    $lines += (\"`$args += \"\" + $escaped + \"\"\")
    $lines += '& wsl.exe @args'
    $lines += ""
    $lines += "Write-Host 'Process exited. Press Enter to close...'"
    $lines += "[void](Read-Host)"
    Set-Content -LiteralPath $tmp -Value ($lines -join "`n") -Encoding UTF8

    Start-Process -FilePath "pwsh.exe" -ArgumentList "-NoExit","-File", $tmp | Out-Null
}

# Resolve paths
$repoRootWin = (Resolve-Path "$PSScriptRoot\..").Path
$repoRootWsl = Convert-ToWslPath $repoRootWin

Write-Host "[dev-start] Repo (Windows): $repoRootWin"
Write-Host "[dev-start] Repo (WSL):     $repoRootWsl"

# Fail-fast prechecks
if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    Write-Error "WSL not found. Please enable WSL and retry."
    exit 1
}

Require-InWsl poetry
Require-InWsl npm

# Compose backend/frontend commands (run inside WSL)
$BACKEND_PORT   = if ($env:BACKEND_PORT)   { $env:BACKEND_PORT }   else { '8000' }
$FRONTEND_PORT  = if ($env:FRONTEND_PORT)  { $env:FRONTEND_PORT }  else { '5173' }
$FRONTEND_HOST  = if ($env:FRONTEND_HOST)  { $env:FRONTEND_HOST }  else { '0.0.0.0' }
$API_HOST       = if ($env:API_HOST)       { $env:API_HOST }       else { '0.0.0.0' }
$VITE_API_URL   = if ($env:VITE_API_URL)   { $env:VITE_API_URL }   else { "http://127.0.0.1:$BACKEND_PORT" }

$backendCmd = @(
    "cd '$repoRootWsl/server'",
    "poetry install --no-root >/dev/null 2>&1 || true",
    "poetry run uvicorn server.api.main:app --host $API_HOST --port $BACKEND_PORT --reload"
) -join " && "

$frontendCmd = @(
    "cd '$repoRootWsl/client'",
    "[ -f package-lock.json ] && npm ci >/dev/null 2>&1 || npm install >/dev/null 2>&1",
    "export VITE_API_URL='$VITE_API_URL'",
    "npm run dev -- --host $FRONTEND_HOST --port $FRONTEND_PORT"
) -join " && "

function Launch-WithWindowsTerminal {
    param(
        [Parameter(Mandatory = $true)][string]$BackendTitle,
        [Parameter(Mandatory = $true)][string]$BackendCmd,
        [Parameter(Mandatory = $true)][string]$FrontendTitle,
        [Parameter(Mandatory = $true)][string]$FrontendCmd
    )

    $hasWT = Get-Command wt.exe -ErrorAction SilentlyContinue
    if (-not $hasWT) { return $false }

    # Build argument array for wt.exe to avoid token concatenation issues
    $wslD = if ($Distribution) { "-d $Distribution " } else { "" }
    $backendPsCmd  = ('wsl.exe {0}bash -lc "{1}"' -f $wslD, ($BackendCmd  -replace '"','\"'))
    $frontendPsCmd = ('wsl.exe {0}bash -lc "{1}"' -f $wslD, ($FrontendCmd -replace '"','\"'))

    $args = @(
        'new-tab','--title', $BackendTitle, 'pwsh.exe','-NoExit','-Command', $backendPsCmd,
        ';',
        'split-pane','-H','--title', $FrontendTitle, 'pwsh.exe','-NoExit','-Command', $frontendPsCmd
    )

    try {
        Start-Process -FilePath 'wt.exe' -ArgumentList $args | Out-Null
        return $true
    }
    catch {
        Write-Warning "[dev-start] Windows Terminal launch failed: $($_.Exception.Message)"
        return $false
    }
}

Write-Host "[dev-start] Opening interactive views for Backend/Frontend..."

$useWT = $WT -and (-not $NoWT) -and (-not $env:IMPETUS_NO_WT)
if ($useWT) {
    if (-not (Launch-WithWindowsTerminal -BackendTitle "Impetus Backend ($BACKEND_PORT)" -BackendCmd $backendCmd -FrontendTitle "Impetus Frontend ($FRONTEND_PORT)" -FrontendCmd $frontendCmd)) {
        Write-Host "[dev-start] Windows Terminal failed. Falling back to separate PowerShell windows."
        Open-NewWindow -Title "Impetus Backend ($BACKEND_PORT)" -WslCommand $backendCmd
        Start-Sleep -Milliseconds 300
        Open-NewWindow -Title "Impetus Frontend ($FRONTEND_PORT)" -WslCommand $frontendCmd
    }
}
else {
    Open-NewWindow -Title "Impetus Backend ($BACKEND_PORT)" -WslCommand $backendCmd
    Start-Sleep -Milliseconds 300
    Open-NewWindow -Title "Impetus Frontend ($FRONTEND_PORT)" -WslCommand $frontendCmd
}

Write-Host ""
Write-Host "✅ Launched interactive windows. Watch output there."
Write-Host "- Backend:  http://127.0.0.1:$BACKEND_PORT (docs at /docs)"
Write-Host "- Frontend: http://localhost:$FRONTEND_PORT"
Write-Host ""
Write-Host "To customize ports/hosts, set env vars before running: BACKEND_PORT, FRONTEND_PORT, FRONTEND_HOST, API_HOST, VITE_API_URL"
