# tau-teams

Tau extension for [Pi](https://github.com/mariozechner/pi-coding-agent) multi-team worker visibility. A fork of [tau-mirror](https://github.com/mariozechner/tau-mirror) that adds rendering of lead and worker activity in the browser UI when using the [multi-team-chat](https://github.com/disler/lead-agents) extension.

## Problem

Stock Tau only shows orchestrator-level interactions — delegations to team leads and their final responses. Worker-level activity (SQL queries, schema discovery, credential provisioning, tool calls) is invisible in the browser. The Pi terminal shows everything, but the browser UI collapses it.

## Solution

tau-teams subscribes to `team_event` events emitted by a patched multi-team-chat extension and renders worker/lead activity as collapsible tool-cards in the browser UI.

### What you see in the browser

- **Per-agent cards** for each lead and worker that participates in a delegation
- **Tool badges** showing which tools the worker called (`bash`, `read`, `grep`, etc.)
- **Streaming text** as the worker generates its response
- **Cost/token stats** per agent
- **Auto-collapse** when the agent finishes

## Prerequisites

### Patch multi-team-chat (required)

tau-teams requires a small patch to `lead-agents/apps/multi-team-chat` that emits `team_event` on `process` when leads/workers act. Without this patch, no events reach the browser.

**File 1: `extensions/modules/subprocess.ts`** — add `onRawEvent` callback:

```diff
 export async function callAgent(
   ...
   onUsage?: (stats: { ... }) => void,
+  onRawEvent?: (event: any) => void,
 ): Promise<SubprocessResult> {
```

And in `processLine()`, after parsing:

```diff
     const processLine = (line: string) => {
       ...
       try { event = JSON.parse(line); } catch { return; }
+
+      // Forward raw event for external consumers (e.g., tau-teams)
+      onRawEvent?.(event);
```

**File 2: `extensions/multi-team-chat.ts`** — emit events in two places:

In the `onToolUpdate` callback (for member events), after `if (!entry) return;`:

```diff
+    process.emit("team_event" as any, { agent: entry.memberName, team: team.name, role: "member", update: partialResult } as any);
```

After the `onUsage` callback (for lead raw events), add a new `onRawEvent` callback:

```diff
+    // onRawEvent: forward lead subprocess events for tau-teams
+    (event) => {
+      process.emit("team_event" as any, { agent: team.lead.name, team: team.name, role: "lead", event } as any);
+    },
```

## Usage

### With justfile (recommended)

```just
tau := "/path/to/tau-teams/extensions/mirror-server.ts"
teams := "/path/to/lead-agents/apps/multi-team-chat/extensions/multi-team-chat.ts"

db-ui:
    pi -e {{teams}} -e {{tau}} --session-dir .pi/agent-sessions
```

### Direct

```bash
pi -e /path/to/multi-team-chat.ts -e /path/to/tau-teams/extensions/mirror-server.ts
```

Open `http://localhost:3001` in your browser.

## Architecture

```
Worker subprocess → stdout JSON events
  → Lead subprocess callAgent() → onUpdate callbacks
    → Main process onToolUpdate → process.emit("team_event", {role: "member"})
      → tau-teams process.on("team_event") → broadcast to browser WebSocket
        → app.js handleTeamEvent() → render tool-card

Lead subprocess → stdout JSON events
  → Main process callAgent() onRawEvent → process.emit("team_event", {role: "lead"})
    → tau-teams process.on("team_event") → broadcast to browser WebSocket
      → app.js handleTeamEvent() → render tool-card
```

## License

MIT
