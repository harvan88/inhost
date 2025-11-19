# 📦 FRONTEND INTEGRATION PACKAGE - INHOST

**Versión:** 1.0.0
**Fecha:** 2025-11-19
**Para:** Equipo Frontend
**De:** Equipo Backend / Arquitectura

---

## 🎯 QUÉ ES ESTE PAQUETE

Esta carpeta contiene **toda la documentación necesaria** para que el equipo frontend integre con el backend de INHOST.

**No necesitas buscar en otro lugar** - todo está aquí.

---

## 📂 CONTENIDO DEL PAQUETE

### 1. **api-contract.json** ⭐ FUENTE DE VERDAD
**Lo primero que debes leer**

Contrato completo de la API con:
- ✅ URLs base (development y production)
- ✅ Todos los endpoints disponibles
- ✅ Headers requeridos
- ✅ Formatos de request/response
- ✅ Tipos de mensajes WebSocket
- ✅ Configuración de rate limiting
- ✅ Códigos de error
- ✅ Ejemplos de uso

**IMPORTANTE:** Este archivo debe ser importado en tu código:
```javascript
import apiContract from './api-contract.json';
const API_URL = apiContract.baseURL.development;
```

---

### 2. **FRONTEND-INTEGRATION-MANDATES.md** 📘 GUÍA PRINCIPAL
**La biblia de integración (85KB)**

Documento completo con:
- ✅ **8 Mandatos Obligatorios** (DEBES implementarlos)
- ✅ **Flujos de Mensajes** paso a paso
- ✅ **Sistema de Notificaciones** en tiempo real
- ✅ **Protecciones** (rate limiting, validación, timeout)
- ✅ **Persistencia** (localStorage, sincronización)
- ✅ **Casos de Uso Completos** con código
- ✅ **Ejemplos de Código** production-ready (copiar y pegar)
- ✅ **Troubleshooting** completo

**Secciones Principales:**
1. Resumen Ejecutivo
2. Auditoría del Sistema Actual
3. **Mandatos de Integración** ← Empezar aquí
4. Flujos de Mensajes
5. Sistema de Notificaciones en Tiempo Real
6. Protecciones y Seguridad
7. Persistencia y Estado
8. Casos de Uso Completos
9. **Ejemplos de Código** ← Código listo para usar
10. Troubleshooting

---

### 3. **FRONTEND-AUDIT-SUMMARY.md** 📊 RESUMEN EJECUTIVO
**El TL;DR de la auditoría (25KB)**

Auditoría completa del sistema con:
- ✅ Resumen ejecutivo (5 minutos de lectura)
- ✅ **6 hallazgos críticos** que deben solucionarse
- ✅ Métricas de calidad (Backend: 9/10, Frontend actual: 6/10)
- ✅ **Plan de Acción** con prioridades (1-4)
- ✅ Checklist de migración
- ✅ Lecciones aprendidas

**Lee esto primero** si quieres el resumen rápido.

---

## 🚀 QUICK START - PRIMEROS PASOS

### Paso 1: Lee el Resumen (15 minutos)
```bash
# Leer primero
docs/frontend-handoff/FRONTEND-AUDIT-SUMMARY.md
```

**Busca la sección:** "HALLAZGOS CRÍTICOS"

---

### Paso 2: Revisa el Contrato de API (30 minutos)
```bash
# Tu fuente de verdad
docs/frontend-handoff/api-contract.json
```

**Importar en tu código:**
```javascript
import apiContract from './api-contract.json';

const CONFIG = {
  API_BASE_URL: apiContract.baseURL.development,
  WS_URL: apiContract.websocketURL.development,
  RATE_LIMIT: apiContract.rateLimiting.free
};
```

---

### Paso 3: Implementa los 8 Mandatos (1-2 semanas)
```bash
# Guía completa
docs/frontend-handoff/FRONTEND-INTEGRATION-MANDATES.md
```

**Sección crítica:** "MANDATOS DE INTEGRACIÓN"

