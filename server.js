import next from 'next';

const dev = false;
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare();

export default {
  async fetch(request, env, ctx) {
    try {
      const response = await handle(request);
      return response;
    } catch (err) {
      console.error(err);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
};
