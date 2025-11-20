@echo off
REM Safe Git Push - Push changes to remote with validation
echo ========================================
echo GIT PUSH SEGURO
echo ========================================
echo.

REM 1. Mostrar rama actual
echo [1/5] Verificando rama actual...
git branch --show-current
echo.

REM 2. Verificar estado
echo [2/5] Verificando estado del repositorio...
git status
echo.

REM 3. Hacer pull primero para asegurar que estamos actualizados
echo [3/5] Sincronizando con remote (pull)...
git pull origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
if errorlevel 1 (
    echo.
    echo ERROR: No se pudo hacer pull. Revisa los conflictos.
    pause
    exit /b 1
)
echo.

REM 4. Push a la rama correcta
echo [4/5] Haciendo push a remote...
git push -u origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
if errorlevel 1 (
    echo.
    echo ERROR: Push falló. Reintentando en 2 segundos...
    timeout /t 2 /nobreak > nul
    git push -u origin claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
    if errorlevel 1 (
        echo ERROR: Push falló después de reintentar.
        pause
        exit /b 1
    )
)
echo.

REM 5. Verificar resultado
echo [5/5] Verificando resultado...
git log --oneline -3
echo.

echo ========================================
echo PUSH EXITOSO
echo ========================================
echo.
echo Rama: claude/frontend-audit-integration-01Ybr2mAfT7KboLrZ7pSSpUe
echo Commits recientes mostrados arriba.
echo.
pause
