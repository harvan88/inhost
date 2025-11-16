# =Ë Guía de Pruebas - Sprint 2: Protección y Seguridad

**Versión**: 1.0
**Fecha**: 2025-11-15
**Estado**:  Implementación Completa - Listo para Testing

---

## =€ Quick Start

### **Iniciar el servidor:**
```bash
cd apps/api-gateway
bun run dev
```

### **Abrir dashboard de pruebas:**
```bash
# En navegador, abrir:
http://localhost:3000/
# Y luego abrir en otra pestaña:
file:///path/to/test-sprint2-protection.html
```

### **Archivos clave:**
- **Test Dashboard**: [test-sprint2-protection.html](test-sprint2-protection.html)
- **Rate Limiting**: [apps/api-gateway/src/middleware/rateLimiting.ts](apps/api-gateway/src/middleware/rateLimiting.ts)
- **Validation**: [apps/api-gateway/src/middleware/validation.ts](apps/api-gateway/src/middleware/validation.ts)
- **Timeout**: [apps/api-gateway/src/middleware/timeout.ts](apps/api-gateway/src/middleware/timeout.ts)

---

## <¯ Objetivo de las Pruebas

Validar exhaustivamente las **4 protecciones críticas** implementadas en Sprint 2:

1.  **Rate Limiting** - Límites por plan de usuario
2.  **Validación de Mensajes** - 8 reglas de validación
3.  **Timeout Protection** - Circuit breaker y timeouts
4.  **Sanitización Automática** - Limpieza de datos

---

## = Estado del Sistema

### **Protecciones Activas:**

| Protección | Ubicación | Estado | Configuración |
|------------|-----------|--------|---------------|
| Rate Limiting | POST/GET /messages |  Activo | 12 req/min (free), 30 (premium), 100 (enterprise) |
| Validation | POST /messages |  Activo | 6 reglas, texto max 16KB, mensaje max 1MB |
| Timeout | Todas las rutas |  Activo | 5s timeout, circuit breaker threshold 5 |
| Circuit Breaker | Operaciones async |  Activo | Reset time 30s, 3 success para cerrar |

### **Headers HTTP Retornados:**
```
X-RateLimit-Limit: 12
X-RateLimit-Remaining: 11
X-RateLimit-Reset: 1700000000
Retry-After: 60 (solo en 429)
```

---

## >ê PRUEBAS DETALLADAS

### **PRUEBA 1: RATE LIMITING** ¡

#### **Objetivo:** Verificar que el sistema bloquea después de 12 requests/minuto (plan free)

**Configuración Inicial:**
```bash
# El rate limiter se inicia automáticamente con el servidor
# Configuración en: apps/api-gateway/src/services/index.ts:100-101
rateLimiter.startCleanup();  # Cleanup cada 5 minutos
```

**Pasos a Ejecutar:**

1. **Abrir test-sprint2-protection.html en navegador**

2. **En sección "1. Rate Limiting Test":**
   - User ID: `test-user-free` (o cualquier ID único)
   - Cantidad de requests: `15`
   - Click en "=¦ Test Rate Limiting"

3. **Observar resultados esperados:**
   ```
   Request 1-12:   Status 200 (Success)
   Request 13:    L Status 429 (Too Many Requests)
   Request 14:    L Status 429
   Request 15:    L Status 429
   ```

4. **Verificar headers en panel lateral:**
   ```
   X-RateLimit-Limit: 12
   X-RateLimit-Remaining: 0 (cuando se bloquea)
   X-RateLimit-Reset: [timestamp futuro]
   Retry-After: ~60 segundos
   ```

5. **Comprobar en consola del servidor:**
   ```bash
   # Logs esperados:
   = [DEBUG] Rate limit recorded { userId: 'test-user-free', count: 1/12 }
   = [DEBUG] Rate limit recorded { userId: 'test-user-free', count: 12/12 }
      [WARN] Rate limit exceeded { userId: 'test-user-free', limit: 12 }
   ```

** CRITERIOS DE ÉXITO:**
- [ ] Exactamente 12 requests exitosos
- [ ] Request 13 retorna 429 con Retry-After
- [ ] Headers X-RateLimit-* presentes y correctos
- [ ] Logs muestran conteo progresivo
- [ ] Después de 60s, permite nuevos requests

