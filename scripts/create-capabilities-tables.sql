-- ============================================================================
-- INHOST - Sistema de Capacidades (Database Schema)
-- ============================================================================
-- Este script crea las tablas necesarias para persistir el sistema de
-- capacidades en PostgreSQL, reemplazando la lógica hardcodeada de planes.
--
-- Uso:
--   psql -h localhost -U inhost_user -d inhost -f scripts/create-capabilities-tables.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. user_capabilities - Capacidades por usuario
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Constraint: un usuario no puede tener duplicados de un servicio
    UNIQUE(user_id, service_id)
);

-- Índices para optimizar queries
CREATE INDEX IF NOT EXISTS idx_user_capabilities_user_id ON user_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_service_id ON user_capabilities(service_id);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_expires_at ON user_capabilities(expires_at);

COMMENT ON TABLE user_capabilities IS 'Capacidades y servicios habilitados por usuario';
COMMENT ON COLUMN user_capabilities.service_id IS 'ID del servicio: rate-limiting, ai-assistant, analytics, etc.';
COMMENT ON COLUMN user_capabilities.config IS 'Configuración JSONB del servicio (limits, features, metadata)';
COMMENT ON COLUMN user_capabilities.expires_at IS 'Fecha de expiración (para trials, promos)';

-- ----------------------------------------------------------------------------
-- 2. service_usage - Tracking de uso de servicios
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id VARCHAR(100) NOT NULL,
    count INTEGER DEFAULT 0,
    reset_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),

    -- Constraint: un usuario tiene un contador por servicio
    UNIQUE(user_id, service_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_service_usage_user_id ON service_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_service_usage_service_id ON service_usage(service_id);
CREATE INDEX IF NOT EXISTS idx_service_usage_reset_at ON service_usage(reset_at);

COMMENT ON TABLE service_usage IS 'Contador de uso de servicios por usuario';
COMMENT ON COLUMN service_usage.count IS 'Cantidad de uso (mensajes, llamadas AI, etc.)';
COMMENT ON COLUMN service_usage.reset_at IS 'Cuándo se resetea el contador (ventana de tiempo)';

-- ----------------------------------------------------------------------------
-- 3. capability_templates - Templates predefinidos (starter, pro, enterprise)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS capability_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    services JSONB NOT NULL,
    global_limits JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índice
CREATE INDEX IF NOT EXISTS idx_capability_templates_name ON capability_templates(name);

COMMENT ON TABLE capability_templates IS 'Templates predefinidos de capacidades (starter, professional, enterprise)';
COMMENT ON COLUMN capability_templates.services IS 'Map de servicios y sus configuraciones por defecto';

-- ----------------------------------------------------------------------------
-- 4. Insertar templates por defecto
-- ----------------------------------------------------------------------------

-- Template: Starter (equivalente a "free")
INSERT INTO capability_templates (name, description, services, global_limits) VALUES (
    'starter',
    'Basic features for getting started',
    '{
        "rate-limiting": {
            "enabled": true,
            "limits": { "rateLimit": 12 }
        },
        "persistence": {
            "enabled": true,
            "features": { "type": "memory", "retentionDays": 1 }
        },
        "notifications": {
            "enabled": true
        },
        "websocket": {
            "enabled": true,
            "limits": { "rateLimit": 12 }
        },
        "ai-assistant": {
            "enabled": false
        },
        "analytics": {
            "enabled": false
        }
    }',
    '{
        "maxConcurrentRequests": 5,
        "maxStorageBytes": 10485760,
        "maxTeamMembers": 1
    }'
) ON CONFLICT (name) DO NOTHING;

-- Template: Professional (equivalente a "premium")
INSERT INTO capability_templates (name, description, services, global_limits) VALUES (
    'professional',
    'Advanced features for power users',
    '{
        "rate-limiting": {
            "enabled": true,
            "limits": { "rateLimit": 30 }
        },
        "persistence": {
            "enabled": true,
            "features": { "type": "local", "retentionDays": 365 }
        },
        "notifications": {
            "enabled": true
        },
        "websocket": {
            "enabled": true,
            "limits": { "rateLimit": 30 }
        },
        "ai-assistant": {
            "enabled": true,
            "limits": { "quota": 1000 }
        },
        "analytics": {
            "enabled": true
        },
        "workflow": {
            "enabled": true,
            "limits": { "quota": 100 }
        }
    }',
    '{
        "maxConcurrentRequests": 20,
        "maxStorageBytes": 104857600,
        "maxTeamMembers": 10
    }'
) ON CONFLICT (name) DO NOTHING;

