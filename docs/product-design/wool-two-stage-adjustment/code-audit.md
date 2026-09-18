# 毛织两阶段调整：代码核查记录

日期：2026-09-18。代码基线：`codex/work-20260918`，HEAD `4804328a822eec3c77eee1ffa5b10911bb77c9fe`。本记录为设计依据，不是实施验收收据。

主文档：[调整方案](./design.md)；执行拆解：[实施计划](./implementation-plan.md)；覆盖控制：[需求矩阵](./requirements.md)。

## 1. 方法和证据边界

先使用项目 CodeGraph 定位符号、关系和流程，再读取隔离工作树中的相关实现细节。CodeGraph 的项目索引位于原仓库；涉及当前分支差异的结论以隔离工作树源文件为准。未把静态图中“找不到调用路径”解释为运行时绝对不存在调用，也未把代码存在解释为浏览器验收通过。

设计阶段只读核查代码和参考页面，未运行业务写操作、数据清空、构建或业务测试。当前原型染色页用于结构参照；用户提供的线上毛织与技术包截图用于需求场景，不等同于当前代码基线。

以下行号为本次基线定位，实施后会变化；文件链接和符号名用于持续追踪。

## 2. 毛织数据、来源与状态

| 证据 | 已确认代码事实 | 影响及调整 |
|---|---|---|
| [types.ts](../../../src/data/fcs/wool-domain/types.ts)，1～5、31、140 行附近 | 状态只有 `UNPROCESSED/PROCESSING/COMPLETED`；数量单位只声明件、kg；单据只有一种 `WoolWorkOrder`；交出使用单据下游目标 | 增加阶段及片对象，不沿用单阶段状态／单目标模型 |
| [tech-pack-source.ts](../../../src/data/fcs/wool-domain/tech-pack-source.ts)，`resolveSourceForSku`，119 行 | 从技术包颜色映射和毛织 BOM 提取必需纱线 | 保留纱线投入来源，不能按纱线条数生成物理片 |
| 同文件，`buildWoolOrderSourceSnapshot`，173 行 | 部位毛织缺少部位会抛错；整件按成衣 SKU 输出；部位输出计划仍用成衣件数 | 放开无外加工、无逐片明细的合法场景；件与片显式分开 |
| 同文件，`resolveRuntimeWoolParts`，245 行 | 从毛织 `pieceRows` 和颜色配置读取部位；按部位＋SKU 去重；不消费 `pieceInstances.specialCraftAssignments` | 两类毛织都应从逐片实例提取工艺，不能用旧部位摘要代替 |
| 同文件，`buildWoolOrderSourceSnapshotFromRuntimeTask`，292 行 | 读取生产单绑定快照，使用当前任务 SKU 范围；分拆任务不回退全单；仅部位类型读取毛织部位 | 保留版本／任务范围约束；整件也解析外发片 |
| 同文件，`buildWoolOrderFromRuntimeTask`，394 行 | 单 ID 沿用任务 ID；部位默认交裁床待交出仓，整件沿任务接收方 | 生成稳定配对身份；最终下游与横机片的第一工艺去向分离 |
| 同文件，`ensureRuntimeWoolWorkOrders`，481 行 | 按有效任务懒生成单据，排除部分旧演示任务和失效范围 | 清空时同时处理重新生成规则，只能按新模型生成 |
| [queries.ts](../../../src/data/fcs/wool-domain/queries.ts)，`getWoolWorkOrderReadinessProjectionFromStore`，316 行 | 每种必需纱线有效接收量大于零即具备填报条件；上限为计划 150%；可交出受已填报、已交出和库存限制 | 保留已知的纱线种类门禁，不能声称可完成全计划；补片和缝盘数量约束 |
| 同文件，`getWoolProcessingStatusFromStore`，467 行 | 完单记录存在才是 COMPLETED；有正数填报或交出即 PROCESSING | 增加工序加工完成的推导，不能把完单与达产混为一谈 |
| 同文件，`getWoolWorkOrderTab`，485 行 | 只有 READY、NOT_READY、COMPLETED 三类 | 用户六入口优先；旧测试需同步修改 |
| 同文件，`getWoolAllowedActionsFromStore`，520 行 | 是否可以接收、填报、交出、关联横机、完单集中判断；有有效交出即开放完单 | 复用集中判定方式，新增阶段权限与闭合门禁 |
| 同文件，`getWoolWorkOrderByTaskId`，772 行 | 同任务多个毛织单会违反唯一性 | 必须迁移调用者，不能只增加第二张旧对象 |

