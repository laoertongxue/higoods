# 原子需求追踪矩阵

来源：2026-09-12-dyeing-quantity-reconciliation-design.md。每行规范性需求回溯设计章节；反向范围以审查记录受管文件及 verified-version.json 为准。所有代码位置位于 src/data/fcs 或 src/pages/process-factory/dyeing，特殊位置单列。自动证据简称对应审查记录第7节命令；证据目录统一为 output/playwright/dye-quantity-reconciliation。

| 编号 | 来源章节 | 原子需求 | 工作包 | 实现位置 | 自动验证 | 页面验证 | 状态 | 证据 | 确认人与版本 |
|---|---|---|---|---|---|---|---|---|---|
| REC-001 | §2 | 仅实际接收入库且重读不重复 | W1 | factory-receiving-links.confirmFactoryMaterialReceipt；factory-internal-warehouse.ensureFactoryInternalWarehouseStore | quantity/integration | pending-receipts、wait-process-warehouse | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| REC-002 | §2 | 本批实际用料扣减对应库存并阻断超用 | W1 | factory-receiving.recordFactoryMaterialUsage；dyeing-task-domain.startDyeing/completeDyeing | quantity/receipt-batches | wait-process-warehouse | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| REC-003 | §2 | 备料关联不增加物理库存且按 SKU 校验 | W1 | factory-receiving-links.allocateReceivedMaterialToOrder；listReceivingAllocationTargets | quantity/integration | wait-process-warehouse | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| REC-004 | §2 | 开工支持实际部分数量且持久化 | W1 | process-action-writeback-service.executeDyeAction；dyeing-task-domain 持久化执行批次 | quantity/receipt-batches | work-orders、work-order-detail | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| OUT-001 | §3 | 新面料交出必须逐卷单且禁止旧数量捷径 | W2 | dyeing-task-domain.finishDyeDispatchDocument；process-execution-writeback；pda-handover-events.createFactoryHandoverRecord | dispatch/workflow | pending-handover、handover-documents | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| OUT-002 | §3 | 实收按原交出记录、0少超收分次累加 | W2 | factory-receiving-links；dyeing-task-domain.createReviewFromHandover | quantity/dispatch | handover-documents、wait-handover-warehouse | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| OUT-003 | §3 | 统计页不再代确认全部收货 | W2 | reports/events；dyeing-task-domain.confirmDyeReceipt | quantity/receipt-batches | reports | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| OUT-004 | §3 | 纱线净重及实收状态一致 | W2 | dyeing-task-domain 实收状态推导；factory-receiving-links | integration | work-orders、reports | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| VIEW-001 | §4 | MJS与历史未用库存正常显示 | W3 | dyeing-warehouse-view.getDyeingWarehouseView | quantity | wait-process-warehouse | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| VIEW-002 | §4 | 库存、用料、产出、交出与实收读取一致事实 | W3 | dyeing-quantity-facts.getDyeingQuantityFacts；process-statistics-domain；work-order-detail | quantity | warehouse、reports、order-statistics.png | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| VIEW-003 | §4 | 统计单位分组、累计包装与接收不重不漏 | W3 | dyeing-quantity-facts.groupDyeQuantities；process-statistics-domain.getDyeingExecutionStatistics | quantity/three-axis | reports、order-statistics.png | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| VIEW-004 | §4 | 物料图片与来源/关联跳转准确 | W3 | dyeing-warehouse-view；warehouse.materialCell/renderInboundRows | browser-results.json | material-preview.png、image-failure.png | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| QA-001 | §5 | 业务/持久化与页面两轮验收 | W4 | scripts/check-dyeing-quantity-reconciliation.ts；审查记录第7节 | quantity/build/types/browser | 7页、明细、打印 | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |
| SCOPE-001 | §1 | 仅三项修复范围、保留其他工作区改动 | W4 | 本轮基线 SHA256 与 verified-version.json 对照 | 本轮文件清单审查；git diff --check | 不适用：范围控制 | 已验证 | 审查记录第7节、证据目录 | 用户授权；Codex本地验证；75f85bad+verified-version.json，产品接受待用户确认 |

最终合并发布前已统一重验：[2026-09-12 染厂审查记录](prototype-review-records/2026-09-12-dyeing-audit-closure.md)。以该记录及最终任务收据的文件版本为准，旧阶段验证不替代当前证据。
