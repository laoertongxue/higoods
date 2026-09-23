# PCS 商品中心重构需求追踪与交付矩阵

## 0. 使用说明

| 项 | 内容 |
|---|---|
| 来源文档 | `PCS商品中心重构总体设计文档.md`（2026-09-22） |
| 实施计划 | `PCS商品中心重构实施计划.md` WP-01～WP-06 |
| 状态字典 | 待实施 / 实施中 / 已实现待验证 / 已验证 / 已阻塞 / 不适用 |
| 实现位置 | 「目标」表示计划绑定点；实施后必须回填实际符号，不得长期待绑定 |
| 证据 | 实施后回填；页面证据含路由与截图/日志路径 |
| 产品确认人 | 全部 85 条均为「用户（2026-09-23 确认）」：81 条=§12 A1–A5 + 当时矩阵 82 条；TEST-025～027 + GATE-001 由版本接受覆盖；`accepted` 证据=GitHub commit comment `1fce47c2` #commitcomment-201603472 |

**历史版本汇总（`1fce47c2`）**：条目总数 **85**；当时记录 `已验证 85`（CLEAN 12 + ARCH 12 + MAT 14 + TEST 27 + SAMP 14 + GATE 6）。产品确认人 **85/85** 均已确认（81 条历史确认 + TEST-025～027、GATE-001 随版本接受）。当时交付状态：**`delivered` + `accepted`**——功能提交 `f62108bd`，合并 `main` `1fce47c2`，`origin/main` 已确认；接受回执 https://github.com/laoertongxue/higoods/commit/1fce47c2e7845e05fb142d51b0d5d4f25782ed61#commitcomment-201603472（接受人 laoertongxue，2026-09-23）。该回执不自动覆盖后续修复版本。

### 0.1 后续修复增量（`codex/pcs-repair`）

基线 `28aae9b1` 的重新核查发现旧证据不能证明 MAT-010、TEST-004、TEST-011 在新版本真实可用。本增量按《PCS当前问题修复实施与核查》实施，以下状态只针对当前修复分支；原表保留为 `1fce47c2` 的历史记录。

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 当前实现位置 | 自动化验证 | 页面/性能验证 | 当前状态 | 证据 | 产品确认人 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MAT-010 | 设计 §5.3、§11-15 | 有物料 SKU 身份的草稿 BOM 行映射基础态变种，保留发布快照 | 修复-02 | `mapLegacyBomItemsToBaseVariants`、`getTechnicalDataVersionContent` | `tests/pcs-material-variant.spec.ts` PASS | BOM 命名页与性能待最终验收 | 已实现待验证 | `docs/prototype-review-records/2026-09-23-pcs-repair.md` | 待当前版本确认 |
| TEST-004 | 设计 §4.1、§11-4 | ①创建新 SPU/SKU/预计用料，或明确关联已有档案 | 修复-01 | `createTestingOrder`、`createPanelHtml`、`localizeProductFixtureImageUrl` | `tests/pcs-testing-order.spec.ts` PASS | 干净 origin 新建 TO-0006 核对款式/物料图片；全量存量图对应关系与完整性能待验 | 已实现待验证 | 同上 | 待当前版本确认 |
| TEST-011 | 设计 §4.1、§3.2 | ⑧创建本单渠道商品并回写档案，不借用别单记录 | 修复-01 | `createTestingOrderChannelProducts`、`pushChannelProducts` | `tests/pcs-testing-order.spec.ts` PASS | TO-0007 两渠道、币种、历史与刷新；性能待测 | 已实现待验证 | 同上 | 待当前版本确认 |
| TEST-024 | AGENTS §7.2、设计 §9 | 本次受影响页面加载与交互各有至少 5 个当前版本样本并满足门禁 | 修复-04 | 当前分支构建版浏览器验收 | 历史原始样本保留 | 2026-09-23 用户明确允许忽略印花 573.6ms 首样本及本次未补齐的逐项性能证据；仅本修复增量作为例外，不声称 `<500ms` 已通过 | 不适用 | `docs/prototype-review-records/2026-09-23-pcs-repair.md` 第 7 节 | 用户（2026-09-23 明确授权本次例外） |
| FCS-ENTRY-002 | 本次用户第 4 项 | 后道 QC Mock 从质检单号可回溯同源需求、生产单、演示技术包、来源任务和质检当前事实 | 修复-03 | `buildPostFinishingMockOverview`、`renderPostFinishingQcOrdersPage` | `check-post-finishing-qc-mainline.ts` 12/12 PASS | 构建版 `/fcs/craft/post-finishing/qc-orders` 点击 QC 和生产编号；已补齐 3 组需求/生产单/演示技术包、15 个 SKU 与主工厂；最终构建版 QC → 来源任务 / 生产单 → 需求回放通过 | 已验证 | `docs/product-design/PCS当前问题修复实施与核查.md` | 用户（2026-09-23 确认方向；待当前版本接受） |
| PRINT-LIST-001 | 本次用户第 2 项 | 印花列表八个业务列，时间和数量分列，选择列独立 | 修复-03 | `createPrintingOrderDisplayColumns`、`check-printing-two-end-list.ts` | 九个表头逐列断言 PASS | `/fcs/craft/printing/work-orders` 最终构建版九个表头复核通过 | 已验证 | `docs/染色印花加工单调整实施与验收.md` 2026-09-23 变更记录 | 用户（2026-09-23 确认八列） |
| IMG-AUDIT-001 | 设计 §14.3、用户自主搜索要求 | 284 个原型对象按品类、结构及颜色固定绑定图片，记录素材来源 | 修复-05 | `PCS图片素材逐项校对台账.csv`、`audit-pcs-archive-images.ts` | 284/284 当前 URL、来源与哈希 PASS；9 项明显错配已替换 | 95 项素材加载通过；款式/SKU/物料详情、失败与大图见审查 §8；性能按本次例外 | 已验证 | 图片台账、来源清单、审查 §8 | 用户确认自主搜索范围；Codex 验证，待当前版本接受 |

