# KOL-GOTO 特殊流程双轮逐行审查与验收清单

> 结论：两轮审查均已完成；85/85 条原子需求已验证，遗漏 0、越界 0、未关闭阻塞 0。本清单与《KOL-GOTO 特殊流程需求追踪与交付矩阵》共同构成逐行、逐项验收结果。

## 1. 审查基线与方法

- 日期：2026-08-19。
- 分支：`codex/process-craft-techpack-sequence`。
- Git 基线：`94f287136e4cbfc045230216fea27c7ba648e9fc`。
- 审查对象：当前工作树中 KOL-GOTO 特殊流程相关新增文件、删除文件、共享文件中的 KOL/旧规则删除 hunk、相关路由/菜单/Mock/检查脚本。
- 排除：工作区内既有的工序工艺字典、PCS 技术包等无关改动；未把这些改动算入本任务结果。
- 第一轮（正向）：按设计第 2～10 章逐条追到 85 条需求、实现位置、专项契约和页面结果。
- 第二轮（反向）：从新增、修改、删除、路由、菜单、Mock、角色、页面和测试逐项倒查需求编号，检查遗漏、越界、暗门和普通工厂污染。
- “逐行”的执行口径：新建核心文件和被删除旧模块按 1～EOF 全文阅读；共享大文件逐个阅读本任务 diff hunk、其所在完整函数/渲染分支及上下游守卫，不把无关 hunk 混入结论。

## 2. 第一轮：正向逐行审查

### 2.1 新建核心文件全文

| 文件 | 阅读范围 | 逐行检查内容 | 结果 |
| --- | --- | --- | --- |
| `src/data/fcs/kol-goto-special-flow.ts` | 1～77 | 精确售卖类型、工厂 code/id 归一化、生产单与整单任务组合守卫、失败关闭 | 通过 |
| `src/data/fcs/production-task-breakdown.ts` | 1～88 | 生产单拆解预览读取实际整单任务与印染加工单，不另建规则或重复事实 | 通过 |
| `src/data/fcs/kol-goto-fixed-total-ledger.ts` | 1～84 | 一任务一固定价流水、金额/币种/粒度、重放、故障注入和快照恢复 | 通过 |
| `src/data/fcs/kol-goto-tech-pack-fixtures.ts` | 1～197 | 冻结款式图、面料/辅料图、缺失 BOM 补齐且写回快照，不读实时 BOM | 通过 |
| `src/data/fcs/kol-goto-pda-domain.ts` | 1～649 | 领料、成对入出库、自动开工、多次交出、直接计量、完成、幂等与事务回滚 | 通过 |
| `src/pages/pda-kol-goto-exec.ts` | 1～281 | 仅三个入口、状态按钮矩阵、BOM 分区、逐行数量、图片/大图、72px 底栏避让、完成二次确认 | 通过 |
| `scripts/check-kol-goto-special-flow.ts` | 1～848 | 11 组全链正反例、故障注入、普通工厂回归、管理端只读任务清单、删除门禁 | 通过 |

新建核心实现共 2,224 行，全部完成两轮阅读；最后新增的管理端任务只读清单断言已重新纳入第 10 组。

### 2.2 旧规则模块全文删除

| 删除对象 | HEAD 原文件范围 | 删除验收 | 结果 |
| --- | --- | --- | --- |
| `src/data/fcs/production-task-generation-rules.ts` | 1～445 | 文件物理不存在；数据、匹配、预览、配置与规则记录未迁移到新抽象 | 通过 |
| `src/pages/production/task-generation-rules.ts` | 1～616 | 文件物理不存在；列表/新增/详情/编辑页面均未保留 | 通过 |
| 菜单和路由 | app shell + 两组 renderer + 静态/动态 route hunk | 菜单、四个 renderer、列表/新增/详情/编辑 URL 全删除 | 通过 |
| 类型与字段 | `ProcessTask`、`TaskBreakdownSummary`、factory types/profile hunk | 规则 id/name、预览状态、五步模板、通用整单开关均删除 | 通过 |
| 包脚本 | `package.json` scripts hunk | 旧规则检查别名删除，新增 KOL 专项检查 | 通过 |
| 中性结构保留 | `process-tasks.ts` 任务粒度 hunk | 只保留不带规则语义的 `WHOLE_ORDER_TASK`，供 KOL 整单任务表达 | 通过 |

