# 毛织来源、数量及最终下游对抗式审查记录

## 1. 版本、范围与结论

- 记录时间：2026-09-18 21:56 CST。
- 工作树：`/Users/laoer/Documents/higoods/.worktrees/work-20260918`。
- 分支：`codex/work-20260918`。
- 基础 Git HEAD：`4804328a822eec3c77eee1ffa5b10911bb77c9fe`。本轮审查和验证针对该 HEAD 之上的当前未提交工作树；该 SHA 本身不包含本轮修改。
- 依据：[总体调整方案](../design.md)、[代码核查记录](../code-audit.md)、[实施计划](../implementation-plan.md)、[需求追踪矩阵](../requirements.md)及用户已确认的“不外发片按件随横机填报、路线按绑定技术包、旧原型单清空”口径。
- 本轮重点：技术包来源与片身份、局部路线阻断、同源工艺单重复、实际收货与库存守恒、历史清理、`FLOW-005` 部位毛织到裁厂及 `FLOW-006` 整件缝盘到后续成衣工艺。此前已确认的 13 项阶段页面问题不再独立重复审查，仅随聚合专项回归。

**结论：初轮发现的下述数据与入口问题已修复，冻结后的定向反例和 17 个已登记专项聚合通过；本记录范围内未保留未修复的数据阻断问题。该结论不等于整体交付通过。** 本轮不声明真实浏览器、PDA 设备、图片大图、打印或任何 `< 200ms` 性能门禁通过；这些由主代理对冻结版另行验收并更新矩阵。

本文仅记录原型数据和交互实现，不代表真实工厂发生了生产、交出或收货。

## 2. 发现、修复与反例回放

### 2.1 毛织逐片工艺可能重复生成通用加工单

**发现与初轮判定：失败。** 同一绑定技术包的毛织纸样片既进入新 `WSC` 逐片路线，也可能进入 `special-craft-task-generation.ts` 的普通裁片工艺生成。仅隐藏列表会留下旧任务、批次和两类仓储事实，旧写入口或快照恢复也可能重新产生库存。

**修复：**

- `src/data/fcs/special-craft-task-generation.ts:435` 起识别毛织纸样及其逐片需求，退出普通裁片工艺生成；普通布料裁片和缝盘后的成衣工艺保留。
- `src/data/fcs/special-craft-task-orders.ts:480` 的 `retireLegacyWoolPieceTasks` 实际移除旧同源工艺单、生成批次引用、相关错误和专属仓储记录；初始化、快照恢复均执行清理。
- 直接关联的来源任务、工艺仓储及差异复核记录按旧工艺单身份清理；工艺 store reset 同步清空退役集合，避免跨测试污染。未建立第二套持久化兼容机制。

**反例证据：** `scripts/check-wool-craft-generation-boundary.ts` 的 5 项检查通过：毛织逐片仅保留 WSC、普通布料保留、成衣工艺保留、旧同源事实实际移除、恢复旧快照及旧写入口不能复活旧工艺库存或交出。

### 2.2 单片坏路线被升级成整单阻断

**发现与初轮判定：失败。** 可定位到 Q2 的路线问题不应阻断 Q1 外发，也不应阻断另一正常 SKU 的无外加工自动衔接。

**修复：** 解析结果保留片自身 `issues`；可定位但缺实例、缺颜色物料关系的资料问题放入 `generationIssuesBySku`；只有不能定位的资料问题留在整单层。`stage-rules.ts` 分别核验片及 SKU 的问题。完单仍检查全单资料和所有片闭合，不能因为局部可操作而提前完单。

**实现：** `src/data/fcs/wool-domain/piece-source.ts`、`tech-pack-source.ts:184,353`、`stage-rules.ts:4` 及调用这些规则的阶段命令。

**反例证据：** `scripts/check-wool-route-isolation.ts` 的 4 项通过：Q2 坏路线仅阻断 Q2；另一无外加工 SKU 仍生成自动四事实；缺实例阻断所在 SKU 且不误走自动链；缺颜色物料关系不会污染正常 SKU。

### 2.3 清旧不能永久屏蔽仍合格的来源任务

**发现与初轮判定：失败。** 将旧来源任务 ID 永久退役会违反设计 §11.2：“旧单及记录清空，但仍合格来源可以按新身份生成”。

