# 后道生产任务、后道加工单与关联记录原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-02 |
| 需求编号 | PFTASK-001～PFTASK-017 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS / PFOS / PDA / 打印 |
| 核心页面 | 后道生产任务、质检单、后道加工单、两类后道仓库、复检单、后道出货单、差异与操作日志 |
| 角色 | 管理人员、质检员、后道操作员、复检员、仓库接收人 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：菜单、页面标题、关联字段、回货／质检弹窗、质检单系统编号、PDA 扫码提示、两仓链路身份和打印壳均发生用户可见变化；两仓主体继续沿用线上标准库存台账骨架。

审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI、标准列表和真实图片专项门禁。
- `AGENTS.md` 第 7 节：分层验证和证据新鲜度。

- 菜单及相关页面把原“后道任务／后道单”明确拆为“后道生产任务／后道加工单”。
- 后道生产任务列表新增“回货记录（N）”和“质检单（N）”，使用弹窗展示当前生产任务的多条关联记录。
- Web 质检明确输入完整质检单号，不表达为浏览器摄像头扫码。
- PDA 明确扫描完整后道加工单号；聚合详情显示“后道生产任务”。
- 后道加工单流转卡使用独立打印预览，不再显示管理端导航壳。
- 后道待加工仓与后道待交出仓保持现有布局，不因“一单到底”重做页面。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 对象与关系 | 通过 | 生产单级总任务和每次质检后的加工执行单已分开命名；回货与质检单按生产单聚合。 |
| 页面模式与信息密度 | 通过 | 管理端仍为现有标准列表；关联内容进入局部弹窗，没有把两仓改成新工作台；378 页列表治理通过。 |
| 文案、状态、数量与单位 | 通过 | 回货弹窗展示登记／确认／差异“件”；质检弹窗展示数量、人员、状态和时间。 |
| 输入、扫码与对象识别 | 通过 | Web 输入完整质检单号；PDA 扫描完整后道加工单号；两端不混用交互表述。 |
| 防错与恢复 | 通过 | 回货最终确认自动生成“待送检”质检单；送检前不可领取；送检沿用同号；单号不可人工修改；最大序号从编号账和已有质检单共同恢复；重复请求幂等。 |
| 交接与追溯 | 通过 | 两轮各 15/15 条链从生产任务 → 回货 → 质检 → 可选加工 → 复检 → 出货连续走通并落地链路证据。 |
| 图片门禁 | 通过 | 本轮未新增对象图片；继续复用已验证的 SKU 实图、加载／失败态和大图能力。 |
| PDA 小屏 | 有条件通过 | 360×800、400×806 的浏览器模拟已覆盖后道精确扫描及详情；实体 PDA 和扫码枪未运行。 |
| 打印 | 通过 | 专用与旧兼容路由已通过 Playwright；专用打印路由已从系统壳分离。 |

## 4. 主要问题与处理

| 问题 | 影响 | 处理 | 结果 |
| --- | --- | --- | --- |
| “后道任务”同时被理解为总任务和加工执行对象 | 管理、质检、后道人员无法判断粒度 | 明确两层对象并跨端统一命名 | 已处理 |
| 后道生产任务列表不能查看多次回货和多张质检单 | 管理人员必须跨页面自行拼关系 | 新增两个带数量的关联弹窗 | 已处理 |
| 直接以回货次数当质检单序号 | 未确认的中间批次会造成错号／跳号 | 在最终确认时按同生产单已有质检单最大值计算 | 已处理 |
| 编号本地账丢失后从 1 重启 | 可能撞号 | 同时读取已存在质检单号计算最大值 | 已处理 |
| 弹窗打开后被全页重绘立即移除 | 用户看不到关联记录 | 标记局部事件跳过页面级重绘 | 已处理并通过 UI 回归 |
| 后道专用打印页仍展示 Web 系统壳 | 打印预览与打印结果不专业 | 将专用打印路由纳入独立打印壳 | 已处理并通过 UI 回归 |

## 5. 当前证据与限制

- Web/PDA/打印定向 Playwright：10/10 通过。
- 命名页面：11/11 通过，在`output/verification/post-finishing-full-flow/2026-09-03-auto-qc-named-ui-final/`落地 13 张截图；后道生产任务第一条数据的回货弹窗为 5 行、质检单弹窗为 4 行，其中 1 张待送检，另 1 次回货尚未最终确认。
- 领域规则：两遍独立执行 3 个生产单 × 每单 5 个 SKU × 每单 5 次回货，均形成 15 张质检单、12 张后道加工单、15 张复检单、15 张出货单、352 条操作日志，质检单号各生产单均为 `-1` 至 `-5`。
- 连续跨端 UI：两遍均 15/15 链、75/75 SKU、15 个确认自动建单阶段、49 张截图和 1 份完整 trace；每遍 348 条 UI 操作日志、5 次跨环节授权，证据目录为`2026-09-03-auto-qc-final-pass-1/`与`2026-09-03-auto-qc-final-pass-2/`。
- 限制：本记录只证明当前本地原型和 Mock；不代表线上部署、真实账号权限、实体 PDA／扫码枪、打印机或生产数据验收。

