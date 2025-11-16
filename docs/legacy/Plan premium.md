sequenceDiagram
    title Flujo Premium - Cloud-Authoritative (CORREGIDO ✅)

    participant User as 👤 Usuario Final
    participant WA as 📞 WhatsApp
    participant Adapter as 🔌 Adapter Manager
    participant Gateway as 🔷 API Gateway
    participant Virtual as ☁️ Virtual Instance
    participant Extension1 as 🤖 Extensión IA
    participant Extension2 as 📊 Extensión CRM
    participant Storage as 💾 Storage Engine
    participant WebClient1 as 🌐 Dispositivo 1
    participant WebClient2 as 🌐 Dispositivo 2

    Note over User, Virtual: 📩 1. MENSAJE ENTRANTE - PERSISTENCIA INMEDIATA

    User->>WA: "Hola, ¿tienen stock?"
    WA->>Adapter: Webhook entrante
    Adapter->>Gateway: MessageEnvelope recibido
    Gateway->>Gateway: Verificar plan PREMIUM
    Gateway->>Virtual: Replicar a instancia cloud
    
    Virtual->>Storage: Persistir en PostgreSQL (INMEDIATO)
    Virtual->>Gateway: status:received
    Gateway->>Adapter: status:received
    Adapter->>WA: status:received
    
    Note over User, WA: ✅ Usuario ve "✓✓" (entregado al sistema)

    rect rgb(240, 240, 255, 0.10)
    Note over Virtual, Extension1: 🧠 2. PROCESAMIENTO PARALELO EXTENSIONES
    
    par Procesamiento IA
        Virtual->>Extension1: Procesar con IA
        Extension1->>Virtual: TypingIndicator:ON
        Virtual->>Gateway: Broadcast typing
        Gateway->>Adapter: Forward typing
        Adapter->>WA: Mostrar "✍️ escribiendo..."
        Extension1->>Virtual: Respuesta IA generada
    and Enriquecimiento CRM
        Virtual->>Extension2: Consultar datos cliente
        Extension2->>Virtual: Datos contexto cliente
    end
    
    Virtual->>Virtual: Combinar respuestas extensiones
    Virtual->>Storage: Persistir respuesta en PostgreSQL
    end

    rect rgb(255, 240, 240, 0.10)
    Note over Virtual, WA: 📤 3. ENTREGA RESPUESTA
    
    Virtual->>Gateway: Enviar respuesta
    Gateway->>Adapter: Entregar respuesta
    Adapter->>WA: Forward respuesta
    WA->>User: Mostrar respuesta del negocio
    
    Note over WA, User: 🔄 Seguimiento estados en tiempo real
    WA->>Adapter: status:sent
    Adapter->>Gateway: status:sent
    Gateway->>Virtual: Actualizar estado:sent
    Virtual->>Storage: Persistir estado en PostgreSQL
    
    WA->>Adapter: status:delivered
    Adapter->>Gateway: status:delivered  
    Gateway->>Virtual: Actualizar estado:delivered
    Virtual->>Storage: Persistir estado en PostgreSQL
    
    WA->>Adapter: status:read
    Adapter->>Gateway: status:read
    Gateway->>Virtual: Actualizar estado:read
    Virtual->>Storage: Persistir estado en PostgreSQL
    end

    rect rgba(240, 255, 240, 0.13)
    Note over Virtual, WebClient2: 📡 4. SINCRONIZACIÓN MULTI-DISPOSITIVO TIEMPO REAL
    
    par Sync Dispositivo 1
        Virtual->>WebClient1: Broadcast mensaje + estados via WebSocket
        WebClient1->>WebClient1: Persistir en cache local (IndexedDB)
        WebClient1->>Virtual: status:sync_complete
    and Sync Dispositivo 2
        Virtual->>WebClient2: Broadcast mensaje + estados via WebSocket
        WebClient2->>WebClient2: Persistir en cache local (IndexedDB)
        WebClient2->>Virtual: status:sync_complete
    and Sync Dispositivo N
        Virtual->>OtherClients: Broadcast a todos los dispositivos
    end
    
    Virtual->>Storage: Marcar sync completado
    end

    rect rgb(255, 255, 240, 0.10)
    Note over Storage, Storage: 💾 5. BACKUP Y ALTA DISPONIBILIDAD
    
    Storage->>Storage: Backup incremental automático (cada 1h)
    Storage->>Storage: Replicación cross-region activa
    Virtual->>Virtual: Health check constante (99.9% SLA)
    
    Note right of Virtual: 🛡️ Garantía: CERO pérdida de mensajes<br/>📈 Disponibilidad 24/7/365
    end