**修复：** 撤除旧来源任务永久屏蔽；新任务生成只使用新阶段身份，不继承旧数量或记录。明确旧演示 `WOOL-MOCK-*`、`TASK-WOOL-MOCK-*`、`WOOL-RCV-DEMO-001` 继续排除。`legacy-reset.ts` 按真实旧毛织单 ID 清理接收行、分配、送货和 PDA 交接引用；不调用全局 `storage.clear()`，保留非毛织数据及机器主档，释放旧设备占用。

**反例证据：** `scripts/check-wool-legacy-reset.ts` 的 7 项通过，包括 PDA 尚未加载时清理并随后加载、不存在 v2 时仍清明确旧演示引用、混合单行保留非毛织、机器主档保留、失败回退，以及合格旧来源只生成新配对身份且零继承旧加工数量。

### 2.4 FLOW-005 部位毛织下游只核验类型，未隔离实际裁厂

**发现与初轮判定：失败。** 仅检查 `receiverType` 会让其他裁厂读取、分派或装袋本不属于该厂的最终实收产物。

**修复：**

- `src/data/fcs/wool-domain/cutting-receipts.ts` 解析实际 `receiverId` 对应的启用裁厂待交出仓；仅将缝盘最终、非内部自动、非外发片、已确认实收记录转换为来源，携带 `receivingFactoryId` 与 `receivingWarehouseId`。
- `src/data/fcs/cutting/generated-fei-tickets.ts` 保留上述归属；来源数量单位为件。
- `src/data/fcs/cutting/sewing-dispatch.ts:1399,2474` 在可分派来源和装袋写入口核验实际接收裁厂；混合装袋使用同一归属规则。
- `src/data/fcs/cutting/transfer-bag-operations.ts:4002` 核验来源库位的实际工厂、仓库及原实收来源身份、生产单、部位、颜色尺码和数量。明确旧中央裁厂别名只映射既有默认裁厂，不将未知仓库当成合法来源。

**反例证据：** `check-wool-final-downstream.ts` 第 1 组：默认实际裁厂可以读取；另一裁厂不可读取；修改为另一合法裁厂仓后，仅该厂可读取；未知接收仓不产生来源。

### 2.5 FLOW-006 后续成衣工艺缺少最终交出实收接入

**发现与初轮判定：失败。** 原后道适配器仅覆盖既有指定后道厂；证明错误后道厂不出现，不能证明合法的其他成衣工艺厂能接收。整件缝盘最终产物也不能误走 `WOOL_PIECE` 返缝盘分支。

**修复：**

- 新增 `src/data/fcs/wool-domain/final-craft.ts:23,33`：按绑定生产单技术包的前置路线，识别缝盘后的普通成衣工艺；以实际 final handover 批次为来源，并校验同生产单、同 SKU、实际接收厂及明确的节点/任务引用。
- 同厂存在两个合法后继成衣节点时，只有接收厂、没有明确节点/任务的批次不由两张工艺单重复认领。明确路线节点后只进入对应加工单。
- `special-craft-task-orders.ts:2553` 从同一最终实收事实投影接收量及逐 SKU 进度；不生成第二套实收来源。不允许通过通用更新入口直接更改最终成衣实收量（`:2697`）。
- `process-action-writeback-service.ts:1191` 要求显式选定实际批次、批次合计一致，再调用 `confirmWoolFinalCraftBatches`；旧逐 SKU 直接接收载荷不能绕过。计划 10 件、实际交出 12 件时，合法实收 12 件不会被计划错误截成 10。

**反例证据：** `check-wool-final-downstream.ts` 第 2、3、6、7 组验证真实批次可接收、未选批次仍待收、错目标厂/会话/路线节点/伪来源不可接收、同厂多后继不重复认领，且保留普通非毛织工艺生成边界。

### 2.6 底层确认缺少实际交出上限，重试可能换载荷

**发现与初轮判定：失败。** 只在 Web 弹窗或最终成衣包装函数核验数量，不足以约束直接调用底层确认的 PDA/其他入口。相同确认号若允许改批次或数量，也会使重试含义不明确。

**修复：**

