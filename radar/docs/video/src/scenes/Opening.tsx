import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { carbon, fontFamily } from "../lib/tokens";

type OpeningProps = {
  reducedMotion: boolean;
};

// Echoes the person-color dots from DESIGN.md §2.1 (A/B/C) — three agents
// converging into one shared mark, before the crew logo settles in.
const DOT_COLORS = [carbon.personA, carbon.personB, carbon.personC];
const DOT_OFFSET_X = [-64, 0, 64];
const DOT_OFFSET_Y = [10, -18, 10];
// Logo stack sits above center so the two-line wordmark + tagline fit below.
const MARK_Y = -110;

const Dot: React.FC<OpeningProps & { index: number }> = ({
  reducedMotion,
  index,
}) => {
  const frame = useCurrentFrame();
  const delay = index * 3;

  const popIn = interpolate(frame, [delay, delay + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const converge = reducedMotion
    ? 1
    : interpolate(frame, [10, 24], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.4, 0, 1, 1),
      });
  const fadeOut = reducedMotion
    ? interpolate(frame, [16, 24], [1, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : converge;

  return (
    <Interactive.Div
      name={`Dot ${index + 1}`}
      style={{
        position: "absolute",
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: DOT_COLORS[index],
        translate: `${DOT_OFFSET_X[index] * (reducedMotion ? 1 : converge)}px ${
          DOT_OFFSET_Y[index] * (reducedMotion ? 1 : converge)
        }px`,
        scale: `${popIn * (0.4 + 0.6 * converge)}`,
        opacity: popIn * fadeOut,
      }}
    />
  );
};

const DotsIntro: React.FC<OpeningProps> = ({ reducedMotion }) => {
  return (
    <AbsoluteFill
      name="Dots intro"
      style={{
        alignItems: "center",
        justifyContent: "center",
        translate: `0px ${MARK_Y}px`,
      }}
    >
      {DOT_COLORS.map((_, index) => (
        <Dot key={index} index={index} reducedMotion={reducedMotion} />
      ))}
    </AbsoluteFill>
  );
};

const StageWash: React.FC<OpeningProps> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      name="Stage wash"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 40%, rgba(15, 98, 254, 0.2) 0%, rgba(15, 98, 254, 0.05) 32%, transparent 62%)",
        opacity: reducedMotion
          ? interpolate(frame, [0, 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(frame, [0, 1.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
      }}
    />
  );
};

const StageRing: React.FC<OpeningProps> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="Stage ring"
        style={{
          width: 480,
          height: 480,
          borderRadius: 240,
          translate: `0px ${MARK_Y}px`,
          border: `1px solid ${carbon.borderStrong}`,
          opacity: reducedMotion
            ? interpolate(frame, [0, 8], [0, 0.85], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : interpolate(frame, [0, 0.9 * fps], [0, 0.85], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
          scale: reducedMotion
            ? 1
            : interpolate(frame, [0, 1.1 * fps], [0.78, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.spring({ damping: 160, mass: 0.8 }),
                output: "perceptual-scale",
              }),
        }}
      />
    </AbsoluteFill>
  );
};

const CrewMark: React.FC<OpeningProps> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Img
        name="Crew mark"
        src={staticFile("icon.png")}
        style={{
          width: 420,
          height: 420,
          objectFit: "contain",
          opacity: reducedMotion
            ? interpolate(frame, [0, 8], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : interpolate(frame, [0, 0.9 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
          scale: reducedMotion
            ? 1
            : interpolate(frame, [0, 1.2 * fps], [0.72, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.spring({ damping: 140, mass: 0.75 }),
                output: "perceptual-scale",
              }),
          translate: reducedMotion
            ? `0px ${MARK_Y}px`
            : interpolate(
                frame,
                [0, 1.1 * fps],
                [`0px ${MARK_Y + 28}px`, `0px ${MARK_Y}px`],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.spring({ damping: 160, mass: 0.7 }),
                },
              ),
          rotate: reducedMotion
            ? "0deg"
            : interpolate(frame, [0, 1.1 * fps], ["-2deg", "0deg"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.spring({ damping: 160, mass: 0.7 }),
              }),
        }}
      />
    </AbsoluteFill>
  );
};

const Word: React.FC<{
  reducedMotion: boolean;
  color: string;
  label: string;
}> = ({ reducedMotion, color, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Interactive.Span
      name={label}
      style={{
        color,
        opacity: reducedMotion
          ? interpolate(frame, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(frame, [0, 0.2 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
        translate: reducedMotion
          ? "0px 0px"
          : interpolate(frame, [0, 0.2 * fps], ["0px 18px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
      }}
    >
      {label}
    </Interactive.Span>
  );
};

const Wordmark: React.FC<OpeningProps> = ({ reducedMotion }) => {
  return (
    <Interactive.Div
      name="Wordmark"
      style={{
        position: "absolute",
        top: "50%",
        left: 80,
        right: 80,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        fontFamily,
        translate: "0px 150px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 20,
          fontSize: 80,
          fontWeight: 600,
          letterSpacing: -1.4,
          lineHeight: 1.1,
        }}
      >
        <Sequence name="IBM" layout="none">
          <Word reducedMotion={reducedMotion} color={carbon.text} label="IBM" />
        </Sequence>
        <Sequence name="Bob" from={5} layout="none">
          <Word
            reducedMotion={reducedMotion}
            color={carbon.accent}
            label="Bob"
          />
        </Sequence>
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 400,
          letterSpacing: 0.5,
          lineHeight: 1.2,
        }}
      >
        <Sequence name="Live Collab" from={10} layout="none">
          <Word
            reducedMotion={reducedMotion}
            color={carbon.textMuted}
            label="Live Collab"
          />
        </Sequence>
      </div>
    </Interactive.Div>
  );
};

const Rule: React.FC<OpeningProps> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Interactive.Div
        name="Hairline"
        style={{
          width: 120,
          height: 1,
          backgroundColor: carbon.textFaint,
          translate: "0px 318px",
          opacity: reducedMotion
            ? interpolate(frame, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : interpolate(frame, [0, 0.22 * fps], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
          scale: reducedMotion
            ? "1 1"
            : interpolate(frame, [0, 0.28 * fps], ["0.2 1", "1 1"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(0.16, 1, 0.3, 1),
              }),
        }}
      />
    </AbsoluteFill>
  );
};

const TaglineLine: React.FC<OpeningProps> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Interactive.Div
      name="Tagline"
      style={{
        position: "absolute",
        top: "50%",
        left: 80,
        right: 80,
        marginLeft: "auto",
        marginRight: "auto",
        maxWidth: 960,
        textAlign: "center",
        fontFamily,
        fontSize: 28,
        fontWeight: 400,
        color: carbon.textMuted,
        letterSpacing: 0.15,
        wordSpacing: "0.08em",
        lineHeight: 1.35,
        whiteSpace: "nowrap",
        opacity: reducedMotion
          ? interpolate(frame, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : interpolate(frame, [0, 0.22 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
        translate: reducedMotion
          ? "0px 348px"
          : interpolate(frame, [0, 0.22 * fps], ["0px 364px", "0px 348px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
      }}
    >
      Multiplayer IBM Bob. Every teammate's Bob, one live workspace.
    </Interactive.Div>
  );
};

export const Opening: React.FC<OpeningProps> = ({ reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <Interactive.Div
      name="Opening stack"
      style={{
        position: "absolute",
        inset: 0,
        opacity: interpolate(frame, [140, 150], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <Sequence name="Dots" durationInFrames={26}>
        <DotsIntro reducedMotion={reducedMotion} />
      </Sequence>
      <Sequence name="Wash" from={12} premountFor={fps}>
        <StageWash reducedMotion={reducedMotion} />
      </Sequence>
      <Sequence name="Ring" from={12} premountFor={fps}>
        <StageRing reducedMotion={reducedMotion} />
      </Sequence>
      <Sequence name="Mark" from={12} premountFor={fps}>
        <CrewMark reducedMotion={reducedMotion} />
      </Sequence>
      <Sequence name="Wordmark" from={48} premountFor={fps}>
        <Wordmark reducedMotion={reducedMotion} />
      </Sequence>
      <Sequence name="Rule" from={78} premountFor={fps}>
        <Rule reducedMotion={reducedMotion} />
      </Sequence>
      <Sequence name="Tagline" from={84} premountFor={fps}>
        <TaglineLine reducedMotion={reducedMotion} />
      </Sequence>
    </Interactive.Div>
  );
};
