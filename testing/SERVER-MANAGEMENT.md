# 🖥️ Gestión Manual del Servidor - INHOST Testing

## ⚠️ IMPORTANTE: Inicio Manual Obligatorio

**El servidor DEBE iniciarse MANUALMENTE desde la terminal.**

❌ **NO** se inicia automáticamente desde el navegador
❌ **NO** se inicia desde los dashboards de testing
✅ **SÍ** debes iniciarlo manualmente desde la terminal

---

## 🎯 Indicador de Estado del Servidor

El dashboard principal (`testing/index.html`) ahora incluye un **indicador de estado** en la esquina superior derecha del header.

### Estados Posibles:

#### 🟢 Encendido (Verde)
- **Significado:** El servidor está funcionando correctamente
- **Procesos:** 1 proceso activo
- **Acción:** Ninguna - Todo está bien

#### 🔴 Apagado (Rojo)
- **Significado:** El servidor no está corriendo
- **Procesos:** 0 procesos
- **Acción:** Iniciar el servidor manualmente (ver abajo)

#### ⚠️ Múltiples Procesos (Amarillo/Naranja)
- **Significado:** Hay más de una instancia del servidor corriendo
- **Procesos:** 2+ procesos activos
- **Acción:** **CRÍTICO** - Detener todos y reiniciar uno solo (ver abajo)

### Características del Indicador:

- **Auto-refresh:** Se actualiza cada 5 segundos
- **Tooltip:** Pasa el mouse sobre el indicador para ver detalles completos
- **Información mostrada:**
  - Estado actual (Encendido/Apagado/Error)
  - Puerto (3000)
  - Número estimado de procesos
  - Modo: Manual
  - Comandos para iniciar/reiniciar

---

## 🚀 Cómo Iniciar el Servidor

### Método 1: Desde el directorio raíz

```bash
# Abrir terminal en: c:\Users\harva\Documents\Trabajos\meetgar\inhost
bun --cwd apps/api-gateway dev
```

### Método 2: Desde el directorio del api-gateway

```bash
# Navegar al directorio
cd apps/api-gateway

# Iniciar el servidor
bun run dev
```

### Verificación de Inicio Exitoso

Deberías ver en la terminal:

```
ℹ️ [INFO] 🦊 Inhost API Gateway is running
ℹ️ [INFO] 🏥 Adapters health check
ℹ️ [INFO] 📊 MessageCore stats
ℹ️ [INFO] ✅ Services initialized successfully
```

El indicador en el dashboard debería cambiar a **🟢 Encendido**.

---

## ⚠️ Problema: Múltiples Instancias del Servidor

### ¿Por qué es un problema?

Cuando hay múltiples procesos de `bun.exe` corriendo:

1. **Colisión de puertos:** Solo uno puede escuchar en el puerto 3000
2. **Comportamiento inconsistente:** Las requests pueden llegar a diferentes instancias
3. **Código desactualizado:** Instancias antiguas pueden tener código viejo
4. **Desperdicio de recursos:** CPU y memoria malgastados

### Síntomas:

- ❌ "Failed to fetch" intermitente
- ❌ Algunos requests funcionan, otros no
- ❌ Cambios en el código no se reflejan
- ❌ El indicador muestra estado amarillo/naranja

### Solución:

#### Paso 1: Verificar Múltiples Procesos

**Windows:**
```bash
tasklist | findstr bun.exe
```

**Resultado esperado (CORRECTO):**
```
bun.exe                      12345 Console                    6    39.696 KB
```
Solo UNA línea.

**Resultado problemático (INCORRECTO):**
```
bun.exe                      12345 Console                    6    39.696 KB
bun.exe                      67890 Console                    6    18.584 KB
bun.exe                      11111 Console                    6   204.304 KB
```
Tres o más líneas = PROBLEMA.

#### Paso 2: Detener TODOS los Procesos

**Windows:**
```bash
taskkill /F /IM bun.exe
```

**Deberías ver:**
```
CORRECTO: Se terminó el proceso "bun.exe" con PID XXXXX.
CORRECTO: Se terminó el proceso "bun.exe" con PID YYYYY.
```

#### Paso 3: Verificar que Todos se Detuvieron

```bash
tasklist | findstr bun.exe
```

**Resultado esperado:** Ninguna salida (comando retorna vacío).

#### Paso 4: Iniciar UNA SOLA Instancia

```bash
bun --cwd apps/api-gateway dev
```

#### Paso 5: Verificar en el Dashboard

1. Abre `testing/index.html`
2. El indicador debería mostrar: **🟢 Encendido**
3. Tooltip debería decir: **"1 proceso"**

---

## 🔍 Verificación Manual del Servidor

### Desde Terminal (cURL):

```bash
# Test 1: Health endpoint
curl http://localhost:3000/health

# Respuesta esperada:
# {"success":true,"data":{"status":"healthy","timestamp":"...","version":"1.0.0"},...}

# Test 2: POST mensaje
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -H "X-User-Id: test-user" \
  -d "{\"type\":\"incoming\",\"channel\":\"whatsapp\",\"content\":{\"text\":\"Test\"},\"metadata\":{\"from\":\"+1\",\"to\":\"+2\",\"timestamp\":\"2025-11-16T10:00:00Z\"}}"

# Respuesta esperada:
# {"success":true,"data":{"status":"received","messageId":"...","timestamp":"...","storage":"postgresql"},...}
```

