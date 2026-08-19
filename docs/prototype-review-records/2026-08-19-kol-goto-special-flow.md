# KOL-GOTO 特殊流程原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-19 |
| 相关需求 / 任务 | KOL-GOTO 生产单自动拆解、最短 PDA 执行、单待加工仓与固定总价结算 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/production/demand-inbox`、`/fcs/production/orders`、生产单详情、`/fcs/process/task-breakdown`、`/fcs/factories/profile`、`/fcs/pda/task-receive`、`/fcs/pda/exec`、`/fcs/pda/handover`、`/fcs/pda/warehouse`、`/fcs/pda/warehouse/wait-process`、`/fcs/pda/warehouse/inbound-records`、`/fcs/pda/warehouse/outbound-records`、`/fcs/pda/notify`、`/fcs/pda/notify/due-soon`、`/fcs/pda/settlement` |
| 端类型 | 管理端、员工执行端、工厂管理员端 |
| 主要角色与任务 | KOL-GOTO 操作工：查看接单、加工领料、发起交出、完成；KOL-GOTO 管理员：同上并查看/处理结算；普通工厂角色保持原流程 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：KOL-GOTO 的生产需求转单、接单、执行、交接、仓管、结算页面结构和动作均发生变化；新增 KOL 整单任务、冻结 BOM 领料、自动出入库、固定总价 Mock 和专用页面文案；删除生产单任务生成规则菜单、路由、页面和相关概念。非 KOL 页面通过独立角色回归确认保留原接单、竞价、接拒单、手工开工、双仓和结算逻辑。

当前审查基线为 `AGENTS.md` 第 4、5、7 节。员工端按“动作优先、少填少选、系统判断”收口；款式和物料均读取冻结技术包对应的本地稳定图片。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | KOL operator 只有领料、交出、完成权限；admin 只额外拥有结算权限；接单只读；普通工厂角色不变 |
| 文案、状态、数量与单位 | 通过 | KOL 只显示未开工/加工中/已完成；每条 BOM 与交出数量保留单位；累计、剩余、固定总价由系统计算 |
| 扫码、真实图片与对象识别 | 通过 | 任务与交出保留二维码事实；款式和每条面辅料均有对象对应本地图、缩略图、失败态和大图入口 |
| 防错、危险确认与主管兜底 | 通过 | 零量、四舍五入为零、超量、完成后新增、伪任务、混合售卖类型、重复提交和事务失败均有阻断或幂等处理 |
| 交接、跨端事实与异常追溯 | 通过 | 发起交出即直接计入加工/交出；每次记录可追溯；作废保留但不计有效量；完成与结算流水原子回滚 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 390×844 验收；本流程不要求上传；重复提交使用 client submission id 幂等，失败不留下半成品 |
| 命名路由、交互、图片大图与打印 | 通过 | 所有命名 PDA 路由已验收；图片大图支持关闭、遮罩、Esc；本需求无打印输出 |

## 4. 问题标签

- 审查中发现的问题均已关闭；当前没有未关闭问题标签。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| KOL 仓储列表仍出现普通工厂的待交出、差异、异议、回写统计和筛选 | 字段过载、状态抽象 | KOL 操作工/仓管 | KOL 分支改成仅展示加工领料自动入库/出库记录与唯一默认库位 | 否 |
| 交出记录被共享投影重新推导为待回写 | 状态抽象、协作断裂 | KOL 操作工 | 同一交出记录直接写入系统自动计入数量/时间，单头待回写数固定为 0 | 否 |
| 作废交出仍污染单头累计 | 算不准 | KOL 操作工/管理员 | 仅 KOL 整单交接投影过滤作废记录，历史记录仍保留 | 否 |
| 结算联动 Mock 与运行时完成流水曾重复计价 | 算不准 | KOL 管理员 | 运行时完成流水存在时停用独立 KOL 兜底流水，同一任务只保留一条固定总价收入 | 否 |
| KOL 生产单主工厂快照曾显示“中央工厂”，与工厂档案冲突 | 对象身份错误 | 管理端/结算 | 快照统一为“三方工厂 / 小微缝纫”，专项契约与管理端页面同时反查 | 否 |
| KOL operator 可通过猜测结算待办 URL 进入普通待办详情查找 | 权限边界 | KOL 操作工 | KOL 通知详情只从当前工厂、当前角色可见待办集合反查；operator 集合无结算待办 | 否 |
| KOL 页面虽隐藏通用开工/节点/暂停/完工按钮，但通用详情处理器未显式拒绝伪造动作 | 隐藏写入口 | KOL 操作工 | 在四个通用写动作处理器内按完整 KOL 整单任务守卫失败关闭 | 否 |
| KOL 执行底部动作条曾覆盖 PDA 底部导航 | 小屏可操作性 | KOL 操作工 | 动作条固定在 72px 导航上方，390×844 重新验收 | 否 |
| 售卖类型、工厂身份、任务结构分别判断时存在误命中风险 | 范围污染 | 全角色 | 售卖类型事实集中到精确枚举；运行时同时校验任务结构、承接工厂、所属生产单主工厂和全部来源售卖类型 | 否 |
| KOL 整单任务正确排除普通派工运行时后，管理端任务清单也无法查看 | 信息缺失 | 生产计划／跟单 | 任务清单补充实际 KOL 整单任务的只读投影；显示自动拆解、固定分配和自动接收，仅有详情/无需分配 | 否 |

## 6. 最终结论

结论：通过。

说明：KOL-GOTO 页面已形成“管理端只读整单任务 → 只读接单 → 多次加工领料且首次自动开工 → 多次交出直接计量 → 精确数量完成 → 一次固定总价收入”的最短闭环；仓管只有待加工仓和自动出入库记录。`1,500,000 IDR/整单` 是当前原型验收价格，不代表真实合同已签署。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/factory-internal-warehouse-locations.ts`
- `src/data/fcs/factory-internal-warehouse.ts`
- `src/data/fcs/factory-master-store.ts`
- `src/data/fcs/factory-mobile-todo-routes.ts`
- `src/data/fcs/factory-mobile-todos.ts`
- `src/data/fcs/factory-mock-data.ts`
- `src/data/fcs/factory-types.ts`
- `src/data/fcs/kol-goto-fixed-total-ledger.ts`
- `src/data/fcs/kol-goto-pda-domain.ts`
- `src/data/fcs/kol-goto-special-flow.ts`
- `src/data/fcs/kol-goto-tech-pack-fixtures.ts`
- `src/data/fcs/page-adapters/task-execution-adapter.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/pre-settlement-ledger-repository.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-mobile-task-binding.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/production-demands.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/fcs/production-process-work-order-service.ts`
- `src/data/fcs/production-task-breakdown.ts`
- `src/data/fcs/production-task-generation-rules.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/fcs/settlement-change-requests.ts`
- `src/data/fcs/settlement-linked-mock-factory.ts`
- `src/data/fcs/store-domain-pda.ts`
- `src/data/fcs/store-domain-settlement-types.ts`
- `src/data/fcs/store-domain-statement-grain.ts`
- `src/data/fcs/store-domain-statement-source-adapter.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/pages/factory-profile.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-kol-goto-exec.ts`
- `src/pages/pda-notify-detail.ts`
- `src/pages/pda-notify-due-soon.ts`
- `src/pages/pda-notify.ts`
- `src/pages/pda-settlement.ts`
- `src/pages/pda-shell.ts`
- `src/pages/pda-task-receive-detail.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/pda-warehouse-inbound-records.ts`
- `src/pages/pda-warehouse-outbound-records.ts`
- `src/pages/pda-warehouse-shared.ts`
- `src/pages/pda-warehouse-stocktake.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-warehouse.ts`
- `src/pages/production/context.ts`
- `src/pages/production/demand-domain.ts`
- `src/pages/production/detail-domain.ts`
- `src/pages/production/orders-domain.ts`
- `src/pages/production/task-generation-rules.ts`
- `src/pages/statements.ts`
- `src/pages/task-breakdown.ts`
- `src/pages/unified-dispatch-workbench.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/route-renderers.ts`
- `src/router/routes-fcs.ts`

