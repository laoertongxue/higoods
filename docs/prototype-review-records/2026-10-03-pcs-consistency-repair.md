# PCS 一致性修复原型审查记录

## 2026-10-03 用户接受与 main 发布授权

用户在收到四页加载明细、完整验证结果及既有全局检查问题后回复：“先这样吧，感觉还行。本地合并进 main，并推送至github main”。本次按该明确回复接受当前版本并执行发布。

性能例外仅限印花加工单列表、染色加工单列表、染色待接收页、PDA接单页的首次加载及整页刷新，上限≤1000ms；实测最大值依次为590.1、549.8、516.2、507.2ms。其他页面、菜单切换、保存及确认继续按<500ms判定。原始超时样本保留，例外不扩大到其他场景。

最终源码与上轮验证清单117文件逐项SHA-256一致，发布前只补充本节验收记录。574项单测及构建、12组最终浏览器回归、PCS195加载样本（最大311.1ms）、FCS35菜单样本（最大425ms）通过；FCS120加载样本按上述明确例外通过。产品确认人：用户；确认版本：本次main发布提交（基于cf199e58的本轮完整工作区）。

全量TypeScript5项既有问题及全局5条织带菜单路由缺失仍保留；技术收据维持implemented，不伪造为verified。用户授权按已披露的当前结果发布，不代表这些范围外问题已修复。下方持续更新记录保留此前未获授权时的真实状态；本节是本轮最终验收口径。

## 1. 基本信息

日期：2026-10-03；模式：完整产品审查；系统：PCS、关联 FCS/PDA。
角色：买手、版师、花型与调色人员、跟单、加工及仓储人员。
目标：完成状态有成果支撑，技术包缺项不可新发布，当前来源真实可追溯，保存与上下游一致。
基线：main / cf199e58a48923820ba4ab72273874d2ade7909b，工作区 /Users/laoer/Documents/higoods。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：专业完成/技术包发布门禁、历史来源说明、样衣表格与图片对应、浏览器数据保存/迁移/错误提示和关联加工交接均影响用户操作结果。
- 审查基线：AGENTS.md 第 4、5、7 节，以及 §2.4 存储与 §3.1 需求追踪。追踪矩阵：docs/product-design/pcs-consistency-repair/修复方案与追踪矩阵.md。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 沿用现有页面与职责，本机数据面板说明同浏览器边界 |
| 文案、状态、数量与单位 | 通过 | 父任务不再强制终态；历史发布显式待补齐；样衣不把测款关联冒充实物来源 |
| 扫码、真实图片与对象识别 | 通过 | 样衣、专业成果、商品与技术包大图以及加工条码均有当前工作区证据；详见追踪矩阵及FCS交互覆盖 |
| 防错、危险确认与主管兜底 | 通过 | 发布/完成在仓储入口阻断，迁移清理前需确认关闭旧页面，导入禁止覆盖非空目标 |
| 交接、跨端事实与异常追溯 | 通过 | 改款染印、混合收料、交出实收和PDA完成已五轮验证，失败无半单且刷新同事实 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | PCS1366/1280及PDA390×844功能通过；四页加载按用户明确接受的≤1秒例外通过，其他场景保持<500ms |
| 命名路由、交互、图片大图与打印 | 通过 | 打印及交互通过；FCS菜单35次最大425ms；四页加载按本次授权例外通过，原始慢样本保留 |

## 4. 问题标签

- 协作断裂
- 追溯不足

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 父子终态与技术包齐备不一致 | 追溯不足 | 专业/跟单 | 取消无成果终态与新增仓储门禁；保留历史发布事实并警示 | 待最终页验收 |
| 旧项目来源混淆 | 追溯不足 | 商品/样衣 | 当前关联与历史待确认分开表达 | 待最终页验收 |
| 多对象保存可能部分成功 | 协作断裂 | PCS/FCS | 同库记录事务与版本、Blob引用、迁移核验 | 当前核心故障契约通过，页面仍待验收 |
| 初始直达印花失败与冷启动超限 | 协作断裂 | 加工/商品 | 已修复共享初始化；BOM基线批次序列化后315项列表加载通过 | 全入口尚待收口 |

