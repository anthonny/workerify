import Handlebars from 'handlebars/runtime';
import { handlebarsPrecompiled, registerPartials } from './templates';
import type { Renderer } from './types';

// Register Handlebars helpers
Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

// Register all templates as partials
registerPartials(Handlebars);

const renderer: Renderer = {
  viewTodo: ({ todo, filter }) => {
    const template = handlebarsPrecompiled['viewTodo'];
    return template({ todo, filter });
  },
  viewTodos: ({ todos, filter }) => {
    const template = handlebarsPrecompiled['viewTodos'];
    return template({ todos, filter });
  },
};

export default renderer;
