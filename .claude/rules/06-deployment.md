# 部署配置与内嵌前端构建

## 配置

**开发环境：** `.env.dev`（由 Justfile 自动加载）
**生产环境：** `config.yaml`（通过 `--config` 标志或默认位置传递）

环境变量会覆盖 YAML 配置（12-factor app 模式）。

## 构建输出

- Vue 构建到 `backend/internal/web/dist-vue/`
- React 构建到 `backend/internal/web/dist-react/`
- 通过 Go build tags 选择内嵌哪个前端：`-tags embed`（Vue）或 `-tags "embed react"`（React）
- embed 声明分别在 `embed_fs_vue.go` 和 `embed_fs_react.go` 中

**不使用 `-tags embed`**，二进制文件将不会提供前端服务（仅 API 模式）。

## 内嵌前端构建

**生产部署：**

```bash
# 构建 Vue 内嵌二进制文件
just build-embed-vue
cd backend && pixi run go build -tags embed -ldflags="-s -w" -o bin/server-vue ./cmd/server

# 构建 React 内嵌二进制文件
just build-embed-react
cd backend && pixi run go build -tags embed -ldflags="-s -w" -o bin/server-react ./cmd/server
```

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

## 环境变量

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
