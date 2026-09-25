import Link from 'next/link';
import { SITE } from '../src/site';

// Temporary home. The landing page is built in fase 11 (D).
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{SITE.title}</h1>
      <p className="mt-2 text-sm">Status: in development. {SITE.disclaimer}</p>
      <Link className="mt-4 inline-block underline" href={SITE.demoPath}>
        Replay
      </Link>
    </main>
  );
}
