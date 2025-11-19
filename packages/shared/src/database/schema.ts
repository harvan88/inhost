import { pgTable, uuid, text, timestamp, jsonb, varchar, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { MessageType, MessageChannel, MessageStatus } from '../types/message-envelope';

// ============================================
// MULTI-TENANCY TABLES (Sprint 4)
// ============================================

// Tabla de tenants (organizaciones/empresas)
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).unique().notNull(), // URL-friendly name
  plan: varchar('plan', { enum: ['starter', 'professional', 'enterprise'] }).default('starter'),
  settings: jsonb('settings').default({}), // Configuración del tenant
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  subscriptionStatus: varchar('subscription_status', { length: 50 }).default('trialing'),
  trialEndsAt: timestamp('trial_ends_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    slugIdx: index('tenants_slug_idx').on(table.slug),
  };
});

// Tabla de usuarios admin (usuarios del dashboard)
export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  role: varchar('role', { enum: ['owner', 'admin', 'agent', 'viewer'] }).default('agent'),
  isActive: boolean('is_active').default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    tenantIdx: index('admin_users_tenant_id_idx').on(table.tenantId),
    emailIdx: index('admin_users_email_idx').on(table.email),
  };
});

// Tabla de end users (clientes externos que usan WhatsApp/Instagram)
export const endUsers = pgTable('end_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(), // ID del cliente en WhatsApp, Instagram, etc.
  channel: varchar('channel', { enum: ['whatsapp', 'telegram', 'web', 'sms', 'instagram'] }).notNull(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  metadata: jsonb('metadata').default({}), // Información adicional del cliente
  tags: jsonb('tags').default([]), // Tags para segmentación
  isBlocked: boolean('is_blocked').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    tenantIdx: index('end_users_tenant_id_idx').on(table.tenantId),
    externalIdIdx: index('end_users_external_id_idx').on(table.externalId),
    channelIdx: index('end_users_channel_idx').on(table.channel),
  };
});

// Tabla de conversaciones (actualizada con multi-tenancy)
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  endUserId: uuid('end_user_id').references(() => endUsers.id).notNull(),
  channel: varchar('channel', { enum: ['whatsapp', 'telegram', 'web', 'sms', 'instagram'] }).notNull(),
  status: varchar('status', { enum: ['active', 'closed', 'archived'] }).default('active'),
  assignedToId: uuid('assigned_to_id').references(() => adminUsers.id), // Agente asignado
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  closedAt: timestamp('closed_at'),
}, (table) => {
  return {
    tenantIdx: index('conversations_tenant_id_idx').on(table.tenantId),
    endUserIdx: index('conversations_end_user_id_idx').on(table.endUserId),
    statusIdx: index('conversations_status_idx').on(table.status),
    assignedToIdx: index('conversations_assigned_to_id_idx').on(table.assignedToId),
  };
});

// Tabla de mensajes (actualizada)
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
  type: varchar('type', { enum: ['incoming', 'outgoing', 'system', 'status'] }).notNull(),
  channel: varchar('channel', { enum: ['whatsapp', 'telegram', 'web', 'sms', 'instagram'] }).notNull(),
  content: jsonb('content').notNull(), // MessageContent
  metadata: jsonb('metadata').notNull(), // MessageMetadata
  statusChain: jsonb('status_chain').default([]), // MessageStatusEvent[]
  context: jsonb('context').notNull(), // MessageContext
  sentByAdminUserId: uuid('sent_by_admin_user_id').references(() => adminUsers.id), // Si fue enviado por un agente
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    conversationIdx: index('messages_conversation_id_idx').on(table.conversationId),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  };
});

// ============================================
// RELACIONES
// ============================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  adminUsers: many(adminUsers),
  endUsers: many(endUsers),
  conversations: many(conversations),
}));

export const adminUsersRelations = relations(adminUsers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [adminUsers.tenantId],
    references: [tenants.id],
  }),
  assignedConversations: many(conversations),
  sentMessages: many(messages),
}));

export const endUsersRelations = relations(endUsers, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [endUsers.tenantId],
    references: [tenants.id],
  }),
  conversations: many(conversations),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [conversations.tenantId],
    references: [tenants.id],
  }),
  endUser: one(endUsers, {
    fields: [conversations.endUserId],
    references: [endUsers.id],
  }),
  assignedTo: one(adminUsers, {
    fields: [conversations.assignedToId],
    references: [adminUsers.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sentByAdminUser: one(adminUsers, {
    fields: [messages.sentByAdminUserId],
    references: [adminUsers.id],
  }),
}));

// ============================================
// TIPOS TYPESCRIPT
// ============================================

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;

export type AdminUser = typeof adminUsers.$inferSelect;
export type NewAdminUser = typeof adminUsers.$inferInsert;

export type EndUser = typeof endUsers.$inferSelect;
export type NewEndUser = typeof endUsers.$inferInsert;

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// Legacy alias (mantener compatibilidad)
export type User = AdminUser;
export type NewUser = NewAdminUser;

// Mantener tabla users legacy por compatibilidad (deprecated)
export const users = adminUsers;