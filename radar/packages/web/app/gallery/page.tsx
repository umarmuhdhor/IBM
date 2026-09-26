'use client';

// Gallery page — renders all @radar/ui components with empty + filled state variants.
// Client component: DecisionCard/ReviewCard take onApprove/onDeny/onSendBack callbacks, which
// can't cross the server→client boundary as props (Next.js RSC), so the whole page renders client-side.
import {
  AgentTag,
  BobTrace,
  BriefMeter,
  DecisionCard,
  FeedItem,
  LockChip,
  MemberChip,
  PresenceStack,
  ReviewCard,
  TaskCard,
  WritingPulse,
} from '@radar/ui';
import type { PresenceMember } from '@radar/ui';

// ── helpers ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '48px' }}>
      <h2
        style={{
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '11px',
          color: 'var(--lc-text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '16px',
          borderBottom: '1px solid var(--lc-border)',
          paddingBottom: '8px',
        }}
      >
        {title}
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>
        {children}
      </div>
    </section>
  );
}

function Label({ text }: { text: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--lc-font-mono)',
        fontSize: '10px',
        color: 'var(--lc-text-faint)',
        marginTop: '6px',
      }}
    >
      {text}
    </div>
  );
}

function Swatch({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {children}
      <Label text={label} />
    </div>
  );
}

// ── fixture data ──────────────────────────────────────────────────────────────