Los 8 mandatos son:
1. ✅ Usar el Contrato de API como Fuente de Verdad
2. ✅ Implementar Headers Requeridos
3. ✅ Manejar Rate Limiting
4. ✅ Implementar WebSocket con Auto-Reconexión
5. ✅ Validación y Sanitización de Input
6. ✅ Persistencia Local y Sincronización
7. ✅ Manejo de Errores Completo
8. ✅ Performance y Optimización

---

## ⚠️ HALLAZGOS CRÍTICOS QUE DEBES SOLUCIONAR

### 🔴 CRÍTICO #1: URLs Hardcoded
**Problema:** Frontend actual usa `ws://localhost:8085` hardcoded
**Solución:** Usar `api-contract.json`
**Ubicación en docs:** MANDATO 1
**Prioridad:** Inmediata
**Tiempo estimado:** 1 hora

---

### 🔴 CRÍTICO #2: Rate Limiting No Visible
**Problema:** Headers `X-RateLimit-*` no se leen ni muestran
**Solución:** Implementar barra de progreso de rate limit
**Ubicación en docs:** MANDATO 3
**Prioridad:** Alta
**Tiempo estimado:** 4 horas

**Código de ejemplo disponible en:** FRONTEND-INTEGRATION-MANDATES.md, línea ~320

---

### 🔴 CRÍTICO #3: Sin Persistencia Local
**Problema:** Mensajes solo en memoria, se pierden al recargar
**Solución:** Implementar localStorage + sincronización
**Ubicación en docs:** MANDATO 6
**Prioridad:** Alta
**Tiempo estimado:** 1 día

**Código de ejemplo disponible en:** FRONTEND-INTEGRATION-MANDATES.md, línea ~680

---

### 🟡 CRÍTICO #4: Sin Manejo de User ID
**Problema:** `X-User-Id` no se gestiona correctamente
**Solución:** Implementar función `getUserId()` con localStorage
**Ubicación en docs:** MANDATO 2
**Prioridad:** Alta
**Tiempo estimado:** 2 horas

---

### 🟡 CRÍTICO #5: Clientes Mockeados
**Problema:** Clientes y extensiones son mocks locales
**Solución:** Usar endpoints reales (`/simulate/status`, `/simulate/extension-toggle`)
**Ubicación en docs:** Flujos de Mensajes
**Prioridad:** Media
**Tiempo estimado:** 1 día

---

### 🟡 CRÍTICO #6: Sin Retry Logic
**Problema:** Requests fallidos no se reintentan
**Solución:** Implementar `retryWithBackoff()`
**Ubicación en docs:** MANDATO 7
**Prioridad:** Media
**Tiempo estimado:** 3 horas

**Código de ejemplo disponible en:** FRONTEND-INTEGRATION-MANDATES.md, línea ~920

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

Usa este checklist para trackear tu progreso:

### Semana 1: Fundamentos
- [ ] Leer FRONTEND-AUDIT-SUMMARY.md completo
- [ ] Leer FRONTEND-INTEGRATION-MANDATES.md (secciones 1-3)
- [ ] Importar api-contract.json en el código
- [ ] Reemplazar URLs hardcoded con contrato
- [ ] Implementar función `getUserId()` con localStorage
- [ ] Enviar headers requeridos en todos los requests

### Semana 2: Rate Limiting y WebSocket
- [ ] Leer headers `X-RateLimit-*` en cada response
- [ ] Implementar barra de progreso de rate limit
- [ ] Manejar error 429 (deshabilitar UI temporalmente)
- [ ] Implementar `WebSocketManager` con auto-reconexión
- [ ] Probar WebSocket con servidor real

### Semana 3: Persistencia y Errores
- [ ] Implementar `MessageStore` con localStorage
- [ ] Guardar mensajes al recibirlos por WebSocket
- [ ] Cargar mensajes al iniciar app
- [ ] Implementar clase `APIError`
- [ ] Implementar función `apiRequest()` con error handling
- [ ] Implementar `retryWithBackoff()`

