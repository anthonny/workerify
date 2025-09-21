import { describe, it, expect } from 'vitest';
import { SW_TEMPLATE } from '../generated/service-worker-template.js';
import { isValidJavaScript } from './test-utils.js';

describe('Service Worker Template', () => {
  describe('Template validation', () => {
    it('should be a non-empty string', () => {
      expect(SW_TEMPLATE).toBeTruthy();
      expect(typeof SW_TEMPLATE).toBe('string');
      expect(SW_TEMPLATE.length).toBeGreaterThan(0);
    });

    it('should contain valid JavaScript code', () => {
      expect(isValidJavaScript(SW_TEMPLATE)).toBe(true);
    });

    it('should be compiled JavaScript code', () => {
      // Generated template should not contain TypeScript-specific syntax
      expect(SW_TEMPLATE).not.toContain('interface ');
      expect(SW_TEMPLATE).not.toContain(': string');
      expect(SW_TEMPLATE).not.toContain(': number');
      expect(SW_TEMPLATE).not.toContain(': boolean');
    });
  });

  describe('Service Worker functionality', () => {
    it('should contain BroadcastChannel setup', () => {
      expect(SW_TEMPLATE).toContain('BroadcastChannel');
      expect(SW_TEMPLATE).toContain('workerify');
    });

    it('should contain fetch event listener', () => {
      expect(SW_TEMPLATE).toContain('fetch');
      expect(SW_TEMPLATE).toContain('addEventListener');
    });

    it('should contain route matching logic', () => {
      // Should contain variables or functions related to route handling
      expect(SW_TEMPLATE).toMatch(/route|Route/);
    });

    it('should contain message handling', () => {
      expect(SW_TEMPLATE).toContain('message');
      expect(SW_TEMPLATE).toMatch(/postMessage|onmessage/);
    });

    it('should contain self reference for Service Worker context', () => {
      expect(SW_TEMPLATE).toContain('self');
    });
  });

  describe('Service Worker events', () => {
    it('should handle install event', () => {
      expect(SW_TEMPLATE).toContain('install');
    });

    it('should handle activate event', () => {
      expect(SW_TEMPLATE).toContain('activate');
    });

    it('should handle fetch event', () => {
      expect(SW_TEMPLATE).toContain('fetch');
    });

    it('should handle message event', () => {
      expect(SW_TEMPLATE).toContain('message');
    });
  });

  describe('Communication protocol', () => {
    it('should contain workerify message types', () => {
      expect(SW_TEMPLATE).toContain('workerify:');
    });

    it('should handle routes update messages', () => {
      expect(SW_TEMPLATE).toContain('routes');
      expect(SW_TEMPLATE).toContain('update');
    });

    it('should handle request messages', () => {
      expect(SW_TEMPLATE).toContain('handle');
    });

    it('should send response messages', () => {
      expect(SW_TEMPLATE).toContain('response');
    });
  });

  describe('Error handling', () => {
    it('should handle service worker lifecycle', () => {
      // Service worker should handle install and activate events
      expect(SW_TEMPLATE).toContain('install');
      expect(SW_TEMPLATE).toContain('activate');
    });

    it('should handle message communication', () => {
      // Should handle postMessage communication
      expect(SW_TEMPLATE).toContain('postMessage');
    });
  });

  describe('Performance considerations', () => {
    it('should not be excessively large', () => {
      // Service worker should be reasonably sized (under 50KB for example)
      expect(SW_TEMPLATE.length).toBeLessThan(50 * 1024);
    });

    it('should not contain debugger statements', () => {
      // Should not contain debugger statements
      expect(SW_TEMPLATE).not.toContain('debugger');
    });

    it('should be compiled JavaScript', () => {
      // Should not contain unnecessary trailing spaces
      expect(SW_TEMPLATE).not.toContain('  \n'); // No trailing spaces
      // Should be actual compiled output
      expect(SW_TEMPLATE.length).toBeGreaterThan(100);
    });
  });

  describe('Browser compatibility', () => {
    it('should use ES2022 or compatible syntax', () => {
      // Should not use very modern syntax that might not be supported
      expect(SW_TEMPLATE).not.toContain('??='); // Logical assignment operators
      expect(SW_TEMPLATE).not.toContain('?.['); // Optional chaining in complex forms
    });

    it('should use Service Worker compatible APIs', () => {
      // Should only use APIs available in Service Worker context
      expect(SW_TEMPLATE).not.toContain('document.');
      expect(SW_TEMPLATE).not.toContain('window.');
      expect(SW_TEMPLATE).not.toContain('localStorage');
      expect(SW_TEMPLATE).not.toContain('sessionStorage');
    });

    it('should use proper Service Worker event handling', () => {
      expect(SW_TEMPLATE).toContain('respondWith');
      expect(SW_TEMPLATE).toContain('waitUntil');
    });
  });

  describe('Security considerations', () => {
    it('should not contain hardcoded credentials', () => {
      expect(SW_TEMPLATE).not.toMatch(/password|secret|key|token/i);
      expect(SW_TEMPLATE).not.toMatch(/api[_-]?key/i);
    });

    it('should not contain eval or Function constructor', () => {
      expect(SW_TEMPLATE).not.toContain('eval(');
      expect(SW_TEMPLATE).not.toContain('Function(');
      expect(SW_TEMPLATE).not.toContain('new Function');
    });

    it('should not contain potential XSS vectors', () => {
      expect(SW_TEMPLATE).not.toContain('innerHTML');
      expect(SW_TEMPLATE).not.toContain('outerHTML');
      expect(SW_TEMPLATE).not.toContain('document.write');
    });
  });
});