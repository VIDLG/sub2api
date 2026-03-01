# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 提供在本仓库工作时的指导。

## 项目概述

Sub2API 是一个 AI API 网关平台，用于分发订阅配额。它代理对上游 AI 服务（OpenAI、Anthropic 等）的请求，同时处理认证、计费、速率限制和账户调度。

**技术栈：**
- 后端：Go 1.25+ with Gin (HTTP), Ent (ORM), Wire (依赖注入)
- 前端：Vue 3（默认）或 React（备选）
- 数据库：PostgreSQL 15+, Redis 7+
- 构建工具：Just（任务运行器）、Pixi（依赖管理器）、rust-script（数据库管理）

## 开发环境设置

### 初始化设置

```bash
# 安装依赖工具（Just、Pixi、Rust、数据库）
./scripts/setup/setup.sh          # macOS/Linux
.\scripts\setup\setup.ps1          # Windows

# 安装项目依赖
just setup

# 初始化数据库（仅首次）
just db-init
just db-up
just db-install
```

### 常用开发命令

```bash
# 查看所有可用命令
just

# 数据库管理
just db-up                         # 启动 PostgreSQL + Redis
just db-down                       # 停止数据库
just db-status                     # 检查数据库状态
just db-reset                      # 清空并重新初始化数据库

# 后端开发
just dev-be                        # 启动后端服务器（端口 8080）
just build-backend                 # 构建后端二进制文件
just test-backend                  # 运行 Go 测试

# 前端开发（Vue - 默认）
just dev-install-vue               # 安装 Vue 依赖
just dev-vue                       # 启动 Vue 开发服务器（端口 5173）
just build-vue                     # 构建 Vue 生产版本
just test-vue                      # 代码检查 + 类型检查

# 前端开发（React - 备选）
just dev-install-react             # 安装 React 依赖
just dev-react                     # 启动 React 开发服务器
just build-react                   # 构建 React 生产版本
just test-react                    # 代码检查 + 构建检查

# 生产构建（内嵌前端）
just build-embed-vue               # 构建包含 Vue 的单一二进制文件
just build-embed-react             # 构建包含 React 的单一二进制文件
just dev-serve-vue port=8081       # 运行内嵌 Vue 的二进制文件
```

### 数据库管理

项目使用 `scripts/dbmgr.rs`（rust-script）进行本地数据库管理：

```bash
# 通过 just 命令管理
just db-init                       # 初始化 PostgreSQL 数据目录
just db-up                         # 启动两个数据库
just db-down                       # 停止两个数据库
just db-status                     # 检查连接状态
just db-reset                      # 完全重置（清空 + 重新初始化）

# 或直接调用 rust-script
rust-script scripts/dbmgr.rs pg init
rust-script scripts/dbmgr.rs up
rust-script scripts/dbmgr.rs down
```

**数据库目录：** `.dev-data/postgres/`、`.dev-data/redis/`、`.dev-data/app/`

## 架构说明

### 后端结构 (`backend/`)

```
cmd/
  server/      - 主应用入口，Wire 依赖注入配置
  install/     - 数据库初始化 CLI
  jwtgen/      - JWT 令牌生成工具

internal/
  config/      - YAML 配置加载 + 验证
  domain/      - 领域常量（账户类型、模型名称）
  ent/         - Ent ORM 生成的代码（来自 ent/schema/）
  handler/     - HTTP 请求处理器（admin/、gateway/、public/）
  middleware/  - Gin 中间件（认证、日志、限流）
  model/       - DTO 和请求/响应模型
  repository/  - 数据访问层（封装 Ent 查询）
  service/     - 业务逻辑层
  gateway/     - 核心代理逻辑（账户调度、计费）
  server/      - Gin 路由配置
  setup/       - 首次运行设置向导
  web/         - 内嵌前端资源（//go:embed）
```

### 代码生成（Ent + Wire）

**编辑 `backend/ent/schema/*.go` 后**，需要重新生成 Ent 模型和 Wire 提供者：

```bash
cd backend
go generate ./ent          # 重新生成 Ent ORM 代码
go generate ./cmd/server   # 重新生成 Wire DI 代码（wire_gen.go）
```

