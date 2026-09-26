'use client';

import { useEffect, useState } from 'react';

const CHAR_MS = 42;
const START_MS = 250;
const CARET_LINGER_MS = 1400;

/**
 * Hero title that types itself once on load. The full text is always in the DOM
 * (untyped characters are just transparent), so the layout never shifts and
 * screen readers / no-JS visitors get the whole title immediately.
 */
export function TypeTitle({ lines, className }: { lines: string[]; className?: string }) {
  const total = lines.reduce((n, l) => n + l.length, 0);
  const [typed, setTyped] = useState(total);
  const [caret, setCaret] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setTyped(0);
    setCaret(true);
    let n = 0;
    let timer = window.setTimeout(function tick() {
      n += 1;
      setTyped(n);
      timer =
        n < total
          ? window.setTimeout(tick, CHAR_MS)
          : window.setTimeout(() => setCaret(false), CARET_LINGER_MS);
    }, START_MS);
    return () => window.clearTimeout(timer);
  }, [total]);

  // Caret sits on the first line that is not finished yet (or the last line once done).
  const ends = lines.map((_, i) => lines.slice(0, i + 1).join('').length);
  const caretLine = Math.max(
    0,
    ends.findIndex((end) => typed < end),
  );
  const activeLine = typed >= total ? lines.length - 1 : caretLine;

  return (
    <h1 className={className} aria-label={lines.join(' ')}>
      {lines.map((line, i) => {
        const start = ends[i]! - line.length;
        const shown = Math.max(0, Math.min(line.length, typed - start));
        return (
          <span key={i} className="lp-type-line" aria-hidden="true">
            {line.slice(0, shown)}
            {caret && i === activeLine && <span className="lp-caret" />}
            <span className="lp-type-rest">{line.slice(shown)}</span>
          </span>
        );
      })}
    </h1>
  );
}
