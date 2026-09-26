'use client';
// /demo — the juror replay (DESIGN §5.8). Redesigned so the story reads on its own: a narrator bar
// says in one sentence what just happened, a chapter stepper shows where we are, and the stage puts
// both coders' Bob IDE activity around Mission Control's shared repo. Data contract unchanged:
// public/demo/{events,meta,bob-quotes}.json played through the shared reducer (replay-player).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BobActivityItem, RadarEvent, RadarState } from '@radar/common';
import { createPlayer, type ReplayPlayer, type Speed } from '../../src/lib/replay-player';
import { shouldAutoplayReplay } from '../../src/replay/autoplay';
import type { ReplayMeta } from '../../src/replay/meta';
import { buildBeats, currentBeat } from '../../src/replay/narrate';
import { BobInsidePanel, StoryLog, type BobQuotes } from '../../src/replay/ui/bob-inside';
import { ChapterStepper, Header, NarratorBar, Transport, memberColor } from '../../src/replay/ui/chrome';
import { CoderLane, MissionControl } from '../../src/replay/ui/stage';

const MOBILE_QUERY = '(max-width: 900px)';

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}

function latestActivity(state: RadarState): BobActivityItem | null {
  let latest: BobActivityItem | null = null;
  for (const items of Object.values(state.bobActivity)) {
    const newest = items[0];
    if (newest && (!latest || newest.ts > latest.ts || (newest.ts === latest.ts && newest.id > latest.id))) latest = newest;
  }
  return latest;
}

