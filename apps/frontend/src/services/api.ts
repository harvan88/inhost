/**
 * API Client for INHOST API Gateway
 * Connects to http://localhost:3000 via Vite proxy (/api -> http://localhost:3000)
 */

const API_BASE = '/api'; // Proxied to localhost:3000 by Vite

interface MessagePayload {
  type: 'incoming' | 'outgoing' | 'system';
  channel: 'whatsapp' | 'telegram' | 'web' | 'sms';
  content: {
    text: string;
  };
  metadata: {
    from: string;
    to: string;
    timestamp: string;
  };
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * GET /health - Check API health
   */
  async getHealth() {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * POST /messages - Send a message
   */
  async sendMessage(message: MessagePayload) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': 'web-user', // Required for rate limiting
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `Failed to send message: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * GET /messages - Retrieve messages
   */
  async getMessages(limit = 50) {
    const response = await fetch(`${this.baseUrl}/messages?limit=${limit}`, {
      headers: {
        'X-User-Id': 'web-user',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get messages: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(API_BASE);
