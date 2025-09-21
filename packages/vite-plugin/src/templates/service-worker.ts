// === Workerify SW ===
console.log('[Workerify SW] Service worker script loaded');
console.log('[Workerify SW] Current location:', self.location.href);
console.log('[Workerify SW] Scope:', self.registration?.scope);

const CHANNEL = new BroadcastChannel('workerify');
let routes: Array<{ method?: string; path: string; match?: string }> = [];

CHANNEL.onmessage = (ev) => {
  const msg = ev.data;
  if (msg?.type === 'workerify:routes:update') {
    console.log('[Workerify SW] Updating routes:', msg.routes);
    routes = msg.routes || [];
  }

  if (msg?.type === 'workerify:routes:list') {
    console.table(routes.map((r) => [r.method, r.path, r.match]));
  }

  if (msg?.type === 'workerify:routes:clear') {
    routes = [];
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
    }),
  );
});

function matchRoute(url: string, method: string) {
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
  const { request } = event;
  const requestUrl = new URL(request.url).href;
  const hit = matchRoute(request.url, request.method);

  if (!hit) {
    return;
  }

  event.respondWith(handle(event));
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

async function handle(event: FetchEvent): Promise<Response> {
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
