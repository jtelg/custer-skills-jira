---
name: publicar-presentacion
description: "Trigger: publicar/subir/actualizar/borrar presentación, display, deck HTML en Custer AI Studio. Publish HTML presentations via the ai.custer.com.ar API."
license: MIT
metadata:
  author: "jtelg"
  version: "1.0"
---

## Activation Contract

Use when the user asks to publish, upload, update, or delete an HTML presentation ("display", "presentación", "deck") on Custer AI Studio (`https://ai.custer.com.ar`).

## Hard Rules

- Authenticate only with the `CAI_KEY` env var (`Authorization: Bearer $CAI_KEY`). Never print, log, commit, or echo the key.
- If `CAI_KEY` is unset, STOP and tell the user to create a key at `https://ai.custer.com.ar/config` → "API keys" and export it as `CAI_KEY`.
- The API docs are the source of truth: before the first call in a session, read `GET /api/agent-docs` (and `GET /api/agent-docs/modules/displays` if a contract detail is unclear). If they contradict this skill, follow the docs.
- The slug is the stable identity: reuse the same slug to update. Lowercase letters, digits, hyphens only.
- Publish a single self-contained `.html` (inline CSS/JS/images or absolute URLs). Multi-file sites go as ZIP via `POST /api/displays`.
- Delete only when the user explicitly asks, naming the slug.
- On `409` (slug owned by someone else) ask the user for another slug; never retry with a mutated slug silently.

## Decision Gates

| Request | Call |
|---------|------|
| Create or update from one HTML | `PUT /api/displays/por-slug/{slug}/html` (multipart `html_file`, `titulo` required when new, optional `area`, `cliente_id`, `password`) |
| Check slug availability | `GET /api/displays/check-slug/{slug}` |
| Multi-file site | `POST /api/displays` with `zip_file` |
| Delete | `DELETE /api/displays/por-slug/{slug}` |

## Execution Steps

1. Verify `CAI_KEY` is set (`[ -n "$CAI_KEY" ]`), without printing it.
2. Read `/api/agent-docs` with the key.
3. Decide the slug: reuse the one the user gave or already used for this deck; otherwise propose one from the title.
4. Publish:
   `curl -s -w '\n%{http_code}' -X PUT https://ai.custer.com.ar/api/displays/por-slug/<slug>/html -H "Authorization: Bearer $CAI_KEY" -F 'html_file=@<path>;type=text/html' -F 'titulo=<title>'`
5. Check the status: `201` created, `200` updated; anything else → report `detail` and stop.

## Output Contract

Return: slug, created vs updated, full URL (`https://ai.custer.com.ar` + `public_url`), and whether it is password-protected. On failure: HTTP status and `detail`.

## References

- `https://ai.custer.com.ar/api/agent-docs` — live API guide (requires the key).