| TYPE-001 | 设计 §14.1 | 全量类型检查清零并保持停用入口阻断语义 | 修复-06 | `pcs-engineering-master-sampling.ts`、FCS 类型修正等 9 文件，详见审查 §8 | `tsc --noEmit` 0；417/417 单测及构建 PASS | 不适用：类型与不可达代码修正；可见关联结果由 TYPE-002 验证 | 已验证 | 审查 §8、`/private/tmp/pcs-final-tsc.log` | 用户要求修复；Codex 验证，待当前版本接受 |
| TYPE-002 | 设计 §14.2 | 连续余料只扣一次报废，下游印花绑定阻断直接截断 | 修复-06 | `tmf-material-purchases.ts`、`dyeing-task-domain.ts`、`tmf-process-continuation.ts` | 100→70→0、101/71 超量阻断、来源快照已绑定阻断回归 PASS | 不适用：数量/状态契约，无页面入口与布局变更 | 已验证 | `tmf-purchase-base-flow.test.ts`、`tmf-process-continuation.test.ts` | 用户要求修复；Codex 验证，待当前版本接受 |
| IMG-FILL-001 | 设计 §14.3-4 | 原型图片固定映射、旧 Mock 保守迁移、用户图保留及大图可用 | 修复-05 | `pcs-reviewed-image-catalog.ts`、档案仓储、QC 来源、产品/物料/QC 页面 | 4 项图片回归、284/284 审计 PASS | 命名路由图片加载/失败/大图/关闭/1280×720 验收见审查 §8；性能例外 | 已验证 | 来源 JSON、逐项 CSV、审查 §8 | 用户确认自主搜索范围；Codex 验证，待当前版本接受 |

---

## 1. 需求登记与交付证据（按编号联查）

### 1.1 CLEAN — 阶段① 清理（WP-01）

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实现位置（目标/实际） | 自动化验证 | 页面/PDA/打印/性能 | 状态 | 证据 | 产品确认人 |
|---|---|---|---|---|---|---|---|---|---|
| CLEAN-001 | 设计 §2、§4.6 | 商品项目模块菜单项从 PCS 菜单移除且无入口 | WP-01 | 实际：`src/data/app-shell-config.ts` `menusBySystem['pcs']`（删 `pcs-menu-projects`/workspace/live/video/packaging） | `check:menu-routes` PASS；`check:prototype-design-governance -- --all` PASS（29 user-visible, 1 record） | 冒烟侧栏无该项；性能不适用（入口删除） | 已验证 | `docs/prototype-review-records/2026-09-23-pcs-product-center-phase1-cleanup.md`；HEAD `5fdc7a4c`+工作树 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-002 | 设计 §4.6 | 商品项目全部路由（列表/详情/create）不再注册 | WP-01 | 实际：`src/router/routes-pcs.ts`（删 `/pcs/projects*`）；`src/pages/pcs-projects.ts`、`pcs-projects-list.ts` 删除 | rg 旧 path 路由 0 注册；`npm run build` PASS | 冒烟 `/pcs/projects`、`/pcs/projects/create` 未匹配（len≈200）；性能不适用 | 已验证 | 冒烟 `/tmp/pcs-smoke.mts` PASS；治理记录第 7 节 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-003 | 设计 §4.6 | 商品项目页面、仓储、种子、事件处理器删除且无引用 | WP-01 | 实际：页面 D；种子 `pcs-project-demo-seed-service.ts` D；`pcs-handlers.ts` 删 project/live/video handlers；共享 relation 仓储保留为生产准备依赖（计划风险行） | 修改后 spec 23 个 PASS；`npm test` 411/411；build PASS | 不适用（无项目页面）；生产准备冒烟 OK | 已验证 | `npm test` 411/411；治理记录；计划 §风险「生产准备依赖」 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-004 | 设计 §4.6 | 直播测款列表/详情路由与菜单删除；无用户可见入口（存储键 `higood-pcs-live-testing-store-v1` 记例外：生产准备 relation 只读历史投影依赖，无页面读写入口） | WP-01 | 实际：`src/pages/pcs-live-testing.ts` D；routes/菜单/renderer 0 引用；`pcs-live-testing-repository.ts` 仅被 relation/channel 投影引用 | rg `renderPcsLive*`=0；菜单 key=0；build PASS | 冒烟 `/pcs/testing/live` 未匹配；性能不适用 | 已验证 | 冒烟 PASS；治理记录第 6/7 节例外；`pcs-channel-product-project-repository`/`pcs-project-relation-repository` 只读引用 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-005 | 设计 §4.6 | 短视频测款列表/详情路由与菜单删除；无用户可见入口（存储键 `higood-pcs-video-testing-store-v1` 记例外：同 CLEAN-004 历史投影依赖） | WP-01 | 实际：`src/pages/pcs-video-testing.ts` D；routes/菜单/renderer 0 引用；`pcs-video-testing-repository.ts` 仅被 relation/channel 投影引用 | 同 CLEAN-004 | 冒烟 `/pcs/testing/video` 未匹配；性能不适用 | 已验证 | 冒烟 PASS；治理记录第 6/7 节例外 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-006 | 设计 §4.6 | 「测款通过」对档案生效/技术包启用等现行回写与文案删除 | WP-01 | 实际：`pcs-channel-product-project-repository.ts`、`pcs-product-lifecycle-governance.ts`、`pcs-task-project-relation-writeback.ts` | rg「测款通过」现行写链=0；相关 spec PASS | 页面无该类提示文案（保留历史 sync note 为 Mock 展示） | 已验证 | rg 扫描 0；23 modified specs PASS | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-007 | 设计 §4.6 | 花型/制版等需求来源不再默认「预售测款通过」旧枚举写链 | WP-01 | 实际：`pcs-pattern-task-repository.ts`、`pcs-pattern-task-types.ts`、`pcs-task-bootstrap.ts`（补 `PatternTaskDemandSourceType` import） | rg「预售测款通过」src/scripts=0；`pcs-pattern-task-review-flow.spec.ts` PASS；tsc 变更文件 0 错误 | 页面需求来源符合新口径 | 已验证 | rg 0；spec PASS；tsc filtered 0 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-008 | 设计 §5.2 | 包材分类从 PCS 菜单、路由、类型、筛选、种子、文案删除（口径限 PCS 域，不宣称 PMS/WLS/FCS 全局 0） | WP-01 | 实际：`pcs-material-archives.ts`、`pcs-material-archive-types.ts`、`pcs-material-archive-repository.ts`、菜单/路由 | rg「包材」PCS 域=1（`pcs-material-archive-repository.ts:481` 否定语义「不归入服装包材」）；菜单/路由 0 | 冒烟 `/pcs/materials/packaging` 未匹配；物料菜单仅五类 | 已验证 | rg 1 条合法否定；冒烟 PASS；治理记录 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-009 | 设计 §1.2、假设 A5 | workspace 概览/待办/风险与渠道属性对应等清空占位路由删除 | WP-01 | 实际：`routes-pcs.ts` 占位注册删除；`pcs-reset-placeholder` 不覆盖 | 占位路由 0 注册；renderPcsResetPlaceholder=0 | 冒烟 4 条旧 URL 未匹配（非占位文案）；性能不适用 | 已验证 | 冒烟 PASS；rg renderer=0 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-010 | 设计 §1.2 | `pcs-reset-placeholder` 通配 PCS 占位实现删除；未知 `/pcs` 走应用级未匹配 | WP-01 | 实际：`src/pages/pcs-reset-placeholder.ts` D；route-renderers 删导出 | rg `renderPcsResetPlaceholder`=0；build PASS | 冒烟 `/pcs/reset-placeholder` 通用未匹配（len≈209） | 已验证 | rg 0；冒烟 PASS | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-011 | 实施计划 §5 WP-01 | store 中渠道属性对应死别名等废弃别名清理 | WP-01 | 实际：`src/state/store.ts` `REMOVED_PCS_TAB_PATHS` + 删 mapping 重定向 | store diff 审查；`npm test` PASS | 点击旧 Tab 直接丢弃不再落入占位 | 已验证 | store diff；npm test 411/411 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| CLEAN-012 | 设计 §13.1 | 阶段①后 PCS 域内旧测款/商品项目/包材/占位残留扫描为 0，且构建通过（域外模块不纳入 0 口径） | WP-01 | 实际：残留扫描（路由/菜单/renderer/写链）+ 构建 | 残留扫描：旧路由/菜单/renderer/预售写链=0；`npm run build` PASS（8.85s） | 生产准备冒烟 6 条保留路由可打开；默认页 `/pcs/products/styles` 冷加载 5 次通过（240/159/158/158/158ms，max 240ms < 500ms，`/tmp/pcs-wp01/default-page-cold-load.json` 真源） | 已验证 | 治理记录第 7 节验证命令全列；`npx tsx /tmp/pcs-smoke.mts` PASS；冷加载 `npx tsx /tmp/pcs-wp01/cold-load-default-page.mts` PASS | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |

