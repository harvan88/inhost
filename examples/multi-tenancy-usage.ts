/**
 * Multi-Tenancy Usage Examples
 *
 * Ejemplos prácticos de cómo usar el sistema multi-tenant
 * para separar organizaciones (tenants) de usuarios finales (end-users).
 */

import { pool } from '@inhost/shared';
import type {
  Tenant,
  EndUser,
  TenantCapability,
  NewTenant,
  NewEndUser
} from '@inhost/shared/database/multi-tenancy-schema';

// ============================================================================
// ESCENARIO 1: Onboarding de Nueva Organización
// ============================================================================

/**
 * Registrar nueva organización (tenant)
 */
async function onboardNewTenant(params: {
  name: string;
  email: string;
  plan: 'starter' | 'professional' | 'enterprise';
  ownerEmail: string;
  ownerName: string;
}): Promise<{ tenantId: string; ownerId: string }> {
  console.log(`\n📝 Onboarding new tenant: ${params.name}`);

  // 1. Crear slug único a partir del nombre
  const slug = params.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // 2. Crear tenant
  const tenantResult = await pool.query(`
    INSERT INTO tenants (name, slug, email, plan, subscription_status, trial_ends_at)
    VALUES ($1, $2, $3, $4, 'trial', NOW() + INTERVAL '14 days')
    RETURNING id
  `, [params.name, slug, params.email, params.plan]);

  const tenantId = tenantResult.rows[0].id;
  console.log(`✅ Tenant created: ${tenantId}`);

  // 3. Crear owner (primer usuario admin)
  const ownerResult = await pool.query(`
    INSERT INTO tenant_users (tenant_id, email, name, role)
    VALUES ($1, $2, $3, 'owner')
    RETURNING id
  `, [tenantId, params.ownerEmail, params.ownerName]);

  const ownerId = ownerResult.rows[0].id;
  console.log(`✅ Owner created: ${ownerId}`);

  // 4. Aplicar template de capabilities según el plan
  await pool.query(`
    SELECT apply_template_to_tenant($1::uuid, $2)
  `, [tenantId, params.plan]);

  console.log(`✅ Template '${params.plan}' applied`);

  // 5. Enviar email de bienvenida (mock)
  console.log(`📧 Welcome email sent to ${params.ownerEmail}`);

  return { tenantId, ownerId };
}

// ============================================================================
// ESCENARIO 2: Cliente Final Envía Mensaje (WhatsApp)
// ============================================================================

/**
 * Procesar mensaje entrante de WhatsApp
 */
async function handleIncomingWhatsAppMessage(params: {
  from: string; // Teléfono: +5215512345678
  to: string; // Número de WhatsApp Business del tenant
  text: string;
}) {
  console.log(`\n📱 Incoming WhatsApp message from ${params.from}`);

  // 1. Identificar tenant a partir del número de destino
  const tenantResult = await pool.query(`
    SELECT id, name, plan FROM tenants
    WHERE settings->>'whatsapp_number' = $1
    LIMIT 1
  `, [params.to]);

  if (tenantResult.rows.length === 0) {
    console.error('❌ Tenant not found for WhatsApp number:', params.to);
    return;
  }

  const tenant = tenantResult.rows[0];
  console.log(`✅ Tenant identified: ${tenant.name} (${tenant.id})`);

  // 2. Obtener o crear end_user
  const endUserResult = await pool.query(`
    SELECT get_or_create_end_user($1::uuid, $2, 'whatsapp', NULL)
  `, [tenant.id, params.from]);

  const endUserId = endUserResult.rows[0].get_or_create_end_user;
  console.log(`✅ End user: ${endUserId}`);

  // 3. Verificar si tenant puede usar AI Assistant
  const capabilityCheck = await pool.query(`
    SELECT tenant_can_use_service($1::uuid, 'ai-assistant')
  `, [tenant.id]);

  const canUseAI = capabilityCheck.rows[0].tenant_can_use_service;

  if (canUseAI.allowed) {
    console.log('✅ Tenant can use AI Assistant');

    // 4. Procesar con AI
    const aiResponse = await processWithAI(params.text);
    console.log(`🤖 AI Response: "${aiResponse}"`);

    // 5. Incrementar uso
    await pool.query(`
      SELECT increment_tenant_usage($1::uuid, 'ai-assistant', 1)
    `, [tenant.id]);

    console.log('✅ Usage incremented');

    // 6. Enviar respuesta
    await sendWhatsAppMessage(params.from, aiResponse);
    console.log('✅ Response sent');
  } else {
    console.log('❌ AI not available:', canUseAI.reason);

    // Enviar respuesta genérica
    await sendWhatsAppMessage(params.from, 'Gracias por tu mensaje. Un agente te atenderá pronto.');
  }
}

