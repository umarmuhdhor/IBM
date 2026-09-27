import { AbsoluteFill, useCurrentFrame } from "remotion";
import { carbon, fontFamily } from "../lib/tokens";
import { clampInterp } from "../lib/motion";

type Props = {
  reducedMotion?: boolean;
};

// No confirmed tagline exists yet in radar/docs/deck — using the brief's
// placeholder line. Swap once SUBMISSION.md / deck copy is finalized.
const TAGLINE = "Multiple agents. One shared context.";

// Fades in (180-240), holds, fades out (255-280) ahead of the outro.
export const Tagline: React.FC<Props> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();

  const opacityIn = clampInterp(frame, [180, 240], [0, 1]);
  const opacityOut = clampInterp(frame, [255, 280], [1, 0]);
  const opacity = Math.min(opacityIn, opacityOut);

  const translateY = reducedMotion
    ? 0
    : clampInterp(frame, [180, 240], [16, 0]);

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
          transform: `translateY(${translateY}px)`,
          fontFamily,
          fontSize: 44,
          fontWeight: 400,
          color: carbon.text,
          maxWidth: 900,
          textAlign: "center",
        }}
      >
        {TAGLINE}
      </div>
    </AbsoluteFill>
  );
};
