# 🚀 Guía de Pruebas Sprint 2 - Protección y Seguridad

## ✅ Estado Actual del Sistema

- ✅ **Servidor:** Corriendo en `http://localhost:3000`
- ✅ **Endpoints:** Todos funcionando (verificado con curl)
- ✅ **Rate Limiting:** Activo (12 req/min para plan free)
- ✅ **Validación:** Activa (rechaza mensajes inválidos)
- ✅ **Headers:** X-RateLimit-* presentes en todas las respuestas
- ✅ **Circuit Breaker:** Implementado

---

## ⚠️ IMPORTANTE: Problema de Caché del Navegador

### 🔴 Si ves "Failed to fetch" en el navegador:

**Causa:** Tu navegador tiene **código JavaScript antiguo en caché** que envía el formato incorrecto de mensajes.

**Solución (3 opciones):**

#### ✨ Opción 1: Banner Automático (Más Fácil)
1. Abre `testing/index.html` en tu navegador
2. Selecciona "Sprint 2 Protection" del menú
3. Si hay problemas de conectividad, verás un **banner rojo pulsante** en la parte superior
4. **HAZ CLIC en el banner** o presiona `Ctrl+Shift+R`

#### 🔄 Opción 2: Hard Refresh Manual
- **Windows/Linux:** `Ctrl + Shift + R`
- **Mac:** `Cmd + Shift + R`

#### 🕵️ Opción 3: Modo Incógnito
1. Abre ventana incógnito: `Ctrl + Shift + N` (Chrome) o `Ctrl + Shift + P` (Firefox)
2. Navega a tu testing dashboard
3. Las ventanas incógnito nunca tienen caché

---

## 📋 Cómo Usar el Dashboard de Pruebas

### 1️⃣ Abrir el Dashboard

```bash
# Opción A: Con Live Server VS Code (Recomendado)
# - Clic derecho en testing/index.html
# - Seleccionar "Open with Live Server"

# Opción B: Directamente
# - Doble clic en testing/index.html
```

### 2️⃣ Seleccionar Sprint 2 Test

1. En el menú lateral izquierdo, busca **"Sprint 2"** (categoría)
2. Haz clic en **"Sprint 2 Protection"**
3. El test se cargará en el panel principal

### 3️⃣ Ejecutar Pruebas

#### 🚀 Test Automatizado Completo (Recomendado):

1. Haz clic en **"⚡ Ejecutar Test Completo"** en el panel tutorial
2. El sistema ejecutará automáticamente:
   - ✅ Health check del servidor
   - ✅ 15 requests de rate limiting (12 pasan, 3 bloquean)
   - ✅ Suite de validación (4 tests)
   - ✅ Verificación de headers
3. Espera ~10 segundos
4. Haz clic en **"📋 Ver Resumen"** para ver resultados

#### 🎯 Tests Manuales Individuales:

##### Panel: 🚦 Rate Limiting
- **Enviar 1 Request:** Envía una sola request para ver los headers
- **Enviar 15 Requests:** Test burst - 12 deberían pasar, 3 bloquearse
- **Reset Contador:** Limpia las estadísticas locales

**Resultado Esperado:**
```
✅ Requests 1-12: HTTP 200 (success)
❌ Requests 13-15: HTTP 429 (rate limit exceeded)
📊 Headers presentes:
   - X-RateLimit-Limit: 12
   - X-RateLimit-Remaining: disminuye con cada request
   - X-RateLimit-Reset: timestamp de reset
```

##### Panel: ✅ Validación
- **Mensaje Válido:** Debería retornar 200 OK
- **Sin Type:** Debería fallar con 400 (campo requerido)
- **Texto Largo:** Debería fallar con 400 (máximo 16KB)
- **Channel Inválido:** Debería fallar con 400 (enum validation)

**Resultado Esperado:**
```
✅ Mensaje válido: HTTP 200
❌ Sin type: HTTP 400 (validation error)
❌ Texto largo: HTTP 400 (content too large)
❌ Channel inválido: HTTP 400 (invalid enum value)
```

##### Panel: ⚡ Stress Test
- **▶ Iniciar Test:** Envía 5 requests/segundo continuamente
- **⏸️ Detener Test:** Para el test de estrés

**Uso:** Para verificar que el sistema mantiene estabilidad bajo carga prolongada.

**Resultado Esperado:**
```
📊 Después de 60 segundos (~300 requests):
   - ~60% éxitos (dentro del rate limit)
   - ~40% bloqueados (por rate limiting)
   - 0 errores 5xx (server errors)
```

##### Panel: 🔌 API & Circuit Breaker
- **ℹ️ Info API:** Obtiene health status del servidor
- **📋 Ver Mensajes:** Lista los últimos 3 mensajes creados
- **🔌 Simular 5 Fallos:** Abre el circuit breaker (simulación)
- **🔄 Reset Circuit:** Cierra el circuit breaker

---

## 📊 Interpretando Resultados

