# FluxCoreChat - Frontend Strategy (Workspace Architecture)

**Fecha**: 2025-11-17
**Sprint**: Post-3 (Preparación Frontend Avanzado)
**Estado**: Estrategia actualizada - Workspace VS Code-style
**Versión**: 3.0 (Arquitectura de Workspace)

---

## 🎯 Visión Central

> **"FluxCoreChat no es un chat tradicional - es un workspace de productividad donde cada conversación es una pestaña y cada herramienta de negocio es un panel acoplable."**

**Metáfora:** VS Code para Chats de Comercio

### Usuario Target
Comercios que necesitan:
- Atender **múltiples clientes simultáneamente**
- Acceso rápido a **herramientas contextuales** (inventario, pedidos, cliente info)
- **Workspace personalizable** según rol (ventas, soporte, administración)
- **Flujo natural** - la interfaz se adapta al trabajo, no al revés

### Filosofía de Diseño
```typescript
const workspacePhilosophy = {
  core_concept: "Espacio de trabajo personalizable, no app de mensajería",
  user_mental_model: "Taller de herramientas, no bandeja de entrada",
  interaction_pattern: "Drag & drop, acoplamiento, personalización",
  density_strategy: "Progressive disclosure - simple a complejo"
}
```

---

## 🏗️ Arquitectura Visual (Metáfora VS Code)

```
┌─────────────────────────────────────────────────────────────────┐
│ FluxCoreChat Workspace                                          │
├───────┬─────────────────┬──────────────────────┬────────────────┤
│       │                 │                      │                │
│ Act   │  Primary        │  Editor Groups       │  Tool Panels   │
│ Bar   │  Sidebar        │  (Conversation Tabs) │  (Contextual)  │
│       │                 │                      │                │
│ [💬]  │ ┌─────────────┐ │ ┌─────┬─────┬─────┐ │ ┌────────────┐ │
│ [👤]  │ │ 🔍 Search   │ │ │Chat1│Chat2│Chat3│ │ │ 👤 Cliente │ │
│ [🛠️]  │ │             │ │ ├─────┴─────┴─────┤ │ │ Info       │ │
│ [📊]  │ │ Conversacio │ │ │                  │ │ │            │ │
│       │ │ nes (12)    │ │ │  [Chat activo]   │ │ ├────────────┤ │
│       │ │ ├─ Cliente1 │ │ │  Messages...     │ │ │ 📦 Pedidos │ │
│       │ │ ├─ Cliente2 │ │ │                  │ │ │ Recientes  │ │
│       │ │ ├─ Cliente3 │ │ │                  │ │ │            │ │
│       │ │ │            │ │ │                  │ │ ├────────────┤ │
│       │ │ Filtros:    │ │ │                  │ │ │ 📋 Quick   │ │
│       │ │ ☑ WhatsApp  │ │ │                  │ │ │ Actions    │ │
│       │ │ ☐ Telegram  │ │ │                  │ │ │            │ │
│       │ └─────────────┘ │ └──────────────────┘ │ └────────────┘ │
└───────┴─────────────────┴──────────────────────┴────────────────┘
```

### Componentes del Workspace

```typescript
interface WorkspaceLayout {
  // 1. Activity Bar (izquierda fija)
  activity_bar: {
    items: [
      { id: 'messages', icon: '💬', label: 'Mensajes' },
      { id: 'contacts', icon: '👤', label: 'Contactos' },
      { id: 'tools', icon: '🛠️', label: 'Herramientas' },
      { id: 'analytics', icon: '📊', label: 'Analytics' }
    ],
    active: 'messages'
  },

  // 2. Primary Sidebar (vista dinámica según activity)
  primary_sidebar: {
    visible: true,
    width: 280,
    content: 'ConversationList' | 'ContactDirectory' | 'ToolsPanel' | 'Analytics'
  },

  // 3. Editor Groups (pestañas de conversaciones/herramientas)
  editor_groups: {
    tabs: [
      { id: 'chat-1', type: 'conversation', label: 'Cliente A', active: true },
      { id: 'chat-2', type: 'conversation', label: 'Cliente B', active: false },
      { id: 'order-3', type: 'order', label: 'Pedido #1234', active: false }
    ],
    active_tab: 'chat-1'
  },

  // 4. Tool Panels (derecha, contextual según tab activa)
  tool_panels: {
    visible: true,
    width: 320,
    tools: [
      { id: 'customer-info', label: 'Info Cliente', collapsed: false },
      { id: 'recent-orders', label: 'Pedidos Recientes', collapsed: false },
      { id: 'quick-actions', label: 'Acciones Rápidas', collapsed: true }
    ]
  }
}
```

