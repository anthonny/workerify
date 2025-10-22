import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import { MockBroadcastChannel } from './test-utils.js';

// Mock fetch for testing
global.fetch = vi.fn();

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Request Handling', () => {
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

  describe('Basic request handling', () => {
    it('should handle simple GET request', async () => {
      const handler = vi.fn().mockReturnValue('Hello World');
      workerify.get('/test', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/test',
          method: 'GET',
          params: {},
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      // Verify response was sent
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        id: 'req-1',
        body: 'Hello World',
        bodyType: 'text',
        status: 200,
      });
    });

    it('should handle POST request with JSON body', async () => {
      const handler = vi.fn().mockReturnValue({ success: true });
      workerify.post('/api/data', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/api/data',
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalled();

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        body: { success: true },
        bodyType: 'json',
        status: 200,
      });
    });

    it('should handle request with parameters', async () => {
      const handler = vi.fn((req) => `User ${req.params.id} found`);
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

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/users/123',
          method: 'GET',
          params: { id: '123' },
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toBe('User 123 found');
    });

    it('should handle 404 for non-existent routes', async () => {
      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/nonexistent',
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
      expect(responses[0]).toMatchObject({
        status: 404,
        body: { error: 'Route not found' },
        bodyType: 'json',
      });
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue({ data: 'async result' });
      workerify.get('/async', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/async',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 20));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toEqual({ data: 'async result' });
    });

    it('should handle ArrayBuffer responses', async () => {
      const buffer = new ArrayBuffer(8);
      const handler = vi.fn().mockReturnValue(buffer);
      workerify.get('/binary', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/binary',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0]).toMatchObject({
        body: buffer,
        bodyType: 'arrayBuffer',
      });
    });
  });

  describe('Query parameters handling', () => {
    it('should parse single query parameter', async () => {
      const handler = vi.fn((req) => `Got param: ${req.query.name}`);
      workerify.get('/test', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/test?name=John',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:3000/test?name=John',
          method: 'GET',
          query: { name: 'John' },
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toBe('Got param: John');
    });

    it('should parse multiple query parameters', async () => {
      const handler = vi.fn((req) => ({
        name: req.query.name,
        age: req.query.age,
        city: req.query.city,
      }));
      workerify.get('/user', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/user?name=John&age=30&city=NYC',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { name: 'John', age: '30', city: 'NYC' },
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toEqual({
        name: 'John',
        age: '30',
        city: 'NYC',
      });
    });

    it('should handle requests without query parameters', async () => {
      const handler = vi.fn(
        (req) => `Has params: ${Object.keys(req.query).length > 0}`,
      );
      workerify.get('/test', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {},
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toBe('Has params: false');
    });

    it('should handle URL-encoded query parameters', async () => {
      const handler = vi.fn((req) => req.query);
      workerify.get('/search', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/search?q=hello%20world&filter=active%26verified',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          query: { q: 'hello world', filter: 'active&verified' },
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );
    });

    it('should handle query parameters with route parameters', async () => {
      const handler = vi.fn((req) => ({
        userId: req.params.id,
        filter: req.query.filter,
        sort: req.query.sort,
      }));
      workerify.get('/users/:id', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/users/123?filter=active&sort=desc',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { id: '123' },
          query: { filter: 'active', sort: 'desc' },
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toEqual({
        userId: '123',
        filter: 'active',
        sort: 'desc',
      });
    });
  });

  describe('Form data handling', () => {
    it('should parse form-encoded data in POST requests', async () => {
      const handler = vi.fn((req) => req.body);
      workerify.post('/form', handler);

      await workerify.listen();

      // Create form data as ArrayBuffer
      const formData = 'name=John&age=30';
      const encoder = new TextEncoder();
      const bodyBuffer = encoder.encode(formData).buffer;

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/form',
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: bodyBuffer,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { name: 'John', age: '30' },
        }),
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].body).toEqual({ name: 'John', age: '30' });
    });
  });

  describe('Error handling', () => {
    it('should handle handler errors gracefully', async () => {
      const handler = vi.fn(() => {
        throw new Error('Handler error');
      });
      workerify.get('/error', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/error',
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
      expect(responses[0]).toMatchObject({
        status: 500,
        body: { error: 'Internal server error' },
        bodyType: 'json',
      });
    });

    it('should handle async handler rejection', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Async error'));
      workerify.get('/async-error', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/async-error',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 20));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        status: 500,
        body: { error: 'Internal server error' },
      });
    });
  });

  describe('Reply object usage', () => {
    it('should allow modifying status in reply', async () => {
      const handler = vi.fn((_req, reply) => {
        reply.status = 201;
        reply.statusText = 'Created';
        return { created: true };
      });
      workerify.post('/create', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/create',
          method: 'POST',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0]).toMatchObject({
        status: 201,
        statusText: 'Created',
        body: { created: true },
      });
    });

    it('should allow setting custom headers in reply', async () => {
      const handler = vi.fn((_req, reply) => {
        reply.headers = {
          'X-Custom-Header': 'custom-value',
          'Cache-Control': 'no-cache',
        };
        return 'response with headers';
      });
      workerify.get('/headers', handler);

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost:3000/headers',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0].headers).toMatchObject({
        'X-Custom-Header': 'custom-value',
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/html',
      });
    });
  });

  describe('Message filtering', () => {
    it('should ignore messages without proper structure', async () => {
      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();

      // Send malformed messages
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        // Missing id
        consumerId,
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-2',
        // Missing consumerId
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-3',
        consumerId,
        // Missing request
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // No responses should be sent for malformed messages
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(0);
    });

    it('should ignore messages for other consumers', async () => {
      workerify.get('/test', () => 'response');
      await workerify.listen();

      const correctConsumerId = mockChannel.getLastConsumerId();

      // Send message with wrong consumer ID
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId: 'wrong-consumer-id',
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // No response should be sent
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response' && msg.id === 'req-1',
      );
      expect(responses).toHaveLength(0);

      // Send with correct consumer ID
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-2',
        consumerId: correctConsumerId,
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Response should be sent
      const correctResponses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response' && msg.id === 'req-2',
      );
      expect(correctResponses).toHaveLength(1);
    });
  });
});
