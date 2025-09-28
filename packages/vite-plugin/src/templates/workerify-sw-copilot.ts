import { loadState, type Route, saveState } from './database';

type WorkerifyBody = ArrayBuffer | string | null | object;
type BodyType = 'json' | 'text' | 'arrayBuffer';

// HTTP response types
interface ResponseData {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: WorkerifyBody;
  bodyType?: BodyType;
}

interface WorkerifyResponse extends ResponseData {
  type: string;
  id?: string;
}

export function init(self: ServiceWorkerGlobalScope) {
  console.log('[Workerify SW] Init Workerify SW Copilot');
  console.log('[Workerify SW] Current location:', self.location.href);
  console.log('[Workerify SW] Scope:', self.registration?.scope);

  const workerifyBC = new BroadcastChannel('workerify');

  const pending = new Map<
    string,
    { resolve: (value: WorkerifyResponse) => void }
  >();
  let consumerRoutesMap = new Map<string, Route[]>();
  let clientConsumerMap = new Map<string, string>();
  loadState().then((state) => {
    consumerRoutesMap = state.consumerRoutesMap;
    clientConsumerMap = state.clientConsumerMap;
  });

  async function cleanupClosedClients() {
    try {
      const allClients = await self.clients.matchAll({
        includeUncontrolled: true,
      });
      const activeClientIds = new Set(
        allClients.map((c: { id: string }) => c.id),
      );

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

      // Save state after cleanup
      if (toRemove.length > 0) {
        await saveState({
          consumerRoutesMap,
          clientConsumerMap,
        });
      }
    } catch (error) {
      console.error('[Workerify SW] Cleanup error:', error);
    }
  }

  setInterval(() => {
    cleanupClosedClients();
  }, 30000); // Every 30 seconds

  const onClientsClaim = () => {
    console.log('[Workerify SW] Now controlling all clients');
    console.log(
      '[Workerify SW] Notify SW is ready',
      self.registration?.active?.state,
    );
    // Send acknowledgment
    workerifyBC.postMessage({
      type: 'workerify:sw:check-readiness:response',
      body: self.registration?.active?.state === 'activated',
    });
    // Clean up mappings for closed clients
    cleanupClosedClients();
  };

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
            if (routePart?.startsWith(':')) continue;

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

  async function handleRegistration(event: FetchEvent): Promise<Response> {
    try {
      const data = await event.request.json();
      const { consumerId } = data;
      const clientId =
        event.clientId ||
        (event as FetchEvent & { resultingClientId?: string })
          .resultingClientId;

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

      // Save state to IndexedDB
      await saveState({
        consumerRoutesMap,
        clientConsumerMap,
      });

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

  async function handleFetch(
    event: FetchEvent,
    consumerId: string,
  ): Promise<Response> {
    const req = event.request;
    const id = Math.random().toString(36).slice(2);
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const body =
      req.method === 'GET' || req.method === 'HEAD'
        ? null
        : await req.arrayBuffer();

    const p = new Promise((resolve) => pending.set(id, { resolve }));
    workerifyBC.postMessage({
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

    const resp = (await p) as WorkerifyResponse;

    const h = new Headers(resp.headers || {});
    const init: ResponseInit = {
      status: resp.status || 200,
      statusText: resp.statusText || '',
      headers: h,
    };

    if (resp.body && resp.bodyType === 'arrayBuffer') {
      return new Response(resp.body as ArrayBuffer, init);
    }

    if (resp.body && resp.bodyType === 'json') {
      h.set('content-type', h.get('content-type') || 'application/json');
      return new Response(JSON.stringify(resp.body), init);
    }

    return new Response(
      typeof resp.body === 'string'
        ? resp.body
        : resp.body
          ? JSON.stringify(resp.body)
          : '',
      init,
    );
  }

  const onFetch = async (event: FetchEvent): Promise<Response> => {
    const { request } = event;
    const url = new URL(request.url);

    // We reload the database here because in some cases (like FF which kill the SW quickly for inactive)
    // this the first call when the SW wakeup without runtime all the lifecycle, so everything is empty
    if (Array.from(clientConsumerMap.entries()).length === 0) {
      const newState = await loadState();
      consumerRoutesMap = newState.consumerRoutesMap;
      clientConsumerMap = newState.clientConsumerMap;
    }

    // Handle registration endpoint
    if (url.pathname === '/__workerify/register' && request.method === 'POST') {
      console.log('[Workerify SW] Register new consumer');
      return handleRegistration(event);
    }

    // Get the consumer ID for this client
    const clientId =
      event.clientId ||
      (event as FetchEvent & { resultingClientId?: string }).resultingClientId;
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

    return handleFetch(event, consumerId);
  };

  workerifyBC.onmessage = (ev: MessageEvent) => {
    const msg = ev.data;
    if (msg?.type === 'workerify:sw:check-readiness') {
      console.log('[Workerify SW] Check readiness:');

      if (self.registration?.active?.state === 'activated') {
        // Send acknowledgment
        workerifyBC.postMessage({
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

      // Save state to IndexedDB
      saveState({
        consumerRoutesMap,
        clientConsumerMap,
      });

      // Send acknowledgment
      workerifyBC.postMessage({
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
      // Save cleared state to IndexedDB
      saveState({
        clientConsumerMap,
        consumerRoutesMap,
      });
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
        .catch((error: unknown) => {
          console.error('[Workerify SW] Error listing clients:', error);
        });
    }
  };

  workerifyBC.addEventListener('message', (ev: MessageEvent) => {
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

  return {
    onClientsClaim,
    onFetch,
  };
}
