# Archive Report: fix-skill-workflow-automation

**Archive date**: 2026-05-31
**Status**: ✅ Complete — fully implemented and verified

---

## Change Summary

Fixed three root-cause bugs in the Jira workflow automation:

| Bug | Root Cause | Fix |
|-----|------------|-----|
| F1 — Skills don't auto-trigger | YAML `description` fields lead with capability text instead of trigger phrases | Rewrote both SKILL.md descriptions with trigger-first format |
| F2 — Backlog→En curso fails | `jira_jira_transition_issue(transition="En curso")` passes a status name instead of a transition ID | Replaced all 5 direct transition calls with two-step `get_transitions` → `transitionId` pattern |
| F3 — Closing comments skipped | No hard guardrail enforcing comment-before-transition | Added STOP checklist + verification step + AGENTS.md project-level rule |
| F4 — No fallback when skills don't load | No project-level rules file | Created AGENTS.md with 5 hard rules as safety net |

## Tasks Implemented

| Task | Status | Description | Files Affected |
|------|--------|-------------|---------------|
| A1 | ✅ Done | Rewrite consulta-tareas-jira description (trigger-first) | `skills/consulta-tareas-jira/SKILL.md` |
| A2 | ✅ Done | Rewrite git-push-jira description (trigger-first with {PROJECT}-{NUM}) | `skills/git-push-jira/SKILL.md` |
| B1 | ✅ Done | Replace 5 transition calls with two-step pattern | `skills/git-push-jira/SKILL.md` |
| B2 | ✅ Done | Add MCP Tool Reference table to both skills | `skills/consulta-tareas-jira/SKILL.md`, `skills/git-push-jira/SKILL.md` |
| C1 | ✅ Done | Add STOP checklist before closing transition | `skills/git-push-jira/SKILL.md` |
| C2 | ✅ Done | Add verification step after comment posting | `skills/git-push-jira/SKILL.md` |
| D1 | ✅ Done | Create AGENTS.md with 5 project-level rules | `AGENTS.md` |

## Verification

- **Spec coverage**: All 4 functional requirements (F1–F4) implemented and verified
- **Transition calls**: Zero remaining instances of old `transition="X"` format
- **Parameter names**: All call sites use `issueIdOrKey` + `transitionId` instead of `issueKey` + `transition`
- **Est. lines changed**: ~90 net (3 files modified + 1 new file)
- **Blockers**: None

## Engram Artifacts (for traceability)

| Artifact | Observation ID |
|----------|---------------|
| proposal | #638 |
| spec | #639 |
| design | #640 |
| tasks | #641 |
| apply-progress | #642 |

## Files Changed (Final State)

| File | Action | Summary |
|------|--------|---------|
| `skills/consulta-tareas-jira/SKILL.md` | Modified | Trigger-first description; MCP Tool Reference table |
| `skills/git-push-jira/SKILL.md` | Modified | Trigger-first description; 6 transition calls → two-step pattern; STOP checklist; verification step; MCP Tool Reference table. Version bumped 1.5→1.6 |
| `AGENTS.md` | Created | 5 hard project rules (no auth_status, auto-load skills, comment enforcement, project detection) |
