/**
 * Multi-Tenancy Database Schema (Drizzle ORM)
 *
 * Esquema de base de datos para multi-tenancy.
 * Separa organizaciones (tenants) de usuarios finales (end_users).
 *
 * Tablas:
 * - tenants: Organizaciones que compran el servicio
 * - tenant_users: Empleados/admins de organizaciones
 * - end_users: Clientes finales que chatean
 * - tenant_capabilities: Capabilities a nivel organización
 * - tenant_usage: Usage tracking por tenant
 *
 * @module database/multi-tenancy-schema
 */

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  jsonb,
  timestamp,
  integer,
  text,
  index,
  unique,
  check
} from 'drizzle-orm/pg-core';

// ============================================================================
// TENANTS (Organizaciones)
// ============================================================================

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identificación
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(),
  email: varchar('email', { length: 255 }).notNull(),

  // Plan y Subscription
  plan: varchar('plan', { enum: ['starter', 'professional', 'enterprise'] })
    .notNull()
    .default('starter'),
  subscriptionStatus: varchar('subscription_status', {
    enum: ['trial', 'active', 'suspended', 'cancelled']
  })
    .notNull()
    .default('trial'),
  trialEndsAt: timestamp('trial_ends_at'),

  // Facturación
  billingEmail: varchar('billing_email', { length: 255 }),
  billingAddress: jsonb('billing_address'), // { street, city, country, zip, tax_id }

  // Configuración
  settings: jsonb('settings').default('{}'),
  metadata: jsonb('metadata').default('{}'),

  // Limits (opcional, override de plan)
  limits: jsonb('limits'), // { max_end_users, max_messages_per_month, ... }

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at') // Soft delete
}, (table) => {
  return {
    slugIdx: index('idx_tenants_slug').on(table.slug),
    emailIdx: index('idx_tenants_email').on(table.email),
    subscriptionStatusIdx: index('idx_tenants_subscription_status').on(table.subscriptionStatus),
    deletedAtIdx: index('idx_tenants_deleted_at').on(table.deletedAt)
  };
});

// ============================================================================
// TENANT_USERS (Empleados/Admins de organizaciones)
// ============================================================================

export const tenantUsers = pgTable('tenant_users', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relación con tenant
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  // Identificación
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),

  // Autenticación
  passwordHash: varchar('password_hash', { length: 255 }),

  // Rol y Permisos
  role: varchar('role', { enum: ['owner', 'admin', 'agent', 'viewer'] })
    .notNull()
    .default('agent'),
  permissions: jsonb('permissions').default('[]'),

  // Estado
  isActive: boolean('is_active').default(true),
  lastLoginAt: timestamp('last_login_at'),

  // Metadata
  metadata: jsonb('metadata').default('{}'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at') // Soft delete
}, (table) => {
  return {
    tenantIdIdx: index('idx_tenant_users_tenant_id').on(table.tenantId),
    emailIdx: index('idx_tenant_users_email').on(table.email),
    roleIdx: index('idx_tenant_users_role').on(table.role)
  };
});

// ============================================================================
// END_USERS (Clientes finales que chatean)
// ============================================================================

export const endUsers = pgTable('end_users', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relación con tenant
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  // Identificación
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  name: varchar('name', { length: 255 }),

  // Canal principal
  primaryChannel: varchar('primary_channel', {
    enum: ['whatsapp', 'telegram', 'web', 'sms', 'email']
  }),

  // Identificadores externos
  externalId: varchar('external_id', { length: 255 }), // ID en sistema del tenant
  whatsappId: varchar('whatsapp_id', { length: 255 }), // WhatsApp Business API ID
  telegramId: varchar('telegram_id', { length: 255 }), // Telegram user ID

  // Metadata custom del tenant
  customFields: jsonb('custom_fields').default('{}'),
  tags: jsonb('tags').default('[]'),

  // Estado
  isActive: boolean('is_active').default(true),
  blocked: boolean('blocked').default(false),
  lastInteractionAt: timestamp('last_interaction_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  deletedAt: timestamp('deleted_at') // Soft delete
}, (table) => {
  return {
    tenantIdIdx: index('idx_end_users_tenant_id').on(table.tenantId),
    phoneIdx: index('idx_end_users_phone').on(table.phone),
    emailIdx: index('idx_end_users_email').on(table.email),
    externalIdIdx: index('idx_end_users_external_id').on(table.externalId),
    primaryChannelIdx: index('idx_end_users_primary_channel').on(table.primaryChannel),
    lastInteractionIdx: index('idx_end_users_last_interaction').on(table.lastInteractionAt)
  };
});

