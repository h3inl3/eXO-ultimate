import type { ReactNode } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import { NAV, THEMES, type Theme } from '@exo/shared';
import { session } from '../lib/session';
import { NavLink, TeamSwitcher } from './ui';
import { btn } from './styles';

export const metadata = {
  title: 'eXO Ultimate',
  description: 'Team, season, game and playbook manager for ultimate frisbee',
};

const inter = Inter({ subsets: ['latin'], variable: '--font-ui' });
const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

// Tokens become CSS variables (--bg, --text, ...), so dark mode follows the OS with no JS.
const vars = (t: Theme) =>
  Object.entries(t)
    .map(([k, v]) => `--${k}:${Array.isArray(v) ? `linear-gradient(135deg,${v[0]},${v[1]})` : v};`)
    .join('');
const css = `
:root{${vars(THEMES.light)}}
@media (prefers-color-scheme: dark){:root{${vars(THEMES.dark)}}}
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--font-ui),system-ui,sans-serif}
a{color:var(--link)}
h1,h2,.num{font-family:var(--font-display),sans-serif}
`;

const ICONS: Record<(typeof NAV)[number], string> = {
  Home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  Roster:
    'M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-3-3M4 19v-1a3 3 0 0 1 3-3',
  Games: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10',
  Playbook: 'M4 4h16v16H4zM8 9l3 3M11 9l-3 3M14 15h3M15 8c2 1 2 4 0 6',
  Stats: 'M5 20V10M12 20V4M19 20v-7',
};

// shortcut: Games, Playbook and Stats pages don't exist yet; add them here as they land.
const HREF: Partial<Record<(typeof NAV)[number], string>> = { Home: '/', Roster: '/roster' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await session();
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <head>
        <style>{css}</style>
      </head>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexWrap: 'wrap' }}>
          <aside
            style={{
              flex: '1 1 240px',
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: '24px 16px',
              background: 'var(--surface)',
              borderRight: '1px solid var(--line)',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
              <span
                className="num"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: 'var(--blue)',
                  color: 'var(--onBlue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                eXO
              </span>
              <span className="num" style={{ fontWeight: 700, fontSize: 20 }}>
                eXO Ultimate
              </span>
            </div>
            {s?.team ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <TeamSwitcher teams={s.teams} current={s.team.id} />
                <a href="/teams/new" style={{ fontSize: 14, fontWeight: 600, padding: '0 4px' }}>+ New team</a>
              </div>
            ) : null}
            <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {NAV.map((label) => (
                <NavLink key={label} href={HREF[label] ?? '#'}>
                  <Icon d={ICONS[label]} size={22} />
                  {label}
                </NavLink>
              ))}
            </nav>
            <div style={{ marginTop: 'auto', padding: '0 8px', fontSize: 14, color: 'var(--muted)' }}>
              {s ? (
                <form action="/auth/logout" method="post" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span>{s.me.name ?? s.me.email}</span>
                  <button style={btn}>Sign out</button>
                </form>
              ) : (
                <a href="/auth/login" style={{ ...btn, display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                  Sign in
                </a>
              )}
            </div>
          </aside>
          <main
            style={{
              flex: '999 1 560px',
              minWidth: 0,
              boxSizing: 'border-box',
              padding: '32px clamp(16px, 4vw, 48px) 48px',
            }}
          >
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function Icon({ d, size }: { d: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