## 6. 最终结论

结论：通过

按2026-10-03用户明确接受的四页加载例外，本轮范围内验收通过。保留已披露的范围外检查失败与原始性能数据；发布结果另以GitHub及Vercel精确提交回执为准。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/factory-receiving-links.ts`
- `src/data/fcs/production-demand-early-process-work-orders.ts`

- `src/pages/process-factory/dyeing/work-order-overlays.ts`

- `src/data/pcs-record-position.ts`
- `src/pages/print/print-preview.ts`
- `src/data/pcs-exchange-rate-config.ts`
- `src/data/fcs/mobile-execution-task-index.ts`
- `src/data/fcs/design-revision-pcs-command.ts`
- `src/data/fcs/design-revision-pcs-storage.ts`
- `src/data/fcs/design-revision-process-work-order-adapter.ts`
- `src/data/fcs/dye-work-order-online-domain.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/factory-receiving.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/process-order-task-links.ts`
- `src/data/fcs/pda-start-link.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `src/data/fcs/supplement-print-prerequisite.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-engineering-bom-repository.ts`
- `src/data/pcs-engineering-file-upload.ts`
- `src/data/pcs-engineering-master-repository.ts`
- `src/data/pcs-engineering-master-sampling.ts`
- `src/data/pcs-engineering-master-view-model.ts`
- `src/data/pcs-engineering-purchase-linkage.ts`
- `src/data/pcs-engineering-task-upload-repository.ts`
- `src/data/pcs-live-testing-repository.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-project-inline-node-record-repository.ts`
- `src/data/pcs-project-relation-repository.ts`
- `src/data/pcs-project-repository.ts`
- `src/data/pcs-project-technical-data-writeback.ts`
- `src/data/pcs-record-bootstrap.ts`
- `src/data/pcs-record-db.ts`
- `src/data/pcs-record-runtime.ts`
- `src/data/pcs-engineering-pattern-result.ts`
- `src/data/pcs-sample-management.ts`
- `src/data/pcs-sku-archive-repository.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-tech-pack-review-notification-repository.ts`
- `src/data/pcs-tech-pack-version-activation.ts`
- `src/data/pcs-tech-pack-version-log-repository.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-view-model.ts`
- `src/data/pcs-testing-order-repository.ts`
- `src/data/pcs-video-testing-repository.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/main.ts`
- `src/pages/pcs-engineering-master-detail.ts`
- `src/pages/pcs-engineering-master-list.ts`
- `src/pages/pcs-engineering-tasks.ts`
- `src/pages/pcs-engineering-tasks/color-task.ts`
- `src/pages/pcs-engineering-tasks/first-sample-task.ts`
- `src/pages/pcs-engineering-tasks/master-task-common.ts`
- `src/pages/pcs-engineering-tasks/pattern-task.ts`
- `src/pages/pcs-engineering-tasks/plate-making-task.ts`
- `src/pages/pcs-engineering-tasks/purchase-task.ts`
- `src/pages/pcs-engineering-tasks/tech-pack-task.ts`
- `src/pages/pcs-independent-sampling.ts`
- `src/pages/pcs-local-data.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-technical-data-tech-pack-list.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/pcs-testing-order-create.ts`
- `src/pages/pcs-testing-order-detail.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-task-receive.ts`
- `src/pages/process-factory/dyeing/barcode-dialog.ts`
- `src/pages/process-factory/dyeing/events.ts`
- `src/pages/process-factory/dyeing/output-documents.ts`
- `src/pages/process-factory/dyeing/pending-receipts.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/dyeing/yarn-shipments.ts`
- `src/pages/process-factory/printing/dispatch.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/shared/web-status-action-dialog.ts`
- `src/pages/production/events.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/core.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/webbing-specification-dialog.ts`
- `src/router/route-renderers.ts`

### 页面路由

