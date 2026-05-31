# Spec: Fix Skill Workflow Automation

## Context

Three root-cause bugs prevent reliable Jira workflow automation: skills don't auto-trigger on natural queries (F1), Backlog→En curso transitions fail because `transitionId` is swapped for a status name (F2), and closing comments are skipped when skills aren't loaded (F3). A project-level AGENTS.md adds hard fallback rules (F4).

Each functional requirement below maps to exactly one fix.

---

## 1. Functional Requirements

### F1 — Skill Auto-Trigger on Natural Language

The YAML `description` field in each SKILL.md MUST lead with user-facing trigger phrases the agent's skill matching system can match against. The system SHALL NOT require manual skill loading for common task-related queries.

| # | Trigger phrase | Skill that MUST activate |
|---|---|---|
| F1.1 | `qué tareas hay` / `qué tenemos para hoy` | consulta-tareas-jira |
| F1.2 | `mostrame pendientes` / `cómo voy` | consulta-tareas-jira |
| F1.3 | `creá una tarea en Jira` / `cargá esta tarea` | consulta-tareas-jira |
| F1.4 | `vamos con {PROJECT}-{NUM}` / `empecemos {PROJECT}-{NUM}` | git-push-jira |
| F1.5 | `cerrá {PROJECT}-{NUM}` / `pusheá y cerrá` | git-push-jira |
| F1.6 | `generá un PR para {PROJECT}-{NUM}` / `creá el PR` | git-push-jira |

#### Scenario: Natural query triggers consulta skill

- GIVEN the user types "qué tareas hay para hoy" with no skill pre-loaded
- WHEN the agent processes the message
- THEN the `consulta-tareas-jira` skill MUST auto-load via YAML description matching
- AND the agent MUST proceed to detect the project and query Jira

#### Scenario: Issue key triggers git-push-jira

- GIVEN the user types "vamos con CSTR-42"
- WHEN the agent processes the message
- THEN the `git-push-jira` skill MUST auto-load
- AND the agent MUST NOT check `jira_auth_status` before calling Jira tools

### F2 — Backlog → En Curso via Discovered Transition

The system MUST NOT pass a status name (`"En curso"`) as the `transition` parameter. Instead, it MUST call `jira_jira_get_transitions(issueKey)` first, match the returned transition whose `to.name` equals the target status (case-insensitive), and pass `transitionId` to `jira_jira_transition_issue`.

#### Scenario: Happy path — single transition to "En curso"

- GIVEN an issue in "Backlog" status
- WHEN the agent calls `jira_jira_get_transitions("CSTR-42")`
- THEN the response includes a transition with `to.name === "En curso"`
- AND the agent calls `jira_jira_transition_issue(issueKey="CSTR-42", transitionId=<returned id>)`
- AND the issue transitions to "En curso" without error

#### Scenario: Multiple transitions — pick correct `to.name`

- GIVEN `get_transitions` returns 3 transitions with `to.name` values `"En curso"`, `"Cancelado"`, `"En revisión"`
- WHEN the agent searches for the one matching `"En curso"` (case-insensitive)
- THEN it picks the transition whose `to.name` equals `"En curso"`
- AND calls `transition_issue` with that transition's ID

#### Scenario: No transition to target status — STOP and report

- GIVEN `get_transitions` returns no transition whose `to.name` matches `"En curso"`
- WHEN the agent cannot find a valid transition
- THEN the agent MUST NOT attempt any transition
- AND the agent MUST report the available transitions to the user and ask for guidance

### F3 — Comment-Before-Transition (Hard Guardrail)

The close workflow MUST enforce: `jira_jira_add_comment` executes BEFORE `jira_jira_transition_issue(... , transitionId=<to Listo>)`. Reversing this order is a specification violation.

#### Scenario: Normal close with comment

- GIVEN the user says "cerrá CSTR-42"
- WHEN the agent generates the detailed comment from `git diff main...HEAD`
- THEN the agent calls `jira_jira_add_comment(issueKey="CSTR-42", comment=<diff summary>)` FIRST
- AND only THEN calls `jira_jira_transition_issue(issueKey="CSTR-42", transitionId=<id for "Listo">)`

