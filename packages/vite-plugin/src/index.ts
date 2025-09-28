import { getRegisterModule } from './generated/register-template';
import { SW_TEMPLATE } from './generated/service-worker-template';

// Plugin interface definition to avoid vite dependency
interface Plugin {
  name: string;
  enforce?: 'pre' | 'post';
  configResolved?: (config: { base?: string }) => void;
  configureServer?: (server: {
    middlewares: {
      use: (
        middleware: (req: unknown, res: unknown, next: () => void) => void,
      ) => void;
    };
  }) => void;
  generateBundle?: (this: PluginContext) => void;
  resolveId?: (id: string) => string | null;
  load?: (id: string) => string | null;
}

interface PluginContext {
  emitFile: (file: { type: 'asset'; fileName: string; source: string }) => void;
}

export interface WorkerifyPluginOptions {
  scope?: string;
  swFileName?: string;
}

export default function workerifyPlugin(
  opts: WorkerifyPluginOptions = {},
): Plugin {
  const scope = (opts.scope ?? '/').endsWith('/')
    ? (opts.scope ?? '/')
    : `${opts.scope ?? ''}/`;
  const swFileName = opts.swFileName ?? 'workerify-sw.js';

  // keep content in memory, no need for file on disk
  const swSource = SW_TEMPLATE;

  // Variable to store Vite's base path
  let viteBasePath = '/';

  // Final public SW URL will be calculated with the base path
  let publicSwUrl = `/${swFileName.replace(/^\//, '')}`;

  return {
    name: 'vite:workerify',
    enforce: 'pre',

    // Hook into Vite config to get base path
    configResolved(config: { base?: string }) {
      // Get the base path from Vite config (defaults to '/')
      viteBasePath = config.base || '/';
      // Ensure base path ends with '/'
      if (!viteBasePath.endsWith('/')) {
        viteBasePath = `${viteBasePath}/`;
      }
      // Update the public SW URL with the base path
      publicSwUrl = viteBasePath + swFileName.replace(/^\//, '');
    },

    // Dev server: serve the SW file from memory
    configureServer(server: {
      middlewares: {
        use: (
          middleware: (req: unknown, res: unknown, next: () => void) => void,
        ) => void;
      };
    }) {
      server.middlewares.use((req: unknown, res: unknown, next: () => void) => {
        const typedReq = req as { url?: string };
        const typedRes = res as {
          setHeader: (name: string, value: string) => void;
          end: (data: string) => void;
        };
        if (typedReq.url === publicSwUrl) {
          typedRes.setHeader('Content-Type', 'application/javascript');
          typedRes.end(swSource);
          return;
        }
        next();
      });
    },

    // Build: emit the SW asset to dist/
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: swFileName,
        source: swSource,
      });
    },

    // Virtual module for registration
    resolveId(id: string) {
      if (id === 'virtual:workerify-register') {
        return '\0virtual:workerify-register';
      }
      return null;
    },
    load(id: string) {
      if (id === '\0virtual:workerify-register') {
        return getRegisterModule(publicSwUrl, scope, swFileName);
      }
      return null;
    },
  };
}
