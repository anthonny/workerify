import { beforeEach, describe, expect, it } from 'vitest';
import workerifyPlugin, { type WorkerifyPluginOptions } from '../index.js';
import {
  callMiddleware,
  captureMockMiddleware,
  createMockPluginContext,
  createMockRequest,
  createMockResponse,
  createMockViteServer,
  isValidJavaScript,
  type MockPluginContext,
  type MockViteServer,
} from './test-utils.js';

describe('Workerify Vite Plugin', () => {
  let mockServer: MockViteServer;
  let mockContext: MockPluginContext;

  beforeEach(() => {
    mockServer = createMockViteServer();
    mockContext = createMockPluginContext();
  });

  describe('Plugin configuration', () => {
    it('should create plugin with default options', () => {
      const plugin = workerifyPlugin();

      expect(plugin.name).toBe('vite:workerify');
      expect(plugin.enforce).toBe('pre');
      expect(typeof plugin.configResolved).toBe('function');
      expect(typeof plugin.configureServer).toBe('function');
      expect(typeof plugin.generateBundle).toBe('function');
      expect(typeof plugin.resolveId).toBe('function');
      expect(typeof plugin.load).toBe('function');
    });

    it('should create plugin with custom options', () => {
      const options: WorkerifyPluginOptions = {
        scope: '/api/',
        swFileName: 'custom-sw.js',
      };

      const plugin = workerifyPlugin(options);

      expect(plugin.name).toBe('vite:workerify');
      expect(plugin.enforce).toBe('pre');
    });

    it('should normalize scope with trailing slash', () => {
      const plugin1 = workerifyPlugin({ scope: '/api' });
      const plugin2 = workerifyPlugin({ scope: '/api/' });
      const plugin3 = workerifyPlugin(); // default scope

      // We can't directly test the normalized scope, but we can test it through the virtual module
      const module1 = plugin1.load?.('\0virtual:workerify-register');
      const module2 = plugin2.load?.('\0virtual:workerify-register');
      const module3 = plugin3.load?.('\0virtual:workerify-register');

      expect(typeof module1).toBe('string');
      expect(typeof module2).toBe('string');
      expect(typeof module3).toBe('string');

      // Both should generate similar modules (scope gets normalized)
      expect(module1).toContain('/api/');
      expect(module2).toContain('/api/');
      expect(module3).toContain('/'); // default scope
    });

    it('should handle custom service worker filename', () => {
      const plugin = workerifyPlugin({ swFileName: 'my-worker.js' });

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('my-worker.js');
    });

    it('should remove leading slash from SW filename', () => {
      const plugin = workerifyPlugin({ swFileName: '/leading-slash-sw.js' });

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('leading-slash-sw.js');
      expect(virtualModule).not.toContain('//leading-slash-sw.js');
    });
  });

  describe('Base path configuration', () => {
    it('should handle base path from Vite config', () => {
      const plugin = workerifyPlugin();

      // Simulate Vite calling configResolved with a base path
      plugin.configResolved?.({ base: '/app/' });

      // Load the virtual module and check it contains the correct URL
      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('/app/workerify-sw.js');
    });

    it('should handle base path without trailing slash', () => {
      const plugin = workerifyPlugin();

      plugin.configResolved?.({ base: '/myapp' });

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('/myapp/workerify-sw.js');
    });

    it('should handle empty base path', () => {
      const plugin = workerifyPlugin();

      plugin.configResolved?.({ base: '' });

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('/workerify-sw.js');
    });

    it('should handle undefined base path', () => {
      const plugin = workerifyPlugin();

      plugin.configResolved?.({});

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('/workerify-sw.js');
    });

    it('should handle base path with custom SW filename', () => {
      const plugin = workerifyPlugin({ swFileName: 'custom-sw.js' });

      plugin.configResolved?.({ base: '/my-app/' });

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('/my-app/custom-sw.js');
    });

    it('should serve SW at correct URL with base path in dev', async () => {
      const plugin = workerifyPlugin({ swFileName: 'test-sw.js' });

      // Set base path
      plugin.configResolved?.({ base: '/base/' });

      // Configure server
      plugin.configureServer?.(mockServer);

      const middleware = captureMockMiddleware(mockServer);

      // Request with base path
      const req = createMockRequest('/base/test-sw.js');
      const res = createMockResponse();

      const handled = await callMiddleware(middleware, req, res);

      expect(handled).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/javascript',
      );
      expect(res.end).toHaveBeenCalledWith(expect.stringMatching(/.+/));
    });

    it('should not serve SW at wrong base path', async () => {
      const plugin = workerifyPlugin({ swFileName: 'test-sw.js' });

      // Set base path
      plugin.configResolved?.({ base: '/correct-base/' });

      // Configure server
      plugin.configureServer?.(mockServer);

      const middleware = captureMockMiddleware(mockServer);

      // Request without base path (wrong URL)
      const req = createMockRequest('/test-sw.js');
      const res = createMockResponse();

      const handled = await callMiddleware(middleware, req, res);

      expect(handled).toBe(false);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });

    it('should handle complex base paths', () => {
      const plugin = workerifyPlugin();

      plugin.configResolved?.({ base: '/path/to/app/' });

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('/path/to/app/workerify-sw.js');
    });

    it('should handle root base path correctly', () => {
      const plugin = workerifyPlugin();

      plugin.configResolved?.({ base: '/' });

      const virtualModule = plugin.load?.('\0virtual:workerify-register');
      expect(virtualModule).toContain('/workerify-sw.js');
      expect(virtualModule).not.toContain('//workerify-sw.js');
    });
  });

  describe('Development server middleware', () => {
    it('should register middleware with Vite server', () => {
      const plugin = workerifyPlugin();

      plugin.configureServer?.(mockServer);

      expect(mockServer.middlewares.use).toHaveBeenCalledOnce();
      expect(mockServer.middlewares.use).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('should serve service worker at correct URL', async () => {
      const plugin = workerifyPlugin({ swFileName: 'test-sw.js' });
      plugin.configureServer?.(mockServer);

      const middleware = captureMockMiddleware(mockServer);
      const req = createMockRequest('/test-sw.js');
      const res = createMockResponse();

      const handled = await callMiddleware(middleware, req, res);

      expect(handled).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/javascript',
      );
      expect(res.end).toHaveBeenCalledWith(expect.stringMatching(/.+/));
    });

    it('should pass through non-SW requests', async () => {
      const plugin = workerifyPlugin({ swFileName: 'test-sw.js' });
      plugin.configureServer?.(mockServer);

      const middleware = captureMockMiddleware(mockServer);
      const req = createMockRequest('/other-file.js');
      const res = createMockResponse();

      const handled = await callMiddleware(middleware, req, res);

      expect(handled).toBe(false); // next() was called
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });

    it('should serve SW with default filename', async () => {
      const plugin = workerifyPlugin();
      plugin.configureServer?.(mockServer);

      const middleware = captureMockMiddleware(mockServer);
      const req = createMockRequest('/workerify-sw.js'); // default filename
      const res = createMockResponse();

      const handled = await callMiddleware(middleware, req, res);

      expect(handled).toBe(true);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/javascript',
      );
      expect(res.end).toHaveBeenCalledWith(expect.stringMatching(/.+/));
    });

    it('should handle requests with query parameters', async () => {
      const plugin = workerifyPlugin();
      plugin.configureServer?.(mockServer);

      const middleware = captureMockMiddleware(mockServer);
      const req = createMockRequest('/workerify-sw.js?v=123');
      const res = createMockResponse();

      const handled = await callMiddleware(middleware, req, res);

      // Should not match due to query parameters
      expect(handled).toBe(false);
      expect(res.setHeader).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });
  });

  describe('Build generation', () => {
    it('should emit service worker file during build', () => {
      const plugin = workerifyPlugin({ swFileName: 'build-sw.js' });

      plugin.generateBundle?.call(mockContext);

      expect(mockContext.emitFile).toHaveBeenCalledOnce();
      expect(mockContext.emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName: 'build-sw.js',
        source: expect.stringMatching(/.+/),
      });
    });

    it('should emit with default filename', () => {
      const plugin = workerifyPlugin();

      plugin.generateBundle?.call(mockContext);

      expect(mockContext.emitFile).toHaveBeenCalledWith({
        type: 'asset',
        fileName: 'workerify-sw.js',
        source: expect.stringMatching(/.+/),
      });
    });

    it('should emit non-empty service worker source', () => {
      const plugin = workerifyPlugin();

      plugin.generateBundle?.call(mockContext);

      const emitCall = mockContext.emitFile.mock.calls[0][0];
      expect(emitCall.source).toBeTruthy();
      expect(typeof emitCall.source).toBe('string');
      expect(emitCall.source.length).toBeGreaterThan(0);
    });
  });

  describe('Virtual module resolution', () => {
    it('should resolve virtual workerify-register module', () => {
      const plugin = workerifyPlugin();

      const resolved = plugin.resolveId?.('virtual:workerify-register');

      expect(resolved).toBe('\0virtual:workerify-register');
    });

    it('should not resolve other modules', () => {
      const plugin = workerifyPlugin();

      const resolved1 = plugin.resolveId?.('other-module');
      const resolved2 = plugin.resolveId?.('virtual:other');
      const resolved3 = plugin.resolveId?.('regular-file.js');

      expect(resolved1).toBeNull();
      expect(resolved2).toBeNull();
      expect(resolved3).toBeNull();
    });

    it('should load virtual workerify-register module', () => {
      const plugin = workerifyPlugin({
        scope: '/api/',
        swFileName: 'custom.js',
      });

      const moduleCode = plugin.load?.('\0virtual:workerify-register');

      expect(moduleCode).toBeTruthy();
      expect(typeof moduleCode).toBe('string');
      expect(moduleCode).toContain('custom.js');
      expect(moduleCode).toContain('/api/');
    });

    it('should not load other modules', () => {
      const plugin = workerifyPlugin();

      const result1 = plugin.load?.('other-module');
      const result2 = plugin.load?.('\0virtual:other');
      const result3 = plugin.load?.('regular-file.js');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should generate valid JavaScript in virtual module', () => {
      const plugin = workerifyPlugin();

      const moduleCode = plugin.load?.('\0virtual:workerify-register');

      expect(moduleCode).toBeTruthy();
      expect(typeof moduleCode).toBe('string');

      // Should be valid JavaScript (basic syntax check for ES modules)
      expect(isValidJavaScript(moduleCode as string)).toBe(true);
    });
  });

  describe('Plugin interface compliance', () => {
    it('should have required plugin properties', () => {
      const plugin = workerifyPlugin();

      expect(plugin).toHaveProperty('name');
      expect(plugin).toHaveProperty('configResolved');
      expect(plugin).toHaveProperty('configureServer');
      expect(plugin).toHaveProperty('generateBundle');
      expect(plugin).toHaveProperty('resolveId');
      expect(plugin).toHaveProperty('load');

      expect(typeof plugin.name).toBe('string');
      expect(typeof plugin.configResolved).toBe('function');
      expect(typeof plugin.configureServer).toBe('function');
      expect(typeof plugin.generateBundle).toBe('function');
      expect(typeof plugin.resolveId).toBe('function');
      expect(typeof plugin.load).toBe('function');
    });

    it('should have correct enforce value', () => {
      const plugin = workerifyPlugin();

      expect(plugin.enforce).toBe('pre');
    });

    it('should export type definitions', () => {
      // This is a compile-time test - if the types are exported, TypeScript won't complain
      const options: WorkerifyPluginOptions = {
        scope: '/test/',
        swFileName: 'test.js',
      };

      expect(options.scope).toBe('/test/');
      expect(options.swFileName).toBe('test.js');
    });
  });
});
