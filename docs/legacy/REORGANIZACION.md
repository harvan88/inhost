# 📁 PROPUESTA DE REORGANIZACIÓN DE DOCUMENTACIÓN

## 🎯 Problema Actual

**16 archivos .md** en la raíz (178K total) con:
- ❌ Duplicados (SPRINT-2-TESTING-GUIDE.md vs TESTING-GUIDE-SPRINT-2.md)
- ❌ Múltiples "RESUMEN" y "SOLUCION"
- ❌ Información fragmentada
- ❌ No hay jerarquía clara

## ✅ Estructura Propuesta

```
inhost/
├── README.md                    # ✅ MANTENER - Entrada principal del proyecto
├── QUICK-START.md               # ✅ NUEVO - Consolidación de inicio rápido
│
├── docs/
│   ├── architecture/
│   │   ├── plan-modular.md      # Mover PLAN-MODULAR-INCREMENTAL.md
│   │   └── frontend-strategy.md # Mover FRONTEND-STRATEGY.md
│   │
│   ├── guides/
│   │   ├── sprint1-testing.md   # Mover PRUEBAS-SPRINT1.md
│   │   └── sprint2-testing.md   # Consolidar SPRINT-2-*.md
│   │
│   └── troubleshooting/
│       ├── cors-issues.md       # Consolidar SOLUCION-CORS + SOLUCION-RAPIDA
│       └── multiple-instances.md # SOLUCION-MULTIPLES-INSTANCIAS.md
│
└── CHANGELOG.md                 # ✅ NUEVO - Consolidar RESUMEN-* + ESTADO-ACTUAL
```

## 📋 Acciones Específicas

### 🗑️ ELIMINAR (obsoletos/duplicados):
1. ~~TESTING-GUIDE-SPRINT-2.md~~ (26K) - Duplicado de SPRINT-2-TESTING-GUIDE.md
2. ~~RESUMEN-SESION.md~~ (5.6K) - Obsoleto, info en PENDIENTES-SPRINT2.md
3. ~~SPRINT-2-DEBUG-REPORT.md~~ (5.7K) - Consolidar en sprint2-testing.md
4. ~~CONTEXT.md~~ (8.3K) - Obsoleto, info en README.md
5. ~~ESTADO-ACTUAL.md~~ (11K) - Consolidar en CHANGELOG.md

### ♻️ CONSOLIDAR:
6. **QUICK-START.md** ← Fusionar:
   - INICIO-RAPIDO.md
   - Sección "Quick start" de README.md

7. **docs/troubleshooting/cors-issues.md** ← Fusionar:
   - SOLUCION-CORS-FILE-PROTOCOL.md
   - SOLUCION-RAPIDA-FAILED-TO-FETCH.md (parte de CORS)

8. **docs/guides/sprint2-testing.md** ← Fusionar:
   - SPRINT-2-TESTING-GUIDE.md (13K - mantener este)
   - SPRINT-2-DEBUG-REPORT.md (solo problemas encontrados)
   - Sección relevante de PENDIENTES-SPRINT2.md

9. **CHANGELOG.md** ← Fusionar:
   - ESTADO-ACTUAL.md
   - RESUMEN-IMPLEMENTACION.md
   - Parte histórica de RESUMEN-SESION.md

### 📦 MOVER (sin cambios):
10. PLAN-MODULAR-INCREMENTAL.md → docs/architecture/plan-modular.md
11. FRONTEND-STRATEGY.md → docs/architecture/frontend-strategy.md
12. PRUEBAS-SPRINT1.md → docs/guides/sprint1-testing.md
13. SOLUCION-MULTIPLES-INSTANCIAS.md → docs/troubleshooting/multiple-instances.md

### ✅ MANTENER EN RAÍZ:
- README.md (actualizado con referencias a docs/)
- QUICK-START.md (nuevo, consolidado)
- PENDIENTES-SPRINT2.md (temporal, para próxima sesión)
- CHANGELOG.md (nuevo, histórico)

## 📊 Resultado Final

**Antes:** 16 archivos (178K)
**Después:** 4 en raíz + 7 en docs/ = 11 archivos (~150K)
**Reducción:** 5 archivos eliminados, 28K ahorrados, estructura clara

## 🎯 Beneficios

1. ✅ **Jerarquía clara**: Raíz solo lo esencial
2. ✅ **Sin duplicados**: Información consolidada
3. ✅ **Fácil navegación**: docs/ con subcarpetas lógicas
4. ✅ **Menos tokens**: Documentación más concisa
5. ✅ **Mantenible**: Estructura estándar de proyectos

## 🚀 Plan de Ejecución

1. Crear estructura docs/
2. Consolidar archivos nuevos
3. Mover archivos existentes
4. Eliminar obsoletos
5. Actualizar README.md con nuevo índice