**不要手动编辑：**
- `backend/ent/`（除了 `ent/schema/`）
- `backend/cmd/server/wire_gen.go`

### 前端结构

**两个前端（部署时选择其一）：**

- `frontend/` — 原项目（Wei-Shaw/sub2api）的 Vue 3 实现，功能完善。保留此目录以便从上上游合并更新，一般不在此目录做自定义开发。
- `frontend-react/` — 我们对 Vue 实现的 React 复刻，也是自定义功能的开发目标。**日常开发应在此目录进行。frontend-react 开发在 VIDLG/sub2api（upstream）进行。**

**React 前端与 Vue 前端的关系：**
- 整体 UI 布局和功能与 Vue 的 `frontend/` 保持一致（功能对齐）
- UI 细节不要求完全相同，每个小的 UI 组件可以替换为更好的 React 生态库
- 自定义功能优先在 React 前端开发

**React 前端技术栈选型：**
- 样式：TailwindCSS v4 + clsx + tailwind-merge
- UI 组件库：shadcn/ui（Radix UI + CVA）
- 状态管理：Zustand
- Hooks 工具库：ahooks
- 数据请求：@tanstack/react-query + Axios
- 表单：@tanstack/react-form + @tanstack/zod-form-adapter + Zod
- 路由：@tanstack/react-router
- 表格：@tanstack/react-table
- 国际化：i18next + react-i18next（en/zh）
- 主题：next-themes（明暗模式）
- 通知：Sonner
- 图标：lucide-react
- 图表：Recharts（通过 shadcn/ui `chart` 组件封装，`pnpm dlx shadcn@latest add chart`）
- 编译优化：babel-plugin-react-compiler（自动 memoization，禁止手动 useMemo/useCallback）

**React Compiler（babel-plugin-react-compiler）：**
- 已在 `vite.config.ts` 中启用，编译器自动处理组件和 hooks 的 memoization
- **禁止使用 `useMemo` 和 `useCallback`** — 它们是多余的，编译器会自动优化
- 用普通表达式替代 `useMemo`，用普通函数替代 `useCallback`
- 多语句计算用 IIFE `(() => { ... })()` 替代 `useMemo`
- `components/ui/` 是 shadcn 管理的，不受此规则约束
- 编译器边界情况（必须遵守，否则编译器会跳过优化或产生 bug）：
  - **禁止在渲染路径（JSX / 函数体顶层）读取 `ref.current`** — 编译器无法追踪 ref 变化，会导致整个组件无法优化。`ref.current` 只能在 `useEffect`、事件处理函数中读写
  - **禁止直接修改 props、state、从 props 解构的数组/对象** — 用 `[...arr].sort()` / `toSorted()` 代替 `arr.sort()`，用 `{ ...obj, key: newVal }` 代替 `obj.key = newVal`
  - **组件和 hooks 必须是纯函数** — 相同输入必须返回相同输出，不要在渲染路径中读取外部可变变量（如模块级 `let`）
  - 遇到编译器导致的异常行为时，可用 `'use no memo'` 指令临时跳过单个函数的编译优化（仅作为调试手段，不应长期保留）
- **useEffect 依赖管理 — 优先用 `useEffectEvent` 替代 `eslint-disable`**（React 19.2+）：
  - 当 effect 需要响应某些 deps 变化，但内部调用的函数不应成为 dep 时，用 `useEffectEvent` 包裹该函数
  - 典型场景：effect 响应 `[opsEnabled, firstLoad]` 变化，但内部调用的 `handleRefresh` 读取最新 state 且不应触发 effect 重跑
  - `useEffectEvent` 返回的函数**不能**放入依赖数组，也**不能**作为 props 传递给其他组件
  - 仅 mount-once 的 effect（`[]` deps）不需要 `useEffectEvent`，直接 `[]` 即可

