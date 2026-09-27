import { AbsoluteFill, useCurrentFrame } from "remotion";
import { clampInterp } from "../lib/motion";

// Black overlay covering the outro (270-300), regardless of reduced-motion.
export const FadeToBlack: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = clampInterp(frame, [270, 300], [0, 1]);

  return <AbsoluteFill style={{ background: "#000000", opacity }} />;
};
