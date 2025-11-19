-- ============================================================================
-- INHOST - Migración a Multi-Tenancy
-- ============================================================================
--
-- Este script migra de:
--   user_capabilities (capabilities por usuario individual)
-- A:
--   tenant_capabilities (capabilities por organización)
--
-- IMPORTANTE: Ejecutar DESPUÉS de create-multi-tenancy-tables.sql
--
-- Ejecutar: psql -h localhost -U inhost_user -d inhost -f scripts/migrate-to-multi-tenancy.sql
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. VERIFICAR QUE TABLAS MULTI-TENANCY EXISTEN
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenants') THEN
        RAISE EXCEPTION 'Table "tenants" does not exist. Run create-multi-tenancy-tables.sql first!';
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tenant_users') THEN
        RAISE EXCEPTION 'Table "tenant_users" does not exist. Run create-multi-tenancy-tables.sql first!';
    END IF;
END $$;

-- ============================================================================
-- 2. MIGRAR USUARIOS EXISTENTES → TENANTS
-- ============================================================================

-- Cada "user" actual se convierte en un TENANT (organización individual)
-- Esto es válido para usuarios que ya estaban usando el sistema

INSERT INTO tenants (id, name, slug, email, plan, subscription_status, created_at)
SELECT
    u.id,
    COALESCE(u.name, u.email) AS name,
    -- Generar slug a partir de email
    regexp_replace(lower(u.email), '[^a-z0-9]+', '-', 'g') AS slug,
    u.email,
    -- Migrar plan de user a tenant
    CASE
        WHEN u.plan = 'free' THEN 'starter'
        WHEN u.plan = 'premium' THEN 'professional'
        ELSE 'starter'
    END AS plan,
    'active' AS subscription_status,  -- Asumir que están activos
    u.created_at
FROM users u
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE '✅ Migrated % users to tenants', (SELECT COUNT(*) FROM tenants);

-- ============================================================================
-- 3. CREAR TENANT_USER (OWNER) PARA CADA TENANT
-- ============================================================================

-- Crear un tenant_user (owner) por cada tenant
-- Este será el usuario admin de la organización

INSERT INTO tenant_users (tenant_id, email, name, role, created_at)
SELECT
    u.id AS tenant_id,
    u.email,
    u.name,
    'owner' AS role,  -- Primer usuario es owner
    u.created_at
FROM users u
ON CONFLICT (email) DO NOTHING;

RAISE NOTICE '✅ Created % tenant_users (owners)', (SELECT COUNT(*) FROM tenant_users);

-- ============================================================================
-- 4. MIGRAR USER_CAPABILITIES → TENANT_CAPABILITIES
-- ============================================================================

-- Migrar capabilities de usuarios individuales a capabilities de tenant

INSERT INTO tenant_capabilities (tenant_id, service_id, enabled, config, expires_at, created_at, updated_at)
SELECT
    uc.user_id AS tenant_id,  -- user_id se vuelve tenant_id
    uc.service_id,
    uc.enabled,
    uc.config,
    uc.expires_at,
    uc.created_at,
    uc.updated_at
