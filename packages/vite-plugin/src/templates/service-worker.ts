// === Workerify SW ===
import { init } from './workerify-sw-copilot';

console.log('[Workerify SW] Service worker script loaded');
const { onClientsClaim, onFetch } = init(self);

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
      onClientsClaim();
    }),
  );
});

// Test if fetch listener is working at all
console.log('[Workerify SW] Adding fetch event listener...');
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    (async () => {
      const response = await onFetch(event);
      if (response) {
        return response;
      }
      // @ts-expect-error
      return fetch(event);
    })(),
  );
});
