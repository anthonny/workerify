# Workerify

[![npm lib version](https://img.shields.io/npm/v/@workerify/lib.svg)](https://www.npmjs.com/package/@workerify/lib)
[![npm vite-plugin version](https://img.shields.io/npm/v/@workerify/lib.svg)](https://www.npmjs.com/package/@workerify/vite-plugin)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-blue)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/maintained%20with-pnpm-cc00ff.svg)](https://pnpm.io/)
[![Discord](https://img.shields.io/discord/YOUR_DISCORD_SERVER_ID?color=7289da&label=Discord&logo=discord&logoColor=white)](https://discord.gg/9wW8KFXEnx)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/anthonny/workerify/pulls)

A Fastify-like router for Service Workers that enables handling HTTP requests directly in service workers with a familiar, ergonomic API.

> ⚠️ **Early Stage Project**: This project is in very early development (started September 20, 2025). APIs may change, and some features might not be fully stable yet. Use with caution in production environments.

## Why?

Why not? 😅
I recently discovered [htmx](https://htmx.org/) and as I'm experiencing fatigue with JS frameworks and their growing complexity, I was really excited.

I thought this was the perfect opportunity to rewrite [hubpress](https://github.com/HubPress/hubpress.io) (it could almost be an annual joke, this rewrite 🤣) using [Htmx](https://htmx.org/).

[Hubpress](https://github.com/HubPress/hubpress.io) is a SPA without a backend that has seen several rewrites, notably in [Vue.js](https://vuejs.org/) and [React](https://react.dev/).

To do the same thing with [Htmx](https://htmx.org/) which makes HTTP calls, I need to intercept the calls and create the response without leaving the browser.

So I made [Workerify](https://github.com/anthonny/workerify) 🚀

There are surely plenty of other use cases (I have a few in mind 😉), but I'd love to read your ideas come and discuss them on [Discord](https://discord.gg/9wW8KFXEnx).

## Features

- 🚀 **Fastify-like API** - Familiar routing patterns with `GET`, `POST`, `PUT`, `DELETE`, etc.
- 🔧 **Vite Integration** - First-class Vite plugin for seamless development
- 📡 **BroadcastChannel Communication** - Efficient message passing between main thread (or web worker) and service worker
- 🎯 **Type-Safe** - Full TypeScript support with comprehensive type definitions
- ⚡ **Zero Dependencies** - Lightweight core library with no runtime dependencies
- 🔄 **Hot Route Replacement** - Development mode with automatic route updates

## Demo

The example made with [Workerify](https://github.com/anthonny/workerify) and [htmx](https://htmx.org/) is available [here](https://anthonnyquerouil.me/workerify-examples/htmx/)

## Installation

```bash
# Using pnpm
pnpm add @workerify/lib @workerify/vite-plugin

# Using npm
npm install @workerify/lib @workerify/vite-plugin

# Using yarn
yarn add @workerify/lib @workerify/vite-plugin
```

## Quick Start

### 1. Configure Vite

Add the Workerify plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import workerify from '@workerify/vite-plugin';

export default defineConfig({
  plugins: [workerify()]
});
```

Or

```typescript
import { defineConfig } from 'vite';
import workerify from '@workerify/vite-plugin';

export default defineConfig({
  plugins: [
    workerify({
      scope: '/',  // Service worker scope
      swFileName: 'sw.js'  // Service worker file name
    })
  ]
});
```

### 2. Create Your Worker Routes

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

// Prefix matching for catch-all routes (using wildcard syntax)
app.get('/api/*', async (request, reply) => {
  return { message: 'Catch-all API route', path: request.url };
});

// Start listening for requests
app.listen();
```

### 3. Register the Service Worker

In your main application:

```typescript
import { registerWorkerifySW } from 'virtual:workerify-register';
import { Workerify } from '@workerify/lib';

// Register the service worker
await registerWorkerifySW();

// Create and use your Workerify instance
const app = new Workerify({ logger: true });
// ... add your routes
app.listen();
```

> **TypeScript Support**: The virtual module types are automatically included when you install `@workerify/vite-plugin`. If TypeScript doesn't recognize them, add this to your `vite-env.d.ts`:
> ```typescript
> /// <reference types="@workerify/vite-plugin/client" />
> ```

### 4. List registered routes (Debug)

In your browser's console:

```js
const bc = new BroadcastChannel("workerify");
bc.postMessage({type:'workerify:routes:list'});
```

## API Reference

### Workerify Class

```typescript
const app = new Workerify(options?: WorkerifyOptions);
```

**Options:**
- `logger?: boolean` - Enable console logging (default: `false`)
- `scope?: string` - Service worker scope

### Route Methods

```typescript
// HTTP method routes (supports wildcard with /* suffix)
app.get(path: string, handler: RouteHandler);
app.post(path: string, handler: RouteHandler);
app.put(path: string, handler: RouteHandler);
app.delete(path: string, handler: RouteHandler);
app.patch(path: string, handler: RouteHandler);
app.head(path: string, handler: RouteHandler);
app.option(path: string, handler: RouteHandler);  // Note: singular 'option'

// Route for all HTTP methods (supports wildcard with /* suffix)
app.all(path: string, handler: RouteHandler);

// Examples with wildcard:
app.get('/api/*', handler);     // Matches /api/users, /api/posts, etc.
app.post('/admin/*', handler);  // Matches all POST requests under /admin/

// Generic route registration with explicit matching control
app.route({
  method?: HttpMethod,      // Optional: specific HTTP method
  path: string,             // Route path
  handler: RouteHandler,    // Request handler function
  match?: 'exact' | 'prefix' // Matching strategy (default: 'exact')
});

// Plugin registration
app.register(plugin: WorkerifyPlugin, options?: any): Promise<Workerify>;
```

### Request Object

```typescript
interface WorkerifyRequest {
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  body?: ArrayBuffer | null;
  params: Record<string, string>;  // Route parameters
}
```

### Reply Object

```typescript
interface WorkerifyReply {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  bodyType?: 'json' | 'text' | 'arrayBuffer';
}
```

### Route Handler

```typescript
type RouteHandler = (
  request: WorkerifyRequest,
  reply: WorkerifyReply
) => Promise<any> | any;
```

## Examples

### Static File Serving

```typescript
// Simple wildcard syntax - automatically enables prefix matching
app.get('/static/*', async (request, reply) => {
  const url = new URL(request.url);
  const path = url.pathname.replace('/static/', '');
  const response = await fetch(`/assets/${path}`);

  reply.status = response.status;
  reply.headers = Object.fromEntries(response.headers);
  reply.bodyType = 'arrayBuffer';
  return await response.arrayBuffer();
});
```

### API Proxy

```typescript
// Proxy all requests under /api/ to an external service
app.all('/api/*', async (request, reply) => {
  const url = new URL(request.url);
  const targetUrl = url.pathname.replace('/api/', 'https://api.example.com/');
  const response = await fetch(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body
  });

  reply.status = response.status;
  reply.bodyType = 'json';
  return await response.json();
});

// Alternative: Use route() for explicit control
app.route({
  path: '/proxy/',
  match: 'prefix',  // Explicitly set prefix matching
  handler: async (request, reply) => {
    // Handle proxy logic
  }
});
```

### Middleware Pattern

```typescript
const authenticate = async (request: WorkerifyRequest) => {
  const token = request.headers['authorization'];
  if (!token) throw new Error('Unauthorized');
  // Validate token...
  return { userId: '123' };
};

app.get('/api/protected', async (request, reply) => {
  const user = await authenticate(request);
  return { message: `Hello ${user.userId}` };
});
```

## Development

This is a monorepo managed with pnpm workspaces. To contribute:

```bash
# Clone the repository
git clone https://github.com/yourusername/workerify.git
cd workerify

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development mode
pnpm dev

# Run linting
pnpm lint

# Run type checking
pnpm typecheck
```

### Project Structure

```
workerify/
├── packages/
│   ├── lib/           # Core Workerify library
│   ├── vite-plugin/   # Vite plugin
│   └── examples/      # Example applications
│       └── htmx/      # HTMX example app
├── package.json       # Root package.json
├── pnpm-workspace.yaml
└── turbo.json         # Turbo configuration
```

## Browser Support

Workerify requires browsers that support:
- Service Workers
- BroadcastChannel API
- ES Modules

This includes all modern browsers (Chrome 66+, Firefox 57+, Safari 11.1+, Edge 79+).

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Acknowledgments

Inspired by [Fastify](https://www.fastify.io/)'s excellent API design and developer experience.