**= Troubleshooting:**
- Si permite más de 12: Verificar que User-ID es el mismo en todos los requests
- Si bloquea antes: Revisar que no hay requests previos con ese User-ID
- Si headers faltantes: Verificar middleware está registrado en routes/messages.ts:28-32

---

### **PRUEBA 2: VALIDACIÓN DE MENSAJES** =á

#### **Objetivo:** Verificar que el sistema rechaza mensajes inválidos con errores descriptivos

**Configuración:**
```typescript
// Reglas en apps/api-gateway/src/implementations/v1/SimpleValidator.ts:31-37
maxTextLength: 16384,        // 16 KB
maxMessageSize: 1048576,     // 1 MB
maxMetadataFields: 50,
requireFields: ['id', 'channel', 'direction', 'content']
```

**Casos de Prueba a Ejecutar:**

#### **Caso 2.1: Missing ID**
```json
// Request sin campo 'id'
{
  "type": "incoming",
  "channel": "whatsapp",
  "content": { "text": "Test" }
}
```
- **Expected**: L Status 400
- **Error**: `"Required field 'id' is missing or empty"`
- **Code**: `REQUIRED_FIELD_MISSING`

#### **Caso 2.2: Missing Channel**
```json
{
  "id": "uuid",
  "type": "incoming",
  "content": { "text": "Test" }
}
```
- **Expected**: L Status 400
- **Error**: `"Required field 'channel' is missing or empty"`

#### **Caso 2.3: Text Too Long**
```json
{
  "id": "uuid",
  "type": "incoming",
  "channel": "whatsapp",
  "content": { "text": "A".repeat(20000) }  // > 16KB
}
```
- **Expected**: L Status 400
- **Error**: `"Text exceeds maximum length of 16384 characters"`
- **Code**: `TEXT_TOO_LONG`

#### **Caso 2.4: Invalid Channel**
```json
{
  "id": "uuid",
  "type": "incoming",
  "channel": "invalid_channel",  // No es whatsapp/telegram/sms/web
  "content": { "text": "Test" }
}
```
- **Expected**: L Status 400
- **Error**: `"Channel must be one of: whatsapp, telegram, sms, web"`
- **Code**: `INVALID_CHANNEL`

#### **Caso 2.5: Invalid Type**
```json
{
  "id": "uuid",
  "type": "invalid_type",  // No es incoming/outgoing/system/status
  "channel": "whatsapp",
  "content": { "text": "Test" }
}
```
- **Expected**: L Status 400
- **Error**: `"Type must be one of: incoming, outgoing, system, status"`
- **Code**: `INVALID_TYPE`

#### **Caso 2.6: Empty Content**
```json
{
  "id": "uuid",
  "type": "incoming",
  "channel": "whatsapp",
  "content": {}  // Sin text ni media
}
```
- **Expected**: L Status 400
- **Error**: `"Message must have either text or media"`
- **Code**: `EMPTY_CONTENT`

#### **Caso 2.7: Message Too Large**
```json
{
  "id": "uuid",
  "type": "incoming",
  "channel": "whatsapp",
  "content": { "text": "Test" },
  "metadata": {
    // Añadir ~60 campos para exceder límite
    "field1": "value", ..., "field60": "value"
  }
}
```
- **Expected**: L Status 400
- **Error**: `"Metadata has too many fields (max: 50)"`
- **Code**: `TOO_MANY_METADATA_FIELDS`

