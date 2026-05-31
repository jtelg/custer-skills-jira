# Design: Fix Skill Workflow Automation

## Technical Approach

Three independent fixes targeting the same root cause: skills fail to auto-load, causing the agent to fall back to generic behavior with incorrect Jira tool usage. Fixes are purely declarative (markdown frontmatter + instruction text) — no code changes in `bin/cli.js`.

1. **Frontmatter trigger optimization** — rewrite YAML `description` fields to lead with exact user phrases, exploiting OpenCode's self-check matching algorithm.
2. **Transition correctness** — replace all `jira_jira_transition_issue(transition="X")` with a two-step `get_transitions` → `transitionId` pattern.
3. **Project-level guardrails** — add `AGENTS.md` at repo root as a safety net when fuzzy skill matching misses.

## Architecture Decisions

| Decision | Options | Choice | Rationale |
|----------|---------|--------|-----------|
| Transition discovery | A) Two-step (get_transitions → transitionId) vs B) Hardcoded transition ID | **A) Two-step** | Workflow transition names/IDs vary across Jira projects. The two-step approach queries the actual workflow, guaranteeing correctness regardless of project config. Cost: 1 extra MCP call per transition (~200ms). Mitigation: cache per-project (future). |
| Skill description format | A) Lead with trigger phrases vs B) Lead with capability description | **A) Trigger-first** | OpenCode matches user queries against `description` fields to decide skill loading. Leading with exact trigger phrases (e.g., "qué tareas hay", "mostrame pendientes") maximizes fuzzy-match probability. The description's secondary role (human documentation) is preserved after the trigger list. |
| Project rules location | A) AGENTS.md (repo root) vs B) opencode.json vs C) .opencode/project.json | **A) AGENTS.md** | AGENTS.md is OpenCode's standard project-level instruction file, loaded automatically on session start. opencode.json is for MCP tool config only. .opencode/ is for agent/sub-agent definitions, not project rules. AGENTS.md provides the broadest reach with zero configuration overhead. |

## Data Flow

```
User says "qué tareas hay"
  │
  ▼
OpenCode self-check: matches "qué tareas hay" against skill descriptions?
  │
  ├── YES → load consulta-tareas-jira skill → skill sees "no usar auth_status" →
  │         calls jira_search_issues directly → ✅ works
  │
  └── NO → skill NOT loaded → AGENTS.md active →
           "NUNCA uses jira_auth_status" → calls jira_search_issues → ✅ works
                         │
                         ▼
           (still works even when skill matching fails)
```

For transitions:
```
jira_get_transitions(issueKey, expand="transitions.fields")
  │
  ▼
Parse transitions[] array → find transition where to.name == target status
  │
  ▼
jira_transition_issue(issueIdOrKey=..., transitionId=<found_id>)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `skills/consulta-tareas-jira/SKILL.md` | Modify | Rewrite YAML `description` — trigger-first format. Content unchanged. |
| `skills/git-push-jira/SKILL.md` | Modify | Rewrite YAML `description`; replace `transition="X"` with two-step `get_transitions` → `transitionId`; add STOP checklist before closing transition |
| `AGENTS.md` | Create | Hard project rules: never use `jira_auth_status`, auto-detect Jira queries, auto-detect issue keys |

## Interfaces / Contracts

**Two-step transition pattern (replaces all `transition="X"` calls):**

```
# Step 1: discover available transitions
jira_jira_get_transitions(issueIdOrKey="{ISSUE_KEY}", expand="transitions.fields")
# Response: { transitions: [{ id: "21", name: "Start Progress", to: { name: "En curso" } }, ...] }

# Step 2: find matching transition by target status name
# Match transitions[i].to.name case-insensitively against desired status (e.g., "En curso", "Listo")

# Step 3: execute with correct parameter
jira_jira_transition_issue(issueIdOrKey="{ISSUE_KEY}", transitionId="{found_transition.id}")
```

Parameter rename: `issueKey` → `issueIdOrKey` (matches MCP tool schema; `issueKey` is an undocumented alias that may not work on all MCP versions).

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Trigger matching | User phrases hit skill descriptions | Manual: say trigger phrases, verify skill loads. Cover: "qué tareas hay", "qué tenemos para hoy", "mostrame pendientes", "vamos con CSTR-XX", "creá el PR" |
| Transition correctness | Two-step transition works for Backlog→En curso and En curso→Listo | Manual: with a real Jira test issue, verify `get_transitions` returns expected transition, then execute it |
| Guardrails | Comment is posted before closing | Manual: simulate close flow, verify comment step cannot be skipped, verify STOP fires if no comment generated |
| AGENTS.md fallback | Rules apply when skill not loaded | Manual: clear loaded skills, ask "qué tareas hay", verify agent does NOT call auth_status and DOES call search_issues |

## Migration / Rollout

No migration required. Changes are isolated to skill files and a new AGENTS.md. Rollback is per-file: `git revert` for SKILL.md changes, delete `AGENTS.md`. Skills are installed globally; users must `custer-skills-jira update` or reinstall after merge to receive changes. Version bump to 1.7.0 recommended (non-breaking behavioral fixes, but new functionality — two-step transition).

## Open Questions

- [ ] What are the actual transition names/IDs in Custer's Jira workflow? The two-step approach handles any naming, but documenting expected transitions (e.g., "Start Progress" → En curso, "Done" → Listo) would help debugging.
- [ ] Does OpenCode's self-check use exact character matching, substring, or semantic similarity on description fields? If semantic, the trigger-first format may be optimized differently. Testing needed.
- [ ] Should AGENTS.md reference specific skill paths or use skill names? Path-based is more durable across installations.
