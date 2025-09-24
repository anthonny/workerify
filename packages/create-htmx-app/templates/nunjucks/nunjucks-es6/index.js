module.exports = {
  wrapper: (templates, opts) => {
    const templatesPrecompiled = templates.map(
      (template) =>
        `nunjucksPrecompiled[${JSON.stringify(template.name)}] = function() {${template.template};}()`,
    );

    return `// @ts-nocheck\nexport const nunjucksPrecompiled: Record<${templates.map((t) => `'${t.name}'`).join('|')}, any> = {};
${templatesPrecompiled.join('\n')}`;
  },
};
