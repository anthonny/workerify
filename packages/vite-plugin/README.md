# @workerify/vite-plugin

Vite plugin for Workerify - Seamless Service Worker integration with automatic registration and hot reload support.

## Installation

```bash
# Using pnpm
pnpm add @workerify/vite-plugin @workerify/lib

# Using npm
npm install @workerify/vite-plugin @workerify/lib

# Using yarn
yarn add @workerify/vite-plugin @workerify/lib
```

Note: `@workerify/lib` is a peer dependency and must be installed alongside the plugin.

## Quick Start

### 1. Configure Vite

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import workerify from '@workerify/vite-plugin';

export default defineConfig({
  plugins: [
    workerify()  // or workerify({ scope: '/', swFileName: 'sw.js' })
  ]
});
```

### 2. Register Service Worker and Define Routes

In your main application file:

```typescript
import { registerWorkerifySW } from 'virtual:workerify-register';
import { Workerify } from '@workerify/lib';

// Register the service worker
await registerWorkerifySW();

// Create your Workerify instance
const app = new Workerify({ logger: true });

// Add your routes
app.get('/api/hello', async (request, reply) => {
  return { message: 'Hello from Service Worker!' };
});

// Start listening
app.listen();
```

### 3. TypeScript Support (Automatic)

TypeScript types for the virtual module are automatically included when you install this package. If TypeScript doesn't recognize them, add this reference to your `vite-env.d.ts`:

```typescript
/// <reference types="@workerify/vite-plugin/client" />
```

## Documentation

For complete API reference, configuration options, troubleshooting, and examples, see the [main README](https://github.com/anthonny/workerify#readme).

## License

MIT
