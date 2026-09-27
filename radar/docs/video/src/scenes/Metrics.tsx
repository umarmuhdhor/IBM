import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import meta from "../../../../packages/web/public/demo/meta.json";
import { carbon, fontFamily, monoFontFamily } from "../lib/tokens";

type MetricsProps = {
  reducedMotion: boolean;
};

// Every number here is read from the replay fixture
// (radar/packages/web/public/demo/meta.json) — nothing typed by hand.
const TILES = [
  { label: "Near-misses caught", value: String(meta.metrics.nearMisses) },
  { label: "PM decisions", value: String(meta.metrics.decisions) },
  { label: "Merge conflicts", value: String(meta.metrics.mergeConflicts) },
  {
    label: "Median decision",
    value: `${meta.metrics.medianDecisionSeconds}s`,
  },
];

const STAGGER = 6;

const Tile: React.FC<
  MetricsProps & { label: string; value: string; accent: boolean }
> = ({ reducedMotion, label, value, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        width: 340,
        padding: "28px 32px",
        background: carbon.layer,
        border: `1px solid ${carbon.border}`,
        borderTop: `2px solid ${accent ? carbon.accent : carbon.borderStrong}`,
        opacity: enter,
        transform: reducedMotion
          ? undefined
          : `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
      }}
    >
      <div
        style={{
          fontFamily,
          fontSize: 72,
          fontWeight: 600,
          color: carbon.text,
          letterSpacing: -1.5,
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 16,
          fontFamily,
          fontSize: 22,
          color: carbon.textMuted,
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const Metrics: React.FC<MetricsProps> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const headerIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        gap: 48,
        opacity: exit,
      }}
    >
      <div
        style={{
          fontFamily: monoFontFamily,
          fontSize: 22,
          color: carbon.textFaint,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          opacity: headerIn,
        }}
      >
        Replay · {meta.workspace}
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        {TILES.map((tile, i) => (
          <Sequence
            key={tile.label}
            from={8 + i * STAGGER}
            layout="none"
          >
            <Tile
              reducedMotion={reducedMotion}
              label={tile.label}
              value={tile.value}
              accent={i === 0}
            />
          </Sequence>
        ))}
      </div>
    </AbsoluteFill>
  );
};
