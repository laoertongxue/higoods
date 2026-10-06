# PCS R1 渠道实施核查与专项证据

核查日期：2026-10-05。范围：WP07 / WP08，`CHAN-001～019`、`SYNC-001～012`，以及直接相关的测款渠道上架、共享 WLS 来源、未保存提醒和渠道导入。

依据：[原型调整方案 §11、§12](./prototype-adjustment-proposal.md)、[实施与验证计划 WP07 / WP08](./implementation-and-validation-plan.md)、[原子需求矩阵](./requirement-traceability.csv)。本记录只补充实施证据，不改动总体矩阵状态。

## 1. 版本、执行范围与结论边界

- 工作目录：`/Users/laoer/Documents/higoods`。
- 分支：`main`；基准 HEAD：`88324f65506f47c678b17d1b51879f8fd7c2488a`。验证对象是该 HEAD 上当前未提交的共享工作区代码，不是已发布版本。
- Node：`v26.8.2`。所有本文件中的自动化结果均为 Node 环境，不操作用户浏览器、线上平台或数据库。
- 渠道规则专项：`tests/pcs-r1-channel-rules.test.ts`，34 项通过；覆盖条款对应关系见下表。另四份旧渠道专项已改为 R1 契约，合计 12 项通过；两个旧静态检查器也已更新并通过。
- 渠道性能专项：`tests/pcs-r1-channel-performance.test.ts`，2 项通过，包含 9 组重复测量。
- 页面按独立列表、详情、编辑组织；详情拆分为渠道内容、规格映射、价格、发布与同步、测款关联、记录。Node 检查只证明输出结构，不证明浏览器视觉、图片加载、真实交互与持久化完成。
- 本轮不能将整个 WP07 / WP08 标记为“已验证”。命名页面、设备、DOM/布局耗时、真实 IndexedDB 事务及刷新验收由主代理整合；`CHAN-014` 旧项目身份字段、规格库存占位和自动项目归属已清退，并补了直接回归。

## 2. 唯一事实源与入口

| 业务对象 | 实现与读取 | 变更入口 / 保存边界 | 旧源处理 |
|---|---|---|---|
| 渠道店铺 | `pcs-channel-store-repository.ts`：`getPcsChannelStoreSnapshot`、`listChannelStores`、`getChannelStore`；键 `higood-pcs-channel-store-v1` | `saveChannelStore`、`setChannelStoreOperatingStatus`；页面在 `runPcsRecordCommand` 内执行 | `pcs-channel-store-master.ts` 只从此处投影，保留旧店铺 ID 别名作为引用解析 |
| 店铺 PID / 外部规格实例 / 默认及覆盖价格 | `pcs-channel-catalog.ts`：`getPcsChannelCatalogSnapshot`、`listChannelListings`、`getChannelListing`、`listChannelVariants`、`resolveChannelPrice`；键 `higood-pcs-channel-catalog-v1` | 创建、内容保存、审核、映射、价格、复制、导入均由对应 repository 函数处理；当前页面持久动作由 `runPcsRecordCommand` 包裹 | `pcs-channel-product-project-repository.ts` 当前只读投影同一 catalog；旧项目写入口已拒绝执行，不维护第二份事实 |
| 同步操作 / 字段基线 / 回执 / 冲突 / 可售观测 | 同一 catalog 内独立对象数组；`pcs-channel-sync.ts` 与 `listChannelSyncOperations` | 提交、回执、部分重试、首次发布核实、平台变更、差异选择、WMS 来源同步均为显式业务动作 | 不接真实 API、自动轮询或离线队列；所有演示操作带 `demo: true` 并在页面明确标示 |
| 测款上架动作 | `pcs-testing-order-repository.ts`：`prepareTestingOrderChannelListing`、`completeTestingOrderChannelListing` | 选择店铺 / 新建或已有同款 PID，进入统一渠道编辑；通过准确 `testingOrderId + testingListingActionId` 查询结果 | 旧按渠道默认选店并自动上架入口拒绝执行；不改变生产准备的测款通过门槛 |
| WMS 可售 | `pcs-channel-wms-projection.ts`：`getChannelWmsAvailability`、`synchronizeChannelWmsAvailability` | 读取精确内部 SKU 对应的已有 WLS 演示来源；catalog 仅保留同步观测 | 无渠道库存表、手工库存输入、店铺预分量或反写 WMS |
| 旧渠道快照 | `pcs-channel-legacy-conversion.ts`：`convertLegacyChannelSnapshot` | 纯转换函数；由共享存储升级流程调用，普通读取不转换落盘 | 验证完整 SKU 映射，保留外部文本 ID，同 SKU 多实例不去重；转换不修改输入，重复输入结果稳定 |