---

## 🔄 Flujo de Interacción

### Escenario: Atender 3 clientes simultáneamente

```typescript
// Estado inicial: Usuario en Activity "Mensajes"
workspace.activity_bar.active = 'messages';
workspace.primary_sidebar.content = 'ConversationList';

// Usuario hace click en "Cliente A" → Se abre en nueva pestaña
workspace.editor_groups.tabs.push({
  id: 'chat-1',
  type: 'conversation',
  entity: { userId: 'cliente-a', name: 'Juan Pérez' }
});

// Tool Panels se actualizan automáticamente con info de Cliente A
workspace.tool_panels.tools = [
  { id: 'customer-info', data: getCustomerInfo('cliente-a') },
  { id: 'recent-orders', data: getOrders('cliente-a') }
];

// Usuario abre "Cliente B" en segunda pestaña (Ctrl+Click o botón "Abrir en nueva pestaña")
workspace.editor_groups.tabs.push({
  id: 'chat-2',
  type: 'conversation',
  entity: { userId: 'cliente-b', name: 'María López' }
});

// Usuario cambia a pestaña "Cliente B"
workspace.editor_groups.active_tab = 'chat-2';

// Tool Panels se actualizan automáticamente con info de Cliente B
workspace.tool_panels.tools = [
  { id: 'customer-info', data: getCustomerInfo('cliente-b') },
  { id: 'recent-orders', data: getOrders('cliente-b') }
];

// Usuario hace click en "Pedido #1234" desde Tool Panel
// Se abre en nueva pestaña
workspace.editor_groups.tabs.push({
  id: 'order-1234',
  type: 'order',
  entity: { orderId: '1234' }
});
```

---

## 📊 Gestión de Estado del Workspace

### 1. Workspace State (Zustand)

```typescript
// frontend/src/state/useWorkspaceStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceTab {
  id: string;
  type: 'conversation' | 'order' | 'customer_profile' | 'tool';
  label: string;
  entityId: string;
  icon?: string;
  closable: boolean;
}

interface WorkspaceStore {
  // Activity Bar
  activeActivity: 'messages' | 'contacts' | 'tools' | 'analytics';
  setActivity: (activity: string) => void;

  // Primary Sidebar
  sidebarVisible: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;

  // Editor Groups (Tabs)
  tabs: WorkspaceTab[];
  activeTabId: string | null;
  openTab: (tab: WorkspaceTab) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Tool Panels
  panelVisible: boolean;
  panelWidth: number;
  collapsedTools: Set<string>;
  togglePanel: () => void;
  toggleTool: (toolId: string) => void;

  // Layout Persistence
  saveLayout: () => void;
  restoreLayout: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      // Estado inicial
      activeActivity: 'messages',
      sidebarVisible: true,
      sidebarWidth: 280,
      tabs: [],
      activeTabId: null,
      panelVisible: true,
      panelWidth: 320,
      collapsedTools: new Set(),

      // Acciones
      setActivity: (activity) => set({ activeActivity: activity }),

      toggleSidebar: () => set((state) => ({
        sidebarVisible: !state.sidebarVisible
      })),

      setSidebarWidth: (width) => set({ sidebarWidth: width }),

      openTab: (tab) => set((state) => {
        // Si la pestaña ya existe, activarla
        const existing = state.tabs.find(t => t.id === tab.id);
        if (existing) {
          return { activeTabId: tab.id };
        }

        // Añadir nueva pestaña
        return {
          tabs: [...state.tabs, tab],
          activeTabId: tab.id
        };
      }),

      closeTab: (tabId) => set((state) => {
        const newTabs = state.tabs.filter(t => t.id !== tabId);

        // Si cerramos la tab activa, activar la anterior
        const newActiveTab = state.activeTabId === tabId
          ? (newTabs[newTabs.length - 1]?.id || null)
          : state.activeTabId;

        return {
          tabs: newTabs,
          activeTabId: newActiveTab
        };
      }),

      setActiveTab: (tabId) => set({ activeTabId: tabId }),

      togglePanel: () => set((state) => ({
        panelVisible: !state.panelVisible
      })),

      toggleTool: (toolId) => set((state) => {
        const newCollapsed = new Set(state.collapsedTools);
        if (newCollapsed.has(toolId)) {
          newCollapsed.delete(toolId);
        } else {
          newCollapsed.add(toolId);
        }
        return { collapsedTools: newCollapsed };
      }),

      saveLayout: () => {
        // Zustand persist middleware se encarga automáticamente
      },

      restoreLayout: () => {
        // Zustand persist middleware se encarga automáticamente
      }
    }),
    {
      name: 'fluxcorechat-workspace',
      partialize: (state) => ({
        // Solo persistir layout, NO tabs (se recargan del server)
        sidebarVisible: state.sidebarVisible,
        sidebarWidth: state.sidebarWidth,
        panelVisible: state.panelVisible,
        panelWidth: state.panelWidth,
        activeActivity: state.activeActivity
      })
    }
  )
);
```

