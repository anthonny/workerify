import type { Workerify } from '@workerify/lib';
import Handlebars from 'handlebars/runtime';
import { handlebarsPrecompiled, registerPartials } from './templates';

type Todo = {
  id: string;
  value: string;
  status: 'checked' | 'unchecked';
};

type TodoPayload = {
  todo: string;
};

type Filter = 'all' | 'unchecked' | 'checked';

// Register Handlebars helpers
Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

// Register all templates as partials
registerPartials(Handlebars);

async function todosRouter(workerify: Workerify, _options?: any) {
  const todos: Todo[] = [
    {
      id: `1`,
      value: 'Play with Htmx',
      status: 'checked',
    },
    {
      id: `2`,
      value: 'Ship Workerify',
      status: 'checked',
    },
    {
      id: `3`,
      value: 'Rewrite Hubpress with Htmx and Workerify',
      status: 'unchecked',
    },
  ];

  workerify.get('/api/todos', (request) => {
    // Parse query parameters from URL
    const url = new URL(request.url);
    const filterParam = url.searchParams.get('filter') as Filter | null;
    const filter: Filter = filterParam || 'all';

    // Filter todos based on the filter parameter
    let filteredTodos = todos;
    if (filter === 'unchecked') {
      filteredTodos = todos.filter((t) => t.status === 'unchecked');
    } else if (filter === 'checked') {
      filteredTodos = todos.filter((t) => t.status === 'checked');
    }

    const template = handlebarsPrecompiled['viewTodos'] as HandlebarsTemplateDelegate;
    return template({ filteredTodos, filter });
  });

  workerify.post('/api/todos', (request, reply) => {
    if (!request.body || !request.body?.['todo']) {
      reply.status = 422;
    }

    const payload = request.body as unknown as TodoPayload;

    const todo = {
      id: `${Date.now()}`,
      value: payload.todo,
      status: 'unchecked' as const,
    };

    todos.reverse().push(todo);
    todos.reverse();

    reply.headers = {
      'HX-Trigger': 'todos:refresh',
    };
    const template = handlebarsPrecompiled['viewTodo'] as HandlebarsTemplateDelegate;
    return template({ todo, filter: 'all' });
  });

  workerify.put('/api/todos/:todoId/toggle-status', (request, reply) => {
    const id = request.params.todoId;
    const url = new URL(request.url);
    const filterParam = url.searchParams.get('filter') as Filter | null;
    const filter: Filter = filterParam || 'all';

    // Find the todo by id
    const todo = todos.find((t) => t.id === id);

    if (!todo) {
      reply.status = 404;
      return { error: 'Todo not found' };
    }

    // Toggle the status
    todo.status = todo.status === 'checked' ? 'unchecked' : 'checked';

    reply.headers = {
      'HX-Trigger': 'todos:refresh',
    };
    // Return the updated todo HTML for HTMX to replace
    const template = handlebarsPrecompiled['viewTodo'] as HandlebarsTemplateDelegate;
    return template({ todo, filter });
  });
}

export default todosRouter;