Param(
    [string]$Target = "$env:USERPROFILE/impetus-lock-act",
    [string]$Command = ""
)

$env:ACT_WORKSPACE = $Target
$bashCommand = "./scripts/act-sync.sh"
if ($Command -ne "") {
    $bashCommand += " " + $Command
}

wsl bash -lc "cd `"$PWD`" && $bashCommand"