### 2. Server State por Tab (TanStack Query)

```typescript
// frontend/src/hooks/useActiveConversation.ts
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceStore } from '@/state/useWorkspaceStore';

export function useActiveConversation() {
  const { activeTabId, tabs } = useWorkspaceStore();

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Solo hacer query si la tab activa es una conversación
  const enabled = activeTab?.type === 'conversation';

  return useQuery({
    queryKey: ['conversation', activeTab?.entityId],
    queryFn: () => fetchConversation(activeTab?.entityId!),
    enabled,
    staleTime: 30 * 1000, // 30 segundos
    refetchInterval: enabled ? 5000 : false // Poll cada 5s si está activa
  });
}

// frontend/src/hooks/useCustomerInfo.ts
export function useCustomerInfo() {
  const { activeTabId, tabs } = useWorkspaceStore();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const customerId = activeTab?.type === 'conversation'
    ? activeTab.entityId
    : null;

  return useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => fetchCustomerInfo(customerId!),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000 // 5 minutos
  });
}
```

---

## 🧩 Componentes del Workspace

### 1. ActivityBar Component

```typescript
// frontend/src/components/workspace/ActivityBar.tsx
import { useWorkspaceStore } from '@/state/useWorkspaceStore';

interface Activity {
  id: string;
  icon: React.ReactNode;
  label: string;
}

const activities: Activity[] = [
  { id: 'messages', icon: <MessageSquare />, label: 'Mensajes' },
  { id: 'contacts', icon: <Users />, label: 'Contactos' },
  { id: 'tools', icon: <Wrench />, label: 'Herramientas' },
  { id: 'analytics', icon: <BarChart />, label: 'Analytics' }
];

export function ActivityBar() {
  const { activeActivity, setActivity } = useWorkspaceStore();

  return (
    <div className="w-12 bg-surface-elevated border-r border-border flex flex-col">
      {activities.map(activity => (
        <button
          key={activity.id}
          onClick={() => setActivity(activity.id)}
          className={cn(
            'h-12 flex items-center justify-center',
            'hover:bg-primary/10 transition-colors',
            activeActivity === activity.id && 'bg-primary/20 border-l-2 border-primary'
          )}
          title={activity.label}
        >
          {activity.icon}
        </button>
      ))}
    </div>
  );
}
```

### 2. PrimarySidebar Component (Vista dinámica)

