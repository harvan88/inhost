/**
 * Capabilities Routes
 *
 * Rutas para consultar y gestionar capacidades de usuario.
 * El frontend usa estos endpoints para:
 * - Ver qué servicios tiene habilitados
 * - Verificar límites y cuotas
 * - Monitorear uso actual
 *
 * @module routes/capabilities
 */

import { Elysia } from 'elysia';
import { serviceGate } from '../../services';
import { createCapabilitiesRoutes, createAdminCapabilitiesRoutes } from '../capabilities';

/**
 * Rutas públicas de capacidades
 */
export const capabilitiesRoutes = new Elysia()
  .use(createCapabilitiesRoutes({ serviceGate }));

/**
 * Rutas administrativas (futuro: requieren auth)
 */
export const adminCapabilitiesRoutes = new Elysia()
  .use(createAdminCapabilitiesRoutes({ serviceGate }));
