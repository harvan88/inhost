/**
 * IOwnerChecker
 *
 * Contrato para verificar estado de conexión de owners.
 * Determina si un owner está online y en qué dispositivos.
 *
 * Implementaciones:
 * - V1: Basado en conexiones WebSocket activas
 * - V2: Redis presence con heartbeat
 * - V3: Multi-región con consensus
 */

export interface DeviceInfo {
  deviceId: string;
  type: 'web' | 'mobile' | 'desktop';
  platform?: string;
  connectedAt: string;
  lastActivity: string;
  metadata?: Record<string, unknown>;
}

export interface OwnerPresence {
  userId: string;
  isOnline: boolean;
  devices: DeviceInfo[];
  lastSeen?: string;
}

export interface IOwnerChecker {
  /**
   * Verifica si un owner está online
   */
  isOnline(userId: string): Promise<boolean>;

  /**
   * Obtiene información de presencia completa
   */
  getPresence(userId: string): Promise<OwnerPresence>;

  /**
   * Obtiene todos los dispositivos conectados de un owner
   */
  getActiveDevices(userId: string): Promise<DeviceInfo[]>;

  /**
   * Marca un owner como online
   */
  markOnline(userId: string, deviceInfo: DeviceInfo): Promise<void>;

  /**
   * Marca un owner como offline
   */
  markOffline(userId: string, deviceId?: string): Promise<void>;

  /**
   * Actualiza actividad del owner
   */
  updateActivity(userId: string, deviceId: string): Promise<void>;

  /**
   * Obtiene estadísticas de presencia
   */
  getStats(): Promise<{
    totalOnline: number;
    totalDevices: number;
    byPlatform: Record<string, number>;
  }>;
}
