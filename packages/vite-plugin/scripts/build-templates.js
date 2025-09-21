import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function buildTemplatesWithTsc() {
  console.log('Compiling templates with TypeScript...');

  // Clean previous compilation
  execSync(`rm -rf ${join(projectRoot, 'src/generated-js')}`, {
    cwd: projectRoot,
  });

  // Compile all templates with unified config
  try {
    console.log('Compiling templates...');
    execSync(`npx tsc --project tsconfig.templates.json`, {
      cwd: projectRoot,
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Template TypeScript compilation failed:', error.message);
    process.exit(1);
  }

  // Read compiled JavaScript files and create template exports
  processCompiledServiceWorker();
  processCompiledRegister();

  // Clean up generated JS files
  execSync(`rm -rf ${join(projectRoot, 'src/generated-js')}`, {
    cwd: projectRoot,
  });
}

function processCompiledServiceWorker() {
  const compiledPath = join(projectRoot, 'src/generated-js/service-worker.js');
  const outputPath = join(
    projectRoot,
    'src/generated/service-worker-template.ts',
  );

  console.log(
    `Processing compiled service worker: ${compiledPath} -> ${outputPath}`,
  );

  const jsContent = readFileSync(compiledPath, 'utf-8');

  // Create the template export
  const templateContent = `// Auto-generated template - do not edit manually
export const SW_TEMPLATE = ${JSON.stringify(jsContent)};
`;

  writeFileSync(outputPath, templateContent);
  console.log(`✓ Generated: ${outputPath}`);
}

function processCompiledRegister() {
  const compiledPath = join(projectRoot, 'src/generated-js/register.js');
  const outputPath = join(projectRoot, 'src/generated/register-template.ts');

  console.log(`Processing compiled register: ${compiledPath} -> ${outputPath}`);

  const jsContent = readFileSync(compiledPath, 'utf-8');

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
  console.log(`✓ Generated: ${outputPath}`);
}

// Ensure output directories exist
execSync(`mkdir -p ${join(projectRoot, 'src/generated')}`, {
  cwd: projectRoot,
});

// Build templates using TypeScript compiler
buildTemplatesWithTsc();

console.log('✓ All templates built successfully with tsc');
