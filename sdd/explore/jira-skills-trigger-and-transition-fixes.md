# Exploration: Jira Skills Auto-Trigger & Transition Reliability

## Current State

The `custer-skills-jira` repo contains two OpenCode skills installed globally in `~/.config/opencode/skills/`:

| Skill | Version | Purpose |
|-------|---------|---------|
| `consulta-tareas-jira` | 1.4 | Query/create Jira tasks via MCP |
| `git-push-jira` | 1.5 | Start/close tasks with git + Jira transitions |

Both skills share a project-detection flow (git remote → normalize URL → call `ai.custer.com.ar/api/proyectos/por-github` → get `jira_project_key` + `jira_label`).

Jira MCP is correctly configured in `opencode.json` with `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN`.

---

## Affected Areas

- `skills/consulta-tareas-jira/SKILL.md` — skill frontmatter description, trigger matching, auth handling instructions
- `skills/git-push-jira/SKILL.md` — transition parameter bugs, comment ordering rules, trigger matching
- `~/.config/opencode/AGENTS.md` — agent self-check protocol for skill loading
- `~/.config/opencode/opencode.json` — MCP Jira configuration (correct, not the issue)

---

## Problems Identified & Root Causes

### Problem 1 — Jira Access Not Auto-Triggering

**Symptom:** User says *"qué tareas hay para hoy"* or *"qué tenemos para hoy"* → agent responds *"no tengo acceso a Jira"*. But when user says *"buscá en memoria"* or explicitly invokes the skill, it works.

**Root Cause: The `jira_auth_status` trap when the skill is NOT loaded.**

Both skills contain an explicit warning (line 134-137 in consulta-tareas-jira, line 88-91 in git-push-jira):

> 🔴 **No uses `jira_auth_status` para verificar antes.** Las credenciales están en `opencode.json`. El `auth_status` siempre devuelve `false` al inicio aunque las herramientas funcionen.

**The causal chain:**
1. User asks about tasks → agent's self-check does NOT match the skill description reliably
2. Skill is NOT loaded → agent does NOT see the "don't use auth_status" warning
3. Agent checks `jira_auth_status` → returns `false`
4. Agent concludes *"no tengo acceso a Jira"* and never tries the actual tools
5. When user explicitly mentions the skill, it loads → agent sees the warning → calls tools directly → works

**Why the self-check fails:** The skill frontmatter `description` fields are dense and don't lead with exact user trigger phrases. The agent's matching algorithm (per AGENTS.md: *"Self-check BEFORE every response: does this request match any skill in `<available_skills>`?"*) likely does fuzzy/keyword matching against the description. If the description doesn't prominently contain the user's exact phrasing (e.g., "qué tenemos para hoy"), the match fails.

---

### Problem 2 — Backlog → En curso Transition Unreliable

**Symptom:** Starting a task doesn't reliably transition from Backlog to En curso.

**Root Cause: Using STATUS name instead of TRANSITION name/ID, plus wrong parameter name.**

In `git-push-jira/SKILL.md` line 122:
```markdown
jira_jira_transition_issue(issueKey="{ISSUE_KEY}", transition="En curso")
```

**Two bugs here:**
1. **Wrong parameter name:** The actual MCP tool `jira_jira_transition_issue` requires `transitionId` (string), not `transition`. If the MCP server is strict about parameter names, passing `transition` ignores the required `transitionId` and the call fails or uses a default.
2. **Status vs Transition confusion:** "En curso" is a **STATUS** (the destination state), not a **TRANSITION** (the workflow action that moves the issue). In Jira, transitions have names like "Start Progress", "Done", "Close", "In Progress" — they are NOT the same as status names. The transition that moves from Backlog → En curso in Custer's workflow is likely named something else (e.g., "Start Progress", "Comenzar", or an ID like "21"). Calling `transitionId="En curso"` passes a status name where a transition name/ID is expected.

**Why it might work sometimes:** Some MCP implementations or Jira workflows might accept the target status name as a shorthand if there's only one transition leading to it, or if the transition happens to be named identically to the status. This creates the "unreliable" behavior — it works in some cases, fails in others.

The closing transition `transition="Listo"` (line 294) might work more reliably because the transition from "En curso" → "Listo" might actually be named "Listo" in the workflow, or because there's only one outgoing transition from "En curso".

---

### Problem 3 — Closing Comments Skipped or Out of Order

