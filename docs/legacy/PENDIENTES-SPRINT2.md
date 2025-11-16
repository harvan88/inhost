# ⚠️ SPRINT 2 - PENDIENTES Y PROBLEMAS ENCONTRADOS

**Fecha:** 2025-11-16
**Sesión:** Continuación - Límite de tokens alcanzado
**Estado:** Pruebas automáticas completadas, pruebas humanas pendientes

---

## 🎯 Objetivo Original

Realizar pruebas humanas completas de Sprint 2 (Protección y Seguridad) para verificar:
- ✅ Rate Limiting (12 requests/min por usuario)
- ✅ Validación de payloads
- ✅ Timeout protection (30s)

---

## 🚨 PROBLEMA PRINCIPAL BLOQUEANTE

### "Failed to fetch" en Dashboard de Testing

**Estado:** ❌ NO RESUELTO

**Causa Raíz Identificada:**
Dashboard abierto desde protocolo `file://` en lugar de servidor HTTP, causando bloqueo de CORS por el navegador.

**Solución Intentada:**
1. ✅ Creado servidor HTTP para testing ([testing/server.js](testing/server.js))
2. ✅ Creado script de inicio ([start-testing.bat](start-testing.bat))
3. ✅ Servidor iniciado en puerto 5500
4. ❌ Usuario NO pudo probar debido a límite de tokens

**Próximos Pasos:**
1. Abrir navegador en `http://localhost:5500` (NO `file://`)
2. Ejecutar test de Sprint 2
3. Verificar que NO aparezca "Failed to fetch"
4. Si persiste el error, investigar configuración CORS del navegador

**Documentación Creada:**
- [SOLUCION-CORS-FILE-PROTOCOL.md](SOLUCION-CORS-FILE-PROTOCOL.md)
- [INICIO-RAPIDO.md](INICIO-RAPIDO.md) actualizado

---

## 🧪 PRUEBAS AUTOMATIZADAS REALIZADAS

### ✅ Test 1: Validación de Payloads

**Método:** `curl` con payload inválido
```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"invalid":"payload"}'
```

**Resultado:** ✅ FUNCIONA
- HTTP 422 Unprocessable Entity
- Response con detalles de errores de validación
- Indica campos faltantes: `type`, `channel`, `content`, `metadata`

**Conclusión:** Validación funciona correctamente

---

### ⚠️ Test 2: Rate Limiting

**Método:** 3 requests rápidos consecutivos con mismo `X-User-Id`
```bash
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: rate-test" \
  -d '{"type":"incoming","channel":"whatsapp","content":{"text":"Test"},...}'
```

**Resultado:** ⚠️ TODOS DEVUELVEN HTTP 200
- Request 1: HTTP 200 OK
- Request 2: HTTP 200 OK
- Request 3: HTTP 200 OK

**Problema Detectado:**
No se observó bloqueo por rate limiting (esperado: HTTP 429 después de 12 requests/min)

