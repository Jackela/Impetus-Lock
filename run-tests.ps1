cd D:\Code\Impetus-Lock\client
Write-Host "Running unit tests..." -ForegroundColor Cyan
npm run test
Write-Host "`nRunning type check..." -ForegroundColor Cyan
npm run type-check
Write-Host "`nAll checks complete!" -ForegroundColor Green
