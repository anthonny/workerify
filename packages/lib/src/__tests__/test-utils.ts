import { vi } from 'vitest';
import type {
  BroadcastMessage,
  WorkerifyReply,
  WorkerifyRequest,
} from '../types.js';

// Comprehensive Mock BroadcastChannel for testing
export class MockBroadcastChannel {
  private listeners: Map<string, Array<(event: MessageEvent) => void>> =
    new Map();
  public name: string;
  public postMessage = vi.fn();
  public close = vi.fn();
  public lastMessages: BroadcastMessage[] = [];

  constructor(name: string) {
    this.name = name;
    // Override postMessage to capture messages
    this.postMessage = vi.fn((message: BroadcastMessage) => {
      this.lastMessages.push(message);
      // Auto-respond to certain message types to simulate service worker
      if (message.type === 'workerify:routes:update') {
        setTimeout(() => {
          this.simulateMessage({
            type: 'workerify:routes:update:response',
            consumerId: message.consumerId,
          });
        }, 10);
      }
      if (message.type === 'workerify:sw:check-readiness') {
        setTimeout(() => {
          this.simulateMessage({
            type: 'workerify:sw:check-readiness:response',
            body: true,
          });
        }, 10);
      }
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)?.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    if (handler) {
      this.addEventListener('message', handler);
    }
  }

  // Helper to simulate receiving a message
  simulateMessage(data: unknown) {
    const event = new MessageEvent('message', { data });
    this.listeners.get('message')?.forEach((listener) => {
      listener(event);
    });
  }

  // Helper to get the consumer ID from route update messages
  getLastConsumerId(): string | null {
    const routeUpdateMessage = this.lastMessages.find(
      (msg) => msg.type === 'workerify:routes:update',
    );
    return routeUpdateMessage?.consumerId || null;
  }

  // Helper to get route update messages
  getRouteUpdateMessages() {
    return this.lastMessages.filter(
      (msg) => msg.type === 'workerify:routes:update',
    );
  }

  // Helper to get specific routes from route update messages
  getRoutes() {
    const routeMessages = this.getRouteUpdateMessages();
    if (routeMessages.length === 0) return [];
    return routeMessages[routeMessages.length - 1]?.routes || [];
  }
}

// Helper to create mock requests
export function createMockRequest(
  method: string = 'GET',
  url: string = 'http://localhost:3000/',
  headers: Record<string, string> = {},
  body?: ArrayBuffer,
): WorkerifyRequest {
  return {
    url,
    method: method as
      | 'GET'
      | 'POST'
      | 'PUT'
      | 'DELETE'
      | 'PATCH'
      | 'HEAD'
      | 'OPTIONS',
    headers: {
      'user-agent': 'test',
      ...headers,
    },
    body: body || null,
    params: {},
  };
}

// Helper to create mock replies
export function createMockReply(): WorkerifyReply {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    bodyType: 'json',
  };
}

// Setup global mocks for BroadcastChannel
export function setupBroadcastChannelMock() {
  // @ts-expect-error
  global.BroadcastChannel = MockBroadcastChannel;
}

// Cleanup function
export function cleanup() {
  // Reset any global state if needed
}

// Wait for async operations to complete
export function waitForAsync(ms: number = 10) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Convert string to ArrayBuffer for testing
export function stringToArrayBuffer(str: string): ArrayBuffer {
  const encoder = new TextEncoder();
  return encoder.encode(str).buffer;
}

// Convert ArrayBuffer to string for testing
export function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}
