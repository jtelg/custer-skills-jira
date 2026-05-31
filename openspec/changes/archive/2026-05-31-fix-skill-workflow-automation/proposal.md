# Proposal: Fix Skill Workflow Automation

## Intent

Skills don't auto-trigger on natural queries, Backlog→En curso transitions fail, and closing comments get skipped. Fix the three root causes so the Jira workflow runs reliably without manual skill loading or user intervention.

## Scope

### In Scope
- Rewrite YAML descriptions with exact trigger phrases to improve skill auto-detection
- Replace hardcoded `transition="En curso"` with `get_transitions` → correct transition ID
- Add STOP guardrails and correct param names for transitions (transitionId)
- Add project `AGENTS.md` with hard rules as fallback when skills don't load

### Out of Scope
- Jira auth mechanism itself (creds stored in opencode.json, not changing)
- Backend API changes (ai.custer.com.ar endpoints unchanged)
- MCP tool behavior (we adapt to it, not change it)
- Non-Jira workflow automation

## Capabilities

No spec-level changes — this is a pure behavioral fix of existing skills. All changes are implementation-level: trigger matching, transition calls, and guardrails.

### New Capabilities
None

### Modified Capabilities
None

## Approach

**File 1 — `skills/consulta-tareas-jira/SKILL.md`:**
- Rewrite `description` in YAML frontmatter. Lead with trigger phrases users actually say: "qué tareas hay", "qué tenemos para hoy", "mostrame pendientes", "creá una tarea en Jira". End with a clear `Trigger:` anchor.

**File 2 — `skills/git-push-jira/SKILL.md`:**
- Fix every `jira_jira_transition_issue(transition="X")` → `jira_jira_transition_issue(transitionId="X")`
- Before any transition, add a step: call `jira_jira_get_transitions(issueKey)` → pick the correct transition by `to.name` matching the desired status
- Reinforce comment-before-transition with an explicit STOP pattern (checklist, not just paragraph)
- Update YAML description with user-facing trigger patterns

**File 3 — `AGENTS.md` (project root):**
- Add hard project-wide rules: "Always try Jira tools before giving up", "Never close without commenting", "Auto-load skill when issue key detected"
- These activate regardless of skill loading state

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `skills/consulta-tareas-jira/SKILL.md` | Modified | YAML description rewrite for trigger matching |
| `skills/git-push-jira/SKILL.md` | Modified | Fix transition params, add get_transitions step, reinforce guardrails |
| `AGENTS.md` (project root) | New | Hard rules as fallback when skills don't auto-load |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| New descriptions still miss edge-case triggers | Low | Add common patterns; iterate as gaps appear |
| get_transitions returns unexpected names | Low | Match by `to.name` case-insensitively, fallback to first transition to desired status |
| AGENTS.md rule order conflicts with opencode base rules | Low | Test with real queries; adjust placement if needed |

## Rollback Plan

Revert individual file changes. Each file is independent — roll back `AGENTS.md` by deleting it, roll back each SKILL.md via `git revert` on the specific file commit.

## Dependencies

None — all changes are self-contained within this repo. No external services, API changes, or Jira config changes needed.

## Success Criteria

- [ ] User says "qué tareas hay" → skill loads automatically → Jira query runs
- [ ] User says "vamos con CSTR-XX" → issue transitions Backlog→En curso without errors
- [ ] User says "cerrá CSTR-XX" → comment is posted BEFORE transition (never reversed)
- [ ] Without skill loaded, asking about Jira still triggers the right behavior (AGENTS.md fallback)
