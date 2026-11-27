import { redirect } from 'next/navigation';
import { GENDER_MATCHES, POSITIONS, ROLES, type Role } from '@exo/shared';
import { isStaff, session } from '../../lib/session';
import { addMember, addPlayer, invitePlayer, removeMember, removePlayer, setMemberRole, updatePlayer } from '../actions';
import { ActionForm } from '../ui';
import { btn, field } from '../styles';

type Player = { id: string; name: string; number: number | null; genderMatch: 'MMP' | 'FMP' | null; positions: string[]; email: string | null; active: boolean; userId: string | null };

const ROLE_LABEL: Record<Role, string> = { owner: 'Owner', coach: 'Coach', stat_keeper: 'Stat keeper', player: 'Player' };
const card = { borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--line)', padding: 20 } as const;
const row = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 } as const;
const badge = { padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, background: 'var(--surface2)' } as const;
const small = { ...btn, minHeight: 36, padding: '0 12px', fontSize: 14 };

export default async function Roster() {
  const s = await session();
  if (!s) redirect('/auth/login?returnTo=/roster');
  if (!s.team) redirect('/');
  const team = s.team;
  const staff = isStaff(team.role);
  const [players, members] = await Promise.all([
    s.client.GET('/v1/teams/{teamId}/players', {
      params: { path: { teamId: team.id }, query: staff ? { includeInactive: 'true' } : {} },
    }),
    s.client.GET('/v1/teams/{id}/members', { params: { path: { id: team.id } } }),
  ]);
  const mixed = team.division === 'mixed';
  // Only owners may grant the owner role (the API enforces it too).
  const grantable: Role[] = ROLES.filter((r) => r !== 'owner' || team.role === 'owner');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h1 style={{ margin: 0, fontSize: 36 }}>Roster</h1>

      <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Players ({players.data?.filter((p) => p.active).length ?? 0})</h2>
        {staff && (
          <ActionForm action={addPlayer} style={row}>
            <input type="hidden" name="teamId" value={team.id} />
            <PlayerFields mixed={mixed} />
            <button style={{ ...btn, background: 'var(--blue)', color: 'var(--onBlue)', border: 0 }}>Add player</button>
          </ActionForm>
        )}
        {players.data?.length === 0 && <p style={{ margin: 0, color: 'var(--muted)' }}>No players yet.</p>}
        {players.data?.map((p) => <PlayerRow key={p.id} p={p} staff={staff} mixed={mixed} />)}
      </section>

      <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>People with access</h2>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>
          Players get access by accepting an invite. Add coaches and stat keepers by the email they signed in with.
        </p>
        {staff && (
          <ActionForm action={addMember} style={row}>
            <input type="hidden" name="teamId" value={team.id} />
            <input name="email" type="email" required placeholder="Email" aria-label="Email" style={{ ...field, flex: '1 1 220px' }} />
            <RoleSelect roles={grantable} value="coach" />
            <button style={btn}>Add</button>
          </ActionForm>
        )}
        {members.data?.map((m) => (
          <MemberRow key={m.userId} m={m} teamId={team.id} me={s.me.id} staff={staff} actor={team.role} grantable={grantable} />
        ))}
      </section>
    </div>
  );
}

