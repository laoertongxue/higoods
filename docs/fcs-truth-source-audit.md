# FCS 统一事实源审计报告

- 审计时间：2026-03-20T08:15:02.246Z
- 扫描文件数：69
- 发现问题数：44
- 高风险：0｜中风险：0｜低风险：44

## 审计结论概况

- 页面覆盖：19（高风险 0）
- 旧 seed 直接引用命中：5
- 页面内自猜逻辑命中：0
- 随机/不稳定业务对象命中：39

## 页面覆盖结果

| 页面 | 类别 | 主数据来源(import) | 旧 seed 直依赖 | 自猜逻辑 | 风险 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| src/pages/process-print-requirements.ts | 准备阶段页面 | ../data/fcs/page-adapters/process-prep-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/process-dye-requirements.ts | 准备阶段页面 | ../data/fcs/page-adapters/process-prep-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/process-print-orders.ts | 准备阶段页面 | ../data/fcs/page-adapters/process-prep-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/process-dye-orders.ts | 准备阶段页面 | ../data/fcs/page-adapters/process-prep-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/task-breakdown.ts | 核心执行页 | ../data/fcs/production-orders<br/>../data/fcs/runtime-process-tasks<br/>../data/fcs/production-demands<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/task-detail-rows | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/production/core.ts | 核心执行页 | ../../data/fcs/production-demands<br/>../../data/fcs/production-orders<br/>../../data/fcs/indonesia-factories<br/>../../data/fcs/tech-packs<br/>../../data/fcs/legal-entities<br/>../../data/fcs/runtime-process-tasks<br/>../../data/fcs/task-detail-rows<br/>../../data/fcs/store-domain-quality-bootstrap<br/>../../data/fcs/store-domain-quality-seeds<br/>../../data/fcs/page-adapters/long-tail-pages-adapter<br/>../../data/fcs/store-domain-settlement-seeds<br/>../../data/fcs/store-domain-settlement-types<br/>../../data/fcs/material-request-drafts | 1 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-task-receive.ts | PDA 页面 | ../data/fcs/process-tasks<br/>../data/fcs/indonesia-factories<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/page-adapters/task-chain-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-task-receive-detail.ts | PDA 页面 | ../data/fcs/process-tasks<br/>../data/fcs/production-orders<br/>../data/fcs/indonesia-factories<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/page-adapters/task-chain-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-exec.ts | PDA 页面 | ../data/fcs/process-tasks<br/>../data/fcs/indonesia-factories<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/page-adapters/task-chain-pages-adapter<br/>../data/fcs/pda-start-link<br/>../data/fcs/pda-exec-link | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/pda-exec-detail.ts | PDA 页面 | ../data/fcs/process-tasks<br/>../data/fcs/indonesia-factories<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/page-adapters/task-chain-pages-adapter<br/>../data/fcs/pda-start-link<br/>../data/fcs/pda-exec-link | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/progress-board.ts | 长尾页面 | ../data/fcs/process-tasks<br/>../data/fcs/process-types<br/>../data/fcs/production-orders<br/>../data/fcs/indonesia-factories<br/>../data/fcs/store-domain-progress<br/>../data/fcs/store-domain-quality-bootstrap<br/>../data/fcs/pda-start-link<br/>../data/fcs/pda-exec-link<br/>../data/fcs/handover-ledger-view<br/>../data/fcs/progress-exception-taxonomy<br/>../data/fcs/page-adapters/task-chain-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/progress-urge.ts | 长尾页面 | ../data/fcs/process-tasks<br/>../data/fcs/production-orders<br/>../data/fcs/indonesia-factories<br/>../data/fcs/store-domain-progress<br/>../data/fcs/handover-ledger-view<br/>../data/fcs/page-adapters/task-chain-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/dependencies.ts | 长尾页面 | ../data/fcs/process-tasks<br/>../data/fcs/store-domain-quality-bootstrap<br/>../data/fcs/page-adapters/task-chain-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/workbench.ts | 长尾页面 | ../data/fcs/page-adapters/long-tail-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/capacity.ts | 长尾页面 | ../data/fcs/production-orders<br/>../data/fcs/page-adapters/long-tail-pages-adapter | 0 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/qc-records.ts | 长尾页面 | ../data/fcs/process-tasks<br/>../data/fcs/store-domain-quality-bootstrap<br/>../data/fcs/store-domain-quality-seeds<br/>../data/fcs/store-domain-quality-types<br/>../data/fcs/return-inbound-workflow<br/>../data/fcs/return-inbound-qc-view<br/>../data/fcs/page-adapters/task-execution-adapter | 1 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/progress-exceptions.ts | 进度/异常/台账页 | ../data/fcs/process-tasks<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/process-types<br/>../data/fcs/production-orders<br/>../data/fcs/indonesia-factories<br/>../data/fcs/store-domain-dispatch-process<br/>../data/fcs/store-domain-progress<br/>../data/fcs/store-domain-quality-bootstrap<br/>../data/fcs/pda-start-link<br/>../data/fcs/pda-exec-link<br/>../data/fcs/handover-ledger-view<br/>../data/fcs/progress-exception-taxonomy<br/>../data/fcs/progress-exception-lifecycle | 1 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/material-issue.ts | 进度/异常/台账页 | ../data/fcs/store-domain-dispatch-process<br/>../data/fcs/page-adapters/task-execution-adapter<br/>../data/fcs/store-domain-quality-bootstrap | 1 | 0 | 低 | 继续保持，仅做事实源绑定维护 |
| src/pages/material-statements.ts | 进度/异常/台账页 | ../data/fcs/store-domain-dispatch-process<br/>../data/fcs/store-domain-quality-bootstrap | 1 | 0 | 低 | 继续保持，仅做事实源绑定维护 |

## 模块覆盖结果

| 模块 | 文件 | 状态 | 风险数 | 备注 |
| --- | --- | --- | --- | --- |
| 工序工艺字典 | src/data/fcs/process-craft-dict.ts | 已存在 | 0 | 通过（无高/中风险） |
| 统一生成引擎 | src/data/fcs/production-artifact-generation.ts | 已存在 | 0 | 通过（无高/中风险） |
| 任务兼容层 | src/data/fcs/process-tasks.ts | 已存在 | 0 | 通过（无高/中风险） |
| 运行时任务层 | src/data/fcs/runtime-process-tasks.ts | 已存在 | 2 | 通过（无高/中风险） |
| 统一进度/异常事实域 | src/data/fcs/store-domain-progress.ts | 已存在 | 0 | 通过（无高/中风险） |
| 兼容分发适配层 | src/data/fcs/store-domain-dispatch-process.ts | 已存在 | 0 | 通过（无高/中风险） |
| 仓库执行层 | src/data/fcs/warehouse-material-execution.ts | 已存在 | 0 | 通过（无高/中风险） |
| PDA 域 | src/data/fcs/pda-handover-events.ts | 已存在 | 0 | 通过（无高/中风险） |

## 最终结论

- 已统一：工序工艺字典、生成引擎、runtime task、统一进度异常域主线。
- 兼容过渡：dispatch-process 旧 shape 通过适配层映射新事实源。
- 高风险项：已清零。
- 中低风险项：以兼容层保留、页面内提示性规则命中为主，后续可按优先级继续压缩。