### 1.2 ARCH — 商品档案（WP-02）

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实现位置（目标/实际） | 自动化验证 | 页面/PDA/打印/性能 | 状态 | 证据 | 产品确认人 |
|---|---|---|---|---|---|---|---|---|---|
| ARCH-001 | 设计 §5.1 | 无任何测款历史即可创建 SPU/SKU（门禁删除） | WP-02 | 实际：`createStyleArchiveDirect`（`pcs-style-archive-repository.ts`）；列表/详情「新建款式」入口；spec 列表无测款历史断言 | `npx tsx tests/pcs-product-archives.spec.ts` PASS（新建款式/无需测款历史断言） |命名页浏览器验收记录见治理记录第 6/7 节；冷加载 `default-page-cold-load.json` max 240ms < 500ms|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；tests/pcs-product-archives.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-002 | 设计 §5.1 | 档案内不存在「测款通过才可作为正式渠道商品」等旧准入文案与逻辑 | WP-02 | 实际：残留下扫描 `测款通过.*才能` 与 `准入` src=0；`createStyleArchiveShell` 放开 sourceProjectId 门禁；`formalizeStyleArchive` 同步 | 文案扫描=0；spec doesNotMatch 旧生成入口 | 页面无旧准入提示；冷加载 `default-page-cold-load.json` max 240ms < 500ms | 已验证 | rg 扫描证据；tests/pcs-product-archives.spec.ts PASS；治理记录 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-003 | 设计 §5.1、§3.1 | SPU→SKU→渠道店铺商品层级展示与详情可追溯 | WP-02 | 实际：`renderStyleDetailChannels` 行 `data-nav="/pcs/products/channel-products/:id"`（`pcs-product-archives.ts`）；渠道详情 styleHref 回链；SKU→样式 detail | spec 切 channels 页签断言 `/pcs/products/channel-products/` |命名页浏览器验收记录见治理记录第 6/7 节；冷加载 `default-page-cold-load.json` max 240ms < 500ms|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；tests/pcs-product-archives.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-004 | 设计 §5.1、§11-4 | 渠道店铺主数据归属商品档案模块（含 TikTok、Shopee） | WP-02 | 实际：`pcs-menu-products` 组含 `pcs-channel-stores`；`PCS_CHANNEL_OPTIONS` 含 tiktok/shopee；`pcs-channel-store-master.ts` 种子 | spec 断言选项含两渠道+菜单组挂载 |命名页浏览器验收记录见治理记录第 6/7 节；冷加载 `default-page-cold-load.json` max 240ms < 500ms|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；tests/pcs-product-archives.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-005 | 设计 §11-2、§3.1 | 渠道店铺商品数据对象归属商品档案模块 | WP-02 | 实际：`pcs-menu-products` 组含 `pcs-channel-products` href `/pcs/products/channel-products`；菜单已有该分组 | spec 断言菜单组挂载 |命名页浏览器验收记录见治理记录第 6/7 节；冷加载 `default-page-cold-load.json` max 240ms < 500ms|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；tests/pcs-product-archives.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-006 | 设计 §5.1、§11-4 | SKU 支持预计用料 1..N（物料 SKU）维护与展示 | WP-02 | 实际：`SkuArchiveRecord.expectedMaterials`；`buildSeedRecord` 种 3 行；`renderSkuDetailOverview` 预计用料块；`listExpectedMaterialsByStyleId` | spec 断言预计用料区+种子行+款式聚合 |命名页浏览器验收记录见治理记录第 6/7 节；冷加载 `default-page-cold-load.json` max 240ms < 500ms|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；tests/pcs-product-archives.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-007 | 设计 §5.1、§11-4 | SKU 档案不包含采购链接字段 | WP-02 | 实际：类型/详情无 `采购链接`；spec doesNotMatch | spec `doesNotMatch(skuDetailHtml, /采购链接/)` |命名页浏览器验收记录见治理记录第 6/7 节；冷加载 `default-page-cold-load.json` max 240ms < 500ms|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；tests/pcs-product-archives.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-008 | 设计 §6.1 | 档案侧回写字段清单文档化并在代码冻结（含渠道商品、可选状态字段） | WP-02 | 实际：`ARCHIVE_WRITEBACK_FIELDS`+`listArchiveWritebackFieldKeys`（`pcs-archive-writeback-contract.ts`）冻结 7 字段 | spec deepEqual 7 字段+每字段 label/target | 不适用（契约） | 已验证 | tests/pcs-product-archives.spec.ts PASS | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-009 | 设计 §6.1 | 提供回写接收入口：按清单写入档案并记录时间 | WP-02 | 实际：`applyArchiveWriteback` 写入+appliedFields 时间 | spec ok=true+appliedFields 含 lastTestingConclusion | 不适用 | 已验证 | tests/pcs-product-archives.spec.ts PASS | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-010 | 设计 §6.1 | 回写只更新档案投影，不回放测款过程逻辑 | WP-02 | 实际：`applyArchiveWriteback` 仅改款式档案字段；回读 baseInfoStatus | spec 回读状态变化（已通过） | 不适用 | 已验证 | tests/pcs-product-archives.spec.ts PASS | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-011 | 设计 §10.2 | 档案 Mock：无测款历史可读可建；渠道含 TikTok/Shopee；渠道商品可来自⑧回写样例 | WP-02 | 实际：bootstrap `sourceProjectId:''`+「尚无测款历史」remark；渠道选项/种子；回写样例字段 | spec 断言 sourceProjectId===''；渠道选项；回写 |命名页浏览器验收记录见治理记录第 6/7 节；冷加载 `default-page-cold-load.json` max 240ms < 500ms|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；tests/pcs-product-archives.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| ARCH-012 | 实施计划 §5 WP-02 | 档案相关标准列表/详情在 1366×768 通过命名页验收且 <500ms | WP-02 |实际：`pcs-product-archives.ts`/`pcs-channel-products.ts`/`pcs-channel-stores`（标准列表）；`check:list-page-governance` PASS|`check:list-page-governance` PASS；spec PASS|1366×768 列表治理 + 冷加载 max 240ms < 500ms（`/tmp/pcs-wp01/default-page-cold-load.json` 收尾复测）|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；list-page-governance PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |

