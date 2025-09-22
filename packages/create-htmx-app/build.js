import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building TypeScript files...');
execSync('tsc', { stdio: 'inherit' });

const cliPath = path.join(process.cwd(), 'dist', 'cli.js');
const cliContent = fs.readFileSync(cliPath, 'utf-8');

if (!cliContent.startsWith('#!/usr/bin/env node')) {
  fs.writeFileSync(cliPath, '#!/usr/bin/env node\n' + cliContent);
  console.log('Added shebang to cli.js');
}

fs.chmodSync(cliPath, '755');
console.log('Made cli.js executable');

console.log('Build completed successfully!');