import nunjucks from 'nunjucks/browser/nunjucks-slim.js';
import { nunjucksPrecompiled } from './templates';
import type { Renderer } from './types';

const env = new nunjucks.Environment(
  new nunjucks.PrecompiledLoader(nunjucksPrecompiled),
);

const renderer: Renderer = {
  viewTodo: ({ todo, filter }) => env.render('viewTodo.njk', { todo, filter }),
  viewTodos: ({ todos, filter }) =>
    env.render('viewTodos.njk', { todos, filter }),
};

export default renderer;
