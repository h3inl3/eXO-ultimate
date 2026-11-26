import type { ReactNode } from 'react';

export const metadata = { title: 'eXO Ultimate', description: 'Team, season, game and playbook manager for ultimate frisbee' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>{children}</body>
    </html>
  );
}
