# Tasks: Fix Skill Workflow Automation

## Overview

Breakdown of the implementation into 7 concrete tasks across 4 groups. All tasks target declarative markdown/frontmatter changes — no code changes in `bin/cli.js`.

**Delivery strategy**: `auto-chain` — Single PR. Estimated total ~90 lines changed (under 400 threshold).

**Status**: ✅ All 7 tasks complete (sdd-apply phase).

---

## Task Group A — Skill Description Rewrites

### Task A1: Rewrite `consulta-tareas-jira` frontmatter description

| Field | Value |
|-------|-------|
| **Description** | Rewrite the YAML `description` in `consulta-tareas-jira/SKILL.md` to **lead with trigger phrases** so OpenCode's self-check matching auto-loads the skill on natural-language queries. The current description starts with general capability text ("Consultar y crear tareas de Jira desde OpenCode..."). Replace it to open with the exact trigger phrases listed in spec F1 (F1.1, F1.2, F1.3), then append the original content after a separator. |
| **Files affected** | `skills/consulta-tareas-jira/SKILL.md` (line 3 — YAML `description` field) |
| **Dependencies** | None |
| **Acceptance criteria** | 1. Description starts with trigger phrases: `qué tareas hay`, `qué tenemos para hoy`, `mostrame pendientes`, `cómo voy`, `creá una tarea en Jira`, `cargá esta tarea`<br>2. Original capability text preserved after trigger list<br>3. YAML frontmatter remains valid (colons, commas, quotes handled correctly)<br>4. File loads without parser error |
| **Risk** | Low — single-line string change in YAML frontmatter |

**Detailed spec mapping**: F1.1, F1.2, F1.3 — 3 trigger scenarios for consulta skill.

**Current value** (line 3):
```yaml
description: "Consultar y crear tareas de Jira desde OpenCode. Detecta el proyecto desde el repo Git, consulta tareas pendientes o crea nuevas issues directamente. Incluye el nombre del sistema entre corchetes en el summary para identificar el proyecto en el tablero compartido. Trigger: preguntar por tareas, crear tareas, cargar tareas."
```

**Target format** — trigger phrases first, then capability:
```yaml
description: "Trigger: 'qué tareas hay', 'qué tenemos para hoy', 'mostrame pendientes', 'cómo voy', 'creá una tarea en Jira', 'cargá esta tarea'. Consultar y crear tareas de Jira desde OpenCode. Detecta el proyecto desde el repo Git, consulta tareas pendientes o crea nuevas issues directamente. Incluye el nombre del sistema entre corchetes en el summary para identificar el proyecto en el tablero compartido."
```

---

### Task A2: Rewrite `git-push-jira` frontmatter description

| Field | Value |
|-------|-------|
| **Description** | Rewrite the YAML `description` in `git-push-jira/SKILL.md` to **lead with trigger phrases** so OpenCode's self-check matching auto-loads the skill whenever a `{PROJECT}-{NUM}` pattern or trigger phrase is mentioned. Current description starts with workflow summary ("INICIAR tarea (transicionar a En curso, crear rama)..."). Replace it to open with the exact trigger phrases from spec F1 (F1.4, F1.5, F1.6), then append the trigger list and original content. |
| **Files affected** | `skills/git-push-jira/SKILL.md` (line 3 — YAML `description` field) |
| **Dependencies** | None |
| **Acceptance criteria** | 1. Description leads with: `{PROJECT}-{NUM}`, `vamos con`, `empecemos`, `cerrá`, `pusheá y cerrá`, `generá un PR`, `creá el PR`<br>2. Original trigger examples preserved after lead phrases<br>3. YAML frontmatter remains valid<br>4. The `{PROJECT}-{NUM}` pattern is formatted for correct YAML (quoted to avoid brace interpretation) |
| **Risk** | Low — single-line string change in YAML frontmatter |

**Detailed spec mapping**: F1.4, F1.5, F1.6 — 3 trigger scenarios for git-push-jira skill.

