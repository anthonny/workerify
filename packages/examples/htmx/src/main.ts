import { registerWorkerifySW } from 'virtual:workerify-register';
import Workerify from '@workerify/lib';
import htmx from 'htmx.org';
import todosRouter from './todos';

const start = async () => {
  try {
    await registerWorkerifySW();

    const workerify = Workerify();
    await workerify.register(todosRouter);
    workerify.listen();
    htmx.trigger('#todos', 'workerify-ready');
  } catch (err) {
    console.log(err);
  }
};
start();
