import { Elysia, t } from 'elysia';
import { 
  MessageType, 
  MessageChannel, 
  db, 
  messages, 
  type NewMessage,
  type MessageContext 
} from '@inhost/shared';
import { desc } from 'drizzle-orm';

const app = new Elysia()
  .get('/', () => 'Inhost API Gateway 🚀')
  
  .post('/message', 
    async ({ body }) => {
      console.log('📨 Message received:', body);
      
      // Crear un nuevo mensaje en PostgreSQL
      const newMessage: NewMessage = {
        type: body.type,
        channel: body.channel,
        content: body.content,
        metadata: body.metadata,
        statusChain: [{ 
          status: 'received', 
          timestamp: new Date().toISOString(), 
          messageId: crypto.randomUUID() 
        }],
        context: {
          plan: 'free',
          timestamp: new Date().toISOString()
        } as MessageContext
      };

      try {
        const [insertedMessage] = await db.insert(messages).values(newMessage).returning();
        
        console.log('💾 Message saved to PostgreSQL:', insertedMessage.id);
        
        return { 
          status: 'received', 
          messageId: insertedMessage.id,
          timestamp: new Date().toISOString(),
          storage: 'postgresql'
        };
      } catch (error) {
        console.error('❌ Database error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { 
          status: 'error', 
          error: errorMessage,
          timestamp: new Date().toISOString()
        };
      }
    },
    {
      body: t.Object({
        type: t.Enum(MessageType),
        channel: t.Enum(MessageChannel),
        content: t.Object({
          text: t.String()
        }),
        metadata: t.Object({
          from: t.String(),
          to: t.String(),
          timestamp: t.String()
        })
      })
    }
  )
  
  .get('/messages', async () => {
    try {
      const allMessages = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(10);
      return {
        count: allMessages.length,
        messages: allMessages,
        storage: 'postgresql'
      };
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { error: 'Failed to fetch messages: ' + errorMessage };
    }
  })
  
  .get('/health', async () => {
    try {
      // Probar conexión a PostgreSQL
      await db.select().from(messages).limit(1);
      return { 
        status: 'healthy', 
        database: 'postgresql',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { 
        status: 'unhealthy', 
        database: 'disconnected',
        error: errorMessage,
        timestamp: new Date().toISOString()
      };
    }
  })
  
  .ws('/realtime', {
    message(ws, message: any) {
      ws.send(JSON.stringify({
        type: 'echo',
        data: message,
        timestamp: new Date().toISOString()
      }));
    }
  })
  
  .listen(3000);

console.log(`🦊 Elysia is running at http://localhost:3000`);
console.log(`🗄️  PostgreSQL: CONECTADO Y OPERATIVO`);
console.log(`📊 Tablas: conversations, messages`);

export type App = typeof app;