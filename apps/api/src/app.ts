import Fastify from 'fastify';
import { ZodError } from 'zod';
import { IllegalEventError } from '@exo/shared';
import { HttpError, registerAuth } from './auth.ts';
import { teamRoutes } from './routes/teams.ts';
import { playerRoutes } from './routes/players.ts';
import { gameRoutes } from './routes/games.ts';
import { registerOpenApi } from './openapi.ts';

/** Clients below this version get a 426 and show an "update the app" screen. */
const MIN_CLIENT_VERSION = '0.1.0';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) return reply.code(400).send({ error: 'validation', issues: err.issues });
    if (err instanceof IllegalEventError) return reply.code(422).send({ error: 'illegal_event', message: err.message, eventId: err.event.id });
    if (err instanceof HttpError) return reply.code(err.status).send({ error: err.message });
    app.log.error(err);
    return reply.code(500).send({ error: 'internal' });
  });

  registerOpenApi(app);

  app.get('/health', { schema: { hide: true } }, async () => ({ ok: true }));
  app.get('/v1/meta', { schema: { tags: ['meta'], security: [] } }, async () => ({ minClientVersion: MIN_CLIENT_VERSION }));

  registerAuth(app);
  app.register(teamRoutes);
  app.register(playerRoutes);
  app.register(gameRoutes);
  return app;
}
