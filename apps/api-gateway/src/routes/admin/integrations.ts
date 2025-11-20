/**
 * Admin Integrations Management Routes
 *
 * Endpoints:
 * - GET /admin/integrations - List integrations
 * - POST /admin/integrations/:type/connect - Connect integration
 * - DELETE /admin/integrations/:id - Disconnect integration
 *
 * Note: This is an MVP stub implementation. Real integrations will be stored
 * in a separate table when implemented.
 */

import { Elysia, t } from 'elysia';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { requireAuth, requireRole } from '../../middleware/auth';
import { httpLogger } from '../../middleware/logger';

// Mock integration data structure
interface Integration {
  id: string;
  type: 'whatsapp' | 'telegram' | 'instagram' | 'facebook' | 'email' | 'slack';
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  connectedAt?: string;
  settings?: Record<string, any>;
}

// In-memory store for MVP (replace with database later)
const integrationsStore: Map<string, Integration[]> = new Map();

/**
 * Integrations Management Routes
 */
export const adminIntegrationsRoutes = new Elysia({ prefix: '/admin/integrations' })
  .use(httpLogger)
  .use(requireAuth())

  // GET /admin/integrations - List all integrations
  .get(
    '/',
    async ({ user, error }) => {
      try {
        // Get integrations for this tenant (from in-memory store for MVP)
        const tenantIntegrations = integrationsStore.get(user.tenantId) || [];

        // Return available integrations with connection status
        const availableIntegrations = [
          {
            type: 'whatsapp',
            name: 'WhatsApp Business',
            description: 'Connect your WhatsApp Business account',
            icon: '💬',
            available: true,
          },
          {
            type: 'telegram',
            name: 'Telegram',
            description: 'Connect your Telegram bot',
            icon: '✈️',
            available: true,
          },
          {
            type: 'instagram',
            name: 'Instagram',
            description: 'Connect Instagram Direct Messages',
            icon: '📷',
            available: true,
          },
          {
            type: 'facebook',
            name: 'Facebook Messenger',
            description: 'Connect Facebook Messenger',
            icon: '📘',
            available: false, // Coming soon
          },
          {
            type: 'email',
            name: 'Email',
            description: 'Connect email support',
            icon: '📧',
            available: false, // Coming soon
          },
          {
            type: 'slack',
            name: 'Slack',
            description: 'Get notifications in Slack',
            icon: '💼',
            available: false, // Coming soon
          },
        ];

        return createSuccessResponse({
          integrations: tenantIntegrations,
          available: availableIntegrations,
          total: tenantIntegrations.length,
        });
      } catch (err: any) {
        console.error('List integrations error:', err);
        return error(500, createErrorResponse('FETCH_FAILED', 'Failed to fetch integrations'));
      }
    },
    {
      detail: {
        summary: 'List Integrations',
        description: 'Get list of all integrations with connection status',
        tags: ['Admin Integrations'],
      },
    }
  )

  // POST /admin/integrations/:type/connect - Connect integration
  .use(requireRole(['owner', 'admin']))
  .post(
    '/:type/connect',
    async ({ user, params, body, error }) => {
      const { type } = params;
      const { settings } = body;

      try {
        // Validate integration type
        const validTypes = ['whatsapp', 'telegram', 'instagram', 'facebook', 'email', 'slack'];
        if (!validTypes.includes(type)) {
          return error(400, createErrorResponse('INVALID_TYPE', `Invalid integration type: ${type}`));
        }

        // Check if already connected
        const tenantIntegrations = integrationsStore.get(user.tenantId) || [];
        const existing = tenantIntegrations.find((i) => i.type === type as any);

        if (existing) {
          return error(409, createErrorResponse('ALREADY_CONNECTED', 'Integration already connected'));
        }

        // Create new integration (MVP: store in memory)
        const newIntegration: Integration = {
          id: crypto.randomUUID(),
          type: type as any,
          name: getIntegrationName(type),
          status: 'connected',
          connectedAt: new Date().toISOString(),
          settings: settings || {},
        };

        // Store integration
        tenantIntegrations.push(newIntegration);
        integrationsStore.set(user.tenantId, tenantIntegrations);

        return createSuccessResponse({
          integration: newIntegration,
          message: `${getIntegrationName(type)} connected successfully`,
        });
      } catch (err: any) {
        console.error('Connect integration error:', err);
        return error(500, createErrorResponse('CONNECT_FAILED', 'Failed to connect integration'));
      }
    },
    {
      params: t.Object({
        type: t.String(),
      }),
      body: t.Object({
        settings: t.Optional(t.Any()),
      }),
      detail: {
        summary: 'Connect Integration',
        description: 'Connect a new integration (owner/admin only)',
        tags: ['Admin Integrations'],
      },
    }
  )

  // DELETE /admin/integrations/:id - Disconnect integration
  .delete(
    '/:id',
    async ({ user, params, error }) => {
      const { id } = params;

      try {
        // Get tenant integrations
        const tenantIntegrations = integrationsStore.get(user.tenantId) || [];
        const integrationIndex = tenantIntegrations.findIndex((i) => i.id === id);

        if (integrationIndex === -1) {
          return error(404, createErrorResponse('INTEGRATION_NOT_FOUND', 'Integration not found'));
        }

        // Remove integration
        const [removed] = tenantIntegrations.splice(integrationIndex, 1);
        integrationsStore.set(user.tenantId, tenantIntegrations);

        return createSuccessResponse({
          message: `${removed.name} disconnected successfully`,
          id: removed.id,
        });
      } catch (err: any) {
        console.error('Disconnect integration error:', err);
        return error(500, createErrorResponse('DISCONNECT_FAILED', 'Failed to disconnect integration'));
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      detail: {
        summary: 'Disconnect Integration',
        description: 'Disconnect an integration (owner/admin only)',
        tags: ['Admin Integrations'],
      },
    }
  );

// Helper function to get integration name
function getIntegrationName(type: string): string {
  const names: Record<string, string> = {
    whatsapp: 'WhatsApp Business',
    telegram: 'Telegram',
    instagram: 'Instagram',
    facebook: 'Facebook Messenger',
    email: 'Email',
    slack: 'Slack',
  };

  return names[type] || type;
}
