import { vi } from 'vitest';

// Global mocks
global.fetch = vi.fn();
global.location = { origin: 'http://localhost:3000' } as any;

// Mock BroadcastChannel
class MockBroadcastChannel {
  private listeners: Map<string, Array<(event: MessageEvent) => void>> = new Map();
  public name: string;
  public postMessage = vi.fn();
  public close = vi.fn();

  constructor(name: string) {
    this.name = name;
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
}

// @ts-ignore
global.BroadcastChannel = MockBroadcastChannel;

// Default mock for fetch to resolve properly
beforeEach(() => {
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ clientId: 'test-client-id' })
  });

  // Auto-acknowledge route updates to prevent timeouts
  setTimeout(() => {
    const channels = (global as any).mockChannels || [];
    channels.forEach((channel: any) => {
      if (channel && channel.simulateMessage) {
        channel.simulateMessage({
          type: 'workerify:routes:update:response',
          consumerId: 'test-consumer-id'
        });
      }
    });
  }, 10);
});