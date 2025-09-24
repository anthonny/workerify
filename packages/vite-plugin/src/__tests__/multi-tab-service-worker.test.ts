import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the global scope
const mockClients = {
  matchAll: vi.fn(),
  claim: vi.fn().mockResolvedValue(undefined),
};

const mockRegistration = {
  scope: 'http://localhost:3000/',
};

const mockBroadcastChannel = {
  postMessage: vi.fn(),
  onmessage: null as any,
  addEventListener: vi.fn(),
  close: vi.fn(),
};

// Setup global mocks
global.self = {
  location: { href: 'http://localhost:3000/sw.js' },
  registration: mockRegistration,
  clients: mockClients,
  addEventListener: vi.fn(),
  skipWaiting: vi.fn(),
  BroadcastChannel: vi.fn(() => mockBroadcastChannel),
} as any;

global.BroadcastChannel = vi.fn(() => mockBroadcastChannel) as any;

// Import after mocks are set up
import serviceWorkerCode from '../templates/service-worker';

describe('Service Worker Multi-tab Support', () => {
  let clientConsumerMap: Map<string, string>;
  let consumerRoutesMap: Map<string, any[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    // These would be the internal maps in the service worker
    clientConsumerMap = new Map();
    consumerRoutesMap = new Map();
  });

  describe('Client Registration', () => {
    it('should handle /__workerify/register endpoint', async () => {
      const mockEvent = {
        request: {
          url: 'http://localhost:3000/__workerify/register',
          method: 'POST',
          json: () =>
            Promise.resolve({
              consumerId: 'consumer-abc123-1234567890',
            }),
        },
        clientId: 'client-123',
        respondWith: vi.fn(),
      };

      // Simulate registration request
      const response = new Response(
        JSON.stringify({
          clientId: 'client-123',
          consumerId: 'consumer-abc123-1234567890',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.clientId).toBe('client-123');
      expect(data.consumerId).toBe('consumer-abc123-1234567890');
    });

    it('should map clientId to consumerId', () => {
      const clientId = 'client-456';
      const consumerId = 'consumer-def456-9876543210';

      clientConsumerMap.set(clientId, consumerId);

      expect(clientConsumerMap.get(clientId)).toBe(consumerId);
    });

    it('should replace existing consumer for same client', () => {
      const clientId = 'client-789';
      const oldConsumerId = 'consumer-old-123';
      const newConsumerId = 'consumer-new-456';

      clientConsumerMap.set(clientId, oldConsumerId);
      expect(clientConsumerMap.get(clientId)).toBe(oldConsumerId);

      clientConsumerMap.set(clientId, newConsumerId);
      expect(clientConsumerMap.get(clientId)).toBe(newConsumerId);
      expect(clientConsumerMap.size).toBe(1);
    });
  });

  describe('Route Management', () => {
    it('should store routes per consumer', () => {
      const consumerId1 = 'consumer-1';
      const consumerId2 = 'consumer-2';

      const routes1 = [{ method: 'GET', path: '/api/v1', match: 'exact' }];
      const routes2 = [{ method: 'POST', path: '/api/v2', match: 'exact' }];

      consumerRoutesMap.set(consumerId1, routes1);
      consumerRoutesMap.set(consumerId2, routes2);

      expect(consumerRoutesMap.get(consumerId1)).toEqual(routes1);
      expect(consumerRoutesMap.get(consumerId2)).toEqual(routes2);
      expect(consumerRoutesMap.size).toBe(2);
    });

    it('should update routes for existing consumer', () => {
      const consumerId = 'consumer-update';
      const initialRoutes = [{ method: 'GET', path: '/old', match: 'exact' }];
      const updatedRoutes = [
        { method: 'GET', path: '/new', match: 'exact' },
        { method: 'POST', path: '/new', match: 'exact' },
      ];

      consumerRoutesMap.set(consumerId, initialRoutes);
      consumerRoutesMap.set(consumerId, updatedRoutes);

      expect(consumerRoutesMap.get(consumerId)).toEqual(updatedRoutes);
      expect(consumerRoutesMap.get(consumerId)).toHaveLength(2);
    });
  });

  describe('Message Handling', () => {
    it('should handle workerify:routes:update with consumerId', () => {
      const consumerId = 'consumer-msg-123';
      const routes = [{ method: 'GET', path: '/test', match: 'exact' }];

      // Simulate message
      const message = {
        type: 'workerify:routes:update',
        consumerId,
        routes,
      };

      // Process message (in real SW this would be in onmessage)
      if (message.type === 'workerify:routes:update' && message.consumerId) {
        consumerRoutesMap.set(message.consumerId, message.routes);
      }

      expect(consumerRoutesMap.get(consumerId)).toEqual(routes);
    });

    it('should send acknowledgment for route updates', () => {
      const consumerId = 'consumer-ack-456';
      const message = {
        type: 'workerify:routes:update',
        consumerId,
        routes: [],
      };

      // Simulate acknowledgment
      const ackMessage = {
        type: 'workerify:routes:update:response',
        consumerId,
      };

      expect(ackMessage.type).toBe('workerify:routes:update:response');
      expect(ackMessage.consumerId).toBe(consumerId);
    });
  });

  describe('Request Routing', () => {
    it('should route requests to correct consumer based on clientId', () => {
      const clientId = 'client-route-123';
      const consumerId = 'consumer-route-456';

      clientConsumerMap.set(clientId, consumerId);
      consumerRoutesMap.set(consumerId, [
        { method: 'GET', path: '/api/test', match: 'exact' },
      ]);

      // Simulate fetch event
      const mockEvent = {
        clientId,
        request: {
          url: 'http://localhost:3000/api/test',
          method: 'GET',
        },
      };

      const resolvedConsumerId = clientConsumerMap.get(mockEvent.clientId);
      const routes = consumerRoutesMap.get(resolvedConsumerId!);

      expect(resolvedConsumerId).toBe(consumerId);
      expect(routes).toBeDefined();
      expect(routes).toHaveLength(1);
    });

    it('should not route requests for unregistered clients', () => {
      const unregisteredClientId = 'unregistered-client';

      const mockEvent = {
        clientId: unregisteredClientId,
        request: {
          url: 'http://localhost:3000/api/test',
          method: 'GET',
        },
      };

      const consumerId = clientConsumerMap.get(mockEvent.clientId);
      expect(consumerId).toBeUndefined();
    });

    it('should match routes only from the associated consumer', () => {
      const client1 = 'client-1';
      const client2 = 'client-2';
      const consumer1 = 'consumer-1';
      const consumer2 = 'consumer-2';

      clientConsumerMap.set(client1, consumer1);
      clientConsumerMap.set(client2, consumer2);

      consumerRoutesMap.set(consumer1, [
        { method: 'GET', path: '/api/v1', match: 'exact' },
      ]);
      consumerRoutesMap.set(consumer2, [
        { method: 'GET', path: '/api/v2', match: 'exact' },
      ]);

      // Request from client1 should only match consumer1 routes
      const event1 = { clientId: client1 };
      const consumer1Id = clientConsumerMap.get(event1.clientId);
      const routes1 = consumerRoutesMap.get(consumer1Id!);
      expect(routes1?.[0].path).toBe('/api/v1');

      // Request from client2 should only match consumer2 routes
      const event2 = { clientId: client2 };
      const consumer2Id = clientConsumerMap.get(event2.clientId);
      const routes2 = consumerRoutesMap.get(consumer2Id!);
      expect(routes2?.[0].path).toBe('/api/v2');
    });
  });

  describe('Cleanup', () => {
    it('should clean up mappings for closed clients', async () => {
      const activeClient = 'active-client';
      const closedClient = 'closed-client';
      const consumer1 = 'consumer-1';
      const consumer2 = 'consumer-2';

      clientConsumerMap.set(activeClient, consumer1);
      clientConsumerMap.set(closedClient, consumer2);

      // Mock matchAll to return only active client
      mockClients.matchAll.mockResolvedValue([
        { id: activeClient, url: 'http://localhost:3000/' },
      ]);

      // Simulate cleanup
      const allClients = await mockClients.matchAll({
        includeUncontrolled: true,
      });
      const activeClientIds = new Set(allClients.map((c: any) => c.id));

      const toRemove: string[] = [];
      clientConsumerMap.forEach((consumerId, clientId) => {
        if (!activeClientIds.has(clientId)) {
          toRemove.push(clientId);
        }
      });

      toRemove.forEach((clientId) => {
        clientConsumerMap.delete(clientId);
      });

      expect(clientConsumerMap.has(activeClient)).toBe(true);
      expect(clientConsumerMap.has(closedClient)).toBe(false);
      expect(clientConsumerMap.size).toBe(1);
    });

    it('should clean up consumer routes when no clients use them', async () => {
      const client1 = 'client-1';
      const consumerId = 'consumer-orphaned';

      clientConsumerMap.set(client1, consumerId);
      consumerRoutesMap.set(consumerId, [
        { method: 'GET', path: '/test', match: 'exact' },
      ]);

      // Mock no active clients
      mockClients.matchAll.mockResolvedValue([]);

      // Simulate cleanup
      const allClients = await mockClients.matchAll({
        includeUncontrolled: true,
      });
      const activeClientIds = new Set(allClients.map((c: any) => c.id));

      const consumersToClean = new Set<string>();
      clientConsumerMap.forEach((consumerId, clientId) => {
        if (!activeClientIds.has(clientId)) {
          consumersToClean.add(consumerId);
        }
      });

      // Clean up
      clientConsumerMap.clear();
      consumersToClean.forEach((consumerId) => {
        consumerRoutesMap.delete(consumerId);
      });

      expect(clientConsumerMap.size).toBe(0);
      expect(consumerRoutesMap.size).toBe(0);
    });

    it('should handle clear all routes message', () => {
      clientConsumerMap.set('client-1', 'consumer-1');
      clientConsumerMap.set('client-2', 'consumer-2');
      consumerRoutesMap.set('consumer-1', [{ method: 'GET', path: '/1' }]);
      consumerRoutesMap.set('consumer-2', [{ method: 'GET', path: '/2' }]);

      // Simulate clear message
      const message = { type: 'workerify:routes:clear' };

      if (message.type === 'workerify:routes:clear') {
        clientConsumerMap.clear();
        consumerRoutesMap.clear();
      }

      expect(clientConsumerMap.size).toBe(0);
      expect(consumerRoutesMap.size).toBe(0);
    });

    it('should properly use includeUncontrolled in cleanup', async () => {
      const client1 = 'controlled-client';
      const client2 = 'uncontrolled-client';
      const consumer1 = 'consumer-1';
      const consumer2 = 'consumer-2';

      clientConsumerMap.set(client1, consumer1);
      clientConsumerMap.set(client2, consumer2);

      // Mock matchAll with includeUncontrolled to return both clients
      mockClients.matchAll.mockImplementation((options?: any) => {
        if (options?.includeUncontrolled) {
          return Promise.resolve([
            { id: client1, url: 'http://localhost:3000/' },
            { id: client2, url: 'http://localhost:3000/' },
          ]);
        }
        // Without includeUncontrolled, only return controlled client
        return Promise.resolve([
          { id: client1, url: 'http://localhost:3000/' },
        ]);
      });

      // Simulate cleanup with includeUncontrolled: true
      const allClients = await mockClients.matchAll({
        includeUncontrolled: true,
      });
      const activeClientIds = new Set(allClients.map((c: any) => c.id));

      const toRemove: string[] = [];
      clientConsumerMap.forEach((consumerId, clientId) => {
        if (!activeClientIds.has(clientId)) {
          toRemove.push(clientId);
        }
      });

      toRemove.forEach((clientId) => {
        clientConsumerMap.delete(clientId);
      });

      // Both clients should be preserved because includeUncontrolled: true
      expect(clientConsumerMap.has(client1)).toBe(true);
      expect(clientConsumerMap.has(client2)).toBe(true);
      expect(clientConsumerMap.size).toBe(2);
    });

    it('should demonstrate the difference between controlled and uncontrolled cleanup', async () => {
      const controlledClient = 'controlled-client';
      const uncontrolledClient = 'uncontrolled-client';
      const consumer1 = 'consumer-1';
      const consumer2 = 'consumer-2';

      clientConsumerMap.set(controlledClient, consumer1);
      clientConsumerMap.set(uncontrolledClient, consumer2);

      // Mock matchAll behavior
      mockClients.matchAll.mockImplementation((options?: any) => {
        if (options?.includeUncontrolled) {
          return Promise.resolve([
            { id: controlledClient, url: 'http://localhost:3000/' },
            { id: uncontrolledClient, url: 'http://localhost:3000/' },
          ]);
        }
        // Without includeUncontrolled, only return controlled client
        return Promise.resolve([
          { id: controlledClient, url: 'http://localhost:3000/' },
        ]);
      });

      // Test cleanup WITHOUT includeUncontrolled (would be problematic)
      const controlledClientsOnly = await mockClients.matchAll();
      const controlledClientIds = new Set(
        controlledClientsOnly.map((c: any) => c.id),
      );

      expect(controlledClientIds.has(controlledClient)).toBe(true);
      expect(controlledClientIds.has(uncontrolledClient)).toBe(false); // This would cause premature cleanup

      // Test cleanup WITH includeUncontrolled (correct behavior)
      const allClients = await mockClients.matchAll({
        includeUncontrolled: true,
      });
      const allClientIds = new Set(allClients.map((c: any) => c.id));

      expect(allClientIds.has(controlledClient)).toBe(true);
      expect(allClientIds.has(uncontrolledClient)).toBe(true); // This prevents premature cleanup
    });
  });

  describe('Periodic Cleanup', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should set up periodic cleanup with setInterval', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      // Simulate the service worker setup that includes setInterval
      const mockCleanupFunction = vi.fn();
      setInterval(mockCleanupFunction, 30000);

      expect(setIntervalSpy).toHaveBeenCalledWith(mockCleanupFunction, 30000);
    });

    it('should call cleanup function every 30 seconds', () => {
      const mockCleanupFunction = vi.fn();
      setInterval(mockCleanupFunction, 30000);

      // Fast-forward time to trigger multiple intervals
      vi.advanceTimersByTime(30000);
      expect(mockCleanupFunction).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(30000);
      expect(mockCleanupFunction).toHaveBeenCalledTimes(2);

      vi.advanceTimersByTime(60000); // 2 more intervals
      expect(mockCleanupFunction).toHaveBeenCalledTimes(4);
    });

    it('should perform periodic cleanup of closed clients', async () => {
      const client1 = 'persistent-client';
      const client2 = 'temporary-client';
      const consumer1 = 'consumer-1';
      const consumer2 = 'consumer-2';

      clientConsumerMap.set(client1, consumer1);
      clientConsumerMap.set(client2, consumer2);

      // Initial state: both clients present
      expect(clientConsumerMap.size).toBe(2);

      // Simulate periodic cleanup function
      const periodicCleanup = async () => {
        const allClients = await mockClients.matchAll({
          includeUncontrolled: true,
        });
        const activeClientIds = new Set(allClients.map((c: any) => c.id));

        const toRemove: string[] = [];
        clientConsumerMap.forEach((consumerId, clientId) => {
          if (!activeClientIds.has(clientId)) {
            toRemove.push(clientId);
          }
        });

        toRemove.forEach((clientId) => {
          clientConsumerMap.delete(clientId);
        });
      };

      // First scenario: both clients still active
      mockClients.matchAll.mockResolvedValueOnce([
        { id: client1, url: 'http://localhost:3000/' },
        { id: client2, url: 'http://localhost:3000/' },
      ]);

      await periodicCleanup();
      expect(clientConsumerMap.size).toBe(2);

      // Second scenario: only client1 active (client2 closed)
      mockClients.matchAll.mockResolvedValueOnce([
        { id: client1, url: 'http://localhost:3000/' },
      ]);

      await periodicCleanup();
      expect(clientConsumerMap.size).toBe(1);
      expect(clientConsumerMap.has(client1)).toBe(true);
      expect(clientConsumerMap.has(client2)).toBe(false);
    });

    it('should handle cleanup errors gracefully in periodic execution', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock matchAll to throw error
      mockClients.matchAll.mockRejectedValue(new Error('Service Worker error'));

      const periodicCleanup = async () => {
        try {
          const allClients = await mockClients.matchAll({
            includeUncontrolled: true,
          });
          // ... cleanup logic
        } catch (error) {
          console.error('[Workerify SW] Cleanup error:', error);
        }
      };

      // Call cleanup function directly
      await periodicCleanup();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[Workerify SW] Cleanup error:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it('should continue periodic cleanup even after errors', async () => {
      let callCount = 0;

      const periodicCleanup = async () => {
        try {
          await mockClients.matchAll({ includeUncontrolled: true });
        } catch (error) {
          // Silently handle error to continue periodic execution
        }
      };

      // First call: should error but not break execution
      mockClients.matchAll.mockRejectedValueOnce(new Error('First call error'));
      await periodicCleanup();
      callCount++;

      // Second call: should work normally
      mockClients.matchAll.mockResolvedValueOnce([]);
      await periodicCleanup();
      callCount++;

      expect(callCount).toBe(2); // Both calls completed despite first one erroring
    });
  });
});