#### **Caso 2.8: Valid Message** 
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "incoming",
  "channel": "whatsapp",
  "content": { "text": "Hello World" },
  "metadata": {
    "from": "+1234567890",
    "to": "+0987654321",
    "timestamp": "2025-11-15T10:00:00Z"
  }
}
```
- **Expected**:  Status 200/201
- **Response**: Mensaje creado exitosamente

** CRITERIOS DE ÉXITO:**
- [ ] Todos los casos inválidos (2.1-2.7) retornan 400
- [ ] Errores son descriptivos y específicos
- [ ] Caso válido (2.8) retorna 200/201
- [ ] Sanitización funciona (trim de espacios en texto)
- [ ] Response body incluye `details` con array de errores

**Ejecución en Dashboard:**
1. Ir a sección "2. Validation Test"
2. Seleccionar cada caso del dropdown
3. Click " Test Validation"
4. Verificar stats: Total, Passed, Failed, Errors

---

### **PRUEBA 3: TIMEOUT & CIRCUIT BREAKER** ñ

#### **Objetivo:** Verificar protección contra operaciones lentas y fallos en cascada

**Configuración:**
```typescript
// apps/api-gateway/src/middleware/timeout.ts:33-35
timeout: 5000,                    // 5 segundos
circuitBreakerThreshold: 5,       // 5 fallos consecutivos
circuitBreakerResetTime: 30000    // 30 segundos
```

**Estados del Circuit Breaker:**
```
CLOSED    ’ Normal (todas las requests pasan)
OPEN      ’ Bloqueado (todas las requests fallan inmediato con 503)
HALF_OPEN ’ Probando (permite requests para verificar recuperación)
```

**Pasos para Probar Timeout:**

1. **Simular operación lenta:**
   ```javascript
   // En el código de prueba, usar:
   await new Promise(resolve => setTimeout(resolve, 7000));  // 7s > 5s timeout
   ```

2. **Enviar request y observar:**
   - **Expected**: L Status 503 (Service Unavailable)
   - **Error**: `"Operation exceeded 5000ms timeout"`
   - **Tiempo de respuesta**: ~5000ms (exactamente timeout)

3. **Verificar en logs:**
   ```
   ñ  [ERROR] Protected operation failed {
     error: "Operation exceeded 5000ms timeout",
     circuitState: "CLOSED"
   }
   ```

**Pasos para Probar Circuit Breaker:**

1. **Enviar 5 requests que fallan por timeout:**
   ```bash
   # Cada request debe fallar con timeout
   Request 1: L Timeout 503 (circuit: CLOSED)
   Request 2: L Timeout 503 (circuit: CLOSED)
   Request 3: L Timeout 503 (circuit: CLOSED)
   Request 4: L Timeout 503 (circuit: CLOSED)
   Request 5: L Timeout 503 (circuit: CLOSED ’ OPEN)
   ```

2. **En el request 5, observar cambio de estado:**
   ```
   = [ERROR] Circuit breaker OPEN after threshold reached {
     failures: 5,
     threshold: 5
   }
   ```

3. **Enviar request 6 inmediatamente:**
   - **Expected**: L Status 503 (instantáneo, sin esperar timeout)
   - **Error**: `"Service temporarily unavailable"`
   - **Code**: `CIRCUIT_BREAKER_OPEN`
   - **Header**: `Retry-After: 30`

4. **Esperar 30 segundos y enviar request:**
   ```
   Estado: OPEN ’ HALF_OPEN
   Request 7:  Success (si pasa, circuit ’ CLOSED)
             L Fail (si falla, circuit ’ OPEN again)
   ```

5. **Si request 7 pasa, verificar recuperación:**
   ```
   Request 8:  Success (circuit debe estar CLOSED)
   Request 9:  Success

   = [INFO] Circuit breaker closing after successful recovery
   ```

** CRITERIOS DE ÉXITO:**
- [ ] Timeout exacto a los 5 segundos
- [ ] Circuit se abre después de exactamente 5 fallos
- [ ] Estado OPEN bloquea requests inmediatamente
- [ ] Header `Retry-After: 30` presente cuando circuit está OPEN
- [ ] Transición OPEN ’ HALF_OPEN a los 30 segundos
- [ ] Recuperación exitosa cierra el circuit (HALF_OPEN ’ CLOSED)
- [ ] Logs muestran transiciones de estado correctamente

**Ejecución en Dashboard:**
1. Configurar adapter lento (7000ms delay)
2. Enviar 6 requests consecutivos
3. Observar stats y cambio de estados
4. Esperar 30s y probar recuperación

---

### **PRUEBA 4: STRESS TEST COMBINADO** =€

#### **Objetivo:** Verificar comportamiento del sistema bajo carga con todas las protecciones activas

**Configuración del Test:**
```javascript
// En test-sprint2-protection.html, sección "3. Combined Stress Test"
duration: 30 segundos
requestsPerSecond: 5
totalRequests: 150
```

**Escenarios Simultáneos:**
1. **Rate Limiting**: Múltiples usuarios concurrentes
2. **Validation**: Mensajes válidos e inválidos mezclados
3. **Timeout**: Algunas operaciones lentas
4. **Circuit Breaker**: Gestión de fallos en cascada

**Métricas a Monitorear:**

| Métrica | Valor Esperado | Alerta si... |
|---------|----------------|--------------|
| **Requests/segundo** | ~5 (configurado) | Varía >20% |
| **Latencia promedio** | <100ms | >500ms |
| **Tasa de éxito** | 60-80% (por rate limiting) | <50% |
| **Tasa 429** | 20-40% (rate limiting) | >60% |
| **Tasa 400** | 0-10% (validation) | >30% |
| **Tasa 503** | 0-5% (timeouts) | >15% |
| **Memory usage** | Estable | Crecimiento continuo |

**Pasos:**

1. **Abrir dashboard y configurar:**
   - Duración: 30s
   - RPS: 5
   - Click "¶ Start Stress Test"

2. **Durante el test, observar en dashboard:**
   - **Stats en tiempo real**: Sent, Success, Rate Limited, Invalid
   - **Gráfica de throughput**: Debe mantenerse cerca de 5 req/s
   - **Logs scrolling**: Verificar mezcla de 200, 429, 400

3. **En consola del servidor, monitorear:**
   ```bash
   # Logs esperados:
   = [DEBUG] Rate limit: 5/12 remaining
   = [DEBUG] Rate limit: 11/12 remaining (otro usuario)
      [WARN] Rate limit exceeded
   = [DEBUG] Message validated successfully
   L [WARN] Message validation failed
   ```

4. **Después del test (30s), verificar:**
   -  Sistema responde inmediatamente (no stuck)
   -  Memory vuelve a niveles normales
   -  Nuevos requests funcionan correctamente
   -  No hay errores 5xx inesperados en logs

** CRITERIOS DE ÉXITO:**
- [ ] Sistema completa los 30s sin crashes
- [ ] Throughput se mantiene estable (~5 req/s)
- [ ] Rate limiting funciona correctamente con múltiples usuarios
- [ ] No hay memory leaks (uso de memoria se estabiliza)
- [ ] Latencias se mantienen <500ms (99th percentile)
- [ ] Después del test, sistema vuelve a estado normal
- [ ] Logs no muestran deadlocks o race conditions

**= Troubleshooting:**
- **Alta tasa de 503**: Circuit breaker puede haberse abierto, esperar 30s
- **Memory leak**: Verificar cleanup de rate limiter y owner checker
- **Latencias altas**: Reducir RPS o verificar operaciones síncronas

---

### **PRUEBA 5: INTEGRACIÓN CON CLIENTES EXISTENTES** =¬

#### **Objetivo:** Verificar que las protecciones no rompen funcionalidad existente

**Archivos a Probar:**
- [test-chat-flow.html](test-chat-flow.html) - Chat flow original
- [test-chat-flow-improved.html](test-chat-flow-improved.html) - Chat flow mejorado

**Flujos a Validar:**

#### **5.1: Cliente WhatsApp**
```bash
1. Abrir test-chat-flow.html
2. Click "Connect WhatsApp Simulator"
3. Enviar mensaje: "Hola desde WhatsApp"
4. Verificar:
    Mensaje pasa validación
    Aparece en chat central
    No hay errores en consola
    Rate limiting no bloquea (solo 1 mensaje)
