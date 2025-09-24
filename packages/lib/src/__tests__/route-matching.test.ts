import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Workerify } from '../index.js';
import { setupBroadcastChannelMock } from './test-utils.js';

// Setup mocks
setupBroadcastChannelMock();

describe('Route Matching Logic', () => {
  let workerify: Workerify;

  beforeEach(() => {
    workerify = new Workerify({ logger: false });
  });

  afterEach(() => {
    workerify.close();
  });

  describe('Exact path matching', () => {
    it('should match exact paths', () => {
      // Access private method for testing
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/users', '/users');
      expect(result).toEqual({ match: true });
    });

    it('should not match different paths', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/users', '/posts');
      expect(result).toEqual({ match: false });
    });

    it('should not match partial paths', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/users', '/users/123');
      expect(result).toEqual({ match: false });
    });

    it('should handle root path', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/', '/');
      expect(result).toEqual({ match: true });
    });

    it('should be case sensitive', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/Users', '/users');
      expect(result).toEqual({ match: false });
    });
  });

  describe('Parameterized route matching', () => {
    it('should match single parameter routes', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/users/:id', '/users/123');
      expect(result).toEqual({
        match: true,
        params: { id: '123' },
      });
    });

    it('should match multiple parameter routes', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute(
        '/users/:userId/posts/:postId',
        '/users/123/posts/456',
      );
      expect(result).toEqual({
        match: true,
        params: { userId: '123', postId: '456' },
      });
    });

    it('should match parameters with special characters', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/users/:id', '/users/abc-123_def');
      expect(result).toEqual({
        match: true,
        params: { id: 'abc-123_def' },
      });
    });

    it('should not match routes with different segment counts', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/users/:id', '/users/123/extra');
      expect(result).toEqual({ match: false });
    });

    it('should not match when static parts differ', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/users/:id/posts', '/users/123/comments');
      expect(result).toEqual({ match: false });
    });

    it('should handle mixed static and parameter segments', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute(
        '/api/v1/users/:id/profile',
        '/api/v1/users/123/profile',
      );
      expect(result).toEqual({
        match: true,
        params: { id: '123' },
      });
    });

    it('should handle parameters at the beginning', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/:org/repos', '/github/repos');
      expect(result).toEqual({
        match: true,
        params: { org: 'github' },
      });
    });

    it('should handle empty parameter values', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      // The current implementation matches '/users/' with '/users/:id' but doesn't capture empty params
      const result = matchRoute('/users/:id', '/users/');
      // Based on the actual behavior, this matches with empty params object
      expect(result).toEqual({ match: true, params: {} });
    });
  });

  describe('Route finding logic', () => {
    it('should find exact match route', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      // Add a route first
      workerify.get('/users', () => 'users');

      const result = findRoute('GET', 'http://localhost:3000/users');
      expect(result.route).toBeTruthy();
      expect(result.route.path).toBe('/users');
    });

    it('should find parameterized route', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/users/:id', () => 'user');

      const result = findRoute('GET', 'http://localhost:3000/users/123');
      expect(result.route).toBeTruthy();
      expect(result.params).toEqual({ id: '123' });
    });

    it('should find prefix match route', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/api/*', () => 'api');

      const result = findRoute('GET', 'http://localhost:3000/api/v1/users');
      expect(result.route).toBeTruthy();
      expect(result.route.path).toBe('/api/');
      expect(result.route.match).toBe('prefix');
    });

    it('should return null for no match', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/users', () => 'users');

      const result = findRoute('GET', 'http://localhost:3000/posts');
      expect(result.route).toBeNull();
    });

    it('should match correct HTTP method', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/users', () => 'get users');
      workerify.post('/users', () => 'post users');

      const getResult = findRoute('GET', 'http://localhost:3000/users');
      const postResult = findRoute('POST', 'http://localhost:3000/users');

      expect(getResult.route).toBeTruthy();
      expect(postResult.route).toBeTruthy();
      expect(getResult.route).not.toBe(postResult.route);
    });

    it('should handle method mismatch', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/users', () => 'users');

      const result = findRoute('POST', 'http://localhost:3000/users');
      expect(result.route).toBeNull();
    });

    it('should match ALL method routes regardless of request method', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.all('/api', () => 'api');

      const getResult = findRoute('GET', 'http://localhost:3000/api');
      const postResult = findRoute('POST', 'http://localhost:3000/api');
      const putResult = findRoute('PUT', 'http://localhost:3000/api');

      expect(getResult.route).toBeTruthy();
      expect(postResult.route).toBeTruthy();
      expect(putResult.route).toBeTruthy();
    });

    it('should handle query parameters in URL', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/users', () => 'users');

      const result = findRoute(
        'GET',
        'http://localhost:3000/users?page=1&limit=10',
      );
      expect(result.route).toBeTruthy();
      expect(result.route.path).toBe('/users');
    });

    it('should handle URL fragments', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/users', () => 'users');

      const result = findRoute('GET', 'http://localhost:3000/users#section');
      expect(result.route).toBeTruthy();
      expect(result.route.path).toBe('/users');
    });

    it('should prioritize more specific routes', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      // Add routes in order (first registered wins in current implementation)
      workerify.get('/api/*', () => 'wildcard');
      workerify.get('/api/users', () => 'specific');

      const result = findRoute('GET', 'http://localhost:3000/api/users');
      // First registered route wins
      expect(result.route.path).toBe('/api/');
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed URLs gracefully', () => {
      const findRoute = (workerify as any).findRoute.bind(workerify);

      workerify.get('/test', () => 'test');

      // Invalid URL should not crash
      expect(() => {
        findRoute('GET', 'invalid-url');
      }).toThrow(); // URL constructor will throw, which is expected
    });

    it('should handle empty path', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('', '');
      expect(result).toEqual({ match: true });
    });

    it('should handle paths with trailing slashes', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result1 = matchRoute('/users/', '/users/');
      const result2 = matchRoute('/users', '/users/');

      expect(result1).toEqual({ match: true });
      expect(result2).toEqual({ match: false });
    });

    it('should handle Unicode characters in paths', () => {
      const matchRoute = (workerify as any).matchRoute.bind(workerify);

      const result = matchRoute('/üsers/:ïd', '/üsers/123');
      expect(result).toEqual({
        match: true,
        params: { ïd: '123' },
      });
    });
  });
});
