---
name: consulta-tareas-jira
description: "Consultar y crear tareas de Jira desde OpenCode. Detecta el proyecto desde el repo Git, consulta tareas pendientes o crea nuevas issues directamente. Incluye el nombre del sistema entre corchetes en el summary para identificar el proyecto en el tablero compartido. Trigger: preguntar por tareas, crear tareas, cargar tareas."
license: MIT
metadata:
  author: jtelg
  version: "1.4"
---

# SKILL: Consultar y crear tareas de Jira desde OpenCode

> Detecta automáticamente el proyecto desde el repositorio Git, consulta tareas
> pendientes en Jira, o crea nuevas tareas directamente. No requiere JWT.

## When to Use

Use this skill when the user asks about their tasks, wants to create a Jira
issue, or needs to see what's pending.

### Consultar tareas

- "qué tarea tengo para hoy"
- "qué tareas hay para [cliente/proyecto]"
- "mostrame las tareas pendientes"
- "qué estoy trabajando"
- "cómo voy con las tareas"
- "tareas de hoy"
- "qué tengo que hacer"

### Crear tareas

- "creá una tarea: ..."
- "cargá esta tarea ..."
- "agregá al backlog: ..."
- "nueva tarea para [cliente]: ..."
- "tomá request: ..."

---

## 🔄 Flujo compartido de detección de proyecto

> ⚠️ Este flujo es COMPARTIDO entre los skills de custer-skills-jira.
> Si lo modificás, actualizá también `git-push-jira/SKILL.md`.

```
1. Detectar repositorio Git actual
   → git remote get-url origin

2. Normalizar la URL (HTTPS ↔ SSH)

3. Consultar API pública del backend
   → GET https://ai.custer.com.ar/api/proyectos/por-github?url={url}
   → Devuelve: jira_project_key, jira_label, cliente_nombre

4. Según lo que pidió el usuario:
  ├─ Consultar → jira_jira_search_issues (MCP)  — filtrar por labels = '{jira_label}'
  └─ Crear     → jira_jira_create_issue (MCP) — aplicar jira_label como label
```

---

## 📋 CONSULTAR TAREAS

### Paso 1 — Detectar repositorio

```bash
git remote get-url origin
```

Guardar la URL cruda. Si falla, informar al usuario.

### Paso 2 — Normalizar la URL

| Formato | Ejemplo |
|---------|---------|
| HTTPS | `https://github.com/jtelg/custer-ai-studio.git` |
| SSH | `git@github.com:jtelg/custer-ai-studio.git` |

Normalizar a HTTPS:

```
Si empieza con "git@github.com:" →
  reemplazar "git@github.com:" por "https://github.com/"
Si termina con ".git" → quitar el .git
```

### Paso 3 — Consultar API

Primero intentar por URL:

```
GET https://ai.custer.com.ar/api/proyectos/por-github?url={url_normalizada}
```

Si responde 404 (no encontró por URL), **reintentar por nombre del repo**.
Extraer el nombre del repo de la URL (ej: `custer-ai-studio` de
`https://github.com/jtelg/custer-ai-studio`) y buscar:

```
GET https://ai.custer.com.ar/api/proyectos/por-github?name={repo_name}
```

Si el usuario mencionó un cliente, pasarlo también:

```
GET https://ai.custer.com.ar/api/proyectos/por-github?name={repo_name}&cliente={cliente}
```

No requiere headers de auth. Respuesta:

```json
{
  "id": "uuid",
  "cliente_id": "uuid",
  "nombre": "Sistema de Gestión",
  "cliente_nombre": "GRUPO FONTE",
  "jira_project_key": "CSTR",
  "jira_label": "grupofontesis-v13",
  "url_github": "https://github.com/jtelg/custer-ai-studio"
}
```

### Paso 4 — Consultar Jira vía MCP

La API devuelve `jira_label` (ej: `grupofontesis-v13`). **Usalo para filtrar**
exclusivamente las tareas de este proyecto, no todo el Jira project:

```
Herramienta: jira_jira_search_issues
JQL: project = {KEY} AND labels = '{jira_label}' AND status != 'Listo' ORDER BY created DESC
Max results: 10
```

> 🔴 **No uses `jira_auth_status` para verificar antes.** Las credenciales están en
> `opencode.json`. El `auth_status` siempre devuelve `false` al inicio aunque las
> herramientas funcionen. Llamá directo a las herramientas de Jira y si fallan por
> auth, reintentá automáticamente.
> ⚠️ **Sin el filtro por `jira_label`**, si el Jira project tiene issues de varios
> repos (ej: CSTR tiene multicars, gf-sis, custer-ai-studio), te van a aparecer
> todas mezcladas. El `jira_label` es el identificador único de cada proyecto.

### Paso 5 — Mostrar resultados

