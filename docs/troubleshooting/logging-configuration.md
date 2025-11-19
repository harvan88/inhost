# Configuración de Logging

Guía para configurar los niveles de logging del sistema Inhost.

## 🎯 Niveles de Log

El sistema soporta 4 niveles de logging (de más verboso a menos):

| Nivel | Emoji | Descripción | Uso Recomendado |
|-------|-------|-------------|-----------------|
| `DEBUG` | 🔍 | Logs detallados para debugging | Solo durante desarrollo activo o troubleshooting |
| `INFO` | ℹ️  | Información de operaciones normales | **Default en development** |
| `WARN` | ⚠️  | Advertencias y situaciones inusuales | Production |
| `ERROR` | 🔴 | Errores que requieren atención | Siempre visible |

---

## ⚙️ Configuración

### Variable de Entorno

Configura el nivel mínimo de logging con `LOG_LEVEL`:

```bash
# Mostrar TODO (muy verboso - útil para debug profundo)
LOG_LEVEL=DEBUG bun --cwd apps/api-gateway dev

# Mostrar INFO y superiores (default - recomendado)
LOG_LEVEL=INFO bun --cwd apps/api-gateway dev

# Mostrar solo WARN y ERROR (silencioso)
LOG_LEVEL=WARN bun --cwd apps/api-gateway dev

# Mostrar solo ERROR (production)
LOG_LEVEL=ERROR bun --cwd apps/api-gateway dev
```

### Sin Variable de Entorno

Si no especificas `LOG_LEVEL`, el default es **INFO**:
- ✅ Muestra operaciones importantes
- ❌ Oculta logs DEBUG repetitivos (rate limiting, connections, etc.)

---

## 🔇 Silenciar Logs Repetitivos

### Problema Común
```
🔍 [DEBUG] Rate limit recorded
🔍 [DEBUG] Rate limit check passed
ℹ️ [INFO] WebSocket client connected
ℹ️ [INFO] 👤 Owner marked online
🔍 [DEBUG] Getting simulation status
🔍 [DEBUG] Rate limiter cleanup
... (repite constantemente)
```

### Solución
**No especifiques LOG_LEVEL** o usa `LOG_LEVEL=INFO`:
```bash
# ✅ Default (INFO) - Sin logs DEBUG
bun --cwd apps/api-gateway dev

# ✅ Explícito
LOG_LEVEL=INFO bun --cwd apps/api-gateway dev
```

Los logs DEBUG (🔍) ahora están **silenciados por default** para reducir ruido.

---

## 📊 Qué Se Muestra en Cada Nivel

### DEBUG (Muy Verboso)
```
ℹ️ [INFO] 🦊 Inhost API Gateway is running
ℹ️ [INFO] 📍 Available routes
🔍 [DEBUG] Rate limit recorded
🔍 [DEBUG] Rate limit check passed
🔍 [DEBUG] WebSocket attached to connection
🔍 [DEBUG] 👤 Owner marked online
🔍 [DEBUG] Getting simulation status
🔍 [DEBUG] Rate limiter cleanup
... (TODO)
```

### INFO (Recomendado - Default)
```
ℹ️ [INFO] 🦊 Inhost API Gateway is running
ℹ️ [INFO] 📍 Available routes
ℹ️ [INFO] Creating new message
ℹ️ [INFO] 📥 MessageCore: Receiving message
ℹ️ [INFO] ✅ MessageCore: Message received successfully
... (solo operaciones importantes)
```

### WARN
```
⚠️ [WARN] Rate limit approaching threshold
⚠️ [WARN] Connection timeout
... (solo advertencias)
```

### ERROR
```
🔴 [ERROR] Failed to save message
🔴 [ERROR] Database connection lost
... (solo errores)
```

---

## 🚀 Configuración por Ambiente

### Development (Local)
```bash
# .env.development
LOG_LEVEL=INFO
```

Muestra operaciones importantes sin ser excesivamente verboso.