## 3. 命令、存储与数量修正

| 证据 | 已确认代码事实 | 影响及调整 |
|---|---|---|
| [commands.ts](../../../src/data/fcs/wool-domain/commands.ts)，`resolveCommandRetry`，239 行 | 根据命令标识、类型、目标、载荷检查重复提交 | 可复用到自动四记录和阶段交接，无需新增通用队列 |
| 同文件，`addWoolYarnReceipt`，455 行 | 可直接向毛织账追加纱线实收及入库，不必经统一接收来源 | 与统一收货入口收口，避免两个可独立写入的接收来源 |
| 同文件，`addWoolProcessReport`，530 行 | 校验整数、必需纱线、150% 上限；追加填报和待交出仓入库 | 根据阶段生成相应对象；无外加工一起保存自动衍生记录 |
| 同文件，`addWoolHandover`，595 行 | 校验有效填报及可用库存；使用订单固定下游；记录单个下游确认状态 | 改为片／最终产物的行级目标与可分批实际接收引用 |
| 同文件，`confirmWoolDownstreamReceipt`，684 行 | 在交出记录中写单次下游确认与差异 | 不能承接多厂多次回货；改读权威接收明细汇总 |
| 同文件，`changeWoolFactQty`，1066 行 | 统一收货投影不能直接覆盖；填报不得低于已交出／超过150%；已确认交出不可改；库存不得负数 | 保留防错，扩展自动衍生链、外发片及缝盘已使用量的限制 |
| 同文件，`completeWoolWorkOrder`，1288 行 | 至少一笔正数交出即可完单；解除设备并冻结完成快照 | 新闭合门禁不能复用原宽松条件；解除设备仅横机阶段 |
| [store.ts](../../../src/data/fcs/wool-domain/store.ts)，29、865～905 行 | 旧键 `higood-fcs-wool-domain-store-v2`；无存储时重建 Mock；每次读投影统一收货；克隆、校验后一次写本地存储 | 升版本、清旧引用和生成路径；保留本地原子保存方式 |
| [mock-data.ts](../../../src/data/fcs/wool-domain/mock-data.ts)，`buildWoolFactWorkflowMockStore` | 旧多场景事实会在初始化重新建立 | 替换成两阶段新场景，不能只删浏览器数组 |

## 4. 技术包逐片工艺与路线

| 证据 | 已确认代码事实 | 影响及调整 |
|---|---|---|
| [pcs-technical-data-version-types.ts](../../../src/data/pcs-technical-data-version-types.ts)，191、205、346 行 | 逐片实例含片来源、颜色、尺码、序号及多条辅助／特种工艺配置 | 用户截图要求已有可承接的对象；无需从片名猜路线 |
| 同文件，375～432 行 | 工序具有路线对象、步骤／并行信息、输入输出对象、前置节点 ID、毛织任务类型等 | 对象归属及前置关系是路线解析依据，不能仅按名称排序 |
| [pcs-technical-data-fcs-adapter.ts](../../../src/data/pcs-technical-data-fcs-adapter.ts)，87、176 行附近 | 适配器已有逐片实例复制逻辑 | 修改应沿同一个技术包资料来源，避免毛织自己建工艺清单 |
| [production-tech-pack-snapshot-types.ts](../../../src/data/fcs/production-tech-pack-snapshot-types.ts)，27 行 | 快照纸样类型继承 `TechnicalPatternFile` | 不能认定快照类型完全没有逐片字段 |
| [production-tech-pack-snapshot-builder.ts](../../../src/data/fcs/production-tech-pack-snapshot-builder.ts)，401～454 行 | 用 `...item` 保留字段，并显式复制片行及工艺；未见逐片实例嵌套深复制 | 字段可能保留，但需补快照深复制和隔离契约，不能把对象展开误判为字段丢失 |
| [production-order-tech-pack-runtime.ts](../../../src/data/fcs/production-order-tech-pack-runtime.ts)，29～76 行 | 运行时克隆片行、路线前置关系，逐片实例缺少显式嵌套复制 | 测试读后修改不会污染绑定版本；新毛织提取消费正确实例 |
| [special-craft-task-generation.ts](../../../src/data/fcs/special-craft-task-generation.ts)，`resolveSpecialCraftRouteOccurrence`，224 行；需求生成434行附近 | 路线候选按工艺／对象匹配并寻找一个节点；片需求主要从片行工艺摘要与每件数量生成 | 明确片实例及工艺发生节点，防止同名多次工艺误匹配、不同片混合、按物料重复 |

