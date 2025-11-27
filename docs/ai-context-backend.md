# Project Architecture Context

Generated: 2025-11-27T18:43:07.064Z

## Statistics

- **Total Files Documented:** 18
- **Critical Files:** 18
- **Total Dependencies:** 92

## Architecture Overview

### Layers

- **backend:** 14 files (14 critical)
- **shared:** 4 files (4 critical)

### Domains

- **database:** 4 files (4 critical)
- **messaging:** 2 files (2 critical)
- **api:** 4 files (4 critical)
- **auth:** 4 files (4 critical)
- **core:** 1 files (1 critical)
- **config:** 1 files (1 critical)
- **sync:** 2 files (2 critical)

## Critical Files

- **..\inhost-backend\apps\api-gateway\src\core\interfaces\IPersistenceService.ts** [backend/database]
  - Type: type
  - Exports: IPersistenceService, PersistenceResult, MessageQuery
- **..\inhost-backend\apps\api-gateway\src\core\MessageCore.ts** [backend/messaging]
  - Type: service
  - Exports: MessageCore, MessageCoreConfig
- **..\inhost-backend\apps\api-gateway\src\implementations\v1\MemoryPersistence.ts** [backend/database]
  - Type: service
  - Exports: MemoryPersistence
- **..\inhost-backend\apps\api-gateway\src\implementations\v1\MemoryRateLimiter.ts** [backend/api]
  - Type: service
  - Exports: MemoryRateLimiter
- **..\inhost-backend\apps\api-gateway\src\implementations\v2\DatabasePersistence.ts** [backend/database]
  - Type: service
  - Exports: DatabasePersistence
- **..\inhost-backend\apps\api-gateway\src\middleware\auth.ts** [backend/auth]
  - Type: service
  - Exports: requireAuth, optionalAuth, AuthContext
- **..\inhost-backend\apps\api-gateway\src\middleware\errorHandler.ts** [backend/core]
  - Type: middleware
  - Exports: AppError, ErrorCodes, StandardErrorResponse, createError, errorHandler
- **..\inhost-backend\apps\api-gateway\src\middleware\logger.ts** [backend/config]
  - Type: utility
  - Exports: Logger, logger, httpLogger, LogLevel
- **..\inhost-backend\apps\api-gateway\src\routes\admin\auth.ts** [backend/auth]
  - Type: controller
  - Exports: adminAuthRoutes
- **..\inhost-backend\apps\api-gateway\src\routes\admin\conversations.ts** [backend/api]
  - Type: controller
  - Exports: adminConversationsRoutes
- **..\inhost-backend\apps\api-gateway\src\routes\admin\sync.ts** [backend/sync]
  - Type: controller
  - Exports: adminSyncRoutes
- **..\inhost-backend\apps\api-gateway\src\routes\index.ts** [backend/api]
  - Type: controller
  - Exports: routes
- **..\inhost-backend\apps\api-gateway\src\routes\websocket.ts** [backend/sync]
  - Type: controller
  - Exports: websocketRoutes, broadcastToAll
- **..\inhost-backend\apps\api-gateway\src\services\index.ts** [backend/api]
  - Type: service
  - Exports: adapterManager, rateLimiter, messageQueue, validator, persistence, notifications, planResolver, ownerChecker, messageCore, initializeServices, shutdownServices
- **..\inhost-backend\packages\shared\src\auth\jwt.ts** [shared/auth]
  - Type: utility
  - Exports: AdminJWTPayload, createToken, verifyToken, createRefreshToken, extractTokenFromHeader
- **..\inhost-backend\packages\shared\src\auth\password.ts** [shared/auth]
  - Type: utility
  - Exports: hashPassword, verifyPassword, validatePasswordStrength
- **..\inhost-backend\packages\shared\src\database\schema.ts** [shared/database]
  - Type: model
  - Exports: AdminUser, Conversation, EndUser, Mention, Message, MessageFeedback, MessageRead, NewAdminUser, NewConversation, NewEndUser, NewMention, NewMessage, NewMessageFeedback, NewMessageRead, NewTenant, Tenant, adminUsers, adminUsersRelations, conversations, conversationsRelations, endUsers, endUsersRelations, mentions, mentionsRelations, messageFeedback, messageFeedbackRelations, messageReads, messageReadsRelations, messages, messagesRelations, tenants, tenantsRelations
- **..\inhost-backend\packages\shared\src\types\message-envelope.ts** [shared/messaging]
  - Type: type
  - Exports: MessageEnvelopeV2, MessageType, MessageChannel, MessageStatus, MessageContent, MessageMetadata, MessageStatusEvent, MessageContext

## Layer-Domain Matrix

| Layer \ Domain | database | messaging | api | auth | core | config | sync |
|------|---|---|---|---|---|---|---|
| backend | 3 | 1 | 4 | 2 | 1 | 1 | 2 |
| shared | 1 | 1 | - | 2 | - | - | - |
