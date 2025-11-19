/**
 * Mentions Parser
 *
 * Parser universal para detectar menciones (@username) en cualquier string del sistema.
 * Soporta menciones a usuarios individuales y menciones especiales (@team, @admins, @everyone).
 *
 * Uso:
 *   import { parseMentions, resolveMentions } from './utils/mentions-parser';
 *
 *   const mentions = parseMentions('Hola @john, necesito ayuda de @team');
 *   // => ['@john', '@team']
 *
 *   const users = await resolveMentions(mentions, tenantId, db);
 *   // => [{ id: 'uuid-john', username: 'john', type: 'user' }, ...]
 */

import { db, adminUsers, type AdminUser } from '@inhost/shared';
import { eq, and, inArray } from 'drizzle-orm';

// Tipos de mención soportados
export type MentionType = 'user' | 'team' | 'admins' | 'everyone';

// Patrón regex para detectar menciones
// Detecta: @username, @team, @admins, @everyone
// Username debe empezar con letra y puede contener letras, números, guiones y underscores
const MENTION_PATTERN = /@([a-zA-Z][a-zA-Z0-9_-]*)/g;

// Menciones especiales (no son usuarios individuales)
const SPECIAL_MENTIONS = ['team', 'admins', 'everyone'] as const;

export interface ParsedMention {
  raw: string; // '@john'
  username: string; // 'john'
  type: MentionType;
  position: number; // Posición en el string
}

export interface ResolvedMention {
  username: string;
  type: MentionType;
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
  }>;
}

/**
 * Parse mentions from text
 *
 * @param text - Texto que puede contener menciones
 * @returns Array de menciones parseadas con metadatos
 *
 * @example
 * parseMentions('Hey @john and @maria, please review this')
 * // => [
 * //   { raw: '@john', username: 'john', type: 'user', position: 4 },
 * //   { raw: '@maria', username: 'maria', type: 'user', position: 14 }
 * // ]
 */
export function parseMentions(text: string): ParsedMention[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const mentions: ParsedMention[] = [];
  const seen = new Set<string>(); // Evitar duplicados

  let match: RegExpExecArray | null;

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const raw = match[0]; // '@john'
    const username = match[1].toLowerCase(); // 'john'

    // Evitar duplicados
    if (seen.has(username)) {
      continue;
    }
    seen.add(username);

    // Determinar tipo de mención
    const type: MentionType = (SPECIAL_MENTIONS as readonly string[]).includes(username)
      ? (username as typeof SPECIAL_MENTIONS[number])
      : 'user';

    mentions.push({
      raw,
      username,
      type,
      position: match.index,
    });
  }

  return mentions;
}

/**
 * Resolve mentions to actual users
 *
 * @param mentions - Menciones parseadas
 * @param tenantId - ID del tenant para resolver usuarios
 * @returns Array de menciones resueltas con usuarios
 *
 * @example
 * const mentions = parseMentions('Hey @john, cc @team');
 * const resolved = await resolveMentions(mentions, tenantId);
 * // => [
 * //   {
 * //     username: 'john',
 * //     type: 'user',
 * //     users: [{ id: 'uuid', name: 'John Doe', ... }]
 * //   },
 * //   {
 * //     username: 'team',
 * //     type: 'team',
 * //     users: [{ id: 'uuid1', ... }, { id: 'uuid2', ... }]
 * //   }
 * // ]
 */
