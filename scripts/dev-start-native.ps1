<#
  Native Windows launcher for Impetus Lock (no WSL required).

  - Opens two PowerShell windows (backend/frontend) with live output
  - Creates a per-project venv at server\.venv.windows and installs deps
  - Starts uvicorn on 127.0.0.1:8000 and Vite on localhost:5173
  - Skips database initialization by default (sets SKIP_DB=1)

  Usage: .\scripts\dev-start-native.ps1
#>

param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173,
  [string]$FrontendHost = '0.0.0.0',
  [switch]$NoInstall
)

$ErrorActionPreference = 'Stop'

function Require-Cmd {
  param([Parameter(Mandatory=$true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

function Open-Window {
    param(
        [Parameter(Mandatory=$true)][string]$Title,
        [Parameter(Mandatory=$true)][string]$Command,
        [string]$WorkDir = $PWD
    )
  $tmp = Join-Path $env:TEMP ("impetus-" + [Guid]::NewGuid().ToString("N") + ".ps1")
  $script = @(
    "`$Host.UI.RawUI.WindowTitle = '" + ($Title.Replace("'","''")) + "'",
    "Set-Location -LiteralPath `"$WorkDir`"",
    $Command,
    "",
    "Write-Host 'Process exited. Press Enter to close...'",
    "[void](Read-Host)"
  ) -join "`n"
  Set-Content -LiteralPath $tmp -Value $script -Encoding UTF8
  Start-Process -FilePath 'pwsh.exe' -ArgumentList '-NoExit','-File', $tmp | Out-Null
}

$repo = (Resolve-Path "$PSScriptRoot\..\").Path
$server = Join-Path $repo 'server'
$client = Join-Path $repo 'client'

Write-Host "[native] Repo:    $repo"
Write-Host "[native] Server:  $server"
Write-Host "[native] Client:  $client"

Require-Cmd pwsh
Require-Cmd python
Require-Cmd npm

# Backend venv
$venv = Join-Path $server '.venv.windows'
$venvPython = Join-Path $venv 'Scripts\python.exe'
$venvPip = Join-Path $venv 'Scripts\pip.exe'

if (-not (Test-Path $venvPython)) {
  Write-Host "[native] Creating venv at $venv"
  Push-Location $server
  python -m venv .venv.windows
  Pop-Location
}

if (-not $NoInstall) {
  Write-Host "[native] Installing backend deps (this may take a minute)"
  & $venvPip install --upgrade pip
  & $venvPip install fastapi "uvicorn[standard]" pydantic instructor sqlalchemy asyncpg alembic python-dotenv
}

# Backend command (requires DB; fail fast if missing)
$backendCmd = "`$env:HOST='127.0.0.1'; `$env:PORT='$BackendPort'; & `"$venvPython`" -m uvicorn server.api.main:app --host 127.0.0.1 --port $BackendPort --reload"

# Frontend command
$frontendCmd = "`$env:VITE_API_URL='http://127.0.0.1:$BackendPort'; npm run dev -- --host $FrontendHost --port $FrontendPort"

Write-Host "[native] Launching windows (backend=$BackendPort, frontend=$FrontendPort)"
Open-Window -Title "Impetus Backend (native $BackendPort)" -Command $backendCmd -WorkDir $server
Start-Sleep -Milliseconds 300
Open-Window -Title "Impetus Frontend (native $FrontendPort)" -Command $frontendCmd -WorkDir $client

Write-Host ""
Write-Host "✅ Native dev started."
Write-Host "- Backend:  http://127.0.0.1:$BackendPort (docs at /docs)"
Write-Host "- Frontend: http://localhost:$FrontendPort"
Write-Host ""
Write-Host "Tip: set OPENAI_API_KEY in your user env or client .env to enable interventions."