`getPcsChannelCatalogSnapshot` / `getPcsChannelStoreSnapshot` 与 `resetPcsChannelCatalogCache` / `resetPcsChannelStoreCache` 已供公共初始化、刷新与失败回滚接入。轻量读取返回防御性拷贝；列表渲染的临时索引仅在一次渲染中使用，不成为新事实源。

本文件不以 repository 内的 `pcsRecordStore.setItem` 调用形式证明整包持久化合格或不合格；实际记录拆分、事务完成、失败回滚和文件引用由共用 runtime/codec 控制，必须按共享存储专项与浏览器证据独立验收。

## 3. 正向追踪：CHAN 全部 19 条

下表“规则证据通过”仅指本轮 Node 断言。除明确列出的未闭环项外，综合状态为“已实现待验证”，仍待命名页面、真实浏览器读写及性能验收。

| 条目 | 实际结果与实现位置 / 函数 | Node 专项证据 | 综合状态 / 尚待 |
|---|---|---|---|
| CHAN-001 | `pcs-channel-store-repository.ts`：`CURRENT_CHANNELS`、`CURRENT_MARKETS`、`isCurrentChannelStore`、`isChannelStorePublishable`；当前 Shopify、TikTok、独立站 / ID、MY，历史只读 | `CHAN-001/002/003/018 current scopes…`：当前 6 店 / 含历史 8 店；历史保存被拒绝 | 已实现待验证：新建选项、含历史页面 |
| CHAN-002 | `ChannelStore.salesCurrency` 与 `settlementCurrency` 独立，`saveChannelStore` / `saveChannelPrice` 分别使用；店铺列表、详情、编辑分别呈现 | 同上：MY 销售 MYR 与结算 CNY 并存 | 已实现待验证：保存及刷新后币种 |
| CHAN-003 | `ChannelStore.marketCode` 单值；店铺编辑一个市场选择项，不建设多市场工作台 | 同上：ID/MY 经营范围及一个店铺单市场数据结构 | 已实现待验证：店铺表单 |
| CHAN-004 | `createChannelListing`、`validateChannelMapping`、`saveChannelVariant`、`previewChannelImport`；父 `styleId` 固定，同 PID 全明细同 SPU；UI 候选限定已审核且启用的同款 SKU | `CHAN-004/005 new container…`；`CHAN-004/012 import grouping…`：新建、映射更正、导入跨款分别阻断 | 已实现待验证：选择器与保存错误回显 |
| CHAN-005 | `ChannelVariant.id` 为独立稳定实例身份；外部 `platformVariantId` 保留文本；创建时不拼造平台 ID，由相应回执写入 | `CHAN-004/005…`、`CHAN-012 historic imports…`、`SYNC-007/CHAN-005 incomplete or nontext…`：同内部 SKU 多行不合并，长文本 ID 不丢字符，无身份不报成功 | 已实现待验证：多个实例展示及首次发布 |
| CHAN-006 | `projectInheritedContent`、`saveChannelContent`、`applyStyleContent`、`writePlatformValue`；未发布且未覆盖字段继承基础，发布后冻结既有销售内容；平台正常变更形成本店覆盖 | `CHAN-006/007/008 store content…`、`CHAN-006 unpublished untouched…`：不串改另一店标题 / SPU；已发布不被基础改名直接覆盖 | 已实现待验证：应用基础内容、店铺覆盖标记 |
| CHAN-007 | `ChannelVariant.displayColor/displaySize/displayPattern/platformAttributeValues` 独立于 `internalSkuId`；`saveChannelVariant`、`writePlatformValue` | `CHAN-006/007/008…`：外部尺码改名不改内部 SKU 尺码 | 已实现待验证：规格表单与内部链接 |
| CHAN-008 | `ChannelContent.sizeChartSourceVersion`；`validateChannelContent` 检查同款实际技术版本；详情链接工厂尺寸技术来源，编辑选现有版本 | `CHAN-008 sales size chart source…`：实际同款版本可用、外款及不存在版本拒绝；输出含对应技术资料路径 | 已实现待验证：浏览器直达该技术版本 |
| CHAN-009 | `ChannelPrice.priceType` 分别保存 `retail/regular/live/wholesale/clearance`；`saveChannelPrice`、`resolveChannelPrice`；金额空值与 0 分开处理 | `CHAN-009/010/011 five price types…`；`SYNC-001 clearing an optional…`：日常价大于 0，未设置为 null，清空可选价可传播 | 已实现待验证：五种价格 Tab 视图与保存 |
| CHAN-010 | 默认价按店铺+内部 SKU+价格类型，覆盖价按平台规格实例；`saveChannelPrice`、`followChannelDefaultPrice`、`resolveChannelPrice` | `CHAN-009/010/011…`：默认调价仅跟随项变，覆盖实例保持 | 已实现待验证：恢复跟随和批量默认价保存 |
| CHAN-011 | `writePlatformValue` 对 `price.*` 只建立目标平台规格覆盖，保留 `origin: 平台` | `CHAN-009/010/011…`：平台改一实例价后默认调价不覆盖它、不扩散到其他实例 | 已实现待验证：平台演示改价反馈 |
| CHAN-012 | 创建与导入正式明细始终有 `internalSkuId`；`previewChannelImport` 精确返回错误行；`importChannelRows` 完整校验后才写入 | `CHAN-012 historic imports…`、`CHAN-004/012 import grouping…`、纯转换回归：缺映射、同 PID 不同款/标题、重复外部实例均阻断；不形成待匹配正式数据 | 已实现待验证：导入弹窗、失败输入保留与刷新 |
| CHAN-013 | `sourceTestingOrderId/testingListingActionId/testingReferences` 可选；`prepareTestingOrderChannelListing` / `bindChannelListingToTesting` 不要求开发项目或测款通过 | `CHAN-013/SYNC-011 test order selection…`：新建或同款复用统一记录，未发布不完成动作，后续生产通过门槛不变 | 已实现待验证：测款到独立编辑的真实导航 |
| CHAN-014 | 新 `ChannelListing`、创建接口、编辑表单无项目依赖；旧 `PcsProjectChannelProductRecord` / 投影的 `projectId/projectCode/projectName/projectNodeId` 及 `stockQty` 已删除；`resolveChannelProductRelationObject` 直接读 canonical 多规格；旧项目创建/完成函数拒绝执行 | `CHAN-014 legacy channel projection…`：旧投影无项目/库存字段，历史引用读取正确标题/状态/路由和 2 平台规格 / 1 内部 SKU；`upload-complete` 中旧入口不写项目也不写 catalog | 已实现待验证：历史引用浏览器显示；代码与 Node 契约已收口 |
| CHAN-015 | `saveChannelVariant` 更正同款 SKU 时要求原因，递增 `mappingVersion`、追加 `mappingHistory`；保留原始 `ChannelOrderReference` | `CHAN-014/015/016…`：缺原因拒绝，历史映射 2 版，原履约引用完全不变 | 已实现待验证：更正表单和刷新后的历史 |
| CHAN-016 | `listChannelAffectedOrders` 与规格映射 Tab 列出履约中引用、接单时 SKU / 版本，`route` 导向 OMS | 同上：保留旧快照、路径 `/oms/orders`；无订单变更调用 | 已实现待验证：OMS 导航；原型不代替真实订单处置 |
| CHAN-017 | `channelLocalDateToIso` 按店铺时区解析，`saveChannelPrice` 校验先后；`resolveChannelPrice` 清仓到期显示日常价 | `CHAN-017 clearance…`：Jakarta 08:00 转 UTC 01:00、过期回到日常价、结束早于开始拒绝 | 已实现待验证：日期控件及到期标记 |
| CHAN-018 | `setChannelStoreOperatingStatus` 只改经营配置；创建/发布校验经营范围，既有 PID 状态仍读回执；经营配置展示仍在售数 | `CHAN-001/002/003/018…`：停用后既有状态仍“在售”，新建拒绝 | 已实现待验证：二次确认、仍在售计数与处理入口 |
| CHAN-019 | `copyChannelListing` 生成新容器和实例，保留内部映射 / 合理初始内容，清空 PID、外部规格 ID、发布状态及成功时间 | `CHAN-019 copy…`：新草稿、外部 ID 空、所有内部 SKU 映射保持 | 已实现待验证：目标店选择、复制保存及刷新 |

