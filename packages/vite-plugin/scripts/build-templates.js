import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function buildTemplatesWithTsc() {
  console.log('Building templates with bundling...');

  // Build service worker with bundled dependencies
  buildBundledServiceWorker();

  // Build register template (no bundling needed)
  buildRegisterTemplate();
}

function buildBundledServiceWorker() {
  console.log('Building bundled service worker...');

  const outputPath = join(
    projectRoot,
    'src/generated/service-worker-template.ts',
  );

  // Create a single bundled TypeScript file first
  const bundledTsPath = join(
    projectRoot,
    'src/templates/bundled-service-worker.ts',
  );
  createBundledTsFile(bundledTsPath);

  // Clean previous compilation
  execSync(`rm -rf ${join(projectRoot, 'src/generated-js')}`, {
    cwd: projectRoot,
  });

  // Compile the bundled file with TypeScript
  try {
    execSync(`mkdir -p ${join(projectRoot, 'src/generated-js')}`, {
      cwd: projectRoot,
    });

    execSync(
      `npx tsc ${bundledTsPath} --target ES2022 --module ESNext --outDir src/generated-js --lib ES2022,WebWorker,DOM --skipLibCheck`,
      {
        cwd: projectRoot,
        stdio: 'inherit',
      },
    );
  } catch (error) {
    console.error('TypeScript compilation failed:', error.message);
    process.exit(1);
  }

  // Read compiled JavaScript file
  const compiledPath = join(
    projectRoot,
    'src/generated-js/bundled-service-worker.js',
  );
  const jsContent = readFileSync(compiledPath, 'utf-8');

  // Create the template export
  const templateContent = `// Auto-generated template - do not edit manually
export const SW_TEMPLATE = ${JSON.stringify(jsContent)};
`;

  writeFileSync(outputPath, templateContent);

  // Clean up temporary files
  execSync(`rm -f ${bundledTsPath}`, { cwd: projectRoot });
  execSync(`rm -rf ${join(projectRoot, 'src/generated-js')}`, {
    cwd: projectRoot,
  });

  console.log(`✓ Generated: ${outputPath}`);
}

function createBundledTsFile(outputPath) {
  // Read all source files
  const databaseContent = readFileSync(
    join(projectRoot, 'src/templates/database.ts'),
    'utf-8',
  );
  const copilotContent = readFileSync(
    join(projectRoot, 'src/templates/workerify-sw-copilot.ts'),
    'utf-8',
  );

  // Process the files to remove imports/exports and make them compatible
  const processedDatabase = databaseContent.replace(/^export\s+/gm, '');

  const processedCopilot = copilotContent
    .replace(/^import\s+.*?from\s+.*?;?\s*$/gm, '')
    .replace(/^export\s+/gm, '');

  // Create the bundled TypeScript file
  const bundledContent = `// === Bundled Workerify Service Worker ===
// This file is auto-generated - do not edit manually

${processedDatabase}

${processedCopilot}

// Main service worker
console.log('[Workerify SW] Service worker script loaded');
const { onClientsClaim, onFetch } = init(self as any);

self.addEventListener('install', () => {
  console.log('[Workerify SW] Installing');
  self.skipWaiting();
});

self.addEventListener('activate', (e: ExtendableEvent) => {
  console.log('[Workerify SW] Activating');
  console.log(
    '[Workerify SW] Will start intercepting requests for scope:',
    self.registration.scope,
  );
  e.waitUntil(
    self.clients.claim().then(() => {
      onClientsClaim();
    }),
  );
});

// Test if fetch listener is working at all
console.log('[Workerify SW] Adding fetch event listener...');
self.addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(
    (async () => {
      const response = await onFetch(event);
      if (response) {
        return response;
      }
      // @ts-expect-error
      return fetch(event);
    })(),
  );
});`;

  writeFileSync(outputPath, bundledContent);
}

function buildRegisterTemplate() {
  console.log('Building register template...');

  const outputPath = join(projectRoot, 'src/generated/register-template.ts');
  const registerContent = readFileSync(
    join(projectRoot, 'src/templates/register.ts'),
    'utf-8',
  );

  // Create a single bundled TypeScript file first
  const bundledTsPath = join(projectRoot, 'src/templates/bundled-register.ts');

  // Remove imports but keep exports since they need to be preserved
  const processedRegister = registerContent.replace(
    /^import\s+.*?from\s+.*?;?\s*$/gm,
    '',
  );

  const bundledContent = `// === Bundled Register Template ===
// This file is auto-generated - do not edit manually

${processedRegister}`;

  writeFileSync(bundledTsPath, bundledContent);

  // Clean previous compilation
  execSync(`rm -rf ${join(projectRoot, 'src/generated-js')}`, {
    cwd: projectRoot,
  });

  // Compile the bundled file with TypeScript
  try {
    execSync(`mkdir -p ${join(projectRoot, 'src/generated-js')}`, {
      cwd: projectRoot,
    });

    execSync(
      `npx tsc ${bundledTsPath} --target ES2022 --module ESNext --outDir src/generated-js --lib ES2022,DOM --skipLibCheck`,
      {
        cwd: projectRoot,
        stdio: 'inherit',
      },
    );
  } catch (error) {
    console.error('TypeScript compilation failed:', error.message);
    process.exit(1);
  }

  // Read compiled JavaScript file
  const compiledPath = join(
    projectRoot,
    'src/generated-js/bundled-register.js',
  );
  let jsContent = readFileSync(compiledPath, 'utf-8');

  // Remove leading comments that cause Vite parsing issues
  jsContent = jsContent
    .replace(/^\/\/.*$/gm, '') // Remove single-line comments
    .replace(/^\s*$/gm, '') // Remove empty lines
    .replace(/^[\s\n]+/, ''); // Remove leading whitespace/newlines

  // Create a function that generates the register module with placeholder replacement
  const templateContent = `// Auto-generated template - do not edit manually
export function getRegisterModule(publicSwUrl: string, scope: string, swFileName: string): string {
  const template = ${JSON.stringify(jsContent)};

  return template
    .replace(/'__SW_URL__'/g, JSON.stringify(publicSwUrl))
    .replace(/'__SCOPE__'/g, JSON.stringify(scope))
    .replace(/'__SW_FILENAME__'/g, JSON.stringify(swFileName));
}
`;

  writeFileSync(outputPath, templateContent);

  // Clean up temporary files
  execSync(`rm -f ${bundledTsPath}`, { cwd: projectRoot });
  execSync(`rm -rf ${join(projectRoot, 'src/generated-js')}`, {
    cwd: projectRoot,
  });

  console.log(`✓ Generated: ${outputPath}`);
}

// Ensure output directories exist
execSync(`mkdir -p ${join(projectRoot, 'src/generated')}`, {
  cwd: projectRoot,
});

// Build templates using bundling approach
buildTemplatesWithTsc();

console.log('✓ All templates built successfully with tsc');
