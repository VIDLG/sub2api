# 已知问题

### Antigravity + Claude Code Plan Mode

使用 Antigravity 账户时，Claude Code 的 Plan Mode 无法自动退出。

**解决方法：** 按 `Shift+Tab` 手动退出，然后批准/拒绝计划。

### Sora 支持

由于上游集成问题，暂时不可用。

**注意：** 生产环境不要依赖 `gateway.sora_*` 配置项。

### Go 编译错误

如果遇到类似以下错误：
```
# github.com/imroc/req/v3
.\go\pkg\mod\github.com\imroc\req@v3.57.0\client.go:432:20:
undefined: quic.ConnectionTracingID
```

**原因：** `imroc/req/v3@v3.57.0` 与 `quic-go@v0.59.0` 不兼容。这是上游项目存在的问题。

**状态：** 待上游修复。暂无解决方法，如需编译后端可暂时降级依赖。
