# Orca integration map — verified after Bob slice C1

Source: Bob's unchanged [`ORCA_MAP.html`](ORCA_MAP.html). Paths below are relative to `app/`; line numbers were checked against the current `lane/app` checkout on 26 Sep 2026. Bob's report remains the original artifact, including its approximate locations.

| Concern | Verified seam |
|---|---|
| Agent identity | `src/shared/tui-agent.ts:3` defines `TuiAgent`; `src/shared/agent-kind.ts:17` maps every agent to telemetry. Registry settings live in `src/shared/tui-agent-config.ts:217`; selection in `src/shared/tui-agent-selection.ts:28`; labels in `src/shared/tui-agent-display-names.ts:30`; picker metadata in `src/renderer/src/lib/agent-catalog.tsx:193`. Follow the existing `kiro` entries in the other registries. |
| PTY output to xterm | `src/renderer/src/components/terminal-pane/pty-connection/transport-output-callbacks.ts:61` receives output; `src/renderer/src/components/terminal-pane/pty-connection/write-pty-output-to-xterm.ts:94` calls the scheduler; `src/renderer/src/lib/pane-manager/pane-terminal-foreground-render-settle.ts:232` calls `terminal.write(data, ...)`. |
| Keyboard to PTY | `src/renderer/src/components/terminal-pane/pty-connection/pty-input-forward.ts:180` subscribes to xterm input and `:155`/`:166` call transport `sendInput`; `src/preload/api/pty-bridge-session-control.ts:74` sends `pty:write`; `src/main/ipc/pty/ipc/write.ts:23` receives it. |
| Left sidebar | `src/renderer/src/components/sidebar/index.tsx:164` renders navigation, `:165` header, `:169` agent list, and `:187` worktree list. A Live Collab section can render in this existing layout. |
| Tab model | `src/shared/tab-types.ts:20` defines `TabContentType`; `src/renderer/src/store/slices/tabs/tabs-create-actions.ts:22` creates unified tabs. A drawer/sheet avoids a new persisted content type for Mission Control. |
| IPC | `src/main/ipc/pty/register-handlers.ts:242`/`:265`/`:272` install PTY handlers; `src/preload/index.ts:118` adds `ptyApi` to `window.api`, exposed at `:190`. New domain channels need main registration, preload bridge, and API typing. |
| Packaging | `config/electron-builder.config.cjs:174` sets `appId`, `:175` sets `productName`, `:184` sets `buildResources`; platform `extraResources` entries begin at `:445`, `:529`, and `:597`. |

## Corrections to Bob's HTML report

| Bob claim | Verified correction |
|---|---|
| `runtime-terminal-inspection.ts:251` is PTY output to xterm | It calls `window.api.pty.write(ptyId, data)`, an **input** path. Output reaches xterm through the transport callback and output scheduler above. |
| `terminal-tab-types.ts:57–79` defines unified `contentType` | Those lines describe a legacy terminal tab. The union is in `src/shared/tab-types.ts:20`. |
| `SidebarWorkspaceFilterSection` is rendered by `sidebar/index.tsx` | It is imported by `src/renderer/src/components/sidebar/workspace-options-menu-items.tsx:16` and rendered at `:237`. |
| `extraResources` is at builder config line 292 | Platform-specific `extraResources` entries are at lines 445, 529, and 597. |
| The PTY example in the HTML shows output flowing through `pty:write` | `pty:write` is renderer input to the PTY. Do not use it as an output tap. |
