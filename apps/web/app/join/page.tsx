import { api } from '../../lib/session';
import { JoinInvite } from '../ui';

// Invite links look like /join#CODE. The fragment never reaches a server, so codes stay out of logs.
export default async function Join() {
  return (
    <div style={{ maxWidth: 560, margin: '10vh auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 32 }}>Join your team</h1>
      <JoinInvite signedIn={Boolean(await api())} />
    </div>
  );
}
