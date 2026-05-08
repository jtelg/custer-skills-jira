# @jtelg/custer-skills-jira

Skills globales de [OpenCode](https://opencode.ai/) para flujo de trabajo con
Jira. Detecta el proyecto automáticamente desde el repo Git y opera sobre Jira
vía MCP.

## Skills incluidos

| Skill | Descripción |
|-------|-------------|
| **consulta-tareas-jira** | Consultar tareas pendientes y crear nuevas issues |
| **git-push-jira** | Iniciar tareas, commit + push + transicionar a Listo |

## Instalación

```bash
npx @jtelg/custer-skills-jira install
```

Esto copia los skills a `~/.config/opencode/skills/`. Ya están disponibles para
**todos los proyectos** que abras en OpenCode.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `install` | Instala/actualiza los skills (default) |
| `update` | Idéntico a install — re-copia la última versión |
| `uninstall` | Remueve los skills de `~/.config/opencode/skills/` |
| `status` | Muestra qué skills están instalados y su versión |
| `version` | Muestra la versión del package |

## Requisitos

- OpenCode con Jira MCP configurado (herramientas `jira_search`,
  `jira_create_issue`, `jira_transition_issue`, `jira_add_comment`)
- Node.js >= 16
- Acceso a `https://ai.custer.com.ar/api/proyectos/por-github`

## Desarrollo

```bash
git clone https://github.com/jtelg/custer-skills-jira.git
cd custer-skills-jira
# Los skills están en skills/<name>/SKILL.md
# Probá localmente: node bin/cli.js install
```

## Licencia

MIT
