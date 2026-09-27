import { interpolate } from "remotion";

// Clamp-extrapolated interpolate — the shape used by every scene's fade/slide math.
export function clampInterp(
  frame: number,
  inputRange: number[],
  outputRange: number[],
) {
  return interpolate(frame, inputRange, outputRange, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}
