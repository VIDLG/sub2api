# AGENTS.md

This file is the Codex entrypoint for this repository.
Detailed project rules are maintained in `docs/standards/`.
To avoid drift, this file intentionally does not duplicate rule bodies.

## Rule Source
- Single source of truth: `docs/standards/*.md`
- Always load first: `docs/standards/01-dev-cmds.md`
- Load by scope:
  - Frontend/UI: `docs/standards/02-frontend-react.md`
  - Backend/API/DB/Architecture: `docs/standards/03-backend-arch.md`
  - Git/Branch/PR: `docs/standards/04-git-workflow.md`
  - Troubleshooting: `docs/standards/05-known-issues.md`
  - Deploy/Release/Runtime: `docs/standards/06-deployment.md`
- If multiple scopes apply, load all matched files.
- On conflicts, `docs/standards/*` takes precedence.

## Project Note
- Frontend implementation target: `frontend-react/`
- Backend service: `backend/`
