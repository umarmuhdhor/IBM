'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { AgentTag, BobTrace, DecisionCard, LockChip, MemberChip, WritingPulse } from '@radar/ui';

// Landing product window (fase 11D1 step 18a). Every file, task and outcome shown here mirrors
// the toko-demo replay fixture (public/demo/events.json): Budi's Bob hits checkout.ts while
// Andi holds it for T-1, the hook blocks it, and the request is queued while Budi moves on.

type Pane = 'andi' | 'mc' | 'budi';

const TABS: { id: Pane; label: string }[] = [
  { id: 'andi', label: 'Andi' },
  { id: 'mc', label: 'Mission Control' },
  { id: 'budi', label: 'Budi' },
];

export function LandingProductWindow({ demoPath }: { demoPath: string }) {
  const [pane, setPane] = useState<Pane>('mc');
  const tabRefs = useRef<Partial<Record<Pane, HTMLButtonElement | null>>>({});

  // WAI-ARIA tabs: arrow keys move between tabs, only the selected tab is in the Tab order.
  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const index = TABS.findIndex((tab) => tab.id === pane);
    const next = TABS[(index + step + TABS.length) % TABS.length];
    if (!next) return;
    setPane(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <div className="lp-window">
      <div className="lp-window-titlebar">
        <span className="lp-window-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="lp-window-title">toko-demo · live</span>
      </div>

      <div
        role="tablist"
        aria-label="Live Collab panes"
        className="lp-tabs"
        onKeyDown={onTabKeyDown}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={`lp-tab-${tab.id}`}
            aria-selected={pane === tab.id}
            aria-controls={`lp-panel-${tab.id}`}
            tabIndex={pane === tab.id ? 0 : -1}
            className="lp-tab"
            onClick={() => setPane(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        key={pane}
        role="tabpanel"
        id={`lp-panel-${pane}`}
        aria-labelledby={`lp-tab-${pane}`}
        tabIndex={0}
        className="lp-window-body"
      >
        {pane === 'andi' ? <AndiPane /> : null}
        {pane === 'mc' ? <MissionPane /> : null}
        {pane === 'budi' ? <BudiPane /> : null}
      </div>

      <div className="lp-window-foot">
        <span>Replay of the recorded session · no login · no API key</span>
        <a href={demoPath} className="lp-btn lp-btn-primary lp-btn-sm">
          Watch full replay
        </a>
      </div>
    </div>
  );
}

function AndiPane() {
  return (
    <div>
      <div className="lp-pane-head">
        <MemberChip member="A" initials="A" status="online" />
        <AgentTag label="Andi · Bob coder" member="A" status="writing" />
        <WritingPulse member="A" />
      </div>
      <p className="lp-file">
        src/checkout/checkout.ts <LockChip state="dipegang" holder="A" />
        <span className="lp-file-task">T-1 coupon</span>
      </p>
      <pre className="lp-code">{`export function calculateTotal(items, shipping = 0) {
  const subtotal = sum(items);
  return applyCoupon(subtotal, shipping);
}`}</pre>
      <BobTrace primitive="hook" detail="PreToolUse · apply_diff checkout.ts" outcome="allowed" />
    </div>
  );
}

function MissionPane() {
  return (
    <div className="lp-mc">
      <div>
        <p className="lp-pane-kicker">Files &amp; locks</p>
        <ul className="lp-files">
          <li className="lp-file">
            checkout.ts <LockChip state="dipegang" holder="A" /> <WritingPulse member="A" />
          </li>
          <li className="lp-file">
            routes.ts <LockChip state="dipesan" holder="A" />
          </li>
          <li className="lp-file">
            theme.css <LockChip state="dipegang" holder="B" />
          </li>
          <li className="lp-file">
            Header.tsx <LockChip state="dipesan" holder="B" />
          </li>
        </ul>
        <p className="lp-pane-kicker lp-pane-kicker-gap">Team</p>
        <div className="lp-people">
          <AgentTag label="Andi · coder" member="A" status="writing" />
          <AgentTag label="Budi · coder" member="B" status="blocked" />
          <AgentTag label="Citra · pm-lead" member="C" status="idle" />
        </div>
      </div>
      <div className="lp-needs">
        <p className="lp-pane-kicker">Needs you</p>
        <div className="lp-needs-enter">
          <DecisionCard
            title="Budi's Bob asks for checkout.ts"
            reason="Held by Andi for T-1. Queue Budi and continue Header.tsx meanwhile."
            status="auto-applied"
            readOnly
            onApprove={() => undefined}
            onDeny={() => undefined}
          />
        </div>
        <DecisionCard
          title="Plan P-1 · tasks for toko-demo"
          reason="Proposed by the pm-lead Bob. A human approved it before any lock was reserved."
          status="approved"
          readOnly
          onApprove={() => undefined}
          onDeny={() => undefined}
        />
      </div>
    </div>
  );
}

function BudiPane() {
  return (
    <div className="lp-budi">
      <div className="lp-pane-head">
        <MemberChip member="B" initials="B" status="online" />
        <AgentTag label="Budi · Bob coder" member="B" status="blocked" />
      </div>
      <p className="lp-file">
        src/checkout/checkout.ts <LockChip state="dipegang" holder="A" />
      </p>
      <div className="lp-traces">
        <BobTrace primitive="hook" detail="PreToolUse · lock_guard" outcome="blocked" />
        <BobTrace primitive="mcp" detail="radar.why_blocked" />
      </div>
      <p className="lp-blocked-copy">
        checkout.ts is held by Andi&apos;s Bob for T-1 (coupon). You are queued at position 1.
        Continue <code>Header.tsx</code> first.
      </p>
    </div>
  );
}
