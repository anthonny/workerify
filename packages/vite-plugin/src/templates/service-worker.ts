// === Workerify SW ===
console.log('[Workerify SW] Service worker script loaded');
console.log('[Workerify SW] Current location:', self.location.href);
console.log('[Workerify SW] Scope:', self.registration?.scope);

const CHANNEL = new BroadcastChannel('workerify');
// Map of clientId -> consumerId
const clientConsumerMap = new Map<string, string>();
// Map of consumerId -> routes
const consumerRoutesMap = new Map<
  string,
  Array<{ method?: string; path: string; match?: string }>
>();

CHANNEL.onmessage = (ev) => {
  const msg = ev.data;
  if (msg?.type === 'workerify:sw:check-readiness') {
    console.log('[Workerify SW] Check readiness:');

    if (self.registration?.active?.state === 'activated') {
      // Send acknowledgment
      CHANNEL.postMessage({
        type: 'workerify:sw:check-readiness:response',
        body: self.registration?.active?.state === 'activated',
      });
    }
  }
  if (msg?.type === 'workerify:routes:update' && msg.consumerId) {
    console.log(
      '[Workerify SW] Updating routes for consumer:',
      msg.consumerId,
      msg.routes,
    );
    consumerRoutesMap.set(msg.consumerId, msg.routes || []);

    // Send acknowledgment
    CHANNEL.postMessage({
      type: 'workerify:routes:update:response',
      consumerId: msg.consumerId,
    });
  }

  if (msg?.type === 'workerify:routes:list') {
    console.log('[Workerify SW] Active consumers and their routes:');
    consumerRoutesMap.forEach((routes, consumerId) => {
      console.log(`Consumer: ${consumerId}`);
      console.table(routes.map((r) => [r.method, r.path, r.match]));
    });
  }

  if (msg?.type === 'workerify:routes:clear') {
    consumerRoutesMap.clear();
    clientConsumerMap.clear();
  }

  if (msg?.type === 'workerify:clients:list') {
    console.log('[Workerify SW] Listing all clients...');
    self.clients
      .matchAll({ includeUncontrolled: true })
      .then((clients: readonly Client[]) => {
        console.log('[Workerify SW] Total clients found:', clients.length);
        clients.forEach((client: Client, i: number) => {
          console.log(`[Workerify SW] Client ${i + 1}:`, {
            id: client.id,
            url: client.url,
            type: client.type,
            frameType: client.frameType,
          });
        });

        console.log('[Workerify SW] Client-Consumer mappings:');
        console.table(
          Array.from(clientConsumerMap.entries()).map(
            ([clientId, consumerId]) => ({
              clientId,
              consumerId,
              hasActiveClient: clients.some((c) => c.id === clientId),
            }),
          ),
        );
      })
      .catch((error: any) => {
        console.error('[Workerify SW] Error listing clients:', error);
      });
  }
};

self.addEventListener('install', () => {
  console.log('[Workerify SW] Installing');
  self.skipWaiting();
});

self.addEventListener('activate', (e: ExtendableEvent) => {
  console.log('[Workerify SW] Activating');
  console.log(
    '[Workerify SW] Will start intercepting requests for scope:',
    self.registration.scope,
  );
  e.waitUntil(
    self.clients.claim().then(() => {
      console.log('[Workerify SW] Now controlling all clients');
      console.log(
        '[Workerify SW] Notify SW is ready',
        self.registration?.active?.state,
      );
      // Send acknowledgment
      CHANNEL.postMessage({
        type: 'workerify:sw:check-readiness:response',
        body: self.registration?.active?.state === 'activated',
      });
      // Clean up mappings for closed clients
      cleanupClosedClients();
    }),
  );
});

// Periodically clean up mappings for closed clients
setInterval(() => {
  cleanupClosedClients();
}, 30000); // Every 30 seconds

async function cleanupClosedClients() {
  try {
    const allClients = await self.clients.matchAll({
      includeUncontrolled: true,
    });
    const activeClientIds = new Set(allClients.map((c) => c.id));

    // Remove mappings for clients that no longer exist
    const toRemove: string[] = [];
    clientConsumerMap.forEach((consumerId, clientId) => {
      if (!activeClientIds.has(clientId)) {
        toRemove.push(clientId);
        // Also clean up routes if no other clients use this consumer
        const hasOtherClients =
          Array.from(clientConsumerMap.values()).filter(
            (cid) => cid === consumerId,
          ).length > 1;
        if (!hasOtherClients) {
          consumerRoutesMap.delete(consumerId);
          console.log('[Workerify SW] Cleaned up consumer:', consumerId);
        }
      }
    });

    toRemove.forEach((clientId) => {
      clientConsumerMap.delete(clientId);
      console.log('[Workerify SW] Cleaned up client:', clientId);
    });
  } catch (error) {
    console.error('[Workerify SW] Cleanup error:', error);
  }
}

