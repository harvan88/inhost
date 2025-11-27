/**
 * === DOC_START :: VERSION=1.0 :: TYPE=FILE_DOCUMENTATION ===
 *
 * IDENTITY:
 *   file: "packages/shared/src/database/schema.ts"
 *   type: "model"
 *   layer: "shared"
 *   domain: "database"
 *   purpose: "Esquema completo PostgreSQL con Drizzle ORM para sistema multi-tenant. Define 8 tablas: tenants, adminUsers, endUsers, conversations, messages, messageReads, mentions, messageFeedback. Incluye índices para performance y relaciones 1:N/N:M. Usa denormalización en conversations (lastMessage) para optimización"
 *
 * DEPENDENCIES:
 *   internal: ["../types/message-envelope"]
 *   external: ["drizzle-orm/pg-core", "drizzle-orm"]
 *   infrastructure: ["PostgreSQL"]
 *
 * CONTRACTS:
 *   exports: ["AdminUser","Conversation","EndUser","Mention","Message","MessageFeedback","MessageRead","NewAdminUser","NewConversation","NewEndUser","NewMention","NewMessage","NewMessageFeedback","NewMessageRead","NewTenant","Tenant","adminUsers","adminUsersRelations","conversations","conversationsRelations","endUsers","endUsersRelations","mentions","mentionsRelations","messageFeedback","messageFeedbackRelations","messageReads","messageReadsRelations","messages","messagesRelations","tenants","tenantsRelations"]
 *   inputs: []
 *   outputs: ["Drizzle table definitions", "TypeScript types inferred from schema"]
 *   errors: []
 *
 * INTEGRATION:
 *   data_flow: "[schema definition] → [Drizzle ORM] → [PostgreSQL migrations] → [type-safe query builder in controllers]"
 *   events_emitted: []
 *   events_consumed: []
 *
 * IMPACT:
 *   used_by: ["database/config.ts", "routes/admin/*", "todos los controllers que acceden DB"]
 *   uses: ["../types/message-envelope"]
 *   critical: true
 *
 * === DOC_END :: schema.ts ===
 */

import { pgTable, uuid, text, timestamp, jsonb, varchar, boolean, integer, index } from 'drizzle-orm/pg-core';
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
  isPinned: boolean('is_pinned').default(false), // Conversación fijada
  unreadCount: integer('unread_count').default(0), // Contador de mensajes no leídos (desnormalizado)
  lastReadAt: timestamp('last_read_at'), // Última vez que el agente leyó la conversación

  // Campos desnormalizados de lastMessage (para performance)
  lastMessageId: uuid('last_message_id'), // Se actualiza con trigger
  lastMessageText: text('last_message_text'),
  lastMessageType: varchar('last_message_type', { length: 50 }),
  lastMessageAt: timestamp('last_message_at'),

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

// Tabla de mentions - Sistema universal de menciones (@username)
export const mentions = pgTable('mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  mentionedUserId: uuid('mentioned_user_id').references(() => adminUsers.id).notNull(), // Usuario mencionado
  mentionedByUserId: uuid('mentioned_by_user_id').references(() => adminUsers.id).notNull(), // Usuario que mencionó
  entityType: varchar('entity_type', {
    enum: ['message', 'conversation', 'feedback', 'note', 'assignment']
  }).notNull(), // Tipo de entidad donde se menciona
  entityId: uuid('entity_id').notNull(), // ID de la entidad (polimórfico)
  mentionType: varchar('mention_type', {
    enum: ['user', 'team', 'admins', 'everyone']
  }).default('user'), // Tipo de mención
  context: text('context'), // Texto donde aparece la mención (para preview)
  isRead: boolean('is_read').default(false), // Si el usuario ya vio la mención
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => {
  return {
    tenantIdx: index('mentions_tenant_id_idx').on(table.tenantId),
    mentionedUserIdx: index('mentions_mentioned_user_id_idx').on(table.mentionedUserId),
    entityIdx: index('mentions_entity_type_id_idx').on(table.entityType, table.entityId),
    isReadIdx: index('mentions_is_read_idx').on(table.isRead),
  };
});