### Production
```bash
# .env.production
LOG_LEVEL=WARN
```

Solo muestra advertencias y errores para reducir uso de disco/servicio de logs.

### Debugging Activo
```bash
# Temporalmente para troubleshooting
LOG_LEVEL=DEBUG bun --cwd apps/api-gateway dev
```

---

## 📝 Logs Importantes que Siempre Se Muestran

Estos logs son **INFO o superiores** y se muestran por default:

### Inicio del Sistema
```
ℹ️ [INFO] 🦊 Inhost API Gateway is running
ℹ️ [INFO] 🗄️  Database configuration
ℹ️ [INFO] 📍 Available routes
```

### Operaciones de Mensajes
```
ℹ️ [INFO] Creating new message
ℹ️ [INFO] 📥 MessageCore: Receiving message
ℹ️ [INFO] ✅ MessageCore: Message received successfully
ℹ️ [INFO] 📤 MessageCore: Sending message
ℹ️ [INFO] ✅ Message sent successfully
```

### Errores
```
🔴 [ERROR] Request failed
⚠️ [WARN] Rate limit exceeded
```

---

## 🧪 Debugging Específico

Para troubleshooting de componentes específicos, puedes modificar temporalmente el nivel de log en el código:

### Ejemplo: Debug Rate Limiting
```typescript
// apps/api-gateway/src/implementations/v1/MemoryRateLimiter.ts

// Cambiar temporalmente para debug
logger.info('Rate limit check', { userId, remaining }); // en vez de .debug()
```

Luego regresar a `.debug()` cuando termines.

---

## 🎨 Formato de Logs

Todos los logs siguen este formato:

```
<emoji> [<NIVEL>] <mensaje>
```

Ejemplo:
```
🔍 [DEBUG] Rate limit check passed
ℹ️ [INFO] Message received successfully
⚠️ [WARN] Connection timeout approaching
🔴 [ERROR] Failed to connect to database
```

En desarrollo, logs WARN y ERROR también muestran contexto adicional:
```
⚠️ [WARN] Rate limit approaching threshold {
  userId: 'user-123',
  remaining: 2,
  limit: 30
}
```

---

## 🔧 Troubleshooting

### Problema: "No veo ningún log"
**Solución:** Verifica que no estés usando `LOG_LEVEL=ERROR` por error.

### Problema: "Demasiados logs repetitivos"
**Solución:**
1. Asegúrate de NO usar `LOG_LEVEL=DEBUG`
2. Usa el default (INFO) o especifica explícitamente `LOG_LEVEL=INFO`

### Problema: "No veo logs de cierta operación"
**Solución:**
1. Verifica que el código use el nivel correcto (`logger.info()` para operaciones importantes)
2. Temporalmente usa `LOG_LEVEL=DEBUG` para ver TODO

---

## 📦 Scripts Npm Útiles

Agrega estos scripts a `package.json`:

```json
{
  "scripts": {
    "dev": "bun --cwd apps/api-gateway dev",
    "dev:quiet": "LOG_LEVEL=WARN bun --cwd apps/api-gateway dev",
    "dev:debug": "LOG_LEVEL=DEBUG bun --cwd apps/api-gateway dev",
    "dev:silent": "LOG_LEVEL=ERROR bun --cwd apps/api-gateway dev"
  }
}
```

Uso:
```bash
bun run dev         # Normal (INFO)
bun run dev:quiet   # Silencioso (solo WARN/ERROR)
bun run dev:debug   # Verbose (TODO)
bun run dev:silent  # Mínimo (solo ERROR)
```

---

## ✅ Recomendaciones

1. **Development local:** `LOG_LEVEL=INFO` (default)
2. **Debugging activo:** `LOG_LEVEL=DEBUG` (temporalmente)
3. **Production:** `LOG_LEVEL=WARN`
4. **Testing automatizado:** `LOG_LEVEL=ERROR`

**Nunca** uses `LOG_LEVEL=DEBUG` en production - genera demasiados logs y puede impactar performance.
