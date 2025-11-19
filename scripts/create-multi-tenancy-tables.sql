-- ============================================================================
-- INHOST Multi-Tenancy Schema
-- ============================================================================
--
-- Este script crea las tablas para soportar multi-tenancy:
-- - tenants: Organizaciones que compran el servicio
-- - tenant_users: Empleados/admins de cada organización
-- - end_users: Clientes finales que chatean
-- - tenant_capabilities: Capabilities a nivel organización
-- - tenant_usage: Usage tracking por tenant
--
-- Ejecutar: psql -h localhost -U inhost_user -d inhost -f scripts/create-multi-tenancy-tables.sql
-- ============================================================================

-- Crear extensión UUID si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TENANTS (Organizaciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificación
    name VARCHAR(255) NOT NULL,                          -- "Tienda XYZ"
    slug VARCHAR(255) UNIQUE NOT NULL,                   -- "tienda-xyz" (URL-friendly)
    email VARCHAR(255) NOT NULL,                         -- Contact email

    -- Plan y Subscription
    plan VARCHAR(50) NOT NULL DEFAULT 'starter'          -- 'starter', 'professional', 'enterprise'
        CHECK (plan IN ('starter', 'professional', 'enterprise')),
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'trial'  -- 'trial', 'active', 'suspended', 'cancelled'
        CHECK (subscription_status IN ('trial', 'active', 'suspended', 'cancelled')),
    trial_ends_at TIMESTAMP,                             -- Fin del trial

    -- Facturación
    billing_email VARCHAR(255),                          -- Email para facturas
    billing_address JSONB,                               -- { street, city, country, zip, tax_id }

    -- Configuración
    settings JSONB DEFAULT '{}'::jsonb,                  -- Configuración de la organización
    metadata JSONB DEFAULT '{}'::jsonb,                  -- Metadata custom

    -- Limits (opcional, override de plan)
    limits JSONB,                                        -- { max_end_users, max_messages_per_month, ... }

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP                                 -- Soft delete
);

-- Índices para tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email);
CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status ON tenants(subscription_status);
CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at ON tenants(deleted_at);

-- ============================================================================
-- 2. TENANT_USERS (Empleados/Admins de organizaciones)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relación con tenant
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identificación
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),

    -- Autenticación
    password_hash VARCHAR(255),                          -- Bcrypt hash

    -- Rol y Permisos
    role VARCHAR(50) NOT NULL DEFAULT 'agent'            -- 'owner', 'admin', 'agent', 'viewer'
        CHECK (role IN ('owner', 'admin', 'agent', 'viewer')),
    permissions JSONB DEFAULT '[]'::jsonb,               -- Permisos custom

    -- Estado
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP                                 -- Soft delete
);

-- Índices para tenant_users
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(role);

-- ============================================================================
-- 3. END_USERS (Clientes finales que chatean)
-- ============================================================================

CREATE TABLE IF NOT EXISTS end_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relación con tenant
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Identificación
    phone VARCHAR(50),                                   -- +52123456789
    email VARCHAR(255),                                  -- Opcional
    name VARCHAR(255),                                   -- Nombre del cliente

    -- Canal principal
    primary_channel VARCHAR(50)                          -- 'whatsapp', 'telegram', 'web', 'sms'
        CHECK (primary_channel IN ('whatsapp', 'telegram', 'web', 'sms', 'email')),

    -- Identificadores externos
    external_id VARCHAR(255),                            -- ID en sistema del tenant
    whatsapp_id VARCHAR(255),                            -- WhatsApp Business API ID
    telegram_id VARCHAR(255),                            -- Telegram user ID

    -- Metadata custom del tenant
    custom_fields JSONB DEFAULT '{}'::jsonb,             -- Campos custom definidos por tenant
    tags JSONB DEFAULT '[]'::jsonb,                      -- Tags/etiquetas

    -- Estado
    is_active BOOLEAN DEFAULT true,
    blocked BOOLEAN DEFAULT false,                       -- Bloqueado por spam/abuse
    last_interaction_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP                                 -- Soft delete
);

-- Índices para end_users
CREATE INDEX IF NOT EXISTS idx_end_users_tenant_id ON end_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_end_users_phone ON end_users(phone);
CREATE INDEX IF NOT EXISTS idx_end_users_email ON end_users(email);
CREATE INDEX IF NOT EXISTS idx_end_users_external_id ON end_users(external_id);
CREATE INDEX IF NOT EXISTS idx_end_users_primary_channel ON end_users(primary_channel);
CREATE INDEX IF NOT EXISTS idx_end_users_last_interaction ON end_users(last_interaction_at);

-- Constraint: Al menos phone o email debe existir
ALTER TABLE end_users ADD CONSTRAINT end_users_phone_or_email_required
    CHECK (phone IS NOT NULL OR email IS NOT NULL);

