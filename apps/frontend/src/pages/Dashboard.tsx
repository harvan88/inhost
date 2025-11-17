import { useState, useEffect } from 'react';
import Header from '@components/Header';
import MessageList from '@components/MessageList';
import MessageInput from '@components/MessageInput';
import StatusCard from '@components/StatusCard';
import { apiClient } from '@services/api';
import { useWebSocket } from '@hooks/useWebSocket';

export default function Dashboard() {
  const [messages, setMessages] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // WebSocket connection
  const { connected, sendMessage } = useWebSocket({
    onMessage: (msg) => {
      console.log('WebSocket message:', msg);
      // Handle incoming WebSocket messages
      if (msg.type === 'new_message') {
        setMessages((prev) => [...prev, msg.data]);
      }
    },
  });

  // Load initial data
  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);

      // Load health status
      const healthData = await apiClient.getHealth();
      setHealth(healthData);

      // Load recent messages
      const messagesData = await apiClient.getMessages();
      setMessages(messagesData);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    try {
      const message = {
        type: 'outgoing' as const,
        channel: 'web' as const,
        content: { text: content },
        metadata: {
          from: 'web-user',
          to: 'system',
          timestamp: new Date().toISOString(),
        },
      };

      await apiClient.sendMessage(message);
      await loadDashboard(); // Reload messages
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatusCard
            title="API Status"
            value={health?.status || 'unknown'}
            color={health?.status === 'ok' ? 'green' : 'red'}
          />
          <StatusCard
            title="WebSocket"
            value={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'green' : 'yellow'}
          />
          <StatusCard
            title="Messages"
            value={messages.length.toString()}
            color="blue"
          />
        </div>

        {/* Messages Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Messages</h2>

          <MessageList messages={messages} />

          <div className="mt-6">
            <MessageInput onSend={handleSendMessage} />
          </div>
        </div>
      </main>
    </div>
  );
}