- 主代理在 `src/data/fcs/wool-domain/commands.ts:625` 的 `confirmWoolDownstreamReceipt` 提交前补齐上限，`:641` 要求非负整数实收不得超过该 handover 的有效交出数量（考虑数量修正），自动内部衔接和外发片不能误走此最终确认入口。
- `final-craft.ts:69` 检查操作人、时间、批次唯一性、工厂身份、来源剩余及已确认批次重试的一致性；接收时间不得早于交出。
- `process-action-writeback-service.ts:1423` 将最终批次及数量的确认意图附在既有动作结果中；相同确认号不同载荷明确拒绝，同载荷不重复写。批次确认失败恢复原毛织 store。

**反例证据：** `check-wool-final-downstream.ts` 对有效交出 8 件直接调用底层确认实收 9 件，得到“实收不能超过交出件数”，前后毛织事实相同；另外验证超交出、伪来源、已确认批次改数量、批次合计篡改、相同确认号改载荷均被阻断。

**权限边界：** 底层确认负责事实及数量校验；本厂权限由实际 Web/PDA 接收入口校验。Web 无 PDA 会话时按已有管理端入口处理；PDA/移动端必须有匹配实际接收厂的会话。本次没有引入真实鉴权后端。

### 2.7 工艺仓储可能由计划或状态回生库存

**发现与初轮判定：失败。** 旧工艺仓储存在以状态构造接收/出库、零值回退成计划或累计加工量的路径；套到新毛织事实会凭空恢复库存。

**修复：**

- 毛织逐片链：从统一 `FactoryReceipt` 实际片收货及 `craftRecords` 的加工/交出读取，形成待加工、待交出、实际出库及在途；中间节点不能提前进入缝盘片实收，末节点才回缝盘。
- 最终成衣链：`special-craft-task-orders.ts:1854` 起仅按实际接收、加工和已交出量生成仓储；零库存保持零，未交出不造出库，未下游实收不造回写。
- `process-warehouse-domain.ts:735,1135` 和工厂内部仓储读取同一实收投影；不从计划制造库存。`process-warehouse-linkage-service.ts` 的最终成衣分支不再进入旧逐 SKU 计划备货路径。

**反例证据：**

- `check-wool-craft-warehouse.ts` 6 项：计划/交出未收无库存；加工消耗与产出守恒；在途随下游实收减少；下一站按路线；末片实收只入缝盘；重复读取不重入；非毛织记录不变。
- `check-wool-final-downstream.ts` 第 4、5 组：12 实收 = 7 待加工 + 5 待交出；随后第二批真实收 8 件，累计 20 = 15 待加工 + 5 待交出；两套仓储及 Web 读取一致；没有实际交出时无出库记录。

### 2.8 Web 弹窗事件分发与 PDA 批次入口断开

**发现与初轮判定：失败。** 主代理核查 `main.ts` 事件只在 `#app` 委托，新增最终接收弹窗原挂 `document.body` 会脱离分发；PDA 原分支仅支持逐片，最终普通成衣单未接到实际批次接收。

**修复与当前代码证据：**

- `src/pages/process-factory/special-craft/task-detail.ts:463,470,546`：最终批次弹窗挂在 `#app`，支持显式勾选、填写件数、确认/关闭及 Esc；保存后局部替换当前工艺详情，不要求通过整页重绘完成动作。
- `src/pages/pda-exec-detail.ts:5663`：最终成衣工艺的“确认接收”跳 `/fcs/pda/handover?tab=pickup&woolFinalCraftOrderId=<taskId>`。`pickup` 是项目既有待接收 Tab 名称，不添加无效的 `receive` Tab。
- `src/pages/pda-handover.ts:1019`：验证当前会话工厂，展示本单未收真实批次的紧凑卡片、款图、SKU、收发双方、时间及件数；“接收本批”进入该实际 handover 详情，沿既有实际确认入口处理。

**验证边界：** 相关源文件未新增 TypeScript 报错；底层确认与投影已由上述专项验证。实际浏览器按钮分发、窄屏可用性、大图和响应时间必须由主代理冻结版浏览器证据判定，本记录不将代码存在或 Node 专项等同于浏览器通过。

### 2.9 临时内存验收任务不能证明刷新持久性，款图也需同步

