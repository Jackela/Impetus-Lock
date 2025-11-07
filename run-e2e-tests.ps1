# E2E Test Runner for Impetus Lock
# Starts backend, runs E2E tests, then cleans up

$ErrorActionPreference = 'Stop'

Write-Host "Starting Impetus Lock E2E Test Suite..." -ForegroundColor Cyan

# Kill any existing processes on ports 8000 and 5173
Write-Host "Cleaning up ports..." -ForegroundColor Yellow
npx --yes kill-port 8000 5173 2>$null

# Start backend server in background
Write-Host "Starting backend server..." -ForegroundColor Yellow
$backend = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'D:\Code\Impetus-Lock\server'; poetry run uvicorn server.main:app --host 127.0.0.1 --port 8000" -PassThru -WindowStyle Minimized

# Wait for backend to be ready
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts -and -not $backendReady) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host "Backend ready!" -ForegroundColor Green
        }
    } catch {
        $attempt++
        Start-Sleep -Milliseconds 500
    }
}

if (-not $backendReady) {
    Write-Host "Backend failed to start!" -ForegroundColor Red
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

try {
    # Run E2E tests
    Write-Host "Running E2E tests..." -ForegroundColor Yellow
    cd D:\Code\Impetus-Lock\client
    npm run test:e2e
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "All E2E tests passed!" -ForegroundColor Green
    } else {
        Write-Host "E2E tests failed with exit code: $exitCode" -ForegroundColor Red
    }
} finally {
    # Cleanup: Stop backend server
    Write-Host "Stopping backend server..." -ForegroundColor Yellow
    Stop-Process -Id $backend.Id -Force -ErrorAction SilentlyContinue
    
    # Kill any remaining processes on ports
    npx --yes kill-port 8000 5173 2>$null
    
    Write-Host "Cleanup complete." -ForegroundColor Cyan
}

exit $exitCode
