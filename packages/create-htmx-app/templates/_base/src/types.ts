export type TodoPayload = {
  todo: string;
};

export type Filter = 'all' | 'unchecked' | 'checked';

export type Todo = {
  id: string;
  value: string;
  status: 'checked' | 'unchecked';
};

export type Renderer = {
  viewTodo: (payload: { todo: Todo; filter: Filter }) => string;
  viewTodos: (payload: { todos: Todo[]; filter: Filter }) => string;
};
