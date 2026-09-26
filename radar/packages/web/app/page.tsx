import { Inter, Source_Serif_4 } from 'next/font/google';
import { LandingProductWindow } from '../src/landing-product-window';
import { SITE } from '../src/site';
import metaRaw from '../public/demo/meta.json';

// Self-hosted fonts: downloaded at build time, so the static export makes no runtime font request.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-source-serif-4',
  display: 'swap',
});

interface SiteLinks {
  repoUrl: string;
  bobSessions: string;
  video: string | null;
  deck: string | null;
}

const links = metaRaw.links as SiteLinks;
const metrics = metaRaw.metrics;
// TODO(sync:aarief): point at the real .dmg asset once fase 11b publishes Release v0.3.0.
const downloadUrl = `${links.repoUrl}/releases`;

// Numbers come only from public/demo/meta.json (DESIGN §0: never ship invented numbers).
const STATS = [
  { value: String(metrics.nearMisses), label: 'near-miss caught by a hook' },
  { value: String(metrics.decisions), label: 'decisions, each shown to a human' },
  { value: String(metrics.mergeConflicts), label: 'merge conflicts' },
  { value: `${metrics.medianDecisionSeconds} s`, label: 'median time to a decision' },
];

const MECHANISMS = [
  {
    tag: 'lock_guard',
    title: 'One file, one Bob',
    body: 'A PreToolUse hook checks the shared lock table before any write. Andi holds checkout.ts, so no other Bob can overwrite it.',
  },
  {
    tag: 'radar.why_blocked',
    title: 'A near-miss explains itself',
    body: 'The blocked Bob calls an MCP tool and tells its human, in one sentence, who holds the file and what to do next.',
  },
  {
    tag: 'pm-lead',
    title: 'PM Bob proposes, a human decides',
    body: 'The pm-lead mode can only read and propose. Plans and conflicts land in Needs you, where a person clicks Approve or Deny.',
  },
  {
    tag: 'radar-mcp',
    title: 'Every teammate keeps their own Bob',
    body: 'Each person runs IBM Bob on their own machine. Live Collab syncs locks, tasks and hook traces between them in real time.',
  },
];

const WORDS = [
  { word: 'Visible', body: 'Every Bob shows its owner, file and last hook on one screen.' },
  { word: 'Locked', body: 'A file has one holder. Others queue or switch files, never merge by accident.' },
  { word: 'Human-approved', body: 'Agents suggest. A person approves the plan before work starts.' },
];

// Mirrors the near-miss in public/demo/events.json (ids 50–58).
const NEAR_MISS_LOG = [
  { who: 'budi · coder', what: 'apply_diff src/checkout/checkout.ts', tone: 'b' },
  { who: 'hook', what: 'PreToolUse · lock_guard → blocked', tone: 'danger' },
  { who: 'held by', what: 'andi · T-1 coupon', tone: 'a' },
  { who: 'mcp', what: 'radar.why_blocked → "held by Andi for T-1"', tone: 'muted' },
  { who: 'decision', what: 'queued · position 1', tone: 'muted' },
  { who: 'budi · coder', what: 'continues src/ui/Header.tsx', tone: 'b' },
] as const;

const PRIMITIVES = [
  { name: 'coder · pm-lead', body: 'Two custom modes. coder edits and runs; pm-lead only reads and proposes.' },
  { name: '5 hooks', body: 'SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop. Locks and briefs run here.' },
  { name: 'radar-mcp', body: 'MCP tools such as radar.why_blocked, so a Bob can read team state and explain itself.' },
];

