---
name: git-push-jira
description: "INICIAR tarea (cierra la anterior, transiciona a En curso, crear rama), CERRAR tarea (commit + push + PR + transicionar a Listo). Trigger: mencionar issue key (CSTR-42), 'vamos a trabajar', 'empecemos con', 'pushea y cerra', 'marcar como listo', 'subí los cambios', 'cerrá la tarjeta', 'generá un PR', 'creá el PR', 'termine con'. CUALQUIER formato {PROJECT}-{NUM} activa este skill."
license: MIT
metadata:
  author: jtelg
  version: "1.4"
---

# SKILL: Git Push + Jira Close + Transiciones

> Automatiza el flujo completo: iniciar tarea → commit + push + PR → cerrar issue.
> Detecta el proyecto automáticamente desde el repo Git.

---

## ⚠️ REGLA DE ORO: ACTIVACIÓN AUTOMÁTICA

**Cuando el usuario mencione un issue key de Jira** (ej: `CSTR-42`, `FONTE-7`, `MXTS-123`)
**en cualquier contexto**, este skill DEBE activarse:

- Si dice **"vamos con CSTR-42"** o **"empecemos CSTR-42"** → seguir **🟢 INICIAR TAREA**
- Si dice **"pusheá y cerrá CSTR-42"** o **"terminé con CSTR-42"** o **"generá un PR para CSTR-42"** o **"creá el PR"** → seguir **✅ CERRAR TAREA + PUSH**
- Si solo dice el **issue key suelto** (ej: "CSTR-42") → asumir que quiere **iniciar la tarea**, preguntar si no está seguro
- Si dice **"bien", "listo", "siguiente", "sigamos", "terminamos", "próxima"** + issue key → primero preguntar si cerrar la anterior, luego iniciar la nueva
- Si dice **"termine con esta y arranquemos CSTR-XX"** → asumir que quiere cerrar y empezar

**NO ESPERES a que el usuario pida explícitamente.** Si menciona un issue key,
cargá este skill y ejecutá el flujo que corresponda.

---

## When to Use

Use this skill when the user:
- Mentions a Jira issue key (`{PROJECT}-{NUM}`) — **siempre**
- Wants to start working on a task
- Wants to commit, push, create a PR, or close a task

Triggers:
- "vamos con [CSTR-XX]", "empecemos con [CSTR-XX]", "arranquemos [CSTR-XX]"
- "[CSTR-XX]" suelto al inicio de la conversación
- "pushea y cerra [CSTR-XX]", "termine con [tarea]"
- "subí los cambios de [CSTR-XX]", "cerrá la tarjeta"
- "marcar [CSTR-XX] como listo"
- **"generá un PR para [CSTR-XX]", "creá el PR de [CSTR-XX]"**
- **"bien", "listo", "sigamos", "terminamos", "próxima"** + mención de issue
- **"termine con esta y arranquemos [CSTR-XX]"**
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

> 🔴 **No uses `jira_auth_status` para verificar credenciales.** Las credenciales
> están configuradas en `opencode.json`. El `auth_status` siempre devuelve `false`
> al inicio aunque las herramientas funcionen. Llamá directamente a las herramientas
> de Jira y si fallan por auth, reintentá automáticamente.

---

## 🟢 INICIAR TAREA

**Activación automática**: cuando el usuario dice "vamos con [issue]", "empecemos [issue]",
o simplemente menciona un issue key al inicio.

```
1. Detectar proyecto (flujo compartido) → obtener jira_project_key

2. ANTES de arrancar, verificar si hay otra tarea "En curso":
   Buscar issues con status "En curso":
   jira_search_issues(jql="project = {KEY} AND status = 'En curso' ORDER BY updated DESC", maxResults=3)

   SI hay alguna Y es distinta a la nueva:
     → PREGUNTAR al usuario: "Tenés {ISSUE_ANTERIOR} en 'En curso'. ¿La damos por terminada antes de arrancar?"
     → Si dice sí:
        - Transicionar a "Listo": jira_transition_issue(issueKey="{ISSUE_ANTERIOR}", transition="Listo")
        - Comentar: jira_add_comment(issueKey="{ISSUE_ANTERIOR}", comment="Cerrada al iniciar {ISSUE_NUEVA}")
        - Informar: "✅ {ISSUE_ANTERIOR} → Listo"
     → Si dice no:
        - Dejarla como está, seguir con la nueva

3. Traer el título del issue nuevo para contexto:
   jira_get_issue(issueKey="{ISSUE_KEY}")
   Mostrar el título al usuario
   (En OpenCode el tool real es `jira_jira_get_issue`)

4. Transicionar issue nuevo a "En curso" vía MCP:
   jira_transition_issue(issueKey="{ISSUE_KEY}", transition="En curso")
   (En OpenCode el tool real es `jira_jira_transition_issue`)

5. Traer la última versión de main:
   git checkout main
   git pull --rebase origin main

6. Crear rama a partir de main actualizado:
   git checkout -b fix/{ISSUE_KEY}-descripcion-corta

7. Confirmar al usuario:
   ✅ {ISSUE_KEY} → En curso
   Rama: fix/{ISSUE_KEY}-descripcion
   Título: {summary del issue}
```

---

## ✅ CERRAR TAREA + PUSH + PR

Cuando el usuario dice "pushea y cerrá CSTR-42", "termine con [tarea]", o **"generá un PR"**:

### Paso 1 — Detectar proyecto (flujo compartido)
Obtener `jira_project_key` del proyecto actual.

### Paso 2 — Determinar el issue key

Si el usuario mencionó explicitamente el issue (ej: CSTR-42), usarlo.
Si NO lo mencionó, buscar issues "En curso" en Jira:

