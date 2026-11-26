import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { teamCreate } from '@exo/shared';
import { db } from '../db/client.ts';
import { teamMembers, teams } from '../db/schema.ts';

export async function teamRoutes(app: FastifyInstance) {
  // Teams the current user belongs to, with their role on each (drives the team switcher).
  app.get('/v1/teams', async (req) => {
    return db
      .select({ id: teams.id, name: teams.name, division: teams.division, role: teamMembers.role })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(eq(teamMembers.userId, req.userId));
  });

  app.post('/v1/teams', async (req, reply) => {
    const body = teamCreate.parse(req.body);
    const team = await db.transaction(async (tx) => {
      const [t] = await tx.insert(teams).values(body).returning();
      await tx.insert(teamMembers).values({ teamId: t!.id, userId: req.userId, role: 'owner' });
      return t!;
    });
    return reply.code(201).send(team);
  });
}
