# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供在本仓库工作时的指导。

**详细规则已移至 `.claude/rules/` 目录，按功能分类存放。**

## 项目概述

Sub2API 是一个 AI API 网关平台，用于分发订阅配额。它代理对上游 AI 服务（OpenAI、Anthropic 等）的请求，同时处理认证、计费、速率限制和账户调度。

**技术栈：**
- 后端：Go 1.25+ with Gin (HTTP), Ent (ORM), Wire (依赖注入)
- 前端：Vue 3（默认）或 React（备选）
- 数据库：PostgreSQL 15+, Redis 7+
- 构建工具：Just（任务运行器）、Pixi（依赖管理器）、rust-script（数据库管理）

## 快速参考

```bash
# 查看所有 just 命令
just

# 启动开发环境
just db-up          # 启动数据库
just dev-be          # 启动后端（端口 8080）
just dev-react       # 启动 React 前端

# 运行测试
just test-backend
just test-react
```

## 详细规则

- `docs/standards/01-dev-cmds.md` — 开发命令详解 @docs/standards/01-dev-cmds.md
- `docs/standards/02-frontend-react.md` — React 前端开发规范 @docs/standards/02-frontend-react.md
- `docs/standards/03-backend-arch.md` — 后端架构与代码生成 @docs/standards/03-backend-arch.md
- `docs/standards/04-git-workflow.md` — Git 工作流与仓库管理 @docs/standards/04-git-workflow.md
- `docs/standards/05-known-issues.md` — 已知问题与解决方法 @docs/standards/05-known-issues.md
- `docs/standards/06-deployment.md` — 部署配置与内嵌前端构建 @docs/standards/06-deployment.md

## 文档

- 完整设置指南：`docs/development/setup.md`
- 项目特定开发笔记：`docs/development/guide.md`