- `/pcs/testing/orders`、`/pcs/testing/orders/create`、`/pcs/testing/orders/:id`
- `/pcs/production-preparation/orders`、`/pcs/production-preparation/orders/:id`
- `/pcs/production-preparation/design-revision`、设计改款详情及专业成果详情
- `/pcs/production-preparation/artwork`、`color`、`plate-making`、`first-sample`、`display-sample`、`purchase`、`tech-pack` 及适用详情
- `/pcs/technical-data/tech-packs`、技术包详情
- `/pcs/products/styles`、`specifications` 及详情
- `/pcs/samples/inventory`、`application`、`transfer`、`return`、`ledger`、`ledger/stocktake`、`view`、`detail/smp-001`
- `/fcs/craft/printing/work-orders/:id`、关联染色/收货/交出页、PDA 接单/执行/交接
- `/fcs/production/changes`

### 验证命令

- `npm run build`：通过，最终574项单测及构建通过。
- `node output/playwright/pcs-consistency/final-regressions.mjs`：通过，12组最终浏览器回归均退出0；PCS13列表195样本均<500ms，最大311.1ms；迁移、附件、失败恢复及并发报告也已核对passed。
- `node output/playwright/pcs-consistency/fcs-final-loads/run.mjs`：失败，12页面120加载样本无页面异常，但四页共15样本≥500ms，最大590.1ms，未获得例外授权。
- `node output/playwright/pcs-consistency/fcs-final-loads/navigation.mjs`：通过，7个真实菜单入口35样本均<500ms，最大425ms。
- `node --import tsx scripts/check-pcs-sample-source-history.ts`：通过，历史与当前来源契约。
- `npx tsc --noEmit`：失败，仍为5项范围外既有错误（factory-receiving-source-sync、PMS采购两文件）；本轮工程渐进检查通过。
- `npm run workflow:verify`：失败，收据implemented；全局菜单仍有5条既有织带路径缺少精确路由。治理收据不替代浏览器性能门禁。

### 真实图片验证

样衣 smp-001 使用 `/dress-sample-1.jpg`，已实际查看为深蓝纯色无袖连衣裙，名称/颜色同步，历史SKU编号不改写。样衣8路由1366/1280与160项查询/详情/大图交互通过；补充入口见sample-source记录，其他模块仍按命名场景补验。

### 例外

- 无性能豁免，所有适用项仍按 <500ms 判定。
- 未关联本轮动作的其他模块未整体迁移；不得把本次局部修复表述为全站存储已治理。

### 已补齐的直接证据

- `runtime/ui-save-preview-result.json`：测款选择、配额失败保留输入、重试成功与刷新，5次；最慢74.4ms。
- `artwork-flow-result.json`：开始、空成果阻断、两明细四文件上传、整单提交、审核、刷新2/2，5次；最慢80.1ms。
- `local-data-ui-result.json`：展开、空间、导出、无引用回收、拒绝覆盖、空浏览器恢复及刷新，5次。
- `purchase-linkage/result.json`：读取不写、失败无半保存、采购事实作废只读投影、解绑后刷新；头部与摘要同步补丁后已复核通过。
- `tests/pcs-record-create-scope.spec.ts`：新建测款只保存关联款式/测款及元数据共4条，刷新前后记录完全一致。
- `details-performance-final.json`：13类详情冷启动/刷新各5次，130项通过；站内详情导航65项已通过，全入口尚需补证。
- `tests/pcs-design-revision-result-storage-and-binding.spec.ts`：增加BOM编号跨刷新一致、无重复方案断言，通过。

本轮全入口性能尚未完全覆盖，故结论仍为“不通过/未完成”；不得把构建或技术收据通过替代该门禁。

技术包列表输入丢失已定位为重复状态/渲染入口，统一后专项145交互及15加载已通过。205条旧记录第二批中断后恢复、无重复及最终清理已通过，证据 `runtime/migration-recovery-result.json`。13类详情入口65项导航均已通过；全交互覆盖仍在收口。

