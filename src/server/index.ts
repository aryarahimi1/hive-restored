import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { trpcServer } from '@hono/trpc-server';

import { createServer, getServerPort } from '@devvit/web/server';
import { menu } from './routes/menu';
import { modqueueBadgeForms, modqueueBadgeMenu } from './routes/modqueueBadge';
import { triggers } from './routes/triggers';
import { schedulerRouter } from './routes/scheduler';
import { forms } from './routes/forms';
import { appRouter } from './trpc';
import { createContext } from './context';

const app = new Hono();

const api = new Hono();
api.use(
  '/trpc/*',
  trpcServer({
    endpoint: '/api/trpc',
    router: appRouter,
    createContext,
  })
);

const internal = new Hono();
internal.route('/menu', menu);
internal.route('/menu/modqueue-badge', modqueueBadgeMenu);
internal.route('/triggers', triggers);
internal.route('/scheduler', schedulerRouter);
internal.route('/forms', forms);
internal.route('/forms/modqueue-badge', modqueueBadgeForms);

app.route('/api', api);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer: createServer,
  port: getServerPort(),
});