**Current value** (line 3):
```yaml
description: "INICIAR tarea (transicionar a En curso, crear rama), CERRAR tarea (commit + push + PR + COMENTARIO OBLIGATORIO + transicionar a Listo). NUNCA cerrar sin comentar. Trigger: mencionar issue key (CSTR-42), 'vamos a trabajar', 'empecemos con', 'pushea y cerra', 'marcar como listo', 'generá un PR', 'creá el PR', 'termine con'. CUALQUIER formato {PROJECT}-{NUM} activa este skill."
```

**Target format** — trigger phrases first, then capability:
```yaml
description: "Trigger: '{PROJECT}-{NUM}' (cualquier formato), 'vamos con {PROJECT}-{NUM}', 'empecemos {PROJECT}-{NUM}', 'cerrá {PROJECT}-{NUM}', 'pusheá y cerrá', 'generá un PR para {PROJECT}-{NUM}', 'creá el PR'. INICIAR tarea (transicionar a En curso, crear rama), CERRAR tarea (commit + push + PR + COMENTARIO OBLIGATORIO + transicionar a Listo). NUNCA cerrar sin comentar."
```

---

## Task Group B — Fix Transition Calls

### Task B1: Update `git-push-jira` to use two-step transition pattern

| Field | Value |
|-------|-------|
| **Description** | Replace all **5 direct `jira_jira_transition_issue(transition="X")` calls** in the skill with the two-step discovery pattern: (1) `jira_jira_get_transitions(issueIdOrKey=...)` → (2) find transition matching `to.name` (case-insensitive) → (3) `jira_jira_transition_issue(issueIdOrKey=..., transitionId=<found.id>`). Also rename the `issueKey` parameter to `issueIdOrKey` everywhere in transition calls to match the documented MCP tool schema. |

**Locations to fix** (all in `skills/git-push-jira/SKILL.md`):