## 5. 待接收、辅助／特种工艺与仓储

| 证据 | 已确认代码事实 | 影响及调整 |
|---|---|---|
| [routes-fcs.ts](../../../src/router/routes-fcs.ts)，394 行附近 | 毛织已有 pending-receipts 路由，调用共享 `renderFactoryPendingReceiptsPage` | 是改造现有功能，不是重复增加另一个无关联入口 |
| [pending-receipts.ts](../../../src/pages/process-factory/dyeing/pending-receipts.ts)，96 行附近 | 共享页主要区分 PRINT 与非 PRINT；毛织通过路径和自营毛织厂识别，非印花仍有染色专属单据／配置路径 | 显式传入毛织场景、阶段／对象分类和独立页面偏好 |
| [factory-receiving-types.ts](../../../src/data/fcs/factory-receiving-types.ts) | 物料类型为 FABRIC、ACCESSORY、YARN；物理计量为 Yard／kg，存在业务数量字段 | 新增毛织片业务类型／片单位，不填虚假称重字段 |
| [factory-receiving.ts](../../../src/data/fcs/factory-receiving.ts)，39、59、130、158 行附近 | 来源有效性、登记、实收保存、防重和分配均有现成逻辑；染色／印花有自己的投入约束 | 复用真正公共的收货事实；不要把单纱线／单上游约束套给毛织 |
| [factory-receiving-links.ts](../../../src/data/fcs/factory-receiving-links.ts)，`confirmFactoryMaterialReceipt` | 自营毛织厂分支要求 YARN 和称重；校验订单需要该纱线；可能回写原 PDA 交出记录 | 工厂与接收对象分开判断；外加工片走片身份和缝盘目标校验 |
| [factory-receiving-wool.ts](../../../src/data/fcs/factory-receiving-wool.ts) | 从 `OWN_WOOL_FACTORY` 的纱线实收投影；无演示单时会追加 `WOOL-RCV-DEMO-001` | 多工厂按目标过滤；删除旧演示补单路径，空集合必须安全 |
| [special-craft-task-orders.ts](../../../src/data/fcs/special-craft-task-orders.ts)，226 行附近 | 辅助、特种共用工艺单模型，有来源节点、前置关系、片信息、派工厂与明细进度 | 新毛织路径附着现有工艺单，不新增同类业务岛 |
| 同文件，`applySpecialCraftLineProgressAction`，2802 行 | 接收受计划限制，加工受实收限制，交出受已加工限制；明细键存在 SKU 退化匹配 | 毛织片必须明确明细身份，接收受合法来源余额约束，不能只按 SKU 匹配 |
| 同文件，`updateSpecialCraftTaskOrderWebStatus`，2595 行 | 更新任务状态和进度，随即调用统一仓储产物构建并同步来源任务 | 要收口为实际批次事实驱动，防止状态先变、仓储就出现未发生的事实 |
| 同文件，`ensureSpecialCraftUnifiedWarehouseArtifacts`，1774、1915～1966 行 | 出库投影部分使用任务级稳定 ID；已完结时把出库量写作接收方回写量 | 毛织多批次必须独立交出身份，接收量来自接收方，不能由完结推定 |
| [special-craft-operations.ts](../../../src/data/fcs/special-craft-operations.ts)，44～108 行 | 裁片默认源为裁床待交出仓、返回裁床厂；`mustReturnToCuttingFactory` 来自该默认值 | 毛织片分支按路线去下一厂／缝盘；保留普通裁片原规则 |

