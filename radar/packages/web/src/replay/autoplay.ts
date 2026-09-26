/** DESIGN §5.8 asks for autoplay at 2×. better-interface HIGH: autoplay must yield to reduced motion. */
export function shouldAutoplayReplay(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
}