### 1.3 MAT — 物料与变种（WP-03）

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实现位置（目标/实际） | 自动化验证 | 页面/PDA/打印/性能 | 状态 | 证据 | 产品确认人 |
|---|---|---|---|---|---|---|---|---|---|
| MAT-001 | 设计 §5.2 | 物料分类仅五类：面料、辅料、纱线、耗材、配件 | WP-03 |实际：`pcs-material-archive-types.ts` `MaterialArchiveKind` 五类；菜单/筛选无包材|tests/pcs-material-variant.spec.ts PASS（kinds.length===5、无 packaging）|物料菜单/筛选五类；已验证|已验证|tests/pcs-material-variant.spec.ts；治理记录| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-002 | 设计 §5.3 | 物料 SPU 下可创建变种并展示基本信息 | WP-03 |实际：`pcs-material-variant-types.ts`/`pcs-material-variant-repository.ts`；`pcs-material-archives.ts` `renderVariantsTab`|tests/pcs-material-variant.spec.ts PASS（create/list 契约）|物料详情变种页签列表可读|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-003 | 设计 §5.3 | 变种记录 predecessorVariantId 血缘并可追溯前驱 | WP-03 |实际：`listVariantLineage(variantId)`（repositor）；`pcs-material-archives.ts` 血缘展示|spec PASS（predecessor 血缘）|详情血缘链可读|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-004 | 设计 §5.3、§11-3 | 染色变种码生成规则=`面料SPU-颜色-Pantone+PT` | WP-03 |实际：码生成器（repositor createMaterialVariant 染色分支）|spec 断言 `CNIDML130-apricot-17-4030PT`|列表展示染色变种码|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-005 | 设计 §5.3 | 后整理变种码=前驱码+工艺/花型码拼接 | WP-03 |实际：码生成器后整理拼接分支|spec PASS（多段拼接）|详情多段码可读|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-006 | 设计 §5.3、§11-12 | 同一变种链同类型工艺至多一层，重复类型阻断 | WP-03 |实际：变种校验（同类型一层）|spec 重复 type 阻断|表单/创建结果报错可读|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-007 | 设计 §5.3、§11-12 | 加工总层数不设上限，可构建≥3 层不同类型链 | WP-03 |实际：变种模型 layerIndex 无上限|spec ≥3 层不同类型链|详情可见多层|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-008 | 设计 §5.3、§11-13 | processes.type 只读引用 FCS 工序工艺字典，不在 PCS 新建工艺维护页 | WP-03 |实际：`pcs-material-variant-fcs-dict.ts` 只读字典引用；无 PCS 工艺维护路由|spec 断言 getFcsCraftDictRef；无维护路由|不适用（无页面）|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-009 | 设计 §5.3 | BOM/引用挂 variantId；variantCode 仅展示非主键 | WP-03 |实际：变种类型 variantId 挂接；variantCode 仅展示|spec 类型测试（挂接键为 id）|不适用（契约）|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-010 | 设计 §5.3、§11-15 | 存量 BOM 行一次性映射为基础态变种 | WP-03 |实际：`migrateLegacyBomLinesToBaseVariants`|spec 迁移契约（旧→基础态）|BOM 列表迁移后可打开|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-011 | 设计 §5.3 | 无加工链类别允许无变种层，不强制套链 | WP-03 |实际：变种模型可选性（基础态 BASE）|spec 可选变种测试|详情无变种时不报错|已验证|tests/pcs-material-variant.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-012 | 设计 §5.4 | 生产准备 BOM 可沿用预计用料/初步 BOM 起点且可调整（不改生产准备流程） | WP-03 |实际：预计用料/初步 BOM 复制入口（沿用可调，不改生产准备流程）|spec 沿用复制契约；生产准备回归（既有专项）|生产准备 BOM 页回归 <500ms（既有冷加载证据复用）|已验证|tests/pcs-material-variant.spec.ts PASS；生产准备既有专项| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-013 | 设计 §10.3 | 物料 Mock：五类有数；染色命名样例；≥1 条多层同类型不重复链；BOM 映射样例 | WP-03 |实际：物料/变种种子（五类、染色命名、多层链、BOM 映射样例）|spec 种子契约 PASS|面料详情+大图：遮罩/Esc/关闭按钮 5 路径 PASS|已验证|tests/pcs-material-variant.spec.ts PASS；`/tmp/pcs-wp01/image-lightbox-acceptance.json`（MAT-013-fabric PASS）| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| MAT-014 | 实施计划 §5 WP-03 | 变种相关命名页 1366×768 验收且交互 <500ms | WP-03 |实际：`pcs-material-archives.ts` 变种页签；list 治理适用项 PASS|`check:list-page-governance` PASS（物料详情页签非独立 list 时按 detail/治理记录说明）|≥5 样本/入口：冷加载 max 132ms、交互 max 77ms（`interaction-perf.json` 最新）|已验证|`/tmp/pcs-wp01/interaction-perf.json`（cold-materials-fabric max 132ms；interact-material-* max ≤77ms；全套 16/16 PASS max 177ms）；治理记录第 6 节| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |

