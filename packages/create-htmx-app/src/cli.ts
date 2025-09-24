#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import degit from 'degit';
import prompts from 'prompts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface Template {
  title: string;
  value: string;
}

async function main() {
  const { projectName } = await prompts({
    type: 'text',
    name: 'projectName',
    message: 'Project name:',
    initial: 'my-htmx-app',
    validate: (value: string) => {
      if (!value) return 'Project name is required';
      if (!/^[a-z0-9-]+$/.test(value)) {
        return 'Project name should only contain lowercase letters, numbers, and hyphens';
      }
      return true;
    },
  });

  if (!projectName) {
    console.log('✖ Operation cancelled');
    process.exit(0);
  }

  const templates: Template[] = [
    { title: 'Handlebars Template', value: 'handlebars' },
    { title: 'Nunjucks Template', value: 'nunjucks' },
    { title: 'EJS Template', value: 'ejs' },
  ];

  const { template } = await prompts({
    type: 'select',
    name: 'template',
    message: 'Choose a template: (Handlebars and EJS coming soon)',
    choices: templates,
  });

  if (!template) {
    console.log('✖ Operation cancelled');
    process.exit(0);
  }

  const dest = path.resolve(process.cwd(), projectName);

  if (fs.existsSync(dest)) {
    const { overwrite } = await prompts({
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${projectName} already exists. Overwrite?`,
      initial: false,
    });

    if (!overwrite) {
      console.log('✖ Operation cancelled');
      process.exit(0);
    }

    fs.rmSync(dest, { recursive: true, force: true });
  }

  console.log(`\n📦 Creating project in ${dest}...`);

  try {
    const repo = 'anthonny/workerify';
    const basePath = path.resolve(__dirname, '..', 'templates', '_base');
    if (fs.existsSync(basePath)) {
      // Use fs.cp to copy local templates instead of degit
      fs.cpSync(basePath, dest, { recursive: true });
    } else {
      const emitter = degit(
        `${repo}/packages/create-htmx-app/templates/_base#main`,
        {
          cache: false,
          force: true,
        },
      );
      await emitter.clone(dest);
    }

    const templatePath = path.resolve(__dirname, '..', 'templates', template);
    const tempPath = path.resolve(dest, '_template');

    fs.mkdirSync(tempPath);

    if (fs.existsSync(templatePath)) {
      // Use fs.cp to copy local templates instead of degit
      fs.cpSync(templatePath, tempPath, { recursive: true });

      // Remove node_modules if it exists in the copied template
      const nodeModulesPath = path.join(tempPath, 'node_modules');
      if (fs.existsSync(nodeModulesPath)) {
        fs.rmSync(nodeModulesPath, { recursive: true, force: true });
      }
    } else {
      const emitter = degit(
        `${repo}/packages/create-htmx-app/templates/${template}#main`,
        {
          cache: false,
          force: true,
        },
      );
      await emitter.clone(tempPath);
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

    console.log(`\n✨ Project created successfully!`);
    console.log(`\n👉 Next steps:`);
    console.log(`   cd ${projectName}`);
    console.log(`   pnpm install`);
    console.log(`   pnpm dev`);
    console.log(
      `\n📖 For more information, visit: https://github.com/anthonny/workerify`,
    );
  } catch (error) {
    console.error('\n✖ Failed to create project:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