### ✅ Todo Funciona Correctamente Si:

#### Rate Limiting:
- ✅ Headers `X-RateLimit-*` aparecen en **todas** las responses
- ✅ Requests 1-12 retornan **200 OK**
- ✅ Requests 13+ retornan **429 Too Many Requests**
- ✅ El header `X-RateLimit-Remaining` **disminuye** con cada request
- ✅ Después de 1 minuto, el contador se resetea

#### Validación:
- ✅ Mensajes **válidos** retornan **200 OK**
- ✅ Mensajes **sin type** retornan **400 Bad Request**
- ✅ Mensajes con **texto >16KB** retornan **400 Bad Request**
- ✅ Mensajes con **channel inválido** retornan **400 Bad Request**
- ✅ Los errores incluyen mensajes descriptivos

#### Stress Test:
- ✅ El servidor **no crashea** bajo carga sostenida
- ✅ Mantiene ~60% success rate (respetando rate limit)
- ✅ ~40% bloqueados por rate limiting (comportamiento esperado)
- ✅ **0 errores 5xx** (server errors)

---

## 🐛 Troubleshooting

### ❌ Problema: "Failed to fetch" persiste después de hard refresh

**Diagnóstico:**
```bash
# 1. Verificar cuántos procesos de bun están corriendo
tasklist | findstr bun.exe

# Si ves 2 o más líneas, tienes múltiples procesos
```

**Solución:**
```bash
# 1. Matar TODOS los procesos de bun
taskkill /F /IM bun.exe

# 2. Reiniciar el servidor (solo UNO)
bun --cwd apps/api-gateway dev

# 3. Hard refresh en el navegador
# Presiona: Ctrl + Shift + R
```

---

### ❌ Problema: Rate limiting NO bloquea las requests 13-15

**Causa:** Estás usando diferentes `X-User-Id` en cada request, por lo que cada una cuenta como un usuario diferente.

**Solución:**
- Usa el botón **"Enviar 15 Requests"** (automáticamente usa el mismo user-id)
- Si haces requests manuales, asegúrate de usar el **mismo valor** en el header `X-User-Id`

**Ejemplo correcto:**
```bash
# TODAS estas requests deberían usar el mismo user-id
curl -H "X-User-Id: test-user" ...  # Request 1
curl -H "X-User-Id: test-user" ...  # Request 2
curl -H "X-User-Id: test-user" ...  # Request 3
# ... hasta request 15
```

---

### ❌ Problema: TODOS los mensajes son rechazados (400)

**Causa:** Formato de mensaje incorrecto.

**Formato INCORRECTO (antiguo):**
```json
{
  "id": "test-123",
  "channel": "web",
  "direction": "incoming",
  "content": { "text": "test" }
}
```

**Formato CORRECTO (actual):**
```json
{
  "type": "incoming",
  "channel": "whatsapp",
  "content": {
    "text": "Tu mensaje aquí"
  },
  "metadata": {
    "from": "+1234567890",
    "to": "+0987654321",
    "timestamp": "2025-11-16T10:00:00Z"
  }
}
```

**Solución:** Usa el dashboard de testing que ya envía el formato correcto.

---

### ❌ Problema: Los headers X-RateLimit-* no aparecen

**Causa:** El servidor no está ejecutando el middleware de rate limiting.

**Solución:**
```bash
# 1. Verifica los logs del servidor
# Deberías ver: "Rate limiter cleanup started"

# 2. Reinicia el servidor
taskkill /F /IM bun.exe
bun --cwd apps/api-gateway dev

# 3. Envía una request y verifica headers
curl -i -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -d '{"type":"incoming","channel":"whatsapp","content":{"text":"test"},"metadata":{"from":"+1","to":"+2","timestamp":"2025-11-16T10:00:00Z"}}'

# Busca en la respuesta:
# X-RateLimit-Limit: 12
# X-RateLimit-Remaining: 11
# X-RateLimit-Reset: 1731753600
```

---

## 🧪 Test Manual desde Terminal

Si prefieres probar desde la terminal en lugar del dashboard:

### Health Check
```bash
curl http://localhost:3000/health
# Respuesta esperada: {"success":true,"data":{"status":"healthy",...}}
```

### Crear Mensaje (1 request)
```bash
curl -i -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d '{
    "type": "incoming",
    "channel": "whatsapp",
    "content": { "text": "Test desde curl" },
    "metadata": {
      "from": "+1234567890",
      "to": "+0987654321",
      "timestamp": "2025-11-16T10:00:00Z"
    }
  }'

# Verifica los headers en la respuesta:
# X-RateLimit-Limit: 12
# X-RateLimit-Remaining: 11
```

