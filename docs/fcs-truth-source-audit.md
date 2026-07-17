# FCS 统一事实源审计报告

- 审计时间：2026-07-15T15:37:30.658Z
- 扫描文件数：205
- 发现问题数：57
- 高风险：0｜中风险：19｜低风险：38

## 审计结论概况

- 页面覆盖：16（高风险 0）
- 旧 seed 直接引用命中：2
- 页面内自猜逻辑命中：7
- 随机/不稳定业务对象命中：48

## 页面覆盖结果

| 页面 | 类别 | 主数据来源(import) | 旧 seed 直依赖 | 自猜逻辑 | 风险 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| src/pages/process-print-orders.ts | 准备阶段页面 | ../data/fcs/page-adapters/process-prep-pages-adapter<br/>../data/fcs/printing-task-domain.ts<br/>../data/fcs/factory-master-store.ts<br/>../data/fcs/process-work-order-stock.ts<br/>../data/fcs/process-platform-status-adapter.ts | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/process-dye-orders.ts | 准备阶段页面 | ../data/fcs/page-adapters/process-prep-pages-adapter<br/>../data/fcs/dyeing-task-domain.ts<br/>../data/fcs/factory-master-store.ts<br/>../data/fcs/process-work-order-stock.ts<br/>../data/fcs/process-platform-status-adapter.ts | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/task-breakdown.ts | 核心执行页 | ../data/fcs/production-orders.ts<br/>../data/fcs/production-order-identity.ts<br/>../data/fcs/runtime-process-tasks.ts<br/>../data/fcs/process-tasks.ts<br/>../data/fcs/pda-start-link.ts<br/>../data/fcs/pda-exec-link.ts<br/>../data/fcs/production-artifact-generation.ts<br/>../data/fcs/cutting/generated-cut-orders.ts<br/>../data/fcs/page-adapters/task-execution-adapter.ts<br/>../data/fcs/task-detail-rows.ts | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/production/core.ts | 核心执行页 | - | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-task-receive.ts | PDA 页面 | ../data/fcs/process-tasks<br/>../data/fcs/factory-master-store<br/>../data/fcs/factory-mock-data<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/page-adapters/task-chain-pages-adapter<br/>../data/fcs/pda-mobile-mock<br/>../data/fcs/pda-cutting-execution-source.ts<br/>../data/fcs/process-mobile-task-binding.ts<br/>../data/fcs/post-finishing-domain.ts<br/>../data/fcs/pda-receive-scope.ts<br/>../data/fcs/wool-task-domain.ts<br/>../data/fcs/runtime-process-tasks.ts<br/>../data/fcs/sewing-delivery-sla.ts<br/>../data/fcs/process-quantity-labels.ts | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-task-receive-detail.ts | PDA 页面 | ../data/fcs/process-tasks<br/>../data/fcs/production-orders<br/>../data/fcs/factory-master-store<br/>../data/fcs/factory-mock-data<br/>../data/fcs/pda-mobile-mock<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/pda-cutting-execution-source.ts<br/>../data/fcs/process-mobile-task-binding.ts<br/>../data/fcs/special-craft-pda-scope.ts<br/>../data/fcs/dispatch-acceptance-sla.ts<br/>../data/fcs/sewing-delivery-sla.ts | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-exec.ts | PDA 页面 | ../data/fcs/process-tasks<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/pda-cutting-execution-source.ts<br/>../data/fcs/pda-task-mock-factory.ts<br/>../data/fcs/wool-task-domain.ts<br/>../data/fcs/water-soluble-task-domain.ts<br/>../data/fcs/mobile-execution-task-index.ts<br/>../data/fcs/process-mobile-task-binding.ts<br/>../data/fcs/special-craft-pda-scope.ts<br/>../data/fcs/printing-task-domain.ts<br/>../data/fcs/dyeing-task-domain.ts<br/>../data/fcs/post-finishing-domain.ts<br/>../data/fcs/process-quantity-labels.ts<br/>../data/fcs/pda-start-link<br/>../data/fcs/pda-exec-link | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-exec-detail.ts | PDA 页面 | ../data/fcs/process-tasks.ts<br/>../data/fcs/factory-mock-data.ts<br/>../data/fcs/factory-master-store.ts<br/>../data/fcs/pda-handover-events.ts<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/pda-cutting-execution-source.ts<br/>../data/fcs/cutting/special-craft-fei-ticket-flow.ts<br/>../data/fcs/special-craft-task-orders.ts<br/>../data/fcs/process-warehouse-domain.ts<br/>../data/fcs/pda-start-link<br/>../data/fcs/pda-exec-link<br/>../data/fcs/task-qr.ts<br/>../data/fcs/factory-mock-data.ts<br/>../data/fcs/production-order-identity.ts<br/>../data/fcs/production-object-overview.ts<br/>../data/fcs/printing-task-domain.ts<br/>../data/fcs/wool-task-domain.ts<br/>../data/fcs/dyeing-task-domain.ts<br/>../data/fcs/process-execution-writeback.ts<br/>../data/fcs/process-action-writeback-service.ts<br/>../data/fcs/process-quantity-labels.ts<br/>../data/fcs/post-finishing-domain.ts<br/>../data/fcs/post-finishing-domain.ts<br/>../data/fcs/mobile-execution-task-index.ts<br/>../data/fcs/process-mobile-task-binding.ts<br/>../data/fcs/special-craft-pda-scope.ts<br/>../data/fcs/store-domain-pda.ts<br/>../data/fcs/sewing-delivery-sla-view.ts<br/>../data/fcs/sewing-delivery-sla.ts<br/>../data/fcs/water-soluble-task-domain.ts<br/>../data/fcs/water-soluble-pda-actor.ts | 0 | 7 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/progress-board.ts | 长尾页面 | - | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/progress-urge.ts | 长尾页面 | ../data/fcs/process-tasks<br/>../data/fcs/production-orders<br/>../data/fcs/indonesia-factories<br/>../data/fcs/store-domain-progress.ts<br/>../data/fcs/handover-ledger-view<br/>../data/fcs/page-adapters/task-chain-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/workbench.ts | 长尾页面 | ../data/fcs/page-adapters/long-tail-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/capacity.ts | 长尾页面 | ../data/fcs/production-orders<br/>../data/fcs/capacity-calendar<br/>../data/fcs/capacity-calendar-overrides<br/>../data/fcs/page-adapters/long-tail-pages-adapter<br/>../data/fcs/factory-capacity-profile-mock<br/>../data/fcs/factory-master-store<br/>../data/fcs/production-order-identity | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/qc-records.ts | 长尾页面 | - | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/progress-exceptions.ts | 进度/异常/台账页 | - | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/material-issue.ts | 进度/异常/台账页 | ../data/fcs/store-domain-dispatch-process<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/store-domain-quality-bootstrap<br/>../data/fcs/production-order-identity | 1 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/material-statements.ts | 进度/异常/台账页 | ../data/fcs/store-domain-dispatch-process<br/>../data/fcs/store-domain-settlement-seeds<br/>../data/fcs/store-domain-quality-bootstrap<br/>../data/fcs/settlement-flow-boundaries<br/>../data/fcs/production-order-identity | 1 | 0 | 低 | 继续保持，仅做事实源绑定维护 |

