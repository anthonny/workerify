import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';

// Mock fetch for registration
global.fetch = vi.fn();

// Mock BroadcastChannel
class MockBroadcastChannel {
  private listeners: Map<string, Array<(event: MessageEvent) => void>> =
    new Map();
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

  // Helper to simulate receiving a message
  simulateMessage(data: unknown) {
    const event = new MessageEvent('message', { data });
    this.listeners.get('message')?.forEach((listener) => {
      listener(event);
    });
  }
}

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Multi-tab Support', () => {
  let workerify: Workerify;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    // Mock location for proper URL
    global.location = {
      origin: 'http://localhost:3000',
    } as unknown as Location;
    workerify = new Workerify({ logger: false });
  });

  afterEach(() => {
    workerify.close();
  });

  describe('Consumer ID Generation', () => {
    it('should generate unique consumerId for each instance', () => {
      const instance1 = new Workerify({ logger: false });
      const instance2 = new Workerify({ logger: false });

      // Access private property through type assertion
      const consumerId1 = (instance1 as { consumerId: string }).consumerId;
      const consumerId2 = (instance2 as { consumerId: string }).consumerId;

      expect(consumerId1).toBeDefined();
      expect(consumerId2).toBeDefined();
      expect(consumerId1).not.toBe(consumerId2);
      expect(consumerId1).toMatch(/^consumer-[a-z0-9]+-\d+$/);

      instance1.close();
      instance2.close();
    });

    it('should maintain the same consumerId throughout instance lifetime', () => {
      const consumerId = (workerify as any).consumerId;

      // Register routes
      workerify.get('/test', () => 'test');
      workerify.post('/test', () => 'test');

      // Consumer ID should remain the same
      expect((workerify as any).consumerId).toBe(consumerId);
    });
  });

  describe('Async listen() method', () => {
    it('should return a promise', () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      const result = workerify.listen();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should register with service worker via fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      // Mock location for proper URL
      global.location = { origin: 'http://localhost:3000' } as any;

      // Simulate routes update acknowledgment
      setTimeout(() => {
        const channel = (workerify as any).channel as MockBroadcastChannel;
        channel.simulateMessage({
          type: 'workerify:routes:update:response',
          consumerId: (workerify as any).consumerId,
        });
      }, 10);

      await workerify.listen();

      expect(mockFetch).toHaveBeenCalledWith('/__workerify/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consumerId: (workerify as any).consumerId }),
      });
    });

    it('should handle registration failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(workerify.listen()).rejects.toThrow(
        'Registration failed: 500',
      );
    });

    it('should store clientId after successful registration', async () => {
      const testClientId = 'test-client-id-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: testClientId }),
      });

      setTimeout(() => {
        const channel = (workerify as any).channel as MockBroadcastChannel;
        channel.simulateMessage({
          type: 'workerify:routes:update:response',
          consumerId: (workerify as any).consumerId,
        });
      }, 10);

      await workerify.listen();
      expect((workerify as any).clientId).toBe(testClientId);
    });

    it('should send routes update after registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      workerify.get('/test', () => 'test response');

      const channel = (workerify as any).channel as MockBroadcastChannel;

      // Simulate acknowledgment after a delay
      setTimeout(() => {
        channel.simulateMessage({
          type: 'workerify:routes:update:response',
          consumerId: (workerify as any).consumerId,
        });
      }, 10);

      await workerify.listen();

      // Check that routes were sent with consumerId
      expect(channel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workerify:routes:update',
          consumerId: (workerify as any).consumerId,
          routes: expect.arrayContaining([
            expect.objectContaining({
              path: '/test',
              method: 'GET',
            }),
          ]),
        }),
      );
    });

    it('should handle timeout when waiting for routes acknowledgment', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      const listenPromise = workerify.listen();

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(5001);

      await listenPromise; // Should resolve due to timeout

      vi.useRealTimers();
    }, 15000);
  });

  describe('Message handling with consumerId', () => {
    it('should only handle messages for its own consumerId', () => {
      const consumerId = (workerify as any).consumerId;
      const channel = (workerify as any).channel as MockBroadcastChannel;
      const handleRequestSpy = vi.spyOn(workerify as any, 'handleRequest');

      // Message for this consumer
      channel.simulateMessage({
        type: 'workerify:handle',
        id: 'msg-1',
        consumerId: consumerId,
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      // Message for different consumer
      channel.simulateMessage({
        type: 'workerify:handle',
        id: 'msg-2',
        consumerId: 'different-consumer',
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      expect(handleRequestSpy).toHaveBeenCalledTimes(1);
      expect(handleRequestSpy).toHaveBeenCalledWith(
        'msg-1',
        expect.any(Object),
      );
    });
  });

  describe('Route registration behavior', () => {
    it('should not automatically update service worker when adding routes', () => {
      const channel = (workerify as any).channel as MockBroadcastChannel;
      channel.postMessage.mockClear();

      workerify.get('/test', () => 'test');
      workerify.post('/test', () => 'test');

      // Routes should not be sent to service worker automatically
      expect(channel.postMessage).not.toHaveBeenCalled();
    });

    it('should update service worker only during listen()', async () => {
      const channel = (workerify as any).channel as MockBroadcastChannel;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      workerify.get('/test1', () => 'test1');
      workerify.post('/test2', () => 'test2');

      channel.postMessage.mockClear();

      setTimeout(() => {
        channel.simulateMessage({
          type: 'workerify:routes:update:response',
          consumerId: (workerify as any).consumerId,
        });
      }, 10);

      await workerify.listen();

      // Should send routes during listen
      expect(channel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workerify:routes:update',
          consumerId: (workerify as any).consumerId,
          routes: expect.arrayContaining([
            expect.objectContaining({ path: '/test1', method: 'GET' }),
            expect.objectContaining({ path: '/test2', method: 'POST' }),
          ]),
        }),
      );
    }, 15000);
  });

  describe('Multiple instances isolation', () => {
    it('should allow multiple instances to coexist', async () => {
      const instance1 = new Workerify({ logger: false });
      const instance2 = new Workerify({ logger: false });

      const consumerId1 = (instance1 as any).consumerId;
      const consumerId2 = (instance2 as any).consumerId;

      instance1.get('/api/v1', () => 'v1');
      instance2.get('/api/v2', () => 'v2');

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ clientId: 'client-1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ clientId: 'client-2' }),
        });

      // Simulate acknowledgments
      setTimeout(() => {
        const channel1 = (instance1 as any).channel as MockBroadcastChannel;
        channel1.simulateMessage({
          type: 'workerify:routes:update:response',
          consumerId: consumerId1,
        });
      }, 10);

      setTimeout(() => {
        const channel2 = (instance2 as any).channel as MockBroadcastChannel;
        channel2.simulateMessage({
          type: 'workerify:routes:update:response',
          consumerId: consumerId2,
        });
      }, 20);

      await Promise.all([instance1.listen(), instance2.listen()]);

      expect((instance1 as any).clientId).toBe('client-1');
      expect((instance2 as any).clientId).toBe('client-2');

      instance1.close();
      instance2.close();
    }, 15000);

    it('should maintain separate routes for each instance', () => {
      const instance1 = new Workerify({ logger: false });
      const instance2 = new Workerify({ logger: false });

      const handler1 = vi.fn(() => 'response1');
      const handler2 = vi.fn(() => 'response2');

      instance1.get('/shared', handler1);
      instance2.get('/shared', handler2);

      // Each instance should have its own routes
      const routes1 = (instance1 as any).routes;
      const routes2 = (instance2 as any).routes;

      expect(routes1).toHaveLength(1);
      expect(routes2).toHaveLength(1);
      expect(routes1[0].handler).toBe(handler1);
      expect(routes2[0].handler).toBe(handler2);

      instance1.close();
      instance2.close();
    });
  });

  describe('Update service worker routes', () => {
    it('should include consumerId in manual route updates', () => {
      const channel = (workerify as any).channel as MockBroadcastChannel;

      workerify.get('/test', () => 'test');
      channel.postMessage.mockClear();

      workerify.updateRoutes();

      expect(channel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workerify:routes:update',
          consumerId: (workerify as any).consumerId,
          routes: expect.any(Array),
        }),
      );
    });
  });
});