## 4. 正向追踪：SYNC 全部 12 条

| 条目 | 实际结果与实现位置 / 函数 | Node 专项证据 | 综合状态 / 尚待 |
|---|---|---|---|
| SYNC-001 | `pcs-channel-commands.ts`：`synchronizePublishedChannelChanges`；`submitChannelSync`、`receiveChannelReceipt` 关联已审核当前内容及目标范围；普通已发布价格/规格变更可自动收取明确的演示回执 | `SYNC-001/002 normal two-way…`；`SYNC-001 clearing an optional…` | 已实现待验证：正常保存到回执呈现；演示不是真实 API |
| SYNC-002 | `receiveChannelPlatformChange` 正常字段自动合并，无每次人工采纳；`writePlatformValue` 只写目标渠道销售字段 | `SYNC-001/002…`、`SYNC-002/004 platform status-only…`、`SYNC-002/003 platform merge never approves…` | 已实现待验证：正常平台回传及状态反馈 |
| SYNC-003 | 字段共同基线比对；不同字段直接合并，同字段不同值生成 `ChannelSyncConflict`；`resolveChannelSyncConflict` 只处理选定字段，不放行别的未审核草稿 | `SYNC-003 concurrent…`、`SYNC-002/003 platform merge never approves…` | 已实现待验证：双方值/时间/来源和选择后传播 |
| SYNC-004 | 提交/字段版本与平台观测时间校验；迟到内容只记历史。首次创建已产生的外部身份即使内容版本晚到也保留，避免再次创建 PID；不覆盖较新内容 | `SYNC-004/005 late receipt…`、`SYNC-002/004 platform status-only…`、`SYNC-004/007 late first-creation…` | 已实现待验证：迟到回执历史与新内容同时可见 |
| SYNC-005 | `sourceOperationId`、`eventId`、`processedEventIds` 识别自身回传和重复事件，不再生成循环操作 | `SYNC-004/005 late receipt…`：自身回传操作数不增长、新内容不被覆盖 | 已实现待验证：回传演示与日志 |
| SYNC-006 | `retryChannelFailedItems` 仅取失败字段/目标，保留原已成功 PID、外部规格 ID；不支持项不能用重试伪报成功 | `SYNC-006 partial failures…`、`SYNC-008 unsupported…` | 已实现待验证：逐项错误、只重试失败范围 |
| SYNC-007 | 同操作重复提交复用身份；结果未知不重新创建。`verifyUnknownChannelOperation` 在同一操作接收核实回执；缺失或非文本外部身份不能成为成功发布 | `SYNC-007 first publish unknown…`、`SYNC-007/CHAN-005 incomplete or nontext…`、`SYNC-004/007 late first-creation…` | 已实现待验证：未知结果 → 核实 → 同 PID |
| SYNC-008 | `channelFieldSupported` 和字段白名单；不支持字段保留本地语义并呈现“不支持”，未获得相应成功回执不标一致 | `SYNC-008 unsupported…`：不支持项失败且禁止盲重试 | 已实现待验证：支持矩阵说明；真实平台能力另验 |
| SYNC-009 | `getChannelWmsAvailability` 以精确内部身份读取 WLS；`synchronizeChannelWmsAvailability` 向所有已关联外部实例发布同一来源观测；不累加为总库存 | `SYNC-009/010 same internal…`：100 / 100 / 100；`fixed shared SKU…`：现有 WLS 608 → 601，2 PID / 3 实例一致；精确 WLS URL 筛选测试 | 已实现待验证：WLS 源页与关联同步；Node 中模拟改变种子后已还原 |
| SYNC-010 | `recordSharedChannelAvailability` 仅保存观测值及 WMS 来源版本；平台 `inventory` 不在可写字段内，无反写 WLS 调用 | `SYNC-009/010 same internal…`、`fixed shared SKU…`：平台数量输入不生成库存字段、不改变权威来源 | 已实现待验证：观测值和 WMS 权威说明 |
| SYNC-011 | `getTestingChannelListingResults` 精确匹配测款单与上架动作；测款动作准备和完成读取统一 listing；复用同款 PID 追加独立动作引用 | `CHAN-013/SYNC-011 test order selection…`：另一动作结果为空、复用后可按新动作读结果 | 已实现待验证：准确回到测款原单及动作 |
| SYNC-012 | `renderChannelSyncPanel` 明示“原型演示回执，未连接真实平台 API”；所有固定示例使用演示身份、`demo`、回执记录；店铺独立站标明演示店 | `page structure…`、`fixed current prototype scenarios…` | 已实现待验证：真实页面可见文字；不声明真实连接或真实库存锁 |

