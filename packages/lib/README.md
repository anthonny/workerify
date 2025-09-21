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
app.listen();
```

## Documentation

For complete API reference, TypeScript types, examples, and integration guides, see the [main README](https://github.com/anthonny/workerify#readme).

## License

MIT