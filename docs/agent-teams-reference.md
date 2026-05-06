# Agent Teams — Master Reference Guide

Source: https://code.claude.com/docs/en/agent-teams  
Claude Code min version: **v2.1.32** (`claude --version` to check)  
Status: **Experimental** — disabled by default

---

## Enable Agent Teams

```json
// ~/.claude/settings.json  OR  project .claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Or set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in your shell environment.

---

## Core Concepts

An agent team has four components:

| Component | Role |
|-----------|------|
| **Team lead** | The main Claude Code session that creates the team, spawns teammates, and coordinates work |
| **Teammates** | Separate Claude Code instances that each work on assigned tasks |
| **Task list** | Shared list of work items that teammates claim and complete |
| **Mailbox** | Messaging system for communication between agents |

**Storage locations (auto-managed, do not edit by hand):**
- Team config: `~/.claude/teams/{team-name}/config.json`
- Task list: `~/.claude/tasks/{team-name}/`

---

## Agent Teams vs Subagents — When to Use Which

| | Subagents | Agent Teams |
|---|---|---|
| **Context** | Own context window; results return to caller | Own context window; fully independent |
| **Communication** | Report results back to main agent only | Teammates message each other directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **Best for** | Focused tasks where only the result matters | Complex work requiring discussion and collaboration |
| **Token cost** | Lower — results summarized back to main context | Higher — each teammate is a separate Claude instance |

**Rule of thumb:** Use subagents when you only need the result. Use agent teams when teammates need to share findings, challenge each other, and coordinate on their own.

---

## Best Use Cases

Agent teams shine when teammates can work independently in parallel:

1. **Research and review** — multiple teammates investigate different aspects simultaneously, then share and challenge findings
2. **New modules or features** — each teammate owns a separate piece without stepping on each other
3. **Debugging with competing hypotheses** — teammates test different theories in parallel and converge faster
4. **Cross-layer coordination** — frontend, backend, and tests each owned by a different teammate
5. **Parallel code review** — split review criteria (security, performance, test coverage) into independent domains

**Do NOT use agent teams for:** sequential tasks, same-file edits, or work with many dependencies — use a single session or subagents instead.

---

## Starting a Team — Prompt Patterns

### Basic team creation
```
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Create an agent team to explore this from different angles:
one teammate on UX, one on technical architecture, one playing devil's advocate.
```

### Specify team size and models
```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

### Require plan approval before implementation
```
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

### Parallel code review
```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

### Competing hypotheses debugging
```
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses. Have them talk to
each other to try to disprove each other's theories, like a scientific
debate. Update the findings doc with whatever consensus emerges.
```

---

## Display Modes

| Mode | Description | Requirement |
|------|-------------|-------------|
| `auto` (default) | Uses split panes if inside tmux, in-process otherwise | — |
| `in-process` | All teammates in main terminal; Shift+Down to cycle | Any terminal |
| `tmux` | Each teammate in its own pane | tmux or iTerm2 |

**Override in settings:**
```json
{ "teammateMode": "in-process" }
```

**Override for one session:**
```bash
claude --teammate-mode in-process
```

**Install split-pane deps:**
```bash
# tmux (macOS)
brew install tmux
# iTerm2 — also enable: Settings → General → Magic → Enable Python API
npm install -g it2
```

---

## Keyboard Controls (In-Process Mode)

| Key | Action |
|-----|--------|
| `Shift+Down` | Cycle through teammates |
| `Enter` | View teammate's session |
| `Escape` | Interrupt teammate's current turn |
| `Ctrl+T` | Toggle task list |

---

## Task Management

Tasks have three states: **pending → in progress → completed**

Tasks support dependencies — a pending task with unresolved dependencies cannot be claimed until those dependencies complete. File locking prevents race conditions when multiple teammates try to claim the same task simultaneously.

**Task assignment options:**
- **Lead assigns** — tell the lead which task goes to which teammate
- **Self-claim** — teammates pick up the next unassigned, unblocked task on their own

**Ideal ratio:** 5–6 tasks per teammate keeps everyone productive without excessive context switching.

**Task sizing:**
- Too small → coordination overhead exceeds benefit
- Too large → teammates work too long without check-ins
- Just right → self-contained units with a clear deliverable (a function, a test file, a review)

---

## Communication Between Agents

- **Direct messaging** — any teammate can message any other by name
- **Automatic delivery** — messages arrive without polling
- **Idle notifications** — teammates automatically notify the lead when they finish
- **Shared task list** — all agents see task status and claim available work