### Semana 4: Integración Completa
- [ ] Conectar con `/simulate/status` para obtener estado
- [ ] Conectar con `/simulate/extension-toggle`
- [ ] Conectar con `/simulate/client-toggle`
- [ ] Implementar `SyncManager` para sincronización
- [ ] Probar flujo completo end-to-end
- [ ] Validar contra checklist final (ver docs)

---

## 🔧 ENDPOINTS DISPONIBLES

### HTTP REST

| Endpoint | Método | Descripción | Docs |
|----------|--------|-------------|------|
| `/health` | GET | Health check | api-contract.json:36 |
| `/simulate/client-message` | POST | Enviar mensaje | api-contract.json:50 |
| `/messages` | GET | Listar mensajes | api-contract.json:104 |
| `/simulate/extension-toggle` | POST | Toggle extensión | api-contract.json:140 |
| `/simulate/status` | GET | Estado del sistema | api-contract.json:156 |

### WebSocket

| Endpoint | Tipo | Descripción | Docs |
|----------|------|-------------|------|
| `/realtime` | WS | Tiempo real | api-contract.json:209 |

**Tipos de mensajes WS:**
- `connection` - Confirmación de conexión
- `message:new` - Nuevo mensaje
- `message:status` - Cambio de estado
- `typing:indicator` - Usuario escribiendo
- `error` - Errores del servidor

---

## 💡 EJEMPLOS DE CÓDIGO RÁPIDOS

### Ejemplo 1: Enviar Mensaje
```javascript
import apiContract from './api-contract.json';

async function sendMessage(text) {
  const response = await fetch(`${apiContract.baseURL.development}/simulate/client-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getUserId()
    },
    body: JSON.stringify({
      clientId: 'web',
      text: text
    })
  });

  // Leer rate limiting
  const remaining = response.headers.get('X-RateLimit-Remaining');
  console.log('Requests remaining:', remaining);

  const result = await response.json();
  return result;
}

function getUserId() {
  let userId = localStorage.getItem('inhost-user-id');
  if (!userId) {
    userId = 'user-' + crypto.randomUUID().substring(0, 8);
    localStorage.setItem('inhost-user-id', userId);
  }
  return userId;
}
```

### Ejemplo 2: WebSocket
```javascript
const ws = new WebSocket(apiContract.websocketURL.development);

ws.onopen = () => {
  console.log('✅ Connected');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'message:new') {
    // Nuevo mensaje recibido
    addMessageToUI(data.data);
  }
};
```

### Ejemplo 3: Rate Limiting UI
```javascript
async function apiRequest(url, options) {
  const response = await fetch(url, options);

  // Actualizar UI con rate limit
  const limit = response.headers.get('X-RateLimit-Limit');
  const remaining = response.headers.get('X-RateLimit-Remaining');

  const percentage = (remaining / limit) * 100;
  document.getElementById('rate-limit-bar').style.width = `${percentage}%`;

  return response;
}
```

**Más ejemplos completos en:** FRONTEND-INTEGRATION-MANDATES.md

---

## 🆘 TROUBLESHOOTING

### "Failed to fetch" en todos los requests

**Causa:** Dashboard abierto desde `file://` (CORS bloqueado)

**Solución:**
```bash
cd testing
bun server.js  # Inicia en http://localhost:5500
```

---

### Headers de rate limiting no visibles

**Causa:** Navegador no muestra headers CORS

**Solución:**
```javascript
// Leer explícitamente en código
const limit = response.headers.get('X-RateLimit-Limit');
console.log('Limit:', limit);
```

---

### WebSocket desconecta constantemente

**Solución:** Implementar auto-reconexión (ver MANDATO 4)

---

### Mensajes duplicados en UI

**Solución:**
```javascript
const messageIds = new Set();

function addMessage(msg) {
  if (messageIds.has(msg.id)) return;
  messageIds.add(msg.id);
  // Renderizar...
}
```

**Más troubleshooting en:** FRONTEND-INTEGRATION-MANDATES.md, sección 10

