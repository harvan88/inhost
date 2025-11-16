# Descripciones Semánticas de la Arquitectura Inhost

## 📋 **planarquitectonico.md** - Arquitectura Principal del Sistema

### **Propósito y Contexto**
Define la arquitectura completa del sistema de mensajería Inhost, estableciendo los principios fundamentales, componentes y flujos que permiten la gestión unificada de conversaciones multi-plataforma.

### **Conceptos Clave Definidos**

**Arquitectura por Capas:**
- **Capa Cliente**: Aplicación PWA basada en Web Components
- **Capa Gateway**: Punto único de entrada con resolución de planes
- **Capa Core**: Procesamiento de negocio y lógica de sincronización
- **Capa Persistencia**: Estrategias diferenciadas por plan de servicio
- **Capa Externa**: Conectores a plataformas de mensajería y extensiones

**Modelo de Servicio Dual:**
- **Free Tier**: Modelo "owner-dependent" con persistencia cliente-side
- **Premium Tier**: Modelo "cloud-authoritative" con persistencia completa

### **Componentes Arquitectónicos Críticos**

**Sync & State Engine**: Motor de sincronización que implementa estrategias diferentes según el plan:
- Free: Sincronización P2P dependiente del dispositivo owner
- Premium: Sincronización cloud-authoritative en tiempo real

**Storage Strategy Resolver**: Componente que decide la estrategia de persistencia basado en el plan del usuario, dirigiendo datos a PostgreSQL (premium) o Redis temporal (free).

**Virtual Chat Instance**: Instancia cloud 24/7 exclusiva para usuarios premium que garantiza procesamiento continuo independiente de la conectividad del cliente.

### **Flujos de Datos Esenciales**
1. **Mensaje Entrante** → Resolución de Plan → Procesamiento según estrategia → Persistencia diferenciada
2. **Sincronización Multi-dispositivo** → Estrategia según plan → Broadcast selectivo → Confirmación
3. **Estados de Mensaje** → Cadena completa de estados → Persistencia según importancia → Sync cross-dispositivo

---

## 🔧 **stack tecnológico.md** - Stack de Implementación

### **Contexto Tecnológico**
Especifica el stack tecnológico concreto seleccionado para implementar la arquitectura definida, priorizando eficiencia, type-safety y desarrollo unificado.

### **Stack Definitivo Confirmado**

**Runtime Unificado:**
- **Bun 1.0+**: Runtime único para frontend y backend
- **TypeScript Nativo**: Type-safety end-to-end sin configuración compleja
- **Package Manager Integrado**: Bun install para dependencias

**Frontend Especializado:**
- **EliSya Framework**: Framework propio para componentes de UI
- **EliSya Store**: State management optimizado para estados de chat
- **EliSya DB**: Wrapper de IndexedDB para persistencia cliente
- **Build Tooling**: Bun + Vite para builds optimizados

**Backend Type-Safe:**
- **Elysia.js**: Framework backend con tipado end-to-end
- **Eden (tRPC)**: Comunicación type-safe entre cliente y servidor
- **Drizzle ORM**: ORM type-safe para PostgreSQL
- **WebSocket Nativo**: Implementación via Bun.serve

### **Estructura de Desarrollo**
- **Monorepo con Bun Workspaces**: Separación lógica de componentes
- **Docker Compose**: Infraestructura de desarrollo unificada
- **Hot Reload Nativo**: Desarrollo ágil sin configuraciones complejas

---

## 🏗️ **diagrama completom.md** - Topología del Sistema

### **Representación Visual de la Arquitectura**
Diagrama Mermaid que define las conexiones y relaciones entre componentes, mostrando los flujos diferenciados entre planes free y premium.

### **Puntos de Decisión Clave**

**Plan Resolver**: Componente crítico que determina el flujo de procesamiento:
- **Ruta Premium**: Mensajes dirigidos a Virtual Instance
- **Ruta Free**: Mensajes dirigidos a Sync Engine con verificación de owner

**Conexiones de Persistencia:**
- **Estrategia Premium**: PostgreSQL como almacenamiento primario
- **Estrategia Free**: Redis como almacenamiento temporal con TTL
- **Cache Común**: Redis compartido para ambos planes

### **Flujos de Control**
- **WebSocket Hub**: Centraliza comunicación real-time bidireccional
- **Owner Online Checker**: Verifica conectividad del dispositivo principal (free)
- **Timeout Manager**: Gestiona expiración de mensajes pendientes (free)

---

## 🆓 **Plan gratuito.md** - Flujo Free Tier

### **Modelo Operativo Free**
Define el comportamiento del sistema para usuarios free, caracterizado por dependencia del dispositivo owner y persistencia temporal.

### **Mecanismos Específicos Free**

**Owner-Dependent Processing:**
- Los mensajes solo se procesan cuando el dispositivo owner está online
- WebSocket activo requerido para procesamiento en tiempo real
- Cola temporal en Redis con TTL de 24 horas para mensajes pendientes

**Límites Operativos:**
- **Timeout de 24h**: Mensajes no procesados expiran después de 24 horas
- **Persistencia Cliente-side**: IndexedDB como almacenamiento primario
- **Sincronización P2P**: Dispositivos secundarios sincronizan via owner

### **Estados de Mensaje Free**
- Estados básicos de entrega (received, sent, delivered, read)
- Indicadores de typing durante procesamiento activo
- Sincronización best-effort entre dispositivos

---

## 💎 **Plan premium.md** - Flujo Premium Tier

### **Modelo Operativo Premium**
Define el comportamiento premium con procesamiento cloud-authoritative, persistencia garantizada y alta disponibilidad.

### **Características Premium Exclusivas**

**Procesamiento Cloud-Authoritative:**
- **Virtual Instance 24/7**: Procesamiento continuo independiente de dispositivos
- **Persistencia Inmediata**: Escritura sincrónica en PostgreSQL
- **Procesamiento Paralelo**: Múltiples extensiones ejecutando simultáneamente

**Garantías de Servicio:**
- **Alta Disponibilidad**: 99.9% SLA con health checks constantes
- **Cero Pérdida de Datos**: Persistencia inmediata + backups automáticos
- **Sincronización Instantánea**: Broadcast real-time a todos los dispositivos

**Funcionalidades Avanzadas:**
- **Estados Extendidos**: Estados avanzados (edited, deleted, recalled, forwarded)
- **Enriquecimiento Paralelo**: Múltiples extensiones procesando simultáneamente
- **Backup Automático**: Incremental cada hora + replicación cross-region

### **Flujo de Datos Premium**
Mensaje → Persistencia Inmediata (PostgreSQL) → Procesamiento Paralelo (Extensiones) → Broadcast Multi-dispositivo → Confirmación → Backup Automático

---

## 🎯 **Resumen Semántico Unificado**

La arquitectura Inhost implementa un **sistema dual de mensajería** donde:

1. **Free Tier** opera bajo modelo **owner-dependent** con persistencia cliente-side y sincronización P2P
2. **Premium Tier** opera bajo modelo **cloud-authoritative** con persistencia server-side garantizada

**Diferenciadores Clave:**
- Mismo stack tecnológico (Bun + EliSya + Elysia) para ambos planes
- Estrategias de persistencia y sincronización radicalmente diferentes
- Experiencia de usuario profesional con estados completos de mensaje
- Extensibilidad via contrato HTTP estándar para cualquier lenguaje

**Garantías Arquitectónicas:**
- Free Tier: Costos operativos cercanos a cero
- Premium Tier: Alta disponibilidad y cero pérdida de datos
- Ambos: Experiencia de usuario cohesiva con diferenciación clara en capacidades avanzadas