function matchRoute(
  url: string,
  method: string,
  routes: Array<{ method?: string; path: string; match?: string }>,
) {
  const u = new URL(url);
  const pathname = u.pathname;
  method = method.toUpperCase();

  for (const r of routes) {
    if (r.method && r.method !== method) continue;

    if ((r.match ?? 'exact') === 'prefix') {
      if (pathname.startsWith(r.path)) return r;
    } else {
      // Check for exact match or parameterized route
      if (pathname === r.path) return r;

      // Check if route has parameters
      if (r.path.includes(':')) {
        const routeParts = r.path.split('/');
        const pathParts = pathname.split('/');

        // If different number of segments, no match
        if (routeParts.length !== pathParts.length) continue;

        let isMatch = true;
        for (let i = 0; i < routeParts.length; i++) {
          const routePart = routeParts[i];
          const pathPart = pathParts[i];

          // Skip parameter parts (they always match)
          if (routePart.startsWith(':')) continue;

          // Static parts must match exactly
          if (routePart !== pathPart) {
            isMatch = false;
            break;
          }
        }

        if (isMatch) return r;
      }
    }
  }
  return null;
}

const pending = new Map<string, { resolve: (value: any) => void }>();

CHANNEL.addEventListener('message', (ev) => {
  const m = ev.data;
  if (m?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (m?.type === 'workerify:response' && m.id && pending.has(m.id)) {
    const resolver = pending.get(m.id);
    if (resolver) {
      resolver.resolve(m);
      pending.delete(m.id);
    }
  }
});

// Test if fetch listener is working at all
console.log('[Workerify SW] Adding fetch event listener...');

self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    (async () => {
      const { request } = event;
      const url = new URL(request.url);

      // Handle registration endpoint
      if (
        url.pathname === '/__workerify/register' &&
        request.method === 'POST'
      ) {
        console.log('[Workerify SW] Register new consumer');
        return handleRegistration(event);
      }

      // Get the consumer ID for this client
      const clientId = event.clientId || (event as any).resultingClientId;
      const consumerId = clientId ? clientConsumerMap.get(clientId) : undefined;

      if (!consumerId) {
        // No consumer registered for this client
        return fetch(request);
      }

      // Get routes for this consumer
      const routes = consumerRoutesMap.get(consumerId) || [];
      const hit = matchRoute(request.url, request.method, routes);

      if (!hit) {
        return fetch(request);
      }

      return handle(event, consumerId);
    })(),
  );
});

async function handleRegistration(event: FetchEvent): Promise<Response> {
  try {
    const data = await event.request.json();
    const { consumerId } = data;
    const clientId = event.clientId || (event as any).resultingClientId;

    if (!clientId || !consumerId) {
      return new Response(JSON.stringify({ error: 'Invalid registration' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if there's already a consumer for this client and remove it
    const existingConsumer = clientConsumerMap.get(clientId);
    if (existingConsumer) {
      console.log(
        '[Workerify SW] Replacing consumer for client:',
        clientId,
        'old:',
        existingConsumer,
        'new:',
        consumerId,
      );
    }

    // Set the new mapping
    clientConsumerMap.set(clientId, consumerId);

    console.log(
      '[Workerify SW] Registered consumer:',
      consumerId,
      'for client:',
      clientId,
    );

    return new Response(JSON.stringify({ clientId, consumerId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Workerify SW] Registration error:', error);
    return new Response(JSON.stringify({ error: 'Registration failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

console.log('[Workerify SW] Fetch event listener added');

// Debug service worker state
console.log(
  '[Workerify SW] Service worker state:',
  self.registration?.active?.state,
);
console.log('[Workerify SW] Is controlling clients?', self.clients);

// Test if we can see clients
self.clients.matchAll().then((clients: readonly Client[]) => {
  console.log('[Workerify SW] Current clients:', clients.length);
  clients.forEach((client: Client, i: number) => {
    console.log(`[Workerify SW] Client ${i}:`, client.url);
  });
});

async function handle(
  event: FetchEvent,
  consumerId: string,
): Promise<Response> {
  const req = event.request;
  const id = Math.random().toString(36).slice(2);
  const headers: Record<string, string> = {};
  // biome: ignore
  req.headers.forEach((v, k) => (headers[k] = v));
  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? null
      : await req.arrayBuffer();

  const p = new Promise((resolve) => pending.set(id, { resolve }));
  CHANNEL.postMessage({
    type: 'workerify:handle',
    id,
    consumerId,
    request: {
      url: req.url,
      method: req.method,
      headers,
      body,
    },
  });

  const resp: any = await p;

  const h = new Headers(resp.headers || {});
  const init: ResponseInit = {
    status: resp.status || 200,
    statusText: resp.statusText || '',
    headers: h,
  };

  if (resp.body && resp.bodyType === 'arrayBuffer') {
    return new Response(resp.body, init);
  }

  if (resp.body && resp.bodyType === 'json') {
    h.set('content-type', h.get('content-type') || 'application/json');
    return new Response(JSON.stringify(resp.body), init);
  }

  return new Response(resp.body ?? '', init);
}

// === End Workerify SW ===
