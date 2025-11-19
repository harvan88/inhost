/**
 * ConnectionOwnerChecker (V1)
 *
 * Implementación simple de verificación de presencia.
 * Basado en conexiones WebSocket activas.
 *
 * Características V1:
 * - Tracking en memoria
 * - Sincronizado con WebSocketNotification
 * - Ideal para single-server
 *
 * V2 usará Redis con heartbeat
 * V3 agregará multi-región con consensus
 */

import type {
  IOwnerChecker,
  DeviceInfo,
  OwnerPresence
} from '../../core/interfaces';
import { logger } from '../../middleware/logger';

export class ConnectionOwnerChecker implements IOwnerChecker {
  // userId -> Set<deviceId>
  private userDevices: Map<string, Map<string, DeviceInfo>> = new Map();
  private cleanupInterval?: Timer;

  async isOnline(userId: string): Promise<boolean> {
    const devices = this.userDevices.get(userId);
    const online = devices !== undefined && devices.size > 0;

    logger.debug('👤 Owner online check', { userId, online, deviceCount: devices?.size || 0 });

    return online;
  }

  async getPresence(userId: string): Promise<OwnerPresence> {
    const devices = this.userDevices.get(userId);
    const isOnline = devices !== undefined && devices.size > 0;

    const deviceList: DeviceInfo[] = devices
      ? Array.from(devices.values())
      : [];

    // Obtener lastSeen del dispositivo más reciente
    let lastSeen: string | undefined;
    if (deviceList.length > 0) {
      lastSeen = deviceList.reduce((latest, device) => {
        return device.lastActivity > latest ? device.lastActivity : latest;
      }, deviceList[0].lastActivity);
    }

    return {
      userId,
      isOnline,
      devices: deviceList,
      lastSeen
    };
  }

  async getActiveDevices(userId: string): Promise<DeviceInfo[]> {
    const devices = this.userDevices.get(userId);
    return devices ? Array.from(devices.values()) : [];
  }

  async markOnline(userId: string, deviceInfo: DeviceInfo): Promise<void> {
    let devices = this.userDevices.get(userId);

    if (!devices) {
      devices = new Map();
      this.userDevices.set(userId, devices);
    }

    devices.set(deviceInfo.deviceId, {
      ...deviceInfo,
      lastActivity: new Date().toISOString()
    });

    logger.info('👤 Owner marked online', {
      userId,
      deviceId: deviceInfo.deviceId,
      type: deviceInfo.type,
      totalDevices: devices.size
    });
  }

  async markOffline(userId: string, deviceId?: string): Promise<void> {
    const devices = this.userDevices.get(userId);

    if (!devices) {
      return;
    }

    if (deviceId) {
      // Remover dispositivo específico
      devices.delete(deviceId);

      logger.info('👤 Device marked offline', {
        userId,
        deviceId,
        remainingDevices: devices.size
      });

      // Si no quedan dispositivos, remover usuario
      if (devices.size === 0) {
        this.userDevices.delete(userId);
      }
    } else {
      // Remover todos los dispositivos del usuario
      this.userDevices.delete(userId);

      logger.info('👤 Owner marked offline (all devices)', {
        userId
      });
    }
  }

  async updateActivity(userId: string, deviceId: string): Promise<void> {
    const devices = this.userDevices.get(userId);

    if (devices) {
      const device = devices.get(deviceId);

      if (device) {
        device.lastActivity = new Date().toISOString();

        logger.debug('🔄 Device activity updated', {
          userId,
          deviceId
        });
      }
    }
  }

  async getStats(): Promise<{
    totalOnline: number;
    totalDevices: number;
    byPlatform: Record<string, number>;
  }> {
    let totalDevices = 0;
    const byPlatform: Record<string, number> = {};

    for (const devices of this.userDevices.values()) {
      for (const device of devices.values()) {
        totalDevices++;

        const platform = device.platform || device.type;
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      }
    }

    return {
      totalOnline: this.userDevices.size,
      totalDevices,
      byPlatform
    };
  }

  /**
   * Limpia dispositivos inactivos (llamar periódicamente)
   */
  cleanupInactiveDevices(inactivityThresholdMinutes: number = 30): void {
    try {
      const now = new Date();
      const threshold = inactivityThresholdMinutes * 60 * 1000;

      let cleanedCount = 0;

      for (const [userId, devices] of this.userDevices.entries()) {
        for (const [deviceId, device] of devices.entries()) {
          const lastActivity = new Date(device.lastActivity);
          const inactiveTime = now.getTime() - lastActivity.getTime();

          if (inactiveTime > threshold) {
            devices.delete(deviceId);
            cleanedCount++;

            logger.debug('🧹 Inactive device removed', {
              userId,
              deviceId,
              inactiveMinutes: Math.floor(inactiveTime / 60000)
            });
          }
        }

        // Si no quedan dispositivos, remover usuario
        if (devices.size === 0) {
          this.userDevices.delete(userId);
        }
      }

      if (cleanedCount > 0) {
        logger.info('🧹 Cleanup completed', {
          devicesRemoved: cleanedCount,
          remainingUsers: this.userDevices.size
        });
      }
    } catch (error) {
      logger.error('Device cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Inicia limpieza automática periódica
   */
  startAutoCleanup(intervalMinutes: number = 5): void {
    // Prevenir múltiples intervals
    if (this.cleanupInterval) {
      logger.warn('Device cleanup already started');
      return;
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveDevices(30); // Limpiar inactivos de 30+ minutos
    }, intervalMinutes * 60 * 1000);

    logger.info('🧹 Auto cleanup started', {
      intervalMinutes,
      inactivityThreshold: 30
    });
  }

  /**
   * Detener limpieza automática periódica
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      logger.info('🧹 Device cleanup stopped');
    }
  }
}