## 5. 补充回归与性能

其他规则测试直接覆盖：普通读取不写业务数据；纯旧数据转换无副作用；独立列表/详情/编辑结构；页面无本机迁移/备份恢复控件和库存编辑器；读取优化后的对象不可变；无变化保存不制造版本；销售说明保留表格、列表、图片等展示语义并去除可执行属性；共享未保存提醒取消保留输入、确认仅丢弃尚未保存修改。

### 5.1 负载与测量方法

- 固定生成 2,000 个已发布 PID，每 PID 5 个平台规格，总计 10,000 个规格、10,000 条价格、10,000 条字段基线和 2,000 次同步操作。
- 测试夹具只存在 Node 测试内存中，不在普通浏览器初始化中整包落盘；结束后恢复测试前快照。
- 每组 5 次，以 `performance.now()` 测量完整函数返回，包括必要数据解析、计算和 HTML 字符串生成；每次断言业务结果。5 次样本的 nearest-rank P95 等于最大值，不把它伪称为有统计置信度的现场 P95。
- 独立 Node 门槛为每组所有样本 `< 500 ms`；此门槛不能替代浏览器“操作 → DOM/布局/图片/事务完成”的 `< 500 ms`，也不豁免页面导航门槛。
- `import-preview-100` 首次样本包含本轮安装快照后的首次解析；1,000 行样本在同一读取缓存已建立后执行，因此不可据数值判断 1,000 行普遍比 100 行快。

