import type {
  BroadcastMessage,
  HookHandler,
  HookName,
  HttpMethod,
  OnErrorHook,
  OnReadyHook,
  OnRequestHook,
  OnResponseHook,
  OnRouteHook,
  PreHandlerHook,
  Route,
  RouteHandler,
  WorkerifyOptions,
  WorkerifyPlugin,
  WorkerifyReply,
  WorkerifyRequest,
} from './types.js';

export class Workerify {
  private routes: Route[] = [];
  private channel: BroadcastChannel;
  private options: WorkerifyOptions;
  private consumerId: string;
  private clientId: string | null = null;
  private hooks: Map<HookName, HookHandler[]> = new Map();

  constructor(options: WorkerifyOptions = {}) {
    this.options = { logger: false, ...options };
    this.channel = new BroadcastChannel('workerify');
    // Generate unique consumer ID
    this.consumerId = `consumer-${Math.random().toString(36).substring(2)}-${Date.now()}`;

    this.channel.onmessage = this.handleMessage.bind(this);

    if (this.options.logger) {
      console.log(
        '[Workerify] Instance created with consumerId:',
        this.consumerId,
      );
    }
  }

  private handleMessage(event: MessageEvent<BroadcastMessage>) {
    const message = event.data;

    // Only handle messages targeted at this consumer
    if (
      message.type === 'workerify:handle' &&
      message.id &&
      message.request &&
      message.consumerId === this.consumerId
    ) {
      this.handleRequest(message.id, message.request);
    }
  }

  private async handleRequest(id: string, request: WorkerifyRequest) {
    const reply: WorkerifyReply = {
      status: 200,
      statusText: 'OK',
      headers: {},
      bodyType: 'json',
    };

    try {
      // Execute onRequest hooks
      await this.executeOnRequestHooks(request, reply);

      // Check if hook responded early (e.g., authentication failure)
      if (reply.body !== undefined) {
        // Execute onResponse hooks even for early responses
        await this.executeOnResponseHooks(request, reply);
        this.sendResponse(id, reply);

        if (this.options.logger) {
          console.log(
            `[Workerify] ${request.method} ${request.url} - ${reply.status} (early response from onRequest)`,
          );
        }
        return;
      }

      const { route, params } = this.findRoute(request.method, request.url);

      if (!route) {
        this.sendResponse(id, {
          status: 404,
          statusText: 'Not Found',
          body: { error: 'Route not found' },
          bodyType: 'json',
        });
        return;
      }

      // Add params to request
      request.params = params || {};

      // Parse query parameters
      const urlObj = new URL(request.url);
      const query: Record<string, string> = {};
      for (const [key, value] of urlObj.searchParams.entries()) {
        query[key] = value;
      }
      request.query = query;

      // Parse form-encoded data for POST requests
      if (
        request.method === 'POST' &&
        request.headers['content-type']?.includes(
          'application/x-www-form-urlencoded',
        ) &&
        request.body &&
        (request.body instanceof ArrayBuffer ||
          ArrayBuffer.isView(request.body) ||
          request.body.constructor?.name === 'ArrayBuffer')
      ) {
        try {
          const decoder = new TextDecoder();
          const text = decoder.decode(request.body as ArrayBuffer);
          const params = new URLSearchParams(text);
          const formData: Record<string, string> = {};

          for (const [key, value] of params.entries()) {
            formData[key] = value;
          }

          // Replace the ArrayBuffer body with parsed form data
          request.body = formData;
        } catch (error) {
          if (this.options.logger) {
            console.error('[Workerify] Error parsing form data:', error);
          }
        }
      }

      // Execute preHandler hooks
      await this.executePreHandlerHooks(request, reply);

      // Check if hook responded early (e.g., rate limiting, validation)
      if (reply.body !== undefined) {
        // Execute onResponse hooks even for early responses
        await this.executeOnResponseHooks(request, reply);
        this.sendResponse(id, reply);

        if (this.options.logger) {
          console.log(
            `[Workerify] ${request.method} ${request.url} - ${reply.status} (early response from preHandler)`,
          );
        }
        return;
      }

      const result = await route.handler(request, reply);

      // If handler returns a value, use it as the body
      //
      if (result !== undefined) {
        reply.body = result;
        if (typeof result === 'string') {
          reply.bodyType = 'text';
          reply.headers = {
            'Content-Type': 'text/html',
            ...reply.headers,
          };
        } else if (result instanceof ArrayBuffer) {
          reply.bodyType = 'arrayBuffer';
        } else {
          reply.bodyType = 'json';
          reply.headers = {
            'Content-Type': 'application/json',
            ...reply.headers,
          };
        }
      }

      // Execute onResponse hooks
      await this.executeOnResponseHooks(request, reply);

      this.sendResponse(id, reply);

      if (this.options.logger) {
        console.log(
          `[Workerify] ${request.method} ${request.url} - ${reply.status}`,
        );
      }
    } catch (error) {
      if (this.options.logger) {
        console.error('[Workerify] Error handling request:', error);
      }

      // Execute onError hooks
      await this.executeOnErrorHooks(
        error instanceof Error ? error : new Error(String(error)),
        request,
        reply,
      );

      this.sendResponse(id, {
        status: 500,
        statusText: 'Internal Server Error',
        body: { error: 'Internal server error' },
        bodyType: 'json',
      });
    }
  }

