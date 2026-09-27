import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { carbon, fontFamily, monoFontFamily } from "../lib/tokens";
import { clampInterp } from "../lib/motion";

type Props = {
  reducedMotion?: boolean;
};

type CardSpec = {
  delay: number;
  offsetX: number;
  render: () => React.ReactNode;
};

// Stats mirror radar/packages/web/public/demo/meta.json (toko-demo fixture) —
// not invented numbers.
const CARDS: CardSpec[] = [
  {
    delay: 0,
    offsetX: -360,
    render: () => (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              background: carbon.blue,
            }}
          />
          <span style={{ color: carbon.textMuted, fontSize: 18 }}>Agent</span>
        </div>
        <div
          style={{
            color: carbon.text,
            fontSize: 24,
            fontWeight: 500,
            marginTop: 8,
          }}
        >
          Coder
        </div>
      </>
    ),
  },
  {
    delay: 12,
    offsetX: 0,
    render: () => (
      <>
        <div style={{ color: carbon.textMuted, fontSize: 18 }}>Decisions</div>
        <div
          style={{
            color: carbon.text,
            fontSize: 24,
            fontWeight: 500,
            marginTop: 8,
          }}
        >
          2 · median 2.9s
        </div>
      </>
    ),
  },
  {
    delay: 24,
    offsetX: 360,
    render: () => (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect
              x="3"
              y="7"
              width="10"
              height="7"
              rx="1.5"
              stroke={carbon.marigold}
              strokeWidth="1.4"
            />
            <path
              d="M5 7V5a3 3 0 0 1 6 0v2"
              stroke={carbon.marigold}
              strokeWidth="1.4"
            />
          </svg>
          <span style={{ color: carbon.textMuted, fontSize: 18 }}>Locked</span>
        </div>
        <div
          style={{
            color: carbon.text,
            fontSize: 16,
            fontFamily: monoFontFamily,
            marginTop: 8,
          }}
        >
          web/app/page.tsx
        </div>
      </>
    ),
  },
];

const Card: React.FC<{
  spec: CardSpec;
  frame: number;
  fps: number;
  reducedMotion?: boolean;
}> = ({ spec, frame, fps, reducedMotion }) => {
  const localFrame = frame - 90 - spec.delay;

  const entrance = reducedMotion
    ? clampInterp(localFrame, [0, 15], [0, 1])
    : spring({ frame: localFrame, fps, config: { damping: 14, mass: 0.8 } });

  const opacityIn = clampInterp(localFrame, [0, 12], [0, 1]);
  const opacityOut = clampInterp(frame, [170, 195], [1, 0]);
  const opacity = Math.min(opacityIn, opacityOut);

  const translateY = reducedMotion ? 0 : clampInterp(entrance, [0, 1], [60, 0]);
  const scale = reducedMotion ? 1 : clampInterp(entrance, [0, 1], [0.9, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${spec.offsetX}px, ${translateY + 80}px) scale(${scale})`,
        opacity,
        width: 260,
        borderRadius: 12,
        background: carbon.layer,
        border: `1px solid ${carbon.border}`,
        padding: "20px 22px",
        fontFamily,
      }}
    >
      {spec.render()}
    </div>
  );
};

// Three flat UI mockup cards (agent tag, decision card, lock chip) fly in
// staggered (90-180) to represent multi-agent collaboration.
export const UICards: React.FC<Props> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      {CARDS.map((spec, i) => (
        <Card
          key={i}
          spec={spec}
          frame={frame}
          fps={fps}
          reducedMotion={reducedMotion}
        />
      ))}
    </AbsoluteFill>
  );
};