```
🎯 GRUPO FONTE → Sistema de Gestión (grupofontesis-v13)

Tareas pendientes (CSTR):

☐ CSTR-42  [En curso]  Resolver login que falla en mobile    → Alta
☐ CSTR-43  [Backlog]   Agregar exportación a PDF            → Media
```

Solo deberían aparecer tareas cuyo label coincida con el `jira_label` del proyecto.
Si ves tareas de otros proyectos, revisá que el JQL incluya el filtro por labels.

Si no hay tareas: "📭 No hay tareas pendientes. ¡A darle!"

---

## ➕ CREAR TAREA

Cuando el usuario pide crear una tarea, el agente debe:

### Paso 1-3 — Igual que consulta (detectar repo → normalizar → API)

Obtiene `jira_project_key` y `cliente_nombre`.

### Paso 4 — Crear issue en Jira vía MCP

La API devuelve:
- `nombre` — nombre del sistema (ej: "Catálogo multicars")
- `jira_label` — label único del proyecto (ej: "multicars-next12")
- `cliente_nombre` — nombre del cliente (ej: "CUSTER-DESARROLLO")

**El `nombre` es CLAVE**: ponelo al inicio del summary entre corchetes para
identificar el sistema en el tablero compartido de Jira:

```
Herramienta: jira_jira_create_issue
Project key: {jira_project_key}
Summary:     [{nombre}] {lo que el usuario describió}
Issue type:  "Task" (por defecto)
Description: {detalle, si el usuario dio más contexto}
Priority:    {inferir del lenguaje: "urgente"=Highest, "importante"=High, etc}
Labels:      [
  {cliente_slug},       ← "GRUPO-FONTE" (agrupa por cliente)
  {jira_label}          ← "grupofontesis-v13" (identifica el proyecto)
]
```

**IMPORTANTE**: Los labels en Jira NO pueden tener espacios ni caracteres especiales.
Normalizar: mayúsculas, espacios → guiones, sin acentos.

Ejemplos:
- "GRUPO FONTE" → "GRUPO-FONTE"
- "Sistema de Gestión" → "sistema-de-gestion"

El `jira_label` se genera desde la URL de GitHub (nombre del repo) o desde el nombre
del proyecto si no hay URL. El `cliente_nombre` lo normalizás vos en el skill.

⚠️ **Diferencia clave entre OpenCode y Clau**: cuando creás una tarea desde OpenCode,
usás DIRECTAMENTE el `jira_label` que devuelve la API. Cuando Clau (Discord) crea una
tarea, ella primero BUSCA el proyecto por alias (`etiquetas_busqueda`) y usa el
`jira_label` del proyecto encontrado. En ambos casos el resultado es el mismo:
el label correcto del proyecto va a Jira.

### Paso 5 — Confirmar

```
✅ CSTR-99 creado en GRUPO FONTE → Sistema de Gestión
   "[Sistema de Gestión] Resolver login que falla en mobile"
   Labels: GRUPO-FONTE, sistema-de-gestion
```

---

## 🧠 Inferencia de prioridad

| El usuario dice | Prioridad en Jira |
|----------------|-------------------|
| "urgente", "ya", "ahora", "se cayó" | Highest |
| "importante", "pronto", "prioritario" | High |
| (sin calificativo) | Medium |
| "sin apuro", "cuando se pueda", "menor" | Low |

## 🧠 Inferencia de tipo

| Contexto | Issue type | Component |
|----------|-----------|-----------|
| Error, bug, falla, no anda | Bug | Bug |
| Nueva funcionalidad, feature, agregar | Task | Feature |
| Consulta, duda, soporte | Task | Soporte |
| Mejora, optimización, refactor | Task | Mejora |

---

## Manejo de errores

| Situación | Qué hacer |
|-----------|-----------|
| No hay git remote | Pedir al usuario que esté parado en el repo correcto |
| URL no normalizable | Usar la URL cruda |
| API responde 404 por URL | Reintentar con `?name={repo_name}` (fallback por nombre) |
| API responde 404 por nombre también | Sugerir cargar el proyecto en el frontend con su GitHub URL |
| API no responde | Verificar que ai.custer.com.ar esté andando |
| Jira no configurado (sin jira_project_key) | Sugerir editar el proyecto y agregar la key |
| Jira MCP falla al crear | Informar error y sugerir verificar credenciales |
| Usuario no especifica tarea clara | Pedirle que describa la tarea |

---

## 📎 Skills relacionados

| Skill | Ubicación | Qué hace |
|-------|-----------|----------|
| git-push-jira | `git-push-jira/` | Git push + transicionar issues |

## Notas

- El endpoint `/api/proyectos/por-github` es público (no requiere auth)
- Las tareas se crean SIEMPRE en el Jira project del proyecto detectado
- El `label` en Jira = nombre del cliente (para filtrar después)
- Si el usuario no está en un repo, pedirle que abra OpenCode en el repo del proyecto
- Dos vías de creación: Discord (para no-developers) y OpenCode (para devs)