## 6. 最终结论

结论：有条件通过

说明：

- 本地原型范围内，后道生产任务／后道加工单命名、关联弹窗、严格质检单编号、两仓链路、Web、PDA 浏览器模拟和打印预览均已验证。
- 条件仅指线上部署、真实账号、实体 PDA／扫码枪、实体打印机和生产数据未在本轮执行，不能由本地 Mock 自动化替代。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/shell.ts`
- `src/components/ui/list-page.ts`
- `src/data/app-shell-config.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/milestone-configs.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/post-finishing-document-numbering.ts`
- `src/data/fcs/post-finishing-domain.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/print-template-registry.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-mobile-task-binding.ts`
- `src/data/fcs/process-warehouse-linkage-service.ts`
- `src/data/fcs/task-print-cards.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-post-finishing-flow.ts`
- `src/pages/pda-quality.ts`
- `src/pages/pda-warehouse-inbound-records.ts`
- `src/pages/pda-warehouse-outbound-records.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/print/templates/post-finishing-qc-print-template.ts`
- `src/pages/print/templates/post-finishing-route-card-template.ts`
- `src/pages/print/templates/task-delivery-card-template.ts`
- `src/pages/print/templates/task-route-card-template.ts`
- `src/pages/process-factory/post-finishing/audit-records.ts`
- `src/pages/process-factory/post-finishing/events.ts`
- `src/pages/process-factory/post-finishing/full-flow-print.ts`
- `src/pages/process-factory/post-finishing/outbound-orders.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/post-finishing/qc-workbench.ts`
- `src/pages/process-factory/post-finishing/recheck-orders.ts`
- `src/pages/process-factory/post-finishing/statistics.ts`
- `src/pages/process-factory/post-finishing/tasks.ts`
- `src/pages/process-factory/post-finishing/warehouse.ts`
- `src/pages/process-factory/post-finishing/work-order-detail.ts`
- `src/pages/process-factory/post-finishing/work-orders.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/progress-board/core.ts`
- `src/pages/qc-records/fact-view.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`
- `src/router/routes-pda.ts`

### 页面路由

- `/fcs/craft/post-finishing/tasks`
- `/fcs/craft/post-finishing/qc-orders`
- `/fcs/craft/post-finishing/work-orders`
- `/fcs/craft/post-finishing/wait-process-warehouse`
- `/fcs/craft/post-finishing/wait-handover-warehouse`
- `/fcs/craft/post-finishing/recheck-orders`
- `/fcs/craft/post-finishing/outbound-orders`
- `/fcs/craft/post-finishing/audit-records`
- `/fcs/pda/post-finishing/execute`
- `/fcs/print/preview?documentType=TASK_ROUTE_CARD&sourceType=POST_FINISHING_WORK_ORDER&sourceId=POST-WO-001`
- `/fcs/craft/post-finishing/print?type=POST_ORDER&id=HD-POQC202608001-05`

### 验证命令

- `node --import tsx scripts/check-post-finishing-full-flow.ts`：通过（两遍 3×5×5）
- `node --import tsx scripts/check-post-finishing-management-list-alignment.ts`：通过
- `node --import tsx scripts/check-post-finishing-full-flow-surface.ts`：通过
- `node --import tsx scripts/check-post-finishing-cross-terminal-ui.ts`：通过
- `node --import tsx scripts/check-post-finishing-cross-terminal-evidence.ts`：通过（两遍各 49 张截图、1 份 trace）
- `node --import tsx scripts/check-post-finishing-full-flow-traceability.ts`：通过（141/141）
- `npx playwright test tests/post-finishing-full-flow.spec.ts --workers=1`：通过（11/11，13 张截图）
- `npx playwright test tests/post-finishing-full-flow-cross-terminal.spec.ts --workers=1`：通过（两遍各 1/1，15 条连续业务链）
- `npm run build`：通过（2,394 个模块）
- `git diff --check`：通过
- `npm run check:list-page-governance`：通过
- `codegraph sync && codegraph status`：通过（1,577 个文件、48,517 个节点、168,977 条边，无待同步文件）
- `npm run workflow:verify -- --output output/verification/post-finishing-full-flow/2026-09-02-post-finishing-task-naming-related-records-receipt.json --task-boundary <scope>`：通过（`status=verified`，`blockers=[]`）

### 真实图片验证

- 继续使用既有 3 个生产单与 5 个 SKU 对应的稳定 Mock 款式图片；Web、PDA 和打印均保留对象同块展示、加载失败态和大图能力。
- 本轮新增的回货／质检关联弹窗展示单据关系，不新增款式或物料对象，图片门禁不扩张。

### 例外

- 真实管理账号权限、线上生产数据、实体 PDA、扫码枪、实体打印机和现场弱网未运行；后续上线验收必须单独补证据。
