import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import { MockBroadcastChannel } from './test-utils.js';

// Mock fetch for registration
global.fetch = vi.fn();

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Multi-tab Support', () => {
  let workerify: Workerify;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockChannel: MockBroadcastChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    // Mock location for proper URL
    global.location = {
      origin: 'http://localhost:3000',
    } as unknown as Location;

    // Create a mock channel instance that will be used by Workerify
    mockChannel = new MockBroadcastChannel('workerify');
    // Replace the constructor to return our mock instance
    (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
      () => mockChannel,
    );

    workerify = new Workerify({ logger: false });
  });

  afterEach(() => {
    workerify.close();
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
      global.location = {
        origin: 'http://localhost:3000',
      } as unknown as Location;

      await workerify.listen();

      expect(mockFetch).toHaveBeenCalledWith('/__workerify/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('consumerId'),
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

      await workerify.listen();

      // Verify that the fetch was called correctly (which means clientId was processed)
      expect(mockFetch).toHaveBeenCalledWith('/__workerify/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.stringContaining('consumerId'),
      });
    });

    it('should send routes update after registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      workerify.get('/test', () => 'test response');

      await workerify.listen();

      // Check that routes were sent with proper structure
      const routeUpdateMessages = mockChannel.getRouteUpdateMessages();
      expect(routeUpdateMessages).toHaveLength(1);
      expect(routeUpdateMessages[0]).toEqual(
        expect.objectContaining({
          type: 'workerify:routes:update',
          consumerId: expect.stringMatching(/^consumer-[a-z0-9]+-\d+$/),
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
      await vi.advanceTimersByTimeAsync(5001);

      await listenPromise; // Should resolve due to timeout

      vi.useRealTimers();
    }, 15000);
  });

  describe('Message handling with consumerId', () => {
    it('should only handle messages for its own consumerId', async () => {
      // Add a route to trigger route update and get the consumerId
      workerify.get('/test', () => 'test response');
      workerify.updateRoutes();

      const consumerId = mockChannel.getLastConsumerId();
      expect(consumerId).toBeTruthy();

      // Clear previous messages
      mockChannel.lastMessages = [];

      // Message for this consumer - should be handled
      mockChannel.simulateMessage({
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

      // Message for different consumer - should be ignored
      mockChannel.simulateMessage({
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

      // Wait a bit for message processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only have one response message (for msg-1)
      const responseMessages = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responseMessages).toHaveLength(1);
      expect(responseMessages[0].id).toBe('msg-1');
    });
  });

  describe('Route registration behavior', () => {
    it('should not automatically update service worker when adding routes', () => {
      mockChannel.lastMessages = [];

      workerify.get('/test', () => 'test');
      workerify.post('/test', () => 'test');

      // Routes should not be sent to service worker automatically
      const routeUpdateMessages = mockChannel.getRouteUpdateMessages();
      expect(routeUpdateMessages).toHaveLength(0);
    });

    it('should update service worker only during listen()', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      workerify.get('/test1', () => 'test1');
      workerify.post('/test2', () => 'test2');

      mockChannel.lastMessages = [];

      // Set up a promise to send the acknowledgment after listen() starts
      const listenPromise = workerify.listen();

      // Send acknowledgment after a short delay to allow listen() to set up listeners
      await new Promise((resolve) => setTimeout(resolve, 10));

      await listenPromise;

      // Should send routes during listen
      const routeUpdateMessages = mockChannel.getRouteUpdateMessages();
      expect(routeUpdateMessages).toHaveLength(1);
      expect(routeUpdateMessages[0]).toEqual(
        expect.objectContaining({
          type: 'workerify:routes:update',
          consumerId: expect.stringMatching(/^consumer-[a-z0-9]+-\d+$/),
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
      // Create separate mock channels for each instance
      const mockChannel1 = new MockBroadcastChannel('workerify');
      const mockChannel2 = new MockBroadcastChannel('workerify');

      let channelCallCount = 0;
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => {
          channelCallCount++;
          return channelCallCount === 1 ? mockChannel1 : mockChannel2;
        },
      );

      const instance1 = new Workerify({ logger: false });
      const instance2 = new Workerify({ logger: false });

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

      // Start both listen() calls
      await Promise.all([instance1.listen(), instance2.listen()]);

      // Verify that both instances registered correctly
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Check that each instance sent route updates
      const routeMessages1 = mockChannel1.getRouteUpdateMessages();
      const routeMessages2 = mockChannel2.getRouteUpdateMessages();

      expect(routeMessages1).toHaveLength(1);
      expect(routeMessages2).toHaveLength(1);

      // Verify different consumer IDs
      const consumerId1 = routeMessages1[0].consumerId;
      const consumerId2 = routeMessages2[0].consumerId;

      expect(consumerId1).not.toBe(consumerId2);
      expect(consumerId1).toMatch(/^consumer-[a-z0-9]+-\d+$/);
      expect(consumerId2).toMatch(/^consumer-[a-z0-9]+-\d+$/);

      instance1.close();
      instance2.close();
    }, 15000);

    it('should maintain separate routes for each instance', () => {
      // Create separate mock channels for each instance
      const mockChannel1 = new MockBroadcastChannel('workerify');
      const mockChannel2 = new MockBroadcastChannel('workerify');

      let channelCallCount = 0;
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => {
          channelCallCount++;
          return channelCallCount === 1 ? mockChannel1 : mockChannel2;
        },
      );

      const instance1 = new Workerify({ logger: false });
      const instance2 = new Workerify({ logger: false });

      const handler1 = vi.fn(() => 'response1');
      const handler2 = vi.fn(() => 'response2');

      instance1.get('/shared', handler1);
      instance2.get('/shared', handler2);

      // Trigger route updates to check isolation
      instance1.updateRoutes();
      instance2.updateRoutes();

      const routes1 = mockChannel1.getRouteUpdateMessages();
      const routes2 = mockChannel2.getRouteUpdateMessages();

      // Each instance should have sent its own routes
      expect(routes1).toHaveLength(1);
      expect(routes2).toHaveLength(1);

      // Both should have the same path but different consumer IDs
      expect(routes1[0].routes[0].path).toBe('/shared');
      expect(routes2[0].routes[0].path).toBe('/shared');
      expect(routes1[0].consumerId).not.toBe(routes2[0].consumerId);

      instance1.close();
      instance2.close();
    });
  });

  describe('Update service worker routes', () => {
    it('should include consumerId in manual route updates', () => {
      workerify.get('/test', () => 'test');
      mockChannel.lastMessages = [];

      workerify.updateRoutes();

      const routeUpdateMessages = mockChannel.getRouteUpdateMessages();
      expect(routeUpdateMessages).toHaveLength(1);
      expect(routeUpdateMessages[0]).toEqual(
        expect.objectContaining({
          type: 'workerify:routes:update',
          consumerId: expect.stringMatching(/^consumer-[a-z0-9]+-\d+$/),
          routes: expect.any(Array),
        }),
      );
    });
  });
});