```

#### **5.2: Cliente Telegram**
```bash
1. Click "Connect Telegram Simulator"
2. Enviar mensaje: "Hola desde Telegram"
3. Enviar mensaje largo (>1000 caracteres pero <16KB)
4. Verificar:
    Ambos mensajes pasan validación
    Formato preservado
    Timestamps correctos
```

#### **5.3: Cliente SMS (Short Message)**
```bash
1. Click "Connect SMS Simulator"
2. Enviar mensaje corto: "SMS test"
3. Verificar:
    Validación pasa (content tiene texto)
    Channel 'sms' es válido
    No hay sanitización agresiva
```

#### **5.4: Extensión AI**
```bash
1. Conectar cliente WhatsApp
2. Activar extensión AI
3. Enviar mensaje: "¿Qué es Inhost?"
4. Verificar:
    Mensaje original pasa validación
    Respuesta AI pasa validación
    Metadata preservado (from: ai-extension)
    Flujo completo funcional
```

#### **5.5: Múltiples mensajes rápidos**
```bash
1. Desde cualquier cliente, enviar 5 mensajes rápidos:
   "Mensaje 1"
   "Mensaje 2"
   "Mensaje 3"
   "Mensaje 4"
   "Mensaje 5"
2. Verificar:
    Todos pasan (rate limit free permite 12/min)
    Orden preservado
    Sin pérdida de mensajes