function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export default function HomePage() {
  return (
    <div className={`${inter.variable} ${sourceSerif4.variable} lp`}>
      <a href="#main" className="lp-skip">
        Skip to content
      </a>

      <header className="lp-nav">
        <a href="/" className="lp-wordmark">
          <span className="lp-wordmark-dot" aria-hidden="true" />
          {SITE.title}
        </a>
        <nav aria-label="Primary" className="lp-nav-links">
          <ExternalLink href={links.repoUrl} className="lp-nav-link lp-hide-sm">
            Repo
          </ExternalLink>
          <ExternalLink href={links.bobSessions} className="lp-nav-link lp-hide-sm">
            bob_sessions
          </ExternalLink>
          {links.video !== null && (
            <ExternalLink href={links.video} className="lp-nav-link lp-hide-sm">
              Video
            </ExternalLink>
          )}
          {links.deck !== null && (
            <ExternalLink href={links.deck} className="lp-nav-link lp-hide-sm">
              Deck
            </ExternalLink>
          )}
          <a href={SITE.demoPath} className="lp-btn lp-btn-primary lp-btn-sm">
            Watch replay
          </a>
        </nav>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="lp-hero lp-wrap">
          <p className="lp-eyebrow">Multiplayer for IBM Bob</p>
          <h1 className="lp-h1">
            Your team&apos;s Bobs, <span className="lp-pill">working</span> together.
          </h1>
          <p className="lp-sub">
            Every teammate keeps their own Bob. Live Collab gives them one shared workspace, one
            lock per file, and a human in the loop before anything risky lands.
          </p>
          <div className="lp-cta-row">
            <a href={SITE.demoPath} className="lp-btn lp-btn-primary">
              Watch the live replay
            </a>
            <ExternalLink href={downloadUrl} className="lp-btn lp-btn-ghost">
              Download for macOS
            </ExternalLink>
          </div>
          <p className="lp-cta-note">
            Replay runs in any browser. The app is macOS arm64 only, unsigned · open via Privacy
            &amp; Security → Open Anyway.
          </p>
        </section>

        {/* 18a-1..3: product window */}
        <section className="lp-wrap lp-product" aria-label="Live Collab product preview">
          <LandingProductWindow demoPath={SITE.demoPath} />
          <dl className="lp-stats">
            {STATS.map((s) => (
              <div key={s.label} className="lp-stat">
                <dt>{s.label}</dt>
                <dd>{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="lp-stats-note">From the recorded toko-demo session shown in the replay.</p>
        </section>

        {/* 18a-4: four mechanisms */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-how">
          <h2 id="lp-how" className="lp-h2">
            How three Bobs share one repo
          </h2>
          <ol className="lp-mechanisms">
            {MECHANISMS.map((m, i) => (
              <li key={m.tag} className="lp-mechanism">
                <span className="lp-mechanism-num" aria-hidden="true">
                  0{i + 1}
                </span>
                <h3>{m.title}</h3>
                <p>{m.body}</p>
                <code>{m.tag}</code>
              </li>
            ))}
          </ol>
        </section>

        {/* 18a-4: three words */}
        <section className="lp-wrap lp-words" aria-label="Principles">
          {WORDS.map((w) => (
            <div key={w.word} className="lp-word">
              <h3>{w.word}</h3>
              <p>{w.body}</p>
            </div>
          ))}
        </section>

        {/* Near-miss accent block. TODO(sync:imelda): add the near-miss GIF after the fase 10 recording. */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-nearmiss">
          <div className="lp-marigold">
            <div className="lp-marigold-copy">
              <h2 id="lp-nearmiss">Catch the near-miss before it merges.</h2>
              <p>
                Two Bobs reach for the same file. The hook stops the second one, the Bob says why,
                and its human keeps working on something else.
              </p>
              <a href={SITE.demoPath} className="lp-marigold-link">
                See it in the replay →
              </a>
            </div>
            <ol className="lp-log" aria-label="Near-miss event log">
              {NEAR_MISS_LOG.map((line, i) => (
                <li key={i} data-tone={line.tone}>
                  <span className="lp-log-who">{line.who}</span>
                  <span className="lp-log-what">{line.what}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Primitives (navy island) */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-primitives">
          <div className="lp-navy">
            <h2 id="lp-primitives" className="lp-h2">
              Built on IBM Bob primitives
            </h2>
            <ul className="lp-primitives">
              {PRIMITIVES.map((p) => (
                <li key={p.name}>
                  <code>{p.name}</code>
                  <p>{p.body}</p>
                </li>
              ))}
            </ul>
            <ExternalLink href={links.bobSessions} className="lp-text-link">
              Browse the bob_sessions/ evidence →
            </ExternalLink>
          </div>
        </section>

        {/* Install */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-install">
          <div className="lp-install">
            <h2 id="lp-install" className="lp-h2">
              Install in three steps
            </h2>
            <ol className="lp-steps">
              <li>
                <strong>Download</strong> the latest <code>.dmg</code> from{' '}
                <ExternalLink href={downloadUrl} className="lp-text-link">
                  GitHub Releases
                </ExternalLink>
                .
              </li>
              <li>
                <strong>Allow the unsigned app</strong> in System Settings → Privacy &amp; Security
                → Open Anyway, or run:
                <pre className="lp-cmd">
                  <code>xattr -dr com.apple.quarantine &quot;/Applications/IBM Bob Live Collab.app&quot;</code>
                </pre>
              </li>
              <li>
                <strong>Join your team</strong>: paste the invite, choose the folder, then open it
                in Bob IDE and trust the workspace.
              </li>
            </ol>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <p>{SITE.disclaimer} · built on Orca (MIT)</p>
          <nav aria-label="Footer" className="lp-footer-links">
            <ExternalLink href={links.repoUrl} className="lp-nav-link">
              GitHub repo
            </ExternalLink>
            <ExternalLink href={links.bobSessions} className="lp-nav-link">
              bob_sessions
            </ExternalLink>
            {links.video !== null && (
              <ExternalLink href={links.video} className="lp-nav-link">
                Demo video
              </ExternalLink>
            )}
            {links.deck !== null && (
              <ExternalLink href={links.deck} className="lp-nav-link">
                Slide deck
              </ExternalLink>
            )}
          </nav>
        </div>
      </footer>
    </div>
  );
}
