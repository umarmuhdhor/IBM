import {
  AbsoluteFill,
  Composition,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { FadeToBlack } from "./scenes/FadeToBlack";
import { Metrics } from "./scenes/Metrics";
import { Opening } from "./scenes/Opening";
import { carbon } from "./lib/tokens";

export type IBMBobIntroProps = {
  reducedMotion: boolean;
};

const Halftone: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      name="Halftone"
      style={{
        backgroundImage: `radial-gradient(circle, ${carbon.text} 1px, transparent 1px)`,
        backgroundSize: "12px 12px",
        opacity: interpolate(frame, [0, 12, 48], [0.05, 0.05, 0.08], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    />
  );
};

const Vignette: React.FC = () => {
  return (
    <AbsoluteFill
      name="Vignette"
      style={{
        backgroundImage:
          `radial-gradient(ellipse at 50% 46%, transparent 36%, ${carbon.background} 100%)`,
        opacity: 0.72,
        pointerEvents: "none",
      }}
    />
  );
};

export const IBMBobIntro: React.FC<IBMBobIntroProps> = ({ reducedMotion }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: carbon.background }}>
      <Halftone />
      <Vignette />
      <Sequence name="Opening" durationInFrames={150} premountFor={1}>
        <Opening reducedMotion={reducedMotion} />
      </Sequence>
      <Sequence name="Metrics" from={150} durationInFrames={120} premountFor={30}>
        <Metrics reducedMotion={reducedMotion} />
      </Sequence>
      <FadeToBlack />
    </AbsoluteFill>
  );
};

export const IBMBobIntroComposition: React.FC = () => {
  return (
    <Composition
      id="IBMBobIntro"
      component={IBMBobIntro}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ reducedMotion: false }}
    />
  );
};