```

** CRITERIOS DE ÉXITO:**
- [ ] Funcionalidad existente 100% operativa
- [ ] No hay regresiones en UX
- [ ] Mensajes fluyen a través de todas las protecciones sin problemas
- [ ] Latencia adicional imperceptible (<50ms)
- [ ] Logs limpios (sin errores inesperados)
- [ ] Chat central muestra todos los mensajes correctamente
- [ ] Extensiones (AI, etc.) funcionan sin cambios

**= Troubleshooting:**
- **Mensajes bloqueados**: Verificar User-ID único por cliente
- **Validación falla**: Revisar formato MessageEnvelopeV2 en simulators
- **Timeout en envíos**: Reducir delay en simulators (<5s)

---

## =Ê PLANTILLA DE REPORTE DE PRUEBAS

```markdown
# =Ë REPORTE DE PRUEBAS - SPRINT 2

## =' Entorno de Pruebas
- **Fecha**: 2025-11-15
- **Versión**: Sprint 2 - Protección y Seguridad
- **Servidor**: http://localhost:3000
- **Tester**: [Tu nombre]
- **Duración total**: _____ minutos

##  Resultados por Prueba

### Prueba 1: Rate Limiting
- [ ] PASS - Bloquea después de 12 requests (free plan)
- [ ] PASS - Headers X-RateLimit-* presentes y correctos
- [ ] PASS - Logs muestran conteo progresivo
- [ ] PASS - Recovery después de 60 segundos
- [ ] PASS - Diferentes planes tienen límites diferentes

**Observaciones**:
_____________________________________

**Evidencia (screenshots/logs)**:
_____________________________________

---

### Prueba 2: Validación de Mensajes
- [ ] PASS - Rechaza mensaje sin ID (400)
- [ ] PASS - Rechaza mensaje sin channel (400)
- [ ] PASS - Rechaza texto >16KB (400)
- [ ] PASS - Rechaza channel inválido (400)
- [ ] PASS - Rechaza type inválido (400)
- [ ] PASS - Rechaza contenido vacío (400)
- [ ] PASS - Rechaza metadata excesivo (400)
- [ ] PASS - Acepta mensajes válidos (200/201)

**Casos fallidos** (si aplica):
_____________________________________

**Observaciones**:
_____________________________________

---

### Prueba 3: Timeout & Circuit Breaker
- [ ] PASS - Timeout exacto a los 5 segundos (503)
- [ ] PASS - Circuit abre después de 5 fallos (CLOSED ’ OPEN)
- [ ] PASS - Requests fallan inmediato cuando circuit está OPEN
- [ ] PASS - Retry-After header presente (30 segundos)
- [ ] PASS - Transición a HALF_OPEN después de reset time
- [ ] PASS - Recovery exitosa cierra circuit (HALF_OPEN ’ CLOSED)
- [ ] PASS - Fallback values se usan cuando timeout

**Estados observados**:
- CLOSED: _____ requests
- OPEN: _____ requests
- HALF_OPEN: _____ requests

**Observaciones**:
_____________________________________

---

### Prueba 4: Stress Test
- [ ] PASS - Sistema completa 30s sin crashes
- [ ] PASS - Throughput estable (~5 req/s)
- [ ] PASS - Rate limiting funciona con múltiples usuarios
- [ ] PASS - Sin memory leaks (uso estable)
- [ ] PASS - Latencias <500ms (p99)
- [ ] PASS - Recovery completo después del test

**Métricas Observadas**:
- Requests totales: _____
- Tasa de éxito: _____%
- Tasa 429 (rate limit): _____%
- Tasa 400 (validation): _____%
- Tasa 503 (timeout): _____%
- Latencia promedio: _____ ms
- Latencia p99: _____ ms
- Memory max: _____ MB

**Observaciones**:
_____________________________________

---

### Prueba 5: Integración con Clientes
- [ ] PASS - Cliente WhatsApp funciona
- [ ] PASS - Cliente Telegram funciona
- [ ] PASS - Cliente SMS funciona
- [ ] PASS - Extensión AI funciona
- [ ] PASS - Mensajes múltiples rápidos pasan
- [ ] PASS - Sin regresiones en UX
- [ ] PASS - Formatos y metadata preservados

**Clientes probados**:
- WhatsApp: [ ] OK [ ] FAIL - Detalle: _____
- Telegram: [ ] OK [ ] FAIL - Detalle: _____
- SMS: [ ] OK [ ] FAIL - Detalle: _____
- AI Extension: [ ] OK [ ] FAIL - Detalle: _____

