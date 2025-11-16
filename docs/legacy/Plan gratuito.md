sequenceDiagram
    title Flujo Gratuito - Owner-Dependent (CORREGIDO ✅)

    participant User as 👤 Usuario Final
    participant WA as 📞 WhatsApp
    participant Adapter as 🔌 Adapter Manager
    participant Gateway as 🔷 API Gateway
    participant WebClient as 🌐 Web Client (Owner)
    participant Extension as 🧠 Extension Runtime
    participant Sync as 🔄 Sync Engine
    participant Storage as 💾 Storage Engine
    participant Timer as ⏰ Timeout Manager

    Note over User, WebClient: 📩 1. MENSAJE ENTRANTE

    User->>WA: "Hola, ¿tienen stock?"
    WA->>Adapter: Webhook entrante
    Adapter->>Gateway: MessageEnvelope recibido
    Gateway->>Gateway: Verificar plan FREE
    
    rect rgba(240, 240, 255, 0.26)
    Note over Gateway, WebClient: 🔍 2. VERIFICACIÓN ESTADO OWNER
    
    alt Owner Online (WebSocket activo)
        Gateway->>WebClient: Push mensaje via WebSocket
        WebClient->>WebClient: Persistir en IndexedDB
        WebClient->>Gateway: status:received
        Gateway->>Adapter: status:received
        Adapter->>WA: status:received
        
        Note over User, WA: ✅ Usuario ve "✓✓" (entregado al sistema)
        
    else Owner Offline
        Gateway->>Sync: Mensaje pendiente
        Sync->>Storage: Guardar en Redis (key: pending:{owner_id})
        Sync->>Timer: Programar timeout 24h
        Note left of Storage: ⏱️ TTL 24 horas - Límite free tier
        
        Gateway->>Adapter: status:received (pero pendiente de procesamiento)
        Adapter->>WA: status:received
        
        Note over User, WA: ⚠️ Usuario ve "✓✓" pero negocio no responde aún
    end
    end

    rect rgba(255, 240, 240, 0.21)
    Note over WebClient, Extension: 🧠 3. PROCESAMIENTO (SOLO SI OWNER ONLINE)
    
    alt Owner Online y procesando
        WebClient->>Extension: Procesar mensaje
        Extension->>WebClient: TypingIndicator:ON
        WebClient->>Gateway: Forward typing indicator
        Gateway->>Adapter: Forward typing indicator  
        Adapter->>WA: Mostrar "✍️ escribiendo..."
        
        Extension->>WebClient: Respuesta generada
        WebClient->>WebClient: Persistir respuesta en IndexedDB
        WebClient->>Gateway: Enviar respuesta
        Gateway->>Adapter: Entregar respuesta
        Adapter->>WA: Forward respuesta
        WA->>User: Mostrar respuesta del negocio
        
        Note over WA, User: 🔄 Seguimiento estados WhatsApp
        WA->>Adapter: status:sent → status:delivered → status:read
        Adapter->>Gateway: Forward estados
        Gateway->>WebClient: Actualizar estados localmente
        
    else Owner sigue offline
        Note over Timer, Timer: ⏰ CONTADOR 24H ACTIVO...
        Timer->>Timer: Tiempo restante: 23h, 22h, 21h...
    end
    end

    rect rgba(240, 255, 240, 0.17)
    Note over Sync, Storage: 🔄 4. SINCRONIZACIÓN Y LIMPIEZA
    
    alt Owner se reconecta dentro de 24h
        WebClient->>Gateway: "Estoy online"
        Gateway->>Sync: Owner reconectado
        Sync->>Storage: Recuperar mensajes pendientes
        Storage->>Sync: Entregar cola de mensajes
        Sync->>WebClient: Sincronizar mensajes pendientes
        WebClient->>WebClient: Procesar mensajes en orden
        
        Sync->>Timer: Cancelar timeout
        Sync->>Storage: Limpiar pending:{owner_id}
        
    else Timeout 24h alcanzado
        Timer->>Sync: Timeout alcanzado (24h)
        Sync->>Storage: Eliminar pending:{owner_id}
        Sync->>Gateway: Notificar mensajes expirados
        Gateway->>Gateway: Log de mensajes perdidos
        
        Note right of Gateway: 📝 Mensajes perdidos: {count}, User: {user_id}
        Note over User, User: ❌ Usuario nunca recibe respuesta - Límite free tier
    end
    
    Sync->>OtherClients: Sincronizar estado a dispositivos secundarios
    OtherClients->>OtherClients: Persistir en IndexedDB local
    end