---
name: git-push-jira
description: "Git push + transicionar issues en Jira. Automatiza el flujo de inicio y cierre de tareas: commit con referencia, push, transicionar issue. Trigger: pushear y cerrar tarea, iniciar tarea, marcar como listo."
license: MIT
metadata:
  author: jtelg
  version: "1.1"
---

# SKILL: Git Push + Jira Close + Transiciones

> Automatiza el flujo de cierre de tareas: commit con referencia, push,
> transicionar issue en Jira. Detecta el proyecto automáticamente.

## When to Use

Use this skill when the user wants to start working on a task, commit changes,
push to remote, or transition a Jira issue.

- "pushea y cerra [CSTR-XX]"
- "termine con [tarea], pushea"
- "subí los cambios de [CSTR-XX]"
- "hace el push y cerrá la tarjeta"
- "marcar [CSTR-XX] como listo"
- "empecemos con [CSTR-XX]"
- "vamos a trabajar en [CSTR-XX]"

---

## 🔄 Flujo compartido de detección de proyecto

> ⚠️ Este flujo es COMPARTIDO entre los skills de custer-skills-jira.
> Si lo modificás, actualizá también `consulta-tareas-jira/SKILL.md`.

Siempre arrancar igual:

```
1. git remote get-url origin
2. Normalizar URL (HTTPS ↔ SSH)
3. GET https://ai.custer.com.ar/api/proyectos/por-github?url={url}
4. Si responde 404 → reintentar con ?name={repo_name}
5. Obtener jira_project_key y cliente_nombre
```

El endpoint también busca variantes de la URL (con/sin .git, SSH a HTTPS)
y como fallback busca por nombre del proyecto. Así cubre URLs tipeadas mal.

Esto te da el project key de Jira para ese repo (ej: CSTR, FONTE, etc).

---

## 🟢 INICIAR TAREA

Cuando el usuario dice "empecemos con CSTR-42" o "vamos a trabajar en [issue]":
o simplemente "{issue_key}" al inicio de la sesión.

```
1. Detectar proyecto (flujo compartido) → obtener jira_project_key

2. Transicionar issue a "En curso" vía MCP:
   jira_transition_issue(issueKey="CSTR-42", transition="En curso")

3. Traer la última versión de main:
   git checkout main
   git pull --rebase origin main

4. Crear rama a partir de main actualizado:
   git checkout -b fix/CSTR-42-descripcion-corta

5. Mostrar el título del issue para contexto
```

---

## ✅ CERRAR TAREA + PUSH

Cuando el usuario dice "pushea y cerrá CSTR-42" o "termine con [tarea]":

### Paso 1 — Detectar proyecto (flujo compartido)
Obtener `jira_project_key` del proyecto actual.

### Paso 2 — Verificar estado del repo

```bash
git status
git diff --stat
```

Reportar qué archivos cambiaron antes de continuar.

### Paso 3 — Determinar el issue key

Si el usuario mencionó explicitamente el issue (ej: CSTR-42), usarlo.
Si NO lo mencionó, buscar issues "En curso" en Jira:

```
jira_search(jql="project = {KEY} AND status = 'En curso' ORDER BY updated DESC", maxResults=5)
```

Mostrar la lista y preguntar cuál corresponde.

### Paso 4 — Verificar estado del issue en Jira

Antes de continuar, comprobar que tiene sentido cerrar el issue:

```
jira_get_issue(issueKey="{ISSUE_KEY}")
```

| Status actual | Qué hacer |
|--------------|-----------|
| **En curso** | Continuar normalmente |
| **Backlog** / **Pendiente** | Preguntar: "El issue está en '{status}'. ¿Querés iniciarlo y cerrarlo en este mismo push?" Si dice sí → `jira_transition_issue({KEY}, "En curso")` primero, después seguir |
| **Listo** | Informar que ya está cerrado. Preguntar si igual quiere pushear el código o fue un error |
| Otro | Preguntar si está seguro de cerrarlo desde este estado |

### Paso 5 — Stage y commit

Primero verificar si hay cambios sin commitear:

```bash
git status --porcelain
```

**Si hay archivos modificados sin stage:**

```bash
git add -A
git commit -m "<tipo>: <descripción breve> [{ISSUE_KEY}]"
```

**El `[{ISSUE_KEY}]` al final es OBLIGATORIO.**

| Tipo | Cuándo |
|------|--------|
| `fix` | Bug resuelto |
| `feat` | Feature nueva |
| `refactor` | Refactorización |
| `chore` | Mantenimiento |
| `docs` | Documentación |

Guardar el hash del commit.

**Si no hay cambios nuevos (ya commiteado):**
→ Usar el último commit: `git log -1 --format="%h %s"`
→ Confirmar con el usuario antes de pushear.

### Paso 6 — Push

```bash
git push origin <rama-actual>
```

Capturar mensaje de éxito.

### Paso 7 — Cerrar issue en Jira vía MCP

```
jira_transition_issue(issueKey="{ISSUE_KEY}", transition="Listo")
jira_add_comment(
  issueKey="{ISSUE_KEY}",
  comment="Resuelto en commit {hash} - rama: {rama}"
)
```

No esperar webhooks — esto funciona siempre porque es directo vía MCP.

### Paso 8 — Confirmación

```
✅ Push exitoso
Commit: abc1234
{ISSUE_KEY} → Listo
Ver en Jira: https://custer-desarrollo.atlassian.net/browse/{ISSUE_KEY}
```

---

## 🔍 CONSULTAR TAREAS PENDIENTES (PROYECTO ACTUAL)

Cuando el usuario pregunta "qué tareas hay para [CLIENTE]" o "qué tengo pendiente":

```
1. Detectar proyecto (flujo compartido) → obtener jira_project_key, jira_label, cliente_nombre

2. Consultar Jira filtrando por jira_label para traer SOLO las de este repo:
   jira_search(
     jql="project = {KEY} AND labels = '{jira_label}' AND status != 'Listo' ORDER BY priority ASC, created DESC",
     maxResults=10
   )

3. Mostrar:
   CSTR-42  |  Alta   | Bug: Login falla en mobile     |  En curso
   CSTR-38  |  Media  | Feature: Módulo de compras      |  Backlog
```

---

## ⚠️ Reglas importantes

1. **Nunca hacer push sin el issue key en el commit** — si el usuario no lo mencionó, preguntar.
2. **Siempre hacer `git status` primero** — nunca asumir qué cambió.
3. **El comentario en Jira con el hash del commit es obligatorio** — da trazabilidad.
4. **Detectar el proyecto primero** — no hardcodear CSTR. Cada repo puede tener su propio project key.
5. **Si el push falla**, no transicionar el issue. Resolver el error primero.
6. **Si hay conflictos**, reportarlos y pedir instrucciones.
7. **Transicionar vía MCP siempre** — no esperar webhooks de GitHub.
8. **Usar el label del cliente** en la consulta de tareas pendientes para filtrar bien.
9. **Verificar el estado del issue en Jira antes de cerrar** — si está en Backlog, preguntar; si ya está Listo, avisar.
10. **Siempre traer la última versión de main (`git pull --rebase`)** antes de crear una rama nueva. Evita trabajar sobre código viejo.

---

## 📎 Skills relacionados

| Skill | Ubicación | Qué hace |
|-------|-----------|----------|
| consulta-tareas-jira | `consulta-tareas-jira/` | Consultar y crear tareas |
