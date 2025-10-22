export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'HEAD'
  | 'OPTIONS';

// Shared body type for consistent typing across packages
export type WorkerifyBody = ArrayBuffer | string | null | object;
export type BodyType = 'json' | 'text' | 'arrayBuffer';

export interface WorkerifyRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: WorkerifyBody;
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface WorkerifyReply {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: WorkerifyBody;
  bodyType?: BodyType;
}

export type RouteHandler = (
  request: WorkerifyRequest,
  reply: WorkerifyReply,
) => Promise<WorkerifyBody | undefined> | WorkerifyBody | undefined;

export interface Route {
  method?: HttpMethod;
  path: string;
  handler: RouteHandler;
  match?: 'exact' | 'prefix';
}

export interface WorkerifyOptions {
  logger?: boolean;
  scope?: string;
}

export interface BroadcastMessage {
  type: string;
  id?: string;
  consumerId?: string;
  clientId?: string;
  routes?: Array<{
    method?: HttpMethod;
    path: string;
    match?: 'exact' | 'prefix';
  }>;
  request?: WorkerifyRequest;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: WorkerifyBody;
  bodyType?: BodyType;
}

export type WorkerifyPlugin = (
  instance: object,
  options?: Record<string, unknown>,
) => Promise<void> | void;

// Hook system types
export type HookName =
  | 'onRequest'
  | 'preHandler'
  | 'onResponse'
  | 'onError'
  | 'onRoute'
  | 'onReady';

export type OnRequestHook = (
  request: WorkerifyRequest,
  reply: WorkerifyReply,
) => Promise<void> | void;

export type PreHandlerHook = (
  request: WorkerifyRequest,
  reply: WorkerifyReply,
) => Promise<void> | void;

export type OnResponseHook = (
  request: WorkerifyRequest,
  reply: WorkerifyReply,
) => Promise<void> | void;

export type OnErrorHook = (
  error: Error,
  request: WorkerifyRequest,
  reply: WorkerifyReply,
) => Promise<void> | void;

export type OnRouteHook = (routeOptions: Route) => Promise<void> | void;

export type OnReadyHook = () => Promise<void> | void;

export type HookHandler =
  | OnRequestHook
  | PreHandlerHook
  | OnResponseHook
  | OnErrorHook
  | OnRouteHook
  | OnReadyHook;
