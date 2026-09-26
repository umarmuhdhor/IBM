import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './demo.css';

// DESIGN §5.11: Inter is the landing font, Plex stays on the replay. Self-hosted at build time, so the
// static export still makes no request to another origin (e2e "never calls out to another origin").
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export default function DemoLayout({ children }: { children: ReactNode }) {
  return <div className={`rp ${plexSans.variable} ${plexMono.variable}`}>{children}</div>;
}
