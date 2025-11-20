@echo off
REM Fix Last Message Fields in Database
echo ========================================
echo Fixing lastMessage fields...
echo ========================================
echo.

REM Execute the SQL fix
docker exec -i inhost-postgres psql -U inhost_user -d inhost < scripts/fix-last-message.sql

echo.
echo ========================================
echo Fix completed!
echo ========================================
echo.
echo Now test the sync endpoint:
echo   1. Make sure the server is running: start-server.bat
echo   2. Refresh the frontend in browser
echo   3. Conversations should now show message previews
echo.
pause
