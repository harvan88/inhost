@echo off
REM ================================================
REM SPRINT 2 - Pruebas Automatizadas
REM ================================================

echo.
echo ================================================
echo  SPRINT 2 - PRUEBAS AUTOMATIZADAS
echo ================================================
echo.

REM Test 1: Rate Limiting
echo [1/3] RATE LIMITING - Enviando 15 requests rapidos...
echo.

set SUCCESS=0
set BLOCKED=0
set ERRORS=0

for /L %%i in (1,1,15) do (
    curl -s -o nul -w "%%{http_code}" -X POST http://localhost:3000/messages -H "Content-Type: application/json" -H "X-User-Id: test-user" -d "{\"type\":\"incoming\",\"channel\":\"whatsapp\",\"content\":{\"text\":\"Test %%i\"},\"metadata\":{\"from\":\"+123\",\"to\":\"+456\",\"timestamp\":\"2025-11-16T10:00:00Z\"}}" > temp_status.txt
    set /p STATUS=<temp_status.txt

    if "!STATUS!"=="200" (
        set /a SUCCESS+=1
        echo [%%i] HTTP 200 OK - Exito
    ) else if "!STATUS!"=="429" (
        set /a BLOCKED+=1
        echo [%%i] HTTP 429 - Bloqueado por rate limit
    ) else (
        set /a ERRORS+=1
        echo [%%i] HTTP !STATUS! - Error
    )
)

del temp_status.txt

echo.
echo RESULTADOS RATE LIMITING:
echo   Exitos: %SUCCESS%
echo   Bloqueados (429): %BLOCKED%
echo   Errores: %ERRORS%
echo.

REM Test 2: Validación
echo [2/3] VALIDACION - Probando mensaje invalido...
echo.

curl -X POST http://localhost:3000/messages -H "Content-Type: application/json" -d "{\"content\":\"invalid\"}" -w "\nHTTP: %%{http_code}\n"

echo.

REM Test 3: Timeout
echo [3/3] TIMEOUT - Verificando headers de timeout...
echo.

curl -I http://localhost:3000/health 2>nul | findstr "timeout"

echo.
echo ================================================
echo  PRUEBAS COMPLETADAS
echo ================================================