**Symptom:** When finishing a task, the agent sometimes transitions to "Listo" without adding a detailed comment first, or the comment lacks file paths and technical details.

**Root Cause: Skill not loaded + no guardrails on generic git behavior.**

The `git-push-jira` skill has **excellent** instructions for this (REGLA #1, lines 17-28):
> **NUNCA CERRAR SIN COMENTAR** — comment FIRST, then transition.

And Paso 9 (lines 290-295) shows the exact order:
```
jira_jira_add_comment(...)
jira_jira_transition_issue(..., transition="Listo")
```

**So why does it fail?**
1. If `git-push-jira` is NOT loaded (because the trigger didn't match), the agent falls back to generic git behavior: `git add`, `git commit`, `git push`, maybe `gh pr create`. It has NO knowledge of the Jira comment requirement.
2. Even when loaded, if the comment generation step encounters an error (e.g., `git diff` fails, no changes on branch), the agent might skip the comment and proceed to transition.
3. There are no explicit "guardrails" in the skill: no instruction saying "If you haven't generated a comment, STOP and do NOT transition."

---

## Approaches

### Approach A: Fix Skill Content Only (Low-Med Effort)

Fix the SKILL.md files directly:
1. **Frontmatter descriptions:** Rewrite to start with exact trigger phrases the user says
2. **Transition calls:** Replace `transition="..."` with a `get_transitions` → find correct ID → transition flow
3. **Add guardrails:** Explicit "STOP if no comment" rules

**Pros:** No external dependencies, quick to implement  
**Cons:** Still relies on agent's fuzzy skill matching; doesn't solve the auth_status trap completely

### Approach B: Fix Skills + Add Project-Level AGENTS.md (Med Effort)

Do Approach A, PLUS add a project-level `AGENTS.md` in this repo that instructs:
- "When user mentions Jira, tasks, or issue keys, ALWAYS load the corresponding skill BEFORE checking auth"
- "NEVER call `jira_auth_status` before attempting Jira tool calls"

**Pros:** Catches the agent even when fuzzy matching fails; provides fallback layer  
**Cons:** AGENTS.md parsing depends on OpenCode version; adds maintenance surface

### Approach C: Fix Skills + Create a Unified Meta-Skill (High Effort)

Merge both skills into a single `custer-jira` skill that handles ALL Jira interactions (query, create, start, close). A single skill has a broader trigger surface and avoids the "which skill to load" problem.

**Pros:** Single skill = single trigger check; simpler mental model; avoids duplication  
**Cons:** Large skill file; violates single-responsibility; more testing needed

---

## Recommendation

**Go with Approach A + B.**

1. **Fix skill frontmatter descriptions** to be trigger-rich and front-loaded with exact user phrases
2. **Fix all `jira_jira_transition_issue` calls** to first query transitions with `jira_jira_get_transitions`, then use the correct `transitionId`
3. **Add "STOP" guardrails** in the closing flow: "Si no generaste un comentario detallado, NO transiciones a Listo"
4. **Add project-level `AGENTS.md`** with a hard rule: "NEVER check `jira_auth_status` before calling Jira tools. If a user mentions tasks, issues, or Jira, load the custer-skills-jira skills immediately."

---

## Risks

- **Transition ID discovery adds latency:** Calling `get_transitions` before every transition is an extra API call. Could cache common transition IDs per project.
- **Agent still might not self-check:** OpenCode's skill loading mechanism is not fully documented. If the matching is broken at the platform level, description changes might not help.
- **Breaking existing flows:** Changing parameter names from `transition` to `transitionId` could break if the MCP server actually accepts `transition` as an alias. Must test against real Jira instance.

---

## Ready for Proposal?

**Yes.** The root causes are clear and the fixes are well-scoped. The orchestrator should proceed to `sdd-propose` for a change named something like `jira-skills-trigger-and-transition-fixes`.

### What the orchestrator should tell the user:
> Encontré las tres causas raíz. El problema #1 es que cuando el skill no carga, el agente chequea `jira_auth_status` (que siempre devuelve false al inicio) y se rinde antes de intentar. El #2 es que estamos pasando `transition="En curso"` cuando la herramienta necesita `transitionId` con un nombre/ID de transición de workflow, no un status. El #3 es que cuando el skill no carga, el agente hace git push genérico sin saber que tiene que comentar en Jira. Los fixes son: reescribir las descripciones para que matcheen mejor, usar `get_transitions` antes de transicionar, y agregar guardias de "sin comentario no cerrar".