### Test Rate Limiting (15 requests)
```bash
# Script para enviar 15 requests rápidas
for i in {1..15}; do
  echo "Request $i:"
  curl -s -w "Status: %{http_code}\n" -X POST http://localhost:3000/messages \
    -H "Content-Type: application/json" \
    -H "X-User-Id: test-burst" \
    -d "{\"type\":\"incoming\",\"channel\":\"whatsapp\",\"content\":{\"text\":\"Burst $i\"},\"metadata\":{\"from\":\"+1\",\"to\":\"+2\",\"timestamp\":\"$(date -Iseconds)\"}}" \
    | grep -E "(Status|error)"
  sleep 0.1
done

# Esperado:
# Requests 1-12: Status: 200
# Requests 13-15: Status: 429
```

### Test Validación (mensaje inválido)
```bash
# Sin campo "type" (debería fallar)
curl -i -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -d '{
    "channel": "whatsapp",
    "content": { "text": "Sin type" },
    "metadata": { "from": "+1", "to": "+2", "timestamp": "2025-11-16T10:00:00Z" }
  }'

# Esperado: HTTP 400 Bad Request
```

---

## 🎯 Checklist de Sprint 2 Completo

Usa esta checklist para verificar que todo está implementado correctamente:

### Infraestructura
- [ ] Servidor corriendo sin errores en puerto 3000
- [ ] Solo UN proceso de bun.exe corriendo
- [ ] Logs del servidor muestran "Services initialized successfully"

### Endpoints
- [ ] `GET /health` retorna 200 OK
- [ ] `POST /messages` acepta mensajes válidos (200 OK)
- [ ] `GET /messages` retorna lista de mensajes

### Rate Limiting
- [ ] Headers X-RateLimit-* presentes en TODAS las responses
- [ ] Request 1-12 (mismo user) retornan 200 OK
- [ ] Request 13+ (mismo user) retornan 429 Too Many Requests
- [ ] El contador se resetea después de 1 minuto
- [ ] Diferentes usuarios tienen contadores independientes

### Validación
- [ ] Mensajes válidos son aceptados (200 OK)
- [ ] Mensajes sin "type" son rechazados (400)
- [ ] Mensajes sin "channel" son rechazados (400)
- [ ] Mensajes sin "content" son rechazados (400)
- [ ] Mensajes sin "metadata" son rechazados (400)
- [ ] Texto >16KB es rechazado (400)
- [ ] Channels inválidos son rechazados (400)
- [ ] Tipos inválidos son rechazados (400)

### Stress Test
- [ ] Sistema mantiene estabilidad bajo 5 RPS sostenidos
- [ ] No hay memory leaks después de 300+ requests
- [ ] No hay errores 5xx (server errors)
- [ ] Rate limiting funciona correctamente bajo carga

### Circuit Breaker (Implementado pero no activo)
- [ ] Estado inicial: CLOSED
- [ ] Cambia a OPEN después de threshold de fallos
- [ ] Cambia a HALF_OPEN después del timeout
- [ ] Retorna a CLOSED después de request exitoso en HALF_OPEN

---

## 📞 Soporte y Debug

### Ver Logs del Servidor
```bash
# Los logs se muestran en la terminal donde corriste:
# bun --cwd apps/api-gateway dev

# Busca estos mensajes importantes:
# ✅ "Services initialized successfully"
# ✅ "Rate limiter cleanup started"
# ✅ "API Gateway is running"
```

### Ver Logs del Navegador
```bash
# 1. Abre el navegador
# 2. Presiona F12 (Developer Tools)
# 3. Pestaña "Console"
# 4. Busca errores en rojo
```

### Copiar Logs del Dashboard
1. Haz clic en el botón **📋** en la esquina superior derecha de cualquier panel de logs
2. Los logs se copiarán al portapapeles
3. Pégalos en un archivo de texto para análisis

### Test de Conectividad Básico
```bash
# Verifica que el servidor responde
curl http://localhost:3000/health

# Debería retornar:
# {"success":true,"data":{"status":"healthy",...}}

# Si falla con "Connection refused":
# - El servidor no está corriendo
# - Está corriendo en otro puerto

# Si falla con "Could not resolve host":
# - Problema de DNS/red
```

---

## 🎉 ¡Sprint 2 Completado!

Si todos los tests pasan, has completado exitosamente el Sprint 2: **Protección y Seguridad**.

### Funcionalidades Implementadas:
✅ Rate Limiting con headers estándar
✅ Validación de esquemas de mensajes
✅ Timeout Protection (implementado, no activo por debug)
✅ Circuit Breaker Pattern (implementado)
✅ Suite de testing completa
✅ Dashboard interactivo de pruebas

### Próximos Pasos Sugeridos:
1. **Re-habilitar timeout protection** una vez que todas las pruebas estén confirmadas
2. **Implementar métricas y monitoring** para producción
3. **Añadir logging estructurado** para mejor observabilidad
4. **Configurar alertas** para cuando el circuit breaker se abra
5. **Documentar thresholds y límites** para diferentes planes de usuarios

---

**¿Dudas o problemas?** Revisa los logs del servidor y del navegador, y verifica que estás usando el formato correcto de mensajes.
