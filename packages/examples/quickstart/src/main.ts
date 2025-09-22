import './style.css';

import { registerWorkerifySW } from 'virtual:workerify-register';
import { Workerify } from '@workerify/lib';
import htmx from 'htmx.org';

(async () => {
  // Register the service worker
  await registerWorkerifySW();

  const app = new Workerify({ logger: true });

  const todos: string[] = [];
  // GET to return todos
  app.get('/todos', async () => {
    return JSON.stringify(todos, null, 2);
  });

  // POST to add a todo
  app.post('/todos', async (request, reply) => {
    // @ts-expect-error
    todos.push(request.body?.todo);
    reply.headers = {
      'HX-Trigger': 'todos:refresh',
    };
  });

  // Start listening for requests
  await app.listen();

  setTimeout(() => {
    htmx.trigger('#app', 'workerify-ready');
  }, 100);
})();