### Desde Navegador:

1. Abre el dashboard: `testing/index.html`
2. Verifica el indicador de estado (esquina superior derecha)
3. Pasa el mouse sobre el indicador para ver el tooltip
4. Selecciona "Sprint 2 Protection" del menú
5. Haz clic en "ℹ️ Info API" para verificar conectividad

---

## 📋 Checklist de Gestión del Servidor

### Antes de Empezar a Trabajar:

- [ ] Verificar que NO hay procesos de bun corriendo (`tasklist | findstr bun.exe`)
- [ ] Iniciar el servidor manualmente (`bun --cwd apps/api-gateway dev`)
- [ ] Verificar que el indicador muestra 🟢 Encendido
- [ ] Verificar que hay exactamente 1 proceso corriendo

### Durante el Desarrollo:

- [ ] Monitorear el indicador de estado
- [ ] Si el indicador se pone amarillo/naranja, detener todos los procesos y reiniciar
- [ ] Si cambias código del servidor, reiniciar manualmente
- [ ] NO abrir múltiples terminales con `bun dev`

### Al Terminar:

- [ ] Detener el servidor con `Ctrl+C` en la terminal
- [ ] Verificar que NO queden procesos huérfanos (`tasklist | findstr bun.exe`)
- [ ] Cerrar todas las pestañas del navegador con los dashboards

---

## 🐛 Troubleshooting

### Problema: El indicador siempre muestra 🔴 Apagado

**Causas posibles:**

1. **El servidor no está corriendo**
   - Solución: Iniciarlo con `bun --cwd apps/api-gateway dev`

2. **El servidor está corriendo en otro puerto**
   - Verificar logs de la terminal
   - Buscar mensaje "running on port XXXX"
   - El puerto debe ser 3000

3. **CORS bloqueando requests**
   - Verificar consola del navegador (F12)
   - Buscar errores de CORS
   - Asegurarse de que el servidor permite `localhost`

### Problema: El indicador cambia de 🟢 a 🔴 cada 5 segundos

**Causas posibles:**

1. **El servidor crashea y se reinicia automáticamente**
   - Revisar logs de la terminal
   - Buscar errores/excepciones
   - El modo `--watch` puede estar reiniciando

2. **Timeout de red**
   - El health check tiene timeout de 3 segundos
   - Si el servidor está muy cargado, puede no responder a tiempo

3. **Múltiples procesos compitiendo**
   - Verificar con `tasklist | findstr bun.exe`
   - Debe haber solo UNO

### Problema: El indicador muestra ⚠️ Múltiples Procesos pero solo hay uno

**Nota:** El indicador actualmente NO detecta automáticamente múltiples procesos.

Para verificar manualmente:
```bash
tasklist | findstr bun.exe
```

Si solo hay UNA línea, el indicador debería mostrar 🟢 Encendido.

Si el indicador muestra warning incorrectamente, puede ser un error de implementación futura.

---

## 📊 Métricas del Indicador

### Frecuencia de Actualización:
- **5 segundos** entre checks

### Timeout de Health Check:
- **3 segundos** máximo por request

### Estados Internos:
- `online`: Servidor respondiendo HTTP 200
- `offline`: Servidor no responde o error de red
- `warning`: Múltiples procesos detectados (requiere implementación adicional)

---

## 🔒 Política de Inicio del Servidor

### ✅ PERMITIDO:

- Iniciar el servidor manualmente desde la terminal
- Reiniciar el servidor cuando cambias código
- Tener UNA instancia corriendo mientras desarrollas
- Verificar el estado con el indicador del dashboard

### ❌ PROHIBIDO:

- Iniciar el servidor desde JavaScript del navegador
- Ejecutar múltiples instancias simultáneamente
- Usar scripts que inicien el servidor automáticamente
- Ignorar el indicador de múltiples procesos

---

## 📞 Soporte

Si tienes problemas con la gestión del servidor:

1. **Verifica el indicador** en `testing/index.html`
2. **Revisa los logs** de la terminal donde corre el servidor
3. **Abre la consola del navegador** (F12) y busca errores
4. **Ejecuta los comandos de verificación** de este documento
5. **Reinicia desde cero:**
   ```bash
   # 1. Matar todos los procesos
   taskkill /F /IM bun.exe

   # 2. Esperar 2 segundos
   timeout /t 2

   # 3. Iniciar una sola instancia
   bun --cwd apps/api-gateway dev

   # 4. Verificar el indicador en el dashboard
   ```

---

## 🎉 Resumen

- ✅ **Inicio manual obligatorio:** `bun --cwd apps/api-gateway dev`
- ✅ **Indicador de estado:** Monitorea el servidor en tiempo real
- ✅ **Auto-refresh:** Cada 5 segundos
- ✅ **Solo una instancia:** Verificar con `tasklist | findstr bun.exe`
- ✅ **Dashboards NO inician el servidor:** Solo se conectan a él

**El indicador de estado te ayudará a prevenir problemas de múltiples instancias y te dará visibilidad del estado del servidor en todo momento.**
