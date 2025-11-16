@echo off
REM ================================================
REM INHOST API Gateway - Inicio Seguro
REM ================================================
REM Este script previene multiples instancias del servidor
REM ================================================

echo.
echo ================================================
echo  INHOST API Gateway - Inicio Seguro
echo ================================================
echo.

REM Verificar si ya hay procesos de bun corriendo
tasklist /FI "IMAGENAME eq bun.exe" 2>NUL | find /I /N "bun.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [ADVERTENCIA] Hay procesos de bun corriendo
    echo.

    REM Mostrar procesos actuales
    echo Procesos actuales:
    tasklist /FI "IMAGENAME eq bun.exe"
    echo.

    REM Preguntar si detenerlos
    set /p STOP="Deseas detener TODOS los procesos y reiniciar? (S/N): "
    if /i "%STOP%"=="S" (
        echo.
        echo Deteniendo todos los procesos de bun...
        taskkill /F /IM bun.exe >NUL 2>&1

        REM Esperar 2 segundos
        timeout /t 2 /nobreak >NUL

        echo [OK] Procesos detenidos
        echo.
    ) else (
        echo.
        echo [CANCELADO] No se inicio el servidor
        echo [INFO] Para iniciar manualmente:
        echo   bun --cwd apps/api-gateway dev
        echo.
        pause
        exit /b 1
    )
)

REM Verificar que estamos en el directorio correcto
if not exist "apps\api-gateway" (
    echo [ERROR] No se encuentra el directorio apps/api-gateway
    echo [INFO] Asegurate de ejecutar este script desde el directorio raiz del proyecto
    echo.
    pause
    exit /b 1
)

echo Iniciando servidor...
echo.
echo ================================================
echo  Servidor corriendo en http://localhost:3000
echo  Presiona Ctrl+C para detener
echo ================================================
echo.

REM Iniciar el servidor
bun --cwd apps/api-gateway dev

REM Si llegamos aqui, el servidor se detuvo
echo.
echo [INFO] Servidor detenido
pause
