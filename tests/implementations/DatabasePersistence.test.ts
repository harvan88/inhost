/**
 * DatabasePersistence Tests
 *
 * Tests for the DatabasePersistence implementation (V2).
 * Verifies message storage, retrieval, and tenant isolation.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { DatabasePersistence } from '../../apps/api-gateway/src/implementations/v2/DatabasePersistence';
import { MessageChannel } from '@inhost/shared';
import { randomEmail, randomTenantName } from '../setup';

describe('DatabasePersistence', () => {
  let persistence: DatabasePersistence;

  beforeEach(() => {
    persistence = new DatabasePersistence();
  });

  describe('Message Storage', () => {
    it('should store a message successfully', async () => {
      const message = {
        id: `msg-${Date.now()}`,
        conversationId: `conv-${Date.now()}`,
        tenantId: `tenant-${Date.now()}`,
        channel: MessageChannel.WHATSAPP,
        direction: 'inbound' as const,
        content: {
          text: 'Hello, test message',
        },
        sender: {
          id: 'user123',
          name: 'Test User',
        },
        timestamp: new Date(),
        status: 'received' as const,
      };

      await persistence.save(message);

      // Verify message was saved by retrieving it
      const retrieved = await persistence.getById(message.id, message.tenantId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(message.id);
      expect(retrieved?.content.text).toBe('Hello, test message');
    });

    it('should retrieve messages by conversation', async () => {
      const conversationId = `conv-${Date.now()}`;
      const tenantId = `tenant-${Date.now()}`;

      const message1 = {
        id: `msg-1-${Date.now()}`,
        conversationId,
        tenantId,
        channel: MessageChannel.WHATSAPP,
        direction: 'inbound' as const,
        content: { text: 'First message' },
        sender: { id: 'user123', name: 'Test User' },
        timestamp: new Date(),
        status: 'received' as const,
      };

      const message2 = {
        id: `msg-2-${Date.now()}`,
        conversationId,
        tenantId,
        channel: MessageChannel.WHATSAPP,
        direction: 'outbound' as const,
        content: { text: 'Second message' },
        sender: { id: 'admin456', name: 'Admin User' },
        timestamp: new Date(),
        status: 'sent' as const,
      };

      await persistence.save(message1);
      await persistence.save(message2);

      const messages = await persistence.getByConversation(conversationId, tenantId);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages.some((m) => m.id === message1.id)).toBe(true);
      expect(messages.some((m) => m.id === message2.id)).toBe(true);
    });
  });

  describe('Tenant Isolation', () => {
    it('should not allow cross-tenant message access', async () => {
      const messageId = `msg-${Date.now()}`;
      const tenantId1 = `tenant-1-${Date.now()}`;
      const tenantId2 = `tenant-2-${Date.now()}`;

      const message = {
        id: messageId,
        conversationId: `conv-${Date.now()}`,
        tenantId: tenantId1,
        channel: MessageChannel.WHATSAPP,
        direction: 'inbound' as const,
        content: { text: 'Tenant 1 message' },
        sender: { id: 'user123', name: 'Test User' },
        timestamp: new Date(),
        status: 'received' as const,
      };

      await persistence.save(message);

      // Try to retrieve with wrong tenantId
      const retrieved = await persistence.getById(messageId, tenantId2);
      expect(retrieved).toBeNull();

      // Verify it exists with correct tenantId
      const validRetrieval = await persistence.getById(messageId, tenantId1);
      expect(validRetrieval).toBeDefined();
      expect(validRetrieval?.id).toBe(messageId);
    });
  });

  describe('Message Updates', () => {
    it('should update message status', async () => {
      const messageId = `msg-${Date.now()}`;
      const tenantId = `tenant-${Date.now()}`;

      const message = {
        id: messageId,
        conversationId: `conv-${Date.now()}`,
        tenantId,
        channel: MessageChannel.WHATSAPP,
        direction: 'outbound' as const,
        content: { text: 'Test message' },
        sender: { id: 'admin123', name: 'Admin' },
        timestamp: new Date(),
        status: 'pending' as const,
      };

      await persistence.save(message);

      // Update status
      await persistence.updateStatus(messageId, tenantId, 'sent');

      const updated = await persistence.getById(messageId, tenantId);
      expect(updated?.status).toBe('sent');
    });
  });
});
