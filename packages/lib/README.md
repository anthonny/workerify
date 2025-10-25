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

## Scope Prefix

You can set a global `scope` prefix that will be applied to all routes. This is useful for versioning your API or organizing routes under a common path.

```typescript
import { Workerify } from '@workerify/lib';

// All routes will be prefixed with /api/v1
const app = new Workerify({ scope: '/api/v1' });

app.get('/users', async () => {
  // Accessible at: /api/v1/users
  return { users: [] };
});

app.get('/posts/:id', async (request) => {
  // Accessible at: /api/v1/posts/:id
  return { postId: request.params.id };
});

await app.listen();
```

### Scope Normalization

The scope prefix is automatically normalized:
- Leading slash is added if missing: `api` → `/api`
- Trailing slash is removed: `/api/` → `/api`
- Root scope is treated as no prefix: `/` → ``

```typescript
// These all produce the same result: /api/users
new Workerify({ scope: 'api' })     // → /api/users
new Workerify({ scope: '/api' })    // → /api/users
new Workerify({ scope: '/api/' })   // → /api/users
```

## Plugin System

Workerify supports a powerful plugin system inspired by Fastify, allowing you to encapsulate routes, hooks, and logic into reusable modules.

### Basic Plugin

```typescript
import { Workerify, WorkerifyPlugin } from '@workerify/lib';

// Define a plugin
const usersPlugin: WorkerifyPlugin = (app, options) => {
  app.get('/list', async () => {
    return { users: ['Alice', 'Bob', 'Charlie'] };
  });

  app.get('/:id', async (request) => {
    return { userId: request.params.id };
  });

  app.post('/', async (request) => {
    return { created: true, data: request.body };
  });
};

const app = new Workerify();

// Register the plugin
await app.register(usersPlugin);

await app.listen();
```

### Plugin with Path Prefix

You can provide a `path` option when registering a plugin to prefix all routes within that plugin:

```typescript
const usersPlugin: WorkerifyPlugin = (app) => {
  app.get('/list', async () => ({ users: [] }));     // → /users/list
  app.get('/:id', async (request) => ({ id: request.params.id }));  // → /users/:id
};

const postsPlugin: WorkerifyPlugin = (app) => {
  app.get('/list', async () => ({ posts: [] }));     // → /posts/list
  app.get('/:id', async (request) => ({ id: request.params.id }));  // → /posts/:id
};

const app = new Workerify();

await app.register(usersPlugin, { path: '/users' });
await app.register(postsPlugin, { path: '/posts' });

await app.listen();
```

### Combining Scope and Plugin Path

The scope prefix and plugin path are combined in order: `scope` + `plugin path` + `route path`

```typescript
const app = new Workerify({ scope: '/api/v1' });

const usersPlugin: WorkerifyPlugin = (app) => {
  app.get('/list', async () => ({ users: [] }));
  // Accessible at: /api/v1/users/list
};

await app.register(usersPlugin, { path: '/users' });
await app.listen();
```

### Nested Plugins

Plugins can register other plugins, creating nested path hierarchies:

```typescript
const adminPlugin: WorkerifyPlugin = (app) => {
  app.get('/dashboard', async () => ({ dashboard: 'Admin Dashboard' }));
  // → /api/v1/users/admin/dashboard
};

const usersPlugin: WorkerifyPlugin = async (app) => {
  app.get('/list', async () => ({ users: [] }));
  // → /api/v1/users/list

  // Register nested plugin
  await app.register(adminPlugin, { path: '/admin' });
};

const app = new Workerify({ scope: '/api/v1' });
await app.register(usersPlugin, { path: '/users' });
await app.listen();
```

### Plugin with Options

Plugins can accept custom options for configuration:

```typescript
interface AuthPluginOptions {
  secret: string;
  tokenExpiry?: number;
}

const authPlugin: WorkerifyPlugin = (app, options: AuthPluginOptions) => {
  const { secret, tokenExpiry = 3600 } = options;

  app.post('/login', async (request) => {
    // Use secret and tokenExpiry
    return { token: 'generated-token', expiresIn: tokenExpiry };
  });

  app.post('/logout', async (request) => {
    return { success: true };
  });
};

const app = new Workerify();
await app.register(authPlugin, {
  path: '/auth',
  secret: 'my-secret-key',
  tokenExpiry: 7200,
});
await app.listen();
```

### Real-World Plugin Example: API Versioning

```typescript
const v1Plugin: WorkerifyPlugin = (app) => {
  app.get('/users', async () => ({ version: 'v1', users: [] }));
  app.get('/posts', async () => ({ version: 'v1', posts: [] }));
};

const v2Plugin: WorkerifyPlugin = (app) => {
  app.get('/users', async () => ({ version: 'v2', users: [], metadata: {} }));
  app.get('/posts', async () => ({ version: 'v2', posts: [], metadata: {} }));
};

const app = new Workerify({ scope: '/api' });

await app.register(v1Plugin, { path: '/v1' });
await app.register(v2Plugin, { path: '/v2' });

await app.listen();

// Routes created:
// - /api/v1/users
// - /api/v1/posts
// - /api/v2/users
// - /api/v2/posts
```

### Real-World Plugin Example: Microservices Pattern

```typescript
const authService: WorkerifyPlugin = (app) => {
  app.post('/login', async (request) => ({ token: 'jwt-token' }));
  app.post('/logout', async () => ({ success: true }));
  app.post('/refresh', async (request) => ({ token: 'new-token' }));
};

const userService: WorkerifyPlugin = (app) => {
  app.get('/', async () => ({ users: [] }));
  app.get('/:id', async (request) => ({ id: request.params.id }));
  app.post('/', async (request) => ({ created: true }));
};

const productService: WorkerifyPlugin = (app) => {
  app.get('/', async () => ({ products: [] }));
  app.post('/', async (request) => ({ created: true }));
};

const app = new Workerify({ scope: '/api' });

await app.register(authService, { path: '/auth' });
await app.register(userService, { path: '/users' });
await app.register(productService, { path: '/products' });

await app.listen();

// Routes created:
// - /api/auth/login
// - /api/auth/logout
// - /api/auth/refresh
// - /api/users/
// - /api/users/:id
// - /api/products/
```

### Plugin Features

- **Path Prefix Isolation**: Each plugin's routes are isolated with their own path prefix
- **Nested Plugins**: Plugins can register sub-plugins, creating hierarchical path structures
- **Custom Options**: Pass configuration data to plugins
- **Async Support**: Plugins can be async functions
- **Method Chaining**: `register()` returns the Workerify instance for chaining
- **Error Handling**: Plugin prefix cleanup happens even if plugin throws an error

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