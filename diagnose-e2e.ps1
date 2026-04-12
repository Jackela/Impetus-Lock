cd D:\Code\Impetus-Lock\client

Write-Host "Starting dev server in background..." -ForegroundColor Yellow
$devServer = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 5

Write-Host "Checking if server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 3
    Write-Host "Server responded with status: $($response.StatusCode)" -ForegroundColor Green
    
    # Check if content contains expected elements
    $content = $response.Content
    if ($content -match "Impetus Lock") {
        Write-Host "✓ Title found in HTML" -ForegroundColor Green
    } else {
        Write-Host "✗ Title NOT found in HTML" -ForegroundColor Red
    }
    
    if ($content -match "mode-selector") {
        Write-Host "✓ Mode selector found in HTML" -ForegroundColor Green
    } else {
        Write-Host "✗ Mode selector NOT found in HTML" -ForegroundColor Red
    }
    
    Write-Host "`nHTML Preview (first 500 chars):" -ForegroundColor Cyan
    Write-Host $content.Substring(0, [Math]::Min(500, $content.Length))
    
} catch {
    Write-Host "Failed to connect to server: $_" -ForegroundColor Red
}

Write-Host "`nStopping dev server..." -ForegroundColor Yellow
Stop-Process -Id $devServer.Id -Force -ErrorAction SilentlyContinue
