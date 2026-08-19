# KOL-GOTO 特殊流程需求追踪与交付矩阵

> 当前结论：85 条原子需求全部达到 `已验证`。本矩阵只覆盖 KOL-GOTO 特殊流程；其他工厂保留原逻辑。固定总价 `1,500,000 IDR/整单` 是当前原型验收价格，不代表真实合同已签署。

## 1. 版本与范围

- 审查日期：2026-08-19
- 开工基线 HEAD：`94f287136e4cbfc045230216fea27c7ba648e9fc`；最终交付版本以本次 `main` 推送回执为准。
- 验证对象：当前工作树中 KOL-GOTO 相关实现与删除项；未把工作区其他既有改动吸收为本任务成果。
- 状态口径：严格使用 `待实施`、`实施中`、`已实现待验证`、`已验证`、`已阻塞`、`不适用`；本次 85 条均为 `已验证`。

## 2. 证据目录

| 证据 | 内容 | 当前结果 / 位置 |
| --- | --- | --- |
| A01 | `npm run check:kol-goto-special-flow`，11 组：范围、自动拆解、回滚、普通派工隔离、角色待办、仓储领料、交出完成、结算、非 KOL、管理端、删除门禁 | 最新代码重复两次通过；11/11 |
| A02 | 印染加工单与统一加工单 | `check:production-process-work-order-generation`、`check:process-work-order-unification` 通过 |
| A03 | 接单范围 | `check:pda-task-receive-scope` 通过，KOL 待接单/报价/已报价/中标均为 0 |
| A04 | 普通分配与自动派单 | `check:fcs-unified-assignment-foundation`、`check:fcs-auto-dispatch` 通过 |
| A05 | 仓储/交接 | `check:factory-handover-warehouse-linkage`、`check:factory-internal-warehouse-model`、`check:pickup-handout-order-and-warehouse-foundation` 等通过 |
| A06 | 固定总价与结算 | `check:settlement-linked-mock-factory`、`check:pre-settlement-ledger` 及结算专项通过 |
| A07 | 编译构建 | `npm run build` 通过 |
| A08 | 删除残留与 diff | 活动代码禁词扫描 0；两个旧文件不存在；`git diff --check` 通过 |
| A09 | 原型治理 | `npm run check:prototype-design-governance`；任务文件暂存后及隔离发布工作树各复验一次 |
| A10 | 任务收据 | 在仅含本任务提交的隔离发布工作树运行 `workflow:verify`；状态为 `verified`、`blockers=[]`，未吸收原工作树无关差异 |
| C01 | CodeGraph | 最终发布工作树完成同步；1,514 files / 46,720 nodes / 164,488 edges，无 pending sync |
| P01 | 管理端需求转单、生产单列表/详情及印染加工单 | 实测 `DEM-202603-0092` 生成 `PO-202603-0103`；自动生成 `PH-20260819-000001` 与 `DY-20260819-000001` |
| P02 | KOL 只读接单 | `.playwright-cli/page-2026-08-18T22-35-25-711Z.yml` |
| P03 | KOL 执行、领料、交出、完成 | `TASK-KOL-202603-0103`：两次领料、两次交出 `700 + 1,400 = 2,100 件`、完成二次确认；`page-2026-08-19T02-25-03-149Z.yml` 及相邻快照 |
| P04 | KOL 交接仅待交出/已完成 | `output/playwright/kol-goto-completed-handover-390x844.png`，同一交出单两条记录累计 `2,100 件` |
| P05 | 单待加工仓、默认位置、成对入出库 | `TASK-KOL-202603-0103` 两次领料共 6 条入库 + 6 条出库，唯一默认位置；当前浏览器快照与记录页 |
| P06 | 管理员固定总价结算、一线无权限 | `output/playwright/kol-goto-settlement-390x844.png`；两张任务两笔独立流水，未结算参考金额 `3,000,000 IDR` |
| P07 | 普通工厂接单/竞价/执行回归 | `ID-F001_operator` 实测；`output/playwright/ordinary-factory-receive-390x844.png` |
| P08 | KOL 通知与即将逾期角色白名单 | `.playwright-cli/page-2026-08-18T23-03-47-977Z.png` 及 `23-04-*` yml |
| P09 | KOL 工厂档案固定能力与三方/小微属性 | `.playwright-cli/page-2026-08-18T23-06-00-927Z.png` |
| P10 | 款式/物料图、失败态、大图、Esc、小屏 | P02～P05 的 390×844 页面操作证据 |
| P11 | 管理端 KOL 整单任务只读清单与详情 | `output/playwright/kol-goto-management-task-readonly-1366x768.png`；`PO-202603-081` 仅详情和无需分配，无去分配/竞价 |

