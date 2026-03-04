# 开发命令详解

## 常用开发命令

### 查看所有命令
```bash
just
```

### 数据库管理
```bash
just db-up                         # 启动 PostgreSQL + Redis
just db-down                       # 停止数据库
just db-status                     # 检查数据库状态
just db-reset                      # 清空并重新初始化数据库
```

### 后端开发
```bash
just dev-be                        # 启动后端服务器（端口 8080）
just build-backend                 # 构建后端二进制文件
just test-backend                  # 运行 Go 测试
```

### 前端开发（Vue - 默认）
```bash
just dev-install-vue               # 安装 Vue 依赖
just dev-vue                       # 启动 Vue 开发服务器（端口 5173）
just build-vue                     # 构建 Vue 生产版本
just test-vue                      # 代码检查 + 类型检查
```

### 前端开发（React - 备选）
```bash
just dev-install-react             # 安装 React 依赖
just dev-react                     # 启动 React 开发服务器
just build-react                   # 构建 React 生产版本
just test-react                    # 代码检查 + 构建检查
```

### 生产构建（内嵌前端）
```bash
just build-embed-vue               # 构建包含 Vue 的单一二进制文件
just build-embed-react             # 构建包含 React 的单一二进制文件
just dev-serve-vue port=8081       # 运行内嵌 Vue 的二进制文件
```

## 数据库管理

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