To broadcast: send one message per recipient (no group send).

---

## Context and Permissions

- Teammates load `CLAUDE.md`, MCP servers, and skills from the project — same as a regular session
- The lead's **conversation history does NOT carry over** to teammates
- Task-specific details must be included in the spawn prompt
- Teammates start with the **lead's permission settings**
- If the lead uses `--dangerously-skip-permissions`, all teammates do too
- You can change individual teammate modes **after** spawning, but not at spawn time

---

## Using Subagent Definitions for Teammates

Define a role once (e.g., `security-reviewer`, `test-runner`) and reuse it as both a subagent and a teammate:

```
Spawn a teammate using the security-reviewer agent type to audit the auth module.
```

- The definition's `tools` allowlist and `model` are honored
- The definition body is **appended** to the teammate's system prompt (not a replacement)
- Team coordination tools (`SendMessage`, task tools) are always available even when `tools` restricts others
- `skills` and `mcpServers` frontmatter fields are **not applied** when running as a teammate — those load from project/user settings instead

---

## Enforcing Quality with Hooks

| Hook | Trigger | Use case |
|------|---------|---------|
| `TeammateIdle` | Teammate about to go idle | Exit code 2 → send feedback, keep working |
| `TaskCreated` | Task being created | Exit code 2 → prevent creation, send feedback |
| `TaskCompleted` | Task being marked complete | Exit code 2 → prevent completion, send feedback |

---

## Team Lifecycle Commands

```
# Shut down a single teammate gracefully
Ask the researcher teammate to shut down

# Clean up the entire team (run from lead only)
Clean up the team

# If lead starts implementing instead of waiting
Wait for your teammates to complete their tasks before proceeding

# If tasks appear stuck
[Tell lead to nudge the teammate or update task status manually]
```

**Always clean up from the lead.** Teammates should not run cleanup — their team context may not resolve correctly.

---

## Best Practices Checklist

- [ ] **Give teammates enough context** in the spawn prompt (they don't inherit the lead's history)
- [ ] **Start with 3–5 teammates** — coordinate overhead grows with team size
- [ ] **5–6 tasks per teammate** — sweet spot for productivity
- [ ] **Each teammate owns different files** — avoid concurrent edits to the same file
- [ ] **Name teammates explicitly** in spawn prompts to get predictable names for later reference
- [ ] **Monitor and steer** — don't let teams run unattended for long; redirect early
- [ ] **Start with research/review tasks** if new to teams — fewer coordination challenges
- [ ] **Pre-approve common operations** in permission settings before spawning to reduce friction
- [ ] **Specify approval criteria** upfront (e.g., "only approve plans that include test coverage")

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Teammates not appearing | Press Shift+Down (in-process); verify task was complex enough; run `which tmux` |
| Too many permission prompts | Pre-approve operations in permission settings before spawning |
| Teammate stops on error | Use Shift+Down to check output; give direct instructions or spawn a replacement |
| Lead shuts down before work is done | Tell the lead to keep going |
| Orphaned tmux sessions | `tmux ls` then `tmux kill-session -t <session-name>` |
| Task status stuck / lags | Check if work is actually done; tell lead to nudge teammate or update status manually |

---

## Known Limitations

| Limitation | Workaround |
|------------|------------|
| `/resume` and `/rewind` do not restore in-process teammates | Tell lead to spawn new teammates after resuming |
| Task status can lag | Manually update or ask lead to nudge |
| Shutdown can be slow | Teammates finish current tool call before stopping |
| One team per session | Clean up before starting a new team |
| No nested teams (teammates can't spawn their own teams) | Only the lead manages the team |
| Lead is fixed for the team's lifetime | N/A — cannot promote a teammate to lead |
| Split panes not supported in VS Code terminal, Windows Terminal, or Ghostty | Use in-process mode |

---

## Token Cost Guidance

- Token usage **scales linearly** with active teammates
- Each teammate has its own full context window
- Research, review, and new feature work → extra tokens usually worthwhile
- Routine/sequential tasks → single session is more cost-effective
- See: `https://code.claude.com/docs/en/costs#agent-team-token-costs`

---

## Related Features

| Feature | When to use |
|---------|------------|
| [Subagents](/en/sub-agents) | Lightweight delegation; no inter-agent coordination needed |
| [Git worktrees](/en/worktrees) | Manual parallel sessions without automated team coordination |
| [Hooks](/en/hooks) | Enforce quality gates on task/teammate lifecycle events |
