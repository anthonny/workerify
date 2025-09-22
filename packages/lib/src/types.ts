export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface WorkerifyRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: ArrayBuffer | null;
  params: Record<string, string>;
}

export interface WorkerifyReply {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  bodyType?: 'json' | 'text' | 'arrayBuffer';
}

export type RouteHandler = (
  request: WorkerifyRequest,
  reply: WorkerifyReply
) => Promise<any> | any;

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
  body?: any;
  bodyType?: 'json' | 'text' | 'arrayBuffer';
}

export type WorkerifyPlugin = (
  instance: any,
  options?: any
) => Promise<void> | void;