| # | Line(s) | Current call | Target status |
|---|---|---|---|
| 1 | ~25 (in 🚨 REGLA #1 doc section) | `jira_jira_transition_issue(transition="Listo")` | "Listo" |
| 2 | ~110 (INICIAR — cerrar anterior) | `jira_jira_transition_issue(issueKey="{ISSUE_ANTERIOR}", transition="Listo")` | "Listo" |
| 3 | ~122 (INICIAR — transicionar nueva) | `jira_jira_transition_issue(issueKey="{ISSUE_KEY}", transition="En curso")` | "En curso" |
| 4 | ~184 (CERRAR — iniciar si está en Backlog) | `jira_jira_transition_issue({KEY}, "En curso")` | "En curso" |
| 5 | ~294 (CERRAR — cerrar issue) | `jira_jira_transition_issue(issueKey="{ISSUE_KEY}", transition="Listo")` | "Listo" |

For each, replace with the two-step pattern:
```markdown
1. jira_jira_get_transitions(issueIdOrKey="{ISSUE_KEY}", expand="transitions.fields")
2. Find transition where to.name (case-insensitive) matches "En curso" (or "Listo")
3. jira_jira_transition_issue(issueIdOrKey="{ISSUE_KEY}", transitionId=<found_id>)
```

Also update the 🚨 REGLA #1 section (lines 17-28) to reference the new two-step parameter (`transitionId` instead of `transition="Listo"`).

| **Files affected** | `skills/git-push-jira/SKILL.md` — approx 10 instruction lines changed across 5 call sites |
| **Dependencies** | None |
| **Acceptance criteria** | 1. Zero remaining instances of `jira_jira_transition_issue(transition="X")` in the file<br>2. All 5 transition sites use the two-step `get_transitions` → `transitionId` pattern<br>3. Parameter name uses `issueIdOrKey` (new convention) instead of `issueKey`<br>4. Case-insensitive matching documented for `to.name` comparison<br>5. Error handling: if no matching transition found, STOP and report available transitions |
| **Risk** | Medium — multiple call sites, must ensure no transition call is missed |

**Detailed spec mapping**: F2 — Backlog → En curso via discovered transition (F2.1, F2.2, F2.3 scenarios).

---

### Task B2: Add explicit documentation about transition parameter names

| Field | Value |
|-------|-------|
| **Description** | Add a short documentation block in **both** skill files clarifying the transition parameter naming convention: MCP tools expect `issueIdOrKey` and `transitionId`, NOT `issueKey` or `transition`. This prevents ambiguity about parameter names across different MCP versions. Place this in a shared pattern section or in each skill's "Reglas importantes" / rules section. |
| **Files affected** | `skills/consulta-tareas-jira/SKILL.md` (add note if any transition reference exists, or add a general note in "Notas" section at line 258)<br>`skills/git-push-jira/SKILL.md` (add near "Reglas importantes" at line 329, or update existing transition docs in Regla #1) |
| **Dependencies** | B1 (should reference the new two-step pattern; can be done concurrently with B1 but logically follows it) |
| **Acceptance criteria** | 1. `skills/consulta-tareas-jira/SKILL.md` has a note about the parameter naming convention (even if it doesn't call transitions itself — for cross-reference)<br>2. `skills/git-push-jira/SKILL.md` has explicit docs: "Use `issueIdOrKey` (not `issueKey`) and `transitionId` (not `transition`)"<br>3. Documentation references the two-step `get_transitions` → `transitionId` pattern |
| **Risk** | Low — purely additive documentation |

---

## Task Group C — Closing Comment Guardrails

### Task C1: Add hard STOP checklist before transition in closing flow

| Field | Value |
|-------|-------|
| **Description** | Add a **hard STOP checklist** in the "CERRAR TAREA + PUSH + PR" section of `git-push-jira/SKILL.md`, **immediately before the transition step (Paso 9)**. The checklist MUST enforce: (1) Has `jira_jira_add_comment` been called for this issue? If NO → STOP. (2) Is the comment content non-empty? If empty → STOP. (3) Is this the closing transition (to "Listo")? If yes, double-check comment was posted. Use a visually distinct format (e.g., a box, numbered checklist with bold STOP indicators). |
| **Files affected** | `skills/git-push-jira/SKILL.md` — insert before Paso 9 (currently at line ~287-294) |
| **Dependencies** | B1 (the transition step is being rewritten; guardrail must reference the new `transitionId` parameter) |
| **Acceptance criteria** | 1. STOP checklist appears before every close transition, not after<br>2. Checklist items are concrete actions, not abstract rules<br>3. The checklist explicitly says: "If no comment was posted → STOP. Do NOT call transition_issue."<br>4. Format is visually scannable (block, checkboxes, or bold markers) |
| **Risk** | Low — additive text, no code changes |

---

### Task C2: Add verification step that comment was posted before allowing transition

| Field | Value |
|-------|-------|
| **Description** | Add a **concrete verification instruction** that changes the agent's behavior from "trust the checklist" to "prove the comment exists." The instruction should tell the agent to: (1) After calling `jira_jira_add_comment`, store the fact that a comment was posted (in internal state or by noting it). (2) Before calling `jira_jira_transition_issue` with a "Listo" transition, VERIFY that `jira_jira_add_comment` was executed for THIS issue in THIS session. (3) If verification fails, abort and report: "Cannot close without a comment. Generate the diff summary first." |
| **Files affected** | `skills/git-push-jira/SKILL.md` — add as a sub-step in Paso 9 (or as a separate Paso 8.5 between comment generation and transition) |
| **Dependencies** | B1 (transition step must exist in its new form before we add verification around it) |
| **Acceptance criteria** | 1. Verification instruction is explicit: "Verify jira_jira_add_comment was called for this issue before calling transition_issue"<br>2. The abort message follows spec F3: "Cannot close without a comment. Generate the diff summary first."<br>3. The verification is not optional — it's a blocking step |
| **Risk** | Low — additive text, but the agent must understand how to "verify" (it's a behavioral instruction, not code enforcement) |

**Detailed spec mapping**: F3 — Comment-before-transition hard guardrail (F3.1, F3.2 scenarios).

---

## Task Group D — Project AGENTS.md

### Task D1: Create AGENTS.md at repo root

| Field | Value |
|-------|-------|
| **Description** | Create a new `AGENTS.md` file at the repository root with hard project-level rules that activate regardless of skill loading state. These rules serve as a safety net when OpenCode's skill matching algorithm doesn't load the expected skill. Rules must cover: (1) Never check `jira_auth_status` before calling Jira tools — call tools directly and handle failures gracefully. (2) Auto-detect when user mentions a `{PROJECT}-{NUM}` pattern (any format, any project key). (3) Auto-detect Jira-related queries (task questions, issue creation requests). (4) Never close an issue without posting a comment first — this is enforced at project level, not just skill level. (5) Self-referential fallback: "When skill doesn't load, project rules still apply." Format should follow OpenCode AGENTS.md conventions: concise, imperative, with clear trigger conditions and actions. |
| **Files affected** | `AGENTS.md` (new file, repo root) |
| **Dependencies** | None |
| **Acceptance criteria** | 1. File exists at `C:\Users\Usuario\Desktop\DEV\custer-skills-jira\AGENTS.md`<br>2. Contains all 5 rules from spec F4<br>3. Rules are imperative ("NEVER do X", "ALWAYS do Y") not advisory<br>4. Uses simple markdown — no complex syntax that could break parsing<br>5. Rules reference Jira tool names matching the MCP schema (`jira_jira_search_issues`, `jira_jira_add_comment`, etc.) |
| **Risk** | Low — new file, cannot break existing behavior |

**Detailed spec mapping**: F4 — Project-level fallback rules (F4.1–F4.5).

---

## Summary

### Estimated Lines Changed

| Task | Lines Added | Lines Modified | Lines Deleted | Net Change |
|------|-------------|----------------|---------------|------------|
| A1 | 1 | 1 | 0 | ~1 |
| A2 | 1 | 1 | 0 | ~1 |
| B1 | ~20 | ~15 | ~10 | ~25 |
| B2 | ~8 | 0 | 0 | ~8 |
| C1 | ~15 | 0 | 0 | ~15 |
| C2 | ~8 | 0 | 0 | ~8 |
| D1 | ~30 | 0 | 0 | ~30 |
| **Total** | **~83** | **~17** | **~10** | **~90** |

### Dependency Graph

```
A1 (no deps) ─┐
               ├── (parallel, merge into single PR)
A2 (no deps) ─┤
               │
B1 (no deps) ──┤──> B2 (depends on B1)
               │──> C1 (depends on B1)
               │──> C2 (depends on B1)
               │
D1 (no deps) ──┘
```

All tasks are **independent in content** (separate files or non-overlapping sections) but B2, C1, and C2 logically follow B1 because they reference the new two-step transition pattern. Implementation order: **A1, A2, B1, D1 in parallel → then B2, C1, C2**.

### Review Workload Forecast

| Metric | Value |
|--------|-------|
| **Total estimated lines changed** | ~90 (net) |
| **400-line threshold for chaining** | ❌ Not exceeded — single PR |
| **Files changed** | 3 files modified + 1 new file |
| **Review complexity** | Low — purely declarative markdown/frontmatter changes. No code, no logic, no tests |
| **Chaining required?** | **No** — well under 400 lines |

### Risk Summary

| Risk | Tasks | Mitigation |
|------|-------|------------|
| YAML syntax error | A1, A2 | Verify frontmatter with a YAML parser after edit; check colons, quotes, special chars |
| Missed transition call site | B1 | grep for all `transition("X")` and `transition_issue` patterns; must find 5 sites |
| Agent non-compliance (ignores guardrail) | C1, C2 | Hard STOP wording + AGENTS.md level enforcement provides double coverage |
| AGENTS.md conflicts | D1 | Keep rules concise and additive — no negation of existing behavior |
