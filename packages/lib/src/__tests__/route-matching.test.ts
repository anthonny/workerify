import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import type { HttpMethod } from '../types.js';
import { MockBroadcastChannel } from './test-utils.js';

// Mock fetch for testing
global.fetch = vi.fn();

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Route Matching Logic', () => {
  let workerify: Workerify;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockChannel: MockBroadcastChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = global.fetch as ReturnType<typeof vi.fn>;

    // Create a mock channel instance that will be used by Workerify
    mockChannel = new MockBroadcastChannel('workerify');
    // Replace the constructor to return our mock instance
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

  describe('Exact path matching', () => {
    it('should match exact paths', async () => {
      const handler = vi.fn(() => 'matched');
      workerify.get('/users', handler);

      await workerify.listen();

      // Simulate a request to the exact path
      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      // Wait for message processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check that a response was sent
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
    });

    it('should not match different paths', async () => {
      const handler = vi.fn(() => 'users');
      workerify.get('/users', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/posts',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(404); // Not found
    });

    it('should not match partial paths', async () => {
      workerify.get('/users', () => 'users');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/123',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(404);
    });

    it('should handle root path', async () => {
      workerify.get('/', () => 'home');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
    });

    it('should be case sensitive', async () => {
      workerify.get('/Users', () => 'users');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users', // lowercase
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(404); // Case mismatch
    });
  });

  describe('Parameterized route matching', () => {
    it('should match single parameter routes', async () => {
      const handler = vi.fn((req) => `User ${req.params.id}`);
      workerify.get('/users/:id', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/123',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
      expect(responses[0].body).toBe('User 123');
    });

    it('should match multiple parameter routes', async () => {
      const handler = vi.fn(
        (req) => `User ${req.params.userId}, Post ${req.params.postId}`,
      );
      workerify.get('/users/:userId/posts/:postId', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/123/posts/456',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
      expect(responses[0].body).toBe('User 123, Post 456');
    });

    it('should match parameters with special characters', async () => {
      const handler = vi.fn((req) => `ID: ${req.params.id}`);
      workerify.get('/users/:id', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/abc-123_def',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
      expect(responses[0].body).toBe('ID: abc-123_def');
    });

    it('should not match routes with different segment counts', async () => {
      workerify.get('/users/:id', () => 'user');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/123/extra',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(404);
    });

    it('should not match when static parts differ', async () => {
      workerify.get('/users/:id/posts', () => 'posts');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/123/comments',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(404);
    });
  });

  describe('Wildcard/prefix matching', () => {
    it('should match prefix routes', async () => {
      workerify.get('/api/*', () => 'api endpoint');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Test various paths under /api/
      const paths = ['/api/v1', '/api/v1/users', '/api/v2/posts/123'];

      for (const path of paths) {
        mockChannel.lastMessages = [];
        mockChannel.simulateMessage({
          type: 'workerify:handle',
          id: `req-${path}`,
          consumerId,
          request: {
            url: `http://localhost:3000${path}`,
            method: 'GET',
            headers: {},
            body: null,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        const responses = mockChannel.lastMessages.filter(
          (msg) => msg.type === 'workerify:response',
        );
        expect(responses).toHaveLength(1);
        expect(responses[0].status).toBe(200);
        expect(responses[0].body).toBe('api endpoint');
      }
    });
  });

  describe('HTTP method routing', () => {
    it('should match correct HTTP method', async () => {
      workerify.get('/users', () => 'get users');
      workerify.post('/users', () => 'create user');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Test GET
      mockChannel.lastMessages = [];
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-get',
        consumerId,
        request: {
          url: 'http://localhost:3000/users',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      let responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toBe('get users');

      // Test POST
      mockChannel.lastMessages = [];
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-post',
        consumerId,
        request: {
          url: 'http://localhost:3000/users',
          method: 'POST',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toBe('create user');
    });

    it('should handle method mismatch', async () => {
      workerify.get('/users', () => 'users');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users',
          method: 'POST', // Wrong method
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(404);
    });

    it('should match ALL method routes regardless of request method', async () => {
      workerify.all('/api', () => 'any method');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

      for (const method of methods) {
        mockChannel.lastMessages = [];
        mockChannel.simulateMessage({
          type: 'workerify:handle',
          id: `req-${method}`,
          consumerId,
          request: {
            url: 'http://localhost:3000/api',
            method: method as HttpMethod,
            headers: {},
            body: null,
          },
        });

        await new Promise((resolve) => setTimeout(resolve, 10));

        const responses = mockChannel.lastMessages.filter(
          (msg) => msg.type === 'workerify:response',
        );
        expect(responses).toHaveLength(1);
        expect(responses[0].status).toBe(200);
        expect(responses[0].body).toBe('any method');
      }
    });
  });

  describe('Query parameters and fragments', () => {
    it('should handle query parameters in URL', async () => {
      const handler = vi.fn(() => 'users');
      workerify.get('/users', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users?page=1&limit=10',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
    });

    it('should handle URL fragments', async () => {
      workerify.get('/users', () => 'users');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users#section',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
    });
  });

  describe('Route priority', () => {
    it('should match first registered route when multiple match', async () => {
      // Register wildcard first, then specific
      workerify.get('/api/*', () => 'wildcard');
      workerify.get('/api/users', () => 'specific');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/api/users',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].body).toBe('wildcard'); // First registered wins
    });
  });

  describe('Edge cases', () => {
    it('should handle paths with trailing slashes', async () => {
      workerify.get('/users/', () => 'with slash');

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Test with trailing slash
      mockChannel.lastMessages = [];
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      let responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].status).toBe(200);

      // Test without trailing slash
      mockChannel.lastMessages = [];
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-2',
        consumerId,
        request: {
          url: 'http://localhost:3000/users',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].status).toBe(404); // No match without slash
    });

    it('should handle Unicode characters in paths', async () => {
      const handler = vi.fn((req) => `ID: ${req.params.ïd}`);
      workerify.get('/üsers/:ïd', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/üsers/123',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0].status).toBe(200);
      expect(responses[0].body).toBe('ID: 123');
    });
  });
});