**shadcn/ui 组件管理规范：**
- `components/ui/` 目录下的组件由 shadcn CLI 管理（`pnpm dlx shadcn@latest add <组件名>`），不要手动创建
- 更新组件使用 `--overwrite` 标志覆盖
- shadcn 组件文件名使用 kebab-case（如 `alert-dialog.tsx`、`date-range-picker.tsx`），这是 shadcn 默认约定
- 项目其他文件使用 PascalCase（组件/视图：`UsersView.tsx`）或 camelCase（hooks/工具：`useTheme.ts`）
- 这两种命名风格在各自范围内保持统一即可

**架构现状与重构方向（优先级从高到低）：**

1. ~~**@tanstack/react-table：**~~ ✅ 已完成 (2026-02-28) — 创建了 `DataTable` 通用组件 + `useDataTableQuery` / `useTableMutation` hooks，已迁移全部 9 个表格页面（8 个 admin + 1 个 user）。消除了 ~3000+ 行手写 table HTML、手动分页、防抖、AbortController 代码。
2. ~~**@tanstack/react-query：**~~ ✅ 已完成 (2026-02-28) — 所有表格页面已改用 useQuery + useMutation + invalidateQueries 模式，从 5 个页面扩展到 14 个页面。
3. ~~**废弃依赖清理：**~~ ✅ 已完成 — react-router-dom 已移除。
4. ~~**shadcn 组件补充：**~~ ✅ 已添加 table、checkbox、skeleton。
5. ~~**ahooks 引入：**~~ ✅ 已完成 (2026-02-28) — 已安装 ahooks 并替换手动防抖、mount/unmount 逻辑。移除了未使用的 @reactuses/core。优化了 RegisterView（2 个防抖）、SubscriptionsView（用户搜索防抖）、PromoCodesView（useUpdateEffect）。
6. ~~**Recharts 图表引入：**~~ ✅ 已完成 (2026-02-28) — 通过 shadcn chart 组件引入 Recharts。创建了 `components/charts/` 共享图表组件（TokenTrendChart、ModelDistributionChart）及 `components/charts/ops/` ops 专用图表（OpsThroughputChart、OpsLatencyHistogramChart、OpsErrorTrendChart、OpsErrorDistributionChart）。admin/user DashboardView 表格换为图表，OpsDashboard 完整实现接入真实 API。
7. **表单验证增强：** Zod adapter 已安装但部分表单未接入，应统一使用 zodValidator 做字段级实时校验。
8. **Zustand 优化：** 可引入 persist 中间件统一 localStorage 持久化逻辑。

**已迁移的表格页面（2026-02-28）：**
- Admin: UsersView, AccountsView, GroupsView, SubscriptionsView, ProxiesView, AnnouncementsView, RedeemView, PromoCodesView
- User: KeysView

```
frontend/          - Vue 3（上游，TailwindCSS）— 仅同步上游，不做自定义修改
  src/
    api/           - API 客户端（axios）
    stores/        - Pinia 状态管理
    views/         - 页面组件
    components/    - 可复用组件
    router/        - Vue Router

frontend-react/    - React（我们的主前端）— 自定义功能在此开发
  src/
    api/           - API 客户端（Axios，拦截器处理认证/token 刷新）
    stores/        - Zustand 状态管理（auth, app, subscriptions, adminSettings, onboarding）
    views/         - 页面组件（admin/, auth/, user/）
    components/
      ui/          - shadcn/ui 组件
      layout/      - 布局组件（AppLayout, AppSidebar, AppHeader）
      common/      - 通用组件
      charts/      - Recharts 图表组件（TokenTrendChart, ModelDistributionChart, ops/）
    hooks/         - 自定义 hooks
    router/        - TanStack Router 配置（lazy loading + 路由守卫）
    i18n/          - 国际化（locales/en.ts, zh.ts）
    lib/           - 工具函数（cn() 等）
    types/         - TypeScript 类型定义
```

**构建输出：**
- Vue 构建到 `backend/internal/web/dist-vue/`
- React 构建到 `backend/internal/web/dist-react/`
- 通过 Go build tags 选择内嵌哪个前端：`-tags embed`（Vue）或 `-tags "embed react"`（React）
- embed 声明分别在 `embed_fs_vue.go` 和 `embed_fs_react.go` 中