```
jira_search_issues(jql="project = {KEY} AND status = 'En curso' ORDER BY updated DESC", maxResults=5)
```

Mostrar la lista y preguntar cuál corresponde.

### Paso 3 — Verificar estado del repo

```bash
git status
git diff --stat
```

Reportar qué archivos cambiaron antes de continuar.

### Paso 4 — Verificar estado del issue en Jira

Antes de continuar, comprobar que tiene sentido cerrar el issue:

```
jira_get_issue(issueKey="{ISSUE_KEY}")
(En OpenCode el tool real es `jira_jira_get_issue`)
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

### Paso 7 — Crear PR (si aplica)

Si el usuario dijo "generá un PR" o "creá el PR", o no hay más commits pendientes:

```bash
gh pr create --title "<tipo>: <descripción> [{ISSUE_KEY}]" --body "## Summary\n- Implementa {ISSUE_KEY}\n\nCloses #{ISSUE_KEY}"
```

Si el PR ya existe (rama ya pusheada antes), avisar y pasar al siguiente paso.

### Paso 8 — Generar comentario detallado en Jira

Antes de cerrar, obtené el diff completo de la rama para documentar los cambios:

```bash
git diff main...HEAD --stat   # Archivos modificados (resumen)
git diff main...HEAD          # Diff completo
```

Con esa información, ARMÁ UN COMENTARIO DETALLADO describiendo qué se hizo.
El formato del comentario debe ser:

```
## 🔍 Resumen
[Explicación clara de qué se resolvió o implementó, en 2-4 oraciones]

## 📁 Archivos modificados
[lista de archivos con breve descripción de cada cambio]

archivo/src/ruta.py — [qué cambió y por qué]
otro/archivo.tsx — [qué se agregó/modificó/eliminó]

## 🛠️ Detalle técnico
[Si aplica, explicación más técnica de cómo se resolvió]
```

Ejemplo real:
```
## 🔍 Resumen
Se corrigió el error donde las imágenes de vehículos no se actualizaban al subir nuevas.
El problema era que el navegador cacheaba las URLs sin timestamp, mostrando siempre la imagen vieja.

## 📁 Archivos modificados
frontends/catalogo/src/components/ImageUploader.tsx — Se agregó timestamp anti-cache (?t=Date.now()) a la URL de cada imagen al subirla
frontends/catalogo/src/hooks/useVehiculoImages.ts — Se modificó el hook para forzar refresco de imágenes después del upload

## 🛠️ Detalle técnico
Se usó el patrón de cache-busting con query params (?t=timestamp) que se genera al momento del upload. 
La imagen nueva se guarda con el mismo nombre pero al cambiar el timestamp el navegador la descarga de nuevo.
```

### Paso 9 — Publicar comentario y cerrar issue

```
jira_add_comment(
  issueKey="{ISSUE_KEY}",
  comment="{comentario_detallado}"
)
jira_transition_issue(issueKey="{ISSUE_KEY}", transition="Listo")
(En OpenCode: jira_jira_add_comment, jira_jira_transition_issue)
```

### Paso 10 — Confirmación

```
✅ {ISSUE_KEY} → Listo
Commit: abc1234
PR: https://github.com/.../pull/123
Comentario publicado con detalle de cambios.
Ver en Jira: https://custer-desarrollo.atlassian.net/browse/{ISSUE_KEY}
```

---

## 🔍 CONSULTAR TAREAS PENDIENTES (PROYECTO ACTUAL)

Cuando el usuario pregunta "qué tareas hay para [CLIENTE]" o "qué tengo pendiente":

```
1. Detectar proyecto (flujo compartido) → obtener jira_project_key, jira_label, cliente_nombre

2. Consultar Jira filtrando por jira_label para traer SOLO las de este repo:
   jira_search_issues(
     jql="project = {KEY} AND labels = '{jira_label}' AND status != 'Listo' ORDER BY priority ASC, created DESC",
     maxResults=10
   )

3. Mostrar:
   CSTR-42  |  Alta   | Bug: Login falla en mobile     |  En curso
   CSTR-38  |  Media  | Feature: Módulo de compras      |  Backlog
```

---

## ⚠️ Reglas importantes

1. **ANTE CUALQUIER issue key {PROJECT}-{NUM}**, activar este skill automáticamente.
2. **Nunca hacer push sin el issue key en el commit** — si el usuario no lo mencionó, preguntar.
3. **Siempre hacer `git status` primero** — nunca asumir qué cambió.
4. **El comentario en Jira con el hash del commit es obligatorio** — da trazabilidad.
5. **Detectar el proyecto primero** — no hardcodear CSTR. Cada repo puede tener su propio project key.
6. **Si el push falla**, no transicionar el issue. Resolver el error primero.
7. **Si hay conflictos**, reportarlos y pedir instrucciones.
8. **Transicionar vía MCP siempre** — no esperar webhooks de GitHub.
9. **Usar el label del proyecto** en la consulta de tareas pendientes para filtrar bien.
10. **Verificar el estado del issue en Jira antes de cerrar** — si está en Backlog, preguntar; si ya está Listo, avisar.
11. **Siempre traer la última versión de main (`git pull --rebase`)** antes de crear una rama nueva. Evita trabajar sobre código viejo.
12. **Al iniciar una tarea nueva, cerrar automáticamente la anterior** si está "En curso".

---

## 📎 Skills relacionados

| Skill | Ubicación | Qué hace |
|-------|-----------|----------|
| consulta-tareas-jira | `consulta-tareas-jira/` | Consultar y crear tareas |
