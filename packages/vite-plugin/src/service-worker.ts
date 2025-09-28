export type { Route } from './templates/database';
export { init } from './templates/workerify-sw-copilot';

// Re-export commonly used types for service worker development
export interface ServiceWorkerGlobalScope extends EventTarget {
  registration: ServiceWorkerRegistration;
  clients: Clients;
  skipWaiting(): Promise<void>;
}

export interface FetchEvent extends ExtendableEvent {
  request: Request;
  clientId: string;
  resultingClientId?: string;
  respondWith(response: Promise<Response> | Response): void;
}

export interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<void>): void;
}