最终复跑结果：

| 场景 | 5 次样本（ms） | 最大 / P95（ms） | 结果 |
|---|---|---:|---|
| 冷列表读取 | 56.70 / 56.60 / 59.07 / 54.61 / 53.78 | 59.07 | 通过 |
| 热列表读取 | 21.71 / 19.08 / 19.60 / 19.01 / 21.89 | 21.89 | 通过 |
| 指定 PID 规格及价格读取 | 1.82 / 0.30 / 0.22 / 0.21 / 0.20 | 1.82 | 通过 |
| 2,000 PID 列表，20 行 HTML | 85.65 / 78.75 / 78.24 / 80.02 / 76.94 | 85.65 | 通过 |
| 2,000 操作同步工作台，20 行 HTML | 28.93 / 28.52 / 27.95 / 28.28 / 24.94 | 28.93 | 通过 |
| 按外部规格精确检索并生成列表 HTML | 79.34 / 90.61 / 93.09 / 77.94 / 84.85 | 93.09 | 通过 |
| 100 行导入预览 | 32.79 / 1.23 / 4.81 / 1.02 / 1.05 | 32.79 | 通过 |
| 1,000 行导入预览 | 5.59 / 1.23 / 1.17 / 1.17 / 1.09 | 5.59 | 通过 |
| 同 PID 下 1,000 外部规格预览 | 1.38 / 1.06 / 0.96 / 0.95 / 1.01 | 1.38 | 通过 |