const PRESENCE_MEMBERS: PresenceMember[] = [
  { id: 'A', initials: 'A', status: 'online' },
  { id: 'B', initials: 'B', status: 'stale' },
  { id: 'C', initials: 'C', status: 'offline' },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GalleryPage() {
  return (
    <main
      style={{
        background: 'var(--lc-bg)',
        minHeight: '100vh',
        color: 'var(--lc-text)',
        fontFamily: 'var(--lc-font-sans)',
        padding: '32px 48px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--lc-font-sans)',
          fontSize: '20px',
          fontWeight: 600,
          color: 'var(--lc-text)',
          marginBottom: '8px',
        }}
      >
        @radar/ui Component Gallery
      </h1>
      <p
        style={{
          fontFamily: 'var(--lc-font-mono)',
          fontSize: '12px',
          color: 'var(--lc-text-faint)',
          marginBottom: '48px',
        }}
      >
        All components, empty + filled, ≥2 variants each. For visual QA.
      </p>

      {/* ── AgentTag ─────────────────────────────────────────────────────────── */}
      <Section title="AgentTag">
        <Swatch label="idle · A">
          <AgentTag label="Bob · A" member="A" status="idle" />
        </Swatch>
        <Swatch label="writing · B">
          <AgentTag label="Bob · B" member="B" status="writing" />
        </Swatch>
        <Swatch label="blocked · C">
          <AgentTag label="Bob · C" member="C" status="blocked" />
        </Swatch>
        <Swatch label="idle · D">
          <AgentTag label="PM · D" member="D" status="idle" />
        </Swatch>
      </Section>

      {/* ── MemberChip ───────────────────────────────────────────────────────── */}
      <Section title="MemberChip">
        <Swatch label="online · A">
          <MemberChip member="A" initials="A" status="online" />
        </Swatch>
        <Swatch label="stale · B">
          <MemberChip member="B" initials="B" status="stale" />
        </Swatch>
        <Swatch label="offline · C">
          <MemberChip member="C" initials="C" status="offline" />
        </Swatch>
        <Swatch label="offline · D">
          <MemberChip member="D" initials="D" status="offline" />
        </Swatch>
      </Section>

      {/* ── PresenceStack ─────────────────────────────────────────────────────── */}
      <Section title="PresenceStack">
        <Swatch label="empty">
          <PresenceStack members={[]} />
        </Swatch>
        <Swatch label="A online, B stale, C offline">
          <PresenceStack members={PRESENCE_MEMBERS} />
        </Swatch>
        <Swatch label="single member">
          <PresenceStack members={[{ id: 'A', initials: 'A', status: 'online' }]} />
        </Swatch>
      </Section>

      {/* ── LockChip ─────────────────────────────────────────────────────────── */}
      <Section title="LockChip">
        <Swatch label="dipesan (reserved)">
          <LockChip state="dipesan" holder="A" />
        </Swatch>
        <Swatch label="dipegang (held)">
          <LockChip state="dipegang" holder="B" />
        </Swatch>
        <Swatch label="review">
          <LockChip state="review" holder="C" />
        </Swatch>
      </Section>

      {/* ── WritingPulse ──────────────────────────────────────────────────────── */}
      <Section title="WritingPulse">
        <Swatch label="member A">
          <WritingPulse member="A" />
        </Swatch>
        <Swatch label="member B">
          <WritingPulse member="B" />
        </Swatch>
        <Swatch label="member C">
          <WritingPulse member="C" />
        </Swatch>
        <Swatch label="member D">
          <WritingPulse member="D" />
        </Swatch>
      </Section>

      {/* ── BobTrace ─────────────────────────────────────────────────────────── */}
      <Section title="BobTrace">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
          <Swatch label="hook · allowed">
            <BobTrace primitive="hook" detail="PreToolUse · lock_guard" outcome="allowed" ms={61} />
          </Swatch>
          <Swatch label="hook · blocked">
            <BobTrace primitive="hook" detail="PreToolUse · lock_guard" outcome="blocked" ms={84} />
          </Swatch>
          <Swatch label="mode · coder">
            <BobTrace primitive="mode" detail="coder" />
          </Swatch>
          <Swatch label="mcp · no outcome">
            <BobTrace primitive="mcp" detail="radar.why_blocked" />
          </Swatch>
          <Swatch label="hook · injecting">
            <BobTrace primitive="hook" detail="UserPromptSubmit · brief" outcome="injecting" />
          </Swatch>
        </div>
      </Section>

      {/* ── BriefMeter ───────────────────────────────────────────────────────── */}
      <Section title="BriefMeter">
        <Swatch label="within budget (4/6)">
          <BriefMeter lines={4} tokens={128} />
        </Swatch>
        <Swatch label="at limit (6/6)">
          <BriefMeter lines={6} tokens={210} />
        </Swatch>
        <Swatch label="over budget (8/6)">
          <BriefMeter lines={8} tokens={300} />
        </Swatch>
        <Swatch label="custom max (3/4)">
          <BriefMeter lines={3} maxLines={4} tokens={95} />
        </Swatch>
      </Section>

      {/* ── FeedItem ─────────────────────────────────────────────────────────── */}
      <Section title="FeedItem">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', width: '100%' }}>
          <Swatch label="edit kind">
            <FeedItem
              ts={1790397011750}
              actor="A"
              kind="edit"
              text="Andi edited src/checkout/shipping.ts"
            />
          </Swatch>
          <Swatch label="blocked kind with trace">
            <FeedItem
              ts={1790397030350}
              actor="B"
              kind="blocked"
              text="Budi blocked on src/routes.ts"
              trace={{ primitive: 'hook', detail: 'PreToolUse · lock_guard', outcome: 'blocked', ms: 84 }}
            />
          </Swatch>
          <Swatch label="decision kind">
            <FeedItem
              ts={1790397018450}
              actor="mc"
              kind="decision"
              text="PM approved plan P-1"
            />
          </Swatch>
          <Swatch label="commit kind">
            <FeedItem
              ts={1790397038850}
              actor="server"
              kind="commit"
              text="Commit a1b2c3d pushed"
            />
          </Swatch>
          <Swatch label="info kind">
            <FeedItem
              ts={1790397000000}
              actor="server"
              kind="info"
              text="Workspace toko-demo initialised"
            />
          </Swatch>
        </div>
      </Section>

      {/* ── TaskCard ──────────────────────────────────────────────────────────── */}
      <Section title="TaskCard">
        <Swatch label="terbuka">
          <TaskCard
            id="T-0"
            title="Setup ongkir"
            ownerId="A"
            ownerInitials="A"
            ownerStatus="online"
            status="terbuka"
            fileCount={2}
            editCount={0}
          />
        </Swatch>
        <Swatch label="dikerjakan">
          <TaskCard
            id="T-1"
            title="Kupon diskon"
            ownerId="A"
            ownerInitials="A"
            ownerStatus="online"
            status="dikerjakan"
            fileCount={3}
            editCount={14}
          />
        </Swatch>
        <Swatch label="review">
          <TaskCard
            id="T-2"
            title="Dark mode"
            ownerId="B"
            ownerInitials="B"
            ownerStatus="stale"
            status="review"
            fileCount={2}
            editCount={7}
          />
        </Swatch>
        <Swatch label="selesai + sha">
          <TaskCard
            id="T-3"
            title="Fix routes"
            ownerId="A"
            ownerInitials="A"
            ownerStatus="offline"
            status="selesai"
            fileCount={1}
            editCount={3}
            commitSha="a1b2c3d4e5f6"
          />
        </Swatch>
        <Swatch label="batal">
          <TaskCard
            id="T-4"
            title="Cancelled task"
            ownerId="B"
            ownerInitials="B"
            ownerStatus="offline"
            status="batal"
          />
        </Swatch>
      </Section>

      {/* ── DecisionCard ──────────────────────────────────────────────────────── */}
      <Section title="DecisionCard">
        <Swatch label="pending (read-only)">
          <DecisionCard
            title="Budi needs src/routes.ts"
            reason="T-2 requires a small format change in the same file A holds."
            status="pending"
            readOnly
            onApprove={() => {}}
            onDeny={() => {}}
          />
        </Swatch>
        <Swatch label="pending (interactive)">
          <DecisionCard
            title="Plan P-1: three tasks"
            reason="Ongkir, kupon diskon, dan dark mode — no file overlap."
            status="pending"
            onApprove={() => {}}
            onDeny={() => {}}
          />
        </Swatch>
        <Swatch label="approved">
          <DecisionCard
            title="Plan P-1: three tasks"
            reason="Approved by PM."
            status="approved"
            onApprove={() => {}}
            onDeny={() => {}}
          />
        </Swatch>
        <Swatch label="denied">
          <DecisionCard
            title="Request R-3"
            reason="Denied — pemegang masih aktif."
            status="denied"
            onApprove={() => {}}
            onDeny={() => {}}
          />
        </Swatch>
        <Swatch label="auto-applied">
          <DecisionCard
            title="Auto-merge T-0"
            reason="Auto-applied after timeout."
            status="auto-applied"
            onApprove={() => {}}
            onDeny={() => {}}
          />
        </Swatch>
      </Section>

      {/* ── ReviewCard ───────────────────────────────────────────────────────── */}
      <Section title="ReviewCard">
        <Swatch label="pending (read-only)">
          <ReviewCard
            title="T-2 Dark mode review"
            added={18}
            removed={3}
            fileCount={2}
            impact="Header.tsx calls calculateTotal with old signature — will break after T-0 merges."
            verdict="setujui_beri_tahu — flag src/ui/Header.tsx"
            pending={false}
            readOnly
            onApprove={() => {}}
            onSendBack={() => {}}
          />
        </Swatch>
        <Swatch label="pending (interactive)">
          <ReviewCard
            title="T-1 Kupon diskon review"
            added={42}
            removed={5}
            fileCount={3}
            verdict="Clean — no conflict detected."
            pending={false}
            onApprove={() => {}}
            onSendBack={() => {}}
          />
        </Swatch>
        <Swatch label="in-flight (pending=true)">
          <ReviewCard
            title="T-1 Kupon diskon review"
            added={42}
            removed={5}
            fileCount={3}
            verdict="Approving…"
            pending
            onApprove={() => {}}
            onSendBack={() => {}}
          />
        </Swatch>
      </Section>
    </main>
  );
}
