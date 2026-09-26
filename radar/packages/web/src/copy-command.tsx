'use client';

import { useState } from 'react';

/** Shell command block with a copy button. Falls back silently if the clipboard is blocked. */
export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (insecure origin, permissions); the text stays selectable.
    }
  }

  return (
    <div className="lp-cmd">
      <code>{command}</code>
      <button type="button" className="lp-cmd-copy" onClick={copy} aria-label="Copy command">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
