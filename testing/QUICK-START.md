# 🚀 Quick Start - INHOST Testing Framework

## Inicio Rápido (30 segundos)

1. **Abrir el Dashboard**
   ```
   Abre: testing/index.html
   ```

2. **Selecciona un test** del menú lateral

3. **¡Listo!** El test se carga automáticamente

---

## 📝 Crear Nuevo Test (5 minutos)

### Opción 1: Usar el Template

```bash
# Copiar template
cp testing/components/template.html testing/tests/mi-nuevo-test.html
```

### Opción 2: Desde Cero

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Mi Test</title>
  <link rel="stylesheet" href="../assets/css/shared.css">
  <script src="../assets/js/components.js"></script>
</head>
<body>
  <div class="layout-main">
    <header class="header-main">
      <h1 class="header-title">🎯 Mi Test</h1>
    </header>

    <div style="padding: var(--space-sm);">
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Test Content</div>
        </div>
        <div class="panel-content" id="log"></div>
      </div>
    </div>
  </div>

  <script>
    const { LogManager } = window.TestingFramework;
    const logger = new LogManager('log');
    logger.add('info', 'TEST', 'Test iniciado');
  </script>
</body>
</html>
```

### Registrar en Dashboard

Edita `testing/index.html` y añade:

```javascript
const TESTS = {
  // ... tests existentes
  'mi-test': {
    name: 'Mi Nuevo Test',
    description: 'Descripción breve',
    icon: '🎯',
    path: './tests/mi-nuevo-test.html',
    category: 'Mi Categoría'
  }
};
```

---

## 🎨 Componentes Más Usados

### 1. Log Manager (Auto-scroll logs)

```javascript
const logger = new LogManager('logContainerId');
logger.add('info', 'TAG', 'Mensaje');
logger.add('success', 'TAG', 'Éxito');
logger.add('error', 'TAG', 'Error');
logger.clear();
await logger.copyAll(); // Copiar todo al portapapeles
```

### 2. Badges

```javascript
const { Atoms } = window.TestingFramework;
Atoms.badge('Active', 'success');  // Verde
Atoms.badge('Error', 'error');     // Rojo
Atoms.badge('Waiting', 'warning'); // Amarillo
Atoms.badge('Info', 'info');       // Azul
```

### 3. Buttons

```javascript
Atoms.button('Click me', {
  onclick: 'myFunction()',
  type: 'primary',
  size: 'sm'
});
```

### 4. Panels

```javascript
const { Molecules } = window.TestingFramework;
Molecules.panel('Título', 'Contenido aquí', {
  actions: '<button class="btn btn-sm">Acción</button>'
});
```

### 5. Cards Compactas

```javascript
Molecules.cardMicro('Título', {
  icon: '🎯',
  badge: Atoms.badge('Active', 'success'),
  meta: 'Info adicional',
  actions: Atoms.button('Ejecutar', { onclick: 'run()' })
});
```

---

## 📊 Layouts Comunes

### Layout 3 Columnas (Sidebar-Content-Sidebar)

```html
<div style="display: grid; grid-template-columns: 250px 1fr 250px; gap: 8px; padding: 8px; height: calc(100vh - 48px);">
  <aside class="panel"><!-- Izquierda --></aside>
  <main class="panel"><!-- Centro --></main>
  <aside class="panel"><!-- Derecha --></aside>
</div>
```

### Layout 2 Columnas

```html
<div class="grid-compact sidebar-right" style="padding: 8px;">
  <main class="panel"><!-- Principal --></main>
  <aside class="panel"><!-- Sidebar --></aside>
</div>
```

---

## ⌨️ Atajos de Teclado (Dashboard)

- `Ctrl/Cmd + O` - Abrir test en nueva ventana
- `Ctrl/Cmd + R` - Recargar test actual

---

## 💡 Tips

### ✅ Auto-scroll en Logs
```javascript
const logger = new LogManager('log');
// Auto-scroll está ON por defecto
logger.autoScroll = true;
```

### ✅ Copiar Logs Fácilmente
Los logs tienen `user-select: all` - solo haz click y Ctrl+C

### ✅ Estado Reactivo
```javascript
const state = new StateManager({ count: 0 });
state.subscribe('count', (newVal) => {
  document.getElementById('count').textContent = newVal;
});
state.set('count', 5); // UI se actualiza automáticamente
```

### ✅ Cache de DOM
```javascript
const cache = new DOMCache();
const el = cache.get('myId'); // Cachea el elemento
```

---

## 🎯 Checklist de Nuevo Test

- [ ] Copiar template o crear desde cero
- [ ] Usar `shared.css` y `components.js`
- [ ] Implementar LogManager para logs
- [ ] Diseño compacto (sin scroll innecesario)
- [ ] Auto-scroll en logs activo
- [ ] Registrar en `index.html`
- [ ] Probar en dashboard
- [ ] Probar en nueva ventana

---

## 🆘 Problemas Comunes

**¿Los estilos no cargan?**
```html
<!-- Asegúrate de tener la ruta correcta -->
<link rel="stylesheet" href="../assets/css/shared.css">
```

**¿Los componentes no funcionan?**
```html
<!-- Incluye el script ANTES de usar los componentes -->
<script src="../assets/js/components.js"></script>
```

**¿El log no aparece?**
```javascript
// Asegúrate de que el ID del contenedor coincide
const logger = new LogManager('logContainerId'); // ← Este ID debe existir en el HTML
```

---

## 📚 Más Info

Ver [README.md](./README.md) para documentación completa.
