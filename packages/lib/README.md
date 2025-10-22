# @workerify/lib

Core library for Workerify - A Fastify-like router for Service Workers.

## Installation

```bash
# Using pnpm
pnpm add @workerify/lib

# Using npm
npm install @workerify/lib

# Using yarn
yarn add @workerify/lib
```

## Quick Start

```typescript
import { Workerify } from '@workerify/lib';

const app = new Workerify({ logger: true });

// Simple GET route
app.get('/api/hello', async (request, reply) => {
  return { message: 'Hello from Service Worker!' };
});

// Route with parameters
app.get('/api/users/:id', async (request, reply) => {
  const userId = request.params.id;
  return { userId, name: `User ${userId}` };
});

// POST route with body handling
app.post('/api/users', async (request, reply) => {
  const data = request.body;
  reply.status = 201;
  return { id: Date.now(), ...data };
});

// Wildcard routes for prefix matching
app.get('/api/*', async (request, reply) => {
  return { message: 'Catch-all API route', path: request.url };
});

// Start listening for requests
await app.listen();
```

## Hooks System

Workerify implements a comprehensive lifecycle hooks system similar to Fastify, allowing you to intercept and modify the request/response lifecycle at various points.

### Available Hooks

#### Request/Response Lifecycle Hooks

- **`onRequest`** - Called before route matching, allows modifying the request before processing
- **`preHandler`** - Called after route matching but before the route handler executes
- **`onResponse`** - Called after the route handler executes, before sending the response
- **`onError`** - Called when an error occurs during request handling

#### Application Lifecycle Hooks

- **`onRoute`** - Called when a route is registered
- **`onReady`** - Called when `listen()` is invoked

### Basic Hook Usage

```typescript
import { Workerify } from '@workerify/lib';

const app = new Workerify({ logger: true });

// Add request timing
app.addHook('onRequest', async (request, reply) => {
  request.headers['x-request-start'] = Date.now().toString();
});

// Add response time header
app.addHook('onResponse', async (request, reply) => {
  const startTime = Number.parseInt(request.headers['x-request-start'] || '0');
  const duration = Date.now() - startTime;
  reply.headers = {
    ...reply.headers,
    'x-response-time': `${duration}ms`,
  };
});

// Log all registered routes
app.addHook('onRoute', async (route) => {
  console.log('Route registered:', route.method, route.path);
});

// Initialize on startup
app.addHook('onReady', async () => {
  console.log('Server is ready!');
});

app.get('/api/users/:id', async (request) => {
  return { id: request.params.id };
});

await app.listen();
```

### Early Response from Hooks

Hooks can send an early response and skip the route handler by setting the `reply.body` property. This is useful for authentication, rate limiting, caching, and other cross-cutting concerns.

```typescript
// Authentication hook
app.addHook('onRequest', async (request, reply) => {
  const authHeader = request.headers['authorization'];
  if (!authHeader) {
    reply.status = 401;
    reply.statusText = 'Unauthorized';
    reply.body = { error: 'Missing authorization header' };
    reply.bodyType = 'json';
    reply.headers = { 'Content-Type': 'application/json' };
    // Route handler will NOT be called
  }
});

// Rate limiting hook
app.addHook('preHandler', async (request, reply) => {
  const userId = request.params.id;
  if (await isRateLimited(userId)) {
    reply.status = 429;
    reply.statusText = 'Too Many Requests';
    reply.body = { error: 'Rate limit exceeded' };
    reply.bodyType = 'json';
    reply.headers = {
      'Content-Type': 'application/json',
      'Retry-After': '60',
    };
    // Route handler will NOT be called
  }
});

// Caching hook
app.addHook('preHandler', async (request, reply) => {
  const cached = await cache.get(request.url);
  if (cached) {
    reply.body = cached;
    reply.headers = { 'X-Cache': 'HIT' };
    // Route handler will NOT be called, cached response sent
  }
});
```

When a hook sets `reply.body`:
- The route handler is **skipped**
- `onResponse` hooks are **still executed** (allowing for logging, metrics, etc.)
- The response is sent to the client immediately after `onResponse` hooks

### Hook Execution Order

For each request, hooks execute in this order:

1. **`onRequest`** (before route matching)
2. **`preHandler`** (after route match, before handler)
3. Route handler executes (unless skipped by early response)
4. **`onResponse`** (after handler, before sending)
5. **`onError`** (only if an error occurred at any point)

### Hook Features

- **Async Support**: All hooks support both sync and async functions
- **Multiple Hooks**: You can register multiple hooks of the same type, they execute in order
- **Request/Reply Modification**: Hooks can modify request and reply objects
- **Method Chaining**: `addHook()` returns the Workerify instance for chaining

### TypeScript Support

All hook types are fully typed:

```typescript
import type {
  OnRequestHook,
  PreHandlerHook,
  OnResponseHook,
  OnErrorHook,
  OnRouteHook,
  OnReadyHook,
} from '@workerify/lib';

const requestLogger: OnRequestHook = async (request, reply) => {
  console.log(`${request.method} ${request.url}`);
};

app.addHook('onRequest', requestLogger);
```

### Error Handling Hook

```typescript
app.addHook('onError', async (error, request, reply) => {
  console.error('Request error:', {
    url: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack,
  });

  // Optionally modify the error response
  reply.status = 500;
  reply.body = {
    error: 'Internal Server Error',
    requestId: request.headers['x-request-id'],
  };
});
```

### Real-World Examples

#### CORS Hook

```typescript
app.addHook('onResponse', async (request, reply) => {
  reply.headers = {
    ...reply.headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
});
```

#### Request ID Hook

```typescript
app.addHook('onRequest', async (request, reply) => {
  const requestId = request.headers['x-request-id'] || crypto.randomUUID();
  request.headers['x-request-id'] = requestId;
  reply.headers = { 'x-request-id': requestId };
});
```

#### Logging Hook

```typescript
app.addHook('onResponse', async (request, reply) => {
  console.log({
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    status: reply.status,
    duration: reply.headers?.['x-response-time'],
  });
});
```

## Documentation

For complete API reference, TypeScript types, examples, and integration guides, see the [main README](https://github.com/anthonny/workerify#readme).

## License

MIT