import { describe, it, expect } from 'vitest';
import type {
  HttpMethod,
  WorkerifyRequest,
  WorkerifyReply,
  RouteHandler,
  Route,
  WorkerifyOptions,
  BroadcastMessage,
  WorkerifyPlugin
} from '../types.js';

describe('Type Definitions', () => {
  describe('HttpMethod', () => {
    it('should include all standard HTTP methods', () => {
      const methods: HttpMethod[] = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
        'HEAD',
        'OPTIONS'
      ];

      // Type check - this will fail at compile time if types are wrong
      methods.forEach(method => {
        expect(typeof method).toBe('string');
      });
    });
  });

  describe('WorkerifyRequest', () => {
    it('should have correct structure', () => {
      const request: WorkerifyRequest = {
        url: 'http://localhost:3000/test',
        method: 'GET',
        headers: { 'content-type': 'application/json' },
        body: null,
        params: { id: '123' }
      };

      expect(request.url).toBe('http://localhost:3000/test');
      expect(request.method).toBe('GET');
      expect(request.headers).toEqual({ 'content-type': 'application/json' });
      expect(request.body).toBeNull();
      expect(request.params).toEqual({ id: '123' });
    });

    it('should support optional body', () => {
      const requestWithoutBody: WorkerifyRequest = {
        url: 'http://localhost:3000/test',
        method: 'GET',
        headers: {},
        params: {}
      };

      expect(requestWithoutBody.body).toBeUndefined();
    });

    it('should support ArrayBuffer body', () => {
      const buffer = new ArrayBuffer(8);
      const request: WorkerifyRequest = {
        url: 'http://localhost:3000/test',
        method: 'POST',
        headers: {},
        body: buffer,
        params: {}
      };

      expect(request.body).toBe(buffer);
    });
  });

  describe('WorkerifyReply', () => {
    it('should have correct structure with all optional properties', () => {
      const reply: WorkerifyReply = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: { message: 'success' },
        bodyType: 'json'
      };

      expect(reply.status).toBe(200);
      expect(reply.statusText).toBe('OK');
      expect(reply.headers).toEqual({ 'content-type': 'application/json' });
      expect(reply.body).toEqual({ message: 'success' });
      expect(reply.bodyType).toBe('json');
    });

    it('should work with minimal structure', () => {
      const reply: WorkerifyReply = {};

      expect(reply.status).toBeUndefined();
      expect(reply.statusText).toBeUndefined();
      expect(reply.headers).toBeUndefined();
      expect(reply.body).toBeUndefined();
      expect(reply.bodyType).toBeUndefined();
    });

    it('should support different body types', () => {
      const jsonReply: WorkerifyReply = {
        body: { data: 'json' },
        bodyType: 'json'
      };

      const textReply: WorkerifyReply = {
        body: 'text response',
        bodyType: 'text'
      };

      const bufferReply: WorkerifyReply = {
        body: new ArrayBuffer(8),
        bodyType: 'arrayBuffer'
      };

      expect(jsonReply.bodyType).toBe('json');
      expect(textReply.bodyType).toBe('text');
      expect(bufferReply.bodyType).toBe('arrayBuffer');
    });
  });

  describe('RouteHandler', () => {
    it('should support synchronous handlers', () => {
      const handler: RouteHandler = (request, reply) => {
        return 'sync response';
      };

      expect(typeof handler).toBe('function');
    });

    it('should support asynchronous handlers', () => {
      const handler: RouteHandler = async (request, reply) => {
        return Promise.resolve('async response');
      };

      expect(typeof handler).toBe('function');
    });

    it('should support handlers that return void', () => {
      const handler: RouteHandler = (request, reply) => {
        reply.status = 200;
        reply.body = 'modified reply';
        // No return value
      };

      expect(typeof handler).toBe('function');
    });

    it('should support handlers that return different types', () => {
      const stringHandler: RouteHandler = () => 'string';
      const objectHandler: RouteHandler = () => ({ data: 'object' });
      const numberHandler: RouteHandler = () => 42;
      const bufferHandler: RouteHandler = () => new ArrayBuffer(8);

      expect(typeof stringHandler).toBe('function');
      expect(typeof objectHandler).toBe('function');
      expect(typeof numberHandler).toBe('function');
      expect(typeof bufferHandler).toBe('function');
    });
  });

  describe('Route', () => {
    it('should have correct structure', () => {
      const route: Route = {
        method: 'GET',
        path: '/test',
        handler: () => 'test',
        match: 'exact'
      };

      expect(route.method).toBe('GET');
      expect(route.path).toBe('/test');
      expect(typeof route.handler).toBe('function');
      expect(route.match).toBe('exact');
    });

    it('should support optional method for ALL routes', () => {
      const route: Route = {
        path: '/all',
        handler: () => 'all methods',
        match: 'exact'
      };

      expect(route.method).toBeUndefined();
    });

    it('should support optional match type', () => {
      const route: Route = {
        method: 'GET',
        path: '/test',
        handler: () => 'test'
      };

      expect(route.match).toBeUndefined();
    });

    it('should support prefix matching', () => {
      const route: Route = {
        method: 'GET',
        path: '/api/',
        handler: () => 'api',
        match: 'prefix'
      };

      expect(route.match).toBe('prefix');
    });
  });

  describe('WorkerifyOptions', () => {
    it('should have correct structure', () => {
      const options: WorkerifyOptions = {
        logger: true,
        scope: '/api'
      };

      expect(options.logger).toBe(true);
      expect(options.scope).toBe('/api');
    });

    it('should support minimal options', () => {
      const options: WorkerifyOptions = {};

      expect(options.logger).toBeUndefined();
      expect(options.scope).toBeUndefined();
    });

    it('should support logger only', () => {
      const options: WorkerifyOptions = {
        logger: false
      };

      expect(options.logger).toBe(false);
      expect(options.scope).toBeUndefined();
    });

    it('should support scope only', () => {
      const options: WorkerifyOptions = {
        scope: '/custom'
      };

      expect(options.logger).toBeUndefined();
      expect(options.scope).toBe('/custom');
    });
  });

  describe('BroadcastMessage', () => {
    it('should support routes update message', () => {
      const message: BroadcastMessage = {
        type: 'workerify:routes:update',
        routes: [
          { method: 'GET', path: '/test', match: 'exact' },
          { path: '/all', match: 'prefix' }
        ]
      };

      expect(message.type).toBe('workerify:routes:update');
      expect(message.routes).toHaveLength(2);
    });

    it('should support request message', () => {
      const message: BroadcastMessage = {
        type: 'workerify:handle',
        id: 'req-123',
        request: {
          url: 'http://localhost:3000/test',
          method: 'GET',
          headers: {},
          params: {}
        }
      };

      expect(message.type).toBe('workerify:handle');
      expect(message.id).toBe('req-123');
      expect(message.request?.url).toBe('http://localhost:3000/test');
    });

    it('should support response message', () => {
      const message: BroadcastMessage = {
        type: 'workerify:response',
        id: 'req-123',
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: { data: 'response' },
        bodyType: 'json'
      };

      expect(message.type).toBe('workerify:response');
      expect(message.id).toBe('req-123');
      expect(message.status).toBe(200);
      expect(message.body).toEqual({ data: 'response' });
    });

    it('should support minimal message', () => {
      const message: BroadcastMessage = {
        type: 'custom:message'
      };

      expect(message.type).toBe('custom:message');
      expect(message.id).toBeUndefined();
    });
  });

  describe('WorkerifyPlugin', () => {
    it('should support synchronous plugin', () => {
      const plugin: WorkerifyPlugin = (instance, options) => {
        // Plugin implementation
      };

      expect(typeof plugin).toBe('function');
    });

    it('should support asynchronous plugin', () => {
      const plugin: WorkerifyPlugin = async (instance, options) => {
        return Promise.resolve();
      };

      expect(typeof plugin).toBe('function');
    });

    it('should support plugin with typed options', () => {
      interface PluginOptions {
        prefix: string;
        enabled: boolean;
      }

      const plugin: WorkerifyPlugin = (instance, options: PluginOptions) => {
        if (options?.enabled) {
          // Plugin logic
        }
      };

      expect(typeof plugin).toBe('function');
    });

    it('should support plugin without options', () => {
      const plugin: WorkerifyPlugin = (instance) => {
        // Plugin implementation without options
      };

      expect(typeof plugin).toBe('function');
    });
  });

  describe('Type compatibility', () => {
    it('should allow route handlers to be assigned to RouteHandler type', () => {
      const syncHandler = () => 'sync';
      const asyncHandler = async () => 'async';
      const voidHandler = (req: WorkerifyRequest, reply: WorkerifyReply) => {
        reply.status = 200;
      };

      const handlers: RouteHandler[] = [syncHandler, asyncHandler, voidHandler];

      expect(handlers).toHaveLength(3);
    });

    it('should allow different HTTP methods in routes', () => {
      const routes: Route[] = [
        { method: 'GET', path: '/', handler: () => 'get' },
        { method: 'POST', path: '/', handler: () => 'post' },
        { method: 'PUT', path: '/', handler: () => 'put' },
        { method: 'DELETE', path: '/', handler: () => 'delete' },
        { method: 'PATCH', path: '/', handler: () => 'patch' },
        { method: 'HEAD', path: '/', handler: () => 'head' },
        { method: 'OPTIONS', path: '/', handler: () => 'options' },
        { path: '/', handler: () => 'all' } // No method = ALL
      ];

      expect(routes).toHaveLength(8);
    });
  });
});