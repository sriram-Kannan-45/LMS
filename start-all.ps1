# Start all services for feedWeb

Write-Host "🚀 Starting all services..." -ForegroundColor Cyan

# Start Backend
Write-Host "📡 Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

# Start Frontend  
Write-Host "🌐 Starting Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 2

# Start AI Service (optional)
$aiServicePath = "$PSScriptRoot\ai-service"
if (Test-Path $aiServicePath) {
    Write-Host "🤖 Starting AI Service..." -ForegroundColor Magenta
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\ai-service'; python main.py" -WindowStyle Normal
} else {
    Write-Host "⚠️  AI service not found at $aiServicePath (skipping)" -ForegroundColor Gray
}

Write-Host "`n✅ All services launched!" -ForegroundColor Green
Write-Host "   Backend:  http://localhost:3001" -ForegroundColor Gray
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "   AI:       http://localhost:8000 (if started)" -ForegroundColor Gray
