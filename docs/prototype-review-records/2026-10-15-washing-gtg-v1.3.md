# GTG 固定承接与洗水加工单结构 V1.3 产品审查

依据：[AGENTS.md](../../AGENTS.md) 的 SCOPE-02、REVIEW-01、PERF-01、EVIDENCE-01，使用唯一产品审查记录模板。

## 基本信息

- 日期：2026-10-15
- 任务 / 需求编号：WASH-226～WASH-266（用户六项更正）
- 验证人：Codex 主代理（技术验证；产品接受待用户）

## 影响判定

- 记录模式：完整产品审查
- 用户可见影响：有
- 判定依据：固定 GTG 承接，按实物改变印花下游和技术包实际追加路线，新增印花标识/日志/新窗口链接，删除上下文选择，洗水列表/详情七组结构，并修复直接 PDA 仓库与读取性能。初始生产拆解不预设洗水。

## 自查结论

| 检查项 | 结论 | 证据 / 问题及处理 |
| --- | --- | --- |
| 业务对象与现场触摸 | 通过 | 面料实际完成才判断；纸张/非面料/暂停/草稿占用阻断；domain-final.log 与边缘契约 |
| 固定 GTG 与不可用阻断 | 通过 | 新单待接单、不可改其他厂、暂停不落单；主流程五次与停用契约 |
| 接单、拒单与重新承接 | 通过 | GTG 原单重派入口及拒单原因保留；主流程五次 |
| 原下游及部分卷范围 | 通过 | 已洗范围经 GTG，未洗范围保留；洗后原工厂/中央仓均实际收回 |
| 实际路线与初始拆解 | 通过 | 精确版本/生产单关联；无洗/作废不生成有效路线；不写第二套基准技术包 |
| 标识、日志、新窗口 | 通过 | 实际发起者/时间/单据/卷范围；多单逐单链接；隔离浏览器真实 popup 校验 |
| 七组加工单及数量 | 通过 | 七组字段、原量/实收/完成/变化/下游单位明确；50→49 Yard 差异未代填 |
| 列表查询/导出/排序/列设置 | 通过 | GTG 查询 CSV 同源，36 单列表、隐藏/恢复/冻结/拖动/分页及旧偏好 |
| Web/PDA 与直接仓库 | 通过 | Web 三种尺寸；GTG PDA 390×844；原仓库数量与确切单据跳转；详见验收索引 |
| 原子保存与失败 | 通过 | complete 后回读；中止/超限无半套、双标签冲突及原操作重试 |
| 旧身份、旧附件和恢复 | 通过 | 旧未派厂读取不改写，明确调整 GTG 后保存；备份/Blob/共享引用及升级边界 |
| 真实图片与大图 | 通过 | 本蓝白棉府绸对应 /materials/fei-ticket/blue-white-print-cotton.png；Polo 对应本地 polo-white.jpg；实际图片加载和大图开关，旧失败态专项保留 |
| 打印图片、卷码和版式 | 通过 | GTG/原下游/手感/数量和真 Code128；实际预览六卷；不声称实体打印机已出纸 |
| 性能 | 通过 | performance-final.json：82 家族、461 有效通过样本，每家族≥5，最大 946.8000000119209ms；旧失败及修复映射均保留 |
| 直接上下游与两轮对抗审查 | 通过 | acceptance-v1.3.md 中逐项问题、修复和回放；未使用代理代审 |
| 非范围与数据保护 | 通过 | 未增加配方、后端、云库、任意工厂派发；未连接测试数据库；未提交发布 |

## 最终结论

结论：通过

## 变更覆盖与验证

### 受管文件

- `src/components/actual-washing-route.ts`
- `src/data/fcs/fabric-washing-model.ts`
- `src/data/fcs/fabric-washing-repository.ts`
- `src/data/fcs/fabric-washing-views.ts`
- `src/data/fcs/fabric-washing.ts`
- `src/data/fcs/factory-mobile-warehouse.ts`
- `src/data/fcs/indonesia-factories.ts`
- `src/data/fcs/production-demand-early-process-work-orders.ts`
- `src/pages/fcs-production-tech-pack-snapshot.ts`
- `src/pages/pda-warehouse-shared.ts`
- `src/pages/print/printing-sheet-preview.ts`
- `src/pages/print/templates/printing-sheet-template.ts`
- `src/pages/process-factory/dyeing/washing/order-presentation.ts`
- `src/pages/process-factory/dyeing/washing/work-orders.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/relations.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-work-orders/order-list-columns.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pcs.ts`

