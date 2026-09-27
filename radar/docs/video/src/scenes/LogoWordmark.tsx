import {
  AbsoluteFill,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { carbon, fontFamily } from "../lib/tokens";
import { clampInterp } from "../lib/motion";

type Props = {
  reducedMotion?: boolean;
};

// Persistent wordmark: fades/scales in (0-30), shrinks to a top-left anchor
// chip while other scenes play (30-235), then settles back to full size and
// center before the outro fade-to-black (235-300).
export const LogoWordmark: React.FC<Props> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = reducedMotion
    ? clampInterp(frame, [0, 20], [0, 1])
    : spring({ frame, fps, config: { damping: 200, mass: 0.6 } });
  const opacityIn = clampInterp(frame, [0, 20], [0, 1]);

  // Reduced motion still needs the anchor-top / settle-center layout swap
  // (it's a position, not a flashy animation) — just cut instead of sliding,
  // masked by a quick fade at each transition.
  const isMid = frame >= 30 && frame < 235;
  const restScale = isMid ? 0.42 : 1;
  const restY = isMid ? -420 : 0;

  const shrink = clampInterp(frame, [30, 60], [1, 0.42]);
  const settle = clampInterp(frame, [235, 268], [0.42, 1]);
  const scale = reducedMotion
    ? restScale
    : entrance * (frame < 150 ? shrink : settle);

  const anchorY = clampInterp(frame, [30, 60], [0, -420]);
  const returnY = clampInterp(frame, [235, 268], [-420, 0]);
  const translateY = reducedMotion ? restY : frame < 150 ? anchorY : returnY;

  const transitionDip = reducedMotion
    ? Math.min(
        clampInterp(frame, [26, 30, 34], [1, 0.15, 1]),
        clampInterp(frame, [231, 235, 239], [1, 0.15, 1]),
      )
    : 1;
  const opacity = opacityIn * transitionDip;

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px) scale(${scale})`,
          fontFamily,
          fontSize: 96,
          fontWeight: 600,
          color: carbon.text,
          letterSpacing: -1,
        }}
      >
        IBM <span style={{ color: carbon.marigold }}>Bob</span>
      </div>
    </AbsoluteFill>
  );
};
