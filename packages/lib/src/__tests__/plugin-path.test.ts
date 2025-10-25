import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import type { WorkerifyPlugin } from '../types.js';
import { MockBroadcastChannel } from './test-utils.js';

// Mock fetch for testing
global.fetch = vi.fn();

// @ts-expect-error
global.BroadcastChannel = MockBroadcastChannel;

describe('Plugin Path Prefixing', () => {
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

  describe('Basic plugin path prefixing', () => {
    it('should prefix plugin routes with path option', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const usersPlugin: WorkerifyPlugin = (app) => {
        app.get('/list', () => 'users list');
        app.get('/:id', () => 'user details');
      };

      await workerify.register(usersPlugin, { path: '/users' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/users/list');
      expect(routes[1].path).toBe('/users/:id');

      workerify.close();
    });

    it('should work without path option (backward compatibility)', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const plugin: WorkerifyPlugin = (app) => {
        app.get('/route', () => 'response');
      };

      await workerify.register(plugin);
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/route');

      workerify.close();
    });

    it('should normalize plugin path prefix', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const plugin: WorkerifyPlugin = (app) => {
        app.get('/route', () => 'response');
      };

      // Test different normalizations
      await workerify.register(plugin, { path: 'api' }); // No leading slash
      await workerify.listen();

      const routes1 = mockChannel.getRoutes();
      expect(routes1[0].path).toBe('/api/route');

      workerify.close();

      // Test with trailing slash
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify2 = new Workerify({ logger: false });
      await workerify2.register(plugin, { path: '/api/' }); // Trailing slash
      await workerify2.listen();

      const routes2 = mockChannel.getRoutes();
      expect(routes2[0].path).toBe('/api/route');

      workerify2.close();
    });
  });

  describe('Plugin path with scope', () => {
    it('should combine scope and plugin path', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api/v1', logger: false });

      const usersPlugin: WorkerifyPlugin = (app) => {
        app.get('/list', () => 'users list');
      };

      await workerify.register(usersPlugin, { path: '/users' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/v1/users/list');

      workerify.close();
    });

    it('should apply scope even without plugin path', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api', logger: false });

      const plugin: WorkerifyPlugin = (app) => {
        app.get('/route', () => 'response');
      };

      await workerify.register(plugin);
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/api/route');

      workerify.close();
    });
  });

  describe('Nested plugins', () => {
    it('should support nested plugin prefixes', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const adminPlugin: WorkerifyPlugin = (app) => {
        app.get('/dashboard', () => 'admin dashboard');
      };

      const usersPlugin: WorkerifyPlugin = async (app) => {
        app.get('/list', () => 'users list');
        // Nested plugin
        await app.register(adminPlugin, { path: '/admin' });
      };

      await workerify.register(usersPlugin, { path: '/users' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/users/list');
      expect(routes[1].path).toBe('/users/admin/dashboard');

      workerify.close();
    });

    it('should support deeply nested plugins with scope', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api/v1', logger: false });

      const settingsPlugin: WorkerifyPlugin = (app) => {
        app.get('/profile', () => 'profile settings');
      };

      const adminPlugin: WorkerifyPlugin = async (app) => {
        app.get('/dashboard', () => 'admin dashboard');
        await app.register(settingsPlugin, { path: '/settings' });
      };

      const usersPlugin: WorkerifyPlugin = async (app) => {
        app.get('/list', () => 'users list');
        await app.register(adminPlugin, { path: '/admin' });
      };

      await workerify.register(usersPlugin, { path: '/users' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(3);
      expect(routes[0].path).toBe('/api/v1/users/list');
      expect(routes[1].path).toBe('/api/v1/users/admin/dashboard');
      expect(routes[2].path).toBe('/api/v1/users/admin/settings/profile');

      workerify.close();
    });

    it('should properly cleanup prefix stack after nested plugins', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const nestedPlugin: WorkerifyPlugin = (app) => {
        app.get('/nested', () => 'nested route');
      };

      const parentPlugin: WorkerifyPlugin = async (app) => {
        app.get('/before', () => 'before nested');
        await app.register(nestedPlugin, { path: '/child' });
        app.get('/after', () => 'after nested');
      };

      await workerify.register(parentPlugin, { path: '/parent' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(3);
      expect(routes[0].path).toBe('/parent/before');
      expect(routes[1].path).toBe('/parent/child/nested');
      expect(routes[2].path).toBe('/parent/after'); // Should be back to /parent

      workerify.close();
    });
  });

  describe('Plugin with different HTTP methods', () => {
    it('should prefix all HTTP methods in plugin', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const crudPlugin: WorkerifyPlugin = (app) => {
        app.get('/', () => 'list');
        app.post('/', () => 'create');
        app.put('/:id', () => 'update');
        app.delete('/:id', () => 'delete');
      };

      await workerify.register(crudPlugin, { path: '/items' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(4);
      expect(routes[0].path).toBe('/items/');
      expect(routes[0].method).toBe('GET');
      expect(routes[1].path).toBe('/items/');
      expect(routes[1].method).toBe('POST');
      expect(routes[2].path).toBe('/items/:id');
      expect(routes[2].method).toBe('PUT');
      expect(routes[3].path).toBe('/items/:id');
      expect(routes[3].method).toBe('DELETE');

      workerify.close();
    });

    it('should prefix wildcard routes in plugin', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const staticPlugin: WorkerifyPlugin = (app) => {
        app.get('/*', () => 'static files');
      };

      await workerify.register(staticPlugin, { path: '/assets' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/assets/');
      expect(routes[0].match).toBe('prefix');

      workerify.close();
    });
  });

  describe('Multiple plugins with different paths', () => {
    it('should isolate prefixes between different plugins', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const usersPlugin: WorkerifyPlugin = (app) => {
        app.get('/', () => 'users');
      };

      const postsPlugin: WorkerifyPlugin = (app) => {
        app.get('/', () => 'posts');
      };

      await workerify.register(usersPlugin, { path: '/users' });
      await workerify.register(postsPlugin, { path: '/posts' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(2);
      expect(routes[0].path).toBe('/users/');
      expect(routes[1].path).toBe('/posts/');

      workerify.close();
    });
  });

  describe('Error handling with plugin prefix', () => {
    it('should cleanup prefix stack even when plugin throws error', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const failingPlugin: WorkerifyPlugin = () => {
        throw new Error('Plugin failed');
      };

      const successPlugin: WorkerifyPlugin = (app) => {
        app.get('/success', () => 'success');
      };

      // First plugin fails
      await expect(
        workerify.register(failingPlugin, { path: '/failing' }),
      ).rejects.toThrow('Plugin failed');

      // Second plugin should work correctly without contamination
      await workerify.register(successPlugin, { path: '/working' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/working/success'); // Not /failing/working/success

      workerify.close();
    });
  });

  describe('Real-world plugin examples with path', () => {
    it('should work with API versioning pattern', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ scope: '/api', logger: false });

      const v1Plugin: WorkerifyPlugin = (app) => {
        app.get('/users', () => 'v1 users');
        app.get('/posts', () => 'v1 posts');
      };

      const v2Plugin: WorkerifyPlugin = (app) => {
        app.get('/users', () => 'v2 users');
        app.get('/posts', () => 'v2 posts');
      };

      await workerify.register(v1Plugin, { path: '/v1' });
      await workerify.register(v2Plugin, { path: '/v2' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(4);
      expect(routes[0].path).toBe('/api/v1/users');
      expect(routes[1].path).toBe('/api/v1/posts');
      expect(routes[2].path).toBe('/api/v2/users');
      expect(routes[3].path).toBe('/api/v2/posts');

      workerify.close();
    });

    it('should work with microservices pattern', async () => {
      mockChannel = new MockBroadcastChannel('workerify');
      // @ts-expect-error - Mocking global BroadcastChannel for testing
      (global.BroadcastChannel as unknown as typeof BroadcastChannel) = vi.fn(
        () => mockChannel,
      );

      const workerify = new Workerify({ logger: false });

      const authService: WorkerifyPlugin = (app) => {
        app.post('/login', () => 'login');
        app.post('/logout', () => 'logout');
      };

      const userService: WorkerifyPlugin = (app) => {
        app.get('/', () => 'list users');
        app.get('/:id', () => 'get user');
      };

      const productService: WorkerifyPlugin = (app) => {
        app.get('/', () => 'list products');
        app.post('/', () => 'create product');
      };

      await workerify.register(authService, { path: '/auth' });
      await workerify.register(userService, { path: '/users' });
      await workerify.register(productService, { path: '/products' });
      await workerify.listen();

      const routes = mockChannel.getRoutes();
      expect(routes).toHaveLength(6);
      expect(routes[0].path).toBe('/auth/login');
      expect(routes[1].path).toBe('/auth/logout');
      expect(routes[2].path).toBe('/users/');
      expect(routes[3].path).toBe('/users/:id');
      expect(routes[4].path).toBe('/products/');
      expect(routes[5].path).toBe('/products/');

      workerify.close();
    });
  });
});