## 3. 原子需求矩阵

| 编号 | 来源章节 | 原子需求 | 工作包 | 实际实现文件 / 符号 | 自动化验证 | 页面 / PDA 验证 | 状态 | 证据位置 | 产品确认人 / 版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCOPE-001 | 2.1/2.2 | 特殊售卖类型只允许 `KOL样衣`、`KOL样品小单` | WP-01/03 | `src/data/fcs/production-demands.ts::KOL_GOTO_SALE_TYPES/isKolGotoSaleType` | A01-G1/G4/G9；A04 | 不适用：精确领域枚举；P01 为结果证据 | 已验证 | A01-G1/G4/G9；A04；P01/P02/P07/P09（按条目适用） | 用户确认范围 / 2026-08-19；本次交付版本 |
| SCOPE-002 | 2.2 | 特殊工厂只允许 `KOL-GOTO-001` | WP-01 | `src/data/fcs/kol-goto-special-flow.ts::normalizeKolGotoFactoryId/isKolGotoFactory` | A01-G1/G4/G9；A04 | P02/P05/P06/P09 | 已验证 | A01-G1/G4/G9；A04；P01/P02/P07/P09（按条目适用） | 用户确认范围 / 2026-08-19；本次交付版本 |
| SCOPE-003 | 2.2 | 运行时特殊动作同时校验整单结构、承接工厂、所属订单及全部来源售卖类型 | WP-01/04/05/06/07 | `src/data/fcs/kol-goto-special-flow.ts::isKolGotoProductionOrder/isKolGotoWholeOrderTask/assertKolGotoWholeOrderTask` | A01-G1/G4/G9；A04 | P01～P06 | 已验证 | A01-G1/G4/G9；A04；P01/P02/P07/P09（按条目适用） | 用户确认范围 / 2026-08-19；本次交付版本 |
| SCOPE-004 | 2.3 | 非 KOL 工厂保持现有逻辑 | WP-04/09 | `src/pages/pda-*.ts` 的 `isKolGotoFactory/isKolGotoWholeOrderTask` 独立分支；普通分支未改流程 | A01-G9；A03/A04；P07 | P01/P02/P07/P09（按条目适用） | 已验证 | A01-G9；A03/A04；P07 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SCOPE-005 | 2.3 | 印花、染色加工单保持现有独立逻辑 | WP-03 | `src/data/fcs/production-process-work-order-service.ts::build/prepare/commitProductionProcessWorkOrders` | A01-G2；A02 | P01/P02/P07/P09（按条目适用） | 已验证 | A01-G2；A02 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SCOPE-006 | 1/3.5 | KOL-GOTO 不得成为任何普通任务、固定合并任务的候选工厂 | WP-04 | `src/data/fcs/factory-master-store.ts`、`src/data/fcs/runtime-process-tasks.ts`、`src/pages/unified-dispatch-workbench.ts` 的候选/写入门禁 | A01-G1/G4；A04 | P01/P02/P07/P09（按条目适用） | 已验证 | A01-G1/G4；A04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-001 | 3.3/7.1 | 物理删除规则数据文件 | WP-02 | 物理删除 `src/data/fcs/production-task-generation-rules.ts` | A01-G11；A08 | 不适用：物理文件删除 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-002 | 3.3/7.1 | 物理删除规则页面文件 | WP-02 | 物理删除 `src/pages/production/task-generation-rules.ts` | A01-G11；A08 | 旧页面/URL 不存在 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-003 | 7.2 | 删除规则菜单和四类路由 | WP-02 | `src/data/app-shell-config.ts` 与三处 router 文件删除菜单、静态路由、动态路由和 renderer | A01-G11；A08 | 菜单无入口、旧 URL 无路由 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-004 | 7.3 | 删除规则类型、匹配、预览和运行时记录 | WP-01/02 | `src/data/fcs/process-tasks.ts`、`src/pages/production/context.ts` 删除规则匹配、预览和运行时记录 | A01-G11；A08 | 不适用：活动代码结构删除 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-005 | 4.3/7.3 | 删除规则追溯和预览字段 | WP-02 | `src/data/fcs/production-orders.ts::TaskBreakdownSummary` 与任务 adapter 删除规则追溯字段 | A01-G11；A08 | P01 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-006 | 7.4 | 删除通用整单承接配置和工厂档案表单 | WP-01/02 | `src/data/fcs/factory-types.ts`、`src/data/fcs/factory-master-store.ts`、`src/pages/factory-profile.ts` 删除通用整单配置 | A01-G11；A08 | P09 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-007 | 7.5 | 删除五步 PDA 模板和旧文案 | WP-01/05/08 | `src/data/fcs/pda-task-mock-factory.ts`、`src/data/fcs/process-tasks.ts` 删除 KOL 五步模板和旧动作 | A01-G11；A08 | P02/P03/P04 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-008 | 7.6 | 删除 `check:fcs-task-generation-rules` 别名 | WP-02 | `package.json` 删除 `check:fcs-task-generation-rules` | A01-G11；A08 | 不适用：包脚本删除 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-009 | 7.7 | 活动代码中第 7.7 节列出的规则/五步/配置概念扫描均为 0 | WP-09 | `scripts/check-kol-goto-special-flow.ts` 的活动代码零残留扫描 | A01-G11；A08 | 不适用：零残留扫描 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| DELETE-010 | 3.4/4.3/7.3 | 中性 `WHOLE_ORDER_TASK`、任务类型及真实拆解计数必须保留且不得夹带规则语义 | WP-01/02 | `src/data/fcs/process-tasks.ts::ProcessTask.taskUnitType` 保留中性 `WHOLE_ORDER_TASK`；真实拆解摘要保留 | A01-G11；A08 | P01/P03 | 已验证 | A01-G11；A08；P01；旧 URL 无路由；纯代码条目不适用 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-001 | 5.1 | KOL 需求转单时自动拆解 | WP-03 | `src/pages/production/demand-domain.ts::applyCreatedProductionOrderGroups` | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-002 | 5.1 | KOL 生产单主工厂和货权固定 KOL-GOTO | WP-03 | `src/data/fcs/production-orders.ts::buildProductionOrderFromResolvedUpstream/buildProductionOrderFromDemands` | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-003 | 5.1 | KOL 生产单初始分配已完成且无竞价 | WP-03 | `src/data/fcs/production-orders.ts` 的 KOL 分配、竞价、接收摘要 | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-004 | 5.1 | 每张 KOL 生产单恰好一张整单任务 | WP-03 | `src/data/fcs/process-tasks.ts::buildKolGotoWholeOrderTask/upsertKolGotoWholeOrderTask` | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-005 | 5.1 | KOL 整单任务自动分配并自动接收 | WP-03 | `src/data/fcs/process-tasks.ts::buildKolGotoWholeOrderTask` 的 DIRECT/ASSIGNED/ACCEPTED 快照 | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-006 | 5.1 | KOL 任务创建后仍为未开工 | WP-03 | `src/data/fcs/process-tasks.ts::buildKolGotoWholeOrderTask` 的 `NOT_STARTED` | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-007 | 5.2 | PRINT/DYE 从整单责任范围排除 | WP-03 | `src/data/fcs/process-tasks.ts::buildKolGotoWholeOrderTask` 排除 `PRINT/DYE` 的 coveredProcesses/detailRows | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-008 | 5.1 | 混合 KOL/非 KOL 合并组阻断 | WP-03 | `src/data/fcs/production-orders.ts::buildProductionOrderFromDemands` 混合组校验 | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-009 | 5.1/8.5 | 转单失败不留下订单、需求、任务或印染加工单半成品事实 | WP-03 | `src/pages/production/demand-domain.ts::applyCreatedProductionOrderGroups` 与加工单 mutation snapshot/restore | A01-G3 | P01 | 已验证 | A01-G3 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-010 | 5.1 | 普通生产单继续人工直接产物拆解 | WP-02/03 | `src/pages/production/context.ts::buildProcessTasksForProductionOrder` 普通分支 | A01-G9；P07 | P01 | 已验证 | A01-G9；P07 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-011 | 5.1 | 售卖类型判断逐条读取来源快照；仅含两种 KOL 类型的合并组仍命中特殊流程 | WP-03 | `src/data/fcs/production-orders.ts::buildProductionOrderFromDemands` 对全部来源快照逐条判断 | A01-G2/G3/G9；A02 | P01 | 已验证 | A01-G2/G3/G9；A02；P01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| ORDER-012 | 9.3/12.2/13.1 | 管理端任务清单可查询 KOL 整单任务且仅供查看，不提供去分配或竞价入口 | WP-03/04 | `src/pages/task-breakdown.ts::listTaskFacts/getTaskFactById` 及 KOL 行、详情只读分支 | A01-G10 | P11 | 已验证 | A01-G10；P11 | 用户确认范围 / 2026-08-19；本次交付版本 |
| RECEIVE-001 | 5.4 | KOL 接单只展示自动接收任务 | WP-04 | `src/pages/pda-task-receive.ts::renderKolGotoReceiveReadOnlyPage` | A01-G4/G5；A03/A04 | P02/P08 | 已验证 | A01-G4/G5；A03/A04；P02/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| RECEIVE-002 | 5.4 | KOL 无待接单/报价/已报价/中标页签 | WP-04 | `src/pages/pda-task-receive.ts::renderPdaTaskReceivePage` 的 KOL 早返回分支 | A01-G4/G5；A03/A04 | P02/P08 | 已验证 | A01-G4/G5；A03/A04；P02/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| RECEIVE-003 | 5.4 | KOL 无接单、拒单、报价动作，直接调用处理器也失败关闭 | WP-04 | `src/pages/pda-task-receive*.ts` UI 处理器门禁 + `src/data/fcs/runtime-process-tasks.ts` 写入门禁 | A01-G4/G5；A03/A04 | P02/P08 | 已验证 | A01-G4/G5；A03/A04；P02/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| RECEIVE-004 | 5.4 | KOL 无接单/竞价/待接收待办 | WP-04 | `src/data/fcs/factory-mobile-todos.ts::getFactoryMobileTodos` | A01-G5；P08 | P08 | 已验证 | A01-G5；P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-001 | 5.5 | KOL 执行只显示三个指定入口 | WP-05 | `src/pages/pda-kol-goto-exec.ts::renderKolGotoPdaExecPage/renderKolGotoActionBar` | A01-G5/G6/G7/G11；A03 | P03/P08 | 已验证 | A01-G5/G6/G7/G11；A03；P03/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-002 | 5.5 | KOL 状态只显示未开工/加工中/已完成 | WP-05 | `src/pages/pda-exec.ts` 与 `src/pages/pda-kol-goto-exec.ts` 的 KOL 状态映射 | A01-G5/G6/G7/G11；A03 | P03/P08 | 已验证 | A01-G5/G6/G7/G11；A03；P03/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-003 | 5.5/5.6 | 首次成功领料自动开工 | WP-05/06 | `src/data/fcs/kol-goto-pda-domain.ts::submitKolGotoPickup` | A01-G5/G6/G7/G11；A03 | P03/P08 | 已验证 | A01-G5/G6/G7/G11；A03；P03/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-004 | 5.5 | KOL 无手工开工、进度、关键节点和暂停 | WP-05 | `src/pages/pda-exec-detail.ts::handlePdaExecDetailEvent` 对通用开工/节点/暂停/完工失败关闭 | A01-G11；源处理器失败关闭审查 | P03/P08 | 已验证 | A01-G11；源处理器失败关闭审查 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-005 | 5.7 | 不存在加工填报事实 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::submitKolGotoHandout/getKolGotoHandoutQty`；无加工填报实体 | A01-G5/G6/G7/G11；A03 | P03/P08 | 已验证 | A01-G5/G6/G7/G11；A03；P03/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-006 | 5.9 | 完成后禁止新增领料和交出 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts` 领料/交出 DONE 门禁 | A01-G5/G6/G7/G11；A03 | P03/P08 | 已验证 | A01-G5/G6/G7/G11；A03；P03/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-007 | 5.5 | 未开工仅领料可用，加工中三个动作按门禁可用，已完成全部写动作禁用 | WP-05 | `src/pages/pda-kol-goto-exec.ts::resolveKolGotoActionState` | A01-G5/G6/G7/G11；A03 | P03/P08 | 已验证 | A01-G5/G6/G7/G11；A03；P03/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-008 | 5.5 | KOL 待办不出现普通领料、待接收、上传进度或仓库待确认 | WP-05 | `src/data/fcs/factory-mobile-todos.ts` 与 `src/pages/pda-notify*.ts` KOL 白名单 | A01-G5/G11；P08 | P08 | 已验证 | A01-G5/G11；P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| EXEC-009 | 3.6/6 WP-04 | KOL operator 只保留领料、交出、完成；admin 只额外增加结算权限 | WP-04 | `src/data/fcs/store-domain-pda.ts::kolGotoOperatorPermissionKeys/kolGotoAdminPermissionKeys` | A01-G5；P06/P08 | P06/P08 | 已验证 | A01-G5；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-001 | 5.6 | 领料只读冻结 BOM | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::listKolGotoPickupLines` 从 `ProductionOrder.techPackSnapshot` 读取 | A01-G2/G6/G7；A05 | P03/P10 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-002 | 5.6 | 只展示面料和辅料 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::listKolGotoPickupLines` 类型过滤 | A01-G2/G6/G7；A05 | P03/P10 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-003 | 5.6 | BOM 行计划量公式正确 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts` 的订单量×单耗×(1+损耗率)计算 | A01-G2/G6/G7；A05 | P03/P10 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-004 | 5.6 | 每行分别填写本次数量并保留单位 | WP-05 | `src/pages/pda-kol-goto-exec.ts` 逐 BOM 行 input + `submitKolGotoPickup` quantities | A01-G2/G6/G7；A05 | P03/P10 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-005 | 5.6 | 加工领料可多次且累计/剩余准确 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::listKolGotoPickupBatches/listKolGotoPickupLines` | A01-G2/G6/G7；A05 | P03/P10 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-006 | 5.6 | 0 行、超量、非法数值阻断 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::submitKolGotoPickup` 数值/零量/超量校验 | A01-G2/G6/G7；A05 | P03/P10 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-007 | 5.6 | 重复 submission 幂等 | WP-05/06 | `src/data/fcs/kol-goto-pda-domain.ts::submitKolGotoPickup` clientSubmissionId 幂等 | A01-G2/G6/G7；A05 | 不适用：幂等领域契约 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-008 | 5.6/10.3 | 每个款式和物料有真实图、失败态和大图 | WP-08 | `src/data/fcs/kol-goto-tech-pack-fixtures.ts`、`src/pages/pda-kol-goto-exec.ts`、warehouse 图片组件 | A01-G2/G6；P03/P05/P10 | P03/P10 | 已验证 | A01-G2/G6；P03/P05/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| MATERIAL-009 | 5.3/5.6 | 加工领料属于执行，不生成通用接收单头/记录或“待接收”状态 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts` 只建 pickup batch，不建通用接收头/待接收状态 | A01-G2/G6/G7；A05 | P03/P10 | 已验证 | A01-G2/G6/G7；A05；P03/P10 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-001 | 5.7 | 发起交出支持多次 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::submitKolGotoHandout` | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-002 | 5.7 | 每次交出数量大于 0 且不超剩余 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::submitKolGotoHandout` 数值与剩余量门禁 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-003 | 5.7 | 交出累计同时作为加工累计 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::getKolGotoHandoutQty` 作为加工量和交出量唯一事实 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-004 | 5.7 | 作废记录不计累计且保留历史 | WP-05 | `src/data/fcs/pda-handover-events.ts` KOL 投影过滤 VOIDED，历史记录保留 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-005 | 5.7/5.9 | 下游/仓管确认不阻断 KOL 完成 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::completeKolGotoWholeOrderTask` 不读取仓管确认 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-006 | 5.9 | 累计交出等于计划量才可完成 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::completeKolGotoWholeOrderTask` 精确相等门禁 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-007 | 5.7 | KOL 交接只保留待交出/已完成，无待接收和加工领料页签 | WP-05 | `src/pages/pda-handover.ts` KOL 仅待交出/已完成 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-008 | 5.7 | 首次交出按任务幂等创建唯一活动单头，后续只追加记录 | WP-05 | `src/data/fcs/kol-goto-pda-domain.ts::ensureKolGotoHandoutHead` 唯一活动单头 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| HAND-009 | 5.7/7.5 | 删除 KOL 的“辅料待领/工艺样包待领”等硬编码接收样例 | WP-05/08 | `src/data/fcs/pda-handover-events.ts` 删除 KOL 旧硬编码接收种子 | A01-G7；A05 | P04 | 已验证 | A01-G7；A05；P04 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-001 | 5.8 | KOL 只有一个待加工仓 | WP-06 | `src/data/fcs/factory-internal-warehouse-locations.ts` KOL `WAIT_PROCESS` 唯一仓 | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-002 | 5.8 | KOL 不创建待交出仓 | WP-06 | `src/data/fcs/factory-internal-warehouse*.ts` 不创建 KOL `WAIT_HANDOVER` | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-003 | 4.4/5.8 | KOL 使用唯一默认库区/库位 | WP-06 | `src/data/fcs/factory-internal-warehouse-locations.ts` 唯一区/架/位 | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-004 | 5.6 | 每次领料自动写同数量入库和出库 | WP-06 | `src/data/fcs/kol-goto-pda-domain.ts::submitKolGotoPickup` 每行 paired inbound/outbound | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-005 | 5.6 | 成对流水后库存状态已领用、净量 0 | WP-06 | `src/data/fcs/factory-internal-warehouse.ts` KOL stock projection | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-006 | 5.8 | KOL 仓管无人工入出库、位置调整、盘点入口 | WP-06 | `src/pages/pda-warehouse*.ts` KOL 早返回/只读事件处理 | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-007 | 5.8 | KOL 例外可见仓管，其他三方车缝仍隐藏 | WP-06 | `src/pages/pda-shell.ts` KOL 仓管导航例外 | A01-G6；P05/P07 | P05 | 已验证 | A01-G6；P05/P07 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-008 | 8.5 | 领料、入库、出库、库存、开工原子回滚 | WP-06 | `src/data/fcs/kol-goto-pda-domain.ts` warehouse/task/pickup transaction snapshot/restore | A01-G6；A05 | 失败提示路径；主要证据为故障注入 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-009 | 3.7/5.8 | KOL 例外覆盖仓位初始化、内部仓种子/upsert 和移动仓统计，不能被车缝过滤归零 | WP-06 | `src/data/fcs/factory-internal-warehouse-locations.ts`、`factory-internal-warehouse.ts`、移动仓统计的 KOL 例外 | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| WH-010 | 4.4/6 WP-06 | KOL 入出库来源显示“加工领料”、接收方显示“加工任务”，不沿用“接收记录/待交出”语义 | WP-06 | `src/pages/pda-warehouse-inbound-records.ts`、`outbound-records.ts` KOL 标签映射 | A01-G6；A05 | P05 | 已验证 | A01-G6；A05；P05 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-001 | 5.10 | KOL 结算保留 | WP-07 | `src/pages/pda-settlement.ts` + KOL 工厂 `allowSettle:true` | A01-G7/G8；A06 | P06/P08 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-002 | 5.10 | KOL 计价模式按订单 | WP-07 | `src/data/fcs/factory-mock-data.ts` 与结算 profile 的按订单计价 | A01-G7/G8；A06 | P06/P08 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-003 | 4.2/5.10 | 任务创建冻结整单固定总价 | WP-03/07 | `src/data/fcs/production-task-breakdown.ts::buildKolGotoWholeOrderTask` 冻结 `1,500,000 IDR/整单` 原型 Mock | A01-G2/G7/G8；P03/P06（原型 Mock） | P06/P08 | 已验证 | A01-G2/G7/G8；P03/P06（原型 Mock） | 用户确认固定价机制 / 真实金额待补；本次交付版本 |
| SET-004 | 5.10 | 多次交出不改变价格 | WP-07 | `src/data/fcs/kol-goto-fixed-total-ledger.ts::upsertKolGotoFixedTotalLedger` | A01-G7/G8；A06 | P06/P08 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-005 | 4.5/5.10 | 每任务完成只生成一条固定总价收入流水 | WP-07 | `src/data/fcs/kol-goto-fixed-total-ledger.ts` 与 `pre-settlement-ledger-repository.ts` 唯一完成流水 | A01-G7/G8；A06 | P06/P08 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-006 | 5.10 | KOL code/id 统一为同一结算主体 | WP-07 | `src/data/fcs/kol-goto-special-flow.ts::normalizeKolGotoFactoryId` 及两处结算 repository | A01-G7/G8；A06 | P06 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-007 | 5.10 | KOL 管理/财务可确认对账、提异议、改资料，一线 operator 无结算动作 | WP-07 | `src/data/fcs/store-domain-pda.ts` 角色权限 + `src/pages/pda-settlement.ts::hasPdaSettlementPermission` | A01-G5；A06；P06/P08 | P06/P08 | 已验证 | A01-G5；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-008 | 3.8/5.10 | KOL 结算上下文解析失败时失败关闭，绝不回退首个工厂 | WP-07 | `src/pages/pda-settlement.ts::getCurrentFactoryContext` 无首工厂 fallback | A01-G7/G8；A06 | P06 空态/无权态 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-009 | 3.8/5.10 | KOL 结算 Mock 为一单一整单任务一固定价流水，无竞价/五任务/逐批收入 | WP-07/08 | `src/data/fcs/settlement-linked-mock-factory.ts` 一单/一任务/一固定价流水 | A01-G7/G8；A06 | P06/P08 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| SET-010 | 8.5 | 任务完成与固定价流水写入原子且幂等 | WP-07 | `src/data/fcs/kol-goto-pda-domain.ts::completeKolGotoWholeOrderTask` + ledger snapshot/restore | A01-G7/G8；A06 | 完成反馈；主要证据为故障注入 | 已验证 | A01-G7/G8；A06；P06/P08 | 用户确认范围 / 2026-08-19；本次交付版本 |
| TEST-001 | 10.1 | 新增 KOL 全链专项检查 | WP-09 | `scripts/check-kol-goto-special-flow.ts` 11 组契约 | A01（最新两次均 11/11） | 不适用：专项自动化 | 已验证 | A01（最新两次均 11/11） | 用户确认范围 / 2026-08-19；本次交付版本 |
| TEST-002 | 10.2 | 印染加工单现有检查通过 | WP-09 | `scripts/check-production-process-work-order-generation.ts`、`check-process-work-order-unification.ts` | A02 | 印染命名页面与 A02 | 已验证 | A02 | 用户确认范围 / 2026-08-19；本次交付版本 |
| TEST-003 | 10.2 | 非 KOL 分配、竞价、PDA、双仓回归通过 | WP-09 | 普通工厂专项脚本 + P07 页面回归 | A03/A04/A05/A06；P07 | P07 | 已验证 | A03/A04/A05/A06；P07 | 用户确认范围 / 2026-08-19；本次交付版本 |
| TEST-004 | 10.3 | 所有命名页面在当前分支和实际小屏/桌面验收 | WP-09 | P01～P11 当前工作树浏览器证据 | P01～P11 | P01～P11 | 已验证 | P01～P11 | 用户确认范围 / 2026-08-19；本次交付版本 |
| TEST-005 | 10.4 | 构建、治理、CodeGraph 状态闭环 | WP-09 | A07/A09/A10/C01 | A07/A09/A10/C01 | 不适用：项目治理 | 已验证 | A07/A09/A10/C01 | 用户确认范围 / 2026-08-19；本次交付版本 |
| TEST-006 | 10.4 | 正向、反向追踪无遗漏和越界 | WP-09 | `docs/product-design/KOL-GOTO特殊流程双轮逐行审查与验收清单.md` | 正向 85/85；反向任务差异全部绑定；A08 | P01～P11 反查 | 已验证 | 正向 85/85；反向任务差异全部绑定；A08 | 用户确认范围 / 2026-08-19；本次交付版本 |

## 4. 汇总结论

- 正向追踪：85/85 条均从设计章节映射到实现、自动化和适用页面证据。
- 反向追踪：任务相关新增、修改、删除、路由、菜单、Mock 和检查脚本均能回到上述需求编号；未发现 KOL 特殊逻辑扩散到其他工厂。
- 删除门禁：生产单任务生成规则的数据、页面、菜单、renderer、静态/动态路由、配置字段、五步模板和包脚本别名均已从活动代码删除；中性 `WHOLE_ORDER_TASK` 仅作为 KOL 任务结构边界保留。
- 范围说明：真实合同固定总价未提供；原型以 `1,500,000 IDR/整单` 验证固定总价机制，后续替换金额需重跑 A01/A06/P06。