专项确实发现并修复两处问题：列表原先逐单元格复制全 catalog，首次检测为 5,352.93 ms；同步工作台也重复复制全 catalog，加入大样本后检测到 519.80 ms。现改为 scoped reads 和一次渲染临时索引；同步工作台另限制每页 20 条记录。没有放宽阈值或移除失败场景。

### 5.2 重跑命令与证据文件

```sh
node --import tsx --test tests/pcs-r1-channel-rules.test.ts
node --import tsx --test tests/pcs-r1-channel-performance.test.ts
node --import tsx --test tests/pcs-channel-listing-upload-complete.spec.ts tests/pcs-channel-listing-image-migration.spec.ts tests/pcs-channel-listing-image-upload-validation.spec.ts tests/pcs-channel-product-listing-multi-instance.spec.ts
node --import tsx scripts/check-pcs-channel-listing-style-specs.ts
node --import tsx scripts/check-pcs-channel-listing-images.ts
npx tsc --noEmit
```

日志保存在当前机器：`/tmp/pcs-r1-channel-audit-tests.log`、`/tmp/pcs-r1-channel-perf-final.log`、`/tmp/pcs-r1-channel-tsc-audit.log`、`/tmp/pcs-r1-channel-legacy-tests.log`、`/tmp/pcs-r1-channel-check-style.log`、`/tmp/pcs-r1-channel-check-images.log`。本文件表格保存了最终性能数值；临时日志不作为长期唯一证据。

整体 TypeScript 检查退出码为 2。本轮最后一次读取到 7 条范围外诊断：`fcs/factory-receiving-source-sync.ts` 1 条、`pms/tmf-material-purchases.ts` 2 条，以及整合中的 `router/routes-fcs.ts` 4 个尚未导出的新页面渲染器。之前的 `pms/material-purchase-orders.ts` 两条已不在该次输出内。本轮输出未出现渠道、测款或本次 WLS 页面文件诊断。共享工作区由其他工作包继续整合，最终整体结果以主代理最后一次检查为准；这里不声明全仓库检查通过，不改范围外文件。

## 6. 页面与共享交互接入