## 模块覆盖结果

| 模块 | 文件 | 状态 | 风险数 | 备注 |
| --- | --- | --- | --- | --- |
| 工序工艺字典 | src/data/fcs/process-craft-dict.ts | 已存在 | 0 | 通过（无高/中风险） |
| 统一生成引擎 | src/data/fcs/production-artifact-generation.ts | 已存在 | 0 | 通过（无高/中风险） |
| 任务兼容层 | src/data/fcs/process-tasks.ts | 已存在 | 0 | 通过（无高/中风险） |
| 运行时任务层 | src/data/fcs/runtime-process-tasks.ts | 已存在 | 4 | 通过（无高/中风险） |
| 统一进度/异常事实域 | src/data/fcs/store-domain-progress.ts | 已存在 | 0 | 通过（无高/中风险） |
| 兼容分发适配层 | src/data/fcs/store-domain-dispatch-process.ts | 已存在 | 0 | 通过（无高/中风险） |
| 仓库执行层 | src/data/fcs/warehouse-material-execution.ts | 已存在 | 0 | 通过（无高/中风险） |
| PDA 域 | src/data/fcs/pda-handover-events.ts | 已存在 | 0 | 通过（无高/中风险） |

## 最终结论

- 已统一：工序工艺字典、生成引擎、runtime task、统一进度异常域主线。
- 兼容过渡：dispatch-process 旧 shape 通过适配层映射新事实源。
- 高风险项：已清零。
- 中低风险项：以兼容层保留、页面内提示性规则命中为主，后续可按优先级继续压缩。

