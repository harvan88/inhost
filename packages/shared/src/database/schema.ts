import { pgTable, uuid, text, timestamp, jsonb, varchar, boolean, index } from 'drizzle-orm/pg-core';
import { MessageType, MessageChannel, MessageStatus } from '../types/message-envelope';

// Tabla de conversaciones
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: varchar('owner_id', { length: 255 }).notNull(),
  participant: varchar('participant', { length: 255 }).notNull(), // número de teléfono o ID de usuario
  channel: varchar('channel', { enum: ['whatsapp', 'telegram', 'web', 'sms'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    ownerIdx: index('conversations_owner_id_idx').on(table.ownerId),
    participantIdx: index('conversations_participant_idx').on(table.participant),
  };
});

// Tabla de mensajes
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id),
  type: varchar('type', { enum: ['incoming', 'outgoing', 'system', 'status'] }).notNull(),
  channel: varchar('channel', { enum: ['whatsapp', 'telegram', 'web', 'sms'] }).notNull(),
  content: jsonb('content').notNull(), // MessageContent
  metadata: jsonb('metadata').notNull(), // MessageMetadata
  statusChain: jsonb('status_chain').default([]), // MessageStatusEvent[]
  context: jsonb('context').notNull(), // MessageContext
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => {
  return {
    conversationIdx: index('messages_conversation_id_idx').on(table.conversationId),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  };
});

// Tabla de usuarios
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  name: varchar('name', { length: 255 }),
  plan: varchar('plan', { enum: ['free', 'premium'] }).default('free'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Tipos TypeScript inferidos
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;