// ============================================================================
// ESCENARIO 3: Admin de Tenant Consulta Métricas
// ============================================================================

/**
 * Obtener dashboard de métricas para un tenant
 */
async function getTenantDashboard(tenantId: string): Promise<DashboardData> {
  console.log(`\n📊 Getting dashboard for tenant: ${tenantId}`);

  // 1. Información del tenant
  const tenantResult = await pool.query(`
    SELECT
      id,
      name,
      plan,
      subscription_status,
      trial_ends_at,
      created_at
    FROM tenants
    WHERE id = $1
  `, [tenantId]);

  const tenant = tenantResult.rows[0];

  // 2. Estadísticas de end-users
  const endUsersResult = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE last_interaction_at > NOW() - INTERVAL '7 days') AS active_7d,
      COUNT(*) FILTER (WHERE last_interaction_at > NOW() - INTERVAL '30 days') AS active_30d
    FROM end_users
    WHERE tenant_id = $1 AND deleted_at IS NULL
  `, [tenantId]);

  const endUsersStats = endUsersResult.rows[0];

  // 3. Mensajes (últimos 30 días)
  const messagesResult = await pool.query(`
    SELECT
      COUNT(*) AS total_messages,
      COUNT(*) FILTER (WHERE m.type = 'incoming') AS incoming,
      COUNT(*) FILTER (WHERE m.type = 'outgoing') AS outgoing,
      DATE_TRUNC('day', m.created_at) AS date,
      COUNT(*) AS count
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN end_users eu ON eu.id = c.end_user_id
    WHERE eu.tenant_id = $1
      AND m.created_at > NOW() - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', m.created_at)
    ORDER BY date DESC
  `, [tenantId]);

  // 4. Uso de servicios
  const usageResult = await pool.query(`
    SELECT
      service_id,
      count,
      reset_at
    FROM tenant_usage
    WHERE tenant_id = $1
  `, [tenantId]);

  // 5. Capabilities activas
  const capabilitiesResult = await pool.query(`
    SELECT
      service_id,
      enabled,
      config,
      expires_at
    FROM tenant_capabilities
    WHERE tenant_id = $1
  `, [tenantId]);

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.subscription_status,
      trialEndsAt: tenant.trial_ends_at
    },
    endUsers: {
      total: parseInt(endUsersStats.total),
      active7d: parseInt(endUsersStats.active_7d),
      active30d: parseInt(endUsersStats.active_30d)
    },
    messages: {
      total: messagesResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0),
      byDay: messagesResult.rows.map(row => ({
        date: row.date,
        count: parseInt(row.count)
      }))
    },
    usage: usageResult.rows.map(row => ({
      service: row.service_id,
      used: row.count,
      resetAt: row.reset_at
    })),
    capabilities: capabilitiesResult.rows.map(row => ({
      service: row.service_id,
      enabled: row.enabled,
      config: row.config,
      expiresAt: row.expires_at
    }))
  };
}

// ============================================================================
// ESCENARIO 4: Upgrade de Plan
// ============================================================================

/**
 * Actualizar plan de un tenant
 */
async function upgradeTenantPlan(
  tenantId: string,
  newPlan: 'starter' | 'professional' | 'enterprise'
) {
  console.log(`\n⬆️  Upgrading tenant ${tenantId} to ${newPlan}`);

  // 1. Actualizar plan en tenant
  await pool.query(`
    UPDATE tenants
    SET
      plan = $2,
      subscription_status = 'active',
      trial_ends_at = NULL,  -- Ya no es trial
      updated_at = NOW()
    WHERE id = $1
  `, [tenantId, newPlan]);

  console.log('✅ Plan updated');

  // 2. Eliminar capabilities actuales
  await pool.query(`
    DELETE FROM tenant_capabilities
    WHERE tenant_id = $1
  `, [tenantId]);

  console.log('✅ Old capabilities removed');

  // 3. Aplicar nuevo template
  await pool.query(`
    SELECT apply_template_to_tenant($1::uuid, $2)
  `, [tenantId, newPlan]);

  console.log(`✅ Template '${newPlan}' applied`);

  // 4. Notificar al tenant (mock)
  console.log('📧 Upgrade notification sent');

  // 5. Crear evento en billing (mock)
  console.log('💰 Billing event created');
}

// ============================================================================
// ESCENARIO 5: Listar End-Users de un Tenant
// ============================================================================

/**
 * Listar end-users de un tenant con filtros
 */
async function listEndUsers(params: {
  tenantId: string;
  channel?: string;
  activeOnly?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  console.log(`\n📋 Listing end-users for tenant: ${params.tenantId}`);

  let query = `
    SELECT
      id,
      phone,
      email,
      name,
      primary_channel,
      last_interaction_at,
      created_at
    FROM end_users
    WHERE tenant_id = $1
      AND deleted_at IS NULL
  `;

  const queryParams: any[] = [params.tenantId];
  let paramIndex = 2;

  // Filtro: canal
  if (params.channel) {
    query += ` AND primary_channel = $${paramIndex}`;
    queryParams.push(params.channel);
    paramIndex++;
  }

  // Filtro: solo activos
  if (params.activeOnly) {
    query += ` AND last_interaction_at > NOW() - INTERVAL '30 days'`;
  }

  // Filtro: búsqueda
  if (params.search) {
    query += ` AND (
      name ILIKE $${paramIndex}
      OR phone ILIKE $${paramIndex}
      OR email ILIKE $${paramIndex}
    )`;
    queryParams.push(`%${params.search}%`);
    paramIndex++;
  }

  // Orden
  query += ` ORDER BY last_interaction_at DESC NULLS LAST`;

  // Paginación
  if (params.limit) {
    query += ` LIMIT $${paramIndex}`;
    queryParams.push(params.limit);
    paramIndex++;
  }

  if (params.offset) {
    query += ` OFFSET $${paramIndex}`;
    queryParams.push(params.offset);
  }

  const result = await pool.query(query, queryParams);

  console.log(`✅ Found ${result.rows.length} end-users`);

  return result.rows;
}

// ============================================================================
// ESCENARIO 6: Facturación Mensual
// ============================================================================

/**
 * Generar reporte de facturación mensual
 */
async function generateMonthlyBillingReport(month: string): Promise<BillingReport[]> {
  console.log(`\n💰 Generating billing report for: ${month}`);

  const result = await pool.query(`
    SELECT
      t.id AS tenant_id,
      t.name AS tenant_name,
      t.slug,
      t.plan,
      t.billing_email,
      t.subscription_status,

      -- End users
      COUNT(DISTINCT eu.id) AS total_end_users,

      -- Mensajes
      COUNT(DISTINCT m.id) FILTER (WHERE m.created_at >= date_trunc('month', $1::date)) AS messages_current_month,

      -- Uso de servicios
      json_agg(
        json_build_object(
          'service', tu.service_id,
          'usage', tu.count
        )
      ) FILTER (WHERE tu.id IS NOT NULL) AS service_usage

    FROM tenants t
    LEFT JOIN end_users eu ON eu.tenant_id = t.id AND eu.deleted_at IS NULL
    LEFT JOIN conversations c ON c.tenant_id = t.id
    LEFT JOIN messages m ON m.conversation_id = c.id
    LEFT JOIN tenant_usage tu ON tu.tenant_id = t.id

    WHERE t.subscription_status = 'active'
      AND t.deleted_at IS NULL

    GROUP BY t.id, t.name, t.slug, t.plan, t.billing_email, t.subscription_status
    ORDER BY t.name
  `, [month]);

  console.log(`✅ Report generated for ${result.rows.length} tenants`);

  return result.rows.map(row => ({
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    plan: row.plan,
    billingEmail: row.billing_email,
    endUsers: parseInt(row.total_end_users),
    messagesThisMonth: parseInt(row.messages_current_month),
    serviceUsage: row.service_usage || [],
    amount: calculateBillingAmount(row)
  }));
}

// ============================================================================
// ESCENARIO 7: Verificar Aislamiento de Datos
// ============================================================================

/**
 * Verificar que un tenant_user solo vea datos de su tenant
 */
async function getTenantUserData(tenantUserId: string) {
  console.log(`\n🔐 Getting data for tenant_user: ${tenantUserId}`);

  // 1. Obtener tenant del usuario
  const userResult = await pool.query(`
    SELECT tenant_id, role FROM tenant_users
    WHERE id = $1
  `, [tenantUserId]);

  if (userResult.rows.length === 0) {
    throw new Error('Tenant user not found');
  }

  const { tenant_id: tenantId, role } = userResult.rows[0];

  console.log(`✅ User belongs to tenant: ${tenantId}`);
  console.log(`   Role: ${role}`);

  // 2. Obtener SOLO conversaciones de su tenant
  const conversationsResult = await pool.query(`
    SELECT
      c.id,
      eu.name AS end_user_name,
      eu.phone,
      c.channel,
      c.created_at
    FROM conversations c
    JOIN end_users eu ON eu.id = c.end_user_id
    WHERE eu.tenant_id = $1  -- ← FILTRO CRÍTICO
    ORDER BY c.updated_at DESC
    LIMIT 50
  `, [tenantId]);

  console.log(`✅ Found ${conversationsResult.rows.length} conversations (isolated)`);

  // 3. Verificar que NO puede ver conversaciones de otros tenants
  const otherTenantsResult = await pool.query(`
    SELECT COUNT(*) AS count
    FROM conversations c
    JOIN end_users eu ON eu.id = c.end_user_id
    WHERE eu.tenant_id != $1
  `, [tenantId]);

  console.log(`🔒 ${otherTenantsResult.rows[0].count} conversations from other tenants (NOT accessible)`);

  return {
    tenantId,
    role,
    conversations: conversationsResult.rows
  };
}

// ============================================================================
// HELPER FUNCTIONS (Mock)
// ============================================================================

async function processWithAI(text: string): Promise<string> {
  // Mock AI processing
  return `Gracias por tu mensaje: "${text}". ¿En qué más puedo ayudarte?`;
}

async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  // Mock WhatsApp send
  console.log(`   → Sending to ${to}: "${text}"`);
}

function calculateBillingAmount(tenant: any): number {
  // Mock billing calculation
  const basePrices = {
    starter: 29,
    professional: 79,
    enterprise: 299
  };

  return basePrices[tenant.plan as keyof typeof basePrices] || 0;
}

// ============================================================================
// TYPES
// ============================================================================

interface DashboardData {
  tenant: {
    id: string;
    name: string;
    plan: string;
    status: string;
    trialEndsAt?: Date;
  };
  endUsers: {
    total: number;
    active7d: number;
    active30d: number;
  };
  messages: {
    total: number;
    byDay: Array<{ date: Date; count: number }>;
  };
  usage: Array<{
    service: string;
    used: number;
    resetAt: Date;
  }>;
  capabilities: Array<{
    service: string;
    enabled: boolean;
    config: any;
    expiresAt?: Date;
  }>;
}

interface BillingReport {
  tenantId: string;
  tenantName: string;
  plan: string;
  billingEmail: string;
  endUsers: number;
  messagesThisMonth: number;
  serviceUsage: Array<{ service: string; usage: number }>;
  amount: number;
}

// ============================================================================
// DEMO
// ============================================================================

async function demo() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  MULTI-TENANCY SYSTEM - Demo                             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    // Ejemplo 1: Onboarding
    // const { tenantId } = await onboardNewTenant({
    //   name: 'Tienda Demo',
    //   email: 'info@tiendademo.com',
    //   plan: 'professional',
    //   ownerEmail: 'admin@tiendademo.com',
    //   ownerName: 'Admin Demo'
    // });

    // Ejemplo 2: Mensaje WhatsApp
    // await handleIncomingWhatsAppMessage({
    //   from: '+5215512345678',
    //   to: '+5215500000000',
    //   text: '¿Dónde está mi pedido?'
    // });

    // Ejemplo 3: Dashboard
    // const dashboard = await getTenantDashboard('00000000-0000-0000-0000-000000000001');
    // console.log(JSON.stringify(dashboard, null, 2));

    console.log('\n✅ Demo complete!');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar demo si es invocado directamente
if (import.meta.main) {
  demo().catch(console.error);
}

export {
  onboardNewTenant,
  handleIncomingWhatsAppMessage,
  getTenantDashboard,
  upgradeTenantPlan,
  listEndUsers,
  generateMonthlyBillingReport,
  getTenantUserData
};