  private sendResponse(id: string, reply: WorkerifyReply) {
    const message: BroadcastMessage = {
      type: 'workerify:response',
      id,
      status: reply.status,
      statusText: reply.statusText,
      headers: reply.headers,
      body: reply.body,
      bodyType: reply.bodyType,
    };

    this.channel.postMessage(message);
  }

  private matchRoute(
    routePath: string,
    pathname: string,
  ): { match: boolean; params?: Record<string, string> } {
    // Check if route has parameters
    if (!routePath.includes(':')) {
      return { match: routePath === pathname };
    }

    // Convert route pattern to regex
    const routeParts = routePath.split('/');
    const pathParts = pathname.split('/');

    // If different number of segments, no match
    if (routeParts.length !== pathParts.length) {
      return { match: false };
    }

    const params: Record<string, string> = {};

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (routePart?.startsWith(':')) {
        // This is a parameter
        const paramName = routePart.slice(1);
        if (paramName && pathPart) {
          // Decode parameter value to handle Unicode characters
          params[paramName] = decodeURIComponent(pathPart);
        }
      } else if (routePart !== pathPart) {
        // Static part doesn't match
        return { match: false };
      }
    }

    return { match: true, params };
  }

  private findRoute(
    method: HttpMethod,
    url: string,
  ): { route: Route | null; params?: Record<string, string> } {
    const urlObj = new URL(url);
    // Decode URI components to handle Unicode characters properly
    const pathname = decodeURIComponent(urlObj.pathname);

    for (const route of this.routes) {
      // Check method match
      if (route.method && route.method !== method) {
        continue;
      }

      // Check path match
      const matchType = route.match || 'exact';
      if (matchType === 'prefix') {
        if (pathname.startsWith(route.path)) {
          return { route, params: {} };
        }
      } else {
        // Try exact match with parameters
        const { match, params } = this.matchRoute(route.path, pathname);
        if (match) {
          return { route, params };
        }
      }
    }

    return { route: null };
  }

  private async addRoute(
    method: HttpMethod | undefined,
    path: string,
    handler: RouteHandler,
    match: 'exact' | 'prefix' = 'exact',
  ) {
    const route: Route = { method, path, handler, match };
    this.routes.push(route);
    // Removed automatic service worker update - will be done in listen()

    if (this.options.logger) {
      console.log(`[Workerify] Route registered: ${method || 'ALL'} ${path}`);
    }

    // Execute onRoute hooks
    await this.executeOnRouteHooks(route);
  }

  private updateServiceWorkerRoutes() {
    const routesForSW = this.routes.map((route) => ({
      method: route.method,
      path: route.path,
      match: route.match,
    }));

    const message: BroadcastMessage = {
      type: 'workerify:routes:update',
      consumerId: this.consumerId,
      routes: routesForSW,
    };
    this.channel.postMessage(message);
  }

  // Helper to detect and process wildcard patterns
  private processPath(path: string): {
    path: string;
    match: 'exact' | 'prefix';
  } {
    if (path.endsWith('/*')) {
      // Remove /* and use prefix matching
      return {
        path: path.slice(0, -1), // Remove the * but keep the /
        match: 'prefix',
      };
    }
    return { path, match: 'exact' };
  }

  // HTTP method handlers
  get(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    // Note: addRoute is async but we don't await here to maintain synchronous API
    // Hooks will be executed but won't block route registration
    void this.addRoute('GET', processedPath, handler, match);
    return this;
  }

  post(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    void this.addRoute('POST', processedPath, handler, match);
    return this;
  }

  put(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    void this.addRoute('PUT', processedPath, handler, match);
    return this;
  }

  delete(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    void this.addRoute('DELETE', processedPath, handler, match);
    return this;
  }

  patch(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    void this.addRoute('PATCH', processedPath, handler, match);
    return this;
  }

  head(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    void this.addRoute('HEAD', processedPath, handler, match);
    return this;
  }

  option(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    void this.addRoute('OPTIONS', processedPath, handler, match);
    return this;
  }

  // Route for all methods
  all(path: string, handler: RouteHandler) {
    const { path: processedPath, match } = this.processPath(path);
    void this.addRoute(undefined, processedPath, handler, match);
    return this;
  }

  // Generic route method with full configuration options
  route(config: {
    method?: HttpMethod;
    path: string;
    handler: RouteHandler;
    match?: 'exact' | 'prefix';
  }) {
    void this.addRoute(
      config.method,
      config.path,
      config.handler,
      config.match || 'exact',
    );
    return this;
  }

  async listen() {
    if (this.options.logger) {
      console.log(
        '[Workerify] Server listening with',
        this.routes.length,
        'routes',
      );
    }

    // Execute onReady hooks
    await this.executeOnReadyHooks();

    const readiness = await new Promise<boolean>((resolve) => {
      // Set up listener for acknowledgment
      const handleRoutesAck = (event: MessageEvent<BroadcastMessage>) => {
        const message = event.data;
        if (message.type === 'workerify:sw:check-readiness:response') {
          this.channel.removeEventListener('message', handleRoutesAck);
          if (this.options.logger) {
            console.log('[Workerify] Routes registered successfully');
          }
          resolve(typeof message.body === 'boolean' ? message.body : false);
        }
      };
      this.channel.postMessage({
        type: 'workerify:sw:check-readiness',
      });

      this.channel.addEventListener('message', handleRoutesAck);

      // Timeout after 1 seconds
      setTimeout(() => {
        this.channel.removeEventListener('message', handleRoutesAck);
        if (this.options.logger) {
          console.warn(
            '[Workerify] Routes registration timeout - continuing anyway',
          );
        }
        resolve(false);
      }, 1000);
    });

    if (this.options.logger) {
      console.log('[Workerify] Readiness', readiness);
    }

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 50);
    });

    // Register this consumer with the service worker
    try {
      const response = await fetch('/__workerify/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ consumerId: this.consumerId }),
      });

      if (!response.ok) {
        throw new Error(`Registration failed: ${response.status}`);
      }

      const result = await response.json();
      this.clientId = result.clientId;

      if (this.options.logger) {
        console.log(
          '[Workerify] Registered with service worker, clientId:',
          this.clientId,
        );
      }

      // Now update routes and wait for acknowledgment
      return new Promise<void>((resolve) => {
        // Set up listener for acknowledgment
        const handleRoutesAck = (event: MessageEvent<BroadcastMessage>) => {
          const message = event.data;
          if (
            message.type === 'workerify:routes:update:response' &&
            message.consumerId === this.consumerId
          ) {
            this.channel.removeEventListener('message', handleRoutesAck);
            if (this.options.logger) {
              console.log('[Workerify] Routes registered successfully');
            }
            resolve();
          }
        };

        this.channel.addEventListener('message', handleRoutesAck);

        // Send routes update
        this.updateServiceWorkerRoutes();

        // Timeout after 1 seconds
        setTimeout(() => {
          this.channel.removeEventListener('message', handleRoutesAck);
          if (this.options.logger) {
            console.warn(
              '[Workerify] Routes registration timeout - continuing anyway',
            );
          }
          resolve();
        }, 1000);
      });
    } catch (error) {
      if (this.options.logger) {
        console.error(
          '[Workerify] Failed to register with service worker:',
          error,
        );
      }
      throw error;
    }
  }

  // Manual method to update routes if needed
  updateRoutes() {
    this.updateServiceWorkerRoutes();
    if (this.options.logger) {
      console.log('[Workerify] Routes manually updated');
    }
  }

  async register(
    plugin: WorkerifyPlugin,
    options?: Record<string, unknown>,
  ): Promise<this> {
    await plugin(this, options);
    if (this.options.logger) {
      console.log('[Workerify] Plugin registered');
    }
    return this;
  }

  close() {
    this.channel.close();
    if (this.options.logger) {
      console.log('[Workerify] Server closed');
    }
  }

  // Hook system methods
  addHook(name: 'onRequest', handler: OnRequestHook): this;
  addHook(name: 'preHandler', handler: PreHandlerHook): this;
  addHook(name: 'onResponse', handler: OnResponseHook): this;
  addHook(name: 'onError', handler: OnErrorHook): this;
  addHook(name: 'onRoute', handler: OnRouteHook): this;
  addHook(name: 'onReady', handler: OnReadyHook): this;
  addHook(name: HookName, handler: HookHandler): this {
    const handlers = this.hooks.get(name) || [];
    handlers.push(handler);
    this.hooks.set(name, handlers);

    if (this.options.logger) {
      console.log(`[Workerify] Hook registered: ${name}`);
    }

    return this;
  }

  private async executeOnRequestHooks(
    request: WorkerifyRequest,
    reply: WorkerifyReply,
  ): Promise<void> {
    const hooks = this.hooks.get('onRequest') as OnRequestHook[] | undefined;
    if (!hooks) return;

    for (const hook of hooks) {
      await hook(request, reply);
    }
  }

  private async executePreHandlerHooks(
    request: WorkerifyRequest,
    reply: WorkerifyReply,
  ): Promise<void> {
    const hooks = this.hooks.get('preHandler') as PreHandlerHook[] | undefined;
    if (!hooks) return;

    for (const hook of hooks) {
      await hook(request, reply);
    }
  }

  private async executeOnResponseHooks(
    request: WorkerifyRequest,
    reply: WorkerifyReply,
  ): Promise<void> {
    const hooks = this.hooks.get('onResponse') as OnResponseHook[] | undefined;
    if (!hooks) return;

    for (const hook of hooks) {
      await hook(request, reply);
    }
  }

  private async executeOnErrorHooks(
    error: Error,
    request: WorkerifyRequest,
    reply: WorkerifyReply,
  ): Promise<void> {
    const hooks = this.hooks.get('onError') as OnErrorHook[] | undefined;
    if (!hooks) return;

    for (const hook of hooks) {
      try {
        await hook(error, request, reply);
      } catch (hookError) {
        if (this.options.logger) {
          console.error('[Workerify] Error in onError hook:', hookError);
        }
      }
    }
  }

  private async executeOnRouteHooks(route: Route): Promise<void> {
    const hooks = this.hooks.get('onRoute') as OnRouteHook[] | undefined;
    if (!hooks) return;

    for (const hook of hooks) {
      await hook(route);
    }
  }

  private async executeOnReadyHooks(): Promise<void> {
    const hooks = this.hooks.get('onReady') as OnReadyHook[] | undefined;
    if (!hooks) return;

    for (const hook of hooks) {
      await hook();
    }
  }
}

// Default export factory function to match README usage
export default function createWorkerify(opts?: WorkerifyOptions): Workerify {
  return new Workerify(opts);
}

// Named exports
export type {
  HookHandler,
  HookName,
  OnErrorHook,
  OnReadyHook,
  OnRequestHook,
  OnResponseHook,
  OnRouteHook,
  PreHandlerHook,
  RouteHandler,
  WorkerifyOptions,
  WorkerifyPlugin,
  WorkerifyReply,
  WorkerifyRequest,
} from './types.js';