```typescript
// frontend/src/components/workspace/PrimarySidebar.tsx
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { ConversationList } from './sidebars/ConversationList';
import { ContactDirectory } from './sidebars/ContactDirectory';
import { ToolsPanel } from './sidebars/ToolsPanel';

export function PrimarySidebar() {
  const { activeActivity, sidebarVisible, sidebarWidth } = useWorkspaceStore();

  if (!sidebarVisible) return null;

  return (
    <div
      className="bg-surface border-r border-border overflow-auto"
      style={{ width: `${sidebarWidth}px` }}
    >
      {activeActivity === 'messages' && <ConversationList />}
      {activeActivity === 'contacts' && <ContactDirectory />}
      {activeActivity === 'tools' && <ToolsPanel />}
      {activeActivity === 'analytics' && <AnalyticsView />}
    </div>
  );
}
```

### 3. EditorGroups Component (Tabs)

```typescript
// frontend/src/components/workspace/EditorGroups.tsx
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { ConversationTab } from './tabs/ConversationTab';
import { OrderTab } from './tabs/OrderTab';

export function EditorGroups() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useWorkspaceStore();

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="flex-1 flex flex-col">
      {/* Tab Bar */}
      <div className="h-10 bg-surface-elevated border-b border-border flex overflow-x-auto">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={cn(
              'px-4 flex items-center gap-2 border-r border-border cursor-pointer',
              'hover:bg-surface transition-colors',
              activeTabId === tab.id && 'bg-surface border-b-2 border-primary'
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span className="text-sm">{tab.label}</span>
            {tab.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-2 hover:bg-error/20 rounded p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab?.type === 'conversation' && (
          <ConversationTab conversationId={activeTab.entityId} />
        )}
        {activeTab?.type === 'order' && (
          <OrderTab orderId={activeTab.entityId} />
        )}
        {!activeTab && (
          <div className="h-full flex items-center justify-center text-text-muted">
            <p>Selecciona una conversación para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4. ToolPanels Component (Contextual)

```typescript
// frontend/src/components/workspace/ToolPanels.tsx
import { useWorkspaceStore } from '@/state/useWorkspaceStore';
import { useCustomerInfo } from '@/hooks/useCustomerInfo';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';

export function ToolPanels() {
  const { panelVisible, panelWidth, collapsedTools, toggleTool } = useWorkspaceStore();

  const { data: customer } = useCustomerInfo();
  const { data: orders } = useCustomerOrders();

  if (!panelVisible || !customer) return null;

  return (
    <div
      className="bg-surface border-l border-border overflow-auto"
      style={{ width: `${panelWidth}px` }}
    >
      {/* Customer Info Panel */}
      <ToolPanel
        id="customer-info"
        title="Información del Cliente"
        collapsed={collapsedTools.has('customer-info')}
        onToggle={() => toggleTool('customer-info')}
      >
        <CustomerInfoWidget customer={customer} />
      </ToolPanel>

      {/* Recent Orders Panel */}
      <ToolPanel
        id="recent-orders"
        title="Pedidos Recientes"
        collapsed={collapsedTools.has('recent-orders')}
        onToggle={() => toggleTool('recent-orders')}
      >
        <OrderListWidget orders={orders} />
      </ToolPanel>

      {/* Quick Actions Panel */}
      <ToolPanel
        id="quick-actions"
        title="Acciones Rápidas"
        collapsed={collapsedTools.has('quick-actions')}
        onToggle={() => toggleTool('quick-actions')}
      >
        <QuickActionsWidget customerId={customer.id} />
      </ToolPanel>
    </div>
  );
}

function ToolPanel({ id, title, collapsed, onToggle, children }) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-surface-elevated"
      >
        <span className="font-medium text-sm">{title}</span>
        <ChevronDown className={cn(
          'w-4 h-4 transition-transform',
          collapsed && '-rotate-90'
        )} />
      </button>
      {!collapsed && (
        <div className="p-4">
          {children}
        </div>
      )}
    </div>
  );
}
```

---

## 🛠️ Stack Tecnológico

### Core Framework
```
React 18 + TypeScript + Vite
├── Suspense + Lazy Loading
├── Concurrent Rendering
└── PWA capabilities
```

### Estado
```typescript
// UI State (Workspace Layout)
Zustand (1.5KB)
├── Persist middleware (layout)
└── Devtools

