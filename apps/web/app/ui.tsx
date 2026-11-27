'use client';
import { useActionState, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { acceptInvite, switchTeam, type Result } from './actions';
import { btn, field } from './styles';

/** A form bound to a server action; shows the action's error, message or link below it. */
export function ActionForm({
  action, children, style,
}: { action: (prev: Result, f: FormData) => Promise<Result>; children: ReactNode; style?: CSSProperties }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} style={style}>
      <fieldset disabled={pending} style={{ all: 'unset', display: 'contents' }}>
        {children}
      </fieldset>
      {state?.error && <p role="alert" style={{ margin: 0, fontWeight: 700, flexBasis: '100%' }}>Error: {state.error}</p>}
      {state?.message && <p role="status" style={{ margin: 0, color: 'var(--muted)', flexBasis: '100%' }}>{state.message}</p>}
      {state?.link && <CopyLink url={state.link} />}
    </form>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span style={{ display: 'flex', gap: 8, flexBasis: '100%', alignItems: 'center' }}>
      <input readOnly value={url} aria-label="Invite link" style={{ ...field, flex: 1 }} onFocus={(e) => e.currentTarget.select()} />
      <button type="button" style={btn} onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}

export function TeamSwitcher({ teams, current }: { teams: Array<{ id: string; name: string }>; current: string }) {
  return (
    <form action={switchTeam}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
        Team
        <select
          name="teamId"
          defaultValue={current}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          style={{ ...field, fontWeight: 700, color: 'var(--text)' }}
        >
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
    </form>
  );
}

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const current = usePathname() === href;
  return (
    <a
      href={href}
      aria-current={current ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, padding: '0 12px', borderRadius: 12,
        background: current ? 'var(--chipBlue)' : 'transparent',
        color: current ? 'var(--text)' : 'var(--muted)',
        fontWeight: 600, textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}

const PENDING = 'exo_invite';

/** Reads the invite code from the URL fragment and accepts it, surviving the sign-in round trip. */
export function JoinInvite({ signedIn }: { signedIn: boolean }) {
  const [state, setState] = useState<Result | 'working'>('working');
  useEffect(() => {
    const code = location.hash.slice(1) || sessionStorage.getItem(PENDING);
    if (!code) return setState({ error: 'This invite link is incomplete. Ask your coach for a new one.' });
    if (!signedIn) {
      sessionStorage.setItem(PENDING, code); // the fragment is lost on the way through sign-in
      location.assign('/auth/login?returnTo=/join');
      return;
    }
    sessionStorage.removeItem(PENDING);
    history.replaceState(null, '', '/join');
    acceptInvite(code).then(setState);
  }, [signedIn]);
  if (state === 'working') return <p>Joining…</p>;
  if (state?.error) return <p role="alert">{state.error}</p>;
  return (
    <p>
      {state?.message} <a href="/roster">See the roster</a>
    </p>
  );
}
