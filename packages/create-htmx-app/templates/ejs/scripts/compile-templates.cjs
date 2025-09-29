const ejs = require('ejs');
const fs = require('fs');
const path = require('path');

// Read all .ejs files from src/templates
const templatesDir = path.join(__dirname, '..', 'src', 'templates');
const outputFile = path.join(templatesDir, 'index.ts');

const templates = {};

// Read and compile each template
fs.readdirSync(templatesDir).forEach((file) => {
  if (file.endsWith('.ejs')) {
    const templateName = path.basename(file, '.ejs');
    const templatePath = path.join(templatesDir, file);
    const templateContent = fs.readFileSync(templatePath, 'utf-8');

    // Compile template with client option to get a function string
    // Use strict mode to avoid 'with' statements
    const compiledFunction = ejs.compile(templateContent, {
      client: true,
      filename: templatePath,
      compileDebug: false,
      strict: true, // This prevents 'with' statements
      _with: false, // Explicitly disable with statements
      localsName: 'locals', // Name of the locals object
    });

    templates[templateName] = compiledFunction.toString();
  }
});

const pipedTemplateNames = Object.keys(templates).length
  ? Object.keys(templates)
      .map((t) => `'${t}'`)
      .join('|')
  : 'string';
// Generate the ES6 module
let output = `// @ts-nocheck
import ejs from 'ejs';

export const ejsTemplates: Record<${pipedTemplateNames}, any> = {};
`;

// Add each compiled template
Object.keys(templates).forEach((name) => {
  output += `ejsTemplates['${name}'] = ${templates[name]};\n`;
});

// Add a render function that handles includes
output += `
export function renderTemplate(templateName: ${pipedTemplateNames}, data: any): string {
  const template = ejsTemplates[templateName];
  if (!template) {
    throw new Error(\`Template \${templateName} not found\`);
  }

  // Create locals object with all data and helper functions
  const locals = {
    ...data,
    include: (name: string, includeData?: any) => {
      const mergedData = { ...data, ...includeData };
      return renderTemplate(name, mergedData);
    }
  };

  return template(locals, null, (name: string, includeData?: any) => {
    const mergedData = { ...locals, ...includeData };
    return renderTemplate(name, mergedData);
  }, ejs.escapeXML);
}
`;

// Write the output file
fs.writeFileSync(outputFile, output);
console.log(`Generated ${outputFile}`);
