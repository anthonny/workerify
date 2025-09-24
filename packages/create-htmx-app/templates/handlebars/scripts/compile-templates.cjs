const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

// Read all .hbs files from src/templates
const templatesDir = path.join(__dirname, '..', 'src', 'templates');
const outputFile = path.join(templatesDir, 'index.ts');

const templates = [];

// Read and compile each template
fs.readdirSync(templatesDir).forEach(file => {
  if (file.endsWith('.hbs')) {
    const templateName = path.basename(file, '.hbs');
    const templateContent = fs.readFileSync(path.join(templatesDir, file), 'utf-8');
    const precompiled = Handlebars.precompile(templateContent);

    templates.push({
      name: templateName,
      template: precompiled
    });
  }
});

// Generate the ES6 module
let output = `// @ts-nocheck
import Handlebars from 'handlebars/runtime';
export const handlebarsPrecompiled: Record<string, any> = {};
`;

templates.forEach(template => {
  output += `handlebarsPrecompiled[${JSON.stringify(template.name)}] = Handlebars.template(${template.template});\n`;
});

// Add registerPartials function
output += `
export function registerPartials(Handlebars: any) {
  Object.keys(handlebarsPrecompiled).forEach(name => {
    Handlebars.registerPartial(name, handlebarsPrecompiled[name]);
  });
}
`;

// Write the output file
fs.writeFileSync(outputFile, output);
console.log(`Generated ${outputFile}`);