// Tabla de feedback para mensajes (rating + comentarios)
export const messageFeedback = pgTable('message_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  messageId: uuid('message_id').references(() => messages.id).notNull(), // Mensaje al que se refiere
  givenByUserId: uuid('given_by_user_id').references(() => adminUsers.id).notNull(), // Usuario que da feedback
  rating: varchar('rating', { enum: ['positive', 'negative'] }), // Thumbs up/down
  comment: text('comment'), // Qué estuvo mal
  suggestedCorrection: text('suggested_correction'), // Cómo debió ser
  extensionId: varchar('extension_id', { length: 100 }), // Extensión que generó el mensaje
  metadata: jsonb('metadata').default({}), // Datos adicionales
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    tenantIdx: index('message_feedback_tenant_id_idx').on(table.tenantId),
    messageIdx: index('message_feedback_message_id_idx').on(table.messageId),
    extensionIdx: index('message_feedback_extension_id_idx').on(table.extensionId),
    ratingIdx: index('message_feedback_rating_idx').on(table.rating),
    givenByIdx: index('message_feedback_given_by_user_id_idx').on(table.givenByUserId),
  };
});

// Tabla de lecturas de mensajes - Tracking granular por usuario
export const messageReads = pgTable('message_reads', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').references(() => messages.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  readAt: timestamp('read_at').defaultNow(),
}, (table) => {
  return {
    messageIdx: index('message_reads_message_id_idx').on(table.messageId),
    userIdx: index('message_reads_user_id_idx').on(table.userId),
    compositeIdx: index('message_reads_composite_idx').on(table.messageId, table.userId),
    // UNIQUE constraint para evitar duplicados
    uniqueMessageUser: index('message_reads_message_user_unique').on(table.messageId, table.userId),
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
  readMessages: many(messageReads), // Mensajes leídos por este usuario
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

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sentByAdminUser: one(adminUsers, {
    fields: [messages.sentByAdminUserId],
    references: [adminUsers.id],
  }),
  feedback: many(messageFeedback),
  reads: many(messageReads), // Quiénes han leído este mensaje
}));

export const mentionsRelations = relations(mentions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [mentions.tenantId],
    references: [tenants.id],
  }),
  mentionedUser: one(adminUsers, {
    fields: [mentions.mentionedUserId],
    references: [adminUsers.id],
  }),
  mentionedByUser: one(adminUsers, {
    fields: [mentions.mentionedByUserId],
    references: [adminUsers.id],
  }),
}));

export const messageFeedbackRelations = relations(messageFeedback, ({ one }) => ({
  tenant: one(tenants, {
    fields: [messageFeedback.tenantId],
    references: [tenants.id],
  }),
  message: one(messages, {
    fields: [messageFeedback.messageId],
    references: [messages.id],
  }),
  givenByUser: one(adminUsers, {
    fields: [messageFeedback.givenByUserId],
    references: [adminUsers.id],
  }),
}));

export const messageReadsRelations = relations(messageReads, ({ one }) => ({
  message: one(messages, {
    fields: [messageReads.messageId],
    references: [messages.id],
  }),
  user: one(adminUsers, {
    fields: [messageReads.userId],
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

export type Mention = typeof mentions.$inferSelect;
export type NewMention = typeof mentions.$inferInsert;

export type MessageFeedback = typeof messageFeedback.$inferSelect;
export type NewMessageFeedback = typeof messageFeedback.$inferInsert;

export type MessageRead = typeof messageReads.$inferSelect;
export type NewMessageRead = typeof messageReads.$inferInsert;

// Legacy alias (mantener compatibilidad)
export type User = AdminUser;
export type NewUser = NewAdminUser;

// Mantener tabla users legacy por compatibilidad (deprecated)
export const users = adminUsers;