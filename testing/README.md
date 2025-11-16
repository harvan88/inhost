# 🧪 INHOST Testing Framework

Sistema de pruebas organizado con componentes reutilizables y diseño compacto.

## 📁 Estructura

```
testing/
├── index.html              # Dashboard principal
├── assets/
│   ├── css/
│   │   └── shared.css     # Estilos compartidos
│   └── js/
│       └── components.js  # Componentes reutilizables
├── components/            # Componentes específicos de tests
├── tests/                 # Tests individuales
│   ├── test-chat-flow-improved.html
│   └── test-sprint2-protection.html
└── README.md
```

## 🚀 Uso

1. Abre `testing/index.html` en tu navegador
2. Selecciona un test del menú lateral
3. El test se cargará en el preview

### Atajos de Teclado

- `Ctrl/Cmd + O`: Abrir test actual en nueva ventana
- `Ctrl/Cmd + R`: Recargar test actual

## 🎨 Sistema de Componentes

### Atomic Design

El framework sigue el patrón Atomic Design:

#### Atoms (Átomos)
- Badges
- Buttons
- Inputs
- Progress bars
- Stats
- Log lines

#### Molecules (Moléculas)
- Panels
- Cards
- Empty states

#### Organisms (Organismos)
- Headers
- Layouts completos

### Ejemplo de Uso

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <link rel="stylesheet" href="../assets/css/shared.css">
  <script src="../assets/js/components.js"></script>
</head>
<body>
  <div class="layout-main">
    <!-- Tu contenido aquí -->
  </div>

  <script>
    const { Atoms, Molecules, LogManager } = window.TestingFramework;

    // Crear un badge
    const badge = Atoms.badge('Active', 'success');

    // Crear un panel
    const panel = Molecules.panel('Mi Panel', 'Contenido aquí');

    // Gestionar logs
    const logger = new LogManager('logContainer', 100);
    logger.add('info', 'TEST', 'Mensaje de prueba');
  </script>
</body>
</html>
```

## 📊 Componentes Disponibles

### LogManager

Sistema de logs con auto-scroll y facilidad para copiar.

```javascript
const logger = new LogManager('containerId', maxEntries);

// Añadir log
logger.add('info', 'BADGE', 'Mensaje');

// Limpiar
logger.clear();

// Copiar todo al portapapeles
await logger.copyAll();

// Toggle auto-scroll
logger.toggleAutoScroll();
```

### StateManager

Gestión de estado reactivo.

```javascript
const state = new StateManager({ count: 0 });

// Escuchar cambios
state.subscribe('count', (newValue, oldValue) => {
  console.log(`Count changed from ${oldValue} to ${newValue}`);
});

// Actualizar
state.set('count', 1);
```

### DOMCache

Optimización de acceso al DOM.

```javascript
const cache = new DOMCache();

// Obtener elemento
const element = cache.get('myId');

// Obtener múltiples
const elements = cache.getAll(['id1', 'id2', 'id3']);
```

## 🎨 Variables CSS Disponibles

```css
/* Colors */
--bg-primary: #0d1117;
--bg-secondary: #161b22;
--bg-tertiary: #21262d;
--border: #30363d;
--text-primary: #c9d1d9;
--text-secondary: #8b949e;
--accent: #58a6ff;
--success: #3fb950;
--warning: #d29922;
--error: #da3633;

/* Spacing */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 12px;
--space-lg: 16px;

/* Typography */
--font-xs: 10px;
--font-sm: 11px;
--font-md: 12px;
--font-lg: 14px;
```

## ✨ Características

- ✅ Diseño compacto y optimizado
- ✅ Auto-scroll en logs
- ✅ Fácil de copiar logs
- ✅ Sin scroll innecesario
- ✅ Componentes reutilizables
- ✅ Tema oscuro moderno
- ✅ Máximo aprovechamiento de pantalla
- ✅ Botones y tarjetas compactas

## 🔧 Añadir Nuevo Test

1. Crea tu archivo HTML en `testing/tests/`
2. Usa los componentes compartidos:
   ```html
   <link rel="stylesheet" href="../assets/css/shared.css">
   <script src="../assets/js/components.js"></script>
   ```
3. Registra el test en `testing/index.html`:
   ```javascript
   const TESTS = {
     'mi-test': {
       name: 'Mi Test',
       description: 'Descripción del test',
       icon: '🎯',
       path: './tests/mi-test.html',
       category: 'Mi Categoría'
     }
   };
   ```

## 📝 Mejores Prácticas

1. **Optimización de Espacio**: Usa clases compactas como `.card-micro` en lugar de `.card`
2. **Logs**: Implementa LogManager para gestión automática de logs
3. **Copiar**: Los logs tienen `user-select: all` para facilitar copiar
4. **Auto-scroll**: Actívalo por defecto en logs y áreas de mensajes
5. **Componentes**: Reutiliza átomos y moléculas en lugar de crear CSS nuevo
6. **Performance**: Usa DOMCache para elementos frecuentemente accedidos

## 🎯 Criterios de Diseño

- **Sin Scroll**: Todo cabe en pantalla cuando sea posible
- **Moderno**: Diseño oscuro con acentos de color
- **Interactivo**: Botones para cada acción
- **Tiempo Real**: Logs actualizados al instante
- **Visual**: Progress bars y badges de estado
- **Compacto**: Máximo aprovechamiento del espacio
