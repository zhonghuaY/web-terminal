# Web Terminal — Agent Rules

## Git Workflow

- **禁止直接 push 到 master 分支**。所有变更必须通过 Pull Request 合并到 master。
- 开发新功能或修复时，从 master 创建功能分支（如 `feat/xxx`、`fix/xxx`）。
- PR 创建后需要通过 CI 检查（类型检查 + 测试）才可合并。
- 合并方式：squash merge 或 regular merge 均可，保持 commit 历史清晰。

### 分支命名规范

| 类型 | 前缀 | 示例 |
|------|------|------|
| 新功能 | `feat/` | `feat/file-transfer` |
| 修复 | `fix/` | `fix/ws-reconnect` |
| 重构 | `refactor/` | `refactor/session-manager` |
| 文档 | `docs/` | `docs/deployment-guide` |

## Development

```bash
# 开发模式
./restart.sh dev

# 运行测试
npm test -w packages/server

# 类型检查
npx tsc --noEmit -p packages/server
npx tsc --noEmit -p packages/client
```

## Best Practices

- 每次修改必须使用最佳实践来实现。
- 遇到不清楚的问题，先查询 memoryX 搜索过往经验。
- 每次解决问题后，自动将踩坑经验存入 memoryX。
