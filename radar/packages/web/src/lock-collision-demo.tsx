'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * LockCollisionDemo — single-card, cursor-driven explainer for Bob's file-lock feature.
 *
 * One clock drives the whole story so cursors, carets and typed text never drift apart:
 *   1. Alice's cursor types lines 3–5. Bob locks that block to her.
 *   2. While she's on line 5, Budi's cursor lands on line 3 and tries to type. Bob rejects
 *      the keystrokes and puts Budi in the queue.
 *   3. Alice finishes the block and leaves. Only now does Bob ask the PM to hand the lock over.
 *   4. PM approves; the lock moves to Budi and his queued edit types in.
 *
 * Each cursor flag is rendered inline with its caret, so it follows the text as it grows.
 * Before anyone types, their mouse pointer (same color as their caret) glides to the spot and
 * clicks it; the PM's pointer clicks Approve. Targets are measured from the DOM so they land exactly.
 *
 * Flags sit to the right of the caret, where no text has been typed yet, so they never cover code.
 * Alice types lines 3–5 while Budi waits on line 3, so the two flags never share a row.
 */

const TYPED = [
  '  const slot = pickOpenSlot(lobby, ticket);',
  '  if (!slot) return { refusal: "lobby full" };',
  '  return reserveSlot(ctx, lobby, slot, ticket);',
];
const LINE_CHAR_MS = [38, 38, 85]; // line 5 slows down so Budi's collision reads clearly
const LINE_GAP_MS = 250;
const BUDI_ATTEMPT = ' //';
const BUDI_TEXT = ' // race-safe';
const BUDI_CHAR_MS = 110;

// Mouse pointers glide to their target (PTR_TRAVEL), click (PTR_CLICK), then the caret takes over.
const PTR_TRAVEL = 750;
const PTR_CLICK = 260;

// Absolute timeline (ms).
const ALICE_PTR = 200;
const ALICE_CLICK = ALICE_PTR + 100 + PTR_TRAVEL;
const ALICE_IN = ALICE_CLICK + 120;
const ALICE_START = ALICE_CLICK + 450;
const LINE_START: number[] = [];
{
  let at = ALICE_START;
  TYPED.forEach((line, i) => {
    LINE_START.push(at);
    at += line.length * (LINE_CHAR_MS[i] ?? 40) + LINE_GAP_MS;
  });
}
const lastLine = TYPED.length - 1;
const ALICE_END =
  (LINE_START[lastLine] ?? 0) + (TYPED[lastLine] ?? '').length * (LINE_CHAR_MS[lastLine] ?? 40);
const BUDI_PTR = (LINE_START[lastLine] ?? 0) + 150;
const BUDI_CLICK = BUDI_PTR + 100 + PTR_TRAVEL;
const BUDI_IN = BUDI_CLICK + 120;
const BUDI_TRY = BUDI_IN + 450;
const BUDI_BLOCK = BUDI_TRY + 900;
const BUDI_QUEUE = BUDI_BLOCK + 1100;
const ALICE_DONE = ALICE_END + 500;
const PM_REQ = ALICE_DONE + 900;
const PM_PTR = PM_REQ + 500;
const PM_PRESS = PM_PTR + 100 + PTR_TRAVEL + 700; // hover a beat on Approve before clicking
const PM_OK = PM_PRESS + 600;
const HANDOFF = PM_OK + 1400;
const BUDI_PTR2 = HANDOFF + 150;
const BUDI_CLICK2 = BUDI_PTR2 + 100 + PTR_TRAVEL;
const BUDI_TYPE = BUDI_CLICK2 + 450;
const BUDI_END = BUDI_TYPE + BUDI_TEXT.length * BUDI_CHAR_MS;
const RESOLVED = BUDI_END + 400;
const TOTAL_MS = RESOLVED + 2600;
const TICK_MS = 40;
const BASE_W = 640; // card's design width; narrower containers scale it down