专业列表1035项交互通过（最大40.5ms）；技术包列表修复后145交互+15加载通过；纸样/首单样衣185项上传、提交、替换、预览与刷新通过。已修复纸样校验提示重绘丢失和专业大图关闭事件不在根节点的问题。关联FCS/PDA其余入口仍在补验，整体状态不变。

- 最终反向审查补齐纸样成果版本 `higood:pcs:engineering-pattern-results:v1`（第14旧键）：按 resultVersionId 保存，与任务完成同事务；新版本追加不重写历史版本。`pcs-pattern-result-atomic-storage.spec.ts` 实测配额失败回滚、原输入重试、刷新与两版本独立记录通过；`runtime/migration-pattern-result.json` 验证旧纸样与旧上传共用一个 Blob、10条记录、旧源核对后清理。最终纸样40操作样本最大65.3ms。
- 测款直播保存及大货是/否/待定40个操作样本均通过并刷新核验；调色90个要求/上传/提交/审核/大图样本通过，最大64.2ms。见 testing-flow-result.json、color-flow-result.json。

- 设计改款完整UI创建、修改、替换设计图、提交、基码纸样及展示样衣提交五轮50样本通过，最大65.4ms，45次持久化动作均刷新读回；当前流程无额外审核入口。证据 design-revision-ui-write/measurements.json、coverage.md。


### 最后补验发现及处理

- 商品档案不再用退役 SKU 旧键决定读取路径。永久回归 `tests/pcs-product-archive-idb-summary.spec.ts` 已通过：IDB 实际6个规格、旧聚合777时显示6且提示映射冲突；禁用 localStorage 后相同结果。商品档案初始化独立于生产旧源检查，生产准备等依赖生产事实的页面保留原初始化。历史物料、汇率及项目/测款静态基线读取补充存储访问保护，不代表这些无关维护模块已迁移。
- 印花 PDA 领料与 PRINT/START 阶段记录合并同一事务；特定阶段写入配额失败后全库记录不变，原输入重试成功，刷新后领用和产出各20 Yard。4入口20样本通过，最大143.2ms。
- 染色 PDA 后处理由同厂既有操作员完成，10入口50新样本通过，刷新待交出；管理员阻断保留既有权限，修正文案为染色。
- 印花卷码模板改为独立加载，避免无关毛织初始化；冷刷新独立读取PCS记录已通过；单卷/批量预览及未入库卷下架阻断共15样本通过，最大162.5ms。
- 双标签页前置冲突原先只抛错，部分页面保输入但未提示本次未保存；已补统一通知，真实双标签页5轮复验通过，详见下条。

- 双标签页真实UI5轮通过：保存最大51.7ms、冲突提示最大33.6ms；未保存输入保留，刷新后直接读回IDB直播备注仍为首个标签的值。证据 `multi-tab-result.json`。

- 受影响治理收据已运行：`task-receipt.json` 当前为 implemented，唯一检查阻断为全局 menu-routes 的5条既有织带菜单缺少精确路由。对应菜单/四个路由注册文件均与HEAD相同；PCS专项菜单检查通过。未修改无关织带路由，也未将收据改成 verified。最新构建573单测通过，全量TypeScript剩5项既有错误。

- 稳定记录排序位置：前插和单条置顶保留其他记录位置，不再因为数组序号变化整批写入。纯函数专项覆盖200个既有记录及插入/移动/删除；`pcs-record-write-scope.spec.ts` 实际IDB验证单SKU创建只4行（2业务+2结构），后续修改仅SKU行版本变化，冷刷新顺序与冲突一致。

- 稳定位置修复后的最新构建复验：13个PCS列表冷启动/刷新/菜单进入各5次，共195项，最大432.8ms；创建测款的配额失败、输入保留、重试及刷新5轮通过，最大70.2ms；双标签5轮保存/冲突通过，最大51.9ms。对应 page-performance-all-lists.json、runtime/ui-save-preview-result.json、multi-tab-result.json。