删除旧模块共 1,061 行；不是隐藏菜单，而是数据、页面、路由、renderer、字段、模板和脚本别名的完整物理删除。

### 2.3 共享文件逐 hunk / 逐函数

| 链路 | 文件与已审函数/分支 | 审查结果 |
| --- | --- | --- |
| 售卖类型事实 | `production-demands.ts::KOL_GOTO_SALE_TYPES/isKolGotoSaleType` | 只精确接受 `KOL样衣`、`KOL样品小单`，大小写、空格和近似词均不命中 |
| 生产单构造 | `production-orders.ts::buildProductionOrderFromResolvedUpstream/buildProductionOrderFromDemands/createKolGotoFactorySnapshot` | KOL 自动固定主工厂、货权、分配与接收摘要；快照为三方/小微；混合普通售卖类型阻断 |
| 转单事务 | `demand-domain.ts::applyCreatedProductionOrderGroups` 及单单/合单 builder | 生产单、需求状态、整单任务、印染加工单同一事务；失败全部恢复 |
| 印染加工单 | `production-process-work-order-service.ts` prepare/commit/restore hunk | 0/仅染/仅印/印染四组合正确；PRINT/DYE 不进入整单责任范围 |
| 普通拆解保留 | `production/context.ts::buildProcessTasksForProductionOrder` 及 breakdown guard | 非 KOL 继续人工拆解；KOL 直接返回已生成整单任务 |
| 管理端列表/详情 | `orders-domain.ts` KOL 行；`detail-domain.ts` assignment/material/tab/overview 分支 | 不出现人工拆解、竞价、接收草稿、待领料、物料检查和普通后道模块 |
| 管理端任务清单 | `task-breakdown.ts::listTaskFacts/getTaskFactById` 及行/详情 KOL 分支 | 从实际整单任务补充只读事实；显示自动拆解、固定分配、自动接收；无去分配或竞价入口 |
| 整单任务事实 | `process-tasks.ts::buildKolGotoWholeOrderTask/upsertKolGotoWholeOrderTask` | 每张 KOL 生产单唯一整单任务；排除 PRINT/DYE；固定分配、自动接收、未开工并冻结整单价格 |
| 工厂档案 | `factory-master-store.ts` KOL normalization；`factory-profile.ts` eligibility/role/capability 分支 | 普通派单/竞价关闭，执行/结算开启；固定角色与条件不可编辑 |
| 普通任务隔离 | `runtime-process-tasks.ts` candidate/merge/bid/direct/reassign/validate/batch dispatch 入口；`unified-dispatch-workbench.ts` 候选过滤 | KOL 任务不进入普通运行时，KOL 工厂不成为普通任务候选；伪造写入失败关闭 |
| 接单 | `pda-task-receive.ts` KOL 早返回与事件门禁；`pda-task-receive-detail.ts` 只读详情与接/拒门禁 | 只查看自动接收任务；无待接单/报价/已报价/中标页签和动作 |
| 执行 | `pda-exec.ts` KOL 列表；`pda-exec-detail.ts` KOL render/event 路由与通用写动作门禁 | 仅“去加工领料 / 发起交出 / 完成”；通用开工、节点、暂停、完工伪动作均拒绝 |
| 交接 | `pda-handover-events.ts` KOL 投影；`pda-handover.ts` KOL tabs/head filter | 仅待交出/已完成；首次交出懒建唯一单头；作废不计量；无接收/领料旧样例 |
| 待办通知 | `factory-mobile-todos.ts`、`pda-notify.ts`、`pda-notify-due-soon.ts`、`pda-notify-detail.ts` | operator 仅领料/待交出，admin 另有结算；详情按当前角色可见集合反查，猜 URL 不越权 |
| 角色导航 | `store-domain-pda.ts` KOL 固定角色；`pda-shell.ts` KOL 导航例外 | operator 仅执行动作权限，admin 额外结算；仓管入口可见但只有单待加工仓 |
| 仓位初始化 | `factory-internal-warehouse-locations.ts` KOL 固定位置；`factory-internal-warehouse.ts` seed/upsert/mobile stats | 只建 WAIT_PROCESS 和唯一区/架/位；不会被普通三方车缝过滤归零 |
| 仓管页面 | `pda-warehouse.ts`、`wait-process.ts`、`wait-handover.ts`、`inbound-records.ts`、`outbound-records.ts`、`stocktake.ts` KOL 分支和事件门禁 | 只读待加工仓和自动流水；无待交出仓、人工收发、退回、移位、盘点或回写 |
| 结算流水 | `pre-settlement-ledger-repository.ts`、`settlement-change-requests.ts` 归一化；`settlement-linked-mock-factory.ts` KOL task-completion 粒度 | code/id 同主体；一单一任务一固定价流水；无回货批次逐批计价或重复收入 |
| 结算页面 | `pda-settlement.ts::hasPdaSettlementPermission/getCurrentFactoryContext/handlePdaSettlementEvent` | operator 无查看/写权限；admin 可按既有管理逻辑处理；无效工厂不回退首个工厂 |
| 删除入口 | `app-shell-config.ts`、`routes-fcs.ts`、`route-renderers-fcs.ts`、`route-renderers.ts` | 所有旧规则入口删除，其他菜单/路由保持 |
| 检查脚本 hunk | 生产、接单、仓储、交接、结算既有专项脚本的 KOL 断言 | 新特殊分支纳入相邻回归；无关测试语义未改成 KOL 口径 |