const CODE_PREFIX = [
  'export async function joinLobby(ctx, lobbyId, ticket) {',
  '  const lobby = await ctx.get(lobbyId);',
];
const CODE_SUFFIX = ['}'];
const FIRST_LOCKED = CODE_PREFIX.length;

type Pt = { x: number; y: number };
type Geo = { alice: Pt; budi: Pt; approve: Pt };
type PtrSeg = { from: Pt; to: Pt; appear: number; click: number; leave: number };
type PtrState = {
  pos: Pt;
  mode: 'hidden' | 'still' | 'moving' | 'leaving';
  press: boolean;
  ripple: boolean;
};

function ptrAt(now: number, segs: PtrSeg[]): PtrState {
  // While hidden, park at the next entry point so the pointer never flies in from the corner.
  const next = segs.find((s) => now < s.appear) ?? segs[0];
  const hidden: PtrState = {
    pos: next ? next.from : { x: 0, y: 0 },
    mode: 'hidden',
    press: false,
    ripple: false,
  };
  for (const s of segs) {
    if (now < s.appear || now >= s.leave + 400) continue;
    const press = now >= s.click && now < s.click + PTR_CLICK;
    const ripple = now >= s.click && now < s.click + 520;
    if (now < s.appear + 100) return { pos: s.from, mode: 'still', press, ripple };
    if (now < s.leave) return { pos: s.to, mode: 'moving', press, ripple };
    return { pos: { x: s.to.x + 26, y: s.to.y + 20 }, mode: 'leaving', press, ripple };
  }
  return hidden;
}

const offset = (p: Pt, dx: number, dy: number): Pt => ({ x: p.x + dx, y: p.y + dy });

function caption(t: number): { step: string; text: string } {
  if (t < BUDI_IN)
    return { step: '1', text: 'Alice’s Bob agent writes lines 3–5. Bob locks the block to her.' };
  if (t < BUDI_BLOCK) return { step: '2', text: 'Budi’s agent tries to edit line 3…' };
  if (t < BUDI_QUEUE)
    return { step: '2', text: 'Blocked. Bob rejects the edit, no silent overwrite.' };
  if (t < ALICE_DONE) return { step: '2', text: 'Budi waits in the queue while Alice finishes.' };
  if (t < PM_REQ) return { step: '3', text: 'Alice is done. Budi is next in line.' };
  if (t < PM_OK) return { step: '3', text: 'Bob asks the PM to hand the lock to Budi.' };
  if (t < HANDOFF) return { step: '3', text: 'PM approves.' };
  if (t < RESOLVED) return { step: '4', text: 'Lock moves to Budi. His queued edit lands.' };
  return { step: '✓', text: 'Both edits kept. Zero merge conflicts.' };
}