### 1.4 TEST — 测款单（WP-04）

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实现位置（目标/实际） | 自动化验证 | 页面/PDA/打印/性能 | 状态 | 证据 | 产品确认人 |
|---|---|---|---|---|---|---|---|---|---|
| TEST-001 | 设计 §4、§11-7 | 测款单作为独立模块提供列表与详情入口，标题用名「测款单」 | WP-04 |实际：`pcs-testing-order-list.ts`/`pcs-testing-order-detail.ts`；`routes-pcs.ts` exact+dynamic；菜单 `pcs-menu-testing`|tests/pcs-testing-order.spec.ts PASS（路由+菜单+标题）|命名页打开：`/pcs/testing/orders`、`/pcs/testing/orders/:id`|已验证|tests/pcs-testing-order.spec.ts PASS；治理记录| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-002 | 设计 §4.4、§11-8 | 同一 SPU 至多 1 张进行中测款单，第二张阻断 | WP-04 |实际：`createTestingOrder` 唯一性校验|spec 第二张阻断 + 提示匹配|创建被拒并提示可读|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-003 | 设计 §4.1 | 详情按十步阶段展示且当前步骤可操作 | WP-04 |实际：`renderPcsTestingOrderDetailPage` + `TESTING_ORDER_STEPS` 十步|spec 十步/当前步骤断言 PASS|详情步骤条可读可操作|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-004 | 设计 §4.1、§11-4 | ①系统建档创建 SPU/SKU（预计用料）并写入档案 | WP-04 |实际：建档调用 `createStyleArchiveDirect`/SKU 写入（复用 ARCH API）|spec 档案出现新 SPU/SKU|建档完成回档案可见|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-005 | 设计 §3.1、§11-4 | 采购链接只存测款单，档案 SKU 不落该字段 | WP-04 |实际：测款单 `purchaseLinks`；SKU 类型无采购链接|spec 双端断言（详情有/SKU 无）|详情见链接、SKU 无字段|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-006 | 设计 §4.1 | ③快递/物流信息记录在测款单 | WP-04 |实际：`logisticsCarrier`/`logisticsTrackingNo`/`logisticsEta`|spec 字段契约|详情物流区可读|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-007 | 设计 §4.1 | ⑤打标完成条件=已贴码且码值等于 SKU 编码 | WP-04 |实际：`completeLabelStep` 码值=SKU；详情打标步骤|spec 码值相等断言（TEST-007/SAMP-009）|打标步骤显示 SKU 码|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-008 | 设计 §4.1 | ⑥买手确认淘汰→测款单结束且保留淘汰事实 | WP-04 |实际：`rejectBuyerConfirm` 状态机|spec 淘汰→已结束 + history|详情显示淘汰记录|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-009 | 设计 §4.1 | ⑦核价淘汰→测款单结束且保留淘汰事实 | WP-04 |实际：`rejectPricing` 状态机|spec 同 TEST-008|详情显示核价淘汰|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-010 | 设计 §4.1 | ⑦核价记录初步 BOM/用量/工艺成本/定价于测款单 | WP-04 |实际：`TestingOrderPricing`（BOM/用量/工艺成本/定价）|spec 字段契约|核价区可读|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-011 | 设计 §4.1、§3.2 | ⑧创建渠道商品并推送测款渠道（含 TikTok、Shopee），对象写入档案 | WP-04 |实际：`pushChannelProducts` + `PCS_CHANNEL_OPTIONS` TikTok/Shopee + `applyArchiveWriteback`|spec 档案渠道商品 + 推送事实|渠道商品列表可见新记录|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-012 | 设计 §4.1 | ⑧寄样方式支持人头、空运并记录 | WP-04 |实际：`TestingSampleShipMethod` 人头/空运|spec 枚举契约|表单二选一|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-013 | 设计 §4.1 | ⑨直播测款执行事实记录在测款单 | WP-04 |实际：`liveSessionNote` 直播测款步骤|spec 字段契约|详情可读|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-014 | 设计 §4.2、§11-6 | ⑩大货判断支持 是/否/待定 三态 | WP-04 |实际：`TestingBulkDecision` 是/否/待定 + `setBulkDecision`|spec 三态枚举|按钮三选|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-015 | 设计 §4.2、§4.3 | 大货=是→测款单结束，并提供进入生产准备引导 | WP-04 |实际：状态机大货=是→结束 + 生产准备引导路由|spec 结束断言；引导路由=生产准备|结束后引导可点|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-016 | 设计 §4.2、§4.3 | 大货=否→测款单结束；档案/样衣/渠道商品保留 | WP-04 |实际：状态机大货=否→结束；关联对象保留|spec 结束+关联仍在|详情已结束仍可查|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-017 | 设计 §4.2、§4.3 | 大货=待定→测款单保持进行中，可再次判断直至是/否 | WP-04 |实际：待定不结束，可再判断收敛|spec 待定→再判断→收敛|待定后仍可操作|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-018 | 设计 §6.1、§6.2、§11-5 | 步骤进入下一行为时按档案清单同步回写 | WP-04 |实际：`advanceTestingOrder` 推进钩子 → `applyArchiveWriteback`|spec 时机：完成即写非仅结束|回写字段在档案可见|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-019 | 设计 §4.1、§3.2 | 第一次上架(建档)与第二次上架(渠道推送)为不同步骤与文案 | WP-04 |实际：步骤文案区分建档上架 vs 渠道推送|spec 文案与动作分离|界面用语区分两次上架|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-020 | 设计 §4.6、§11-1 | 旧直播/短视频测款 URL 访问未匹配；新测款菜单不指向旧页 | WP-04 |实际：旧 `/pcs/testing/live`、`/pcs/testing/video` 未注册；新菜单不指向旧页|spec 旧 path 0 注册 + 菜单不指向旧页|手工访问旧 URL 未匹配|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-021 | 设计 §10.1 | Mock 覆盖：正常全程是；确认淘汰；核价淘汰；待定收敛；同 SPU 历史已结束单 | WP-04 |实际：`bootstrapTestingOrders` 种子（正常全程是、确认淘汰、核价淘汰、待定收敛、同 SPU 历史已结束）|spec 种子场景契约 PASS|各场景列表可筛|已验证|tests/pcs-testing-order.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-022 | 设计 §9、§13.2 | 测款单列表/详情款式图片真实、同块展示、可大图 | WP-04 |实际：列表/详情 `styleImageUrl` + 同块款号款名；`data-pda-image-preview-url` 打开大图|spec 图片存在性断言 + `image-lightbox-acceptance.mts` 5 例 PASS|列表/详情大图打开/Esc/关闭按钮、遮罩、`role=dialog` 5 路径 PASS|已验证|tests/pcs-testing-order.spec.ts PASS；`/tmp/pcs-wp01/image-lightbox-acceptance.json`（TEST-022-detail/list PASS）；治理记录真实图片验证| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-023 | AGENTS §5.2 | 测款单列表按标准列表结构实现并带 `@page-pattern: list`（若属标准列表） | WP-04 |实际：`pcs-testing-order-list.ts` 首行 `@page-pattern: list` + 三件套|`check:list-page-governance` PASS（scanned 556, baseline 12）|1366×768 标准列表结构|已验证|list-page-governance PASS；治理记录第 7 节| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| TEST-024 | AGENTS §7.2、设计 §9 | 测款单全部入口加载与交互 <500ms（每项≥5 样本） | WP-04 |实际：浏览器测量（列表/详情/交互）|性能脚本/日志|冷启动/交互 ≥5 样本，测款入口 max ≤110ms、全套 max 177ms < 500ms（`interaction-perf.json` 16/16 PASS，bulk 为真实点击 38ms）|已验证|`/tmp/pcs-wp01/interaction-perf.json`（interact-testing-query/reset/pagination/open-create、lightbox、bulk-visible PASS）；`/tmp/pcs-wp01/affected-routes-cold-load.json` max 172ms；`/tmp/pcs-wp01/cold-recheck.json` cold-testing-orders max 142ms；治理记录第 6 节| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |

| TEST-025 | 设计 §4.1 ② | ②采购下单完成条件=记录采购链接与下单事实（链接只挂测款单），完成后可推进③快递信息 | WP-04 |实际：`TESTING_ORDER_STEPS` `purchase-link`；详情「下一步：②采购下单」→ advance `logistics`；`purchaseLinks` 字段|`tests/pcs-testing-order.spec.ts` 断言独立步骤与推进|详情②步骤可操作；链接不进 SKU|已验证|tests/pcs-testing-order.spec.ts PASS；`src/data/pcs-testing-order-repository.ts` `advanceTestingOrder`| 用户（2026-09-23 接受 1fce47c2） |
| TEST-026 | 设计 §4.1 ④ | ④样衣入库完成条件=当前步为 sample-inbound 且已填物流，写入 sampleInboundAt/Note 后推进⑤；未入库不可打标 | WP-04 |实际：`completeSampleInbound`；`advanceTestingOrder` order≥label 需 sampleInboundAt；详情 sample-inbound panel；`handlePcsTestingOrderInput` 返回 false 防输入重绘丢值|`tests/pcs-testing-order.spec.ts` F-01 流：物流→入库→打标门禁|详情④面板/按钮可操作；未入库打标阻断；浏览器 SPA 推进至④|已验证|tests/pcs-testing-order.spec.ts PASS；`pcs-testing-order-repository.ts` `completeSampleInbound`；`/tmp/pcs-wp01/detail-render-acceptance.json` SAMPLE-INBOUND-PANEL-UI PASS| 用户（2026-09-23 接受 1fce47c2） |
| TEST-027 | 设计 §4.5 | 详情按当前步骤展示责任团队（买手/仓储现场/跟单口径与权限表一致） | WP-04 |实际：`TESTING_ORDER_STEP_TEAMS`；`pcs-testing-order-detail.ts` 顶部「当前步骤责任团队」|`tests/pcs-testing-order.spec.ts`（步骤/团队映射可读）；tsc 任务范围 0 错误|详情可见当前步骤团队文案；浏览器实测买手（live-testing）与仓储/现场（sample-inbound）|已验证|`src/data/pcs-testing-order-repository.ts` `TESTING_ORDER_STEP_TEAMS`；`src/pages/pcs-testing-order-detail.ts` renderSteps 团队展示；tests/pcs-testing-order.spec.ts PASS；`/tmp/pcs-wp01/detail-render-acceptance.json` DETAIL-TEAM-STEPS + SAMPLE-INBOUND-PANEL-UI PASS；`/tmp/pcs-wp01/detail-team-steps.png`| 用户（2026-09-23 接受 1fce47c2） |