**发现与初轮判定：失败。** 早期隔离 fixture 只改内存生产单快照并注入普通工艺任务；主代理浏览器在接收后读取任务得到 `undefined`。代码未发现保存后主动 reset 普通工艺 store 的调用；编辑期 HMR 是可能原因，但没有把这一推断记成已证实根因。可以确认的是旧 fixture 在模块重载/整页刷新后不能保证恢复，因此证据无效。另有更换 PO/SKU 后仍保留原毛织示例款图、颜色尺码的风险。

**修复：** `scripts/fixtures/wool-final-downstream-review.ts` 只在隔离验收浏览器显式运行，使用已有 `persistCreatedProductionOrders` 保存独立新生产单 `PO-WOOL-FINAL-REVIEW`，再由正常生成器生成同一工艺任务身份和接收厂；不向业务启动插入新种子，不新增持久化层。横机/缝盘引用的款号、款名、内部款号、图片及颜色尺码同步到同一真实素材对应的源 PO。毛织 handover 接收仍保存到现有毛织事实 store。

**跨进程证据：** 新增 `scripts/check-wool-final-refresh.ts`，第一个独立 Node 进程准备来源并调用真实 Web 动作接收第一批 12 件，保存隔离 storage 数据；第二个全新进程只加载现有业务模块与 storage，**不再次调用 fixture、不恢复工艺任务快照**。验证：

1. 正常生产单加载与生成恢复相同工艺任务 ID 和接收厂。
2. 第一批实收 12 件保留，第二批 8 件仍未收。
3. 工艺待加工库存为 12 件，没有计划库存替代实收。
4. 毛织单、SKU 与最终批次款图引用一致。

该专项通过证明模块重启恢复契约，不证明浏览器绘制或性能。

## 3. 冻结版专项执行记录

执行命令：

```sh
node --import tsx scripts/check-wool-fact-workflow.ts > /tmp/wool-final-aggregate.txt 2>&1
npx tsc --noEmit --pretty false > /tmp/wool-final-ts.txt 2>&1
git diff --check
```

- 聚合命令：退出码 **0**；日志 `/tmp/wool-final-aggregate.txt`，本轮末次写入时间 2026-09-18 21:55 CST。
- 聚合入口：`scripts/check-wool-fact-workflow.ts`。每个专项在独立进程运行，以下 **17 个专项均通过**。
- `git diff --check`：退出码 **0**。
- TypeScript：全仓退出码 **2**，仍有本轮范围外既有错误，不能表述为全仓类型检查通过。日志 `/tmp/wool-final-ts.txt`；本轮最终下游、工艺仓储、裁厂接入、PDA/最终接收详情及 fixture 相关文件未报告错误。
- `/tmp` 日志是本机原始输出位置，并非永久归档承诺。下面保留关键输出与脚本索引，需重现时运行同一冻结工作树命令。

| # | 脚本（`scripts/`） | 本记录关注的证据 |
|---|---|---|
| 1 | `check-wool-piece-source.ts` | 绑定版本、深复制、同片多纱线去重、无片合法与坏路线 |
| 2 | `check-wool-route-isolation.ts` | 片/SKU 局部问题隔离，整单完结仍受控 |
| 3 | `check-wool-receiving-demo-batch.ts` | 演示实际接收批次保存及失败原子回退 |
| 4 | `check-wool-two-stage-flow.ts` | 自动四事实、150%上限、合法修正、末站回货及阶段完成 |
| 5 | `check-wool-stage-receiving.ts` | 两段接收、实际来源上限、分批、错厂/错节点及幂等 |
| 6 | `check-wool-final-downstream.ts` | FLOW-005/006 的 7 组实际来源、数量、库存及目标隔离反例 |
| 7 | `check-wool-final-refresh.ts` | 两独立进程恢复相同任务、实际批次及库存 |
| 8 | `check-wool-stage-boundaries.ts` | 自动链/跨存储失败回退、重试载荷、指定后道及配对边界 |
| 9 | `check-wool-stage-stock-machine.ts` | 纱线库存、设备阶段及主档保留 |
| 10 | `check-wool-legacy-reset.ts` | 旧数据定向清理、保留共享非毛织、有效来源新身份生成 |
| 11 | `check-wool-pda-single-execution.ts` | 阶段扫码、回货识别、会话及移动实际接收记录 |
| 12 | `check-wool-handover-printing.ts` | 打印数据阶段/批次/厂/图/二维码/单位；内部衔接不外印 |
| 13 | `check-wool-stage-ui.ts` | 已有 13 项阶段页面代码/处理器专项回归；不替代浏览器 |
| 14 | `check-wool-craft-warehouse.ts` | 工艺实际收货、加工、交出、在途守恒及非毛织保留 |
| 15 | `check-wool-craft-generation-boundary.ts` | 通用毛织逐片重复生成清理与不可复活 |
| 16 | `check-wool-stock-allocations.ts` | 29 项实收备料分配、身份、查询及事实一致性 |
| 17 | `check-wool-warehouse-unified-model.ts` | 件/片/kg、移库调整、批次领料及 Web/PDA 同源 |