-- ============================================================================
-- 4. TENANT_CAPABILITIES (Capabilities a nivel organización)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relación con tenant
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Servicio/Extension
    service_id VARCHAR(100) NOT NULL,                    -- 'ai-assistant', 'analytics', etc.

    -- Estado
    enabled BOOLEAN DEFAULT true,

    -- Configuración
    config JSONB NOT NULL DEFAULT '{}'::jsonb,           -- Config específica del servicio

    -- Limits específicos (override de template)
    limits JSONB,                                        -- { quota, rate_limit, ... }

    -- Expiración (para trials)
    expires_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices y constraints para tenant_capabilities
CREATE INDEX IF NOT EXISTS idx_tenant_capabilities_tenant_id ON tenant_capabilities(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_capabilities_service_id ON tenant_capabilities(service_id);
CREATE INDEX IF NOT EXISTS idx_tenant_capabilities_expires_at ON tenant_capabilities(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_capabilities_tenant_service
    ON tenant_capabilities(tenant_id, service_id);

-- ============================================================================
-- 5. TENANT_USAGE (Usage tracking por tenant)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Relación con tenant
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Servicio
    service_id VARCHAR(100) NOT NULL,                    -- 'ai-assistant', 'analytics', etc.

    -- Uso
    count INTEGER DEFAULT 0,
    reset_at TIMESTAMP NOT NULL,                         -- Cuándo se resetea el contador

    -- Metadata
    last_used_at TIMESTAMP DEFAULT NOW(),

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices y constraints para tenant_usage
CREATE INDEX IF NOT EXISTS idx_tenant_usage_tenant_id ON tenant_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_service_id ON tenant_usage(service_id);
CREATE INDEX IF NOT EXISTS idx_tenant_usage_reset_at ON tenant_usage(reset_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_usage_tenant_service
    ON tenant_usage(tenant_id, service_id);

-- ============================================================================
-- 6. CONVERSATIONS (Actualizado con tenant_id y end_user_id)
-- ============================================================================

-- Verificar si la tabla conversations existe antes de modificarla
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'conversations') THEN
        -- Agregar columnas si no existen
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'tenant_id') THEN
            ALTER TABLE conversations ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        END IF;

        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'conversations' AND column_name = 'end_user_id') THEN
            ALTER TABLE conversations ADD COLUMN end_user_id UUID REFERENCES end_users(id) ON DELETE CASCADE;
        END IF;

        -- Crear índices si no existen
        IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'conversations' AND indexname = 'idx_conversations_tenant_id') THEN
            CREATE INDEX idx_conversations_tenant_id ON conversations(tenant_id);
        END IF;

        IF NOT EXISTS (SELECT FROM pg_indexes WHERE tablename = 'conversations' AND indexname = 'idx_conversations_end_user_id') THEN
            CREATE INDEX idx_conversations_end_user_id ON conversations(end_user_id);
        END IF;
    END IF;
END $$;

-- ============================================================================
-- 7. FUNCIONES HELPER
-- ============================================================================

-- Función: Aplicar template de capabilities a tenant
CREATE OR REPLACE FUNCTION apply_template_to_tenant(
    p_tenant_id UUID,
    p_template_name VARCHAR
) RETURNS VOID AS $$
BEGIN
    -- Insertar capabilities del template al tenant
    INSERT INTO tenant_capabilities (tenant_id, service_id, enabled, config)
    SELECT
        p_tenant_id,
        jsonb_object_keys(services) AS service_id,
        true AS enabled,
        services->jsonb_object_keys(services) AS config
    FROM capability_templates
    WHERE name = p_template_name AND is_active = true
    ON CONFLICT (tenant_id, service_id)
    DO UPDATE SET
        enabled = EXCLUDED.enabled,
        config = EXCLUDED.config,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Función: Incrementar uso de servicio para tenant