## 3. 第二轮：反向逐行审查

第二轮不再从方案出发，而是从实际差异逐个回看：每个新增导出、每个 KOL 条件分支、每个删除 hunk、每个 Mock、每个角色权限、每个可见按钮、每个事件处理器和每个专项断言，都必须能回到矩阵中的需求编号。反向审查结果如下。

| 反查项 | 重点问题 | 处理结果 | 绑定需求 |
| --- | --- | --- | --- |
| 工厂身份 | code 与 internal id 是否形成两个结算/仓储主体 | 统一归一到 `KOL-GOTO-001` | SCOPE-002、SET-006 |
| 特殊命中 | 仅看售卖类型是否会污染其他工厂 | 改为任务结构 + 承接工厂 + 生产单主工厂 + 全部来源售卖类型组合守卫 | SCOPE-003 |
| 工厂属性 | 生产单曾显示“中央工厂” | 修正为“三方工厂 / 小微缝纫”，页面与契约同时验证 | ORDER-002 |
| 自动拆解 | 是否只生成整单任务、漏印染加工单 | 四组合逐个生成对应 PRINT/DYE 加工单并始终恰好一张整单任务 | ORDER-001～007 |
| 管理端任务遗漏 | KOL 被正确排除普通派工运行时后，是否也从管理端任务清单消失 | 任务清单单独读取实际 KOL 整单任务，只读展示并继续与普通派工隔离 | ORDER-012 |
| 转单失败 | 加工单中途失败是否遗留半成品 | 生产单/需求/任务/加工单全量 snapshot + restore | ORDER-009 |
| 普通派工 | KOL 是否仍可合并、竞价、派单、改派，或成为普通候选 | 所有运行时入口和 UI 候选双重失败关闭 | SCOPE-006、ORDER-010 |
| 接单暗门 | UI 只读但处理器能否接/拒/报价 | 页面处理器与运行时写入口均拒绝 | RECEIVE-001～004 |
| 执行暗门 | 隐藏按钮后，伪 DOM 是否还能手工开工/上报/暂停/通用完工 | 第二轮补齐四个通用处理器 KOL 失败关闭 | EXEC-004 |
| 底栏遮挡 | 三动作条是否覆盖 PDA 导航 | 移到 `bottom-[72px]`，390×844 回归 | EXEC-001、TEST-004 |
| 加工填报 | 是否仍生成隐藏报告或待回写状态 | 每次交出直接为 `WRITTEN_BACK_MATCHED`，没有 REPORT_PROCESS | EXEC-005、HAND-003 |
| 作废交出 | VOIDED 是否污染累计 | 保留历史但从有效累计和单头投影排除 | HAND-004 |
| 完成条件 | 仓管确认是否阻断，少交是否可完成 | 只按有效交出量精确等于计划量；仓管确认不参与 | HAND-005/006 |
| 仓库过滤 | KOL 为三方车缝后是否被内部仓初始化过滤 | 在初始化、seed/upsert、移动统计四层增加仅 KOL 例外 | WH-001～003、WH-009 |
| 出入库语义 | 是否仍出现接收、待领料、待交出、人工发料 | 统一显示加工领料；每 BOM 行自动成对入/出并净库存 0 | MATERIAL-009、WH-004/005/010 |
| 结算重复 | 联动 Mock 与运行时完成流水是否双算 | 有真实完成流水时关闭 KOL 兜底；一任务只留一条 | SET-004/005/009/010 |
| 通知越权 | operator 猜结算 todo URL 是否可读取 | 通知详情按当前工厂 + 当前角色可见待办反查 | EXEC-008、SET-007 |
| 固定能力 | 持久化旧工厂档案是否重新打开派单/竞价 | 读入时强制归一 eligibility、process ability、acceptance config | SCOPE-006、DELETE-006 |
| 旧规则残留 | 删除页面后是否仍残留字段、模板、路由或脚本别名 | 活动代码禁词扫描 0；两个旧文件物理不存在 | DELETE-001～009 |
| 普通工厂 | KOL 分支是否改变普通接单/竞价/开工/双仓/按批结算 | 自动化与普通账号命名页面均保持原行为 | SCOPE-004、TEST-003 |