// ============================================================================
// TENANT_CAPABILITIES (Capabilities a nivel organización)
// ============================================================================

export const tenantCapabilities = pgTable('tenant_capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relación con tenant
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  // Servicio/Extension
  serviceId: varchar('service_id', { length: 100 }).notNull(),

  // Estado
  enabled: boolean('enabled').default(true),

  // Configuración
  config: jsonb('config').notNull().default('{}'),

  // Limits específicos (override de template)
  limits: jsonb('limits'), // { quota, rate_limit, ... }

  // Expiración (para trials)
  expiresAt: timestamp('expires_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => {
  return {
    tenantIdIdx: index('idx_tenant_capabilities_tenant_id').on(table.tenantId),
    serviceIdIdx: index('idx_tenant_capabilities_service_id').on(table.serviceId),
    expiresAtIdx: index('idx_tenant_capabilities_expires_at').on(table.expiresAt),
    uniqueTenantService: unique('unique_tenant_service').on(table.tenantId, table.serviceId)
  };
});

// ============================================================================
// TENANT_USAGE (Usage tracking por tenant)
// ============================================================================

export const tenantUsage = pgTable('tenant_usage', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Relación con tenant
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  // Servicio
  serviceId: varchar('service_id', { length: 100 }).notNull(),

  // Uso
  count: integer('count').default(0),
  resetAt: timestamp('reset_at').notNull(),

  // Metadata
  lastUsedAt: timestamp('last_used_at').defaultNow(),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (table) => {
  return {
    tenantIdIdx: index('idx_tenant_usage_tenant_id').on(table.tenantId),
    serviceIdIdx: index('idx_tenant_usage_service_id').on(table.serviceId),
    resetAtIdx: index('idx_tenant_usage_reset_at').on(table.resetAt),
    uniqueTenantService: unique('unique_tenant_service_usage').on(table.tenantId, table.serviceId)
  };
});

// ============================================================================
// TIPOS TYPESCRIPT INFERIDOS
// ============================================================================

// Tenants
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

// Tenant Users
export type TenantUser = typeof tenantUsers.$inferSelect;
export type NewTenantUser = typeof tenantUsers.$inferInsert;

// End Users
export type EndUser = typeof endUsers.$inferSelect;
export type NewEndUser = typeof endUsers.$inferInsert;

// Tenant Capabilities
export type TenantCapability = typeof tenantCapabilities.$inferSelect;
export type NewTenantCapability = typeof tenantCapabilities.$inferInsert;

// Tenant Usage
export type TenantUsageRecord = typeof tenantUsage.$inferSelect;
export type NewTenantUsageRecord = typeof tenantUsage.$inferInsert;

// ============================================================================
// ENUMS EXPORTADOS
// ============================================================================

export const PLAN_TYPES = ['starter', 'professional', 'enterprise'] as const;
export type PlanType = typeof PLAN_TYPES[number];

export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'suspended', 'cancelled'] as const;
export type SubscriptionStatus = typeof SUBSCRIPTION_STATUSES[number];

export const TENANT_USER_ROLES = ['owner', 'admin', 'agent', 'viewer'] as const;
export type TenantUserRole = typeof TENANT_USER_ROLES[number];

export const CHANNELS = ['whatsapp', 'telegram', 'web', 'sms', 'email'] as const;
export type Channel = typeof CHANNELS[number];

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Tenant completo con relaciones
 */
export interface TenantWithRelations extends Tenant {
  users?: TenantUser[];
  endUsers?: EndUser[];
  capabilities?: TenantCapability[];
  usage?: TenantUsageRecord[];
}

/**
 * End User con información del tenant
 */
export interface EndUserWithTenant extends EndUser {
  tenant?: Tenant;
}

/**
 * Capability con información del tenant
 */
export interface TenantCapabilityWithTenant extends TenantCapability {
  tenant?: Tenant;
}

/**
 * Billing address structure
 */
export interface BillingAddress {
  street: string;
  city: string;
  state?: string;
  country: string;
  zip: string;
  taxId?: string;
}

/**
 * Tenant settings structure
 */
export interface TenantSettings {
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  notifications?: {
    email?: boolean;
    sms?: boolean;
    webhook?: string;
  };
  features?: {
    [key: string]: boolean;
  };
}

/**
 * Tenant limits structure
 */
export interface TenantLimits {
  maxEndUsers?: number;
  maxMessagesPerMonth?: number;
  maxTenantUsers?: number;
  maxApiCallsPerMinute?: number;
}

/**
 * End User custom fields structure (definido por cada tenant)
 */
export interface EndUserCustomFields {
  [key: string]: string | number | boolean | null;
}
