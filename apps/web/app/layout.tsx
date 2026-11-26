import type { ReactNode } from 'react';
import { Inter, Space_Grotesk } from 'next/font/google';
import { NAV, SAMPLE, THEMES, type Theme } from '@exo/shared';

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

export default function RootLayout({ children }: { children: ReactNode }) {
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
            <button
              aria-label="Switch team"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 52,
                padding: '8px 12px',
                borderRadius: 14,
                border: '1px solid var(--line)',
                background: 'var(--bg)',
                color: 'var(--text)',
                font: 'inherit',
                textAlign: 'left',
              }}
            >
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontWeight: 700 }}>{SAMPLE.team.name}</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>
                  {SAMPLE.team.meta}
                </span>
              </span>
              <Icon d="M6 9l6 6 6-6" size={18} />
            </button>
            <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {NAV.map((label) => {
                // shortcut: only Home exists, so it is always the current page; use usePathname once other pages land.
                const current = label === 'Home';
                return (
                  <a
                    key={label}
                    href={current ? '/' : '#'}
                    aria-current={current ? 'page' : undefined}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 44,
                      padding: '0 12px',
                      borderRadius: 12,
                      background: current ? 'var(--chipBlue)' : 'transparent',
                      color: current ? 'var(--text)' : 'var(--muted)',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    <Icon d={ICONS[label]} size={22} />
                    {label}
                  </a>
                );
              })}
            </nav>
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