原始输出关键摘录：

```text
7 final downstream contracts passed
PASS 最终接收跨全新模块初始化仍由原交出事实恢复；款图与SKU一致，未收批次仍待接收
PASS 7 legacy wool reset checks
PASS 6 wool craft warehouse checks
PASS 5 wool craft generation boundary checks
PASS 毛织两阶段已登记业务契约；浏览器及性能结果另行验收
```

## 4. 浏览器复验场景与交付边界

仅在全新、隔离的验收浏览器运行 `prepareWoolFinalDownstreamReviewScenario()`。准备后直接刷新即可恢复，不需重复准备；重复准备会明确拒绝，避免混入已有操作。

| 项目 | 场景值 |
|---|---|
| 实际 Web 路由 | `/fcs/process-factory/special-craft/aux-op-heat-transfer/work-orders/AUX-TASK-POWOOLFINALREVIEW-SFER-ff6c89-01` |
| 工艺任务 | `AUX-TASK-POWOOLFINALREVIEW-SFER-ff6c89-01` |
| 普通生成器选择的接收厂 | `FAC-FLOWER` |
| 来源缝盘单 | `WOOL-STAGE-003:LINKING` |
| SKU / 款式 | `SKU-082-S-GRY` / `SPU-HOODIE-082` |
| 对应图片 | `/production-confirmation-demo/grey-zip-hoodie.png` |
| 实际交出批次 | `WHO-review-final-0`：12 件；`WHO-review-final-1`：8 件 |
| PDA 批次入口 | `/fcs/pda/handover?tab=pickup&woolFinalCraftOrderId=AUX-TASK-POWOOLFINALREVIEW-SFER-ff6c89-01`，必须登录该实际接收厂 |

主代理应在准备后先刷新、只接第一批、再次刷新，核对实际接收 12 件、第二批继续待收，并验收 PDA 批次进入实际接收详情。该场景是隔离原型数据，不代表真实生产单。

本记录不覆盖普通成衣工艺之后所有既有业务的持久化能力，不证明全仓所有页面或所有类型错误已解决，不代替图片资源加载与大图现场结果，也不代替真实浏览器各动作和冷启动/刷新/路由切换的至少 5 次 `< 200ms` 原始测量。

**本轮仅关闭已发现的数据反例修复回放。需求矩阵的总体状态、冻结版完整浏览器结果、production 路由性能及最终完成判断由主代理整合；任一适用浏览器/性能证据缺失或失败，相关需求及总体任务仍不得标记“已验证”或“完成”。**

## 7. 追加浏览器对抗式验收：阶段动作与导出

本节追加的是同工作树、同基础 HEAD 未提交版本的浏览器功能证据，不更改前文 17 个数据专项的范围。使用 Chromium、开发服务 `http://127.0.0.1:5186`、每个用例独立浏览器上下文；Web 为 Playwright Desktop Chrome 默认尺寸，PDA 分别为 360×800 和 400×806。没有运行构建或性能测量，不能以本节通过关闭 `< 200ms` 门禁。

### 7.1 缝盘完单误触发横机设备校验（P1）

**初轮：失败。** 现有 `FP260918-004` 演示单通过 Web 真实“发起交出”交出 100 件，隔离浏览器通过正常下游接收命令确认实收 100 件后，出现完单入口。打开、取消、再次打开确认窗均不提前写完单事实；点击“确认完成加工单”却显示“仅横机加工单可以关联横机设备”。

**根因与修复：** `commands.ts` 的 `completeWoolWorkOrder` 无条件调用设备解除函数，新增的仅横机设备门禁错误拦住缝盘。主代理改为仅 KNITTING 调用解除，LINKING 的 `releasedMachineIds` 为空；同时在 `check-wool-stage-stock-machine.ts` 补齐缝盘实际交出、实际接收、完单幂等及机器事实不变的检查。主代理专项日志为 `/tmp/wool-linking-complete-regression.log`。

