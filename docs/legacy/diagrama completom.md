graph TB
    %% CAPA CLIENTE
    subgraph ClientLayer[Capa Cliente - Inhost Web Client]
        WC[🌐 Web Client PWA]
        SW[🔧 Service Worker]
        IDB[💾 IndexedDB]
    end
    
    %% CAPA GATEWAY - PUNTO ÚNICO DE ENTRADA
    subgraph GatewayLayer[Capa Gateway - Inhost API Gateway]
        API[🔷 API Gateway]
        WS[⚡ WebSocket Hub]
        AUTH[🔐 Auth Service]
        PLAN[🎯 Plan Resolver]
    end
    
    %% CAPA SERVICIOS CORE - PROCESAMIENTO
    subgraph CoreLayer[Capa Servicios Core]
        SYNC[🔄 Sync & State Engine]
        VIRT[☁️ Virtual Chat Instance]
        EXT[🧠 Extension Runtime]
        ADAPT[🔌 Adapter Manager]
        OWNER[🔍 Owner Online Checker]
        TIMER[⏰ Timeout Manager]
    end
    
    %% CAPA PERSISTENCIA - ESTRATEGIAS POR PLAN
    subgraph DataLayer[Capa Persistencia - Unified Storage Engine]
        PG[🗄️ PostgreSQL]
        REDIS[⚡ Redis]
        STRAT[🎯 Storage Strategy Resolver]
    end
    
    %% CAPA EXTERNA - SERVICIOS DE TERCEROS
    subgraph ExternalLayer[Capa Externa]
        WA[📞 WhatsApp]
        TG[✈️ Telegram]
        IA[🤖 Extension IA]
        CRM[📊 Extension CRM]
    end

    %% =============================================
    %% CONEXIONES PRINCIPALES - SEGÚN FLUJOS VALIDADOS
    %% =============================================

    %% 🌐 CLIENTE -> GATEWAY
    WC --> API
    WC --> WS
    
    %% 🔷 GATEWAY -> CORE (DECISIÓN FREE/PREMIUM)
    API --> PLAN
    PLAN -->|PREMIUM| VIRT
    PLAN -->|FREE| SYNC
    
    %% ☁️ VIRTUAL INSTANCE (PREMIUM FLOW)
    VIRT --> EXT
    VIRT --> STRAT
    VIRT --> ADAPT
    EXT --> IA
    EXT --> CRM
    
    %% 🔄 SYNC ENGINE (FREE FLOW)  
    SYNC --> OWNER
    SYNC --> TIMER
    SYNC --> STRAT
    OWNER --> WS
    TIMER --> REDIS
    
    %% 🔌 ADAPTER MANAGER (COMÚN)
    ADAPT --> WA
    ADAPT --> TG
    ADAPT -->|ACK/Estados| API
    
    %% 💾 PERSISTENCIA
    STRAT -->|PREMIUM| PG
    STRAT -->|FREE| REDIS
    STRAT -->|CACHE| REDIS
    
    %% 🔄 SINCROnizACIÓN MULTI-DISPOSITIVO
    WS -->|Broadcast| WC
    SYNC -->|Sync States| WS

    %% =============================================
    %% CONEXIONES SECUNDARIAS
    %% =============================================
    WC -.-> IDB
    SW -.-> WC
    AUTH -.-> STRAT
    API -.-> AUTH