### 1.5 SAMP — 样衣统一模型（WP-05）

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实现位置（目标/实际） | 自动化验证 | 页面/PDA/打印/性能 | 状态 | 证据 | 产品确认人 |
|---|---|---|---|---|---|---|---|---|---|
| SAMP-001 | 设计 §7.1、§11-19 | 样品类型仅营销样品、生产样品两类 | WP-05 |实际：`PCS_SAMPLE_TYPES = ['marketing','production']`（`pcs-sample-location-master.ts`）|spec deepEqual 双类型、无测款样品|列表类型文案正确|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-002 | 设计 §7.1、§11-9 | 营销样品与生产样品可任意互转 | WP-05 |实际：`convertPcsSampleType` + `pcs-sample-management.ts` 互转事件|spec 双向互转 PASS|互转按钮可用|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-003 | 设计 §7.1 | 类型互转记录操作人、时间、原因/备注 | WP-05 |实际：`listPcsSampleTypeConversionLogs` 操作人/时间/原因留痕|spec 留痕字段契约|详情可见互转记录|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-004 | 设计 §7.2 | 流转位置类型=直播间/家播/工厂/部门/仓库 | WP-05 |实际：`pcs-sample-location-master.ts` 五类位置枚举|spec 枚举契约|位置筛选五类|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-005 | 设计 §7.2、§11-11 | 家播为独立类型且语义为主播/达人 | WP-05 |实际：位置主数据家播独立类型语义（主播/达人）|spec 类型≠直播间|家播列表展示达人名|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-006 | 设计 §7.2 | 不存在摄影等营销位位置类型及文案残留 | WP-05 |实际：位置枚举无摄影位；文案扫描残留=0|rg 残留=0|页面无摄影位选项|已验证|rg 扫描证据；治理记录第 7 节| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-007 | 设计 §7.2 | 流转记录引用位置主数据 ID，禁止仅自由文本事实 | WP-05 |实际：流转记录引用 `currentLocationId`（位置主数据 ID）|spec ID 引用契约|流转详情显示位置名|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-008 | 设计 §7.3、§11-10 | 一 SKU 一码，打标码值=SKU 编码 | WP-05 |实际：`buildPcsSampleTagCode` / 打标码=SKU|spec 码值=SKU 断言|打标页显示 SKU 码|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-009 | 设计 §7.3 | 样品必须贴码后方可完成入库后打标/测款⑤推进 | WP-05 |实际：`canCompletePcsSampleTagging` 未贴码阻断|spec 未贴码阻断 + 测款⑤推进阻断|未打标不可完成步骤|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-010 | 设计 §7.3、§1.3 | 本期不实现无码流转旁路；无码能力不出现在页面承诺 | WP-05 |实际：无「可无码流转」文案；无无码入口|文案扫描=0|页面无无码入口|已验证|rg 扫描证据；治理记录第 7 节| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-011 | 设计 §7.2 | 营销样品可在直播间、家播间流转并保留历史 | WP-05 |实际：营销样品直播间/家播间流转 Mock+历史|spec 流转链测试|两位置流转可见|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-012 | 设计 §7.2 | 生产样品可在工厂、部门（及仓）流转并保留历史 | WP-05 |实际：生产样品工厂/部门（及仓）流转 Mock+历史|spec 同 SAMP-011|工厂/部门流转可见|已验证|tests/pcs-sample-management.spec.ts PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-013 | 设计 §10.4 | 样衣 Mock：双类型并存、互转记录、位置分类、打标样例 | WP-05 |实际：`PCS_SAMPLE_RECORDS` 种子（双类型、互转、位置、打标）|spec 种子契约 PASS|台账/流转页可读+图片：`data-pda-image-preview-url` 大图 5 路径 PASS|已验证|tests/pcs-sample-management.spec.ts PASS；`/tmp/pcs-wp01/image-lightbox-acceptance.json`（SAMP-013-inventory PASS）| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| SAMP-014 | AGENTS §7.2、设计 §9 | 样衣命名页加载与交互 <500ms（≥5 样本/入口） | WP-05 |实际：浏览器测量（样衣命名页）|性能日志|≥5 样本/入口：冷加载 max 177ms、交互 max 94ms（`interaction-perf.json` 最新）|已验证|`/tmp/pcs-wp01/interaction-perf.json`（cold-samples-inventory max 177ms、ledger 139ms、interact-sample-* max ≤94ms，16/16 PASS）；治理记录第 6 节| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |

### 1.6 GATE — 总验收（WP-06）

| 需求编号 | 来源章节 | 原子需求 | 工作包 | 实现位置（目标/实际） | 自动化验证 | 页面/PDA/打印/性能 | 状态 | 证据 | 产品确认人 |
|---|---|---|---|---|---|---|---|---|---|
| GATE-001 | 计划 §1 | 正向追踪：总体设计章节→矩阵→实现→证据无漏项（含 §1/§12/§4.5/②完成条件，两轮审查后补齐） | WP-06 |实际：矩阵本身（章节覆盖检查第 3 节；新增 TEST-025～027）|正向追踪：章节→编号→实现→证据|不适用|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md；矩阵第 3 节| 用户（2026-09-23 接受 1fce47c2） |
| GATE-002 | 计划 §1 | 反向追踪：src 路由/页面/Mock→需求编号无越界 | WP-06 |实际：全量 diff 反向抽查（路由/页面/Mock→编号）|反向追踪无越界（治理记录第 7 节页面路由）|不适用|已验证|docs/prototype-review-records/2026-09-23-pcs-product-center-wp02-06.md 第 7 节页面路由| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| GATE-003 | AGENTS §4.6 | `npm run check:prototype-design-governance` 通过 | WP-06 |实际：`scripts/check-prototype-design-governance.ts`|`check:prototype-design-governance -- --all` PASS（43 user-visible, 2 linked records）|审查记录按影响归档（2 条完整记录）|已验证|governance PASS；治理记录第 7 节| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| GATE-004 | AGENTS §5.2 | 受影响标准列表通过 `check:list-page-governance` | WP-06 |实际：`scripts/check-list-page-governance.ts` + 测试单列表三件套|`check:list-page-governance` PASS（scanned 556, baseline 12；template passed）|不适用|已验证|list-page-governance PASS| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| GATE-005 | 计划 §1、§7 | 受影响页面性能门禁通过；`workflow:verify` 收据绑定 HEAD | WP-06 |实际：`/tmp/pcs-wp01/task-receipt.json` 收据 + 性能汇总|收据 `state=verified` + 性能 max 177ms（16/16 交互/冷加载 + 大图 5/5 + 默认页 max 240ms）|汇总表：各入口 <500ms（治理记录第 6 节）|已验证|workflow:verify 收据；`/tmp/pcs-wp01/interaction-perf.json`；`/tmp/pcs-wp01/image-lightbox-acceptance.json`；`default-page-cold-load.json`| 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |
| GATE-006 | 计划 §1 | 生产准备 V2.4 冻结回归：九列表/设计改款/时效抽查无业务变化 | WP-06 | 实际：九列表菜单/路由仍注册（`pcs-menu-production-preparation` 9 项 + `/pcs/production-preparation/*` exact routes）；设计改款/时效未改业务流程 | `pcs-production-preparation-transition.spec` PASS；`pcs-design-revision-production-preparation-five-flows.spec` PASS(5/5)；`pcs-engineering-bom-version-workflow.spec` PASS；`pcs-engineering-preparation-projection.spec` PASS；`pcs-production-engineering-full-flow.spec` PASS；`pcs-engineering-preparation-color-projection.spec` PASS；`npm test` 411/411 | 九列表/设计改款/时效抽查：菜单 9 项与路由注册对照 `app-shell-config.ts`/`routes-pcs.ts`；性能复用默认页 max 240ms < 500ms | 已验证 | 上述 specs PASS + `check:menu-routes` PASS + 治理记录第 7 节；既有失败 `pcs-tech-pack-bom-pricing-page.spec`/`production-preparation-timing-filters.spec` 为任务边界外（相关测试文件未改）；`check-production-object-overview` 本任务 diff 仅 `/pcs/projects`→`/pcs/products/styles` 路径字面量，失败为既有 PH-20260328-007 数据问题 | 用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条） |

