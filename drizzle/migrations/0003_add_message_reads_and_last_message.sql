-- Migration: Add lastMessage fields and message_reads table
-- Date: 2025-01-19
-- Description: Sistema granular de tracking de lecturas + campos desnormalizados lastMessage

-- ============================================
-- 1. Agregar campos lastMessage a conversations
-- ============================================

ALTER TABLE conversations
ADD COLUMN last_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
ADD COLUMN last_message_text TEXT,
ADD COLUMN last_message_type VARCHAR(50),
ADD COLUMN last_message_at TIMESTAMP;

-- ============================================
-- 2. Crear tabla message_reads (tracking granular)
-- ============================================

CREATE TABLE message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT NOW(),

  -- Constraint: un usuario solo puede marcar un mensaje como leído una vez
  UNIQUE(message_id, user_id)
);

-- ============================================
-- 3. Índices para performance
-- ============================================

-- Índices para lastMessage
CREATE INDEX idx_conversations_last_message ON conversations(last_message_id);
CREATE INDEX idx_conversations_tenant_updated ON conversations(tenant_id, updated_at DESC) WHERE status != 'archived';
CREATE INDEX idx_conversations_unread ON conversations(tenant_id, unread_count) WHERE unread_count > 0;

-- Índices para message_reads
CREATE INDEX idx_message_reads_message ON message_reads(message_id);
CREATE INDEX idx_message_reads_user ON message_reads(user_id);
CREATE INDEX idx_message_reads_composite ON message_reads(message_id, user_id);

-- Índices para paginación cursor-based
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at DESC);

-- ============================================
-- 4. Trigger para mantener lastMessage sincronizado
-- ============================================

CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Actualizar lastMessage automáticamente cuando se inserta un mensaje
  UPDATE conversations
  SET
    last_message_id = NEW.id,
    last_message_text = (NEW.content->>'text'),
    last_message_type = NEW.type,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger que ejecuta la función
CREATE TRIGGER trigger_update_conversation_last_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_last_message();

-- ============================================
-- 5. Función para recalcular unreadCount por usuario
-- ============================================

CREATE OR REPLACE FUNCTION calculate_unread_count(
  p_conversation_id UUID,
  p_user_id UUID
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Contar mensajes incoming que el usuario NO ha leído
  SELECT COUNT(*)
  INTO v_count
  FROM messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.type = 'incoming'
    AND NOT EXISTS (
      SELECT 1 FROM message_reads mr
      WHERE mr.message_id = m.id
        AND mr.user_id = p_user_id
    );

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. Migrar datos existentes (si hay)
-- ============================================

-- Poblar lastMessage con el último mensaje de cada conversación
UPDATE conversations c
SET
  last_message_id = m.id,
  last_message_text = (m.content->>'text'),
  last_message_type = m.type,
  last_message_at = m.created_at
FROM (
  SELECT DISTINCT ON (conversation_id)
    id,
    conversation_id,
    content,
    type,
    created_at
  FROM messages
  ORDER BY conversation_id, created_at DESC
) m
WHERE c.id = m.conversation_id;

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. Sistema de lecturas granular:
--    - Cada agente tiene su propio tracking de mensajes leídos
--    - unreadCount se calcula dinámicamente con calculate_unread_count()
--    - Permite: "Leído por Juan (10:30), María (10:45)"

-- 2. lastMessage desnormalizado:
--    - Se actualiza automáticamente con trigger
--    - Evita JOINs costosos en GET /sync/initial
--    - Performance: query instantáneo para listar conversaciones

-- 3. Índices críticos:
--    - idx_conversations_tenant_updated: Para GET /sync/initial
--    - idx_messages_conversation_created: Para paginación cursor
--    - idx_message_reads_composite: Para calculate_unread_count()

-- 4. Paginación cursor-based:
--    - Usar created_at en vez de OFFSET
--    - WHERE created_at < :cursor
--    - Escalable con millones de mensajes
