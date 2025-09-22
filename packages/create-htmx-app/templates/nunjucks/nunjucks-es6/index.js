module.exports = {
  wrapper: (templates, opts) => {
    const templatesPrecompiled = templates.map(
      (template) =>
        `nunjucksPrecompiled[${JSON.stringify(template.name)}] = function() {${template.template};}()`,
    );

    return `// @ts-nocheck\nexport const nunjucksPrecompiled: Record<string, any> = {};
${templatesPrecompiled.join('\n')}`;
  },
};