## 6. 裁厂、后道、任务及 PDA

| 证据 | 已确认代码事实 | 影响及调整 |
|---|---|---|
| [cutting-receipts.ts](../../../src/data/fcs/wool-domain/cutting-receipts.ts)，`listWoolPanelCuttingReceiptSources` | 部位毛织交至裁床待交出仓，且已确认实收后，生成 `WOOL-PANEL:交出ID` 来源；存在部位字段及片单位表达 | 只消费缝盘最终交出，补明确的部件身份与单位；不是横机逐片外发的接收口 |
| [post-finishing-return-source-adapter.ts](../../../src/data/fcs/post-finishing-return-source-adapter.ts)，310～344 行 | 遍历毛织交出，整件＋下游工厂＋有效产量会成为后道来源候选；已确认记录排除 | 增加缝盘最终交出和真实目标条件，避免横机外发提前进入后道 |
| [post-finishing-return-source-fact-bridge.ts](../../../src/data/fcs/post-finishing-return-source-fact-bridge.ts) | 后道来源读取毛织及工艺事实解析器 | 验证回货确认回写及重复来源，不能只改列表过滤 |
| [task-detail-rows.ts](../../../src/data/fcs/task-detail-rows.ts)，`buildWoolRows` | 毛织详情使用现有单／产出行生成任务明细 | 显示来源任务下两阶段，避免需求量双算 |
| [task-execution-adapter.ts](../../../src/data/fcs/page-adapters/task-execution-adapter.ts)，`syncWoolExecutionFact` | 毛织加工事实回到生产任务执行投影 | 横机完成不等于整个毛织任务完成，最终交付以缝盘为准 |
| [mobile.ts](../../../src/data/fcs/wool-domain/mobile.ts)，104～125 行 | 移动投影只有旧三状态，复用毛织动作与事实 | 增加阶段、接收对象和新状态；不另存移动状态 |
| [wool-pda-task-access.ts](../../../src/data/fcs/wool-pda-task-access.ts) | 按任务唯一毛织单及工厂验证可操作对象 | 阶段唯一身份必须贯穿扫描、候选、详情和提交 |
| [wool-pda-scan.ts](../../../src/data/fcs/wool-pda-scan.ts) | 按执行／接收／交出用途筛选，生产单多候选需选择；当前接收动作是纱线接收 | 缝盘回货接收加入同一入口；设备动作仅横机 |
| [pda-exec.ts](../../../src/pages/pda-exec.ts)、[pda-handover.ts](../../../src/pages/pda-handover.ts)、[pda-wool-fact-execution.ts](../../../src/pages/pda-wool-fact-execution.ts) | PDA 已调用毛织动作和共享事实，执行与交接分工已存在 | 扩展阶段并收口旧显示，不从零搭建新移动应用 |

## 7. 页面与样式复用

旧 `src/pages/process-factory/wool/work-orders.ts`（基准 HEAD 的历史文件，实施版已删除） 已使用标准列表控制器；旧字段重点为单号、生产单、款式、类型、数量、纱线摘要、设备、状态和计划完成时间。旧 Tab 与本次六入口冲突，应按用户要求替换。

染色参考 [order-list-columns.ts](../../../src/pages/process-work-orders/order-list-columns.ts) 中的染色列组织；时间参考 [dye-work-order-times.ts](../../../src/data/fcs/dye-work-order-times.ts) 与 [work-order-times.ts](../../../src/pages/process-factory/dyeing/work-order-times.ts)：已有单据创建、上游接收、加工生产、下游交出四组，按实际事件展示首次／最近／笔数，明确不用更新时间猜事件时间。

可复用标准表格、筛选、分页、列设置和时间展示思路；不可复制染色专属数据限制、专属工艺节点、批量打印动作或单一投入假设。毛织时间构建应读取毛织自己的阶段事实。

## 8. 检查与基线冲突

以下为实施时相关检查入口，本次未运行，不能视为通过：