**Observaciones**:
_____________________________________

---

## = PROBLEMAS ENCONTRADOS

### Problema #1
- **Descripción**: _____________________________________
- **Severidad**: [ ] Baja [ ] Media [ ] Alta [ ] Crítica
- **Prueba afectada**: _____________________________________
- **Pasos para reproducir**:
  1. _____________________________________
  2. _____________________________________
- **Logs relevantes**:
  ```
  _____________________________________
  ```
- **Screenshot**: [Adjuntar si aplica]

### Problema #2
- **Descripción**: _____________________________________
- **Severidad**: [ ] Baja [ ] Media [ ] Alta [ ] Crítica
- **Prueba afectada**: _____________________________________
- **Pasos para reproducir**:
  1. _____________________________________
  2. _____________________________________
- **Logs relevantes**:
  ```
  _____________________________________
  ```

---

## =È ANÁLISIS DE RESULTADOS

### Resumen General
- **Total de pruebas**: 5
- **Pruebas pasadas**: _____ / 5
- **Pruebas fallidas**: _____ / 5
- **Tasa de éxito**: _____%

### Áreas de Fortaleza
1. _____________________________________
2. _____________________________________
3. _____________________________________

### Áreas de Mejora
1. _____________________________________
2. _____________________________________
3. _____________________________________

---

## <¯ RECOMENDACIÓN FINAL

[ ]  **LISTO PARA PRODUCCIÓN**
  - Todas las pruebas pasan
  - No hay problemas críticos
  - Performance dentro de rangos esperados

[ ]   **REQUIERE AJUSTES MENORES**
  - Mayoría de pruebas pasan
  - Problemas no críticos identificados
  - Ajustes recomendados antes de producción

[ ] L **REQUIERE FIXES CRÍTICOS**
  - Pruebas críticas fallan
  - Problemas de alta severidad
  - No apto para producción

**Justificación**:
_____________________________________
_____________________________________

**Próximos pasos recomendados**:
1. _____________________________________
2. _____________________________________
3. _____________________________________

---

## =Ý Firma del Tester

**Nombre**: _____________________
**Fecha**: _____________________
**Firma**: _____________________
```

---

## =¨ PROCEDIMIENTO EN CASO DE ERRORES

### **Error: Dashboard no carga**

**Síntomas**:
- test-sprint2-protection.html muestra pantalla en blanco
- Errores en consola del navegador

**Solución**:
```bash
# 1. Verificar servidor corriendo
curl http://localhost:3000/health

# 2. Verificar archivo existe
ls -la test-sprint2-protection.html

# 3. Revisar consola del navegador (F12)
# Buscar errores CORS o JavaScript

# 4. Abrir archivo directamente
# file:///path/to/test-sprint2-protection.html
```

---

### **Error: Rate limiting no funciona**

**Síntomas**:
- Permite más de 12 requests (plan free)
- Headers X-RateLimit-* no aparecen

**Diagnóstico**:
```bash
# 1. Verificar logs de inicialización
# Buscar: "Rate limiter cleanup started"

# 2. Verificar middleware registrado
grep -r "rateLimiting" apps/api-gateway/src/routes/messages.ts

# 3. Verificar User-ID en requests
# Headers deben incluir: X-User-Id
```

**Solución**:
```bash
# Si cleanup no inició:
# Verificar apps/api-gateway/src/services/index.ts:100-101
rateLimiter.startCleanup();

# Si headers faltantes:
# Verificar routes/messages.ts:28-32 tiene rateLimiting middleware
```

---

### **Error: Validación muy estricta/laxa**

**Síntomas**:
- Rechaza mensajes que deberían pasar
- Acepta mensajes que deberían fallar

**Diagnóstico**:
```bash
# 1. Revisar reglas configuradas
cat apps/api-gateway/src/implementations/v1/SimpleValidator.ts | grep -A 10 "private rules"

# 2. Verificar formato del mensaje
# Debe cumplir con MessageEnvelopeV2
```

**Solución**:
```typescript
// Ajustar reglas en SimpleValidator si es necesario
configure({
  maxTextLength: 16384,  // Ajustar si es demasiado estricto
  requireFields: ['id', 'channel', 'direction', 'content']
});
```

---

### **Error: Circuit breaker no se recupera**

**Síntomas**:
- Circuit permanece OPEN después de 30s
- No transiciona a HALF_OPEN

**Diagnóstico**:
```bash
# 1. Verificar tiempo transcurrido
# Debe ser >= 30 segundos desde último fallo

