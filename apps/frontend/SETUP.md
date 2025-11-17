# INHOST Frontend - Guía de Instalación

## 📥 Descarga a Local

### Opción 1: Clonar el repositorio completo

```bash
git clone <repository-url> inhost
cd inhost
git checkout claude/new-separate-module-019dLLXQs26MCwdzvWL1bteU
```

### Opción 2: Pull desde repositorio existente

Si ya tienes el repo clonado:

```bash
cd inhost
git fetch origin
git checkout claude/new-separate-module-019dLLXQs26MCwdzvWL1bteU
git pull origin claude/new-separate-module-019dLLXQs26MCwdzvWL1bteU
```

## 🚀 Instalación y Ejecución

### 1. Instalar dependencias (desde la raíz del monorepo)

```bash
cd inhost
bun install
```

Esto instalará todas las dependencias de:
- Root workspace
- `apps/api-gateway`
- `apps/frontend` ← **Nuevo**
- `packages/shared`

### 2. Iniciar el API Gateway (Terminal 1)

El frontend **NECESITA** que el backend esté corriendo:

```bash
# Opción A: Script de inicio (Windows)
start-server.bat

# Opción B: Comando directo
bun --cwd apps/api-gateway dev

# Opción C: Desde la raíz
bun run dev:api
```

Deberías ver:
```
🦊 Elysia is running at http://localhost:3000
```

### 3. Iniciar el Frontend (Terminal 2)

```bash
# Opción A: Comando directo
bun --cwd apps/frontend dev

# Opción B: Desde la raíz
bun run dev:frontend
```

Deberías ver:
```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### 4. Abrir en el navegador

Abre tu navegador en: **http://localhost:5173**

## 🔧 Verificación

### Check 1: API Gateway está corriendo

```bash
curl http://localhost:3000/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T..."
}
```

### Check 2: Frontend cargó correctamente

Abre `http://localhost:5173` y deberías ver:
- ✅ Header con logo "INHOST"
- ✅ 3 tarjetas de estado (API Status, WebSocket, Messages)
- ✅ Sección de mensajes
- ✅ Input para enviar mensajes

### Check 3: Conexión API funciona

1. En el navegador, abre DevTools (F12)
2. Ve a la pestaña **Network**
3. Envía un mensaje desde el input
4. Deberías ver una petición a `/api/messages` con status `200`

## 📂 Estructura del Proyecto

```
inhost/
├── apps/
│   ├── api-gateway/        # ← Existente (no tocado)
│   └── frontend/           # ← NUEVO ✨
│       ├── public/
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   ├── services/
│       │   ├── hooks/
│       │   ├── types/
│       │   ├── styles/
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       └── README.md
├── packages/
│   └── shared/             # ← Existente (no tocado)
└── package.json            # ← Actualizado (scripts)
```

## 🎯 Scripts Disponibles

### Desde la raíz del monorepo:

```bash
# Desarrollo
bun run dev:frontend       # Solo frontend
bun run dev:api           # Solo API
bun run dev               # Ambos en paralelo (API + Frontend + DB)

# Build
bun run build:frontend    # Compilar frontend
bun run build:api         # Compilar API
bun run build             # Compilar todo

# Type checking
bun run type-check        # Verificar tipos
```

### Desde apps/frontend/:

```bash
bun dev                   # Iniciar dev server
bun build                 # Compilar para producción
bun preview               # Vista previa del build
bun type-check            # Verificar tipos TypeScript
```

## 🐛 Troubleshooting

### Error: "Failed to fetch"

**Causa:** API Gateway no está corriendo

**Solución:**
```bash
# Terminal 1
bun --cwd apps/api-gateway dev
```

### Error: "Cannot find module '@components/...'"

**Causa:** Aliases de TypeScript no configurados

**Solución:**
```bash
# Reinstalar dependencias
rm -rf node_modules apps/frontend/node_modules
bun install
```

### Puerto 5173 ya está en uso

**Causa:** Otra instancia de Vite corriendo

**Solución:**
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:5173 | xargs kill
```

### WebSocket no conecta

**Causa:** El WebSocket está implementado en Sprint 3 (puede no estar disponible aún)

**Nota:** El frontend está preparado para WebSocket pero funcionará sin él mostrando "Disconnected" en la tarjeta de estado.

## 🌐 Configuración de Proxy (Vite)

El frontend usa un proxy de Vite para conectarse al backend:

```typescript
// vite.config.ts
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

Esto significa:
- `fetch('/api/health')` → redirige a → `http://localhost:3000/health`
- `fetch('/api/messages')` → redirige a → `http://localhost:3000/messages`

## 📦 Dependencias Instaladas

**Producción:**
- `react` ^18.2.0
- `react-dom` ^18.2.0
- `@inhost/shared` (workspace)

**Desarrollo:**
- `vite` ^5.0.8
- `@vitejs/plugin-react` ^4.2.1
- `typescript` ^5.3.3
- `tailwindcss` ^3.3.6
- `@types/react` ^18.2.43
- `@types/react-dom` ^18.2.17

## ✅ Checklist de Instalación Exitosa

- [ ] `bun install` ejecutado desde raíz
- [ ] API Gateway corriendo en `http://localhost:3000`
- [ ] Frontend corriendo en `http://localhost:5173`
- [ ] Dashboard visible en el navegador
- [ ] Status "API Status: ok" visible
- [ ] Puedes enviar un mensaje de prueba
- [ ] Network tab muestra peticiones exitosas (200)

## 🚀 Próximos Pasos

Una vez instalado, puedes:

1. **Explorar el código:** Empieza por `src/App.tsx` y `src/pages/Dashboard.tsx`
2. **Crear nuevos componentes:** Agrega archivos en `src/components/`
3. **Agregar páginas:** Crea nuevas rutas en `src/pages/`
4. **Customizar estilos:** Modifica `tailwind.config.js`
5. **Extender la API:** Actualiza `src/services/api.ts`

Ver [README.md](README.md) para más información sobre el desarrollo.

---

**¿Problemas?** Abre un issue o revisa la documentación completa en el README.
