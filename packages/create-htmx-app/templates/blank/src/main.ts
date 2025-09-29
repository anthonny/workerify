import { registerWorkerifySW } from 'virtual:workerify-register';
import Workerify from '@workerify/lib';
import htmx from 'htmx.org';

const start = async () => {
  try {
    await registerWorkerifySW();

    const workerify = Workerify();
    await workerify.listen();
    htmx.trigger('#app', 'workerify-ready');
  } catch (err) {
    console.log(err);
  }
};
start();
