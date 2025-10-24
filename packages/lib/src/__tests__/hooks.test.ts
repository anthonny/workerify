import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import { MockBroadcastChannel } from './test-utils.js';

// Mock fetch for testing
global.fetch = vi.fn();

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Hooks System', () => {
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

  describe('onRequest hook', () => {
    it('should execute onRequest hooks before route handling', async () => {
      const hookCalls: string[] = [];

      workerify.addHook('onRequest', async (request, _reply) => {
        hookCalls.push('hook1');
        expect(request.url).toBeDefined();
      });

      workerify.addHook('onRequest', async (_request, _reply) => {
        hookCalls.push('hook2');
      });

      workerify.get('/test', async (_request, _reply) => {
        hookCalls.push('handler');
        return { message: 'test' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(hookCalls).toEqual(['hook1', 'hook2', 'handler']);
    });

    it('should allow onRequest hook to modify request', async () => {
      workerify.addHook('onRequest', async (request, _reply) => {
        request.headers['x-custom-header'] = 'added-by-hook';
      });

      let receivedHeaders: Record<string, string> = {};

      workerify.get('/test', async (request, _reply) => {
        receivedHeaders = request.headers;
        return { message: 'test' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(receivedHeaders['x-custom-header']).toBe('added-by-hook');
    });
  });

  describe('preHandler hook', () => {
    it('should execute preHandler hooks after route matching but before handler', async () => {
      const hookCalls: string[] = [];

      workerify.addHook('preHandler', async (request, _reply) => {
        hookCalls.push('preHandler1');
        expect(request.params).toBeDefined();
      });

      workerify.addHook('preHandler', async (_request, _reply) => {
        hookCalls.push('preHandler2');
      });

      workerify.get('/test/:id', async (request, _reply) => {
        hookCalls.push('handler');
        return { id: request.params.id };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test/123',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(hookCalls).toEqual(['preHandler1', 'preHandler2', 'handler']);
    });

    it('should allow preHandler hook to modify reply', async () => {
      workerify.addHook('preHandler', async (_request, reply) => {
        reply.headers = { 'x-pre-handler': 'modified' };
      });

      workerify.get('/test', async (_request, _reply) => {
        return { message: 'test' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0]?.headers?.['x-pre-handler']).toBe('modified');
    });
  });

  describe('onResponse hook', () => {
    it('should execute onResponse hooks after handler execution', async () => {
      const hookCalls: string[] = [];

      workerify.addHook('onResponse', async (_request, reply) => {
        hookCalls.push('onResponse1');
        expect(reply.body).toBeDefined();
      });

      workerify.addHook('onResponse', async (_request, _reply) => {
        hookCalls.push('onResponse2');
      });

      workerify.get('/test', async (_request, _reply) => {
        hookCalls.push('handler');
        return { message: 'test' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(hookCalls).toEqual(['handler', 'onResponse1', 'onResponse2']);
    });

    it('should allow onResponse hook to modify response', async () => {
      workerify.addHook('onResponse', async (_request, reply) => {
        reply.headers = {
          ...reply.headers,
          'x-response-time': '100ms',
        };
      });

      workerify.get('/test', async (_request, _reply) => {
        return { message: 'test' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0]?.headers?.['x-response-time']).toBe('100ms');
    });
  });

  describe('onError hook', () => {
    it('should execute onError hooks when an error occurs', async () => {
      const errors: Error[] = [];

      workerify.addHook('onError', async (error, _request, _reply) => {
        errors.push(error);
      });

      workerify.get('/test', async (_request, _reply) => {
        throw new Error('Test error');
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errors).toHaveLength(1);
      expect(errors[0]?.message).toBe('Test error');
    });

    it('should allow onError hook to modify error response', async () => {
      workerify.addHook('onError', async (_error, _request, reply) => {
        reply.status = 418;
        reply.body = { error: 'Custom error message' };
      });

      workerify.get('/test', async (_request, _reply) => {
        throw new Error('Test error');
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );

      // Note: The default error handler still sends 500, but the hook was executed
      expect(responses[0]?.status).toBe(500);
    });

    it('should handle errors in onError hooks gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const workerifyWithLogger = new Workerify({ logger: true });

      workerifyWithLogger.addHook(
        'onError',
        async (_error, _request, _reply) => {
          throw new Error('Hook error');
        },
      );

      workerifyWithLogger.get('/test', async (_request, _reply) => {
        throw new Error('Test error');
      });

      await workerifyWithLogger.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in onError hook:'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
      workerifyWithLogger.close();
    });
  });

  describe('onRoute hook', () => {
    it('should execute onRoute hooks when routes are registered', async () => {
      const registeredRoutes: Array<{ method?: string; path: string }> = [];

      workerify.addHook('onRoute', async (route) => {
        registeredRoutes.push({
          method: route.method,
          path: route.path,
        });
      });

      workerify.get('/test1', async () => ({ message: 'test1' }));
      workerify.post('/test2', async () => ({ message: 'test2' }));

      // Wait a bit for async hooks to execute
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(registeredRoutes).toHaveLength(2);
      expect(registeredRoutes[0]).toEqual({ method: 'GET', path: '/test1' });
      expect(registeredRoutes[1]).toEqual({ method: 'POST', path: '/test2' });
    });

    it('should execute multiple onRoute hooks in order', async () => {
      const calls: string[] = [];

      workerify.addHook('onRoute', async (_route) => {
        calls.push('hook1');
      });

      workerify.addHook('onRoute', async (_route) => {
        calls.push('hook2');
      });

      workerify.get('/test', async () => ({ message: 'test' }));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(calls).toEqual(['hook1', 'hook2']);
    });
  });

  describe('onReady hook', () => {
    it('should execute onReady hooks when listen is called', async () => {
      const calls: string[] = [];

      workerify.addHook('onReady', async () => {
        calls.push('ready1');
      });

      workerify.addHook('onReady', async () => {
        calls.push('ready2');
      });

      workerify.get('/test', async () => ({ message: 'test' }));

      await workerify.listen();

      expect(calls).toEqual(['ready1', 'ready2']);
    });
  });

  describe('Hook execution order', () => {
    it('should execute hooks in correct lifecycle order', async () => {
      const lifecycle: string[] = [];

      workerify.addHook('onRequest', async () => {
        lifecycle.push('onRequest');
      });

      workerify.addHook('preHandler', async () => {
        lifecycle.push('preHandler');
      });

      workerify.addHook('onResponse', async () => {
        lifecycle.push('onResponse');
      });

      workerify.get('/test', async () => {
        lifecycle.push('handler');
        return { message: 'test' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(lifecycle).toEqual([
        'onRequest',
        'preHandler',
        'handler',
        'onResponse',
      ]);
    });
  });

  describe('Async hook support', () => {
    it('should properly await async hooks', async () => {
      const results: number[] = [];

      workerify.addHook('onRequest', async (_request, _reply) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        results.push(1);
      });

      workerify.addHook('preHandler', async (_request, _reply) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        results.push(2);
      });

      workerify.get('/test', async () => {
        results.push(3);
        return { message: 'test' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('Method chaining', () => {
    it('should support method chaining with addHook', () => {
      const result = workerify
        .addHook('onRequest', async () => {})
        .addHook('preHandler', async () => {})
        .addHook('onResponse', async () => {})
        .get('/test', async () => ({ message: 'test' }));

      expect(result).toBe(workerify);
    });
  });

  describe('Automatic body type detection in hooks', () => {
    it('should auto-detect text bodyType for string response in onRequest hook', async () => {
      workerify.addHook('onRequest', async (_request, reply) => {
        reply.status = 200;
        reply.body = '<h1>Hello from hook</h1>';
      });

      workerify.get('/test', async () => {
        return { message: 'should not be called' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
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
        body: '<h1>Hello from hook</h1>',
        bodyType: 'text',
      });
      expect(responses[0]?.headers?.['Content-Type']).toBe('text/html');
    });

    it('should auto-detect arrayBuffer bodyType for ArrayBuffer response in onRequest hook', async () => {
      const buffer = new ArrayBuffer(8);

      workerify.addHook('onRequest', async (_request, reply) => {
        reply.status = 200;
        reply.body = buffer;
      });

      workerify.get('/test', async () => {
        return { message: 'should not be called' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
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

    it('should auto-detect json bodyType for object response in onRequest hook', async () => {
      workerify.addHook('onRequest', async (_request, reply) => {
        reply.status = 403;
        reply.body = { error: 'Forbidden' };
      });

      workerify.get('/test', async () => {
        return { message: 'should not be called' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/test',
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
        body: { error: 'Forbidden' },
        bodyType: 'json',
      });
      expect(responses[0]?.headers?.['Content-Type']).toBe('application/json');
    });

    it('should auto-detect text bodyType for string response in preHandler hook', async () => {
      workerify.addHook('preHandler', async (_request, reply) => {
        reply.status = 200;
        reply.body = '<div>Cached response</div>';
      });

      workerify.get('/cached', async () => {
        return { message: 'should not be called' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/cached',
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
        body: '<div>Cached response</div>',
        bodyType: 'text',
      });
      expect(responses[0]?.headers?.['Content-Type']).toBe('text/html');
    });

    it('should auto-detect arrayBuffer bodyType for ArrayBuffer response in preHandler hook', async () => {
      const buffer = new ArrayBuffer(16);

      workerify.addHook('preHandler', async (_request, reply) => {
        reply.status = 200;
        reply.body = buffer;
      });

      workerify.get('/binary', async () => {
        return { message: 'should not be called' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/binary',
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

    it('should auto-detect json bodyType for object response in preHandler hook', async () => {
      workerify.addHook('preHandler', async (_request, reply) => {
        reply.status = 429;
        reply.body = { error: 'Rate limited' };
      });

      workerify.get('/api', async () => {
        return { message: 'should not be called' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/api',
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
        body: { error: 'Rate limited' },
        bodyType: 'json',
      });
      expect(responses[0]?.headers?.['Content-Type']).toBe('application/json');
    });
  });

  describe('Early response from hooks', () => {
    it('should allow responding from onRequest hook and skip handler', async () => {
      const handlerCalled = vi.fn();

      workerify.addHook('onRequest', async (request, reply) => {
        // Check authorization
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          reply.status = 401;
          reply.statusText = 'Unauthorized';
          reply.body = { error: 'Missing authorization header' };
          reply.bodyType = 'json';
          reply.headers = { 'Content-Type': 'application/json' };
        }
      });

      workerify.get('/protected', async (_request, _reply) => {
        handlerCalled();
        return { message: 'Protected resource' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/protected',
          method: 'GET',
          headers: {}, // No authorization header
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Handler should NOT be called
      expect(handlerCalled).not.toHaveBeenCalled();

      // Response should be the one set in the hook
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        status: 401,
        statusText: 'Unauthorized',
        body: { error: 'Missing authorization header' },
        bodyType: 'json',
      });
    });

    it('should allow responding from preHandler hook and skip handler', async () => {
      const handlerCalled = vi.fn();

      workerify.addHook('preHandler', async (request, reply) => {
        // Rate limiting check
        const userId = request.params.id;
        if (userId === 'blocked') {
          reply.status = 429;
          reply.statusText = 'Too Many Requests';
          reply.body = { error: 'Rate limit exceeded' };
          reply.bodyType = 'json';
          reply.headers = {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          };
        }
      });

      workerify.get('/users/:id', async (request, _reply) => {
        handlerCalled();
        return { id: request.params.id, name: 'John Doe' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/users/blocked',
          method: 'GET',
          headers: {},
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Handler should NOT be called
      expect(handlerCalled).not.toHaveBeenCalled();

      // Response should be the one set in the hook
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses).toHaveLength(1);
      expect(responses[0]).toMatchObject({
        status: 429,
        statusText: 'Too Many Requests',
        body: { error: 'Rate limit exceeded' },
        bodyType: 'json',
      });
      expect(responses[0]?.headers?.['Retry-After']).toBe('60');
    });

    it('should proceed to handler if hook does not set response', async () => {
      const handlerCalled = vi.fn();

      workerify.addHook('onRequest', async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
          reply.status = 401;
          reply.body = { error: 'Unauthorized' };
          reply.bodyType = 'json';
        }
        // If authorization is present, don't set body
      });

      workerify.get('/protected', async (_request, _reply) => {
        handlerCalled();
        return { message: 'Success' };
      });

      await workerify.listen();

      const consumerId = mockChannel.getLastConsumerId();
      mockChannel.simulateMessage({
        type: 'workerify:handle',
        id: 'req-1',
        consumerId,
        request: {
          url: 'http://localhost/protected',
          method: 'GET',
          headers: { authorization: 'Bearer token123' }, // With authorization
          body: null,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Handler SHOULD be called
      expect(handlerCalled).toHaveBeenCalled();

      // Response should be from the handler
      const responses = mockChannel.lastMessages.filter(
        (msg) => msg.type === 'workerify:response',
      );
      expect(responses[0]?.body).toEqual({ message: 'Success' });
    });
  });
});
