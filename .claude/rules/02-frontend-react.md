# React 前端开发规范

## 两个前端（部署时选择其一）

- `frontend/` — 原项目（Wei-Shaw/sub2api）的 Vue 3 实现，功能完善。保留此目录以便从上上游合并更新，一般不在此目录做自定义开发。
- `frontend-react/` — 我们对 Vue 实现的 React 复刻，也是自定义功能的开发目标。**日常开发应在此目录进行。frontend-react 开发在 VIDLG/sub2api（upstream）进行。**

## React 前端技术栈

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
- 图表：Recharts（通过 shadcn/ui `chart` 组件封装）
- 编译优化：babel-plugin-react-compiler（自动 memoization，禁止手动 useMemo/useCallback）

## React Compiler 规则

** babel-plugin-react-compiler 已在 `vite.config.ts` 中启用，编译器自动处理组件和 hooks 的 memoization。**

### 禁止使用
- **`useMemo`** 和 **`useCallback`** — 它们是多余的，编译器会自动优化
- 用普通表达式替代 `useMemo`
- 用普通函数替代 `useCallback`
- 多语句计算用 IIFE `(() => { ... })()` 替代 `useMemo`

### 必须遵守的边界情况

如果违反，编译器会跳过优化或产生 bug：

1. **禁止在渲染路径（JSX / 函数体顶层）读取 `ref.current`**
   - 编译器无法追踪 ref 变化，会导致整个组件无法优化
   - `ref.current` 只能在 `useEffect`、事件处理函数中读写

2. **禁止直接修改 props、state、从 props 解构的数组/对象**
   - 用 `[...arr].sort()` / `toSorted()` 代替 `arr.sort()`
   - 用 `{ ...obj, key: newVal }` 代替 `obj.key = newVal`

3. **组件和 hooks 必须是纯函数**
   - 相同输入必须返回相同输出
   - 不要在渲染路径中读取外部可变变量（如模块级 `let`）

4. **useEffect 依赖管理 — 优先用 `useEffectEvent` 替代 `eslint-disable`**（React 19.2+）
   - 当 effect 需要响应某些 deps 变化，但内部调用的函数不应成为 dep 时，用 `useEffectEvent` 包裹该函数
   - 典型场景：effect 响应 `[opsEnabled, firstLoad]` 变化，但内部调用的 `handleRefresh` 读取最新 state 且不应触发 effect 重跑
   - `useEffectEvent` 返回的函数**不能**放入依赖数组，也**不能**作为 props 传递给其他组件
   - 仅 mount-once 的 effect（`[]` deps）不需要 `useEffectEvent`，直接 `[]` 即可
   - 遇到编译器导致的异常行为时，可用 `'use no memo'` 指令临时跳过单个函数的编译优化（仅作为调试手段，不应长期保留）

### shadcn/ui 不受约束

`components/ui/` 目录下的组件由 shadcn CLI 管理，不受 React Compiler 规则约束。

## shadcn/ui 组件管理规范

- `components/ui/` 目录下的组件由 shadcn CLI 管理（`pnpm dlx shadcn@latest add <组件名>`），不要手动创建
- 更新组件使用 `--overwrite` 标志覆盖
- shadcn 组件文件名使用 kebab-case（如 `alert-dialog.tsx`、`date-range-picker.tsx`），这是 shadcn 默认约定
- 项目其他文件使用 PascalCase（组件/视图：`UsersView.tsx`）或 camelCase（hooks/工具：`useTheme.ts`）
- 这两种命名风格在各自范围内保持统一即可

## 前端目录结构

```
frontend-react/
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

## React 前端与 Vue 前端的关系

- 整体 UI 布局和功能与 Vue 的 `frontend/` 保持一致（功能对齐）
- UI 细节不要求完全相同，每个小的 UI 组件可以替换为更好的 React 生态库
- 自定义功能优先在 React 前端开发

## 已完成的重构（2026-02-28）

1. ✅ @tanstack/react-table — 创建了 `DataTable` 通用组件 + `useDataTableQuery` / `useTableMutation` hooks，已迁移全部 9 个表格页面（8 个 admin + 1 个 user）
2. ✅ @tanstack/react-query — 所有表格页面已改用 useQuery + useMutation + invalidateQueries 模式
3. ✅ 废弃依赖清理 — react-router-dom 已移除
4. ✅ shadcn 组件补充 — 已添加 table、checkbox、skeleton
5. ✅ ahooks 引入 — 已安装 ahooks 并替换手动防抖、mount/unmount 逻辑
6. ✅ Recharts 图表引入 — 创建了 `components/charts/` 共享图表组件，admin/user DashboardView 表格换为图表

**已迁移的表格页面：**
- Admin: UsersView, AccountsView, GroupsView, SubscriptionsView, ProxiesView, AnnouncementsView, RedeemView, PromoCodesView
- User: KeysView

## 待完成的优化

7. 表单验证增强 — Zod adapter 已安装但部分表单未接入，应统一使用 zodValidator 做字段级实时校验
8. Zustand 优化 — 可引入 persist 中间件统一 localStorage 持久化逻辑

## Frontend React vs Vue Intentional Differences

React 版本 (`frontend-react/`) 与 Vue 版本 (`frontend/`) 在以下方面存在**有意的**差异。这些差异是为了优化 React 版本的开发体验和用户体验而做的剪裁，应当保留：

### 已移除的功能

**SettingsView (Admin Settings Page):**
- ❌ SMTP 连接测试按钮 (`testSmtpConnection`)
- ❌ 发送测试邮件功能 (`sendTestEmail`)
- ❌ LinuxDo OAuth 登录配置整个部分 (`linuxdo_connect_*` 所有字段)
- ❌ TOTP Two-Factor Authentication (2FA) 功能 (`totp_enabled` 及相关字段)
- **理由：** 简化管理界面，不需要这些功能

### 保持一致的部分

- ✅ 两个版本共享相同的后端 API
- ✅ 布局和视觉设计保持一致
- ✅ 功能完整性保持对等（除非上述明确标注为移除）

**注意：** 在迁移或对齐功能时，请检查本章节以避免重新引入已剪裁的功能。