- 首次改款失败回滚补齐染色/印花缓存生命周期：未预先打开加工页时，原来只剩1张新染单，刷新才恢复23张；修复后失败重试前后与刷新均为23张。染色initialIds、印花待初始化队列与seeded状态同快照恢复。`pcs-design-revision-fcs-direct-read.spec.ts` 新增普通染单/印花基线不丢失断言，并再次通过冷详情、拒单刷新及冷打印。修复后573单测/构建通过，TypeScript仍为5项既有问题。

- 混合收料以同一有效工厂的改款染单与普通 DWO-013 为前提，经真实送货/扫码/复核UI完成5轮35样本，最大67.7ms。配额失败时IDB和原生收料原记录均保持不变，复核输入保留；重试后同一2行收据与两订单实收投影刷新一致。无证据要求扩大普通订单整包迁移。
- 染色条码入口全表查找会触发无关毛织校验；待交出维护条码、条码弹窗备用查询、查看/编辑弹窗均改为workOrderId限定读取，实际交互正在复验。

- 收料后完整染色列表回归已修复：普通面料实收原先无条件初始化毛织演示，导致毛织初始化标记与共享收料事实不在同一保存范围；现在仅毛纱/毛织片收料读取毛织业务，不削弱数量校验。四个独立浏览器阶段（接单、调拨、实收、完成生产）刷新均正常显示30条染色单，见 fcs-final-loads/dye-phase-result.json。永久 pcs-design-revision-fcs-direct-read.spec.ts 新增非毛织实收不写毛织事实、最终完整染色列表刷新断言，并通过。
- 提前染印验收场景的构造改为内存暂存，不再在打开列表时通过业务修改入口保存演示状态；实际创建/取消的保存不变。early-process-persistence.test.ts 验证已读取基线后补齐验收场景不写执行快照，并以三个进程验证实际创建、取消及刷新；相关13项契约通过。本证据不声称无关FCS历史演示模块全部迁移。

- 实收冷刷新丢失回归：染色交接头存于执行记录 demoHandovers，印花对应 designRevisionHandovers；共享实收覆盖只有交接记录编号，原归属选择遗漏。现从已归属订单/任务的这两类交接包提取头及记录编号，实收覆盖、历史与完成记录进入PCS事务。design-revision-pcs-storage.test.ts 已验证三类记录保留、普通记录排除、原生源不变及暂存结束后读回20；真实染色交出/PDA五轮复验进行中。

- 同一实收问题还存在上层保存分支遗漏：runFormalHandoutAction 对改款染色直接返回内存动作。已增加已保存改款交接头的冻结来源校验（原单/任务/工厂/来源快照），并纳入正式保存与读取、记录编号筛选；不制造生产单、不扩大无关来源权限。完整刷新证据以随后 dye-dispatch-result.json 为准，原失败另存 dye-receipt-missing-formal-save.json。

- 冷恢复事实优先级已修正：正式交接集合已保存20 Yard实收时，染/印执行记录里的旧交出副本不能覆盖它。恢复改款交出原件时先加载正式交接事实，同recordId与handoverId已有记录直接保留；真正业务修改及普通演示保持原入口。染色实际交出、实收、冷PDA、配额失败与人工完成单轮15项已通过，五轮结果待最终汇总。

### 最终源码复核（加载门禁仍待结果）

- 加工/PDA 功能入口已收口：84 个独立交互入口各至少五轮，共 420 个去重样本；完整原始记录见 `output/playwright/pcs-consistency/fcs-ui-acceptance/coverage.md`。染色实际交出、实收、冷 PDA、配额失败与重试完成五轮，最大79.6ms；印花 PDA 完成在恢复优先级修复后重跑五轮，最大171.1ms。
- 只读性能优化覆盖项目身份/节点、物料/SKU、商品与历史成本记录，先筛选再复制对外结果；调用方修改结果不污染原数据，见 `pcs-read-isolation.test.ts`。加工桥接只读字符串缓存限定四个集合，每次仍检查原生源和 PCS 覆盖，源变化、回滚和读取抛错契约均通过。
- `npm run build` 最终574项单测通过。未改变构建配置、技术栈或页面业务数量/来源规则。所有历史慢样本保留；尚未收到性能例外授权，继续按每个样本<500ms判定。

