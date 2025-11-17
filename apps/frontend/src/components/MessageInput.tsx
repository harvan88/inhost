import { useState } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
}

export default function MessageInput({ onSend }: MessageInputProps) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim() || isSending) return;

    setIsSending(true);
    try {
      await onSend(text);
      setText(''); // Clear input on success
    } catch (error) {
      console.error('Failed to send:', error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your message..."
        disabled={isSending}
        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={!text.trim() || isSending}
        className="px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-blue-600 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {isSending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