| 页面 | 当前实现 | 本轮已证实 / 仍待证实 |
|---|---|---|
| `/pcs/products/channel-products` | `renderPcsChannelProductListPage`；分页、列设置、筛选、一行一 PID、批量动作 | Node 结构、筛选和 2,000 PID HTML 性能通过；设备布局待主代理 |
| `/pcs/products/channel-products/new`、`/:id/edit` | `renderPcsChannelProductEditPage`；新建店铺/款式与内容分 Tab；编辑内容/映射/价格分 Tab | 保存层校验及 dirty 行为通过；浏览器完整编辑/附件保存待主代理 |
| `/pcs/products/channel-products/:id` | `renderPcsChannelProductDetailPage`；6 个详情 Tab | 结构、来源链接、演示说明通过；真实图片/大图/导航待主代理 |
| `/pcs/channels/stores`、`/new`、`/:id`、`/:id/edit` | 店铺列表、独立详情、独立编辑；经营信息分 Tab | 经营范围、币种语义与停用规则通过；页面保存/刷新待主代理 |
| `/pcs/channels/stores/sync` | `renderPcsChannelStoreSyncPage`；20 条分页，展开一个刊登的逐项回执 | 2,000 次操作 HTML 性能通过；筛选、分页及回执按钮浏览器验收待主代理 |
| 测款单渠道上架 | `pcs-testing-order-detail.ts` 选择店铺 / 新 PID 或已有同款 PID；统一编辑与来源结果 | 规则及门槛隔离通过；完整导航和回到原单待主代理 |
| `/wls/finished/stock-realtime?sku=SKU-GC-20001` | 现有 WLS 页仅加 URL 的精确 SKU 筛选 | Node 输出只含对应 SKU；真实页面与库存操作后的关联更新待主代理 |

`pcs-channel-products.ts` 与 `pcs-channel-stores.ts` 在模块初始化分别注册共享 `registerPcsUnsavedChanges('channel-products', …)` / `('channel-stores', …)`。不安装独立 `beforeunload`。取消离开保留输入，确认离开释放当前未保存媒体引用、清除表单，不修改已保存业务记录。主代理负责菜单、工作页签、返回和浏览器关闭的统一 guard 接入验收。

刊登媒体在保存前留在页面内存；文件类型/大小在登记前统一校验，登记任意待保存媒体即标为未保存。业务保存读取共享文件仓库；这里没有重新引入 Base64 业务持久化或维护工具。

## 7. 旧入口及未闭环事项

已收口：

1. `pcs-channel-product-project-repository.ts` 不维护旧 store，读取统一 catalog；旧项目建刊登、完成渠道项目节点、默认按渠道自动上架等写入口明确拒绝执行。
2. `pcs-channel-store-master.ts` 从统一店铺库投影；不并行维护第二组店铺身份。
3. `PcsProjectChannelProductRecord` 与旧投影删去四个项目身份字段；`ChannelListingSpecLineRecord/Input` 删去 `stockQty`。历史项目关联仅持有独立渠道引用，`pcs-project-instance-model.ts` 展示全部内部 SKU 和外部实例数量，不把首个 SKU 冒充整个 PID。
4. `pcs-project-relation-repository.ts` 取消从渠道商品反推项目、直播、视频归属；`pcs-project-data-consistency.ts` 取消旧渠道项目绑定审计，项目式渠道节点完成动作明确拒绝，其他模块节点规则保持。
5. 删除 `pcs-channel-listing-spec-utils.ts`。CodeGraph 核查其旧导出无调用；该死文件包含基于内部身份拼造上游规格 ID 的逻辑，不能继续留作误用入口。
6. 旧渠道快照通过独立纯转换函数承接，普通页面读路径不自动写入；媒体保留原主图标记 / 主图 ID、排序、文件引用、主图与详情图组。专项先复现两个错误，再修正。实际受控升级和原子落盘属于共享存储工作包。
7. 四个旧渠道测试不再断言项目节点创建、上传时本地造平台 ID、同店只许一 PID 或越南新刊登；现保留发布完成、媒体迁移/校验和多实例场景，改为 R1 正向与阻断断言。两个静态 checker 也改为独立刊登、真实回执身份、同款映射、媒体引用、审核门槛和独立页面。

仍待收口 / 不应误报为全部完成：

| 项目 | 当前事实 | 后续责任 / 验收 |
|---|---|---|
| 独立读回、事务、文件、并发、升级 | Node 规则调用内存镜像不能证明 IndexedDB 的事务完成、重开一致、多标签冲突或升级中断恢复 | 共享存储专项与主代理浏览器验证；不在这里以规则通过代替 |
| 页面 / 设备 / 性能 | 本轮未操作浏览器；没有 1366×768、1280×720 截图、图片加载和端到端操作时延证据 | 主代理命名页面验收后再更新总矩阵 |
| 外部系统边界 | OMS 只展示历史引用和进入链接；WLS 只读取已有来源；平台同步全部为明确演示 | 不宣称真实订单重绑、跨平台库存锁、真实平台 API 接通或线上业务已发生 |