**真实页面回放：通过。** [阶段动作测试](../../../../tests/wool-stage-actions.spec.ts)验证 Web 缝盘未交出、已交出未实收时无完单入口，交接闭合后才可二次确认；确认完成后刷新仍只有一笔完成记录。两种 PDA 尺寸分别完成横机和缝盘二次确认，并刷新回读完成事实。缝盘闭合准备使用正常交出按钮及隔离浏览器内的正常接收命令；这不是对接收人员界面权限的替代验收。

初轮失败日志：`/tmp/wool-stage-actions-e2e.txt`。失败页面、视频和 trace：`test-results/wool-stage-actions/wool-stage-actions-Web-完单先核对再确认：未交出、未实收均阻断，闭合后刷新持久化/`。

### 7.2 设备、数量修正、扫码与列表偏好

以下 7 个浏览器用例于本轮一次完整回放通过（`7 passed (25.3s)`；日志 `/tmp/wool-stage-actions-final.txt`）：

1. Web 缝盘未闭合阻断、二次确认取消无写入、闭合完成及刷新。
2. PDA 360×800 横机和缝盘完单、未闭合阻断、确认后刷新。
3. PDA 400×806 同上，确认内容可操作且页面无横向溢出。
4. 从横机单真实设备入口关联 WM-003、维修设备禁用、刷新关联保留；缝盘无设备入口。
5. 未消费的横机 40 件修正为 35 件，横机填报、自动交出、缝盘接收和自动填报同时为 35；缝盘实际交出 5 件后再次改横机数量被阻断，整组事实无变化，刷新不变。
6. PDA 扫描加工单直达正确阶段；现有 PO-MZ-004 经正常交出/接收准备成两阶段均可操作后，扫描生产单展示两个候选，选择缝盘准确进入；换成另一工厂后直接打开毛织任务被阻断，事实无变化。无人工动作的自动缝盘单按当前执行工作区规则不列为可操作候选。
7. 待接收导出全部匹配来货而非当前 10 行，备料导出实际实收行，两者无操作列且空结果明确反馈；隐藏列、顺序、冻结、每页 20 条按各自路由保存，刷新回读。备料冻结列遵守共享宽度上限，先取消默认冻结再冻结来源列。

本组第一次测试中的 URL 断言未考虑现有 `returnTo` 参数、双候选场景选错、冻结测试超过共享宽度上限均已修正为实际产品契约，不算产品缺陷。页大小变更通过检查真实 localStorage 保存完成后刷新，避免测试自身在异步事件落地前立即导航。

两种 PDA 完单确认截图在 `test-results/wool-stage-actions-final/` 对应用例目录的 `completion-confirmation.png`。本节只证明列出的功能路径，不证明全路由、全部动作的性能。

### 7.3 导出零数量丢失（P2）

**追加精确数量检查：失败。** 在上述下载、行数和列表偏好检查之外，对 CSV 每个匹配来源的实发、已实收、待接收数量逐格比对真实事实。实际获得 `["10", "10", ""]`，应为 `["10", "10", "0"]`。根因是 `pending-receipts.ts` 导出使用 `String(value || '')`，将合法零值当成空值；纱线“实发”还应与页面一样使用 `yarn.netGrams / 1000`。

反例已保留在 [阶段动作测试](../../../../tests/wool-stage-actions.spec.ts)的 CSV 数量断言中。失败日志 `/tmp/wool-stage-actions-export.txt`，页面/trace 位于 `test-results/wool-stage-actions-export/`。

**修复与回放：通过。** 主代理将导出零值处理改为 `value ?? ''`，纱线实发改为与页面一致的净重口径。最后一次实质修改后，重新执行受影响的导出用例：`1 passed (4.5s)`，日志 `/tmp/wool-stage-actions-export-fixed.txt`。逐来源的实发、已实收、待接收数量（含 0）完全一致；同一用例同时复核全部匹配行、空结果反馈及待接收/备料两路由的列偏好。

### 7.4 本次追加验收结论

