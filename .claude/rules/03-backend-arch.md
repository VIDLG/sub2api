# 后端架构与代码生成

## 后端结构 (`backend/`)

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

## 代码生成（Ent + Wire）

**编辑 `backend/ent/schema/*.go` 后**，需要重新生成 Ent 模型和 Wire 提供者：

```bash
cd backend
go generate ./ent          # 重新生成 Ent ORM 代码
go generate ./cmd/server   # 重新生成 Wire DI 代码（wire_gen.go）
```

**不要手动编辑：**
- `backend/ent/`（除了 `ent/schema/`）
- `backend/cmd/server/wire_gen.go`

## 添加新的 Ent Schema

1. 创建 schema：`backend/ent/schema/my_entity.go`
2. 定义字段和边
3. 重新生成：`cd backend && go generate ./ent`
4. 如需要创建迁移（Ent Atlas 或手动 SQL）
5. 更新 repository/service 层

## 添加新的 API 端点

1. 在 `internal/handler/admin/` 或 `internal/handler/gateway/` 中定义处理器
2. 在 `internal/server/router.go` 中添加路由
3. 如果添加了新服务，在 `cmd/server/wire.go` 中更新 Wire 提供者
4. 重新生成 Wire：`go generate ./cmd/server`
5. 在 `frontend/src/api/` 或 `frontend-react/src/api/` 中添加对应的前端 API 调用

## 网关核心 (`internal/gateway/`)

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

## 依赖注入（Wire）

项目使用 [Wire](https://github.com/google/wire) 进行编译时依赖注入：

1. 编辑 `backend/cmd/server/wire.go` 定义提供者
2. 运行 `go generate ./cmd/server` 生成 `wire_gen.go`
3. Wire 在编译时解析依赖（比运行时 DI 更安全）
