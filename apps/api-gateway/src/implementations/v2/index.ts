/**
 * V2 Implementations (Sprint 4)
 *
 * Implementaciones persistentes con Redis/PostgreSQL.
 * Resuelven limitaciones de V1 (race conditions, pérdida de datos).
 */

export { RedisRateLimiter } from './RedisRateLimiter';
export { DatabasePersistence } from './DatabasePersistence';
