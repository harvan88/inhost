# INHOST Backend - Quick Start

## ⚠️ IMPORTANTE: Configuración JWT_SECRET (REQUERIDO)

Después de las mejoras de seguridad, el backend ahora **requiere** un `JWT_SECRET` válido para iniciar.

### Opción 1: Usar el .env ya creado (Desarrollo)

Ya hemos creado un archivo `.env` en `apps/api-gateway/.env` con valores de desarrollo. Solo necesitas **reiniciar el servidor**:

```bash
# Detener el servidor actual (Ctrl+C)
# Luego reiniciar:
cd inhost-backend
bun run dev
```

### Opción 2: Generar tu propio JWT_SECRET (Recomendado para producción)

```bash
# 1. Generar un secret seguro
openssl rand -base64 64

# 2. Editar .env y reemplazar JWT_SECRET con el valor generado
# 3. Reiniciar el servidor
bun run dev
```

## Verificación

Si el servidor inicia correctamente, deberías ver:

```
✅ Services initialized successfully
🏥 Adapters health check
📊 MessageCore stats
```

## Solución de Problemas

### Error: "JWT_SECRET environment variable is required"

**Causa**: El archivo `.env` no existe o JWT_SECRET no está configurado.

**Solución**:
```bash
# Copiar el ejemplo en la ubicación correcta
cd apps/api-gateway
cp .env.example .env

# Editar .env y configurar JWT_SECRET
# Luego reiniciar el servidor
cd ../..
bun run dev
```

### Error: "JWT_SECRET must be at least 32 characters long"

**Causa**: El JWT_SECRET es demasiado corto.

**Solución**: El `.env` que creamos ya tiene un secret de 64+ caracteres. Si modificaste el valor, asegúrate de que tenga al menos 32 caracteres.

### Error: "Database connection failed"

**Causa**: PostgreSQL no está corriendo.

**Solución**:
```bash
# Iniciar PostgreSQL con Docker
bun run dev:db

# Verificar que esté corriendo
docker ps
```

### Error: Login falla con 500 "object object"

**Causa**: JWT_SECRET no está configurado o el servidor necesita reiniciarse.

**Solución**:
1. Verificar que `.env` existe y tiene `JWT_SECRET`
2. **Reiniciar el servidor** completamente:
   ```bash
   # Ctrl+C para detener
   bun run dev
   ```

## Configuración Completa (Primera Vez)

```bash
# 1. Instalar dependencias
bun install

# 2. Iniciar PostgreSQL
bun run dev:db

# 3. Ejecutar migraciones
bun run db:push

# 4. Verificar que .env existe en la ubicación correcta
cat apps/api-gateway/.env

# 5. Iniciar el servidor
bun run dev
```

## Variables de Entorno Importantes

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `JWT_SECRET` | **REQUERIDO** - Secret para firmar JWT tokens | (ninguno - debe configurarse) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/inhost` |
| `PORT` | Puerto del servidor | `3000` |
| `CORS_ORIGIN` | Frontend URL permitido | `http://localhost:5173` |
| `RATE_LIMIT_BACKEND` | 'memory' o 'redis' | `memory` |

## Seguridad

El backend ahora incluye las siguientes medidas de seguridad:

1. ✅ **JWT_SECRET obligatorio** - Sin fallback inseguro
2. ✅ **Password sanitization** - Las contraseñas nunca aparecen en logs
3. ✅ **Rate limiting** - 5 intentos de login por 15 minutos (por IP)
4. ✅ **JWT validation** - Mínimo 32 caracteres, warnings para secrets de desarrollo

## Próximos Pasos

Una vez que el servidor esté corriendo:

1. El frontend se conectará automáticamente (si está en `http://localhost:5173`)
2. Puedes crear una cuenta en `/signup`
3. El login debería funcionar correctamente

## Logs Útiles

Si ves este error en los logs del backend:
```
🔐 [AUTH] /admin/auth/login called { email: "admin@test.com" }
Login error: { message: "JWT_SECRET environment variable is required..." }
```

**Significa que necesitas reiniciar el servidor** después de configurar el `.env`.

---

**Nota**: El archivo `.env` que acabamos de crear ya tiene todos los valores necesarios para desarrollo local. Solo necesitas **reiniciar el servidor** para que tome efecto.