CREATE OR REPLACE FUNCTION increment_tenant_usage(
    p_tenant_id UUID,
    p_service_id VARCHAR,
    p_amount INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
    v_reset_at TIMESTAMP;
BEGIN
    -- Calcular próximo reset (primer día del próximo mes)
    v_reset_at := date_trunc('month', NOW()) + INTERVAL '1 month';

    -- Insertar o actualizar uso
    INSERT INTO tenant_usage (tenant_id, service_id, count, reset_at, last_used_at)
    VALUES (p_tenant_id, p_service_id, p_amount, v_reset_at, NOW())
    ON CONFLICT (tenant_id, service_id)
    DO UPDATE SET
        count = CASE
            -- Si ya pasó la fecha de reset, reiniciar contador
            WHEN tenant_usage.reset_at < NOW() THEN p_amount
            -- Si no, incrementar
            ELSE tenant_usage.count + p_amount
        END,
        reset_at = CASE
            WHEN tenant_usage.reset_at < NOW() THEN v_reset_at
            ELSE tenant_usage.reset_at
        END,
        last_used_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Función: Obtener o crear end_user
CREATE OR REPLACE FUNCTION get_or_create_end_user(
    p_tenant_id UUID,
    p_phone VARCHAR,
    p_channel VARCHAR,
    p_name VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_end_user_id UUID;
BEGIN
    -- Buscar end_user existente
    SELECT id INTO v_end_user_id
    FROM end_users
    WHERE tenant_id = p_tenant_id AND phone = p_phone
    LIMIT 1;

    -- Si no existe, crear
    IF v_end_user_id IS NULL THEN
        INSERT INTO end_users (tenant_id, phone, primary_channel, name, last_interaction_at)
        VALUES (p_tenant_id, p_phone, p_channel, p_name, NOW())
        RETURNING id INTO v_end_user_id;
    ELSE
        -- Actualizar última interacción
        UPDATE end_users
        SET last_interaction_at = NOW()
        WHERE id = v_end_user_id;
    END IF;

    RETURN v_end_user_id;
END;
$$ LANGUAGE plpgsql;

-- Función: Verificar si tenant puede usar servicio
CREATE OR REPLACE FUNCTION tenant_can_use_service(
    p_tenant_id UUID,
    p_service_id VARCHAR
) RETURNS JSONB AS $$
DECLARE
    v_capability RECORD;
    v_usage RECORD;
    v_result JSONB;
BEGIN
    -- Obtener capability
    SELECT * INTO v_capability
    FROM tenant_capabilities
    WHERE tenant_id = p_tenant_id AND service_id = p_service_id;

    -- Si no existe o está deshabilitada
    IF v_capability IS NULL OR v_capability.enabled = false THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Service not enabled for tenant'
        );
    END IF;

    -- Si expiró
    IF v_capability.expires_at IS NOT NULL AND v_capability.expires_at < NOW() THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'reason', 'Service expired',
            'expired_at', v_capability.expires_at
        );
    END IF;

    -- Verificar quota si existe en limits
    IF v_capability.limits ? 'quota' THEN
        SELECT * INTO v_usage
        FROM tenant_usage
        WHERE tenant_id = p_tenant_id AND service_id = p_service_id;

        IF v_usage IS NOT NULL AND v_usage.count >= (v_capability.limits->>'quota')::INTEGER THEN
            RETURN jsonb_build_object(
                'allowed', false,
                'reason', 'Quota exceeded',
                'quota', (v_capability.limits->>'quota')::INTEGER,
                'used', v_usage.count,
                'reset_at', v_usage.reset_at
            );
        END IF;
    END IF;

    -- Todo OK
    RETURN jsonb_build_object(
        'allowed', true,
        'config', v_capability.config
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. TRIGGERS
-- ============================================================================

-- Trigger: Auto-actualizar updated_at en tenants
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at
    BEFORE UPDATE ON tenant_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_end_users_updated_at
    BEFORE UPDATE ON end_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_capabilities_updated_at
    BEFORE UPDATE ON tenant_capabilities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. DATOS DE EJEMPLO (Opcional - comentar en producción)
-- ============================================================================

-- Tenant 1: Tienda XYZ (Professional)
INSERT INTO tenants (id, name, slug, email, plan, subscription_status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Tienda XYZ',
    'tienda-xyz',
    'admin@tiendaxyz.com',
    'professional',
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- Tenant User: Admin de Tienda XYZ
INSERT INTO tenant_users (tenant_id, email, name, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@tiendaxyz.com',
    'Admin Tienda XYZ',
    'owner'
) ON CONFLICT (email) DO NOTHING;

-- Aplicar template professional a Tienda XYZ
SELECT apply_template_to_tenant('00000000-0000-0000-0000-000000000001', 'professional');

-- End User: Juan Pérez (cliente de Tienda XYZ)
INSERT INTO end_users (tenant_id, phone, name, primary_channel)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '+5215512345678',
    'Juan Pérez',
    'whatsapp'
) ON CONFLICT DO NOTHING;

-- Tenant 2: Clínica ABC (Enterprise)
INSERT INTO tenants (id, name, slug, email, plan, subscription_status)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'Clínica ABC',
    'clinica-abc',
    'admin@clinicaabc.com',
    'enterprise',
    'active'
) ON CONFLICT (slug) DO NOTHING;

-- Aplicar template enterprise a Clínica ABC
SELECT apply_template_to_tenant('00000000-0000-0000-0000-000000000002', 'enterprise');

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Listar todas las tablas creadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN ('tenants', 'tenant_users', 'end_users', 'tenant_capabilities', 'tenant_usage')
ORDER BY table_name;

-- Verificar tenants creados
SELECT id, name, slug, plan, subscription_status FROM tenants;

-- Verificar capabilities
SELECT
    t.name AS tenant_name,
    tc.service_id,
    tc.enabled
FROM tenant_capabilities tc
JOIN tenants t ON t.id = tc.tenant_id
ORDER BY t.name, tc.service_id;

-- ============================================================================
-- FIN
-- ============================================================================

COMMENT ON TABLE tenants IS 'Organizaciones que compran el servicio (nuestros clientes)';
COMMENT ON TABLE tenant_users IS 'Empleados/admins de cada organización';
COMMENT ON TABLE end_users IS 'Clientes finales que chatean (clientes de nuestros clientes)';
COMMENT ON TABLE tenant_capabilities IS 'Capabilities a nivel organización';
COMMENT ON TABLE tenant_usage IS 'Usage tracking por tenant';

SELECT 'Multi-tenancy schema created successfully!' AS status;
