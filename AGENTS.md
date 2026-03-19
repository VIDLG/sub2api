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

## 协作节奏

- 每个较大的回合结束时，只给 1 条下一步建议。
- 只有在继续做价值不高、或者很可能过度工程化时，才明确说“可以先停”；不要每轮都为了形式硬说一遍。
- 如果抽象开始不值，就主动简化或合并回去。
- 如果用户在过程中增加了新任务、新约束，或者 UI 实测发现了新问题，要把它们纳入下一步，而不是机械沿用旧计划。
- 实现过程中发现的新问题，以及用户实测反馈出来的新问题，都视为下一步的实时输入。

## 编码规则

- 文本文件统一使用 UTF-8 without BOM。
- 不要提交 GBK/ANSI/UTF-16 的文本文件。
- 如果碰到有编码问题的遗留文件，在同一改动里一起转成 UTF-8。
- 在 Windows 上处理中文文本时，不要依赖 PowerShell 默认的 `Set-Content -Encoding utf8`；优先使用 no-BOM 写法，例如 `.NET` 的 `UTF8Encoding($false)`。
- 修完编码问题后，要验证文件确实是 UTF-8 without BOM，而不是假设写入路径天然正确。
