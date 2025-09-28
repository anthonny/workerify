import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import type { WorkerifyPlugin } from '../types.js';
import { setupBroadcastChannelMock } from './test-utils.js';

// Setup mocks
setupBroadcastChannelMock();

describe('Plugin System', () => {
  let workerify: Workerify;

  beforeEach(() => {
    workerify = new Workerify({ logger: false });
  });

  afterEach(() => {
    workerify.close();
  });

  describe('Plugin registration', () => {
    it('should register synchronous plugin', async () => {
      const plugin: WorkerifyPlugin = vi.fn().mockImplementation((app) => {
        app.get('/plugin-route', () => 'plugin response');
      });

      await workerify.register(plugin);

      expect(plugin).toHaveBeenCalledWith(workerify, undefined);
    });

    it('should register asynchronous plugin', async () => {
      const plugin: WorkerifyPlugin = vi
        .fn()
        .mockImplementation(async (app) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          app.get('/async-plugin', () => 'async response');
        });

      await workerify.register(plugin);

      expect(plugin).toHaveBeenCalledWith(workerify, undefined);
    });

    it('should pass options to plugin', async () => {
      const plugin: WorkerifyPlugin = vi.fn();
      const options = { prefix: '/api', version: 'v1' };

      await workerify.register(plugin, options);

      expect(plugin).toHaveBeenCalledWith(workerify, options);
    });

    it('should handle plugin errors', async () => {
      const plugin: WorkerifyPlugin = vi.fn().mockImplementation(() => {
        throw new Error('Plugin initialization failed');
      });

      await expect(workerify.register(plugin)).rejects.toThrow(
        'Plugin initialization failed',
      );
    });

    it('should handle async plugin errors', async () => {
      const plugin: WorkerifyPlugin = vi
        .fn()
        .mockRejectedValue(new Error('Async plugin error'));

      await expect(workerify.register(plugin)).rejects.toThrow(
        'Async plugin error',
      );
    });
  });

  describe('Plugin functionality', () => {
    it('should allow plugins to register routes', async () => {
      const plugin: WorkerifyPlugin = (app) => {
        app.get('/plugin/test', () => 'plugin test');
        app.post('/plugin/data', () => ({ success: true }));
      };

      await workerify.register(plugin);

      // Verify routes were added by checking the internal routes array
      const routes = (workerify as any).routes;
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/plugin/test');
      expect(routes[1].path).toBe('/plugin/data');
    });

    it('should allow plugins to register middleware-like functionality', async () => {
      let middlewareExecuted = false;

      const plugin: WorkerifyPlugin = (app) => {
        // Simulate middleware by wrapping existing route handlers
        const originalGet = app.get.bind(app);
        app.get = (path: string, handler: any) => {
          return originalGet(path, (req: any, reply: any) => {
            middlewareExecuted = true;
            return handler(req, reply);
          });
        };
      };

      await workerify.register(plugin);
      workerify.get('/test', () => 'test');

      // The middleware would execute when the route is called
      expect(middlewareExecuted).toBe(false); // Not called yet
    });

    it('should allow plugins to access workerify instance methods', async () => {
      const plugin: WorkerifyPlugin = vi
        .fn()
        .mockImplementation(async (app) => {
          // Plugin can call any public method
          app.updateRoutes();
          await app.listen();
        });

      await workerify.register(plugin);

      expect(plugin).toHaveBeenCalled();
    });

    it('should allow multiple plugins to be registered', async () => {
      const plugin1: WorkerifyPlugin = vi.fn().mockImplementation((app) => {
        app.get('/plugin1', () => 'plugin1');
      });

      const plugin2: WorkerifyPlugin = vi.fn().mockImplementation((app) => {
        app.get('/plugin2', () => 'plugin2');
      });

      const plugin3: WorkerifyPlugin = vi.fn().mockImplementation((app) => {
        app.get('/plugin3', () => 'plugin3');
      });

      await workerify.register(plugin1);
      await workerify.register(plugin2);
      await workerify.register(plugin3);

      expect(plugin1).toHaveBeenCalled();
      expect(plugin2).toHaveBeenCalled();
      expect(plugin3).toHaveBeenCalled();

      const routes = (workerify as any).routes;
      expect(routes).toHaveLength(3);
    });
  });

  describe('Plugin with options', () => {
    it('should handle plugin with complex options', async () => {
      interface PluginOptions {
        prefix: string;
        routes: Array<{ path: string; handler: () => string }>;
        middleware?: boolean;
      }

      const plugin: WorkerifyPlugin = vi
        .fn()
        .mockImplementation((app, options: PluginOptions) => {
          if (options?.routes) {
            options.routes.forEach((route) => {
              const fullPath = options.prefix + route.path;
              app.get(fullPath, route.handler);
            });
          }
        });

      const options: PluginOptions = {
        prefix: '/api/v1',
        routes: [
          { path: '/users', handler: () => 'users' },
          { path: '/posts', handler: () => 'posts' },
        ],
        middleware: true,
      };

      await workerify.register(plugin, options);

      expect(plugin).toHaveBeenCalledWith(workerify, options);

      const routes = (workerify as any).routes;
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/api/v1/users');
      expect(routes[1].path).toBe('/api/v1/posts');
    });

    it('should handle plugin with no options', async () => {
      const plugin: WorkerifyPlugin = vi
        .fn()
        .mockImplementation((app, options) => {
          expect(options).toBeUndefined();
          app.get('/no-options', () => 'no options');
        });

      await workerify.register(plugin);

      expect(plugin).toHaveBeenCalledWith(workerify, undefined);
    });
  });

  describe('Plugin chaining', () => {
    it('should allow method chaining after plugin registration', async () => {
      const plugin: WorkerifyPlugin = (app) => {
        app.get('/plugin', () => 'plugin');
      };

      const result = await workerify.register(plugin);

      expect(result).toBe(workerify);

      // Should be able to chain methods
      result.get('/after-plugin', () => 'after').listen();
    });

    it('should allow chaining multiple plugin registrations', async () => {
      const plugin1: WorkerifyPlugin = (app) => app.get('/p1', () => 'p1');
      const plugin2: WorkerifyPlugin = (app) => app.get('/p2', () => 'p2');

      const result = await workerify
        .register(plugin1)
        .then((app) => app.register(plugin2));

      expect(result).toBe(workerify);

      const routes = (workerify as any).routes;
      expect(routes).toHaveLength(2);
    });
  });

  describe('Real-world plugin examples', () => {
    it('should work with CORS plugin example', async () => {
      interface CorsOptions {
        origin?: string[];
        methods?: string[];
      }

      const corsPlugin: WorkerifyPlugin = (app, options: CorsOptions = {}) => {
        const { origin = ['*'], methods = ['GET', 'POST', 'PUT', 'DELETE'] } =
          options;

        // Add OPTIONS handler for preflight
        app.option('/*', (_req, reply) => {
          reply.headers = {
            'Access-Control-Allow-Origin': origin.join(', '),
            'Access-Control-Allow-Methods': methods.join(', '),
            'Access-Control-Allow-Headers': 'Content-Type',
            ...reply.headers,
          };
          return '';
        });
      };

      await workerify.register(corsPlugin, {
        origin: ['https://example.com'],
        methods: ['GET', 'POST'],
      });

      const routes = (workerify as any).routes;
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/');
      expect(routes[0].match).toBe('prefix');
      expect(routes[0].method).toBe('OPTIONS');
    });

    it('should work with logging plugin example', async () => {
      const logs: string[] = [];

      const loggingPlugin: WorkerifyPlugin = (app) => {
        // In a real implementation, this would intercept requests
        // For testing, we'll just add a route that logs
        app.all('/logged/*', (req, _reply) => {
          logs.push(`${req.method} ${req.url}`);
          return { logged: true };
        });
      };

      await workerify.register(loggingPlugin);

      const routes = (workerify as any).routes;
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/logged/');
      expect(routes[0].match).toBe('prefix');
      expect(routes[0].method).toBeUndefined(); // ALL method
    });

    it('should work with authentication plugin example', async () => {
      interface AuthOptions {
        secret: string;
        protected: string[];
      }

      const authPlugin: WorkerifyPlugin = (app, options: AuthOptions) => {
        const { secret, protected: protectedRoutes } = options;

        // Add auth route
        app.post('/auth/login', (_req) => {
          // Simulate authentication
          return { token: 'fake-jwt-token', secret };
        });

        // Add protected routes
        protectedRoutes.forEach((route) => {
          app.get(route, (req, reply) => {
            const auth = req.headers.authorization;
            if (!auth || !auth.includes('Bearer')) {
              reply.status = 401;
              return { error: 'Unauthorized' };
            }
            return { message: 'Protected resource', route };
          });
        });
      };

      await workerify.register(authPlugin, {
        secret: 'test-secret',
        protected: ['/admin', '/profile'],
      });

      const routes = (workerify as any).routes;
      expect(routes).toHaveLength(3); // login + 2 protected routes
      expect(routes[0].path).toBe('/auth/login');
      expect(routes[1].path).toBe('/admin');
      expect(routes[2].path).toBe('/profile');
    });
  });
});
