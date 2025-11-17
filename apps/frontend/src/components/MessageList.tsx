interface Message {
  id: string;
  type: 'incoming' | 'outgoing' | 'system';
  channel: string;
  content: {
    text: string;
  };
  metadata: {
    from: string;
    to: string;
    timestamp: string;
  };
}

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No messages yet. Send your first message below!
      </div>
    );
  }

  return (
    <div className="space-y-4 max-h-96 overflow-y-auto">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`p-4 rounded-lg border ${
            message.type === 'incoming'
              ? 'bg-blue-50 border-blue-200'
              : message.type === 'outgoing'
              ? 'bg-green-50 border-green-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-1 text-xs font-semibold rounded bg-white border">
                {message.channel.toUpperCase()}
              </span>
              <span className="px-2 py-1 text-xs font-semibold rounded bg-white border">
                {message.type.toUpperCase()}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {new Date(message.metadata.timestamp).toLocaleString()}
            </span>
          </div>

          <p className="text-gray-900 mb-2">{message.content.text}</p>

          <div className="text-xs text-gray-600">
            <span className="font-semibold">From:</span> {message.metadata.from}
            {' • '}
            <span className="font-semibold">To:</span> {message.metadata.to}
          </div>
        </div>
      ))}
    </div>
  );
}
