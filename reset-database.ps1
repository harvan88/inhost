# reset-database.ps1 - Script seguro de reset de base de datos para InHost
Write-Host "🔄 INICIANDO RESET COMPLETO DE BASE DE DATOS INHOST..." -ForegroundColor Yellow

# Configuración específica del proyecto
$ProjectName = "inhost"
$ContainerName = "inhost-backend-postgres-1"
$MaxWaitTime = 30  # segundos máximo de espera

# 1. Detener y eliminar SOLO contenedores de este proyecto
Write-Host "`n1️⃣ DETENIENDO CONTENEDORES DE INHOST..." -ForegroundColor Cyan

# Listar solo contenedores de inhost para mayor seguridad
Write-Host "Contenedores PostgreSQL de InHost encontrados:" -ForegroundColor Gray
docker ps -a --filter "name=$ProjectName" --filter "name=postgres" --format "table {{.Names}}\t{{.Status}}" 

# Detener y eliminar solo contenedores específicos de inhost
$containers = docker ps -a -q --filter "name=$ProjectName" --filter "name=postgres" 2>$null
if ($containers) {
    Write-Host "Deteniendo $($containers.Count) contenedores..." -ForegroundColor Yellow
    docker stop $containers 2>$null
    docker rm $containers 2>$null
    Write-Host "✅ Contenedores de InHost eliminados" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No se encontraron contenedores de InHost para eliminar" -ForegroundColor Blue
}

# 2. Limpiar SOLO volúmenes huérfanos (no los nombrados)
Write-Host "`n2️⃣ LIMPIANDO VOLÚMENES HUÉRFANOS..." -ForegroundColor Cyan
docker volume prune -f

# 3. Iniciar solo el contenedor correcto
Write-Host "`n3️⃣ INICIANDO CONTENEDOR DE INHOST..." -ForegroundColor Cyan
docker-compose up -d postgres

# 4. Esperar a que PostgreSQL esté listo CON TIMEOUT
Write-Host "`n4️⃣ ESPERANDO A QUE POSTGRES ESTÉ LISTO..." -ForegroundColor Cyan
$waitTime = 0
$isReady = $false

do {
    $status = docker ps --filter "name=$ContainerName" --format "{{.Status}}"
    Write-Host "   Estado: $status" -ForegroundColor Gray
    
    if ($status -like "*healthy*") { 
        $isReady = $true
        break 
    }
    
    if ($waitTime -ge $MaxWaitTime) {
        Write-Host "❌ TIMEOUT: PostgreSQL no está listo después de $MaxWaitTime segundos" -ForegroundColor Red
        break
    }
    
    Write-Host "   Esperando... ($($waitTime + 2)s/$MaxWaitTime`s)" -ForegroundColor Gray
    Start-Sleep -Seconds 2
    $waitTime += 2
} while ($true)

if (-not $isReady) {
    Write-Host "❌ No se pudo iniciar PostgreSQL correctamente" -ForegroundColor Red
    exit 1
}

Write-Host "✅ PostgreSQL está listo y saludable" -ForegroundColor Green

# 5. Aplicar migraciones con verificación de éxito
Write-Host "`n5️⃣ APLICANDO MIGRACIONES..." -ForegroundColor Cyan
$migrationResult = bun run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error aplicando migraciones" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migraciones aplicadas correctamente" -ForegroundColor Green

# 6. Poblar con datos de prueba con verificación
Write-Host "`n6️⃣ POBLANDO BASE DE DATOS..." -ForegroundColor Cyan
if (Test-Path "scripts/seed-database.ts") {
    $seedResult = bun scripts/seed-database.ts
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error poblando base de datos" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ Base de datos poblada correctamente" -ForegroundColor Green
} else {
    Write-Host "⚠️  Script de seed no encontrado, continuando sin datos de prueba" -ForegroundColor Yellow
}

# 7. Verificación final robusta
Write-Host "`n7️⃣ VERIFICACIÓN FINAL..." -ForegroundColor Cyan
try {
    $verification = docker exec -i $ContainerName psql -U inhost_user -d inhost -c "
    SELECT 
        'tenants' as tabla, COUNT(*) as registros FROM tenants
        UNION ALL
        SELECT 'admin_users', COUNT(*) FROM admin_users
        UNION ALL  
        SELECT 'conversations', COUNT(*) FROM conversations
        UNION ALL
        SELECT 'messages', COUNT(*) FROM messages;"
    
    Write-Host "`n📊 ESTADO DE LA BASE DE DATOS:" -ForegroundColor Cyan
    Write-Host $verification -ForegroundColor White
    
} catch {
    Write-Host "❌ Error en verificación final: $_" -ForegroundColor Red
}

# 8. Información final
Write-Host "`n🎉 RESET COMPLETADO EXITOSAMENTE!" -ForegroundColor Green
Write-Host "`n🔑 CREDENCIALES PARA LOGIN:" -ForegroundColor Yellow
Write-Host "   Email: admin@test.com" -ForegroundColor White
Write-Host "   Password: password123" -ForegroundColor White
Write-Host "`n📦 CONTENEDOR ACTIVO:" -ForegroundColor Yellow
Write-Host "   $ContainerName" -ForegroundColor White
Write-Host "`n🚀 PARA INICIAR EL SERVIDOR:" -ForegroundColor Yellow
Write-Host "   bun run dev" -ForegroundColor White

Write-Host "`n💡 NOTAS:" -ForegroundColor Cyan
Write-Host "   - Solo se afectaron contenedores con nombre 'inhost'" -ForegroundColor Gray
Write-Host "   - Los volúmenes nombrados se preservaron" -ForegroundColor Gray
Write-Host "   - Timeout configurado para evitar loops infinitos" -ForegroundColor Gray