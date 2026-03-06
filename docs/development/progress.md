# 开发进度与近期需求

> 记录 React 前端（frontend-react/）及后端的功能开发进度和近期需求列表。

## 一、功能对齐进度

### Admin 页面

| 功能模块 | 状态 | 待完善内容 |
|---------|------|-----------|
| Dashboard | ✅ 基本完善 | — |
| Usage | ✅ 基本完善 | — |
| Redeem Codes | ✅ 基本完善 | — |
| Promo Codes | ✅ 基本完善 | — |
| Ops | 🚧 待完善 | 缺少 OpenAI Token Request Stats 模块 |
| AI Analyzer | 🚧 待完善 | 整体待对齐 |
| Accounts | 🚧 待完善 | 筛选条件不完善 |
| Groups | 🚧 待完善 | Create 弹窗不完善 |
| Users | 🚧 待完善 | 待对齐 |
| Subscriptions | 🚧 待完善 | 搜索框缺失 |
| Announcements | 🚧 待完善 | Create 弹窗不完善 |
| Proxies | 🚧 待完善 | Create 弹窗不完善 |
| Settings | 🚧 待完善 | 待对齐（已裁剪 SMTP 测试/LinuxDo/TOTP） |

### User 页面

| 功能模块 | 状态 | 待完善内容 |
|---------|------|-----------|
| API Keys | ✅ 基本完善 | — |
| Usage | ✅ 基本完善 | — |
| Subscriptions | ✅ 基本完善 | — |
| Redeem | 🚧 待完善 | 待对齐 |
| Profile | 🚧 待完善 | 待对齐 |

### 页面风格

> 待讨论，暂不做改动。

---

## 二、近期需求列表

### 高优先级

- [ ] Admin Usage：在现有搜索功能之外，增加下拉菜单方式筛选（用户、模型、API Key 等维度）
  - ⚠️ **已知问题（后端）**：User/Account name 搜索框 autocomplete 功能无法正常工作，输入后无结果。**根因已确认为后端问题**，不是前端框架问题——Vue 前端同样存在此问题（Vue 用原生 DOM 下拉，不涉及 Radix），说明 `/admin/usage/search-users` 和 `/admin/accounts?search=xxx` 两个接口要么返回空数据，要么 `name` 字段在数据库里为空。前端代码（React/Vue）逻辑均正确，暂不改动。下拉浏览菜单（⌄ 按钮）不受影响。

### 普通

- [ ]

### 已完成

- [x] User KeysView：表格列对齐 Vue（Expires/Last Used/Created/Usage+Quota 合并）（2026-03）
- [x] User KeysView：创建/编辑弹窗增加 Custom Key / IP Restriction / Expiration 开关（2026-03）
- [x] User UsageView：统计卡片改为图标+标题+数值+描述布局（2026-03）
- [x] 弹窗深色模式背景色统一为 `#1e293b`（2026-03）