## 8. 本工作包文件交付范围

以下文件是本工作包的实现或直接承接入口；共享文件只改列出的渠道片段，不认领其他工作包的已有差异。

| 类型 | 文件 | 本工作包范围 |
|---|---|---|
| 新渠道事实与行为 | `src/data/pcs-channel-catalog-types.ts`、`pcs-channel-catalog.ts`、`pcs-channel-store-repository.ts`、`pcs-channel-sync.ts`、`pcs-channel-commands.ts`、`pcs-channel-wms-projection.ts`、`pcs-channel-legacy-conversion.ts` | 刊登 / 外部实例 / 定价 / 经营店铺 / 同步 / 共享观测 / 纯升级转换 |
| 旧渠道适配 | `src/data/pcs-channel-product-project-repository.ts`、`pcs-channel-store-master.ts`、`pcs-channel-options.ts`、`pcs-channel-listing-spec-types.ts` | 同一事实源投影、当前渠道选项、退役项目写入口与库存占位 |
| 删除 | `src/data/pcs-channel-listing-spec-utils.ts` | 退役未调用的规格拼造工具 |
| 渠道页面 | `src/pages/pcs-channel-products.ts`、`pcs-channel-stores.ts`、`pcs-channel-ui.ts`、`pcs-channel-payouts.ts` | 独立列表/详情/编辑与分页工作台；既有提现视图从店铺页分离保留，店铺身份读统一来源；不新建结算能力 |
| 测款承接 | `src/data/pcs-testing-order-repository.ts`、`src/pages/pcs-testing-order-detail.ts` | 仅具体店铺 / 同款 PID 选择、统一渠道编辑、精确动作结果；生产准备测款通过规则保持 |
| 历史关联承接 | `src/data/pcs-project-domain-contract.ts`、`pcs-project-instance-model.ts`、`pcs-project-relation-repository.ts`、`pcs-project-data-consistency.ts` | 仅旧渠道类型字段、渠道关系解析、退役项目归属反推与渠道项目完成入口；其中非渠道的品类编号修改归主代理 |
| 既有 WLS 页 | `src/pages/wls/finished/stock-realtime.ts` | 只按 URL 中 `sku` 精确过滤现有事实，不改库存数据 |
| 新专项 | `tests/pcs-r1-channel-rules.test.ts`、`tests/pcs-r1-channel-performance.test.ts` | 34 规则与 9 组 Node 性能场景 |
| 已更新旧专项 | `tests/pcs-channel-listing-upload-complete.spec.ts`、`pcs-channel-listing-image-migration.spec.ts`、`pcs-channel-listing-image-upload-validation.spec.ts`、`pcs-channel-product-listing-multi-instance.spec.ts` | 12 条 R1 正向/边界断言 |
| 已更新检查器 | `scripts/check-pcs-channel-listing-style-specs.ts`、`scripts/check-pcs-channel-listing-images.ts` | R1 身份、页面和媒体契约，不再保留旧项目完成假设 |
| 实施证据 | 本文件 | 条目、函数、专项结果、性能和未验收边界 |

未修改总矩阵；`main.ts`、路由、公共 handlers、存储 runtime/codec/升级、共享离开提醒 hook 和内部商品新字段由主代理或对应工作包负责。`tests/pcs-project-node-instance-registry.spec.ts` 的混合项目测试由主代理接手。代码固定后，主代理仍须执行实际页面、图片、持久化和浏览器时延验收。

核查人：Codex 渠道工作包代理。业务方向和 R1 授权来自用户既有确认；本文件不构成用户产品验收回执、远端提交或发布证明。
