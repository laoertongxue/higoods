# 标准列表页治理门禁配置

仓库内的 `list-page-governance` 工作流会在 Pull Request 和推送到 `main` 时执行。它检查列表页模式声明、标准组件契约、分页、列能力、原型审查记录，并运行补料管理模板验收和构建。

## 本地

提交或交付前运行：

```bash
npm run check:list-page-governance
npm run build
```

`npm run build` 通过 `prebuild` 自动重复执行统一列表页治理检查，因此本地构建失败时不能交付。

## GitHub 必检状态

仓库管理员需要在 GitHub 的 `Settings → Branches`（或 `Rulesets`）为 `main` 配置保护规则：

1. 要求通过 Pull Request 合并。
2. 将 `list-page-governance` 添加为 Required status check。
3. 禁止绕过规则的强制推送和直接推送（按团队权限策略配置）。

工作流不会自动修改 GitHub 分支保护设置；这是仓库管理员必须完成的一次性配置。配置完成后，任何新增或调整列表页都必须先通过该检查才能合并。

历史未迁移列表页只允许以 `scripts/standard-list-page-baseline.json` 中的原始哈希临时保留。禁止通过新增或修改哈希绕过检查；页面一旦调整，必须声明 `// @page-pattern: list` 并迁移到标准列表页组件契约。