第二轮共发现并关闭 20 个高风险遗漏点；最后一次代码修正是管理端 KOL 整单任务只读展示，此后重新执行两次 KOL 全链契约、所有相邻专项、真实页面和构建。

## 4. 85 条逐项验收汇总

逐条的原文、工作包、实际文件/符号、自动化证据、页面证据和确认版本见 `docs/product-design/KOL-GOTO特殊流程需求追踪与交付矩阵.md`。本轮数量核对如下：

| 需求组 | 条目数 | 已验证 | 待实施/实施中/待验证/阻塞 | 结果 |
| --- | ---: | ---: | ---: | --- |
| SCOPE | 6 | 6 | 0 | 通过 |
| DELETE | 10 | 10 | 0 | 通过 |
| ORDER | 12 | 12 | 0 | 通过 |
| RECEIVE | 4 | 4 | 0 | 通过 |
| EXEC | 9 | 9 | 0 | 通过 |
| MATERIAL | 9 | 9 | 0 | 通过 |
| HAND | 9 | 9 | 0 | 通过 |
| WH | 10 | 10 | 0 | 通过 |
| SET | 10 | 10 | 0 | 通过 |
| TEST | 6 | 6 | 0 | 通过 |
| 合计 | 85 | 85 | 0 | 通过 |

## 5. 最终自动化验收

| 检查 | 最终结果 |
| --- | --- |
| `npm run check:kol-goto-special-flow` 第一次（最后修正后） | 11 组全部通过 |
| `npm run check:kol-goto-special-flow` 第二次（最后修正后） | 11 组全部通过 |
| `npm run check:production-process-work-order-generation` | 通过 |
| `npm run check:process-work-order-unification` | 通过，印花 12、染色 16 |
| `npm run check:pda-task-receive-scope` | 通过；KOL 待接单/待报价/已报价/已中标均为 0 |
| `npm run check:fcs-unified-assignment-foundation` | 通过 |
| `npm run check:fcs-auto-dispatch` | 通过 |
| `npm run check:factory-handover-warehouse-linkage` | 通过 |
| `npm run check:factory-internal-warehouse-model` | 通过 |
| `npm run check:pickup-handout-order-and-warehouse-foundation` | 通过 |
| `npm run check:process-factory-warehouse-menu-consolidation` | 通过 |
| `npm run check:process-warehouse-unification` | 通过 |
| `npm run check:special-craft-pda-single-fact`、`check:wool-pda-single-execution`、`check:pda-warehouse-scan-query` | 通过；与最新 `main` 的工艺单一事实及扫码流程兼容 |
| `npm run check:settlement-linked-mock-factory` | 通过；含 TASK_COMPLETION / FIXED_TOTAL 粒度 |
| `npm run check:pre-settlement-ledger` | 通过 |
| `check:factory-settlement-pda`、`check:pda-settlement-ia/profile/ledger/task-links` | 全部通过 |
| `npm run check:menu-routes` | 通过；160 个 href，未覆盖 0、重复 0 |
| 活动代码旧规则禁词扫描（排除专项检查自身的禁词表） | 0 条残留 |
| `git diff --check` | 通过 |
| `npm run build` | 通过；2,347 modules transformed |
| `npm run check:prototype-design-governance` | 任务文件暂存后通过；隔离发布工作树再次复验 |
| `npm run workflow:verify` | 在仅含本任务提交的隔离发布工作树执行；收据状态 `verified`、`blockers=[]`，未吸收原工作树无关改动 |
| CodeGraph `sync/status` | 最终发布工作树同步完成；1,514 files / 46,720 nodes / 164,488 edges；无 pending 列表 |