- 本次发现的缝盘完单 P1 和导出零数量 P2 均有失败反例、最小修复及修复后的真实浏览器回放；该追加范围内没有保留未修复的功能问题。
- 最终证据为完整 7 用例通过，加最后导出修改后的受影响 1 用例通过。未受导出修改影响的 6 个用例不重复运行。
- 本子任务实际仅新增 `tests/wool-stage-actions.spec.ts`、追加本记录；两处产品修复及缝盘专项由主代理实施。未改主入口、性能脚本、其他测试，未运行构建。
- 命令：`PLAYWRIGHT_BASE_URL=http://127.0.0.1:5186 CUTTING_E2E_PORT=5186 npx playwright test tests/wool-stage-actions.spec.ts --workers=1 --reporter=line --output=test-results/wool-stage-actions-final`；导出最后回放另加 `--grep '导出'`，输出目录 `test-results/wool-stage-actions-export-fixed`。
- 这只是功能验收通过。总体需求状态仍由矩阵、其他受影响路径及性能证据共同决定，不能据此宣称总体任务完成。

## 8. 查询副本、PDA 冻结快照与待办提示的增量审查

### 8.1 范围和证据方法

本轮仅审查当前未提交工作树的以下增量及其直接调用关系：`craft-warehouse.ts` 的 `copyProjection` 替代两处 `structuredClone`、`pda-handover-events.ts` 的两个毛织读取函数改用 `readWoolQuerySnapshot`，以及追加指定的 `factory-mobile-todos.ts/getWoolTodoMeta`。未修改生产代码或仓库测试、未启动浏览器、未执行构建。CodeGraph 明确提示索引来自根工作树，相关新符号及修改以本工作树实际文件为准。

主代理已有的两份专项之外，本轮在 `/tmp` 增补独立反例，复用专项初始化隔离数据，继续执行新的对象身份、真实 PDA 写入口和资料阻断诊断：

- `/tmp/wool-copy-projection-adversarial.mts`，命令 `node --import tsx /tmp/wool-copy-projection-adversarial.mts`；日志 `/tmp/wool-copy-projection-adversarial.log`。
- `/tmp/wool-pda-snapshot-adversarial.mts`，命令 `node --import tsx /tmp/wool-pda-snapshot-adversarial.mts`；首次业务反例日志 `/tmp/wool-pda-snapshot-adversarial.log`，修复后日志 `/tmp/wool-pda-snapshot-adversarial-fixed.log`。

### 8.2 仓储复制完整性：通过

逐项核对当前生成语句及运行时的全部行，确认 `copyProjection`（`src/data/fcs/wool-domain/craft-warehouse.ts:38`）覆盖当前所有可变字段：

| 生成集合 | 当前可变叶子 | 复制方式 |
|---|---|---|
| 待加工、待交出、入库、出库四类行 | `photoList` | 每次新建行对象和独立图片数组 |
| `warehouseRecords` | `relatedFeiTicketIds`、`relatedHandoverRecordIds`、`relatedReviewRecordIds` | 三类数组分别新建 |
| `handoverRecords` | `evidenceUrls`、`relatedFeiTicketIds` | 两类数组分别新建 |
| 两个 ID 集合 | 集合自身；元素都是字符串 | `new Set` 分别新建 |

当前这些行的其他实际字段均为标量，没有传入原工厂对象、原接收行、原技术包对象或 `sourceSnapshot` 嵌套对象。接口虽然允许可选 `sourceSnapshot`，当前毛织构造器未生成它；本结论限于当前构造器，不能视作未来任意嵌套字段的通用深复制保证。

独立诊断对两次返回结果递归检查 110 个对象、数组和集合：同次不同记录之间、两次返回之间均无相同对象引用，全部返回对象可修改。8 个集合都有实际数据：待加工 2、待交出 2、入库 4、出库 4、通用工艺仓储 4、交接 2、通用入库 ID 3、任务 ID 3。对副本删除字段、增加嵌套字段、清空图片、修改关联数组和清空集合后，下一次投影、毛织事实及工厂仓储快照逐字段保持原值。

同时复核原专项 `scripts/check-wool-craft-warehouse.ts:112` 的递归污染反例和 `:129` 的仓储快照污染后恢复反例。`ensureFactoryInternalWarehouseStore`（`factory-internal-warehouse.ts:2541` 起）仍在每次读取时替换毛织投影，没有改成仅 revision 变化时安装；因此通用仓储写操作不能把伪造派生库存留在后续查询中。原 7 项专项随隔离初始化通过，非毛织仓储基线不变。

