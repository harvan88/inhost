@echo off
REM Script de pruebas automatizado Sprint 2
echo ================================
echo SPRINT 2 - Pruebas Automatizadas
echo ================================
echo.

set API=http://localhost:3000

echo [1/5] Health Check...
curl -s %API%/health > nul && echo OK - API responde || (echo ERROR - API no responde && exit /b 1)

echo [2/5] CORS Headers...
curl -s -i %API%/health | findstr "Access-Control-Expose-Headers" > nul && echo OK - CORS configurado || echo ERROR - CORS falta

echo [3/5] Validacion HTTP 422...
for /f %%i in ('curl -s -o nul -w "%%{http_code}" -X POST %API%/messages -H "Content-Type: application/json" -d "{\"type\":\"invalid\"}"') do set CODE=%%i
if "%CODE%"=="422" (echo OK - HTTP 422) else (echo ERROR - HTTP %CODE%)

echo [4/5] Rate Limit FREE ^(13 requests con 'anonymous'^)...
set SUCCESS=0
set BLOCKED=0
for /L %%i in (1,1,13) do (
    for /f %%s in ('curl -s -o nul -w "%%{http_code}" -X POST %API%/messages -H "Content-Type: application/json" -H "X-User-Id: anonymous" -d "{\"type\":\"incoming\",\"channel\":\"whatsapp\",\"content\":{\"text\":\"%%i\"},\"metadata\":{\"from\":\"+1\",\"to\":\"+2\",\"timestamp\":\"2025-11-16T10:00:00Z\"}}"') do (
        if "%%s"=="200" set /a SUCCESS+=1
        if "%%s"=="429" set /a BLOCKED+=1
    )
)
if %SUCCESS%==12 if %BLOCKED%==1 (echo OK - 12 OK, 1 bloqueado) else (echo ERROR - %SUCCESS% OK, %BLOCKED% bloqueado)

echo [5/5] Rate Limit Headers...
curl -s -i -X POST %API%/messages -H "Content-Type: application/json" -H "X-User-Id: test" -d "{\"type\":\"incoming\",\"channel\":\"whatsapp\",\"content\":{\"text\":\"t\"},\"metadata\":{\"from\":\"+1\",\"to\":\"+2\",\"timestamp\":\"2025-11-16T10:00:00Z\"}}" | findstr "X-RateLimit-Limit" > nul && echo OK - Headers presentes || echo ERROR - Headers falta

echo.
echo ================================
echo  Pruebas completadas
echo ================================
