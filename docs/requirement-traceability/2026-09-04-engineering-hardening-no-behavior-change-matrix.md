# 工程加固需求追踪与交付矩阵（不改变业务逻辑与原型展示）

| 需求编号 | 来源 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面/设备验证 | 状态 | 证据位置 | 产品确认人/版本 |
|---|---|---|---|---|---|---|---|---|---|
| WH-001 | 用户执行顺序 1 | 诊断 T1/T2 失败的真实根因，不删除断言或降低完整事件门禁 | WP1 | `scripts/check-cutting-warehouse-location-map.ts` 完整特殊工艺交出/回仓夹具 | `npm run check:cutting-warehouse-location-map` | 不适用：纯投影契约 | 已验证 | `docs/verification-evidence/2026-09-04-engineering-hardening-verification.md` | 不适用（内部工程）/ HEAD + 工作树 |
| WH-002 | 用户执行顺序 1 | T1 完全交出后只保留 T2 及其 10 片数量 | WP1 | 同上，T1 完全交出规范事件 | 同上 | 不适用：纯投影契约 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| WH-003 | 用户执行顺序 1 | T1 回仓 5 片后恢复为 T2 10 片、T1 5 片且总量守恒 | WP1 | 同上，T1 部分回仓规范事件 | 同上 | 不适用：纯投影契约 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| CUT-TYPE-001 | 用户执行顺序 2 | 裁剪主事件账字段类型与当前事实源一致 | WP2 | `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`、`generated-fei-tickets.ts`、`pda-handover-events.ts` | 定向全量 TypeScript 输出：负责文件 0 错误 | 不适用：类型层变更 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| CUT-TYPE-002 | 用户执行顺序 2 | 备料主链路状态联合、字段和可空类型错误清零 | WP2 | `src/data/fcs/cutting/production-material-prep.ts` | 定向类型 0 错误；`check:material-prep-pickup-management` 通过 | 不适用：类型层变更 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| CUT-TYPE-003 | 用户执行顺序 2 | 车缝派工主链路状态联合、字段和可空类型错误清零 | WP2 | `src/data/fcs/cutting/sewing-dispatch.ts` | 定向类型 0 错误；`check:cutting-sewing-dispatch`、`check:cutting-clean-mainline` 通过 | 不适用：类型层变更 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| TYPE-SCOPE-001 | 用户执行顺序 3 | `src/domain/` 被真实纳入严格渐进类型检查并通过 | WP3 | `scripts/check-typescript-scope.mjs`、`package.json` | `npm run typecheck:domain` / 聚合门禁：0 错误 | 不适用：静态检查 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| TYPE-SCOPE-002 | 用户执行顺序 3 | `src/components/ui/` 被真实纳入严格渐进类型检查并通过 | WP3 | 同上 | `npm run typecheck:ui` / 聚合门禁：0 错误 | 不适用：静态检查 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| TYPE-SCOPE-003 | 用户执行顺序 3 | `src/state/` 被真实纳入严格渐进类型检查并通过 | WP3 | 同上 | `npm run typecheck:state` / 聚合门禁：0 错误 | 不适用：静态检查 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| LINT-001 | 用户执行顺序 4 | 提供可重复执行的 lint 检查及安全修复命令 | WP4 | `biome.json`、`package.json`、`package-lock.json` | `npm run lint`：72 个文件通过 | 不适用：静态检查 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| FORMAT-001 | 用户执行顺序 4 | 提供可重复执行的 format check 与显式写入命令，不批量改写现有页面 | WP4 | 同上 | `npm run format:check`：8 个基线文件通过 | 不适用：静态检查 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| LOADER-001 | 用户执行顺序 5 | 复用类型安全懒加载器，保持模块只加载一次及导出接口不变 | WP5 | `src/main-infrastructure/retryable-module-loader.ts`、`src/main.ts` 全部 31 个固定动态入口 | 2 项加载器单测、全量类型、构建、菜单路由及浏览器交互通过 | 裁床唛架筛选、WLS 面料需求筛选正常；PDA 保持原登录重定向 | 已验证 | 同上及 `docs/verification-evidence/2026-09-05-engineering-review-completion-audit.md` | 不适用（内部工程）/ HEAD + 工作树 |
| ROUTE-001 | 用户执行顺序 5、后续审查候选 | 路由判断使用边界安全匹配，保持既有合法路径命中不变 | WP5 | `src/router/path-match.ts`、`src/main-handlers/fcs-handlers.ts`、`src/components/shell.ts`、`src/components/production-object-floating-entry.ts`、后道仓路由模式 | 8 项路由/最终外壳单测；菜单 175/175；后处理专项通过 | 真正确认单/合同打印页隐藏入口，相似 `confirmation-print-preview` / `printing` 路径显示；后道/毛织四个仓库路由标题正确 | 已验证 | 同上及 `docs/verification-evidence/2026-09-05-engineering-review-completion-audit.md` | 不适用（内部工程）/ HEAD + 工作树 |
| STORAGE-001 | 用户执行顺序 5 | 扩展现有浏览器存储封装并迁移第一批高集中度直接访问，保持 key、序列化和异常回退不变 | WP5 | `src/main.ts`、`src/state/store.ts`、`src/data/browser-storage.ts` | 2 项存储单测、构建通过 | 不适用：内部等价替换 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| GIANT-001 | 用户执行顺序 5 | 从巨型入口抽离第一批纯加载/路由/存储/事件基础设施，保持 HTML 与交互结果不变 | WP5 | `src/main.ts`、`src/main-infrastructure/retryable-module-loader.ts` | `src/main.ts` 2127→1770 行；构建、加载器单测、路由专项通过 | 裁床、PDA、技术资料与入驻命名页面交互正常，控制台 0 错误 | 已验证 | 同上及 `docs/verification-evidence/2026-09-05-engineering-review-completion-audit.md` | 不适用（内部工程）/ HEAD + 工作树 |
| RERENDER-001 | 后续审查候选 | 只合并 `input` / `change` 中完全相同的控件判定和后续渲染选择，保留技术资料、唛架、PDA `select` 的事件差异与原判断顺序 | WP5 | `src/main.ts` 的 `resolveSharedFieldRerenderDecision`、`renderAfterHandledPageEvent` | 全量类型、Biome、本地构建通过 | 唛架筛选、PDA 铺布连续输入与 726.00 米计算、技术资料类型切换、PDA 登录/入驻输入均通过且保持焦点 | 已验证 | `docs/verification-evidence/2026-09-05-engineering-review-completion-audit.md` | 不适用（内部工程）/ HEAD + 工作树 |
| CHECK-001 | 后续审查候选 | 专项脚本必须绑定当前文件、当前公开访问器和真实浏览器存储语义，且不得掩盖后续真实业务失败 | WP5 | `scripts/check-production-object-overview.ts`、`scripts/check-wool-warehouse-unified-model.ts`、`scripts/check-wool-warehouse-local-interactions.ts` | 毛织仓模型、持久化及两种浏览器模式通过；生产对象脚本继续执行到 `PH-20260328-007` 真实回溯断言 | 毛织仓按本次转出/转回记录及“仓库 ID + 库位 ID”组合身份通过；生产对象真实业务数据问题继续保留 | 已验证 | 同上 | 不适用（内部工程）/ HEAD + 工作树 |
| SAFE-001 | 用户硬约束 | 本轮不改变业务逻辑、Mock、路由、页面 HTML、文案、样式和交互结果 | WP1-WP5 | 全部本轮文件；类型兼容边界保留原运行时取值 | 业务专项、构建、治理、diff 审查通过 | 不适用：无用户可见变化 | 已验证 | 同上及无用户可见影响记录 | 不适用（内部工程）/ HEAD + 工作树 |

## 双向追踪规则

- 正向追踪：每个需求编号必须在实施后绑定实际文件/符号和一组充分证据。
- 反向追踪：最终 diff 中每项运行时代码变化必须能回到上述编号；无法绑定的变化必须撤回。
- 状态仅使用：`待实施`、`实施中`、`已实现待验证`、`已验证`、`已阻塞`、`不适用`。