### 页面路由

- KOL operator：`/fcs/pda/task-receive`、`/fcs/pda/exec`、任务详情、领料弹层、交出弹层、`/fcs/pda/handover`、`/fcs/pda/warehouse`、待加工仓、入库记录、出库记录、`/fcs/pda/notify`、`/fcs/pda/notify/due-soon`、无权结算页。
- KOL admin：`/fcs/pda/exec`、`/fcs/pda/notify`、`/fcs/pda/notify/due-soon`、`/fcs/pda/settlement`。
- 管理端：生产需求转单、生产单列表/详情、KOL 整单任务只读清单/详情、KOL-GOTO 工厂档案固定能力。
- 普通工厂回归：`/fcs/pda/task-receive`、`/fcs/pda/exec`、`/fcs/pda/warehouse`。

### 验证命令

- `npm run check:kol-goto-special-flow`：通过；最后实质代码修改后连续执行两次，均为 11 组全部断言通过。
- `npm run check:pda-task-receive-scope`：通过。
- `npm run check:production-process-work-order-generation`：通过。
- `npm run check:process-work-order-unification`：通过。
- `npm run check:fcs-unified-assignment-foundation`、`npm run check:fcs-auto-dispatch`：通过。
- 仓储/交接 6 项专项检查：通过。
- 结算/预结算 8 项专项检查：通过。
- `npm run build`：通过。
- `npm run check:menu-routes`：通过，160 个菜单 href 全覆盖、无重复。
- `npm run check:prototype-design-governance`：通过；任务文件暂存后及隔离发布工作树各复验一次。
- `npm run workflow:verify`：通过；在仅含本任务提交的隔离发布工作树执行，收据状态 `verified`、`blockers=[]`，未吸收原工作树无关差异。
- `git diff --check`：通过。
- CodeGraph：最终发布工作树完成同步；status 为 1,514 files、46,720 nodes、164,488 edges，无 pending sync 清单。

### 真实图片验证

- 来源：生产单冻结技术包的款式图与 BOM 物料图；专项契约遍历全部 KOL 整单任务的面料/辅料行，验证 URL 为 `public/` 下实际存在的本地文件。
- 对象对应：款式图与生产单/SPU 同块展示；物料图与 BOM 编码、名称、规格、计划/已领/剩余数量同块展示。
- 页面证据：`TASK-KOL-202603-0103` 当前小屏快照，以及 `output/playwright/kol-goto-completed-handover-390x844.png`、`kol-goto-settlement-390x844.png`、`ordinary-factory-receive-390x844.png`、`kol-goto-management-task-readonly-1366x768.png`。
- 大图：缩略图可打开；遮罩、关闭按钮和 Esc 均可关闭；加载失败显示明确失败态。

### 例外

- 无打印场景，本项不适用。
- 固定总价 `1,500,000 IDR/整单` 是当前原型验收价格；若合同价格变化，必须重新冻结价格并重跑全链与结算证据。
- 原工作区包含与本任务无关的既有改动；本任务通过隔离发布工作树生成收据并推送，最终版本以 GitHub `main` 回执为准。