**Verificación de Configuración:**
- ✅ Middleware de rate limiting importado en [apps/api-gateway/src/routes/messages.ts:8](apps/api-gateway/src/routes/messages.ts#L8)
- ✅ Middleware aplicado con `.use(rateLimiting({...}))` en línea 27
- ❌ NO se encontraron headers de rate limiting en las respuestas:
  - `X-RateLimit-Limit` - NO presente
  - `X-RateLimit-Remaining` - NO presente
  - `X-RateLimit-Reset` - NO presente

**Posibles Causas:**
1. ❓ Rate limiter no está inicializado correctamente en el servidor
2. ❓ Límite configurado es muy alto (>3 requests)
3. ❓ Headers no están siendo expuestos por CORS
4. ❓ Middleware no está ejecutándose (posible error en cadena de middleware)

**Acción Requerida:**
1. Verificar que `MemoryRateLimiter` esté inicializado en [apps/api-gateway/src/index.ts](apps/api-gateway/src/index.ts)
2. Verificar configuración de límites (debe ser 12 requests/min para free, 100/min para premium)
3. Enviar 15+ requests en <1 minuto para verificar bloqueo
4. Verificar logs del servidor para ver si middleware se ejecuta
5. Agregar `X-RateLimit-*` headers a `Access-Control-Expose-Headers` en CORS

---

### ⚠️ Test 3: Timeout Protection

**Método:** Verificar headers de timeout en respuestas
```bash
curl -I http://localhost:3000/health | grep timeout
curl -I http://localhost:3000/messages | grep timeout
```

**Resultado:** ⚠️ NO SE ENCONTRARON HEADERS
- No hay header `Request-Timeout`
- No hay header `X-Timeout`
- No hay headers relacionados con timeout visibles

**Headers Presentes:**
```
HTTP/1.1 200 OK
Content-Type: application/json
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Expose-Headers: host, user-agent, accept, content-type
Date: Sun, 16 Nov 2025 11:36:18 GMT
```

**Verificación Necesaria:**
1. ❓ ¿El middleware de timeout está aplicado?
2. ❓ ¿Debe haber un header visible o es transparente?
3. ❓ Necesita prueba con request que tarde >30s

**Acción Requerida:**
1. Verificar que timeout middleware esté en [apps/api-gateway/src/routes/messages.ts](apps/api-gateway/src/routes/messages.ts)
2. Crear test que simule request lento (mock delay >30s)
3. Verificar que servidor retorne HTTP 408 Request Timeout

---

## 📊 RESUMEN DE ESTADO

| Componente | Estado Código | Headers Visibles | Prueba Funcional | Acción |
|-----------|---------------|------------------|------------------|---------|
| **Validación** | ✅ Implementado | N/A | ✅ Funciona (HTTP 422) | Ninguna |
| **Rate Limiting** | ✅ Implementado | ❌ No visibles | ⚠️ No probado a fondo | Investigar |
| **Timeout** | ❓ Desconocido | ❌ No visibles | ❌ No probado | Investigar |
| **CORS** | ✅ Configurado | ✅ Visibles | ⚠️ Problema con file:// | Dashboard HTTP |

---

## 🔍 INVESTIGACIONES PENDIENTES PARA PRÓXIMA SESIÓN

### 1. Rate Limiting - Verificación Completa

**Archivos a revisar:**
- [apps/api-gateway/src/index.ts](apps/api-gateway/src/index.ts) - Inicialización de `MemoryRateLimiter`
- [apps/api-gateway/src/middleware/rateLimiting.ts](apps/api-gateway/src/middleware/rateLimiting.ts) - Configuración
- [apps/api-gateway/src/core/RateLimiter.ts](apps/api-gateway/src/core/RateLimiter.ts) - Implementación

**Tests a ejecutar:**
```bash
# Enviar 15 requests en <5 segundos
for i in {1..15}; do
  curl -X POST http://localhost:3000/messages \
    -H "Content-Type: application/json" \
    -H "X-User-Id: test-user" \
    -d '{"type":"incoming","channel":"whatsapp","content":{"text":"Test '$i'"},"metadata":{"from":"+1","to":"+2","timestamp":"2025-11-16T10:00:00Z"}}'
done
```

**Resultado Esperado:**
- Primeros 12: HTTP 200 OK
- Siguientes 3: HTTP 429 Too Many Requests
- Headers en todas las respuestas:
  ```
  X-RateLimit-Limit: 12
  X-RateLimit-Remaining: 11, 10, 9, ..., 0
  X-RateLimit-Reset: <timestamp>
  ```

### 2. Timeout Protection - Verificación

**Archivos a revisar:**
- [apps/api-gateway/src/routes/messages.ts](apps/api-gateway/src/routes/messages.ts) - ¿Está aplicado el middleware?
- [apps/api-gateway/src/middleware/timeout.ts](apps/api-gateway/src/middleware/timeout.ts) - Configuración

**Tests a ejecutar:**
```bash
# Opción 1: Simular request lento (requiere endpoint de simulación)
curl -X POST http://localhost:3000/simulate/slow \
  -H "Content-Type: application/json" \
  -d '{"delay": 35000}' # 35 segundos

# Opción 2: Verificar código directamente
grep -r "timeout" apps/api-gateway/src/middleware/
grep -r "408" apps/api-gateway/src/
```

**Resultado Esperado:**
- Request >30s: HTTP 408 Request Timeout
- Header: `X-Timeout-Seconds: 30` (o similar)

### 3. Dashboard de Testing - Prueba Humana

**Pasos:**
1. Verificar que servidor de testing esté corriendo: `http://localhost:5500`
2. Abrir navegador en `http://localhost:5500` (NO `file://`)
3. Verificar indicador: 🟢 Servidor: Encendido
4. Ejecutar "Test Completo" de Sprint 2
5. Observar:
   - ¿Aparece "Failed to fetch"?
   - ¿Rate limiting funciona? (15 requests → algunos bloqueados)
   - ¿Validación funciona? (payloads inválidos → HTTP 422)
   - ¿Stress test funciona?

**Si "Failed to fetch" persiste:**
- Verificar consola del navegador (F12) para errores CORS específicos
- Verificar que ambos servidores estén corriendo:
  - API Gateway: `http://localhost:3000`
  - Testing Dashboard: `http://localhost:5500`
- Verificar `Access-Control-Allow-Origin` en headers del servidor

---

## 📝 COMANDOS ÚTILES PARA DIAGNÓSTICO

### Verificar Servidores Corriendo
```bash
# API Gateway (debe mostrar 3 procesos)
tasklist | findstr bun.exe

# Testing Dashboard (debe responder HTTP 200)
curl -I http://localhost:5500

# API Health (debe responder HTTP 200)
curl http://localhost:3000/health
```

### Test Rápido de Componentes
```bash
# 1. Validación
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"invalid":"data"}' \
  -w "\nHTTP: %{http_code}\n"
# Esperado: HTTP 422

# 2. Rate Limiting (enviar muchos requests rápidos)
for i in {1..15}; do
  curl -s -o /dev/null -w "Request $i: %{http_code}\n" \
    -X POST http://localhost:3000/messages \
    -H "Content-Type: application/json" \
    -H "X-User-Id: rate-test-user" \
    -d '{"type":"incoming","channel":"whatsapp","content":{"text":"Test"},"metadata":{"from":"+1","to":"+2","timestamp":"2025-11-16T10:00:00Z"}}'
done
# Esperado: Primeros 12 = 200, siguientes = 429

# 3. Headers completos
curl -v -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test" \
  -d '{"type":"incoming","channel":"whatsapp","content":{"text":"Test"},"metadata":{"from":"+1","to":"+2","timestamp":"2025-11-16T10:00:00Z"}}' \
  2>&1 | grep -i "rate\|timeout\|limit"
```

---

## 🎯 PRIORIDADES PARA PRÓXIMA SESIÓN

### 🔥 ALTA PRIORIDAD

1. **Verificar Rate Limiting funciona**
   - Ejecutar test de 15 requests
   - Verificar headers `X-RateLimit-*`
   - Confirmar HTTP 429 después del límite

2. **Verificar Timeout Protection funciona**
   - Revisar si middleware está aplicado
   - Crear test con request lento
   - Confirmar HTTP 408 después de 30s

3. **Prueba humana del dashboard**
   - Abrir `http://localhost:5500`
   - Ejecutar todos los tests de Sprint 2
   - Confirmar que NO hay "Failed to fetch"

### 📊 MEDIA PRIORIDAD

4. **Exposición de headers en CORS**
   - Agregar `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` a `Access-Control-Expose-Headers`
   - Verificar que dashboard pueda leer estos headers

5. **Documentación actualizada**
   - Actualizar [SPRINT-2-TESTING-GUIDE.md](SPRINT-2-TESTING-GUIDE.md) con resultados reales
   - Crear guía de troubleshooting específica

### ⚙️ BAJA PRIORIDAD

6. **Mejoras al dashboard**
   - Mostrar headers de rate limiting en UI
   - Indicador visual de requests bloqueados vs exitosos
   - Contador en tiempo real

---

## 📚 DOCUMENTACIÓN CREADA EN ESTA SESIÓN

1. **[SOLUCION-CORS-FILE-PROTOCOL.md](SOLUCION-CORS-FILE-PROTOCOL.md)**
   - Explica problema de CORS con `file://`
   - Solución con servidor HTTP local
   - Alternativas (Python, Node.js, Live Server)

2. **[INICIO-RAPIDO.md](INICIO-RAPIDO.md)** (actualizado)
   - Agregado paso 3: Iniciar servidor de testing
   - Agregado paso 4: Abrir dashboard en HTTP
   - Tabla de diagnóstico actualizada

3. **[testing/server.js](testing/server.js)**
   - Servidor HTTP simple con Bun
   - Puerto 5500
   - Sirve archivos estáticos del directorio `testing/`

4. **[start-testing.bat](start-testing.bat)**
   - Script para iniciar servidor de testing
   - Simplifica el proceso para usuarios

5. **[PENDIENTES-SPRINT2.md](PENDIENTES-SPRINT2.md)** (este archivo)
   - Resumen completo de hallazgos
   - Investigaciones pendientes
   - Comandos de diagnóstico

---

## ✅ CHECKLIST PARA PRÓXIMA SESIÓN

Antes de comenzar:
- [ ] Leer este documento completo
- [ ] Verificar que servidor API esté corriendo (puerto 3000)
- [ ] Verificar que servidor de testing esté corriendo (puerto 5500)
- [ ] Abrir `http://localhost:5500` en navegador

Pruebas a realizar:
- [ ] Test manual de rate limiting (15 requests rápidos)
- [ ] Verificar headers `X-RateLimit-*` en respuestas
- [ ] Test manual de validación (varios payloads inválidos)
- [ ] Test manual de timeout (si es posible simular)
- [ ] Ejecutar "Test Completo" en dashboard
- [ ] Verificar que NO aparezca "Failed to fetch"

Investigaciones:
- [ ] Revisar inicialización de `MemoryRateLimiter` en [apps/api-gateway/src/index.ts](apps/api-gateway/src/index.ts)
- [ ] Revisar configuración de timeout middleware
- [ ] Verificar CORS headers expuestos

---

**Última actualización:** 2025-11-16 11:37:00
**Siguiente paso:** Abrir `http://localhost:5500` y ejecutar pruebas humanas
