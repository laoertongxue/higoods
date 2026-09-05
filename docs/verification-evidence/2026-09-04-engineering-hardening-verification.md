# 工程加固验证证据

## 1. 版本与边界

- 分支：`main`。
- 基线 HEAD：`4f57183684b5e38c7ec27ce202cdb165b50d1b42`。
- 本轮仅做工程加固与契约夹具修复，不提交、不推送、不部署。
- 页面 HTML、文案、样式、图片、业务状态、数量公式、Mock 展示和合法路由均未改动。

## 2. 分阶段结果

1. T1/T2：根因是旧检查构造的特殊工艺事件不满足现行完整事件门禁；生产投影会正确忽略该不完整事件。补齐规范事件字段后，T1 完全交出只保留 T2，T1 回仓 5 片后恢复为 T2 10 片、T1 5 片。
2. 裁剪类型：事件账、配料、车缝派工及直接类型定义的目标错误为 0；运行时值和分支保持不变。
3. 渐进类型：`src/domain/`、`src/components/ui/`、`src/state/` 范围内错误均为 0；全量既有错误继续单列。
4. lint/format：新增 Biome 基线，只覆盖已治理目录和本轮基础设施/测试文件，没有全仓格式化。
5. 基础设施：首批 6 个、后续扩大到全部 31 个固定动态模块入口复用可重试加载器；后处理/特殊工艺路由改用段边界匹配；`main` 与 `state/store` 存储访问迁入现有封装；入口文件减少重复实现。

## 3. 最终自动化证据

| 检查 | 结果 |
| --- | --- |
| `npm run check:cutting-warehouse-location-map` | 通过 |
| `npm run check:cutting-sewing-dispatch` | 通过 |
| `npm run check:cutting-clean-mainline` | 通过，168 条主链路事件 |
| `npm run check:material-prep-pickup-management` | 通过 |
| 裁剪目标文件全量 TypeScript 过滤 | 0 个错误 |
| `npm run typecheck:engineering` | 通过，三个渐进目录 0 个错误；后续全量 `npm run typecheck` 也已降为 0 |
| `npm run lint` | 通过，72 个文件 |
| `npm run format:check` | 通过，8 个基线文件 |
| `npm test` | 通过，10/10 |
| `npm run build` | 通过，2398 个模块 |
| `npm run check:menu-routes` | 通过，175/175，重复 0 |
| `npm run check:process-factory-tabs-and-post-finishing` | 通过 |
| `npm run check:retained-contracts` | 通过，15/15 |
| `npm run check:prototype-design-governance -- --all` | 通过，1 个用户可见文件、12 个纯技术文件、2 份治理记录均已绑定 |
| `git diff --check` | 通过 |
| `npm run workflow:verify -- ...` | `verified`，blockers 0；收据位于 `/private/tmp/higoods-engineering-hardening-task-receipt.json` |
| `codegraph sync` | `Already up to date` |
| CodeGraph status | 1576 文件、48438 节点、167673 边 |

## 4. 当时遗留项的后续状态

- 本节原记录的 1502 个 TypeScript 错误是 2026-09-04 第一批结束时的历史快照；后续全量严格检查已清零，且未增加 `@ts-nocheck`、`@ts-ignore` 或放宽编译范围。
- 特殊工艺“缺少待绑定菲票视图”已按当前完整来源事实修复契约：当前 Mock 的菲票全部有绑定来源，专项验证待绑定数量为 0，并保留其他业务状态断言。
- 动态加载器已从第一批 6 个扩展为全部 31 个固定入口；加载器单测、构建、菜单路由和代表性页面交互均通过。
- 仍需分批治理的是 97 个超 1500 行 TypeScript 文件、尚未分类的浏览器存储引用、路由总分发重复、输入/变更重绘规则重复和 HTML 转义一致性；它们不适合以全仓机械替换方式处理。
