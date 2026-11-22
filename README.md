# @jtelgarecz/custer-skills-jira

Skills globales de [OpenCode](https://opencode.ai/) y
[Claude Code](https://claude.com/claude-code) para el flujo de trabajo con
Jira y Custer AI Studio. Detecta el proyecto automáticamente desde el repo Git y opera sobre Jira
vía MCP.

## Skills incluidos

| Skill | Descripción |
|-------|-------------|
| **consulta-tareas-jira** | Consultar tareas pendientes y crear nuevas issues |
| **git-push-jira** | Iniciar tareas, commit + push + transicionar a Listo |
| **publicar-presentacion** | Publicar, actualizar o borrar presentaciones HTML en Custer AI Studio (requiere `CAI_KEY`) |

## Instalación

```bash
npx @jtelgarecz/custer-skills-jira install
```

Esto copia los skills a `~/.config/opencode/skills/` (OpenCode) y a
`~/.claude/skills/` (Claude Code). Ya están disponibles para **todos los
proyectos**.

### API key de Custer AI Studio

`publicar-presentacion` necesita una API key. Durante la instalación (en una
terminal interactiva) el instalador la pide sin mostrarla, la valida contra
`https://ai.custer.com.ar/api/agent-docs` y la guarda en
`~/.config/custer/cai_key` con permisos `600`.

1. Creá la key en `https://ai.custer.com.ar/config` → **API keys**.
2. Pegala cuando el instalador la pida (Enter vacío para omitir).

Para cambiarla después: `npx @jtelgarecz/custer-skills-jira set-key`. La
variable de entorno `CAI_KEY`, si existe, tiene prioridad sobre el archivo.

## Comandos

| Comando | Qué hace |
|---------|----------|
| `install` | Instala/actualiza los skills en OpenCode y Claude Code y configura la API key (default) |
| `update` | Idéntico a install — re-copia la última versión |
| `set-key` | Configura o reemplaza la API key de Custer AI Studio |
| `uninstall` | Remueve los skills de OpenCode y Claude Code (la key queda; borrala a mano) |
| `status` | Muestra qué skills están instalados en cada herramienta y si hay key |
| `version` | Muestra la versión del package |

## Requisitos

- OpenCode o Claude Code, con Jira MCP configurado (herramientas `jira_search`,
  `jira_create_issue`, `jira_transition_issue`, `jira_add_comment`)
- Node.js >= 16.7
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
