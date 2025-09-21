import { describe, it, expect } from 'vitest';
import { getRegisterModule } from '../generated/register-template.js';
import { isValidJavaScript } from './test-utils.js';

describe('Virtual Module - Workerify Register', () => {
  describe('Module generation', () => {
    it('should generate valid JavaScript module', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toBeTruthy();
      expect(typeof module).toBe('string');
      expect(isValidJavaScript(module)).toBe(true);
    });

    it('should be an ES module', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toContain('export');
      expect(module).not.toContain('module.exports');
      expect(module).not.toContain('exports.');
    });

    it('should export expected functions', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toContain('export');
      expect(module).toMatch(/export\s+(function|const|let|var)/);
    });
  });

  describe('Parameter injection', () => {
    it('should inject SW URL correctly', () => {
      const swUrl = '/custom-worker.js';
      const module = getRegisterModule(swUrl, '/', 'custom-worker.js');

      expect(module).toContain(swUrl);
    });

    it('should inject scope correctly', () => {
      const scope = '/api/';
      const module = getRegisterModule('/sw.js', scope, 'sw.js');

      expect(module).toContain(scope);
    });

    it('should inject filename correctly', () => {
      const filename = 'my-service-worker.js';
      const module = getRegisterModule('/my-service-worker.js', '/', filename);

      expect(module).toContain(filename);
    });

    it('should handle special characters in parameters', () => {
      const swUrl = '/wörker-ñame.js';
      const scope = '/äpi/';
      const filename = 'wörker-ñame.js';

      const module = getRegisterModule(swUrl, scope, filename);

      expect(module).toContain(swUrl);
      expect(module).toContain(scope);
      expect(module).toContain(filename);
    });

    it('should handle URL-encoded characters', () => {
      const swUrl = '/worker%20name.js';
      const scope = '/api%2Fv1/';
      const filename = 'worker%20name.js';

      const module = getRegisterModule(swUrl, scope, filename);

      expect(module).toContain(swUrl);
      expect(module).toContain(scope);
      expect(module).toContain(filename);
    });
  });

  describe('Service Worker registration', () => {
    it('should contain service worker registration logic', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toContain('navigator.serviceWorker');
      expect(module).toContain('register');
    });

    it('should handle registration options', () => {
      const module = getRegisterModule('/sw.js', '/custom/', 'sw.js');

      expect(module).toMatch(/scope|options/);
    });

    it('should contain proper error handling', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      // Should handle unsupported browsers or other edge cases
      expect(module).toMatch(/warn|supported|null/);
    });

    it('should return registration promise', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toMatch(/Promise|return/);
    });
  });

  describe('Browser compatibility checks', () => {
    it('should check for Service Worker support', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toContain('serviceWorker');
      expect(module).toMatch(/if|navigator\.serviceWorker/);
    });

    it('should gracefully handle unsupported browsers', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      // Should check for support and handle absence
      expect(module).toMatch(/if.*serviceWorker|serviceWorker.*if/);
    });
  });

  describe('Different configuration scenarios', () => {
    it('should handle root scope', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toContain('/');
      expect(isValidJavaScript(module)).toBe(true);
    });

    it('should handle deep scope paths', () => {
      const module = getRegisterModule('/api/v1/sw.js', '/api/v1/', 'sw.js');

      expect(module).toContain('/api/v1/');
      expect(isValidJavaScript(module)).toBe(true);
    });

    it('should handle complex SW URLs', () => {
      const module = getRegisterModule('/assets/service-workers/main.js', '/app/', 'main.js');

      expect(module).toContain('/assets/service-workers/main.js');
      expect(module).toContain('/app/');
      expect(isValidJavaScript(module)).toBe(true);
    });

    it('should handle SW with query parameters', () => {
      const module = getRegisterModule('/sw.js?v=123', '/', 'sw.js');

      expect(module).toContain('/sw.js?v=123');
      expect(isValidJavaScript(module)).toBe(true);
    });
  });

  describe('Module content validation', () => {
    it('should not contain template placeholders', () => {
      const module = getRegisterModule('/test.js', '/test/', 'test.js');

      expect(module).not.toContain('__SW_URL__');
      expect(module).not.toContain('__SCOPE__');
      expect(module).not.toContain('__SW_FILENAME__');
    });

    it('should contain actual values instead of placeholders', () => {
      const swUrl = '/actual-worker.js';
      const scope = '/actual-scope/';
      const filename = 'actual-worker.js';

      const module = getRegisterModule(swUrl, scope, filename);

      expect(module).toContain(swUrl);
      expect(module).toContain(scope);
      expect(module).toContain(filename);
    });

    it('should be executable JavaScript', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      // Should be valid ES module JavaScript
      expect(isValidJavaScript(module)).toBe(true);
    });

    it('should not contain compilation artifacts', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      // Should not contain TypeScript or build artifacts
      expect(module).not.toContain('__dirname');
      expect(module).not.toContain('__filename');
      expect(module).not.toContain('require(');
      expect(module).not.toContain('import type');
      expect(module).not.toContain('interface ');
    });
  });

  describe('Function exports', () => {
    it('should export registration function', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toMatch(/export\s+(function|const|let)\s+\w+/);
    });

    it('should contain function that can register SW', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toContain('register');
      expect(module).toContain('serviceWorker');
    });

    it('should provide async registration', () => {
      const module = getRegisterModule('/sw.js', '/', 'sw.js');

      expect(module).toMatch(/async|Promise/);
    });
  });

  describe('Error scenarios', () => {
    it('should handle empty parameters gracefully', () => {
      const module = getRegisterModule('', '', '');

      expect(typeof module).toBe('string');
      expect(isValidJavaScript(module)).toBe(true);
    });

    it('should handle null-like parameters', () => {
      const module = getRegisterModule('null', 'null', 'null');

      expect(typeof module).toBe('string');
      expect(module).toContain('null');
    });

    it('should handle special JavaScript strings', () => {
      const module = getRegisterModule('/sw.js', '/', "'test\"quotes'.js");

      expect(typeof module).toBe('string');
      expect(isValidJavaScript(module)).toBe(true);
    });
  });

  describe('Security considerations', () => {
    it('should not allow code injection through parameters', () => {
      const maliciousCode = "'; console.log('xss'); //";
      const module = getRegisterModule(maliciousCode, '/', 'sw.js');

      // The module should still be valid and not execute the malicious code
      expect(isValidJavaScript(module)).toBe(true);
      // Should contain the escaped string, not the raw code
      expect(module).toContain(JSON.stringify(maliciousCode));
    });

    it('should properly escape string parameters', () => {
      const withQuotes = "/sw'with\"quotes.js";
      const module = getRegisterModule(withQuotes, '/', 'sw.js');

      expect(isValidJavaScript(module)).toBe(true);
    });

    it('should handle newlines in parameters', () => {
      const withNewlines = '/sw\nwith\rbreaks.js';
      const module = getRegisterModule(withNewlines, '/', 'sw.js');

      expect(isValidJavaScript(module)).toBe(true);
    });
  });
});