#### Scenario: Transition attempted without prior comment — forbidden

- GIVEN the agent attempts to call `jira_jira_transition_issue` with transition to "Listo"
- WHEN no `jira_jira_add_comment` call was made for this issue first
- THEN the agent MUST abort the transition
- AND the agent MUST report: "Cannot close without a comment. Generate the diff summary first."

### F4 — Project-Level Fallback Rules (AGENTS.md)

A project-root `AGENTS.md` MUST contain hard rules that activate regardless of skill loading state. These rules SHALL cover:

| Rule | Enforcement |
|---|---|
| Never check `jira_auth_status` before calling Jira tools | Text rule in AGENTS.md |
| Always call Jira tools directly; fall back only on actual failure | Text rule in AGENTS.md |
| Never close an issue without posting a comment first | Text rule in AGENTS.md |
| Auto-detect when user mentions a `{PROJECT}-{NUM}` pattern | Text rule in AGENTS.md |
| When skill doesn't load, project rules still apply | Self-referential fallback |

#### Scenario: Agent without loaded skill still follows rules

- GIVEN no skill is loaded for the session
- WHEN the user types "qué tareas hay"
- THEN the agent reads AGENTS.md rules
- AND the agent attempts `jira_jira_search_issues` directly without calling `jira_auth_status` first

---

## 2. Non-Functional Requirements

| ID | Requirement | Strength |
|---|---|---|
| NF1 | All changes MUST be self-contained in this repo — no external API, Jira config, or tool changes | SHALL |
| NF2 | Existing workflows (consulta + git-push-jira) MUST continue working without changes to user-visible behavior beyond bugfixes | MUST |
| NF3 | YAML description changes MUST NOT introduce syntax errors — frontmatter parsers MUST accept the file | MUST |
| NF4 | Transition matching MUST be case-insensitive on `to.name` | MUST |

---

## 3. User Stories / Scenarios (End-to-End)

### Story 1: Daily task check-in

> "Che, qué tareas hay para hoy?"

1. `consulta-tareas-jira` loads via YAML trigger match
2. Agent detects repo, calls API → gets `jira_project_key` + `jira_label`
3. Agent calls `jira_jira_search_issues` (NO `auth_status` check)
4. Returns formatted list of pending tasks

### Story 2: Start working on a task

> "Vamos con CSTR-42"

1. `git-push-jira` loads via `{PROJECT}-{NUM}` trigger
2. Agent calls `jira_jira_get_transitions("CSTR-42")`
3. Agent matches transition whose `to.name` == "En curso"
4. Agent calls `jira_jira_transition_issue(transitionId=<correct>)`
5. `git checkout main && git pull --rebase && git checkout -b fix/CSTR-42-...`

### Story 3: Close and push

> "Terminé con CSTR-42"

1. `git-push-jira` loads
2. `git add` + `git commit` + `git push` + `gh pr create`
3. `git diff main...HEAD` → builds detailed comment
4. `jira_jira_add_comment(...)` ← FIRST
5. `jira_jira_get_transitions("CSTR-42")` → find "Listo" transition
6. `jira_jira_transition_issue(transitionId=<correct>)` ← AFTER comment
7. Confirmation with Jira URL

---

## 4. Boundary Cases

| Case | Expected behavior |
|---|---|
| `get_transitions` returns empty array | Log available statuses, ask user which transition to use |
| No remote Git URL configured | Report "Not in a Git repo with a remote origin" — stop |
| Jira MCP tool times out | Retry once after 5s; if still fails, report Jira connectivity issue |
| Issue key format not recognized | Ask user to confirm the key pattern; fall back to search |
| `main` branch doesn't exist locally | Try `master`; if neither exists, report and stop |
| Git has uncommitted changes that can't be staged | Report dirty state, ask user to commit or stash manually |
| AGENTS.md conflicts with opencode base rules | AGENTS.md project rules take precedence for this repo |
