# Git 工作流

## 工作流偏好

**⚠️ 重要：除非用户明确要求，否则不要主动执行 Git 操作**

禁止主动执行：
- `git commit` - 不要主动提交代码
- `git push` - 不要主动推送到远程仓库
- `git pr` 或创建 Pull Request - 不要主动创建 PR

**只有在用户明确说"可以 commit 了"、"push 吧"、"做 PR"等指令时才执行这些操作。**

完成代码修改后，应该：
1. 运行 lint 和 type check 确保代码质量
2. 向用户报告修改完成，等待进一步指示
3. 不要自作主张进行 Git 操作

## 仓库关系

- **Wei-Shaw/sub2api** — 原项目（仅 Vue，无 React）
- **VIDLG/sub2api** (upstream) — 开发 React 前端的主仓库，接收 frontend-react 相关的 PR
- **daleydeng/sub2api** (origin) — 你的 fork

## 远程仓库配置

```bash
origin      - daleydeng/sub2api（你的 fork）
upstream    - VIDLG/sub2api（React 前端开发的主仓库）
```

## 提交 PR 到 upstream

```bash
# 使用 just 命令
just pr-upstream "PR title" "PR description"

# 或手动
gh pr create --repo VIDLG/sub2api --base main --head daleydeng:main --title "..." --body "..." --web
```

## 与 upstream 同步

```bash
git fetch upstream
git merge upstream/main
```

## 同步上上游（Wei-Shaw/sub2api）的 Vue 更新

```bash
git remote add origin-upstream https://github.com/Wei-Shaw/sub2api.git
git fetch origin-upstream
git merge origin-upstream/main
```

**注意：** 此操作是可选的，仅在需要 Vue 前端的上游更新时使用。
