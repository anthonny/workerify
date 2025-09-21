import type { Workerify } from '@workerify/lib';

type Todo = {
  id: string;
  value: string;
  status: 'checked' | 'unchecked';
};

type TodoPayload = {
  todo: string;
};

type Filter = 'all' | 'unchecked' | 'checked';

const checkedIcon = `
  <svg viewBox="0 0 512 512" width="24" height="24">
    <path fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M352 176L217.6 336 160 272" />
    <rect fill="none" x="64" y="64" width="384" height="384" rx="48" ry="48" stroke-linejoin="round" stroke-width="32" />
  </svg>
`;

const squareIcon = `
  <svg viewBox="0 0 512 512" width="24" height="24">
    <path d="M416 448H96a32.09 32.09 0 01-32-32V96a32.09 32.09 0 0132-32h320a32.09 32.09 0 0132 32v320a32.09 32.09 0 01-32 32z" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" />
  </svg>
`;

const viewTodo = (filter: Filter) => (todo: Todo) => {
  const icon = todo.status === 'checked' ? checkedIcon : squareIcon;
  const textClass =
    todo.status === 'checked' ? 'line-through text-gray-400' : '';

  return `
    <div class="flex items-start border-b-2 border-gray-100 px-4 py-4 fill-current" id="todo-${todo.id}">
      <div class="text-gray-500 stroke-current cursor-pointer" hx-put="/api/todos/${todo.id}/toggle-status?filter=${filter}" hx-target="#todo-${todo.id}" hx-swap="outerHTML">
        ${icon}
      </div>
      <div class="ml-4 ${textClass}">${todo.value}</div>
    </div>
  `;
};

const viewFooterFilter = (isActive: boolean, filter: Filter, label: string) => `
  <li class="cursor-pointer ${isActive ? 'text-white' : ''}" hx-get="/api/todos?filter=${filter}" hx-target="#todos" hx-swap="outerHTML">${label}</li>
`;

const viewFooter = (activeCount: number, filter: Filter) => `
  <div class="flex justify-between items-center px-4 py-2 bg-gray-800 text-white">
    <div>${activeCount} ${activeCount === 1 ? 'item' : 'items'} left</div>
    <div>
      <ul class="flex text-gray-600 gap-2">
        ${viewFooterFilter(filter === 'all', 'all', 'All')}
        ${viewFooterFilter(filter === 'unchecked', 'unchecked', 'Active')}
        ${viewFooterFilter(filter === 'checked', 'checked', 'Completed')}
      </ul>
    </div>
  </div>
`;

const viewTodos = (todos: Todo[], filter: Filter) =>
  `<div
      class="flex flex-1 flex-col overflow-hidden"
      id="todos"
      hx-get="/api/todos?filter=${filter}"
      hx-trigger="sw-ready, todos:refresh from:body"
      hx-swap="outerHTML"
  >
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
        <!-- Todo items will be rendered here -->
        ${todos.map(viewTodo(filter)).join('\n')}
    </div>
    <div id="footer">
        <!-- Footer will be rendered here -->
        ${viewFooter(todos.length, filter)}
    </div>
  </div>`;

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
      value: 'Rewrite Hubpress with Htmx and Workerify d fdsdf ',
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

    return viewTodos(filteredTodos, filter);
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
    return viewTodo('all')(todo);
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
    return viewTodo(filter)(todo);
  });
}

export default todosRouter;
