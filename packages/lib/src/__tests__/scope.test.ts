import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import { MockBroadcastChannel } from './test-utils.js';

// Mock fetch for testing
global.fetch = vi.fn();

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Scope as Route Prefix', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockChannel: MockBroadcastChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;

    // Mock successful registration
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ clientId: 'test-client' }),
    });
  });

  describe('Scope normalization', () => {
    it('should normalize scope with leading slash', () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: 'api' });
      const handler = vi.fn(() => 'response');
      workerify.get('/users', handler);

      // The route should be registered as /api/users
      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(0); // Routes sent only after listen()

      workerify.close();
    });

    it('should normalize scope without trailing slash', () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api/' });
      const handler = vi.fn(() => 'response');
      workerify.get('/users', handler);

      workerify.close();
    });

    it('should handle root scope as empty prefix', () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/' });
      const handler = vi.fn(() => 'response');
      workerify.get('/users', handler);

      workerify.close();
    });
  });

  describe('Route registration with scope', () => {
    it('should prefix all GET routes with scope', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api/v1' });
      const handler = vi.fn(() => 'response');

      workerify.get('/users', handler);
      workerify.get('/posts', handler);

      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/api/v1/users');
      expect(routes[1].path).toBe('/api/v1/posts');

      workerify.close();
    });

    it('should prefix all HTTP methods with scope', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api' });
      const handler = vi.fn(() => 'response');

      workerify.get('/users', handler);
      workerify.post('/users', handler);
      workerify.put('/users/:id', handler);
      workerify.delete('/users/:id', handler);
      workerify.patch('/users/:id', handler);

      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(5);
      expect(routes[0].path).toBe('/api/users');
      expect(routes[1].path).toBe('/api/users');
      expect(routes[2].path).toBe('/api/users/:id');
      expect(routes[3].path).toBe('/api/users/:id');
      expect(routes[4].path).toBe('/api/users/:id');

      workerify.close();
    });

    it('should prefix wildcard routes with scope', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api' });
      const handler = vi.fn(() => 'response');

      workerify.get('/static/*', handler);

      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/static/');
      expect(routes[0].match).toBe('prefix');

      workerify.close();
    });

    it('should prefix routes registered with route() method', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api' });
      const handler = vi.fn(() => 'response');

      workerify.route({
        method: 'GET',
        path: '/custom',
        handler,
      });

      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/custom');

      workerify.close();
    });
  });

  describe('Route matching with scope', () => {
    it('should match requests to scoped routes', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api/v1', logger: false });
      const handler = vi.fn(() => ({ message: 'success' }));

      workerify.get('/users', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Simulate a request to the scoped path
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/api/v1/users',
          method: 'GET',
          headers: {},
          params: {},
          query: {},
        },
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledOnce();

      workerify.close();
    });

    it('should not match requests without scope prefix', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api', logger: false });
      const handler = vi.fn(() => ({ message: 'success' }));

      workerify.get('/users', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Simulate a request without the scope prefix
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users',
          method: 'GET',
          headers: {},
          params: {},
          query: {},
        },
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Handler should not be called
      expect(handler).not.toHaveBeenCalled();

      // Should send 404 response
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(404);

      workerify.close();
    });

    it('should match parameterized routes with scope', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api', logger: false });
      const handler = vi.fn((request) => ({ id: request.params.id }));

      workerify.get('/users/:id', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Simulate a request to the scoped parameterized path
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/api/users/123',
          method: 'GET',
          headers: {},
          params: {},
          query: {},
        },
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].params.id).toBe('123');

      workerify.close();
    });
  });

  describe('Nested scope paths', () => {
    it('should handle deep scope paths', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api/v2/admin' });
      const handler = vi.fn(() => 'response');

      workerify.get('/users', handler);

      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/v2/admin/users');

      workerify.close();
    });

    it('should handle scope with path having parameters', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api/v1', logger: false });
      const handler = vi.fn((request) => ({
        userId: request.params.userId,
        postId: request.params.postId,
      }));

      workerify.get('/users/:userId/posts/:postId', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Simulate a request
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/api/v1/users/456/posts/789',
          method: 'GET',
          headers: {},
          params: {},
          query: {},
        },
      });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].params.userId).toBe('456');
      expect(handler.mock.calls[0][0].params.postId).toBe('789');

      workerify.close();
    });
  });

  describe('No scope (default behavior)', () => {
    it('should work without scope (backward compatibility)', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });
      const handler = vi.fn(() => 'response');

      workerify.get('/users', handler);

      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/users');

      workerify.close();
    });
  });
});