function PlayerFields({ mixed, p }: { mixed: boolean; p?: Player }) {
  return (
    <>
      <input name="name" required maxLength={80} defaultValue={p?.name} placeholder="Name" aria-label="Name" style={{ ...field, flex: '2 1 180px' }} />
      <input name="number" type="number" min={0} max={99} defaultValue={p?.number ?? undefined} placeholder="#" aria-label="Jersey number" style={{ ...field, width: 72 }} />
      {mixed && (
        <select name="genderMatch" defaultValue={p?.genderMatch ?? ''} aria-label="Gender match" style={field}>
          <option value="">Match: none</option>
          {GENDER_MATCHES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      )}
      <input name="email" type="email" defaultValue={p?.email ?? undefined} placeholder="Email (optional)" aria-label="Email" style={{ ...field, flex: '1 1 180px' }} />
      <span style={row}>
        {POSITIONS.map((pos) => (
          <label key={pos} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
            <input type="checkbox" name="positions" value={pos} defaultChecked={p?.positions.includes(pos)} />
            {pos}
          </label>
        ))}
      </span>
    </>
  );
}

function PlayerRow({ p, staff, mixed }: { p: Player; staff: boolean; mixed: boolean }) {
  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8, opacity: p.active ? 1 : 0.6 }}>
      <div style={row}>
        <span className="num" style={{ width: 36, fontSize: 20, fontWeight: 700 }}>{p.number ?? '–'}</span>
        <span style={{ fontWeight: 700, flex: '1 1 160px' }}>{p.name}</span>
        {p.genderMatch && <span style={{ ...badge, background: p.genderMatch === 'FMP' ? 'var(--chipGreen)' : 'var(--chipBlue)' }}>{p.genderMatch}</span>}
        {p.positions.map((pos) => <span key={pos} style={badge}>{pos}</span>)}
        {p.userId && <span style={badge}>Has account</span>}
        {!p.active && <span style={badge}>Inactive</span>}
        {p.email && <span style={{ color: 'var(--muted)', fontSize: 14 }}>{p.email}</span>}
      </div>
      {staff && (
        <div style={row}>
          {p.active && !p.userId && (
            <ActionForm action={invitePlayer} style={{ ...row, flex: '1 1 100%' }}>
              <input type="hidden" name="id" value={p.id} />
              <button style={small}>Invite</button>
            </ActionForm>
          )}
          <details style={{ flex: '1 1 100%' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--link)' }}>Edit</summary>
            <ActionForm action={updatePlayer} style={{ ...row, marginTop: 8 }}>
              <input type="hidden" name="id" value={p.id} />
              <PlayerFields mixed={mixed} p={p} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14 }}>
                <input type="checkbox" name="active" defaultChecked={p.active} /> Active
              </label>
              <button style={small}>Save</button>
            </ActionForm>
            <ActionForm action={removePlayer} style={{ ...row, marginTop: 8 }}>
              <input type="hidden" name="id" value={p.id} />
              <button style={small}>Delete player</button>
            </ActionForm>
          </details>
        </div>
      )}
    </div>
  );
}

function RoleSelect({ roles, value }: { roles: readonly Role[]; value: Role }) {
  return (
    <select name="role" defaultValue={value} aria-label="Role" style={field}>
      {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
    </select>
  );
}

function MemberRow({
  m, teamId, me, staff, actor, grantable,
}: {
  m: { userId: string; email: string | null; name: string | null; role: Role };
  teamId: string; me: string; staff: boolean; actor: Role; grantable: Role[];
}) {
  const self = m.userId === me;
  // Coaches can't change owners; the API returns 403 anyway, so don't offer it.
  const editable = staff && !self && (m.role !== 'owner' || actor === 'owner');
  return (
    <div style={{ ...row, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
      <span style={{ flex: '1 1 200px' }}>
        <span style={{ fontWeight: 700 }}>{m.name ?? m.email ?? 'Team member'}</span>
        {self && ' (you)'}
        {m.email && m.name && <span style={{ display: 'block', color: 'var(--muted)', fontSize: 14 }}>{m.email}</span>}
      </span>
      {editable ? (
        <ActionForm action={setMemberRole} style={row}>
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="userId" value={m.userId} />
          <RoleSelect roles={grantable} value={m.role} />
          <button style={small}>Change role</button>
        </ActionForm>
      ) : (
        <span style={badge}>{ROLE_LABEL[m.role]}</span>
      )}
      {(editable || self) && (
        <ActionForm action={removeMember} style={row}>
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="userId" value={m.userId} />
          <button style={small}>{self ? 'Leave team' : 'Remove'}</button>
        </ActionForm>
      )}
    </div>
  );
}
