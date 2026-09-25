import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SITE } from '../src/site';
import './globals.css';

export const metadata: Metadata = {
  title: SITE.title,
  description: SITE.disclaimer,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
