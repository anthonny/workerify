import { getRegisterModule } from './generated/register-template.js';
import { SW_TEMPLATE } from './generated/service-worker-template.js';

// Plugin interface definition to avoid vite dependency
interface Plugin {
  name: string;
  enforce?: 'pre' | 'post';
  configureServer?: (server: any) => void;
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
    : (opts.scope ?? '') + '/';
  const swFileName = opts.swFileName ?? 'workerify-sw.js';

  // on garde le contenu en mémoire, pas besoin de fichier sur disque
  const swSource = SW_TEMPLATE;

  // URL publique finale du SW (ex: /workerify-sw.js)
  const publicSwUrl = '/' + swFileName.replace(/^\//, '');

  return {
    name: 'vite:workerify',
    enforce: 'pre',

    // Dev server: servir le fichier SW en mémoire
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === publicSwUrl) {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(swSource);
          return;
        }
        next();
      });
    },

    // Build: émettre l'asset SW dans dist/
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: swFileName,
        source: swSource,
      });
    },

    // Module virtuel pour l'enregistrement
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