### 最终构建的 FCS 加载实测

管理端1366×768，PDA390×844；浏览器隔离上下文，恢复真实记录与Blob，不预热模块；每页冷启动、刷新各5次。源代码含本轮最终只读优化，详细原始数据：`output/playwright/pcs-consistency/fcs-final-loads/result.json`。

| 页面 | 样本 | 最大ms | ≥500ms样本 |
|---|---:|---:|---:|
| print-list | 10 | 590.1 | 5 |
| dye-list | 10 | 549.8 | 5 |
| print-detail | 10 | 432.8 | 0 |
| dye-detail | 10 | 435.2 | 0 |
| print-pending | 10 | 433.2 | 0 |
| print-documents | 10 | 395.1 | 0 |
| dye-pending | 10 | 415.4 | 0 |
| dye-documents | 10 | 393.8 | 0 |
| dye-receiving | 10 | 516.2 | 4 |
| pda-receive | 10 | 507.2 | 1 |
| pda-print | 10 | 449.9 | 0 |
| print-label | 10 | 399.7 | 0 |

以上120样本均无页面异常；其中15个加载样本超出默认门禁。已提出仅四个页面首次加载/整页刷新的≤1秒例外询问；截至本记录尚无授权，因此仍判定PERF-001未通过、总体未完成。历史慢样本存于同目录result-before-*.json，未删除或筛除。

- 最终 FCS 菜单进入：从 PFOS 裁床生产进度页真实展开工厂分组再点击目标菜单，7页×5次共35样本通过，最大425ms。源页面位于同一工厂运营菜单体系，没有提前导入目标页面。最初脚本误从FCS平台菜单查找PFOS入口，定位失败不计有效性能样本。

### 本轮最终复验与边界

- 最后实质修改后，`final-regressions.json` 中12组检查均通过：195个PCS列表加载/刷新/站内切换样本最大311.1ms；改款文件与冷直达FCS、纸样原子提交、SKU单记录写入、档案IDB数量、三类迁移、数据导出恢复、保存失败重试和双标签冲突均重放。
- 工作树仍为 `/Users/laoer/Documents/higoods`，main基线cf199e58；本地仅main，远程跟踪仅origin/main；没有创建分支/工作树、提交、推送或部署。局域网生产准备页 `http://192.168.5.2:5173/pcs/production-preparation/orders` 返回200。
- 全量TypeScript的5项既有错误与全局菜单5条织带缺失没有吸收入本次范围。当前五类问题的实现与功能证据已具备，但四页加载仍不满足默认性能门禁，故总体保持“未完成”。
- 全站禁用localStorage并不代表所有无关模块可用：本轮PCS记录可独立工作，但依赖原有正式生产来源初始化的入口仍可能因无法核查旧源而阻断；没有绕过该来源保护或宣称全站迁移完成。

### 发布环境测试进程修正

首次提交bc78992c的Vercel构建停在Node测试阶段。隔离复现表明：缺少Chromium时，新浏览器契约先启动HTTP服务再启动浏览器，启动失败未进入finally清理，测试进程不退出。两项真实浏览器契约移至tests/browser-contracts，通过`npm run test:pcs-storage-browser`独立执行；部署构建执行572项Node单测，完整本地发布验收仍执行572+2项，未删除或跳过浏览器存储断言。浏览器启动现在位于try/finally之内，缺少运行时立即报告失败并关闭HTTP服务。该修正只涉及测试组织与资源清理，业务源码未变化。

发布修正验证：`npm run build` 通过（572 项 Node 单元测试）；`npm run test:pcs-storage-browser` 通过（2 项真实浏览器契约），总计仍为 574 项。指定不存在的浏览器目录后，独立契约在 1 秒内以退出码 1 正确结束，明确报告浏览器可执行文件缺失，未残留阻塞进程。日志：`/tmp/pcs-release-build.log`、`/tmp/pcs-release-browser-contracts.log`、`/tmp/pcs-release-missing-browser.log`。本次仅调整测试执行位置和失败清理，不改变业务页面与存储行为。
