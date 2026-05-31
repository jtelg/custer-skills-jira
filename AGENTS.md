<!-- gentle-ai:project-rules -->

# Custer Skills — Jira Workflow Rules

Estas reglas aplican a TODOS los proyectos que usen custer-skills-jira.

## 🔴 REGLA #1 — NUNCA usar jira_auth_status

No uses `jira_auth_status` para verificar acceso a Jira. Esta herramienta
siempre devuelve `false` al inicio de la sesión aunque las credenciales
funcionen. En su lugar, llamá DIRECTAMENTE a las herramientas de Jira:

- `jira_jira_search_issues`
- `jira_jira_get_issue`
- `jira_jira_create_issue`

Si alguna falla por autenticación, reintentá automáticamente.

## 🟢 REGLA #2 — Auto-carga de skills ante consultas de Jira

Cuando el usuario pregunte sobre tareas, trabajo pendiente, issues, o
mencione Jira en cualquier contexto, cargá el skill
`consulta-tareas-jira` INMEDIATAMENTE.

Triggers exactos:
- "qué tareas hay", "qué tenemos para hoy"
- "qué estoy trabajando", "mostrame las tareas"
- "tareas pendientes", "qué tengo que hacer"
- "cómo vamos con las tareas"
- CUALQUIER mención a "tarea", "issue", "Jira", "pendiente"

No esperes a que el usuario pida explícitamente el skill.

## 🔵 REGLA #3 — Auto-carga de git-push-jira ante issue keys

Cuando el usuario mencione CUALQUIER issue key con formato
`{PROJECT}-{NUM}` (ej: CSTR-42, FONTE-7, MXTS-123), cargá el skill
`git-push-jira` INMEDIATAMENTE.

Triggers:
- "vamos con CSTR-42", "empecemos CSTR-42"
- "CSTR-42" suelto
- "pusheá y cerrá CSTR-42", "terminé con CSTR-42"
- "generá un PR", "creá el PR"
- "bien", "listo", "sigamos" + issue key

## ✅ REGLA #4 — Orden correcto al cerrar tarea

Al cerrar una tarea, el orden es SIEMPRE:
1. Comentario detallado en Jira (con archivos modificados)
2. Transición a "Listo"

NUNCA al revés. NUNCA cerrar sin comentario.

## ⚠️ REGLA #5 — Detección de proyecto

Siempre detectar el proyecto desde el repo Git:
1. `git remote get-url origin`
2. Normalizar URL
3. GET https://ai.custer.com.ar/api/proyectos/por-github?url={url}
4. Obtener jira_project_key y cliente_nombre