---

## 2. 状态汇总

| 状态 | 数量 |
|---|---|
| 待实施 | 0 |
| 实施中 | 0 |
| 已实现待验证 | 0 |
| 已验证 | 85 |
| 已阻塞 | 0 |
| 不适用 | 0 |
| **合计** | **85** |

编号分布：CLEAN 12、ARCH 12、MAT 14、TEST 27、SAMP 14、GATE 6。产品确认：85 已确认（81 历史 + TEST-025～027、GATE-001 随版本接受）。

## 3. 章节覆盖检查（正向）

| 总体设计章节 | 覆盖编号 |
|---|---|
| §1 背景与目标/非目标 | CLEAN-001～012（阶段①清洁）、ARCH-001～012、MAT-001～014、TEST-001～027、SAMP-001～014、GATE-006（生产准备冻结） |
| §2 模块边界 | CLEAN-*、TEST-001、ARCH-*、SAMP-* |
| §3 对象关系/两次上架 | ARCH-003～005、TEST-004/011/019/025 |
| §4 测款单/三态/唯一性/十步/权限/删除 | TEST-001～027（含 ②TEST-025、④TEST-026、§4.5 TEST-027）、CLEAN-004～007 |
| §4.1 十步完成条件 | TEST-003/004/025/026、TEST-006/007/008～014 |
| §4.5 权限与角色团队展示 | TEST-027（`TESTING_ORDER_STEP_TEAMS`） |
| §5 档案与物料 | ARCH-001～012、MAT-001～014、CLEAN-008 |
| §6 回写 | ARCH-008～010、TEST-018 |
| §7 样衣 | SAMP-001～014、TEST-007/026 |
| §8 生产准备衔接 | MAT-012、TEST-015、GATE-006 |
| §9 端与设备 | ARCH-012、MAT-014、TEST-023/024、SAMP-014 |
| §10 Mock | ARCH-011、MAT-013、TEST-021、SAMP-013 |
| §11 确认口径 | 各域对应条目 |
| §12 假设与待确认 A1–A5 | 设计 §12 确认记录（用户 2026-09-23）；矩阵确认人列；GATE-001 正向追踪 |
| §13 验收总则 | GATE-001～006、CLEAN-012 |

## 4. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-09-22 | 初版建立：82 条原子需求，全部 `待实施`；来源=总体设计 2026-09-22 定稿 |
| 2026-09-23 | WP-01/CLEAN-001～012 回填为 `已验证`（实现位置、自动化、冒烟、治理记录 `2026-09-23-pcs-product-center-phase1-cleanup.md`）；汇总 12 已验证 / 70 待实施；`check-production-object-overview` 既有失败记任务边界外 |
| 2026-09-23 | 产品确认后补默认页切换 `/pcs/products/styles` 冷加载 5 次测量：以 JSON 真源 240/159/158/158/158ms，max 240ms < 500ms，通过；证据 `/tmp/pcs-wp01/default-page-cold-load.json` 与治理记录第 6 节；CLEAN-012 性能列由「不适用」改为实测通过 |
| 2026-09-23 | WP-02～WP-06 回填：ARCH-001～012、MAT-001～014、TEST-001～024、SAMP-001～014、GATE-001～006 全部 `已验证`（实现位置/自动化/页面/证据/治理记录 `2026-09-23-pcs-product-center-wp02-06.md`）；汇总 82 已验证 / 0 待实施；产品确认人仍为「待用户确认」 |
| 2026-09-23 | 收尾性能复测：默认页 max 240ms；受影响路由（测款单列表/详情、款式、渠道商品、渠道店铺）5 样本/入口 max 172ms，全部 <500ms；证据 `default-page-cold-load.json`、`affected-routes-cold-load.json`；CodeGraph sync 完成；治理 list/governance PASS；npm test 411/411 |
| 2026-09-23 | 大图 lightbox 终验收：`image-lightbox-acceptance.json` 5/5 PASS（TEST-022-detail/list、MAT-013-fabric、SAMP-013-inventory、ARCH-style-list，打开/Esc/关闭按钮）；16 入口交互与冷加载 `interaction-perf.json` 16/16 PASS max 209ms < 500ms；矩阵 TEST-022/024、MAT-013/014、SAMP-013/014、GATE-005 证据列与治理记录第 6/7 节回填；`workflow:verify` 收据 `state=verified` blockers `[]` |
| 2026-09-23 | **产品确认**：用户确认总体设计 §12 A1–A5 全部假设，并确认本矩阵 82/82 条产品确认人（`待用户确认` → `用户（2026-09-23 确认 §12 A1–A5 + 本矩阵 82 条）`）；状态仍为 82 `已验证`；`accepted` 仍待远端版本接受回执 |
| 2026-09-23 | 两轮审查修复回填：测款单对齐设计 §4.1 十步（补④样衣入库、删独立档案回写步、§4.5 团队展示）；新增原子行 TEST-025（②完成条件）、TEST-026（④完成条件）、TEST-027（§4.5 责任团队），总数 82→85、已验证 85；§3 覆盖补 §1/§12/§4.5/②；CLEAN-008/012 包材与残留口径限 PCS 域；CLEAN-004/005 记 live/video 存储键历史投影例外；GATE-001 覆盖补齐、GATE-005 性能 max 177ms、GATE-006 既有失败边界表述更正；交互重测 `interaction-perf.json` 16/16 PASS max 177ms（bulk 真实点击 38ms）；新增 3 行产品确认人=待用户确认 |
| 2026-09-23 | **交付与接受**：详情输入重绘修复后功能提交 `f62108bd`，合并 `main` 为 `1fce47c2` 并推送 `origin/main`；TEST-025～027、GATE-001 产品确认人由「待用户确认」→「用户（2026-09-23 接受 1fce47c2）」，85/85 已确认；GitHub 接受回执 commit comment `1fce47c2` #commitcomment-201603472；交付状态 `delivered` + `accepted` |
