import { DIVISIONS, ON_ORANGE } from '@exo/shared';
import { createTeam } from './actions';
import { ActionForm } from './ui';
import { btn, field } from './styles';

export function NewTeam({ first }: { first?: boolean }) {
  return (
    <div style={{ borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--line)', maxWidth: 560, margin: '8vh auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>{first ? 'Create your first team' : 'New team'}</h1>
      {first && (
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Joining a team as a player? Open the invite link your coach sent you instead.
        </p>
      )}
      <ActionForm action={createTeam} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <input name="name" required maxLength={80} placeholder="Team name" aria-label="Team name" style={{ ...field, flex: '1 1 220px' }} />
        <select name="division" aria-label="Division" defaultValue="mixed" style={field}>
          {DIVISIONS.map((d) => <option key={d} value={d}>{d[0]!.toUpperCase() + d.slice(1)}</option>)}
        </select>
        <button style={{ ...btn, border: 0, background: 'var(--orange)', color: ON_ORANGE, fontWeight: 700 }}>Create team</button>
      </ActionForm>
    </div>
  );
}