-- Template: Enterprise
INSERT INTO capability_templates (name, description, services, global_limits) VALUES (
    'enterprise',
    'Unlimited features for large teams',
    '{
        "rate-limiting": {
            "enabled": true,
            "limits": { "rateLimit": 100 }
        },
        "persistence": {
            "enabled": true,
            "features": { "type": "remote", "retentionDays": -1 }
        },
        "notifications": {
            "enabled": true
        },
        "websocket": {
            "enabled": true,
            "limits": { "rateLimit": 100 }
        },
        "ai-assistant": {
            "enabled": true,
            "limits": { "quota": -1 }
        },
        "analytics": {
            "enabled": true
        },
        "workflow": {
            "enabled": true,
            "limits": { "quota": -1 }
        },
        "integration": {
            "enabled": true
        },
        "custom": {
            "enabled": true,
            "limits": { "quota": -1 }
        }
    }',
    '{
        "maxConcurrentRequests": -1,
        "maxStorageBytes": -1,
        "maxTeamMembers": -1
    }'
) ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. Funciones auxiliares
-- ----------------------------------------------------------------------------

-- Función para aplicar template a usuario
CREATE OR REPLACE FUNCTION apply_template_to_user(
    p_user_id UUID,
    p_template_name VARCHAR
)
RETURNS VOID AS $$
DECLARE
    v_template RECORD;
    v_service_key TEXT;
    v_service_config JSONB;
BEGIN
    -- Obtener template
    SELECT * INTO v_template
    FROM capability_templates
    WHERE name = p_template_name AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template % not found', p_template_name;
    END IF;

    -- Eliminar capacidades existentes
    DELETE FROM user_capabilities WHERE user_id = p_user_id;

    -- Insertar servicios del template
    FOR v_service_key, v_service_config IN
        SELECT * FROM jsonb_each(v_template.services)
    LOOP
        INSERT INTO user_capabilities (user_id, service_id, enabled, config)
        VALUES (
            p_user_id,
            v_service_key,
            (v_service_config->>'enabled')::boolean,
            v_service_config
        );
    END LOOP;

    RAISE NOTICE 'Template % applied to user %', p_template_name, p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Función para incrementar uso de servicio
CREATE OR REPLACE FUNCTION increment_service_usage(
    p_user_id UUID,
    p_service_id VARCHAR,
    p_amount INTEGER DEFAULT 1,
    p_window_seconds INTEGER DEFAULT 60
)
RETURNS INTEGER AS $$
DECLARE
    v_current_count INTEGER;
    v_reset_at TIMESTAMP;
BEGIN
    v_reset_at := NOW() + (p_window_seconds || ' seconds')::INTERVAL;

    INSERT INTO service_usage (user_id, service_id, count, reset_at, last_used_at)
    VALUES (p_user_id, p_service_id, p_amount, v_reset_at, NOW())
    ON CONFLICT (user_id, service_id) DO UPDATE
    SET
        count = CASE
            WHEN service_usage.reset_at < NOW() THEN p_amount
            ELSE service_usage.count + p_amount
        END,
        reset_at = CASE
            WHEN service_usage.reset_at < NOW() THEN v_reset_at
            ELSE service_usage.reset_at
        END,
        last_used_at = NOW()
    RETURNING count INTO v_current_count;

    RETURN v_current_count;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 6. Verificar tablas creadas
-- ----------------------------------------------------------------------------
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('user_capabilities', 'service_usage', 'capability_templates')
ORDER BY table_name;

-- Mostrar templates creados
SELECT name, description, is_active FROM capability_templates ORDER BY name;

RAISE NOTICE '✅ Capability tables created successfully!';