// Server State (Conversaciones, Clientes, Pedidos)
TanStack Query (13KB)
├── Cache inteligente
├── Background refetch
├── Optimistic updates
└── Retry logic
```

### Estilos
```
Tailwind CSS (10KB purged)
├── CSS Variables (theming)
├── shadcn/ui (componentes copiables)
└── CVA (variantes type-safe)
```

### Virtual Scroll
```
@tanstack/react-virtual (5KB)
└── Para MessageList con 1000+ mensajes
```

### Routing
```
React Router (10KB)
├── Lazy routes
└── Suspense integration
```

### Bundle Size Target
```
Initial: ~60KB (shell + workspace)
Lazy (MessageList): ~30KB
Lazy (OrdersView): ~20KB
Total: ~110KB gzipped ✅
```

---

## 🎯 Pautas de Desarrollo (Trabajo en Paralelo)

### Fase 1: Workspace Shell (4-6 horas) - **EMPEZAR AQUÍ**

**Objetivo:** Layout básico del workspace funcionando

#### 1.1 Setup Proyecto
```bash
# Crear proyecto Vite
npm create vite@latest flux-core-chat -- --template react-ts

# Instalar dependencias core
cd flux-core-chat
npm install react-router-dom@6 zustand@4 @tanstack/react-query@5

# Instalar Tailwind + shadcn/ui
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn-ui@latest init

