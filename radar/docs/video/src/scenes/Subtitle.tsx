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

// "Live Collab" slides up under the wordmark (30-90), holds, then fades out
// (160-185) to hand off to the UI cards / tagline scenes.
export const Subtitle: React.FC<Props> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entranceSpring = reducedMotion
    ? 1
    : spring({ frame: frame - 30, fps, config: { damping: 200, mass: 0.7 } });
  const opacityIn = clampInterp(frame, [30, 55], [0, 1]);
  const opacityOut = clampInterp(frame, [160, 185], [1, 0]);
  const opacity = Math.min(opacityIn, opacityOut);

  const translateY = reducedMotion
    ? 0
    : clampInterp(entranceSpring, [0, 1], [40, 0]);

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
          transform: `translateY(${translateY - 160}px)`,
          fontFamily,
          fontSize: 40,
          fontWeight: 300,
          color: carbon.textMuted,
          letterSpacing: 2,
        }}
      >
        Live Collab
      </div>
    </AbsoluteFill>
  );
};