export async function resolveMentions(
  mentions: ParsedMention[],
  tenantId: string
): Promise<ResolvedMention[]> {
  const resolved: ResolvedMention[] = [];

  for (const mention of mentions) {
    let users: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
    }> = [];

    if (mention.type === 'user') {
      // Buscar usuario específico por nombre (case insensitive)
      // Nota: Asumimos que el username es el nombre o email del usuario
      const user = await db.query.adminUsers.findFirst({
        where: and(
          eq(adminUsers.tenantId, tenantId),
          eq(adminUsers.isActive, true)
        ),
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      // TODO: Implementar búsqueda más sofisticada:
      // - Por username field (agregar campo username a adminUsers)
      // - Por nombre parcial
      // - Por email
      // Por ahora, si encuentra uno con nombre similar, lo usa
      const allUsers = await db.query.adminUsers.findMany({
        where: and(
          eq(adminUsers.tenantId, tenantId),
          eq(adminUsers.isActive, true)
        ),
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      // Buscar por nombre o email que contenga el username
      const matched = allUsers.find(u =>
        u.name.toLowerCase().includes(mention.username) ||
        u.email.toLowerCase().includes(mention.username)
      );

      if (matched) {
        users = [matched];
      }
    } else if (mention.type === 'team') {
      // @team = todos los usuarios activos del tenant
      const teamUsers = await db.query.adminUsers.findMany({
        where: and(
          eq(adminUsers.tenantId, tenantId),
          eq(adminUsers.isActive, true)
        ),
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      users = teamUsers;
    } else if (mention.type === 'admins') {
      // @admins = solo owners y admins
      const adminRoles = await db.query.adminUsers.findMany({
        where: and(
          eq(adminUsers.tenantId, tenantId),
          eq(adminUsers.isActive, true)
        ),
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      users = adminRoles.filter(u => u.role === 'owner' || u.role === 'admin');
    } else if (mention.type === 'everyone') {
      // @everyone = todos (igual que @team)
      const allUsers = await db.query.adminUsers.findMany({
        where: and(
          eq(adminUsers.tenantId, tenantId),
          eq(adminUsers.isActive, true)
        ),
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      users = allUsers;
    }

    resolved.push({
      username: mention.username,
      type: mention.type,
      users,
    });
  }

  return resolved;
}

/**
 * Extract context around a mention for preview
 *
 * @param text - Texto completo
 * @param position - Posición de la mención
 * @param contextLength - Longitud del contexto (caracteres antes y después)
 * @returns String con contexto alrededor de la mención
 *
 * @example
 * extractContext('This is a long message with @john mentioned here', 25, 10)
 * // => '...message with @john mentioned...'
 */
export function extractContext(
  text: string,
  position: number,
  contextLength: number = 50
): string {
  const start = Math.max(0, position - contextLength);
  const end = Math.min(text.length, position + contextLength);

  let context = text.slice(start, end);

  if (start > 0) context = '...' + context;
  if (end < text.length) context = context + '...';

  return context;
}

/**
 * Parse and resolve mentions in one call
 *
 * @param text - Texto que puede contener menciones
 * @param tenantId - ID del tenant
 * @returns Menciones resueltas con usuarios
 */
export async function parseAndResolveMentions(
  text: string,
  tenantId: string
): Promise<ResolvedMention[]> {
  const parsed = parseMentions(text);
  return resolveMentions(parsed, tenantId);
}

/**
 * Create mentions in database for detected mentions in text
 *
 * @param text - Texto que puede contener menciones
 * @param entityType - Tipo de entidad donde se menciona
 * @param entityId - ID de la entidad
 * @param tenantId - ID del tenant
 * @param mentionedByUserId - ID del usuario que menciona
 * @returns Array de menciones creadas
 *
 * @example
 * // Cuando se crea un mensaje con texto
 * await createMentionsFromText(
 *   'Hey @john, can you help?',
 *   'message',
 *   messageId,
 *   tenantId,
 *   currentUserId
 * );
 */
export async function createMentionsFromText(
  text: string,
  entityType: 'message' | 'conversation' | 'feedback' | 'note' | 'assignment',
  entityId: string,
  tenantId: string,
  mentionedByUserId: string
): Promise<Array<{ id: string; mentionedUserId: string }>> {
  // Parse mentions from text
  const parsed = parseMentions(text);

  if (parsed.length === 0) {
    return [];
  }

  // Resolve mentions to actual users
  const resolved = await resolveMentions(parsed, tenantId);

  // Create mention records in database
  const { mentions: mentionsTable } = await import('@inhost/shared');
  const createdMentions: Array<{ id: string; mentionedUserId: string }> = [];

  for (const mention of resolved) {
    // Skip if no users found
    if (mention.users.length === 0) {
      continue;
    }

    // Create mention for each user
    for (const user of mention.users) {
      // Extract context around mention
      const mentionPosition = parsed.find(p => p.username === mention.username)?.position || 0;
      const context = extractContext(text, mentionPosition, 50);

      // Insert mention
      const [created] = await db.insert(mentionsTable).values({
        tenantId,
        mentionedUserId: user.id,
        mentionedByUserId,
        entityType,
        entityId,
        mentionType: mention.type,
        context,
        isRead: false,
      }).returning({ id: mentionsTable.id, mentionedUserId: mentionsTable.mentionedUserId });

      createdMentions.push(created);

      // Send notification to mentioned user (in-app notification)
      // This will trigger UI to update mentions badge/count
      // Note: WebSocket broadcast should be implemented where this function is called
      // to avoid circular dependencies
    }
  }

  return createdMentions;
}
