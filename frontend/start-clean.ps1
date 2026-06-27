# Clean Vite Startup Script
# Run this if you encounter "Cannot read properties of null (reading 'useState')" errors

Write-Host "🧹 Cleaning Vite cache..." -ForegroundColor Cyan

# Stop any running dev servers
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

# Remove all Vite cache directories
Remove-Item -Recurse -Force .vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules\.vite -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue

Write-Host "✅ Cache cleared" -ForegroundColor Green
Write-Host "🚀 Starting dev server..." -ForegroundColor Cyan

# Start the dev server
npm run dev