FROM user_capabilities uc
ON CONFLICT (tenant_id, service_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    config = EXCLUDED.config,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();

RAISE NOTICE '✅ Migrated % capabilities to tenant_capabilities', (SELECT COUNT(*) FROM tenant_capabilities);

-- ============================================================================
-- 5. MIGRAR SERVICE_USAGE → TENANT_USAGE
-- ============================================================================

-- Migrar usage tracking de usuarios a tenants

INSERT INTO tenant_usage (tenant_id, service_id, count, reset_at, last_used_at, created_at, updated_at)
SELECT
    su.user_id AS tenant_id,  -- user_id se vuelve tenant_id
    su.service_id,
    su.count,
    su.reset_at,
    su.last_used_at,
    su.created_at,
    NOW() AS updated_at
FROM service_usage su
ON CONFLICT (tenant_id, service_id) DO UPDATE SET
    count = EXCLUDED.count,
    reset_at = EXCLUDED.reset_at,
    last_used_at = EXCLUDED.last_used_at,
    updated_at = NOW();

RAISE NOTICE '✅ Migrated % usage records to tenant_usage', (SELECT COUNT(*) FROM tenant_usage);

-- ============================================================================
-- 6. ACTUALIZAR CONVERSATIONS (Agregar tenant_id, end_user_id)
-- ============================================================================

-- Nota: Las conversaciones existentes probablemente NO tienen end_user_id aún
-- porque el concepto de end_users es nuevo

-- Por ahora, solo aseguramos que las columnas existen
-- La migración real de conversaciones se hará cuando haya end_users reales

-- Las columnas ya fueron agregadas en create-multi-tenancy-tables.sql
-- Aquí solo verificamos

DO $$
BEGIN
    -- Verificar que columnas existen
    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'tenant_id'
    ) THEN
        RAISE NOTICE 'Adding tenant_id column to conversations...';
        ALTER TABLE conversations ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON conversations(tenant_id);
    END IF;

    IF NOT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'conversations' AND column_name = 'end_user_id'
    ) THEN
        RAISE NOTICE 'Adding end_user_id column to conversations...';
        ALTER TABLE conversations ADD COLUMN end_user_id UUID REFERENCES end_users(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_conversations_end_user_id ON conversations(end_user_id);
    END IF;
END $$;

-- ============================================================================
-- 7. OPCIONAL: DEPRECAR TABLAS VIEJAS
-- ============================================================================

-- Opción A: RENOMBRAR tablas viejas (mantener como backup)
-- ALTER TABLE user_capabilities RENAME TO user_capabilities_legacy;
-- ALTER TABLE service_usage RENAME TO service_usage_legacy;

-- Opción B: ELIMINAR tablas viejas (solo si estás seguro)
-- DROP TABLE user_capabilities;
-- DROP TABLE service_usage;

-- Por ahora: MANTENER pero agregar comentario

COMMENT ON TABLE user_capabilities IS 'DEPRECATED - Migrated to tenant_capabilities. Will be removed in future version.';
COMMENT ON TABLE service_usage IS 'DEPRECATED - Migrated to tenant_usage. Will be removed in future version.';

RAISE NOTICE '⚠️  Tables user_capabilities and service_usage are now DEPRECATED';
RAISE NOTICE '⚠️  Use tenant_capabilities and tenant_usage instead';

-- ============================================================================
-- 8. VERIFICACIÓN FINAL
-- ============================================================================

DO $$
DECLARE
    v_tenants_count INTEGER;
    v_tenant_users_count INTEGER;
    v_tenant_capabilities_count INTEGER;
    v_tenant_usage_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_tenants_count FROM tenants;
    SELECT COUNT(*) INTO v_tenant_users_count FROM tenant_users;
    SELECT COUNT(*) INTO v_tenant_capabilities_count FROM tenant_capabilities;
    SELECT COUNT(*) INTO v_tenant_usage_count FROM tenant_usage;

    RAISE NOTICE '';
    RAISE NOTICE '╔═══════════════════════════════════════════════════════╗';
    RAISE NOTICE '║          MIGRATION SUMMARY                            ║';
    RAISE NOTICE '╚═══════════════════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'Tenants:              %', v_tenants_count;
    RAISE NOTICE 'Tenant Users:         %', v_tenant_users_count;
    RAISE NOTICE 'Tenant Capabilities:  %', v_tenant_capabilities_count;
    RAISE NOTICE 'Tenant Usage:         %', v_tenant_usage_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify data: SELECT * FROM tenants;';
    RAISE NOTICE '2. Update backend to use tenant_capabilities instead of user_capabilities';
    RAISE NOTICE '3. Deploy new /admin/* and /chat/* endpoints';
    RAISE NOTICE '';
END $$;

COMMIT;

-- ============================================================================
-- FIN
-- ============================================================================
