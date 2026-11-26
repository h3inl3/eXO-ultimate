import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { z } from 'zod';

/**
 * Zod → JSON Schema for route `schema` blocks. These only document the API (and drive
 * client generation): handlers still validate with Zod, and responses are sent as-is.
 */
export function json(schema: z.ZodType, io: 'input' | 'output' = 'input') {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, { io, unrepresentable: 'any' });
  return rest;
}

export const idParam = json(z.object({ id: z.uuid() }));

export function registerOpenApi(app: FastifyInstance) {
  app.setValidatorCompiler(() => (data) => ({ value: data }));
  app.setSerializerCompiler(() => (data) => JSON.stringify(data));
  app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: { title: 'eXO Ultimate API', version: '1' },
      components: {
        securitySchemes: { devUser: { type: 'apiKey', in: 'header', name: 'x-dev-user' } },
      },
      security: [{ devUser: [] }],
    },
  });
  app.register(swaggerUi, { routePrefix: '/docs' });
}