### Frontend React vs Vue Intentional Differences

React 版本 (`frontend-react/`) 与 Vue 版本 (`frontend/`) 在以下方面存在**有意的**差异。这些差异是为了优化 React 版本的开发体验和用户体验而做的剪裁，应当保留：

#### 已移除的功能

**SettingsView (Admin Settings Page):**
- ❌ SMTP 连接测试按钮 (`testSmtpConnection`)
- ❌ 发送测试邮件功能 (`sendTestEmail`)
- ❌ LinuxDo OAuth 登录配置整个部分 (`linuxdo_connect_*` 所有字段)
- ❌ TOTP Two-Factor Authentication (2FA) 功能 (`totp_enabled` 及相关字段)
- **理由：**
  - SMTP 测试：简化管理界面 UX，SMTP 配置可通过实际发送验证邮件来测试
  - LinuxDo OAuth：不需要此第三方登录功能
  - TOTP 2FA：不需要双因素认证功能

#### 不同的实现方式

*(待添加其他有意差异)*

#### 保持一致的部分

- ✅ 两个版本共享相同的后端 API
- ✅ 布局和视觉设计保持一致
- ✅ 功能完整性保持对等（除非上述明确标注为移除）

**注意：** 在迁移或对齐功能时，请检查本章节以避免重新引入已剪裁的功能。

### 网关核心 (`internal/gateway/`)

网关处理：
1. **账户选择** - 根据模型、分组、粘性会话选择上游账户
2. **请求代理** - 转发到上游 API（OpenAI、Anthropic、Gemini 等）
3. **计费** - 跟踪 token 使用量，扣除余额
4. **速率限制** - 每用户和每账户的并发/速率限制
5. **错误处理** - 重试逻辑、熔断器、错误透传规则

**关键文件：**
- `internal/gateway/gateway.go` - 主代理处理器
- `internal/service/account_scheduler.go` - 账户选择逻辑
- `internal/service/billing_service.go` - 计费计算

### 依赖注入（Wire）