### 页面证据

- 版本：codex/post-print-fabric-washing；HEAD 09881217da6db7ae5bd79fa286165e1c3a02caa5 + 未提交源码摘要 b9534f5c3305dd80206a783a71eca0172e6bddd3df7ca630dc017496faead824；工作树 /Users/laoer/.codex/worktrees/a266/higoods；正式服务 127.0.0.1:43159；运行资产 runtime-assets.json。源码级隔离开发服务 43157 单列。
- 证据：[专项验收索引](../verification-evidence/2026-10-15-washing-gtg-v1.3/acceptance-v1.3.md)、[逐条矩阵](../verification-evidence/2026-10-15-washing-gtg-v1.3/atomic-verification-v1.3.json)。命名路由：/fcs/craft/printing/work-orders；/fcs/craft/dyeing/washing/work-orders 及详情；/pcs/products/styles/style_demand_SPU_2024_009/technical-data/tdv_demand_SPU_2024_009；/fcs/production/orders/PO-202603-0003/tech-pack?tab=process；/fcs/pda/washing/:id；/fcs/pda/warehouse/wait-process、wait-handover；/fcs/print/preview。实际 CUA 1280/1024 截图为 initiation-1280.jpg、washing-detail-1280.jpg、printing-log-1280.jpg、washing-list-cua-1024.jpg 和 washing-transfer-preview-cua.jpg；自动 Web 1366/1280/1024、PDA 390×844 的原始报告保留。

### 性能结论

- 结论：通过
- 依据：[performance-final.json](../verification-evidence/2026-10-15-washing-gtg-v1.3/performance-final.json) 的起止定义、逐样本、版本、复用原因及失败修复映射；77 印花/36 有效洗水单，不缩减规模或删慢值。

### 验证命令

- `npm run build`：通过
- `npm exec vite -- build`：通过
- `node scripts/check-typescript-scope.mjs src/data/fcs/fabric-washing src/data/fcs/factory-mobile-warehouse.ts src/data/fcs/production-demand-early-process-work-orders.ts src/pages/process-factory/dyeing/washing/ src/pages/process-factory/printing/ src/pages/process-work-orders/order-list-columns.ts src/components/actual-washing-route.ts src/pages/fcs-production-tech-pack-snapshot.ts src/pages/tech-pack/process-domain.ts src/router/routes-pcs.ts src/router/routes-fcs.ts src/pages/print/printing-sheet-preview.ts src/pages/print/templates/printing-sheet-template.ts src/pages/pda-warehouse-shared.ts`：通过
- `node --import tsx --test tests/unit/production-demand-early-process-work-orders.test.ts tests/unit/early-process-persistence.test.ts tests/unit/early-process-management-migration.test.ts`：通过
- `node --import tsx --test tests/unit/fabric-washing-views.test.ts`：通过
- `node --import tsx --test tests/unit/washing-factory-warehouse-overview.test.ts`：通过
- `WASH_BASE_URL=http://127.0.0.1:43157 node scripts/check-post-print-fabric-washing.mjs`：通过
- `WASH_UI_SECTION=main WASH_UI_MODE=formal WASH_UI_RUNS=5 WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-washing-gtg-ui.mjs`：通过
- `WASH_DIRECT_SECTION=warehouse WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-washing-gtg-direct-consumers.mjs`：通过
- `WASH_ENTRY_ONLY=cold WASH_ENTRY_RUNS=5 WASH_BASE_URL=http://127.0.0.1:43159 node scripts/check-printing-washing-entry.mjs`：通过

治理输入完整路径清单见 governance-preflight-fixed.log（worktree，90 个路径，无排除），列表静态规则和完整产品记录均通过。首轮仅因记录头缺少根 AGENTS.md 链接失败，已按当前模板补齐并保存失败原日志，未修改门禁或业务代码。

以上 npm run build 的初始 1003 单测/构建、后续定向契约与最终运行资产构建分别保留原版本身份；最终技术收据再绑定冻结文件并执行其自动检查。历史失败和定向通过范围见验收索引，不以此表覆盖旧失败。

### 例外

- 无。助剂/配比为明确线下业务，不是系统缺项；实体工厂操作和实体打印机出纸没有原型验收声明。
