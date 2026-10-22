@echo off
setlocal
cd /d "%~dp0"
if not exist "supabase.txt" (
  echo Chua co admin\supabase.txt.
  echo Hay copy admin\supabase.example.txt thanh admin\supabase.txt va dien key.
  echo.
  pause
  exit /b 1
)
node server.mjs
echo.
echo Admin da dung.
pause
