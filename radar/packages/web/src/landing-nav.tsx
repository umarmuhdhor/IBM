'use client';

import { useEffect, useState } from 'react';

// Full-width bar at the top of the page; morphs into a floating pill once the page scrolls.
export function LandingNav({
  title,
  demoPath,
  bobSessionsUrl,
  repoUrl,
  downloadUrl,
}: {
  title: string;
  demoPath: string;
  bobSessionsUrl: string;
  repoUrl: string;
  downloadUrl: string;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="lp-nav" data-scrolled={scrolled}>
      <a href="/" className="lp-wordmark">
        {/* Plain <img>: static export has no image optimizer. */}
        <img src="/brand/bob-crew.png" alt="" width={28} height={28} />
        {title}
      </a>
      <nav aria-label="Primary" className="lp-nav-links">
        <a href={demoPath} className="lp-nav-link lp-hide-sm">
          Replay
        </a>
        <a href={bobSessionsUrl} className="lp-nav-link lp-hide-sm" target="_blank" rel="noopener noreferrer">
          bob_sessions
        </a>
        <a href={repoUrl} className="lp-nav-link lp-hide-sm" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        <a
          href={downloadUrl}
          className="lp-btn lp-btn-outline lp-btn-sm"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download
        </a>
      </nav>
    </header>
  );
}
