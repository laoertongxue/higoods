# 三方工厂 PDA 三种车缝生命周期审计（2026-10-24）

## 范围与基线

审计对象是三方工厂 PDA 的三种实际车缝范围：独立车缝、车缝+烫包、裁剪+车缝+烫包，以及卫星车缝厂。业务规则以当前 Web 的 `merged-production-task`、`pda-experience-scope`、运行时任务和交接命令为准；V34 只作布局参考。

基线为合并 main `fa2e82324` 后的工作树 `publish-newpda-v34/higoods`，分支 `codex/pda-factory-split`。本次只审计三方生命周期边界，不宣称现场验收或完整三方交付。

## 分阶段结论

| 阶段 | 核对入口 | 结论 | 处理 |
| --- | --- | --- | --- |
| 报价/接单 | `pda-task-receive.ts`、`pda-task-receive-detail.ts`、`pda-receive-scope.ts`、任务/招标来源 | 列表和招标单已按工厂与三种车缝范围过滤；直接详情、接单/拒单包装和报价提交缺少三方任务范围复核。 | 已在详情渲染、接单/拒单事件、共享接单/拒单包装和报价提交处补 `assertThirdPartyReceiveTaskAllowed`；非车缝任务失败关闭。 |
| 开工/节点 | `pda-exec.ts`、`pda-exec-detail.ts`、`pda-experience-paths.ts` | 执行列表按当前工厂过滤；执行详情渲染和事件入口已有 `isCurrentPdaExecutionInScope`；专用双段执行路由对三方拒绝。 | 未改动；保留现有范围守卫。 |
| 分批交接/独立实收 | `pda-handover.ts`、`pda-handover-detail.ts`、`pda-third-party-scope.ts` | 交接列表、直接详情和事件均按当前工厂与真实任务范围核对；上游裁片接收允许，独立裁剪不放行；卫星车缝同一范围。 | 未改动；保留现有范围守卫。 |
| 结算 | `pda-settlement.ts` 及其结算数据源 | 结算按当前工厂/结算对象读取，没有跨厂读取路径；三方库管入口已隐藏。 | 未改动；结算明细的正向端到端仍属于后续验证。 |
| 公共边界 | `pda-shell.ts`、`routes-pda`、`pda-experience-paths` | 三方与卫星账号无仓管 Tab；仓管/工艺直链回退；KOL 特殊整单仍走独立只读入口。 | 未改动；KOL 旧整单迁移仍是遗留项。 |

## 本次实现

- `src/pages/pda-third-party-scope.ts`：新增 `assertThirdPartyReceiveTaskAllowed(factoryId, task, action)`，只允许独立车缝、车缝+烫包、裁剪+车缝+烫包；中央工厂不受影响。
- `src/pages/pda-task-receive.ts`：接单、拒单和报价提交调用该断言，避免共享命令被三方用于非车缝任务。
- `src/pages/pda-task-receive-detail.ts`：渲染前按当前三方会话核对任务范围，范围外显示“未找到任务”；接单/拒单事件再次核对，防伪造按钮。
- `tests/unit/third-party-pda-receive-scope.test.ts`：新增三方详情、中央对照、三种范围、非车缝拒绝及不写入合约。

## 验证与边界

- 专项 13 项通过：`third-party-pda-receive-scope`、`third-party-pda-handover-scope`、`pda-experience-scope`。
- 完整单测 1899/1899 通过；`typecheck:engineering` 范围内 0 错误；全量 `tsc` 的 19 项错误与 main 基线逐条一致，无本次新增；`vite build` 通过。上述仅证明本机技术基线，不代表现场验收。
- 当前 static Mock 没有分配给三方工厂的车缝任务，因此本轮没有执行“真实三方任务报价→接单→开工→分批交接→结算”的正向端到端；现有 S12 范围测试和代码路径核对只证明边界。正向 E2E、KOL 旧整单迁移、上游把非车缝任务分配给三方工厂的防错仍待后续。
- 共享的印花/染色/水溶接单命令自身仍未校验接单工厂与任务归属；PDA 三方入口已由包装层拦截，中央路径继续按原页面归属。该命令级不变量作为残留登记，不在本次扩大改动。