### 8.3 冻结快照与实际 PDA 写入：通过

- `getWoolFactHandoverContext`（`pda-handover-events.ts:1216`）和 `listWoolFactHandoverHeads`（`:1423`）仅从冻结快照读取；自动内部交出与逐片工艺交出仍被排除，未扩大最终件交接范围。
- `buildWoolFactHandoverHead` 新建标量行，`buildWoolFactHandoverRecord` 新建行、明细数组和凭证数组；公开读取继续返回防御性副本。冻结的原订单、计划行和交出记录没有直接作为可写返回值泄漏。
- 实际接收分支 `writeBackHandoverRecord`（`:4865` 起）使用快照进行存在性及实际接收厂校验，然后把标量传入 `confirmWoolDownstreamReceipt`。命令仍通过 `readWoolStore` 建立可写草稿，不会在冻结对象上保存。
- `readQueryStore`（`queries.ts:43`）在 revision 改变后重新取可写事实的副本并冻结，且在读取完成后记录 revision。`getWoolStoreRevision` 包含毛织及统一接收版本；清缓存、替换、成功提交均改变毛织版本（`store.ts:908–938`）。仓储缓存同样在构建结束后记录版本，初始化产生的接收版本变化不会被遗漏。

主专项新增 8 件真实交出、污染查询结果和实际接收立即更新的检查通过。独立反例进一步走真正的 `writeBackHandoverRecord`：新建 7 件交出，以该交出的实际接收厂 PDA 会话确认 7 件；两次保存均产生新快照，旧冻结快照分别保持“尚无此交出”和“待实收”，新头和新明细立即读到 7 件实收。修改公开返回的明细和凭证数组不污染后续读取；非毛织交接头与保存前基线逐字段相等。

### 8.4 新增待办资料阻断提示（P2）：失败后修复通过

主代理将旧“毛织加工单/接收纱线”统一提示改为按实际阶段和允许动作表达。正常横机待收纱线、缝盘待收外加工片、无外加工自动等待三类专项通过。

**独立发现：** 空 `externalPieces` 不必然代表合法的无外加工自动流程。技术包已有工艺但缺逐片实例时也可能没有可用片，且允许动作仅为 `DETAIL`。首次诊断将现有缝盘演示单置于这种明确的资料问题，实际得到 `缝盘加工单等待横机填报同步/待开工`，会误导员工等待填报解决资料缺失。失败值及断言保留在 `/tmp/wool-pda-snapshot-adversarial.log`。

**修复：** 主代理在 `factory-mobile-todos.ts:171` 对“没有可执行动作”的实际订单检查 `woolOrderGenerationIssues`，存在资料问题时返回既有“异常待处理”和“缝盘加工单资料不完整，请核对技术包”。条件明确要求所有动作均为 `DETAIL`，不会覆盖仍有合法动作的正常 SKU 或片。

**回放：通过。** 仓库专项追加空片加资料问题的真实待办反例；独立诊断分别以整单 `generationIssues` 和 SKU 级 `generationIssuesBySku` 复现，均得到资料修正指引、不再显示自动同步等待。修复后完整独立 PDA 诊断退出码为 0。

### 8.5 本增量结论与边界

本轮发现的待办 P2 已有失败、修复及独立回放；两处查询优化未发现返回引用污染、冻结对象写入、提交后读取旧数量或非毛织数据变化。本增量的数据/代码审查通过，没有新增未关闭缺陷。

本结论只针对本节列出的当前构造字段和调用路径，不覆盖未来新增嵌套字段、无关仓储配置变更或所有历史页面。待办提示属于用户可见变更，仍须由主代理完成受影响 PDA 页面与最终版本的浏览器验证；本轮没有浏览器及性能证据，不豁免任何 `< 200ms` 完成条件。

本节独立诊断的持久归档：[副本脚本](./copy-projection-adversarial.mts)、[副本日志](./copy-projection-adversarial.log)、[PDA 脚本](./pda-snapshot-adversarial.mts)、[P2 首次失败](./pda-snapshot-adversarial-before.log)、[修复后回放](./pda-snapshot-adversarial-fixed.log)。原临时路径仅作执行来源记录。
