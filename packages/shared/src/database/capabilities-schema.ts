/**
 * Capabilities Database Schema (Drizzle ORM)
 *
 * Esquema de base de datos para el sistema de capacidades.
 * Reemplaza la lógica hardcodeada de planes por configuración en DB.
 *
 * Tablas:
 * - user_capabilities: Capacidades por usuario
 * - service_usage: Tracking de uso de servicios
 * - capability_templates: Templates predefinidos (starter, professional, enterprise)
 *
 * @module database/capabilities-schema
 */

import { pgTable, uuid, varchar, boolean, jsonb, timestamp, integer, text, index, unique } from 'drizzle-orm/pg-core';
import { users } from './schema';

/**
 * Tabla: user_capabilities
 *
 * Almacena qué servicios tiene habilitados cada usuario y su configuración.
 */
export const userCapabilities = pgTable('user_capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceId: varchar('service_id', { length: 100 }).notNull(),
  enabled: boolean('enabled').default(true),
  config: jsonb('config').notNull().default('{}'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    userIdx: index('idx_user_capabilities_user_id').on(table.userId),
    serviceIdx: index('idx_user_capabilities_service_id').on(table.serviceId),
    expiresIdx: index('idx_user_capabilities_expires_at').on(table.expiresAt),
    uniqueUserService: unique('unique_user_service').on(table.userId, table.serviceId),
  };
});

/**
 * Tabla: service_usage
 *
 * Tracking de uso de servicios (rate limiting, cuotas, etc.)
 */
export const serviceUsage = pgTable('service_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  serviceId: varchar('service_id', { length: 100 }).notNull(),
  count: integer('count').default(0),
  resetAt: timestamp('reset_at').notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
  return {
    userIdx: index('idx_service_usage_user_id').on(table.userId),
    serviceIdx: index('idx_service_usage_service_id').on(table.serviceId),
    resetIdx: index('idx_service_usage_reset_at').on(table.resetAt),
    uniqueUserService: unique('unique_user_service_usage').on(table.userId, table.serviceId),
  };
});

/**
 * Tabla: capability_templates
 *
 * Templates predefinidos de capacidades (starter, professional, enterprise)
 */
export const capabilityTemplates = pgTable('capability_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).unique().notNull(),
  description: text('description'),
  services: jsonb('services').notNull(),
  globalLimits: jsonb('global_limits'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    nameIdx: index('idx_capability_templates_name').on(table.name),
  };
});

/**
 * Tipos TypeScript inferidos
 */
export type UserCapability = typeof userCapabilities.$inferSelect;
export type NewUserCapability = typeof userCapabilities.$inferInsert;

export type ServiceUsageRecord = typeof serviceUsage.$inferSelect;
export type NewServiceUsageRecord = typeof serviceUsage.$inferInsert;

export type CapabilityTemplate = typeof capabilityTemplates.$inferSelect;
export type NewCapabilityTemplate = typeof capabilityTemplates.$inferInsert;