---

## 📞 CONTACTO Y SOPORTE

### Documentación
- **Mandatos completos:** FRONTEND-INTEGRATION-MANDATES.md
- **Resumen ejecutivo:** FRONTEND-AUDIT-SUMMARY.md
- **Contrato de API:** api-contract.json
- **Guía del proyecto:** ../CLAUDE.md

### Repositorio
- **Frontend actual (referencia):** `/testing/`
- **Backend:** `/apps/api-gateway/`
- **Contrato:** `/api-contract.json`

### Testing
- **Demo completa:** `/testing/tests/test-chat-flow-improved.html`
- **Tests de protección:** `/testing/tests/test-sprint2-protection.html`

---

## ⏱️ ESTIMACIÓN DE TIEMPO

**Tiempo total estimado:** 2-3 semanas (1 desarrollador)

| Fase | Tareas | Tiempo |
|------|--------|--------|
| **Semana 1** | Setup + URLs + Headers | 2-3 días |
| **Semana 2** | Rate Limiting + WebSocket | 3-4 días |
| **Semana 3** | Persistencia + Errores | 3-4 días |
| **Semana 4** | Integración + Testing | 3-4 días |

**Fast-track (crítico):** 1 semana si solo implementas los 6 hallazgos críticos

---

## ✅ DEFINICIÓN DE "HECHO"

Tu integración está completa cuando:

- [x] Todas las URLs vienen del `api-contract.json`
- [x] Headers requeridos se envían en todos los requests
- [x] Rate limiting es visible en UI (barra de progreso)
- [x] WebSocket tiene auto-reconexión robusta
- [x] Mensajes se persisten en localStorage
- [x] Sincronización con servidor funciona
- [x] Manejo de errores completo (400, 429, 500, network)
- [x] Retry logic implementado
- [x] Typing indicators funcionan
- [x] Todos los endpoints usan backend real (no mocks)

**Checklist completo en:** FRONTEND-INTEGRATION-MANDATES.md, sección 9

---

## 🎓 RECURSOS ADICIONALES

### Para Aprender Más
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- localStorage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage

### Stack Tecnológico Backend
- Runtime: Bun
- Framework: Elysia.js
- Base de Datos: PostgreSQL (Prisma)
- WebSocket: Integrado en Elysia
- Validación: TypeBox

---

## 📊 MÉTRICAS ACTUALES

**Estado del Backend:**
- Calificación: 9/10
- Estado: ✅ Production-Ready
- Sprint: 2 completado (Protection & Security)
- Persistencia: PostgreSQL
- Rate Limiting: Implementado y funcionando
- WebSocket: Funcionando con protecciones

**Estado del Frontend Actual:**
- Calificación: 6/10
- Estado: ⚠️ Funcional pero necesita mejoras
- Problema principal: No usa contrato de API
- Fortaleza: Buen sistema de componentes

**Tu objetivo:** Llevar el frontend de 6/10 a 9/10

---

## 🎯 RESUMEN DE 1 MINUTO

**¿Qué tengo que hacer?**
1. Leer `FRONTEND-AUDIT-SUMMARY.md` (15 min)
2. Importar `api-contract.json` en tu código
3. Implementar los 8 mandatos de `FRONTEND-INTEGRATION-MANDATES.md`
4. Usar los ejemplos de código incluidos
5. Seguir el checklist de implementación
6. Probar contra backend real

**¿Cuánto tiempo tomará?**
- Fast-track (crítico): 1 semana
- Completo: 2-3 semanas

**¿Qué obtengo?**
- Integración production-ready con el backend
- Rate limiting visible
- Persistencia de mensajes
- WebSocket robusto
- Manejo de errores completo

---

**¡Éxito con la integración!**

Si tienes dudas, revisa primero la sección de Troubleshooting en FRONTEND-INTEGRATION-MANDATES.md

---

**Última actualización:** 2025-11-19
**Versión del paquete:** 1.0.0
**Backend version:** Sprint 2 (Protection & Security)
