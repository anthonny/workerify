declare module 'nunjucks/browser/nunjucks-slim.js' {
  import * as nunjucks from 'nunjucks';

  // Override PrecompiledLoader to accept a single object instead of an array
  class PrecompiledLoader extends nunjucks.Loader implements nunjucks.ILoader {
    constructor(precompiled: any);
    getSource(name: string): nunjucks.LoaderSource;
  }

  const njk: typeof nunjucks & {
    PrecompiledLoader: typeof PrecompiledLoader;
  };

  export = njk;
}