项目使用 [Wire](https://github.com/google/wire) 进行编译时依赖注入：

1. 编辑 `backend/cmd/server/wire.go` 定义提供者
2. 运行 `go generate ./cmd/server` 生成 `wire_gen.go`
3. Wire 在编译时解析依赖（比运行时 DI 更安全）

### 配置

**开发环境：** `.env.dev`（由 Justfile 自动加载）
**生产环境：** `config.yaml`（通过 `--config` 标志或默认位置传递）

环境变量会覆盖 YAML 配置（12-factor app 模式）。

## 开发模式

### 运行测试

```bash
# 后端测试（所有包）
just test-backend
cd backend && pixi run go test ./...

# 单个包
cd backend && pixi run go test ./internal/service/...

# 带覆盖率
cd backend && pixi run go test -cover ./...

# 前端测试
just test-vue          # Vue 代码检查 + 类型检查
just test-react        # React 代码检查 + 构建
```

### 添加新的 Ent Schema

1. 创建 schema：`backend/ent/schema/my_entity.go`
2. 定义字段和边
3. 重新生成：`cd backend && go generate ./ent`
4. 如需要创建迁移（Ent Atlas 或手动 SQL）
5. 更新 repository/service 层

### 添加新的 API 端点

1. 在 `internal/handler/admin/` 或 `internal/handler/gateway/` 中定义处理器
2. 在 `internal/server/router.go` 中添加路由
3. 如果添加了新服务，在 `cmd/server/wire.go` 中更新 Wire 提供者
4. 重新生成 Wire：`go generate ./cmd/server`
5. 在 `frontend/src/api/` 或 `frontend-react/src/api/` 中添加对应的前端 API 调用

### 内嵌前端构建

**生产部署：**

```bash
# 构建 Vue 内嵌二进制文件
just build-embed-vue
cd backend && pixi run go build -tags embed -ldflags="-s -w" -o bin/server-vue ./cmd/server

# 构建 React 内嵌二进制文件
just build-embed-react
cd backend && pixi run go build -tags embed -ldflags="-s -w" -o bin/server-react ./cmd/server
```

**不使用 `-tags embed`**，二进制文件将不会提供前端服务（仅 API 模式）。

### 环境变量

**关键环境变量（开发默认值见 `.env.dev`）：**

```bash
# 数据库
DATABASE_HOST=localhost
DATABASE_PORT=5432
POSTGRES_USER=admin
POSTGRES_PASSWORD=admin123
POSTGRES_DB=sub2api

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# 服务器
SERVER_MODE=debug              # debug/release
SERVER_PORT=8080
RUN_MODE=                       # simple（禁用 SaaS 功能）

# 管理员账户（db-install 会创建）
ADMIN_EMAIL=admin@123.com
ADMIN_PASSWORD=admin123

# 代理（中国开发环境）
HTTP_PROXY=http://127.0.0.1:7897
HTTPS_PROXY=http://127.0.0.1:7897
GOPROXY=https://goproxy.cn,direct
```

## Pixi 依赖管理

**Pixi 提供隔离的 Go/Node.js/pnpm 版本：**

```bash
# 安装项目依赖（Go、Node.js、pnpm）
pixi install

# 通过 pixi 运行命令（确保使用正确版本）
pixi run go build ./...
pixi run pnpm install
pixi run node --version

# 添加新依赖到 pixi.toml
pixi add <package>
```

**为什么用 Pixi？** 确保开发/CI 环境中工具链版本一致，无需全局安装。

## 特殊模式

### Simple Mode（简单模式）

禁用 SaaS 功能（用户注册、计费、订阅）：

```bash
RUN_MODE=simple
SIMPLE_MODE_CONFIRM=true       # 生产环境必需
```

用于个人/内部部署，无需多租户功能。

### 设置向导

首次运行设置（创建管理员账户、配置数据库）：

```bash
# 交互式设置
./server --setup

# 自动设置（使用环境变量）
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=pass123 ./server
```

**设置标记：** `backend/.installed`（删除后可重新运行设置）

## 已知问题

### Antigravity + Claude Code Plan Mode

使用 Antigravity 账户时，Claude Code 的 Plan Mode 无法自动退出。**解决方法：** 按 `Shift+Tab` 手动退出，然后批准/拒绝计划。

### Sora 支持

由于上游集成问题，暂时不可用。生产环境不要依赖 `gateway.sora_*` 配置项。

## Git 工作流

**⚠️ 重要工作流程偏好：**

除非用户明确要求，否则 **不要主动执行以下操作**：
- `git commit` - 不要主动提交代码
- `git push` - 不要主动推送到远程仓库
- `git pr` 或创建 Pull Request - 不要主动创建 PR

**只有在用户明确说"可以 commit 了"、"push 吧"、"做 PR"等指令时才执行这些操作。**

完成代码修改后，应该：
1. 运行 lint 和 type check 确保代码质量
2. 向用户报告修改完成，等待进一步指示
3. 不要自作主张进行 Git 操作

**仓库关系：**

- **Wei-Shaw/sub2api** — 原项目（仅 Vue，无 React）
- **VIDLG/sub2api** (upstream) — 开发 React 前端的主仓库，接收 frontend-react 相关的 PR
- **daleydeng/sub2api** (origin) — 你的 fork

```bash
# 远程仓库配置
origin      - daleydeng/sub2api（你的 fork）
upstream    - VIDLG/sub2api（React 前端开发的主仓库）

# 提交 PR 到 upstream
just pr-upstream "PR title" "PR description"
# 或手动
gh pr create --repo VIDLG/sub2api --base main --head daleydeng:main --title "..." --body "..." --web

# 与 upstream 同步
git fetch upstream
git merge upstream/main

# 同步上上游（Wei-Shaw/sub2api）的 Vue 更新（可选，当需要 Vue 前端的上游更新时）
git remote add origin-upstream https://github.com/Wei-Shaw/sub2api.git
git fetch origin-upstream
git merge origin-upstream/main
```

## 文档

- 完整设置指南：`docs/development/setup.md`
- 项目特定开发笔记：`docs/development/guide.md`
- 部署说明：见 README.md（Docker Compose、二进制部署）
