import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import type { RouteHandler } from '../types.js';
import { MockBroadcastChannel } from './test-utils.js';

// Mock fetch for testing
global.fetch = vi.fn();

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Workerify', () => {
  let workerify: Workerify;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockChannel: MockBroadcastChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;

    // Create a mock channel instance that will be used by Workerify
    mockChannel = new MockBroadcastChannel('workerify');
    // Replace the constructor to return our mock instance
    // @ts-expect-error - Mocking global BroadcastChannel for testing
    (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
      () => mockChannel,
    );

    workerify = new Workerify({ logger: false });

    // Mock successful registration
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ clientId: 'test-client' }),
    });
  });

  afterEach(() => {
    workerify.close();
  });

  describe('Constructor and basic setup', () => {
    it('should create instance with default options', () => {
      const instance = new Workerify();
      expect(instance).toBeInstanceOf(Workerify);
      instance.close();
    });

    it('should create instance with custom options', () => {
      const instance = new Workerify({ logger: true, scope: '/api' });
      expect(instance).toBeInstanceOf(Workerify);
      instance.close();
    });

    it('should support method chaining', () => {
      const result = workerify
        .get('/test', () => 'test')
        .post('/test', () => 'test')
        .put('/test', () => 'test');

      expect(result).toBe(workerify);
    });
  });

  describe('Route registration', () => {
    it('should register GET route', () => {
      const handler = vi.fn();
      workerify.get('/test', handler);

      // Should not throw and should return the instance for chaining
      expect(workerify.get('/another', handler)).toBe(workerify);
    });

    it('should register POST route', () => {
      const handler = vi.fn();
      expect(() => workerify.post('/test', handler)).not.toThrow();
    });

    it('should register PUT route', () => {
      const handler = vi.fn();
      expect(() => workerify.put('/test', handler)).not.toThrow();
    });

    it('should register DELETE route', () => {
      const handler = vi.fn();
      expect(() => workerify.delete('/test', handler)).not.toThrow();
    });

    it('should register PATCH route', () => {
      const handler = vi.fn();
      expect(() => workerify.patch('/test', handler)).not.toThrow();
    });

    it('should register HEAD route', () => {
      const handler = vi.fn();
      expect(() => workerify.head('/test', handler)).not.toThrow();
    });

    it('should register OPTIONS route', () => {
      const handler = vi.fn();
      expect(() => workerify.option('/test', handler)).not.toThrow();
    });

    it('should register ALL methods route', () => {
      const handler = vi.fn();
      expect(() => workerify.all('/test', handler)).not.toThrow();
    });

    it('should handle wildcard routes', () => {
      const handler = vi.fn();
      expect(() => workerify.get('/api/*', handler)).not.toThrow();
    });

    it('should register route with custom configuration', () => {
      const handler = vi.fn();
      expect(() =>
        workerify.route({
          method: 'GET',
          path: '/test',
          handler,
          match: 'prefix',
        }),
      ).not.toThrow();
    });
  });

  describe('Plugin system', () => {
    it('should register synchronous plugin', async () => {
      const plugin = vi.fn();
      await workerify.register(plugin);
      expect(plugin).toHaveBeenCalledWith(workerify, undefined);
    });

    it('should register asynchronous plugin', async () => {
      const plugin = vi.fn().mockResolvedValue(undefined);
      await workerify.register(plugin, { option: 'value' });
      expect(plugin).toHaveBeenCalledWith(workerify, { option: 'value' });
    });

    it('should handle plugin errors', async () => {
      const plugin = vi.fn().mockRejectedValue(new Error('Plugin error'));
      await expect(workerify.register(plugin)).rejects.toThrow('Plugin error');
    });
  });

  describe('Server lifecycle', () => {
    it('should start listening', async () => {
      // Mock fetch for registration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      await expect(workerify.listen()).resolves.not.toThrow();
    });

    it('should update routes manually', () => {
      expect(() => workerify.updateRoutes()).not.toThrow();
    });

    it('should close cleanly', () => {
      expect(() => workerify.close()).not.toThrow();
    });
  });

  describe('Path processing', () => {
    it('should handle exact path matching', async () => {
      const handler = vi.fn();
      workerify.get('/exact/path', handler);

      // Mock fetch for registration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      await expect(workerify.listen()).resolves.not.toThrow();
    });

    it('should handle prefix path matching with wildcard', async () => {
      const handler = vi.fn();
      workerify.get('/prefix/*', handler);

      // Mock fetch for registration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      await expect(workerify.listen()).resolves.not.toThrow();
    });

    it('should handle parameterized paths', async () => {
      const handler = vi.fn();
      workerify.get('/users/:id', handler);
      workerify.get('/users/:id/posts/:postId', handler);

      // Mock fetch for registration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      await expect(workerify.listen()).resolves.not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid route handlers gracefully', () => {
      // Test with null handler (should not crash)
      expect(() => {
        workerify.get('/test', null as unknown as RouteHandler);
      }).not.toThrow();
    });

    it('should handle duplicate route registration', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      workerify.get('/test', handler1);
      // Should not throw when registering same path again
      expect(() => workerify.get('/test', handler2)).not.toThrow();
    });
  });

  describe('Integration with BroadcastChannel', () => {
    it('should NOT send route updates when routes are registered (deferred to listen)', async () => {
      // Clear any existing messages
      mockChannel.lastMessages = [];

      workerify.get('/test', () => 'test');

      // Should NOT have sent routes update message (deferred to listen)
      const routeMessages = mockChannel.getRouteUpdateMessages();
      expect(routeMessages).toHaveLength(0);
    });

    it('should update service worker routes on listen', async () => {
      workerify.get('/test1', () => 'test1');
      workerify.post('/test2', () => 'test2');

      // Clear any existing messages
      mockChannel.lastMessages = [];

      // Mock fetch for registration
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      await workerify.listen();

      // Should send routes update on listen
      const routeMessages = mockChannel.getRouteUpdateMessages();
      expect(routeMessages).toHaveLength(1);
      expect(routeMessages[0]).toMatchObject({
        type: 'workerify:routes:update',
        consumerId: expect.stringMatching(/.+/),
        routes: expect.arrayContaining([
          expect.objectContaining({ path: '/test1', method: 'GET' }),
          expect.objectContaining({ path: '/test2', method: 'POST' }),
        ]),
      });
    });
  });
});