说明：`npm run check:factory-settlement` 的全量聚合检查仍存在任务开始前就有、且在 HEAD 基线可同样复现的“扣款记录缺少对账单瑕疵扣款”失败；它不由 KOL 改动引入。与 KOL 固定总价直接相关的结算专项已全部通过。

## 6. 命名页面验收

| 场景 | 验收结果 | 证据 |
| --- | --- | --- |
| 生产需求转单与生产单列表/详情 | `DEM-202603-0092` 生成 `PO-202603-0103`；自动拆解、固定 KOL、三方/小微、无人工拆解/竞价/接收草稿 | 当前浏览器会话快照；印花单 `PH-20260819-000001`、染色单 `DY-20260819-000001` |
| 管理端任务清单 | `PO-202603-081` 可查到 KOL 整单任务；只显示详情/无需分配，无去分配和竞价 | `output/playwright/kol-goto-management-task-readonly-1366x768.png` |
| KOL 只读接单 | 只显示自动接收任务；无竞价页签和写动作 | `.playwright-cli/page-2026-08-18T22-35-25-711Z.yml` |
| KOL 执行 | `TASK-KOL-202603-0103` 仅三个入口；两次领料首次自动开工；两次交出 `700 + 1,400 = 2,100 件`；二次确认完成 | `page-2026-08-19T02-25-03-149Z.yml` 及相邻快照 |
| KOL 交接 | 仅待交出/已完成；同一交出单两条记录累计 `2,100 件` | `output/playwright/kol-goto-completed-handover-390x844.png` |
| KOL 仓管 | 仅待加工仓、一个默认位置；两次领料产生 6 条入库 + 6 条出库 | 当前入库/出库记录页快照 |
| KOL 结算 | admin 两笔独立固定价流水，未结算参考 `3,000,000 IDR`；operator 无结算入口 | `output/playwright/kol-goto-settlement-390x844.png` |
| KOL 通知 | operator 仅加工领料/待交出，admin 另有结算类；无普通类别 | `.playwright-cli/page-2026-08-18T23-03-47-977Z.png`、23-04 系列 yml |
| KOL 工厂档案 | 普通派单/竞价关闭，整单执行/固定总价结算开启，不可编辑 | `.playwright-cli/page-2026-08-18T23-06-00-927Z.png` |
| 普通工厂回归 | `ID-F001_operator` 保留待接单、拒单、接单、待报价/已报价以及普通手工开工 | `output/playwright/ordinary-factory-receive-390x844.png` |
| 图片与小屏 | 款式/每条物料均有本地图；失败态、大图、Esc；390×844 不溢出、不遮底栏 | 上述 P02～P05 页面证据 |

## 7. 交付边界

- 固定总价机制已完整实现并冻结；`1,500,000 IDR/整单` 仅为原型 Mock，真实合同金额尚未提供。替换真实金额后必须重跑 KOL 全链、结算专项和页面证据。
- 原工作区含用户其他未隔离修改；任务收据改在仅含本任务提交的隔离发布工作树生成，避免吸收无关差异。
- 本文档随本次 KOL-GOTO 提交交付；最终 GitHub `main` 提交号及远端确认结果以交付回执为准。
