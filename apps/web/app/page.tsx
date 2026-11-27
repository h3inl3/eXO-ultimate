import { HERO_ORANGE, ON_ORANGE, SAMPLE } from '@exo/shared';
import { session } from '../lib/session';
import { NewTeam } from './new-team';

// Team home (docs/design/WebDashboard.dc.html). Game data stays SAMPLE until seasons and games land (Phase 2-3).
const CHIP = {
  live: { background: 'var(--orange)', color: ON_ORANGE },
  win: { background: 'var(--chipGreen)', color: 'var(--text)' },
  loss: { background: 'var(--surface2)', color: 'var(--text)' },
};
const card = { borderRadius: 20, background: 'var(--surface)', border: '1px solid var(--line)' };
const chip = { padding: '4px 10px', borderRadius: 999, fontSize: 13, fontWeight: 700 };
const btn = {
  height: 48,
  padding: '0 18px',
  borderRadius: 12,
  font: '600 15px var(--font-ui), sans-serif',
};

export default async function Home() {
  const s = await session();
  if (!s) return <SignedOut />;
  if (!s.team) return <NewTeam first />;
  const { live, schedule, leaders } = SAMPLE;
  return (
    <div
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'end',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>
            Spring League · Week 4
          </p>
          <h1 style={{ margin: '4px 0 0', fontSize: 36, fontWeight: 700, letterSpacing: -0.5 }}>
            {s.team.name}
          </h1>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <a
            href="/roster"
            style={{
              ...btn,
              display: 'flex',
              alignItems: 'center',
              border: '1.5px solid var(--line)',
              background: 'var(--surface)',
              color: 'var(--text)',
              textDecoration: 'none',
            }}
          >
            Roster
          </a>
          <button
            style={{
              ...btn,
              border: 0,
              background: 'var(--orange)',
              color: ON_ORANGE,
              fontWeight: 700,
            }}
          >
            New game
          </button>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 20,
        }}
      >
        <div
          style={{
            borderRadius: 20,
            padding: 24,
            background: 'var(--hero)',
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Live · {live.meta}</span>
            <span style={{ ...chip, fontSize: 12, background: HERO_ORANGE, color: ON_ORANGE }}>
              LIVE
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
            <Score name={s.team.name} value={live.us} />
            <div style={{ fontSize: 14, textAlign: 'center' }}>
              Pt {live.point}
              <br />
              {live.side}
            </div>
            <Score name={live.opp} value={live.them} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a
              href="#"
              style={{
                ...btn,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: HERO_ORANGE,
                color: ON_ORANGE,
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Watch live
            </a>
            <a
              href="#"
              style={{
                ...btn,
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.16)',
                color: '#FFFFFF',
                textDecoration: 'none',
              }}
            >
              Box score
            </a>
          </div>
        </div>

        <div style={{ ...card, padding: '20px 4px 8px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              padding: '0 20px 8px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>Schedule</h2>
            <a href="#" style={{ fontSize: 14, fontWeight: 600 }}>
              See all
            </a>
          </div>
          {schedule.map((g, i) => (
            <div
              key={g.opp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 20px',
                borderTop: i ? '1px solid var(--line)' : 0,
              }}
            >
              <div style={{ width: 44, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>{g.day}</div>
                <div className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                  {g.date}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>vs {g.opp}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{g.meta}</div>
              </div>
              <span style={{ ...chip, ...CHIP[g.kind] }}>{g.result}</span>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
        }}
      >
        {leaders.map((b) => (
          <div
            key={b.title}
            style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <h2
              style={{
                margin: 0,
                fontFamily: 'inherit',
                fontSize: 13,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              {b.title}
            </h2>
            {b.rows.map(([num, name, val, fmp]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  className="num"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: fmp ? 'var(--chipGreen)' : 'var(--chipBlue)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {num}
                </span>
                <span style={{ flex: 1, fontWeight: 600 }}>{name}</span>
                <span className="num" style={{ fontSize: 20, fontWeight: 700 }}>
                  {val}
                </span>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function Score({ name, value }: { name: string; value: number }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{name}</div>
      <div className="num" style={{ fontSize: 64, fontWeight: 700, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div style={{ maxWidth: 560, margin: '10vh auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 36 }}>Run your ultimate team</h1>
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: 17 }}>
        Rosters, seasons, live stats and a playbook, for coaches and players.
      </p>
      <a
        href="/auth/login"
        style={{ ...btn, alignSelf: 'start', display: 'flex', alignItems: 'center', background: 'var(--orange)', color: ON_ORANGE, fontWeight: 700, textDecoration: 'none' }}
      >
        Sign in or create an account
      </a>
    </div>
  );
}
