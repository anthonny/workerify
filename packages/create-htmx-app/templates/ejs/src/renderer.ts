import { renderTemplate } from './templates';
import type { Renderer } from './types';

const renderer: Renderer = {
  viewTodo: ({ todo, filter }) => renderTemplate('viewTodo', { todo, filter }),
  viewTodos: ({ todos, filter }) =>
    renderTemplate('viewTodos', { todos, filter }),
};

export default renderer;