export function LockCollisionDemo() {
  const [t, setT] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [fit, setFit] = useState<{ scale: number; height: number }>({ scale: 1, height: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const chRef = useRef<HTMLSpanElement>(null);
  const approvalRef = useRef<HTMLDivElement>(null);
  const approveRef = useRef<HTMLSpanElement>(null);

  // Narrow containers: render the card at BASE_W and scale it down to fit, so the code never
  // wraps or overflows. Then measure click targets in the card's own (unscaled) coordinates.
  useEffect(() => {
    const card = cardRef.current;
    const wrap = wrapRef.current;
    if (!card || !wrap) return;
    const measure = () => {
      const scale = Math.min(1, wrap.clientWidth / BASE_W);
      setFit((f) =>
        f.scale === scale && f.height === card.offsetHeight
          ? f
          : { scale, height: card.offsetHeight },
      );
      const anchor = anchorRef.current;
      const ch = chRef.current;
      const approval = approvalRef.current;
      const approve = approveRef.current;
      if (!anchor || !ch || !approval || !approve) return;
      const c = card.getBoundingClientRect();
      const k = c.width / card.offsetWidth || 1; // current visual scale of the card
      const a = anchor.getBoundingClientRect();
      const chW = ch.getBoundingClientRect().width / 10 / k;
      const x0 = (a.left - c.left) / k;
      const y = (a.top - c.top + a.height / 2) / k;
      setGeo({
        alice: { x: x0 + 2 * chW, y },
        budi: { x: x0 + (TYPED[0] ?? '').length * chW + 2, y },
        // offsetLeft/Top ignore the card's slide-in transform, so this is its resting spot.
        approve: {
          x: approval.offsetLeft + approve.offsetLeft + approve.offsetWidth / 2,
          y: approval.offsetTop + approve.offsetTop + approve.offsetHeight / 2,
        },
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const start = performance.now();
    const id = window.setInterval(() => setT((performance.now() - start) % TOTAL_MS), TICK_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  // Reduced motion: freeze on the most informative frame (Alice done, Budi queued, PM asked).
  const now = reducedMotion ? PM_REQ + 500 : t;

  // Alice: how many chars of each locked line are typed, and which line her caret is on.
  const typedChars = TYPED.map((line, i) => {
    const start = LINE_START[i] ?? 0;
    if (now < start) return 0;
    return Math.min(line.length, Math.floor((now - start) / (LINE_CHAR_MS[i] ?? 40)));
  });
  let aliceLine = 0;
  TYPED.forEach((_, i) => {
    if (now >= (LINE_START[i] ?? 0)) aliceLine = i;
  });
  const aliceVisible = now >= ALICE_IN && now < ALICE_DONE;
  const aliceTyping = now >= ALICE_START && now < ALICE_END;

  // Budi: arrives on line 3, his keystrokes bounce, then he queues.
  const budiVisible = now >= BUDI_IN && now < RESOLVED;
  const budiGhost =
    now >= BUDI_TRY && now < BUDI_BLOCK
      ? BUDI_ATTEMPT.slice(0, Math.min(BUDI_ATTEMPT.length, Math.floor((now - BUDI_TRY) / 280) + 1))
      : '';
  const budiBlocked = now >= BUDI_BLOCK && now < BUDI_QUEUE;
  const budiQueued = now >= BUDI_QUEUE && now < HANDOFF;
  const budiChars =
    now < BUDI_TYPE ? 0 : Math.min(BUDI_TEXT.length, Math.floor((now - BUDI_TYPE) / BUDI_CHAR_MS));
  const budiTyping = now >= BUDI_TYPE && now < BUDI_END;
  const budiLabel = budiBlocked
    ? '⛔ Budi · blocked'
    : budiQueued
      ? 'Budi · queued #1'
      : 'Budi · agent';

  const showApproval = now >= PM_REQ && now < HANDOFF;
  const pressing = now >= PM_PRESS && now < PM_OK;
  const approved = now >= PM_OK;

  const lockOwner: 'alice' | 'budi' | null =
    now < ALICE_START ? null : now >= HANDOFF ? 'budi' : 'alice';
  const released = now >= RESOLVED;
  const badge =
    lockOwner === null
      ? null
      : released
        ? 'unlocked'
        : lockOwner === 'budi'
          ? 'locked · Budi'
          : now >= ALICE_DONE
            ? 'Alice done'
            : 'locked · Alice';
  const shaking = now >= BUDI_BLOCK && now < BUDI_BLOCK + 450;

  const ptrs =
    geo && !reducedMotion
      ? {
          a: ptrAt(now, [
            {
              from: offset(geo.alice, 170, 130),
              to: geo.alice,
              appear: ALICE_PTR,
              click: ALICE_CLICK,
              leave: ALICE_START + 200,
            },
          ]),
          b: ptrAt(now, [
            {
              from: offset(geo.budi, 150, 150),
              to: geo.budi,
              appear: BUDI_PTR,
              click: BUDI_CLICK,
              leave: BUDI_BLOCK + 500,
            },
            {
              from: offset(geo.budi, 150, 150),
              to: geo.budi,
              appear: BUDI_PTR2,
              click: BUDI_CLICK2,
              leave: BUDI_TYPE + 200,
            },
          ]),
          pm: ptrAt(now, [
            {
              from: offset(geo.approve, -170, 70),
              to: geo.approve,
              appear: PM_PTR,
              click: PM_PRESS,
              leave: PM_OK + 500,
            },
          ]),
        }
      : null;
  const cap = caption(now);

  return (
    <div className="lcd-wrap" ref={wrapRef}>
      <style>{CSS}</style>
      <div
        className="lcd-fit"
        style={fit.scale < 1 ? { height: fit.height * fit.scale } : undefined}
      >
        <div
          className="lcd-card"
          ref={cardRef}
          style={
            fit.scale < 1
              ? { width: BASE_W, transform: `scale(${fit.scale})`, transformOrigin: '0 0' }
              : undefined
          }
        >
          <div className="lcd-titlebar">
            <span className="lcd-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className="lcd-title">
              northlight/abyssal-drift-server · session/lobby-join-race
            </span>
          </div>

          <div className="lcd-body">
            <pre className="lcd-code" aria-hidden="true">
              <span ref={chRef} className="lcd-measure">
                0000000000
              </span>
              {CODE_PREFIX.map((line, i) => (
                <div key={`pre-${i}`} className="lcd-line">
                  <span className="lcd-line-no">{i + 1}</span>
                  <span className="lcd-line-text">{line}</span>
                </div>
              ))}

              <div
                className={
                  'lcd-block' +
                  (lockOwner === 'alice' ? ' lcd-block-alice' : '') +
                  (lockOwner === 'budi' && !released ? ' lcd-block-budi' : '')
                }
              >
                {badge && (
                  <span
                    className={
                      'lcd-lock-badge' +
                      (lockOwner === 'budi' ? ' lcd-lock-badge-b' : '') +
                      (released ? ' lcd-lock-badge-free' : '')
                    }
                  >
                    {badge}
                  </span>
                )}
                {TYPED.map((line, i) => (
                  <div
                    key={`lock-${i}`}
                    className={'lcd-line' + (i === 0 && shaking ? ' lcd-shake' : '')}
                  >
                    <span className="lcd-line-no">{FIRST_LOCKED + 1 + i}</span>
                    <span className="lcd-line-text">
                      {i === 0 && <span ref={anchorRef} className="lcd-anchor" />}
                      {line.slice(0, typedChars[i])}
                      {i === aliceLine && (
                        <Caret
                          who="a"
                          label="Alice · agent"
                          blink={!aliceTyping}
                          visible={aliceVisible}
                        />
                      )}
                      {i === 0 && (
                        <>
                          {budiGhost && <span className="lcd-ghost">{budiGhost}</span>}
                          <span className="lcd-text-b">{BUDI_TEXT.slice(0, budiChars)}</span>
                          <Caret
                            who="b"
                            label={budiLabel}
                            blink={!budiTyping && !budiGhost}
                            visible={budiVisible}
                            blocked={budiBlocked}
                            queued={budiQueued}
                          />
                        </>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {CODE_SUFFIX.map((line, i) => (
                <div key={`suf-${i}`} className="lcd-line">
                  <span className="lcd-line-no">{FIRST_LOCKED + TYPED.length + 1 + i}</span>
                  <span className="lcd-line-text">{line}</span>
                </div>
              ))}
            </pre>
          </div>

          <div
            ref={approvalRef}
            className={'lcd-approval' + (showApproval ? ' lcd-approval-in' : '')}
          >
            <div className="lcd-approval-head">Bob → PM · approval needed</div>
            <p className="lcd-approval-body">
              <b className="lcd-name-a">Alice</b> finished lines 3–5.{' '}
              <b className="lcd-name-b">Budi</b> is queued on the same block. Hand the lock to Budi?
            </p>
            <div className="lcd-approval-row">
              {approved ? (
                <span className="lcd-approved-pill">✓ Approved by PM</span>
              ) : (
                <>
                  <span
                    ref={approveRef}
                    className={'lcd-btn lcd-btn-primary' + (pressing ? ' lcd-btn-pressed' : '')}
                  >
                    Approve
                  </span>
                  <span className="lcd-btn">Deny</span>
                </>
              )}
            </div>
          </div>

          {ptrs && (
            <>
              <Pointer who="a" state={ptrs.a} />
              <Pointer who="b" state={ptrs.b} />
              <Pointer who="pm" state={ptrs.pm} tag="PM" />
            </>
          )}
        </div>
      </div>

      <p className="lcd-caption" aria-live="polite">
        <span className="lcd-step">{cap.step}</span>
        {cap.text}
      </p>
    </div>
  );
}

function Pointer({ who, state, tag }: { who: 'a' | 'b' | 'pm'; state: PtrState; tag?: string }) {
  return (
    <div
      className={
        `lcd-ptr lcd-ptr-${who} lcd-ptr-${state.mode}` +
        (state.press ? ' lcd-ptr-press' : '') +
        (state.ripple ? ' lcd-ptr-ripple-on' : '')
      }
      style={{ transform: `translate(${state.pos.x}px, ${state.pos.y}px)` }}
      aria-hidden="true"
    >
      <span className="lcd-ptr-ripple" />
      <svg width="16" height="20" viewBox="0 0 16 20">
        <path
          d="M1.5 1.5 L1.5 16.5 L5.6 12.6 L8.4 18.6 L11 17.4 L8.3 11.6 L13.8 11.6 Z"
          fill="currentColor"
          stroke="#0b0b0c"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {tag && <span className="lcd-ptr-tag">{tag}</span>}
    </div>
  );
}

function Caret({
  who,
  label,
  blink,
  visible,
  blocked,
  queued,
}: {
  who: 'a' | 'b';
  label: string;
  blink: boolean;
  visible: boolean;
  blocked?: boolean;
  queued?: boolean;
}) {
  return (
    <span
      className={
        `lcd-caret lcd-caret-${who}` +
        (visible ? ' lcd-caret-in' : '') +
        (blink ? ' lcd-caret-blink' : '')
      }
    >
      <span
        className={
          `lcd-flag lcd-flag-${who}` +
          (blocked ? ' lcd-flag-blocked' : '') +
          (queued ? ' lcd-flag-queued' : '')
        }
      >
        {label}
      </span>
    </span>
  );
}

const CSS = `
.lcd-wrap { width: 100%; max-width: 680px; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
.lcd-fit { width: 100%; }
.lcd-card {
  position: relative;
  width: 100%;
  border-radius: 14px;
  overflow: hidden;
  background: var(--lc-surface-1, #161616);
  border: 1px solid var(--lc-border, #2a2a2d);
  font-family: var(--lc-font-sans, Inter, system-ui, sans-serif);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}
.lcd-titlebar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  background: var(--lc-surface-2, #1e1e20);
  border-bottom: 1px solid var(--lc-border, #2a2a2d);
}
.lcd-dots { display: inline-flex; gap: 6px; flex-shrink: 0; }
.lcd-dots i { width: 10px; height: 10px; border-radius: 50%; }
.lcd-dots i:nth-child(1) { background: #fa4d56; }
.lcd-dots i:nth-child(2) { background: #f1c21b; }
.lcd-dots i:nth-child(3) { background: #42be65; }
.lcd-title {
  font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace);
  font-size: 12px; color: var(--lc-text-muted, #a8a8a8);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lcd-body { position: relative; padding: 28px 0 136px; }
.lcd-code {
  margin: 0; padding: 0 16px;
  font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace);
  font-size: 13px; line-height: 34px;
  color: var(--lc-text, #f4f4f4);
  overflow: visible;
}
.lcd-line {
  position: relative;
  display: flex; gap: 12px;
  padding: 0 8px;
  white-space: pre;
}
.lcd-line-no { width: 16px; flex-shrink: 0; color: var(--lc-text-faint, #6f6f6f); text-align: right; }
.lcd-line-text { position: relative; min-width: 0; }
.lcd-block {
  position: relative;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: border-color 400ms ease, background-color 400ms ease;
}
.lcd-block-alice { border-color: rgba(120, 169, 255, 0.7); background: rgba(120, 169, 255, 0.07); }
.lcd-block-budi { border-color: rgba(190, 149, 255, 0.7); background: rgba(190, 149, 255, 0.07); }
.lcd-shake { animation: lcd-shake 420ms cubic-bezier(0.36, 0.07, 0.19, 0.97); }
@keyframes lcd-shake {
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(2px); }
}
.lcd-text-b { color: var(--lc-member-b, #be95ff); }
.lcd-ghost { color: #fa4d56; text-decoration: line-through; }

.lcd-caret {
  position: relative;
  display: inline-block;
  width: 2px; height: 18px;
  margin: 0 1px;
  vertical-align: -4px;
  opacity: 0;
  transition: opacity 250ms ease;
}
.lcd-caret-in { opacity: 1; }
.lcd-caret-a { background: var(--lc-member-a, #78a9ff); z-index: 2; }
.lcd-caret-b { background: var(--lc-member-b, #be95ff); z-index: 1; }
.lcd-caret-blink { animation: lcd-blink 1s steps(1) infinite; }
@keyframes lcd-blink { 50% { background: transparent; } }
.lcd-flag {
  position: absolute;
  font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace);
  font-size: 11px; line-height: 1;
  padding: 4px 8px;
  white-space: nowrap;
  pointer-events: none;
  transition: background-color 200ms ease;
}
.lcd-flag-a { left: 8px; top: 50%; transform: translateY(-50%); border-radius: 6px; background: var(--lc-member-a, #78a9ff); color: #04122b; }
.lcd-flag-b { left: 8px; top: 50%; transform: translateY(-50%); border-radius: 6px; background: var(--lc-member-b, #be95ff); color: #1c0d24; }
.lcd-flag-blocked { background: #fa4d56; color: #1c0d0e; }
.lcd-flag-queued { background: var(--lc-surface-2, #1e1e20); color: var(--lc-member-b, #be95ff); box-shadow: inset 0 0 0 1px var(--lc-member-b, #be95ff); }

.lcd-lock-badge {
  position: absolute; right: 10px; top: 0;
  transform: translateY(-50%);
  z-index: 3;
  font-size: 10px; line-height: 1;
  font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace);
  padding: 5px 8px; border-radius: 999px;
  background: var(--lc-member-a, #78a9ff); color: #04122b;
  white-space: nowrap;
}
.lcd-lock-badge-b { background: var(--lc-member-b, #be95ff); color: #1c0d24; }
.lcd-lock-badge-free { background: var(--lc-surface-2, #1e1e20); color: var(--lc-ok, #42be65); box-shadow: inset 0 0 0 1px var(--lc-ok, #42be65); }

.lcd-measure { position: absolute; visibility: hidden; white-space: pre; }
.lcd-anchor { display: inline-block; width: 0; height: 18px; vertical-align: -4px; }

.lcd-ptr {
  position: absolute; left: 0; top: 0; z-index: 5;
  pointer-events: none;
  transition: transform ${PTR_TRAVEL}ms cubic-bezier(0.65, 0, 0.35, 1), opacity 250ms ease;
}
.lcd-ptr-hidden { opacity: 0; transition: none; }
.lcd-ptr-still { opacity: 1; transition: opacity 200ms ease; }
.lcd-ptr-leaving { opacity: 0; transition: transform 400ms ease-out, opacity 400ms ease; }
.lcd-ptr-a { color: var(--lc-member-a, #78a9ff); }
.lcd-ptr-b { color: var(--lc-member-b, #be95ff); }
.lcd-ptr-pm { color: var(--lc-needs-you, #ff7eb6); }
.lcd-ptr svg {
  display: block;
  margin: -1.5px 0 0 -1.5px;
  filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.55));
  transform-origin: 1.5px 1.5px;
  transition: transform 110ms ease-out;
}
.lcd-ptr-press svg { transform: scale(0.8); }
.lcd-ptr-ripple {
  position: absolute; left: -11px; top: -11px;
  width: 22px; height: 22px; border-radius: 50%;
  border: 2px solid currentColor;
  opacity: 0;
}
.lcd-ptr-ripple-on .lcd-ptr-ripple { animation: lcd-ripple 520ms ease-out forwards; }
@keyframes lcd-ripple {
  from { transform: scale(0.3); opacity: 0.9; }
  to { transform: scale(1.7); opacity: 0; }
}
.lcd-ptr-tag {
  position: absolute; left: 14px; top: 17px;
  font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace);
  font-size: 10px; line-height: 1;
  padding: 3px 6px; border-radius: 4px;
  background: var(--lc-needs-you, #ff7eb6); color: #2a0716;
}

.lcd-approval {
  position: absolute; right: 16px; bottom: 16px;
  width: 300px; padding: 12px 14px;
  border-radius: 12px;
  background: var(--lc-surface-2, #1e1e20);
  border: 1px solid var(--lc-needs-you, #ff7eb6);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
  opacity: 0; transform: translateY(12px);
  transition: opacity 400ms ease, transform 400ms cubic-bezier(0.23, 1, 0.32, 1);
}
.lcd-approval-in { opacity: 1; transform: translateY(0); }
.lcd-approval-head {
  font-size: 11px; color: var(--lc-needs-you, #ff7eb6);
  font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace);
  margin-bottom: 6px;
}
.lcd-approval-body { margin: 0 0 10px; font-size: 12px; color: var(--lc-text, #f4f4f4); line-height: 1.45; }
.lcd-name-a { color: var(--lc-member-a, #78a9ff); font-weight: 600; }
.lcd-name-b { color: var(--lc-member-b, #be95ff); font-weight: 600; }
.lcd-approval-row { display: flex; gap: 8px; min-height: 28px; align-items: center; }
.lcd-btn {
  font-size: 12px; padding: 5px 12px; border-radius: 6px;
  border: 1px solid var(--lc-border-strong, #393939);
  color: var(--lc-text, #f4f4f4);
  transition: transform 160ms ease, filter 160ms ease, box-shadow 160ms ease;
}
.lcd-btn-primary { background: var(--lc-accent, #0f62fe); border-color: var(--lc-accent, #0f62fe); color: #fff; }
.lcd-btn-pressed { transform: scale(0.94); filter: brightness(1.25); box-shadow: 0 0 0 3px rgba(15, 98, 254, 0.35); }
.lcd-approved-pill { font-size: 12px; color: var(--lc-ok, #42be65); font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace); }

.lcd-caption {
  margin: 0;
  display: flex; align-items: center; gap: 10px;
  font-size: 15px; color: var(--lc-text, #f4f4f4);
  min-height: 24px;
}
.lcd-step {
  display: inline-grid; place-items: center; flex-shrink: 0;
  width: 22px; height: 22px; border-radius: 50%;
  font-size: 11px; font-family: var(--lc-font-mono, 'IBM Plex Mono', monospace);
  background: var(--lc-surface-2, #1e1e20); border: 1px solid var(--lc-border-strong, #393939);
  color: var(--lc-text-muted, #a8a8a8);
}
@media (prefers-reduced-motion: reduce) {
  .lcd-block, .lcd-approval, .lcd-caret, .lcd-btn, .lcd-flag { transition: none; }
  .lcd-caret-blink, .lcd-shake { animation: none; }
  .lcd-ptr { display: none; }
}
`;
