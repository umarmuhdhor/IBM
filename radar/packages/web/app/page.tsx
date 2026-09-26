import { Inter, Source_Serif_4 } from 'next/font/google';
import { SITE } from '../src/site';
import metaRaw from '../public/demo/meta.json';

// ── Self-hosted fonts (static export safe – downloaded at build, no runtime network call) ──
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-source-serif-4',
  display: 'swap',
});

// ── Type the links shape ──
interface SiteLinks {
  repoUrl: string;
  bobSessions: string;
  video: string | null;
  deck: string | null;
}

const links = metaRaw.links as SiteLinks;

export default function HomePage() {
  const fontClasses = `${inter.variable} ${sourceSerif4.variable}`;

  return (
    <div
      className={fontClasses}
      style={{
        fontFamily: 'var(--font-inter), system-ui, sans-serif',
        background: '#f6f5f4',
        minHeight: '100vh',
        color: '#000',
      }}
    >
      {/* ─── TOP NAV ─────────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          height: 64,
          background: 'rgba(246,245,244,0.92)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' }}>
          {SITE.title}
        </span>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 13.5 }}>
          <a
            href={links.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#615d59', textDecoration: 'none' }}
            className="lp-nav-link"
          >
            Repo
          </a>
          <a
            href={links.bobSessions}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#615d59', textDecoration: 'none' }}
            className="lp-nav-link"
          >
            bob_sessions
          </a>
          {/* Video and Deck hidden when null */}
          {links.video !== null && (
            <a
              href={links.video}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#615d59', textDecoration: 'none' }}
              className="lp-nav-link"
            >
              Video
            </a>
          )}
          {links.deck !== null && (
            <a
              href={links.deck}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#615d59', textDecoration: 'none' }}
              className="lp-nav-link"
            >
              Deck
            </a>
          )}
          <a
            href={SITE.demoPath}
            style={{
              background: '#0075de',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 500,
              fontSize: 13.5,
              transition: 'opacity 200ms ease',
            }}
            className="lp-cta-primary"
          >
            Watch replay
          </a>
        </nav>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* ─── HERO ──────────────────────────────────────────────────────────── */}
        <section
          style={{
            paddingTop: 96,
            paddingBottom: 80,
            textAlign: 'center',
          }}
        >
          {/* Headline ~72px */}
          <h1
            style={{
              fontSize: 'clamp(48px, 7.5vw, 72px)',
              fontWeight: 700,
              lineHeight: 1.21,
              letterSpacing: '-0.03em',
              color: '#000',
              margin: 0,
            }}
          >
            Your team&apos;s Bobs,{' '}
            {/* Highlight pill – marigold accent */}
            <span
              style={{
                background: '#ffb110',
                borderRadius: 9999,
                padding: '0 14px 2px',
                display: 'inline-block',
                lineHeight: 1.28,
              }}
            >
              working
            </span>{' '}
            together.
          </h1>

          {/* Source Serif 4 subhead */}
          <p
            style={{
              fontFamily: 'var(--font-source-serif-4), Georgia, serif',
              fontSize: 'clamp(18px, 2.2vw, 22px)',
              fontWeight: 400,
              color: '#615d59',
              marginTop: 24,
              marginBottom: 0,
              lineHeight: 1.55,
              maxWidth: 560,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            IBM Bob Live Collab keeps every developer&apos;s AI agent in sync—one file,
            one Bob, no surprises.
          </p>

          {/* CTA row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'center',
              marginTop: 40,
              alignItems: 'flex-start',
            }}
          >
            {/* Primary CTA – blue solid */}
            <a
              href={SITE.demoPath}
              style={{
                background: '#0075de',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: 15,
                transition: 'opacity 200ms ease',
              }}
              className="lp-cta-primary"
            >
              Watch the live replay
            </a>

            {/* Ghost CTA – download */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <a
                href={`${links.repoUrl}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#e6f3fe',
                  color: '#0075de',
                  padding: '12px 24px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: 15,
                  transition: 'opacity 200ms ease',
                }}
                className="lp-cta-ghost"
              >
                {/* TODO(sync:aarief): ganti ke URL .dmg asli setelah fase 11b Release v0.3.0 */}
                Download for macOS
              </a>
              <span style={{ fontSize: 11.5, color: '#9b9390', textAlign: 'center' }}>
                macOS arm64 only, unsigned · open via Privacy &amp; Security → Open Anyway
              </span>
            </div>
          </div>
        </section>

        {/* ─── FEATURE CARDS ─────────────────────────────────────────────────── */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
            marginBottom: 80,
          }}
        >
          {/* Card 1 */}
          <div style={cardStyle}>
            <div style={cardIconStyle} aria-hidden="true">⚡</div>
            <h3 style={cardTitleStyle}>Live sync</h3>
            <p style={cardBodyStyle}>
              Every CLAUDE.md edit, hook trigger, and Bob decision is broadcast to the team
              in real time via IBM Bob MCP primitives.
            </p>
          </div>

          {/* Card 2 */}
          <div style={cardStyle}>
            <div style={cardIconStyle} aria-hidden="true">📄</div>
            <h3 style={cardTitleStyle}>One file, one Bob</h3>
            <p style={cardBodyStyle}>
              The hook-enforced single-file contract means no two developers&apos; agents
              silently diverge mid-sprint.
            </p>
          </div>

          {/* Card 3 */}
          <div style={cardStyle}>
            <div style={cardIconStyle} aria-hidden="true">✅</div>
            <h3 style={cardTitleStyle}>PM proposes, human approves</h3>
            <p style={cardBodyStyle}>
              The Bob PM agent surfaces decisions—humans review every recommendation before
              the agent acts.
            </p>
          </div>
        </section>

        {/* ─── NEAR-MISS ACCENT BLOCK (marigold) ────────────────────────────── */}
        <section
          style={{
            background: '#ffb110',
            borderRadius: 12,
            padding: '40px 32px',
            marginBottom: 80,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <p
            style={{
              fontFamily: 'var(--font-source-serif-4), Georgia, serif',
              fontSize: 'clamp(20px, 2.5vw, 26px)',
              fontWeight: 600,
              color: '#1a0f00',
              textAlign: 'center',
              margin: 0,
              lineHeight: 1.35,
            }}
          >
            Catch near-misses before they merge.
          </p>

          {/* GIF placeholder */}
          {/* TODO(sync:imelda): ganti GIF asli setelah rekaman fase 10 */}
          <div
            style={{
              width: '100%',
              maxWidth: 680,
              aspectRatio: '16/9',
              background: 'rgba(0,0,0,0.12)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed rgba(0,0,0,0.25)',
            }}
          >
            <span
              style={{
                fontSize: 13,
                color: 'rgba(0,0,0,0.5)',
                fontFamily: 'var(--font-inter), monospace',
              }}
            >
              near-miss preview
            </span>
          </div>

          <p
            style={{
              fontSize: 12.5,
              color: 'rgba(0,0,0,0.6)',
              margin: 0,
              fontFamily: 'var(--font-inter), monospace',
              letterSpacing: '0.01em',
            }}
          >
            hook · PreToolUse → blocked
          </p>
        </section>

        {/* ─── INSTALL STEPS ─────────────────────────────────────────────────── */}
        <section
          style={{
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            padding: '32px 32px',
            marginBottom: 80,
          }}
        >
          <h2
            style={{
              fontSize: 20,
              fontWeight: 600,
              margin: '0 0 24px',
              letterSpacing: '-0.02em',
            }}
          >
            Get started in 3 steps
          </h2>
          <ol
            style={{
              margin: 0,
              paddingLeft: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <li style={stepStyle}>
              <strong>Download</strong> — grab the latest release from{' '}
              <a
                href={`${links.repoUrl}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0075de' }}
              >
                {links.repoUrl}/releases
              </a>
              .
            </li>
            <li style={stepStyle}>
              <strong>Clear the quarantine flag</strong> — the app is unsigned. Either go to{' '}
              <em>Privacy &amp; Security → Open Anyway</em>, or run:{' '}
              <code
                style={{
                  background: '#f0eeec',
                  padding: '1px 5px',
                  borderRadius: 4,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 13,
                }}
              >
                xattr -dr com.apple.quarantine IBM-Bob-Live-Collab.app
              </code>
            </li>
            <li style={stepStyle}>
              <strong>Connect</strong> — open the app and point it at your IBM Bob workspace
              to start syncing your team&apos;s sessions.
            </li>
          </ol>
        </section>

        {/* ─── DARK ISLAND ───────────────────────────────────────────────────── */}
        <section
          style={{
            background: '#02093a',
            borderRadius: 12,
            padding: '48px 40px',
            marginBottom: 80,
            textAlign: 'center',
          }}
        >
          <h2
            style={{
              fontSize: 'clamp(22px, 3vw, 30px)',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.02em',
              margin: '0 0 16px',
            }}
          >
            Built on IBM Bob primitives
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: 15.5,
              maxWidth: 520,
              margin: '0 auto 28px',
              lineHeight: 1.6,
            }}
          >
            Custom modes, lifecycle hooks, and MCP tools—every design decision is logged
            in our Bob sessions.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              marginBottom: 28,
            }}
          >
            {['custom modes', 'hooks', 'MCP', 'CLAUDE.md'].map((tag) => (
              <span
                key={tag}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.85)',
                  padding: '4px 12px',
                  borderRadius: 9999,
                  fontSize: 13,
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          <a
            href={links.bobSessions}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#62aef0',
              fontSize: 14,
              textDecoration: 'none',
              borderBottom: '1px solid rgba(98,174,240,0.4)',
              paddingBottom: 1,
              transition: 'border-color 200ms ease',
            }}
          >
            Browse bob_sessions/ evidence →
          </a>
        </section>

        {/* ─── LINKS ROW ─────────────────────────────────────────────────────── */}
        <section
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            justifyContent: 'center',
            marginBottom: 48,
            fontSize: 14,
          }}
        >
          <a
            href={links.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0075de', textDecoration: 'none' }}
            className="lp-nav-link"
          >
            GitHub Repo
          </a>
          <a
            href={links.bobSessions}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0075de', textDecoration: 'none' }}
            className="lp-nav-link"
          >
            bob_sessions
          </a>
          {/* Video and Deck hidden when null */}
          {links.video !== null && (
            <a
              href={links.video}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0075de', textDecoration: 'none' }}
              className="lp-nav-link"
            >
              Demo Video
            </a>
          )}
          {links.deck !== null && (
            <a
              href={links.deck}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0075de', textDecoration: 'none' }}
              className="lp-nav-link"
            >
              Slide Deck
            </a>
          )}
        </section>
      </main>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid rgba(0,0,0,0.08)',
          padding: '24px 32px',
          textAlign: 'center',
          fontSize: 12.5,
          color: '#9b9390',
          background: '#f6f5f4',
        }}
      >
        {SITE.disclaimer} · built on Orca (MIT)
      </footer>
    </div>
  );
}

// ── Shared style objects ──────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid rgba(0,0,0,0.08)',
  borderRadius: 12,
  padding: 24,
};

const cardIconStyle: React.CSSProperties = {
  fontSize: 24,
  marginBottom: 12,
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  margin: '0 0 8px',
  letterSpacing: '-0.01em',
};

const cardBodyStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#615d59',
  margin: 0,
  lineHeight: 1.6,
};

const stepStyle: React.CSSProperties = {
  fontSize: 14.5,
  color: '#333',
  lineHeight: 1.65,
};
