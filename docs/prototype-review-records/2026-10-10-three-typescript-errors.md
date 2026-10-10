# 三个 TypeScript 错误修复记录

依据 `AGENTS.md` 的 SCOPE-03、REVIEW-01、STORE-04、EVIDENCE-01。

## 基本信息

- 日期：2026-10-10
- 任务 / 需求编号：TS-001、TS-002、TS-003，全库三个 TypeScript 错误修复
- 验证人：Codex 主代理；TMF 实现由独立子代理完成，主代理逐行审查；FCS 由子代理只读邻接审查

## 影响判定

- 记录模式：无用户可见影响声明
- 用户可见影响：无
- 判定依据：仅修正收货同步的文档联合类型边界和 TMF 存储删除能力判断；页面字段、路由、交互与正常业务数量未改。TMF 异常路径保留旧迁移源，不再因解析、校验或目标事务失败删除可恢复数据；这一存储保护变化已单独验证，没有把它表述为纯语法调整。

## 修复与逐项验证

| 检查项 | 结论 | 证据 |
| --- | --- | --- |
| TS-001：WarehouseExecutionDoc[] 不能传入 CentralTransferDocument[] | 通过 | 同步入口先过滤 RETURN，再共同供上游匹配和来源创建使用；实际 7 单位出仓、11 单位调拨、99 单位退仓混合输入只产生合计 18 的有效来源。未审核、重复同步、退仓独占输入和空数组均验证。 |
| TS-002：成功迁移后的 removeItem 可能不存在 | 通过 | 复用 removeBrowserStorageItem；仅真实返回成功时记 DONE。缺少删除方法或删除抛错时原键保留，不出现 TypeError 或虚假完成。 |
| TS-003：异常分支的 removeItem 可能不存在 | 通过 | 删除失败后的源数据清理分支；JSON、结构校验和目标事务 abort 保留原源与原目标，继续抛出原错误。 |
| 全库类型检查与构建 | 通过 | typecheck 退出 0；工程类型检查、772 个单测及 Vite 构建通过。未修改编译配置、降低严格检查或新增类型错误屏蔽。 |

## 变更覆盖与验证

### 受管文件

- `src/data/fcs/factory-receiving-source-sync.ts`
- `src/data/pms/tmf-material-purchases.ts`

### 技术证据

- 对象与结果：FCS 原循环本来排除 RETURN，本次提前执行同一限制并复用集合，不修改输入；真实接收来源数量和幂等结果保留。TMF 读取旧键，经原格式校验和真实 pmsTx 写入四个 section；模拟浏览器存储设施验证事务 complete 后才删除、事务失败不删源、不改原目标。6 个迁移专项、89 个 TMF/浏览器存储回归、4 个接收相关回归和 772 个全量单测通过；这些计数包含交叉覆盖，不相加作为不同用例总数。
- 证据：[本次源码摘要](../verification-evidence/2026-10-10-three-typescript-errors/source-manifest.json)、[修复前类型错误](../verification-evidence/2026-10-10-three-typescript-errors/typecheck-before.log)、[全库类型检查通过](../verification-evidence/2026-10-10-three-typescript-errors/typecheck-after.log)、[迁移反例修复前](../verification-evidence/2026-10-10-three-typescript-errors/migration-before.log)、[迁移修复后](../verification-evidence/2026-10-10-three-typescript-errors/migration-after.log)、[TMF 回归](../verification-evidence/2026-10-10-three-typescript-errors/tmf-regression.log)、[收货回归](../verification-evidence/2026-10-10-three-typescript-errors/receiving-regression.log)、[独立接收审查复验](../verification-evidence/2026-10-10-three-typescript-errors/receiving-independent-review.log)、[构建日志](../verification-evidence/2026-10-10-three-typescript-errors/build.log)。

### 验证命令

- `npm run typecheck`：通过
- `node --import tsx --test tests/unit/factory-receiving-source-sync.test.ts tests/unit/receiving-scoped-reads.test.ts tests/unit/printing-dispatch-read.test.ts`：通过
- `node --import tsx --test tests/unit/tmf-legacy-migration.test.ts`：通过
- `npm run build`：通过

## 范围与证据说明

分支为 `codex/sidebar-menu-group-ui`，HEAD 为 `99e25a0b846188176516a882b8c8d30fb915f6ef`；本次只新增两份专项测试、修改两份运行源码并记录直接证据。前一任务的指导文件与检查器差异保留原身份，未改写旧日志中的“当时存在 3 个错误”。本次全库 TypeScript 已为 0 错误。

没有修改页面模板、图片、打印、路由、渲染调度或新增用户动作，不用产品页面、PDA 或性能截图替代本次类型与存储故障契约检查；本次适用验证为编译器、真实函数执行及数量/事务边界。所有存储测试在隔离 Node 进程中使用内存夹具，不操作用户浏览器或数据库。

按 RECEIPT-01，本次不运行会纳入整个未提交工作区的 workflow:verify：当前尚有前一治理任务的 91 项差异，--paths 不是任务过滤器。本次改用明确路径的产品治理检查及上述全库类型/构建和专项证据；前一任务的收据保留原版本，不冒充这次修复的收据。

构建仍有既有大 chunk 提示，不影响退出结果。本次未涉及推送或部署。
