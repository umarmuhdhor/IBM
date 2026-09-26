export interface BriefMeterProps {
  lines: number;
  maxLines?: number;
  tokens: number;
}

export function BriefMeter({ lines, maxLines = 6, tokens }: BriefMeterProps) {
  const withinBudget = lines <= maxLines;
  return (
    <div role="meter" aria-label="Team brief lines" aria-valuemin={0} aria-valuemax={maxLines} aria-valuenow={lines} style={{ color: withinBudget ? 'var(--lc-ok)' : 'var(--lc-warn)', fontFamily: 'var(--lc-font-mono)', fontSize: 12 }}>
      <span aria-hidden="true">⚓ </span>hook · UserPromptSubmit · injecting team brief · {lines}/{maxLines} lines · {tokens} tok
    </div>
  );
}
