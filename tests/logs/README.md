# 📊 Logs de Observabilidad

Esta carpeta contiene logs detallados generados durante pruebas y debugging.

## 🎯 ¿Qué son estos logs?

Los logs de observabilidad capturan **cada paso** del flujo de mensajería:
- 📱 Adapter recibe mensaje
- 📦 MessageCore procesa
- 💾 PostgreSQL persiste
- 📡 WebSocket notifica
- 🌐 HTTP responde

## ⚙️ Cómo activar los logs

### Opción 1: Variable de entorno

```bash
# Activar logging detallado
OBSERVE=true bun --cwd apps/api-gateway dev

# O con tests
OBSERVE=true bun run test:messaging
```

### Opción 2: NODE_ENV=test

```bash
# Los logs se activan automáticamente en modo test
NODE_ENV=test bun run test:messaging
```

### Opción 3: LOG_LEVEL=debug

```bash
LOG_LEVEL=debug bun --cwd apps/api-gateway dev
```

## 📝 Formato de logs

### Console Output (con colores y emojis):

```
📱 [ADAPTER] Mensaje recibido del chat simulado
{
  "from": "+1234567890",
  "text": "Hola mundo"
}

📦 [CORE] Procesando mensaje
{
  "id": "abc-123",
  "type": "incoming"
}

💾 [PERSISTENCE] Guardando en PostgreSQL
✅ Mensaje guardado exitosamente
```

### File Output (JSON para análisis):

Archivo: `tests/logs/session-2025-11-19T14-30-00-000Z.log`

```json
{"timestamp":"2025-11-19T14:30:00.123Z","component":"adapter","level":"info","message":"Mensaje recibido del chat simulado","data":{"from":"+1234567890"}}
{"timestamp":"2025-11-19T14:30:00.156Z","component":"core","level":"info","message":"Procesando mensaje","data":{"id":"abc-123"}}
{"timestamp":"2025-11-19T14:30:00.234Z","component":"persistence","level":"info","message":"Guardando en PostgreSQL"}
```

## 🔍 Análisis de logs

### Ver logs en tiempo real:

```bash
tail -f tests/logs/session-*.log
```

### Buscar errores:

```bash
grep "error" tests/logs/session-*.log
```

### Contar mensajes por componente:

```bash
grep -o '"component":"[^"]*"' tests/logs/session-*.log | sort | uniq -c
```

### Ver logs formateados:

```bash
cat tests/logs/session-*.log | jq .
```

## 🧹 Limpieza

Los logs se acumulan con cada ejecución. Para limpiar:

```bash
# Limpiar todos los logs
rm tests/logs/*.log

# Limpiar logs antiguos (más de 7 días)
find tests/logs -name "*.log" -mtime +7 -delete
```

## 📚 Uso en código

```typescript
import { observeLog } from './utils/observability-logger';

// Logs por componente
observeLog.adapter('Mensaje recibido', { from: '+123' });
observeLog.core('Procesando mensaje', { id: 'abc' });
observeLog.persistence('Guardando en DB', { id: 'abc' });
observeLog.websocket('Broadcasting', { clients: 5 });
observeLog.http('Request recibido', { method: 'POST' });

// Helpers visuales
observeLog.separator('INICIO DEL FLUJO');
observeLog.step(1, 'Recibir mensaje del adapter');
observeLog.success('Mensaje persistido correctamente');
observeLog.error('Fallo al conectar a base de datos');

// Check estado
if (observeLog.isEnabled()) {
  console.log('Logging activo, log file:', observeLog.getLogPath());
}
```

## 🎯 Ejemplos de uso

### Durante desarrollo:

```bash
# Activar logs y correr servidor
OBSERVE=true bun --cwd apps/api-gateway dev

# En otra terminal, enviar request de prueba
curl -X POST http://localhost:3000/messages \
  -H "Content-Type: application/json" \
  -d '{"type":"incoming","channel":"whatsapp",...}'

# Ver logs en tiempo real
tail -f tests/logs/session-*.log
```

### Durante tests:

```bash
# Los tests automáticamente activan logging
bun run test:messaging

# Ver el log generado
cat tests/logs/session-*.log | jq .
```

### Debugging producción:

```bash
# Activar logs temporalmente sin cambiar código
OBSERVE=true bun start

# Revisar logs después
cat tests/logs/session-*.log | grep -A 5 "error"
```

## 💡 Tips

1. **No commits logs**: Los archivos `.log` están en `.gitignore`
2. **Session ID**: Cada ejecución crea un archivo con timestamp único
3. **JSON parseable**: Los logs en archivo son JSON line-delimited
4. **Zero overhead**: Si `OBSERVE` no está activo, los logs no hacen nada
5. **Producción**: Mantén `OBSERVE=false` en producción (por defecto)

## 📋 Nombre de archivos

```
session-2025-11-19T14-30-00-000Z.log
        └─────┬──────┘ └──┬─┘ └┬┘ └┬┘
              │           │    │   │
          Fecha         Hora  Min Ms
```

Cada sesión genera un archivo único identificable por timestamp.
