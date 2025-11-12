-- Crear tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id VARCHAR(255) NOT NULL,
    participant VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web', 'sms')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('incoming', 'outgoing', 'system', 'status')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('whatsapp', 'telegram', 'web', 'sms')),
    content JSONB NOT NULL,
    metadata JSONB NOT NULL,
    status_chain JSONB DEFAULT '[]',
    context JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    plan VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_conversations_owner_id ON conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant ON conversations(participant);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';