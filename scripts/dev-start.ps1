# Requires: Windows 10+ with WSL installed.
# Launches the WSL dev-start.sh from Windows PowerShell.

param(
    [string]$Distribution = ""
)

$repoRootWin = (Resolve-Path "$PSScriptRoot\..").Path

function Invoke-WslCommand {
    param(
        [string]$Command
    )

    if ($Distribution) {
        wsl.exe -d $Distribution bash -lc $Command
    }
    else {
        wsl.exe bash -lc $Command
    }
}

function Convert-ToWslPath {
    param([string]$WindowsPath)
    $result = Invoke-WslCommand "wslpath -a `"$WindowsPath`""
    return $result.Trim()
}

$repoRootWsl = Convert-ToWslPath $repoRootWin
$scriptWsl = "$repoRootWsl/scripts/dev-start.sh"

if (-not (Test-Path "$PSScriptRoot\dev-start.sh")) {
    Write-Error "WSL launcher not found at $scriptWsl"
    exit 1
}

Write-Host "[dev-start] Launching WSL stack from $repoRootWsl"
Invoke-WslCommand "cd '$repoRootWsl' && chmod +x ./scripts/dev-start.sh && ./scripts/dev-start.sh"
