import { loadFont as loadPlexMono } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadPlexSans } from "@remotion/google-fonts/IBMPlexSans";

loadPlexSans("normal", {
  weights: ["400", "600"],
  subsets: ["latin"],
});

loadPlexMono("normal", {
  weights: ["400"],
  subsets: ["latin"],
});