# 2. Verificar logs de estado
# Buscar: "Circuit breaker entering HALF_OPEN"
```

**Solución**:
```bash
# 1. Esperar 30 segundos COMPLETOS
# 2. Enviar request exitoso (debe pasar rápido, <5s)
# 3. Verificar transición HALF_OPEN ’ CLOSED

# Si persiste, reiniciar servidor:
cd apps/api-gateway
bun run dev
```

---

### **Error: Memory leak durante stress test**

**Síntomas**:
- Uso de memoria crece continuamente
- No se estabiliza después del test

**Diagnóstico**:
```bash
# Monitorear uso de memoria
# En terminal del servidor, observar salida

# Verificar cleanup running
# Logs deben mostrar: "Rate limiter cleanup"
```

**Solución**:
```bash
# Verificar cleanups activos en services/index.ts:
rateLimiter.startCleanup();         # Línea 101
ownerChecker.startAutoCleanup(5);   # Línea 104

# Si no está, añadir y reiniciar
```

---

## =Þ CONTACTO Y SOPORTE

### **Para Consultas Técnicas:**
- **Desarrollador**: Harva
- **Email**: [email]
- **Documentación**: [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md)

### **Archivos de Referencia:**
- **Frontend Strategy**: [FRONTEND-STRATEGY.md](FRONTEND-STRATEGY.md)
- **Git History**: `git log --oneline`
- **API Documentation**: [PENDIENTE - Sprint futuro]

### **Recursos Útiles:**
- **Elysia Docs**: https://elysiajs.com/
- **Bun Runtime**: https://bun.sh/
- **Circuit Breaker Pattern**: https://martinfowler.com/bliki/CircuitBreaker.html

---

## <¯ CRITERIOS DE APROBACIÓN FINAL

El Sprint 2 se considera ** APROBADO** cuando:

- [ ] **Todas las pruebas 1-5 pasan** sus criterios de éxito
- [ ] **No hay errores críticos** (severidad Alta/Crítica)
- [ ] **Funcionalidad existente** no tiene regresiones
- [ ] **Reporte de pruebas** completo y firmado
- [ ] **Performance** dentro de targets (latencia <100ms, throughput estable)
- [ ] **Logs** limpios sin errores inesperados

### **Una vez aprobado, proceder con:**

1.  **Merge a main branch**
   ```bash
   git checkout main
   git merge sprint-2-protection
   ```

2.  **Push a repositorio remoto**
   ```bash
   git push origin main
   ```

3.  **Tag de versión**
   ```bash
   git tag -a v0.2.0 -m "Sprint 2: Protection & Security"
   git push origin v0.2.0
   ```

4.  **Notificación a stakeholders**
   - Enviar resumen de cambios
   - Adjuntar reporte de pruebas
   - Confirmar fecha de Sprint 3

5.  **Preparar Sprint 3**
   - Review de [FRONTEND-STRATEGY.md](FRONTEND-STRATEGY.md)
   - Planificación de persistencia (PostgreSQL/Redis)
   - Setup de entorno de desarrollo

---

## ñ TIEMPO ESTIMADO

| Actividad | Duración Estimada |
|-----------|-------------------|
| Setup inicial | 5 minutos |
| Prueba 1: Rate Limiting | 10 minutos |
| Prueba 2: Validación | 15 minutos |
| Prueba 3: Timeout & Circuit | 15 minutos |
| Prueba 4: Stress Test | 10 minutos (30s test + análisis) |
| Prueba 5: Integración | 10 minutos |
| Reporte y documentación | 10 minutos |
| **TOTAL** | **~60 minutos** |

---

## =O Agradecimientos

**¡Gracias por tu apoyo en la validación de estas protecciones críticas!**

Tu trabajo asegura que el sistema de mensajería Inhost sea:
- =á Seguro contra abusos (rate limiting)
-  Robusto con validaciones
- ñ Resiliente ante fallos (circuit breaker)
- =€ Listo para escalar

**Tu feedback es valioso para mejorar el sistema. No dudes en reportar cualquier observación, por pequeña que sea.**

---

**Versión del documento**: 1.0
**Última actualización**: 2025-11-15
**Próxima revisión**: Después de Sprint 3
