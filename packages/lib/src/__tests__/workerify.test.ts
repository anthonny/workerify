import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Workerify } from '../index.js';
import { setupBroadcastChannelMock } from './test-utils.js';

// Setup mocks
setupBroadcastChannelMock();

describe('Workerify', () => {
  let workerify: Workerify;

  beforeEach(() => {
    workerify = new Workerify({ logger: false });
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
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      // Mock routes acknowledgment
      setTimeout(() => {
        const channel = workerify.channel as any;
        if (channel?.listeners) {
          channel.listeners.forEach((listener: any) => {
            listener({
              data: {
                type: 'workerify:routes:update:response',
                consumerId: (workerify as any).consumerId,
              },
            });
          });
        }
      }, 10);

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
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      setTimeout(() => {
        const channel = workerify.channel as any;
        if (channel?.listeners) {
          channel.listeners.forEach((listener: any) => {
            listener({
              data: {
                type: 'workerify:routes:update:response',
                consumerId: (workerify as any).consumerId,
              },
            });
          });
        }
      }, 10);

      await expect(workerify.listen()).resolves.not.toThrow();
    });

    it('should handle prefix path matching with wildcard', async () => {
      const handler = vi.fn();
      workerify.get('/prefix/*', handler);

      // Mock fetch for registration
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      setTimeout(() => {
        const channel = workerify.channel as any;
        if (channel?.listeners) {
          channel.listeners.forEach((listener: any) => {
            listener({
              data: {
                type: 'workerify:routes:update:response',
                consumerId: (workerify as any).consumerId,
              },
            });
          });
        }
      }, 10);

      await expect(workerify.listen()).resolves.not.toThrow();
    });

    it('should handle parameterized paths', async () => {
      const handler = vi.fn();
      workerify.get('/users/:id', handler);
      workerify.get('/users/:id/posts/:postId', handler);

      // Mock fetch for registration
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      setTimeout(() => {
        const channel = workerify.channel as any;
        if (channel?.listeners) {
          channel.listeners.forEach((listener: any) => {
            listener({
              data: {
                type: 'workerify:routes:update:response',
                consumerId: (workerify as any).consumerId,
              },
            });
          });
        }
      }, 10);

      await expect(workerify.listen()).resolves.not.toThrow();
    });
  });

  describe('Error handling', () => {
    it('should handle invalid route handlers gracefully', () => {
      // Test with null handler (should not crash)
      expect(() => {
        workerify.get('/test', null as any);
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
      const channelSpy = vi.spyOn(workerify.channel, 'postMessage');

      workerify.get('/test', () => 'test');

      // Should NOT have sent routes update message (deferred to listen)
      expect(channelSpy).not.toHaveBeenCalled();
    });

    it('should update service worker routes on listen', async () => {
      const channelSpy = vi.spyOn(workerify.channel, 'postMessage');

      workerify.get('/test1', () => 'test1');
      workerify.post('/test2', () => 'test2');

      channelSpy.mockClear();

      // Mock fetch for registration
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ clientId: 'test-client-id' }),
      });

      setTimeout(() => {
        const channel = workerify.channel as any;
        if (channel?.listeners) {
          channel.listeners.forEach((listener: any) => {
            listener({
              data: {
                type: 'workerify:routes:update:response',
                consumerId: (workerify as any).consumerId,
              },
            });
          });
        }
      }, 10);

      await workerify.listen();

      // Should send routes update on listen
      expect(channelSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'workerify:routes:update',
          consumerId: expect.any(String),
          routes: expect.arrayContaining([
            expect.objectContaining({ path: '/test1', method: 'GET' }),
            expect.objectContaining({ path: '/test2', method: 'POST' }),
          ]),
        }),
      );
    });
  });
});
