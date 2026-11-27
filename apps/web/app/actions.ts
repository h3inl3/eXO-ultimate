'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { COOKIE, api, config } from '../lib/session';

/** What a form shows after submitting. */
export type Result = { error?: string; message?: string; link?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const opt = (f: FormData, k: string) => str(f, k) || undefined;

async function client() {
  const c = await api();
  if (!c) redirect('/auth/login');
  return c;
}

/** Turns an API response into a form result and refreshes the page's data on success. */
function done(res: { error?: unknown }, message?: string): Result {
  if (res.error) {
    const e = res.error as { error?: string };
    return { error: e.error === 'validation' ? 'Check the fields and try again.' : (e.error ?? 'Something went wrong.') };
  }
  revalidatePath('/', 'layout');
  return message ? { message } : null;
}

/** Form fields shared by add and edit. Blank number/email are left unchanged on edit. */
function playerFields(f: FormData) {
  const number = opt(f, 'number');
  return {
    name: str(f, 'name'),
    number: number === undefined ? undefined : Number(number),
    genderMatch: (opt(f, 'genderMatch') ?? null) as 'MMP' | 'FMP' | null,
    positions: f.getAll('positions').map(String) as Array<'handler' | 'cutter' | 'hybrid'>,
    email: opt(f, 'email'),
  };
}

export async function createTeam(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).POST('/v1/teams', {
    body: { name: str(f, 'name'), division: str(f, 'division') as 'mixed' | 'women' | 'open' },
  });
  if (res.data) (await cookies()).set(COOKIE.team, res.data.id, { path: '/', sameSite: 'lax' });
  return done(res);
}

export async function switchTeam(f: FormData) {
  (await cookies()).set(COOKIE.team, str(f, 'teamId'), { path: '/', sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

export async function addPlayer(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).POST('/v1/teams/{teamId}/players', {
    params: { path: { teamId: str(f, 'teamId') } },
    body: playerFields(f),
  });
  return done(res, `Added ${str(f, 'name')}.`);
}

export async function updatePlayer(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).PATCH('/v1/players/{id}', {
    params: { path: { id: str(f, 'id') } },
    body: { ...playerFields(f), active: f.get('active') === 'on' },
  });
  return done(res, 'Saved.');
}

export async function removePlayer(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).DELETE('/v1/players/{id}', { params: { path: { id: str(f, 'id') } } });
  // Players with recorded stats are only deactivated, so their stats survive.
  return done(res, res.data?.deleted === 'soft' ? 'They have game stats, so they were deactivated instead.' : 'Deleted.');
}

export async function invitePlayer(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).POST('/v1/players/{id}/invite', { params: { path: { id: str(f, 'id') } } });
  if (!res.data) return done(res);
  // The code goes in the fragment, which browsers never send to a server, so it stays out of logs.
  const until = new Date(res.data.expiresAt).toLocaleDateString();
  return { link: `${config().app}/join#${res.data.code}`, message: `Send this link. It works once, until ${until}.` };
}

export async function acceptInvite(code: string): Promise<Result> {
  const res = await (await client()).POST('/v1/invites/accept', { body: { code } });
  if (res.data) (await cookies()).set(COOKIE.team, res.data.teamId, { path: '/', sameSite: 'lax' });
  return done(res, "You're on the team.");
}

export async function addMember(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).POST('/v1/teams/{id}/members', {
    params: { path: { id: str(f, 'teamId') } },
    body: { email: str(f, 'email'), role: str(f, 'role') as 'owner' | 'coach' | 'stat_keeper' | 'player' },
  });
  return done(res, `Added ${str(f, 'email')}.`);
}

export async function setMemberRole(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).PATCH('/v1/teams/{id}/members/{userId}', {
    params: { path: { id: str(f, 'teamId'), userId: str(f, 'userId') } },
    body: { role: str(f, 'role') as 'owner' | 'coach' | 'stat_keeper' | 'player' },
  });
  return done(res, 'Role updated.');
}

export async function removeMember(_: Result, f: FormData): Promise<Result> {
  const res = await (await client()).DELETE('/v1/teams/{id}/members/{userId}', {
    params: { path: { id: str(f, 'teamId'), userId: str(f, 'userId') } },
  });
  return done(res, 'Removed.');
}
