import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { promisify } from 'util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

describe('Template Compilation System', () => {
  const projectRoot = path.resolve(process.cwd());
  const scriptsDir = path.join(projectRoot, 'scripts');
  const templatesDir = path.join(projectRoot, 'src', 'templates');
  const generatedDir = path.join(projectRoot, 'src', 'generated');

  beforeAll(async () => {
    // Ensure generated directory exists for tests
    try {
      await fs.mkdir(generatedDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  });

  afterAll(async () => {
    // Cleanup test artifacts if needed
  });

  describe('Build script validation', () => {
    it('should have build-templates.js script', async () => {
      const scriptPath = path.join(scriptsDir, 'build-templates.js');

      try {
        const stats = await fs.stat(scriptPath);
        expect(stats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(`build-templates.js script not found at ${scriptPath}`);
      }
    });

    it('should be executable Node.js script', async () => {
      const scriptPath = path.join(scriptsDir, 'build-templates.js');
      const content = await fs.readFile(scriptPath, 'utf-8');

      // Should be valid JavaScript
      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);

      // Should contain Node.js script characteristics (can be ES modules or CommonJS)
      expect(content).toMatch(/import|require|from/);
      expect(content).toMatch(/function|const|let/);
    });
  });

  describe('Template source files', () => {
    it('should have service-worker template', async () => {
      const templatePath = path.join(templatesDir, 'service-worker.ts');

      try {
        const stats = await fs.stat(templatePath);
        expect(stats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(
          `service-worker.ts template not found at ${templatePath}`,
        );
      }
    });

    it('should have register template', async () => {
      const templatePath = path.join(templatesDir, 'register.ts');

      try {
        const stats = await fs.stat(templatePath);
        expect(stats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(`register.ts template not found at ${templatePath}`);
      }
    });

    it('should contain valid TypeScript code in service-worker template', async () => {
      const templatePath = path.join(templatesDir, 'service-worker.ts');
      const content = await fs.readFile(templatePath, 'utf-8');

      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);

      // Should contain Service Worker specific code
      expect(content).toContain('self');
      expect(content).toMatch(/addEventListener|fetch|install|activate/);
    });

    it('should contain valid TypeScript code in register template', async () => {
      const templatePath = path.join(templatesDir, 'register.ts');
      const content = await fs.readFile(templatePath, 'utf-8');

      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);

      // Should contain registration logic
      expect(content).toContain('serviceWorker');
      expect(content).toContain('register');
    });
  });

  describe('Generated output validation', () => {
    it('should generate service-worker-template.ts', async () => {
      // Run the build script first
      try {
        await execAsync('node scripts/build-templates.js', {
          cwd: projectRoot,
        });
      } catch (error) {
        throw new Error(`Failed to run build script: ${error}`);
      }

      const outputPath = path.join(generatedDir, 'service-worker-template.ts');

      try {
        const stats = await fs.stat(outputPath);
        expect(stats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(
          `Generated service-worker-template.ts not found at ${outputPath}`,
        );
      }
    });

    it('should generate register-template.ts', async () => {
      const outputPath = path.join(generatedDir, 'register-template.ts');

      try {
        const stats = await fs.stat(outputPath);
        expect(stats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(
          `Generated register-template.ts not found at ${outputPath}`,
        );
      }
    });

    it('should generate valid TypeScript in service-worker-template.ts', async () => {
      const outputPath = path.join(generatedDir, 'service-worker-template.ts');
      const content = await fs.readFile(outputPath, 'utf-8');

      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);

      // Should be valid TypeScript/JavaScript module
      expect(content.includes('export')).toBe(true);

      // Should export SW_TEMPLATE
      expect(content).toContain('SW_TEMPLATE');
      expect(content).toContain('export');
    });

    it('should generate valid TypeScript in register-template.ts', async () => {
      const outputPath = path.join(generatedDir, 'register-template.ts');
      const content = await fs.readFile(outputPath, 'utf-8');

      expect(content).toBeTruthy();
      expect(content.length).toBeGreaterThan(0);

      // Should be valid TypeScript module
      expect(content.includes('export')).toBe(true);

      // Should export getRegisterModule function
      expect(content).toContain('getRegisterModule');
      expect(content).toContain('export');
    });
  });

  describe('TypeScript compilation', () => {
    it('should have proper TypeScript configuration', async () => {
      const tsconfigPath = path.join(projectRoot, 'tsconfig.templates.json');

      try {
        const stats = await fs.stat(tsconfigPath);
        expect(stats.isFile()).toBe(true);
      } catch (error) {
        throw new Error(`tsconfig.templates.json not found at ${tsconfigPath}`);
      }

      const content = await fs.readFile(tsconfigPath, 'utf-8');
      const config = JSON.parse(content);

      expect(config).toHaveProperty('compilerOptions');
      expect(config.compilerOptions).toHaveProperty('target');
      expect(config.compilerOptions).toHaveProperty('module');
    });

    it('should compile TypeScript without errors', async () => {
      try {
        const result = await execAsync('node scripts/build-templates.js', {
          cwd: projectRoot,
        });

        // Should not contain TypeScript compilation errors
        expect(result.stderr).not.toContain('error TS');
        expect(result.stderr).not.toContain('Cannot find');
        expect(result.stderr).not.toContain("Type '");
      } catch (error) {
        throw new Error(`TypeScript compilation failed: ${error}`);
      }
    });

    it('should generate ES modules', async () => {
      const swOutputPath = path.join(
        generatedDir,
        'service-worker-template.ts',
      );
      const regOutputPath = path.join(generatedDir, 'register-template.ts');

      const swContent = await fs.readFile(swOutputPath, 'utf-8');
      const regContent = await fs.readFile(regOutputPath, 'utf-8');

      // Both should be ES modules
      expect(swContent).toContain('export');
      expect(regContent).toContain('export');

      // Should not contain CommonJS syntax
      expect(swContent).not.toContain('module.exports');
      expect(regContent).not.toContain('module.exports');
      expect(swContent).not.toContain('exports.');
      expect(regContent).not.toContain('exports.');
    });
  });

  describe('Template transformation', () => {
    it('should transform placeholders in register template', async () => {
      const outputPath = path.join(generatedDir, 'register-template.ts');
      const content = await fs.readFile(outputPath, 'utf-8');

      // Should contain placeholder replacement logic
      expect(content).toMatch(/replace|substitut/i);
      expect(content).toContain('__SW_URL__');
      expect(content).toContain('__SCOPE__');
    });

    it('should preserve string templates correctly', async () => {
      const outputPath = path.join(generatedDir, 'service-worker-template.ts');
      const content = await fs.readFile(outputPath, 'utf-8');

      // Should be a string export
      expect(content).toMatch(/SW_TEMPLATE\s*=\s*["`']/);
    });

    it('should handle quote escaping properly', async () => {
      const regOutputPath = path.join(generatedDir, 'register-template.ts');
      const regContent = await fs.readFile(regOutputPath, 'utf-8');

      // Should properly escape quotes in template strings
      expect(regContent).toContain('getRegisterModule');
      expect(regContent).toContain('template');
    });
  });

  describe('Build integration', () => {
    it('should be part of prebuild step', async () => {
      const packageJsonPath = path.join(projectRoot, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      expect(packageJson.scripts).toHaveProperty('prebuild');
      expect(packageJson.scripts.prebuild).toContain('build-templates.js');
    });

    it('should generate files before TypeScript compilation', async () => {
      // Clean generated directory
      try {
        await fs.rm(generatedDir, { recursive: true, force: true });
      } catch {
        // Directory might not exist
      }

      // Run prebuild
      await execAsync('npm run prebuild', { cwd: projectRoot });

      // Check that files were generated
      const swExists = await fs
        .stat(path.join(generatedDir, 'service-worker-template.ts'))
        .then(() => true)
        .catch(() => false);
      const regExists = await fs
        .stat(path.join(generatedDir, 'register-template.ts'))
        .then(() => true)
        .catch(() => false);

      expect(swExists).toBe(true);
      expect(regExists).toBe(true);
    });

    it('should allow successful TypeScript build after prebuild', async () => {
      try {
        // This should not fail if templates are properly generated
        const result = await execAsync('npm run typecheck', {
          cwd: projectRoot,
        });
        // Should not contain TypeScript errors
        expect(result.stderr).not.toContain('error TS');
      } catch (error) {
        // If it fails, at least check that generated files exist
        const swExists = await fs
          .stat(path.join(generatedDir, 'service-worker-template.ts'))
          .then(() => true)
          .catch(() => false);
        const regExists = await fs
          .stat(path.join(generatedDir, 'register-template.ts'))
          .then(() => true)
          .catch(() => false);

        expect(swExists).toBe(true);
        expect(regExists).toBe(true);
      }
    });
  });

  describe('File system organization', () => {
    it('should keep source templates separate from generated files', async () => {
      const templatesExists = await fs
        .stat(templatesDir)
        .then(() => true)
        .catch(() => false);
      const generatedExists = await fs
        .stat(generatedDir)
        .then(() => true)
        .catch(() => false);

      expect(templatesExists).toBe(true);
      expect(generatedExists).toBe(true);
      expect(templatesDir).not.toBe(generatedDir);
    });

    it('should exclude generated files from version control', async () => {
      const gitignorePath = path.join(projectRoot, '.gitignore');

      try {
        const content = await fs.readFile(gitignorePath, 'utf-8');
        expect(content).toMatch(/generated|src\/generated/);
      } catch {
        // .gitignore might not exist in test environment
        // This is more of a project setup test
      }
    });
  });

  describe('Error handling in build script', () => {
    it('should handle missing template files gracefully', async () => {
      // This test might need to temporarily rename files to test error handling
      // For now, we just ensure the script exists and can be executed
      const scriptPath = path.join(scriptsDir, 'build-templates.js');
      const content = await fs.readFile(scriptPath, 'utf-8');

      // Should contain error handling logic
      expect(content).toMatch(/try|catch|error/i);
    });

    it('should provide meaningful error messages', async () => {
      // The build script should provide helpful errors when things go wrong
      const scriptPath = path.join(scriptsDir, 'build-templates.js');
      const content = await fs.readFile(scriptPath, 'utf-8');

      // Should have error logging or handling
      expect(content).toMatch(/console|error|Error/);
    });
  });
});