- `check:wool-fact-workflow`、`check:wool-handover-printing`、`check:wool-internal-style-code`。
- `check:wool-pda-single-execution`、`check:knit-aux-special-pda-single-fact`、`check:wool-warehouse-unified-model`。
- `test:wool-fact-workflow:e2e` 及相关 `tests/wool-*.spec.ts`。
- `scripts/check-new-demand-wool-entry.ts`、`scripts/check-wool-panel-cutting-sewing-acceptance.ts`、`scripts/check-wool-panel-current-whole-bag-acceptance.ts`。

旧 `check-wool-fact-workflow.ts` 包含 READY／NOT_READY／COMPLETED 统计、150% 数量、历史完成快照等契约；PDA 检查假设旧单据及旧动作集。应逐条判定保留、修改或删除，不通过修改检查器、页面基线哈希来绕过新需求。

当前源代码审查能确认需要修改的位置；不能据此确认端到端已闭合、图片完整或性能达标。实现证据须在最后一次代码修改后重新生成并进入矩阵。

## 10. 实施前复核与差异结论（2026-09-18）

- 已核对隔离工作树分支及 HEAD 与本记录一致；未吸收主工作区其他改动。正文保留为设计前基线，不把已退役的旧模型描述成当前实现。
- 本记录列出的单阶段身份、部位必填、单一下游、三个状态入口、旧接收和旧 Mock 补单等均为本次替换对象。
- 实施确认共享接收原先主要处理面料、纱线和辅料，因此毛织片须有独立对象与片单位，沿用同一来源／实际接收账。
- 实施对抗核查补出跨模块问题：generic 毛织片工艺生成与新逐片任务重复；PDA 汇总跨单位相加；最终裁厂来源未隔离目标厂；最终成衣工艺接收未从缝盘实交导入。处理与证据见后续审查记录及需求矩阵。
- 当前源码已与本节之前的行号发生变化，实际实现绑定见需求矩阵。

## 11. 实施中新增核查与修复

- **缝盘完单**：实际 Web/PDA 回放暴露完单统一调用横机设备释放的问题；现仅横机执行设备释放，缝盘交出与直接下游实收闭合后独立完单。专项及两种 PDA 尺寸回放见 `tests/wool-stage-actions.spec.ts`。
- **待接收导出**：合法 0 数量不再输出空白；纱线实发以页面同口径净重 kg 导出，回货片保持片。工艺厂片接收导出保留 `woolCraftOrderId`，不误写为备料；实际 CSV 下载回归已覆盖。
- **最终成衣工艺 PDA**：待接收入口按实际缝盘交出批次进入；12件、8件两批，实收首批后另一批继续待接收，刷新保留；不冒用外发片身份或虚构扫码事实。
- **读路径性能**：逐片工艺查询改用已冻结的同版本事实快照，一次归集接收数量，避免逐片重复克隆整份接收账。写操作仍保留独立克隆、校验及提交。
- **仓储防御副本**：当前毛织工艺派生行均为标量与字符串数组，复制记录、图片、关联数组和 ID 集合，减少通用深复制成本；不缓存“已安装库存”，保留每次查询从实际事实重装。递归污染和通用仓储快照恢复反例通过。
- **PDA 交接查询**：两处只读查询复用冻结毛织快照；实际 PDA 接收命令仍建立可写草稿，保存后新 revision 立即读取新实收数量，非毛织交接不变。
- **PDA 待办**：依据实际横机／缝盘身份和允许动作区分纱线、外加工回货片、自动同步等待。对抗式审查发现的“缺逐片资料误提示等待同步”已修正；仅在没有可执行动作时提示核对技术包，不封锁其他有效 SKU 的操作。
- **固定演示初始化**：后道固定 Mock 的命令及数据量不变，仅合并重复持久化，保存失败回滚原内存与存储；普通操作仍即时保存。实际对照及失败注入记录见 `evidence/performance-changes-adversarial-review.md`。
- **验证边界**：89项操作已建立5样本测量；冷启动和全部受影响入口仍按硬门禁核查，不用业务专项通过替代总体验收。