# Instalar componentes shadcn
npx shadcn-ui@latest add button
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add input
```

#### 1.2 Crear Estructura Base
```
src/
├── components/
│   └── workspace/
│       ├── ActivityBar.tsx       # ← Empezar aquí
│       ├── PrimarySidebar.tsx
│       ├── EditorGroups.tsx
│       └── ToolPanels.tsx
├── state/
│   └── useWorkspaceStore.ts      # ← Copiar el código de arriba
├── hooks/
│   └── useActiveConversation.ts
└── App.tsx
```

#### 1.3 Implementar ActivityBar
- 4 botones (Mensajes, Contactos, Herramientas, Analytics)
- Estado activo con Zustand
- Estilos con Tailwind

#### 1.4 Implementar PrimarySidebar
- Vista dinámica según `activeActivity`
- De momento, solo placeholder para cada vista
- Ancho ajustable (bonus: drag para resize)

#### 1.5 Implementar EditorGroups
- Tab bar con pestañas dummy
- Botón "X" para cerrar tabs
- Tab activa destacada
- Content area placeholder

#### 1.6 Implementar ToolPanels
- 3 panels colapsables (Customer Info, Orders, Quick Actions)
- Estado colapsado con Zustand
- Content placeholder

**Resultado esperado:**
```
┌─────────────────────────────────────────────────────┐
│ [💬][👤][🛠️][📊] │ Sidebar │ Tabs: Chat1 Chat2 │ Tools │
│                   │         │ [Content Area]     │       │
└─────────────────────────────────────────────────────┘
```

---

### Fase 2: ConversationList + Tab Management (4-6 horas)

**Objetivo:** Poder abrir conversaciones en tabs

#### 2.1 ConversationList Component
```typescript
// src/components/workspace/sidebars/ConversationList.tsx
export function ConversationList() {
  const { data: conversations } = useConversations();
  const { openTab } = useWorkspaceStore();

  return (
    <div className="p-4">
      <input
        type="text"
        placeholder="Buscar conversaciones..."
        className="w-full mb-4"
      />

      {conversations?.map(conv => (
        <div
          key={conv.id}
          onClick={() => openTab({
            id: `chat-${conv.id}`,
            type: 'conversation',
            label: conv.customerName,
            entityId: conv.id,
            closable: true
          })}
          className="p-3 hover:bg-surface-elevated rounded cursor-pointer"
        >
          <div className="font-medium">{conv.customerName}</div>
          <div className="text-sm text-text-muted truncate">
            {conv.lastMessage}
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### 2.2 ConversationTab Component
```typescript
// src/components/workspace/tabs/ConversationTab.tsx
export function ConversationTab({ conversationId }: { conversationId: string }) {
  const { data: messages } = useMessages(conversationId);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-14 bg-surface-elevated border-b border-border px-4 flex items-center">
        <h2 className="font-medium">Chat con Cliente</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4">
        {messages?.map(msg => (
          <div key={msg.id} className="mb-4">
            <div className="message-card">
              {msg.content.text}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="h-16 bg-surface border-t border-border px-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Escribe un mensaje..."
          className="flex-1"
        />
        <button className="btn-primary">Enviar</button>
      </div>
    </div>
  );
}
```

#### 2.3 useConversations Hook (TanStack Query)
```typescript
// src/hooks/useConversations.ts
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3000/messages');
      return res.json();
    },
    refetchInterval: 5000 // Poll cada 5s
  });
}
```

**Resultado esperado:**
- Click en conversación → se abre en nueva tab
- Múltiples tabs abiertas simultáneamente
- Click en tab → cambia contenido
- Botón X → cierra tab

---

### Fase 3: Tool Panels Dinámicos (3-4 horas)

**Objetivo:** Tool panels cambian según tab activa

#### 3.1 CustomerInfoWidget
```typescript
// src/components/widgets/CustomerInfoWidget.tsx
export function CustomerInfoWidget({ customer }) {
  if (!customer) return <p>Cargando...</p>;

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-text-muted">Nombre</label>
        <p className="font-medium">{customer.name}</p>
      </div>
      <div>
        <label className="text-xs text-text-muted">Email</label>
        <p>{customer.email}</p>
      </div>
      <div>
        <label className="text-xs text-text-muted">Teléfono</label>
        <p>{customer.phone}</p>
      </div>
      <div>
        <label className="text-xs text-text-muted">Plan</label>
        <span className="badge">{customer.plan}</span>
      </div>
    </div>
  );
}
```

#### 3.2 OrderListWidget
```typescript
// src/components/widgets/OrderListWidget.tsx
export function OrderListWidget({ orders }) {
  const { openTab } = useWorkspaceStore();

  return (
    <div className="space-y-2">
      {orders?.map(order => (
        <div
          key={order.id}
          onClick={() => openTab({
            id: `order-${order.id}`,
            type: 'order',
            label: `Pedido #${order.number}`,
            entityId: order.id,
            closable: true
          })}
          className="p-2 hover:bg-surface-elevated rounded cursor-pointer"
        >
          <div className="flex justify-between">
            <span className="font-medium">#{order.number}</span>
            <span className="text-sm text-text-muted">${order.total}</span>
          </div>
          <div className="text-xs text-text-muted">{order.status}</div>
        </div>
      ))}
    </div>
  );
}
```

**Resultado esperado:**
- Customer Info se actualiza cuando cambias de tab
- Orders muestra pedidos del cliente de la tab activa
- Click en pedido → se abre en nueva tab

---

### Fase 4: WebSocket Real-time (2-3 horas)

**Objetivo:** Mensajes en tiempo real sin polling

#### 4.1 WebSocket Provider
```typescript
// src/providers/WebSocketProvider.tsx
import { createContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function WebSocketProvider({ children }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3000/realtime');

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'new_message') {
        // Invalidar query de mensajes
        queryClient.invalidateQueries({
          queryKey: ['messages', message.conversationId]
        });
      }
    };

    return () => ws.close();
  }, [queryClient]);

  return children;
}
```

---

### Fase 5: Progressive Disclosure (2-3 horas)

**Objetivo:** Interfaz simple para nuevos usuarios, compleja para avanzados

#### 5.1 Onboarding Flow
```typescript
// src/components/Onboarding.tsx
export function Onboarding() {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Bienvenido a FluxCoreChat",
      description: "Tu workspace de atención al cliente"
    },
    {
      title: "Múltiples conversaciones",
      description: "Abre conversaciones en pestañas para atender varios clientes a la vez",
      demo: <TabDemo />
    },
    {
      title: "Herramientas contextuales",
      description: "Cada conversación tiene herramientas específicas en el panel derecho",
      demo: <ToolPanelDemo />
    }
  ];

  // ... render steps
}
```

#### 5.2 Feature Discovery
```typescript
// src/components/FeatureDiscovery.tsx
export function FeatureDiscovery() {
  const { tabs } = useWorkspaceStore();
  const [showHint, setShowHint] = useState(false);

  // Mostrar hint "Abre en nueva pestaña" después del 3er mensaje
  useEffect(() => {
    if (tabs.length === 1 && /* user has sent 3+ messages */) {
      setShowHint(true);
    }
  }, [tabs]);

  return showHint && (
    <Tooltip>
      💡 Tip: Ctrl+Click para abrir en nueva pestaña
    </Tooltip>
  );
}
```

---

## 📋 Decisiones Arquitectónicas Tomadas

### ✅ Decisión 1: Zustand para Workspace State
**Por qué:** Ligero (1.5KB), simple API, persist middleware built-in
**Alternativa descartada:** Redux (demasiado boilerplate)

### ✅ Decisión 2: TanStack Query para Server State
**Por qué:** Cache inteligente, background refetch, optimistic updates
**Alternativa descartada:** SWR (menos features)

### ✅ Decisión 3: Tailwind + shadcn/ui
**Por qué:** 0KB dependency (copias código), accesibilidad built-in
**Alternativa descartada:** Material-UI (50KB demasiado pesado)

### ✅ Decisión 4: Tabs NO se persisten
**Por qué:** Mejor UX empezar con workspace limpio cada sesión
**Excepción:** Opción "Restaurar tabs" en settings (futuro)

### ✅ Decisión 5: Tool Panels siempre visibles (por defecto)
**Por qué:** Acceso rápido a herramientas es core value proposition
**Opción:** Usuario puede ocultarlos (estado persiste)

---

## 🎯 Métricas de Éxito

### Para el Usuario
> "Puedo atender 3 clientes simultáneamente sin perder el contexto, con todas mis herramientas a un click de distancia."

### Performance Targets
```
First Contentful Paint: <800ms
Time to Interactive: <2s
Workspace Shell: <60KB gzipped
Full Bundle: <110KB gzipped
```

### Flujo Ideal
```
0s:     Usuario abre FluxCoreChat
0.5s:   Workspace shell renderizado
1s:     Conversaciones cargadas en sidebar
1.5s:   Primera conversación lista para abrir
2s:     Usuario puede trabajar fluidamente
```

---

## 🔗 Referencias

### Código Backend (Consumir)
- [MessageEnvelopeV2](../../packages/shared/src/types/MessageEnvelopeV2.ts) - Schema de mensajes
- [WebSocket /realtime](../../apps/api-gateway/src/routes/websocket.ts) - Endpoint real-time
- [POST /messages](../../apps/api-gateway/src/routes/messages.ts) - Enviar mensajes
- [GET /messages](../../apps/api-gateway/src/routes/messages.ts) - Obtener historial

### Inspiración Visual
- [VS Code UI](https://code.visualstudio.com/) - Activity Bar, Sidebar, Editor Groups
- [Linear App](https://linear.app/) - Workspace management, keyboard shortcuts
- [Slack](https://slack.com/) - Multi-workspace, thread management

### Documentación Técnica
- [React 18 Docs](https://react.dev/)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [TanStack Query](https://tanstack.com/query/latest)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## 🚀 Próximos Pasos

1. **Ahora:** Implementar Fase 1 (Workspace Shell) - 4-6 horas
2. **Luego:** Fase 2 (ConversationList + Tabs) - 4-6 horas
3. **Después:** Fase 3 (Tool Panels dinámicos) - 3-4 horas
4. **Finalmente:** Fase 4 (WebSocket) + Fase 5 (Progressive Disclosure) - 4-6 horas

**Total estimado:** 15-22 horas para MVP funcional

---

**Estado**: ✅ Estrategia actualizada con visión de workspace
**Versión**: 3.0 (Workspace Architecture)
**Última actualización**: 2025-11-17
**Preparado por**: Claude Code
