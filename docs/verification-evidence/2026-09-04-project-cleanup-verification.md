# 项目工程与历史文件清理验证证据

## 1. 版本与边界

- 分支：`main`。
- 基线 HEAD：`4f57183684b5e38c7ec27ce202cdb165b50d1b42`。
- 边界：项目工程代码修复、历史文档与孤立脚本清理；不包含既有全量类型债务和裁剪仓库业务断言修复。
- 未执行提交或推送。

## 2. 清理与保留

- 已清理约 2.389 GiB 可重建的忽略产物。
- `output/`、`playwright-report/`、`.playwright-cli/`、`.playwright-mcp/`、`dist/`、`test-results/`、`.superpowers/`、`docs/superpowers/`、`data/state_store.db/`、`outputs/` 最终均不存在。
- 删除 229 个受版本控制文件；主要包括 154 份禁用工作流历史文档、禁用的 `.trae` 内容、9 个失效/无调用脚本、2 个旧 HTML、6 个运行状态文件和 2 个历史 Excel 输出。
- 保留范围复核：原型审查记录 182 个文件、需求追踪目录 14 个文件、`public/` 素材 36 个文件。
- 所有受版本控制删除均可从 Git 历史恢复；忽略产物需要由对应工具重新生成。

## 3. 工程验证

| 检查 | 结果 |
| --- | --- |
| `npm test` | 通过，3/3 |
| `npm run typecheck:engineering` | 通过 |
| `npm run build` | 通过，2396 个模块 |
| `npm run check:retained-contracts` | 通过，15/15 |
| package 脚本文件路径核查 | 242 个引用，缺失 0 |
| `npm run check:prototype-design-governance -- --all` | 通过，1 个用户可见文件绑定 1 份治理记录 |
| `npm run workflow:verify ...` | `verified`，blockers 0 |
| `git diff --check` | 通过 |

全量 `npm run typecheck` 仍失败，共 1567 个既有真实类型错误；TS5097 已从 3325 个降为 0。当前构建先执行渐进类型检查和单元测试，避免本次修复回退，同时不把既有债务伪装成已经解决。

## 4. 文档与检查入口

- `scripts/check-cutting-warehouse-location-map.ts` 已改读现行总体设计和实施计划。
- `scripts/check-wool-handover-printing.ts` 已改读现行毛织产品需求。
- 除历史审查记录和明确说明历史目录的文档外，运行代码、脚本、测试和 package 入口对 `docs/superpowers/` 的引用为 0。
- `npm run check:wool-handover-printing`：通过。
- 24 个孤立脚本的逐项结论见 `2026-09-04-orphan-script-audit.md`。

## 5. 已知非本任务失败

`npm run check:cutting-warehouse-location-map` 已通过本次迁移的文档来源断言，随后在第 2005 行的既有业务断言失败：T1 全部交出后，活动菲票实际为 `T1、T2`，预期仅 `T2`。该问题涉及业务数据/状态投影，不属于历史文档路径迁移；本次保留原始失败，不修改业务数据或降低断言。

## 6. 运行时与 CodeGraph

- Playwright CLI 打开 `/fcs/craft/cutting/cut-orders`，进入首条裁片单详情并切换“差异处理”页签；页面正常显示带单位的计划/实际数量，浏览器控制台错误数为 0。
- CodeGraph 同步：`Already up to date`。
- CodeGraph 状态：1570 个文件、48393 个节点、168979 条边，无待同步文件提示。
