#!/usr/bin/env bun
/**
 * Seed Database - Poblar base de datos con datos de prueba
 *
 * Uso:
 *   bun scripts/seed-database.ts
 */

import { db, tenants, adminUsers, endUsers, conversations, messages, hashPassword } from '@inhost/shared';
import { eq } from 'drizzle-orm';

const TEST_PASSWORD = 'password123'; // Contraseña de prueba

async function seedDatabase() {
  console.log('🌱 Iniciando seed de base de datos...\n');

  try {
    // 1. Crear/obtener tenant de prueba
    console.log('📦 Creando tenant de prueba...');

    let tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, 'test-company'),
    });

    if (!tenant) {
      [tenant] = await db.insert(tenants).values({
        name: 'Test Company',
        slug: 'test-company',
        plan: 'professional',
        subscriptionStatus: 'active',
      }).returning();
      console.log('✅ Tenant creado:', tenant.name);
    } else {
      console.log('ℹ️  Tenant ya existe:', tenant.name);
    }

    // 2. Crear usuario admin de prueba
    console.log('\n👤 Creando usuario admin de prueba...');

    let adminUser = await db.query.adminUsers.findFirst({
      where: eq(adminUsers.email, 'admin@test.com'),
    });

    if (!adminUser) {
      const passwordHash = await hashPassword(TEST_PASSWORD);
      [adminUser] = await db.insert(adminUsers).values({
        tenantId: tenant.id,
        email: 'admin@test.com',
        passwordHash,
        name: 'Admin Test',
        role: 'owner',
        isActive: true,
      }).returning();
      console.log('✅ Usuario admin creado:', adminUser.email);
    } else {
      console.log('ℹ️  Usuario admin ya existe:', adminUser.email);
    }

    // 3. Crear usuarios finales (clientes)
    console.log('\n👥 Creando clientes de prueba...');

    const clientsData = [
      { externalId: '+1234567890', name: 'Juan Pérez', channel: 'whatsapp' },
      { externalId: '+0987654321', name: 'María García', channel: 'whatsapp' },
      { externalId: 'telegram-123456', name: 'Pedro López', channel: 'telegram' },
      { externalId: 'web-user-001', name: 'Ana Martínez', channel: 'web' },
    ];

    const createdClients = [];
    for (const clientData of clientsData) {
      let client = await db.query.endUsers.findFirst({
        where: eq(endUsers.externalId, clientData.externalId),
      });

      if (!client) {
        [client] = await db.insert(endUsers).values({
          tenantId: tenant.id,
          externalId: clientData.externalId,
          channel: clientData.channel as any,
          name: clientData.name,
          email: `${clientData.name.toLowerCase().replace(' ', '.')}@example.com`,
          metadata: {},
          tags: [],
        }).returning();
        console.log(`✅ Cliente creado: ${client.name} (${client.channel})`);
      } else {
        console.log(`ℹ️  Cliente ya existe: ${client.name}`);
      }
      createdClients.push(client);
    }

    // 4. Crear conversaciones
    console.log('\n💬 Creando conversaciones de prueba...');

    const createdConversations = [];
    for (const client of createdClients) {
      let conversation = await db.query.conversations.findFirst({
        where: eq(conversations.endUserId, client.id),
      });

      if (!conversation) {
        [conversation] = await db.insert(conversations).values({
          tenantId: tenant.id,
          endUserId: client.id,
          channel: client.channel as any,
          status: 'active',
          assignedToId: adminUser.id,
          unreadCount: 0,
          metadata: {},
        }).returning();
        console.log(`✅ Conversación creada con ${client.name}`);
      } else {
        console.log(`ℹ️  Conversación ya existe con ${client.name}`);
      }
      createdConversations.push({ conversation, client });
    }

    // 5. Crear mensajes de ejemplo
    console.log('\n📨 Creando mensajes de prueba...');

    let messageCount = 0;
    for (const { conversation, client } of createdConversations) {
      // Verificar si ya hay mensajes
      const existingMessages = await db.query.messages.findFirst({
        where: eq(messages.conversationId, conversation.id),
      });

      if (!existingMessages) {
        // Mensaje entrante del cliente
        await db.insert(messages).values({
          conversationId: conversation.id,
          type: 'incoming',
          channel: conversation.channel as any,
          content: {
            text: `Hola! Necesito ayuda con mi pedido. - ${client.name}`,
          },
          metadata: {
            from: client.externalId,
            to: 'admin',
            timestamp: new Date(Date.now() - 3600000).toISOString(), // Hace 1 hora
          },
          statusChain: [],
          context: {},
        });

        // Mensaje saliente del admin
        await db.insert(messages).values({
          conversationId: conversation.id,
          type: 'outgoing',
          channel: conversation.channel as any,
          content: {
            text: `Hola ${client.name}! Claro, con gusto te ayudo. ¿Cuál es tu número de pedido?`,
          },
          metadata: {
            from: 'admin',
            to: client.externalId,
            timestamp: new Date(Date.now() - 3000000).toISOString(), // Hace 50 min
          },
          statusChain: [],
          context: {},
          sentByAdminUserId: adminUser.id,
        });

        // Mensaje más reciente del cliente
        await db.insert(messages).values({
          conversationId: conversation.id,
          type: 'incoming',
          channel: conversation.channel as any,
          content: {
            text: `Es el pedido #12345. ¿Cuándo llega?`,
          },
          metadata: {
            from: client.externalId,
            to: 'admin',
            timestamp: new Date(Date.now() - 1800000).toISOString(), // Hace 30 min
          },
          statusChain: [],
          context: {},
        });

        messageCount += 3;
        console.log(`✅ 3 mensajes creados para conversación con ${client.name}`);
      } else {
        console.log(`ℹ️  Mensajes ya existen para conversación con ${client.name}`);
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('✅ SEED COMPLETADO EXITOSAMENTE');
    console.log('='.repeat(60));
    console.log(`\n📊 Resumen:`);
    console.log(`   • Tenant: ${tenant.name}`);
    console.log(`   • Usuario admin: ${adminUser.email}`);
    console.log(`   • Password: ${TEST_PASSWORD}`);
    console.log(`   • Clientes creados: ${createdClients.length}`);
    console.log(`   • Conversaciones: ${createdConversations.length}`);
    console.log(`   • Mensajes nuevos: ${messageCount}`);

    console.log('\n🔑 Credenciales de prueba:');
    console.log('   Email:    admin@test.com');
    console.log('   Password: password123');

    console.log('\n🚀 Ahora puedes:');
    console.log('   1. Iniciar el backend: bun --cwd apps/api-gateway dev');
    console.log('   2. Login en frontend con: admin@test.com / password123');
    console.log('   3. Ver las conversaciones y mensajes de prueba\n');

  } catch (error) {
    console.error('\n❌ Error durante el seed:', error);
    throw error;
  }
}

// Ejecutar seed
seedDatabase()
  .then(() => {
    console.log('✅ Proceso completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
