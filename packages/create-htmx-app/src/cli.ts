#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import { isCancel } from '@clack/prompts';
import { downloadTemplate } from 'giget';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  p.intro('Create HTMX App');

  const projectName = await p.text({
    message: 'Project name:',
    placeholder: 'my-htmx-app',
    validate: (value) => {
      if (!value) return 'Project name is required';
      if (!/^[a-z0-9-]+$/.test(value)) {
        return 'Project name should only contain lowercase letters, numbers, and hyphens';
      }
      return undefined;
    },
  });

  if (isCancel(projectName)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  const template = await p.select({
    message: 'Choose a templating engine: ',
    options: [
      { label: 'Handlebars', value: 'handlebars' },
      { label: 'Nunjucks', value: 'nunjucks' },
      { label: 'EJS', value: 'ejs' },
    ],
  });

  if (isCancel(template)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  const dest = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(dest)) {
    const overwrite = await p.confirm({
      message: `Directory ${projectName} already exists. Overwrite?`,
      initialValue: false,
    });

    if (isCancel(overwrite) || !overwrite) {
      p.cancel('Operation cancelled');
      process.exit(0);
    }

    fs.rmSync(dest, { recursive: true, force: true });
  }

  const s = p.spinner();
  s.start(`Creating project in ${dest}`);

  try {
    const repo = 'anthonny/workerify';
    const basePath = path.resolve(__dirname, '..', 'templates', '_base');
    if (fs.existsSync(basePath)) {
      // Use fs.cp to copy local templates
      fs.cpSync(basePath, dest, { recursive: true });
    } else {
      await downloadTemplate(
        `github:${repo}/packages/create-htmx-app/templates/_base#main`,
        {
          dir: dest,
          force: true,
        },
      );
    }

    const templatePath = path.resolve(__dirname, '..', 'templates', template);
    const tempPath = path.resolve(dest, '_template');

    fs.mkdirSync(tempPath);

    if (fs.existsSync(templatePath)) {
      // Use fs.cp to copy local templates
      fs.cpSync(templatePath, tempPath, { recursive: true });

      // Remove node_modules if it exists in the copied template
      const nodeModulesPath = path.join(tempPath, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
      }
    } else {
      await downloadTemplate(
        `github:${repo}/packages/create-htmx-app/templates/${template}#main`,
        {
          dir: tempPath,
          force: true,
        },
      );
    }

    const srcPath = path.join(tempPath, 'src');
    if (fs.existsSync(srcPath)) {
      fs.cpSync(srcPath, path.join(dest, 'src'), { recursive: true });
    }

    const scriptsPath = path.join(tempPath, 'scripts');
    if (fs.existsSync(scriptsPath)) {
      fs.mkdirSync(path.join(dest, 'scripts'));
      fs.cpSync(scriptsPath, path.join(dest, 'scripts'), {
        recursive: true,
      });
    }

    const nunjucksEs6Path = path.join(tempPath, 'nunjucks-es6');
    if (fs.existsSync(nunjucksEs6Path)) {
      fs.mkdirSync(path.join(dest, 'nunjucks-es6'));
      fs.cpSync(nunjucksEs6Path, path.join(dest, 'nunjucks-es6'), {
        recursive: true,
      });
    }

    const packageJsonPath = path.join(dest, 'package.json');
    const packageJsonTemplatePath = path.join(tempPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageJson.name = projectName;

      if (fs.existsSync(packageJsonTemplatePath)) {
        const packageJsonTemplate = JSON.parse(
          fs.readFileSync(packageJsonTemplatePath, 'utf-8'),
        );
        packageJson.scripts = {
          ...packageJson.scripts,
          ...packageJsonTemplate.scripts,
        };
        packageJson.dependencies = {
          ...packageJson.dependencies,
          ...packageJsonTemplate.dependencies,
        };
        packageJson.devDependencies = {
          ...packageJson.devDependencies,
          ...packageJsonTemplate.devDependencies,
        };
      }

      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      fs.rmSync(tempPath, { recursive: true, force: true });
    }

    s.stop('Project created successfully!');

    p.outro(`Next steps:
   cd ${projectName}
   pnpm install
   pnpm dev

📖 For more information, visit: https://github.com/anthonny/workerify`);
  } catch (error) {
    s.stop('Failed to create project');
    p.log.error(`Failed to create project: ${error}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
