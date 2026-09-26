import { Inter, Source_Serif_4 } from 'next/font/google';
import { LandingNav } from '../src/landing-nav';
import { LandingProductWindow } from '../src/landing-product-window';
import type { CSSProperties } from 'react';
import { CopyCommand } from '../src/copy-command';
import { LandingMotion } from '../src/landing-motion';
import { LockCollisionDemo } from '../src/lock-collision-demo';
import { SITE } from '../src/site';
import { TypeTitle } from '../src/type-title';
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
  { value: metrics.nearMisses, label: 'near-miss caught by a hook' },
  { value: metrics.decisions, label: 'decisions, each shown to a human' },
  { value: metrics.mergeConflicts, label: 'merge conflicts' },
  { value: metrics.medianDecisionSeconds, suffix: ' s', label: 'median time to a decision' },
];

/** Stagger index for `[data-reveal]` (CSS reads `--i`). */
const stagger = (i: number) => ({ '--i': i }) as CSSProperties;
/** Decimals shown by the count-up, taken from the real value (2.9 → 1). */
const decimalsOf = (n: number) => (Number.isInteger(n) ? 0 : String(n).split('.')[1]!.length);

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
  {
    word: 'Locked',
    body: 'A file has one holder. Others queue or switch files, never merge by accident.',
  },
  {
    word: 'Human-approved',
    body: 'Agents suggest. A person approves the plan before work starts.',
  },
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
  {
    kind: 'mode',
    icon: '◐',
    name: 'coder · pm-lead',
    body: 'Two custom modes. coder edits and runs; pm-lead only reads and proposes.',
  },
  {
    kind: 'hook',
    icon: '⚓',
    name: '5 hooks',
    body: 'SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop. Locks and briefs run here.',
  },
  {
    kind: 'mcp',
    icon: '⧉',
    name: 'radar-mcp',
    body: 'MCP tools such as radar.why_blocked, so a Bob can read team state and explain itself.',
  },
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

      <LandingNav
        title={SITE.title}
        demoPath={SITE.demoPath}
        bobSessionsUrl={links.bobSessions}
        repoUrl={links.repoUrl}
        downloadUrl={downloadUrl}
      />

      <main id="main">
        {/* Hero: title and CTAs on top; the lock-collision demo sits underneath as the proof. */}
        <section className="lp-stage">
          {/* Halftone crew backdrop — parked for now, the demo carries the hero.
          <div className="lp-halftone" aria-hidden="true" /> */}
          <div className="lp-hero">
            {/* First screen is text only; the demo scrolls in below the fold. */}
            <div className="lp-hero-intro">
              <TypeTitle className="lp-h1" lines={["Your team's Bobs,", 'working together']} />
              <p className="lp-sub">
                One live workspace for every teammate&apos;s IBM Bob. Shared locks, a queue, and a
                PM who approves before anything risky lands.
              </p>
              <div className="lp-hero-ctas">
                <a href={SITE.demoPath} className="lp-btn lp-btn-primary">
                  Watch the live replay
                </a>
                <ExternalLink href={downloadUrl} className="lp-btn lp-btn-outline">
                  Download for macOS
                </ExternalLink>
              </div>
              <p className="lp-hero-note">
                Replay runs in your browser, no login · macOS build is arm64, unsigned
              </p>
            </div>
            <div className="lp-hero-demo lp-reveal">
              <div className="lp-demo-halftone" aria-hidden="true" />
              <LockCollisionDemo />
            </div>
          </div>
        </section>

        {/* 18a-1..3: product window */}
        <section className="lp-wrap lp-product" aria-labelledby="lp-see">
          <p className="lp-kicker lp-kicker-center" data-reveal style={stagger(0)}>
            Live Collab
          </p>
          <h2 id="lp-see" className="lp-h2 lp-h2-center" data-reveal style={stagger(1)}>
            Three people, three Bobs, one repo
          </h2>
          <p className="lp-lede" data-reveal style={stagger(2)}>
            Each teammate keeps their own Bob. Live Collab shares locks, tasks and hook traces, and
            asks a human before anything risky lands.
          </p>
          <div data-reveal style={stagger(3)}>
            <LandingProductWindow demoPath={SITE.demoPath} />
          </div>
          <dl className="lp-stats">
            {STATS.map((s, i) => (
              <div key={s.label} className="lp-stat" data-reveal style={stagger(i)}>
                <dt>{s.label}</dt>
                <dd
                  data-count={s.value}
                  data-decimals={decimalsOf(s.value)}
                  data-suffix={s.suffix ?? ''}
                >
                  {s.value}
                  {s.suffix ?? ''}
                </dd>
              </div>
            ))}
          </dl>
          <p className="lp-stats-note">From the recorded toko-demo session shown in the replay.</p>
        </section>

        {/* 18a-4: four mechanisms */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-how">
          <p className="lp-kicker" data-reveal>
            How it works
          </p>
          <h2 id="lp-how" className="lp-h2" data-reveal style={stagger(1)}>
            How three Bobs share one repo
          </h2>
          <ol className="lp-mechanisms">
            {MECHANISMS.map((m, i) => (
              <li key={m.tag} className="lp-mechanism" data-reveal style={stagger(i)}>
                <div className="lp-card-top">
                  <span className="lp-badge" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <code className="lp-chip">{m.tag}</code>
                </div>
                <h3>{m.title}</h3>
                <p>{m.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 18a-4: three words */}
        <section className="lp-wrap lp-words" aria-label="Principles">
          {WORDS.map((w, i) => (
            <div key={w.word} className="lp-word" data-reveal style={stagger(i)}>
              <h3>{w.word}</h3>
              <p>{w.body}</p>
            </div>
          ))}
        </section>

        {/* Near-miss accent block. TODO(sync:imelda): add the near-miss GIF after the fase 10 recording. */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-nearmiss">
          <div className="lp-nm">
            <div className="lp-nm-copy" data-reveal>
              <p className="lp-kicker">Near-miss</p>
              <h2 id="lp-nearmiss" className="lp-h2">
                Catch the near-miss before it merges.
              </h2>
              <p className="lp-nm-lede">
                Two Bobs reach for the same file. The hook stops the second one, the Bob says why,
                and its human keeps working on something else.
              </p>
              <div className="lp-nm-point">
                <span className="lp-badge" aria-hidden="true">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
                    <rect
                      x="3"
                      y="7"
                      width="10"
                      height="7"
                      rx="1.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </span>
                <div>
                  <p className="lp-nm-point-title">Blocked, then queued</p>
                  <p className="lp-nm-point-body">
                    lock_guard stops the write before it lands. Budi&apos;s Bob waits at position 1
                    and moves on to Header.tsx.
                  </p>
                </div>
              </div>
              <a href={SITE.demoPath} className="lp-text-link lp-nm-link">
                See it in the replay →
              </a>
            </div>
            <div data-reveal style={stagger(2)}>
              <div className="lp-nm-stage">
                <ol className="lp-log" aria-label="Near-miss event log">
                  {NEAR_MISS_LOG.map((line, i) => (
                    <li key={i} data-tone={line.tone}>
                      <span className="lp-log-who">{line.who}</span>
                      <span className="lp-log-what">{line.what}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        {/* Primitives: three Bob building blocks, same glyphs as BobTrace. */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-primitives">
          <div className="lp-prim-head" data-reveal>
            <div>
              <p className="lp-kicker">IBM Bob</p>
              <h2 id="lp-primitives" className="lp-h2">
                Built on IBM Bob primitives
              </h2>
            </div>
            <ExternalLink href={links.bobSessions} className="lp-text-link lp-prim-link">
              Browse the bob_sessions/ evidence →
            </ExternalLink>
          </div>
          <ul className="lp-primitives">
            {PRIMITIVES.map((p, i) => (
              <li key={p.name} className="lp-prim" data-reveal style={stagger(i + 1)}>
                <div className="lp-card-top">
                  <span className="lp-badge" aria-hidden="true">
                    {p.icon}
                  </span>
                  <span className="lp-chip">{p.kind}</span>
                </div>
                <code>{p.name}</code>
                <p>{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Install: pitch + download left, numbered stepper right. */}
        <section className="lp-wrap lp-section" aria-labelledby="lp-install">
          <div className="lp-install">
            <div className="lp-install-copy" data-reveal>
              <p className="lp-kicker">Get started</p>
              <h2 id="lp-install" className="lp-h2">
                Install in three steps
              </h2>
              <p className="lp-install-lede">
                Grab the <code>.dmg</code>, let macOS open it, then join your team from Bob IDE.
              </p>
              <div className="lp-install-ctas">
                <ExternalLink href={downloadUrl} className="lp-btn lp-btn-primary">
                  Download .dmg
                </ExternalLink>
                <a href={SITE.demoPath} className="lp-text-link lp-install-alt">
                  Watch the replay first →
                </a>
              </div>
            </div>
            <ol className="lp-steps" data-reveal data-steps>
              <li className="lp-step" style={stagger(0)}>
                <span className="lp-badge lp-step-num" aria-hidden="true">
                  1
                </span>
                <div className="lp-step-body">
                  <p className="lp-step-title">Download</p>
                  <p>
                    The latest <code>.dmg</code> from{' '}
                    <ExternalLink href={downloadUrl} className="lp-text-link">
                      GitHub Releases
                    </ExternalLink>
                    .
                  </p>
                </div>
              </li>
              <li className="lp-step" style={stagger(1)}>
                <span className="lp-badge lp-step-num" aria-hidden="true">
                  2
                </span>
                <div className="lp-step-body">
                  <p className="lp-step-title">Allow the unsigned app</p>
                  <p>System Settings → Privacy &amp; Security → Open Anyway, or run:</p>
                  <CopyCommand
                    command={
                      'xattr -dr com.apple.quarantine "/Applications/IBM Bob Live Collab.app"'
                    }
                  />
                </div>
              </li>
              <li className="lp-step" style={stagger(2)}>
                <span className="lp-badge lp-step-num" aria-hidden="true">
                  3
                </span>
                <div className="lp-step-body">
                  <p className="lp-step-title">Join your team</p>
                  <p>
                    Paste the invite, choose the folder, then open it in Bob IDE and trust the
                    workspace.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </section>
      </main>
      <LandingMotion />

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