export default function DemoPage() {
  const [meta, setMeta] = useState<ReplayMeta | null>(null);
  const [events, setEvents] = useState<RadarEvent[] | null>(null);
  const [quotes, setQuotes] = useState<BobQuotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<ReplayPlayer | null>(null);

  const [offsetMs, setOffsetMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(2);
  const [state, setState] = useState<RadarState | null>(null);

  // Bob inside follows the newest activity until a row is clicked.
  const [pinned, setPinned] = useState<BobActivityItem | null>(null);
  // Mobile tab: null = follow whoever the narrator is talking about.
  const [manualTab, setManualTab] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [eventsRes, metaRes, quotesRes] = await Promise.all([
          fetch('/demo/events.json'),
          fetch('/demo/meta.json'),
          fetch('/demo/bob-quotes.json'),
        ]);
        if (!eventsRes.ok || !metaRes.ok || !quotesRes.ok) throw new Error('Failed to load demo data');
        const eventsData = (await eventsRes.json()) as { events: RadarEvent[] };
        const metaData = (await metaRes.json()) as ReplayMeta;
        const quotesData = (await quotesRes.json()) as BobQuotes;
        if (cancelled) return;
        setMeta(metaData);
        setQuotes(quotesData);
        setEvents(eventsData.events);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!events) return;
    const player = createPlayer(events);
    playerRef.current = player;
    setState(player.getState());
    const unsub = player.subscribe((ms) => {
      setOffsetMs(ms);
      setIsPlaying(player.isPlaying());
      setState(player.getState());
    });
    // Autoplay at 2× (DESIGN §5.8) unless the viewer prefers reduced motion.
    player.setSpeed(2);
    setSpeed(2);
    if (shouldAutoplayReplay(window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
      player.play();
      setIsPlaying(true);
    }
    return () => {
      unsub();
      player.destroy();
      playerRef.current = null;
    };
  }, [events]);

  const handlePlayPause = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;
    if (player.isPlaying()) {
      player.pause();
      setIsPlaying(false);
      return;
    }
    if (player.getOffsetMs() >= player.getDurationMs()) player.seek(0);
    player.play();
    setIsPlaying(true);
  }, []);

  const handleSeek = useCallback((ms: number) => {
    playerRef.current?.seek(ms);
  }, []);

  const handleChapter = useCallback((ms: number) => {
    playerRef.current?.seek(ms);
    setManualTab(null);
  }, []);

  const handleSpeed = useCallback((s: Speed) => {
    playerRef.current?.setSpeed(s);
    setSpeed(s);
  }, []);

  const beats = useMemo(() => (events ? buildBeats(events) : []), [events]);

  if (error) {
    return (
      <main className="rp-page rp-center" role="alert">
        <p>Unable to load the replay. Check your connection, then reload the page.</p>
        <button type="button" className="rp-reload" onClick={() => window.location.reload()}>
          Reload replay
        </button>
      </main>
    );
  }
  if (!meta || !state || !events) {
    return (
      <main className="rp-page rp-center">
        <p className="rp-empty">Loading replay…</p>
      </main>
    );
  }

  const t0 = events[0]?.ts ?? 0;
  const nowTs = t0 + offsetMs;
  const durationMs = playerRef.current?.getDurationMs() ?? 0;
  const beat = currentBeat(beats, t0, offsetMs);

  const chapters = meta.chapters;
  let activeIndex = -1;
  chapters.forEach((ch, i) => {
    if (ch.ts - t0 <= offsetMs) activeIndex = i;
  });
  const chapter = activeIndex >= 0 ? (chapters[activeIndex] ?? null) : null;

  const members = Object.values(state.members).sort((a, b) => a.id.localeCompare(b.id));
  const names = Object.fromEntries(members.map((m) => [m.id, m.name]));
  const coders = members.filter((m) => m.role === 'coder').map((m) => m.id);
  const pmId = members.find((m) => m.role === 'pm')?.id ?? null;
  const [left, right] = coders;

  const inside = pinned ?? latestActivity(state);

  const autoTab = beat?.actor && coders.includes(beat.actor) ? beat.actor : 'mc';
  const tab = manualTab ?? autoTab;
  const tabs: Array<[string, string]> = [
    ...(left ? [[left, names[left] ?? left] as [string, string]] : []),
    ['mc', pmId ? `${names[pmId] ?? pmId} · PM` : 'PM'],
    ...(right ? [[right, names[right] ?? right] as [string, string]] : []),
  ];

  const lane = (id: string | undefined) =>
    id ? (
      <CoderLane
        key={id}
        state={state}
        memberId={id}
        nowTs={nowTs}
        selectedId={pinned?.id ?? null}
        onSelect={setPinned}
      />
    ) : null;
  const mc = (
    <MissionControl
      key="mc"
      state={state}
      pmId={pmId}
      nowTs={nowTs}
      focusFile={beat?.file ?? null}
      focusTone={beat?.tone ?? null}
    />
  );

  return (
    <main className="rp-page">
      <div className="rp-wrap">
        <Header meta={meta} />

        <div className="rp-story">
          <NarratorBar
            beat={beat}
            chapter={chapter}
            stepIndex={Math.max(0, activeIndex)}
            stepCount={chapters.length}
            t0={t0}
            names={names}
          />
          <ChapterStepper chapters={chapters} activeIndex={activeIndex} t0={t0} onSeek={handleChapter} />
        </div>

        {/* Fixed to the viewport bottom, but early in DOM order so Tab reaches Pause right after the chapters. */}
        <div className="rp-transport-dock">
          <div className="rp-wrap">
            <Transport
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              speed={speed}
              onSpeed={handleSpeed}
              offsetMs={offsetMs}
              durationMs={durationMs}
              onSeek={handleSeek}
              chapters={chapters}
              t0={t0}
            />
          </div>
        </div>

        {isMobile ? (
          <div className="rp-mobile-stage">
            <div className="rp-tabs" role="tablist" aria-label="Who to watch">
              {tabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`rp-tab-${id}`}
                  aria-selected={tab === id}
                  aria-controls="rp-tabpanel"
                  style={{ ['--member' as string]: id === 'mc' ? memberColor(pmId) : memberColor(id) }}
                  onClick={() => setManualTab(id)}
                >
                  <span className="rp-dot" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            <div id="rp-tabpanel" role="tabpanel" aria-labelledby={`rp-tab-${tab}`}>
              {tab === 'mc' ? mc : lane(tab)}
            </div>
          </div>
        ) : (
          <div className="rp-stage">
            {lane(left)}
            {mc}
            {lane(right)}
          </div>
        )}

        <div className="rp-bottom">
          <BobInsidePanel
            item={inside}
            pinned={pinned !== null}
            onFollow={() => setPinned(null)}
            quotes={quotes}
            names={names}
            bobSessionsUrl={meta.links.bobSessions}
          />
          <StoryLog beats={beats} t0={t0} offsetMs={offsetMs} currentId={beat?.id ?? null} onSeek={handleSeek} />
        </div>

        <p className="rp-foot">
          Synthetic data from a recorded Radar session · Community hackathon project, not an official IBM product
        </p>
      </div>
    </main>
  );
}
