import { DEFAULT_RULES, DIVISIONS } from '@exo/shared';

// Placeholder home. Phase 1 replaces this with sign-in + the team switcher.
export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: 16 }}>
      <h1>eXO Ultimate</h1>
      <p>Roster · Seasons · Games · Playbook</p>
      <p style={{ color: '#666' }}>
        Shared package wired up: divisions {DIVISIONS.join(' / ')}, default game to {DEFAULT_RULES.gameTo}.
      </p>
    </main>
  );
}
