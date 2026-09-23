# PCS 当前问题修复原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-23 |
| 相关需求 / 任务 | TEST-002/004/011/018/024、MAT-010、FCS-ENTRY-001/002、PRINT-LIST-001、IMG-AUDIT-001、IMG-FILL-001、TYPE-001/002 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS、FCS |
| 涉及页面路径 | `/pcs/testing/orders`、`/pcs/testing/orders/:id`、`/pcs/products/styles`、`/pcs/products/channel-products`、`/pcs/technical-data/bom-pricing`、`/fcs/craft/cutting/production-order-progress`、`/fcs/craft/printing/work-orders`、`/fcs/craft/dyeing/work-orders`、`/fcs/craft/post-finishing/qc-orders` |
| 端类型 | 管理端 |
| 主要角色与任务 | 商品买手建测款单并推送 Mock 渠道商品；物料/技术资料人员核对 BOM；生产管理查看来源对象总览 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增测款单两种建单入口、真实图片加载反馈、第⑧步逐渠道币种价格和阻断提示、渠道商品归属及进度文案；生产对象编号增加总览入口。
- 当前基线：`AGENTS.md` 第 4、5、7 节。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 买手在测款列表建单，详情按十步执行；管理列表结构保持原组件。 |
| 文案、状态、数量与单位 | 通过 | 关联已有档案与新建档案文案分开；渠道价格按 TikTok IDR、Shopee USD；核价 CNY 仅作参考。 |
| 扫码、真实图片与对象识别 | 通过 | 按用户自主搜索要求补齐固定原型图片映射，284/284 项通过；95 项素材均可加载。品类/结构/可见颜色校对及身份边界见 §8，不宣称外部照片证明真实供货编码。 |
| 防错、危险确认与主管兜底 | 通过 | 重复进行中 SPU、缺图片、缺渠道售价、前序步骤未完成均阻断；此管理端流程无主管代确认。 |
| 交接、跨端事实与异常追溯 | 通过 | 测款单、款式/SKU、渠道商品共用对象 ID 与历史；Mock 不宣称外部渠道成功。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 本轮图片按 1366×768 / 1280×720 验收；模拟图片请求失败可见提示，恢复后可打开大图。未改 PDA/上传流程，性能按用户本次例外。 |
| 命名路由、交互、图片大图与打印 | 已实现待验证 | 浏览器已走测款单至渠道商品主链；生产进度、印花、染色总览入口可打开。最终构建版 QC 编号、生产来源和需求编号可打开同一 Mock 主线，并可读到演示技术包快照；印花确认选择列加八个业务列。本轮图像路径/对应关系全量校验，大图交互按 §8 命名场景验收；打印布局不适用。 |

## 4. 问题标签

`选不对`、`算不准`、`追溯不足`。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 建单误选活跃款、①未真正建档 | 选不对 | 买手 | 按活跃单过滤已有款；新增 SPU/SKU/预计用料建档入口 | 否 |
| ⑧借用无关渠道商品且不推进 | 追溯不足 | 买手 | 以测款单、款式、SKU 和渠道创建独立 Mock 渠道记录，写回档案并推进 | 否 |
| CNY 核价被当成各店铺售价 | 算不准 | 买手 | 逐渠道按店铺币种填价，缺价阻断 | 否 |
| BOM 基础态变种未落到草稿行 | 追溯不足 | 技术资料人员 | 有明确物料 SKU 的行幂等映射；缺身份行保留原状 | 是：历史无 SKU 行待补来源身份 |
| 后道 QC 样本缺生产主线关联 | 追溯不足 | 生产管理 | 补齐 3 组同源 Mock 需求、生产单、款式档案、15 个 SKU 和演示技术包快照；质检单号回溯同源任务、需求与生产单 | 否：同源主线与五色原型照片已补齐 |
| 印花列表列结构与旧检查冲突 | 选不对 | 生产管理 | 按用户确认保留八个业务列与独立选择列，更新旧专项检查和设计变更记录 | 否 |
| 既有图片池复用造成款式/物料图不符 | 选不对 | 买手、技术资料人员 | 自主搜索 85 张图片、保留 10 项既有绑定，建立 284 项固定对应台账并替换 9 项错配 | 原型选材照片不代表真实供货身份；无自主补图阻塞 |

## 6. 最终结论

结论：通过（限本轮用户追加的全量类型修复、自主补图和 QC 图片来源修复）。既有测款/BOM 完整交付范围仍按实施清单逐项状态，不把本轮结果扩写为整个 PCS 重构重新验收完成。

全量 `tsc --noEmit` 0 错误；构建和 417/417 单测通过。284 项对象图片固定绑定及来源、文件哈希通过，9 项明显错配已替换；QC 主线 12/12、3 组需求/生产单/演示技术包和 15 个 SKU 已核对。当前工作树未提交、未合并，不沿用历史版本产品接受。性能按用户本次例外，不声称 `<500ms` 全面通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/production-object-overview.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-material-variant-repository.ts`
- `src/data/pcs-material-variant-types.ts`
- `src/data/pcs-product-archive-fixtures.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/pcs-testing-order-repository.ts`
- `src/pages/pcs-channel-products.ts`
- `src/pages/pcs-testing-order-detail.ts`
- `src/pages/pcs-testing-order-list.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/post-finishing/qc-orders.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/production-order-progress-tracking.ts`

- `src/data/fcs/post-finishing-production-source-fixtures.ts`
- `src/data/fcs/post-finishing-full-flow.ts`
- `src/data/fcs/production-demands.ts`
- `src/data/fcs/production-orders.ts`
- `src/data/pcs-production-demand-tech-pack-seeds.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/pcs-engineering-master-sampling.ts`

- `src/data/fcs/design-revision-process-work-order-adapter.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/factory-master-store.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/production-process-snapshot-derivation.ts`
- `src/data/fcs/tmf-process-continuation.ts`
- `src/data/pms/tmf-material-purchases.ts`
- `src/pages/simple-cut-piece-handover-ui.ts`
- `src/data/pcs-reviewed-image-catalog.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-sku-archive-repository.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-material-archives.ts`

### 页面路由

- `/pcs/testing/orders`、`/pcs/testing/orders/:id`、`/pcs/products/styles`、`/pcs/products/channel-products`
- `/pcs/technical-data/bom-pricing`
- `/fcs/craft/cutting/production-order-progress`、`/fcs/craft/printing/work-orders`、`/fcs/craft/dyeing/work-orders`、`/fcs/craft/post-finishing/qc-orders`

### 验证命令

以下为前轮历史结果，本轮追加修复后的最新结果见 §8。

- `node --import tsx tests/pcs-testing-order.spec.ts`：通过。
- `node --import tsx tests/pcs-material-variant.spec.ts`：通过。
- `node --import tsx tests/pcs-tech-pack-bom-pricing-page.spec.ts`：通过。
- `node --import tsx scripts/check-production-object-overview.ts`：通过。
- `npm run build`：通过（`478a4964` 基线，工程范围类型检查、411/411 单测及 Vite 构建）；当时全量 `tsc --noEmit` 有 68 条既有错误，现已按 §8 修复至 0。
- `npm run build` 的 `dist/` 同步到 `/private/tmp/pcs-repair-dist/`：通过（最终同一产物供当前分支浏览器走查）。
- `npm run check:list-page-governance:static`：通过（扫描 556 页，基线 12）。
- `npm run check:standard-list-page-template`：通过（沙箱内 Chromium 启动受限，获准后重跑；列拖动与 DOM 稳定性通过）。
- `npm run check:prototype-design-governance -- --all`：通过（当前受管文件由本记录覆盖）。
- `node --import tsx scripts/check-printing-two-end-list.ts`：通过（选择列 + 八个业务列，时间与数量分别断言）。
- `node --import tsx scripts/check-post-finishing-qc-mainline.ts`：通过（12 条 Mock QC 回溯 3 组需求/生产单/演示技术包、15 个 SKU、主工厂与来源任务；索引 ID 和来源任务编号可打开总览，原有样本分配保持稳定）。
- `node --import tsx scripts/audit-pcs-archive-images.ts`：通过（脚本生成 284 项台账；图片对象对应关系的业务验收仍失败）。
- 当前分支命名页面性能原始样本见下；用户已明确允许忽略印花 573.6ms 首样本和本次未补齐的逐项性能证据。

- `node --import tsx scripts/check-fcs-upstream-cutting-chain.ts`：通过（修正已更名的素材函数定位，保留上游完整性断言）。
- `node --import tsx --test tests/unit/production-artifact-source-selection.test.ts`：通过（后道专用来源不扰动原有通用工艺样本）。

- `npm run check:post-finishing-current-read-model`：通过（独立 QC 事实、数量及扣款保留）。
- `npm run check:post-finishing-full-flow`：通过（3 组生产来源、15 条回货链、75 个 SKU 行，QC/后道/复检/成衣入库贯通的脚本回放）。

### 前轮构建版页面回放（历史）

2026-09-23，分支 `codex/pcs-repair`，HEAD `478a4964a7079316ede0d6aea7c258218b2221ad` + 本任务未提交修改，IAB Chromium，1366×768，`http://localhost:4189`。最后一次代码修改后的 `npm run build` 通过，411/411 单测通过；将同一 `dist/` 产物同步到预览目录后刷新复核。

- `/fcs/craft/post-finishing/qc-orders`：点击 `PO-QC-202608-001-3` → `SEW-TASK-QC-001`，显示关联 `PO-QC-202608-001`、500 件和已关联；之前的“未找到关联生产单”失败已复现并修复。
- 同一总览继续点击 `PO-QC-202608-001` → `DEM-QC-202608-001`，当前对象为生产需求，关联同一 Mock 生产来源。来源区显示 `tdv_demand_SPU_QC_001 · Mock V1.0` 和来源任务编号。其余两组由专项逐对象、逐 SKU 校验覆盖。
- `/fcs/craft/printing/work-orders`：读取浏览器实际表头，确认选择列 + 加工单／商品、加工投入／上游、加工要求、处理进度、加工产出／下游、时间、数量、操作，八个业务列顺序正确。
- 页面回放是功能证据；图片身份仍阻塞，性能按用户本次例外处理。

### 构建版浏览器性能样本

以下性能样本产生于快进 `main` 之前：隔离工作树 `codex/pcs-repair`，当时基线 HEAD `28aae9b1` 加本次未提交修改，Vite 构建输出 `/private/tmp/pcs-repair-dist`，IAB Chromium，1366×768，浏览器内已有 TO-0006/0007 等 Mock 记录。时间从完整导航开始到首屏目标表格/标题、可见图片就绪并完成两帧绘制；未把这组样本称为清缓存冷启动，也不挪用为 `478a4964` 基线的性能证据。单位 ms，原始值如下：

| 路由与场景 | 5 次样本 | 结果 |
| --- | --- | --- |
| `/pcs/testing/orders` 完整导航 | 259.2 / 227.7 / 244.4 / 229.4 / 228.9 | 本组通过 |
| `/pcs/testing/orders/to_seed_normal` 完整导航 | 199.9 / 180.4 / 179.7 / 179.9 / 180.7 | 本组通过 |
| `/fcs/craft/printing/work-orders` 完整导航 | 542.2 / 498.8 / 512.3 / 512.2 / 495.0 | 失败，3 次达到或超过 500 |
| `/fcs/craft/dyeing/work-orders` 完整导航 | 512.5 / 546.0 / 528.3 / 528.5 / 529.4 | 失败，5 次达到或超过 500 |
| `/fcs/craft/post-finishing/qc-orders` 完整导航 | 462.1 / 429.9 / 445.2 / 455.4 / 446.5 | 本组通过 |

印花列表优化前曾测得 679.3 / 679.8 / 679.4 / 662.5 / 680.0ms；优化后的中间构建也出现 533.9 与 540.7ms。详情页一组 2679.5 / 2429.2 / 2696.3 / 2543.8 / 2530.2ms 使用了错误的就绪标题，均为 `ready=false`，不作为页面性能结论；上表按实际 `TO-0001` 标题重测。其余路由刷新、站内切换和全部适用交互的逐项样本未完成。

同名本地图片路径替换后，在无既有 Mock 记录的 `localhost:4189` 独立 origin、禁用浏览器缓存且 5 张可见图片均完成加载的条件下，测款列表完整导航 5 次为 215.8 / 179.5 / 195.1 / 179.9 / 179.0ms，均 `<500ms`。这是图片路径修改后的样本；上文远端图片慢样本仍保留，其他入口性能未闭合。

最后一次渠道防错与编码修订后的构建复测：测款列表 1713.5 / 1227.9 / 462.6 / 476.6 / 1145.2ms（3 次失败；可见远端图片有未加载完成样本）；TO-0007 详情 478.3 / 477.6 / 478.0 / 461.4 / 478.6ms；渠道商品 145.6 / 128.7 / 129.7 / 129.5 / 130.0ms；印花列表 573.6 / 463.0 / 446.4 / 446.3 / 446.4ms（首样本失败）；染色列表 479.9 / 463.0 / 462.7 / 464.6 / 476.1ms。最近一组染色样本均低于 500ms，但不能抹去上表曾出现的慢样本；这些样本也未覆盖冷启动、刷新和所有交互。

### 前轮真实图片问题（历史；已由 §8 修复）

- 干净 origin 的新建样本 TO-0006 为“白色长袖女式上衣”，款式图 `/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg` 显示同类白色长袖上衣；选中物料 `FLSZ26041134-white` 的 `/materials/archive/03170a87fd957af3c1672371e197470a.png` 为白色欧根纱刺绣小花，缩略图与物料编码同块展示，点击大图已验证。建单前图片加载完成才可提交；缺图与加载失败显示文字状态。
- 旧浏览器原型样本 TO-0007 的“白色新款 Polo”使用上述长袖上衣图，不符合对象对应关系；`FAB-COTTON-180-WHT` 当前也使用这张成衣图，不符合布料对象。它们只作为建单与渠道流程验证数据，不作为图片验收证据。
- `PCS图片素材逐项校对台账.csv` 覆盖 51 个款式、214 个成衣 SKU、19 个物料 SKU，9 个物料 SKU 经目测为品类或颜色明显错配。其余“同类物料”也尚缺编码与源图的对应凭据。8 张成衣图片池不得继续被视为原有 247 个款式/SKU 的真实对应图；新增 3 款式和 15 个 SKU 使用后道同源示意图，均在台账中标出，不作为真实对应图通过。

### 例外

- 无物料 SKU 身份的历史 BOM 行不自动猜测变种归属；已发布技术包快照不在读取时变更。
- 渠道商品的 `MOCK-` 上游编号仅供原型演示，未向 TikTok 或 Shopee 发起真实推送。
- 2026-09-23 用户明确允许忽略印花列表 573.6ms 首样本与本次尚未齐备的刷新、站内切换及交互逐项性能证据。原始慢样本保留；该例外仅用于本次修复核查，不声明性能已经通过 `<500ms`。

## 8. 用户追加修复：全量类型与自主补图（2026-09-23）

### 变更依据和边界

- 用户明确要求修复全量 68 条 `tsc --noEmit` 错误，代理自行搜索并解决素材；本次不再要求用户提供目录。
- TYPE-001：9 个文件的类型问题；已停用入口保留原有拒绝语义，删除 throw 后的不可达实现；修正已有快照字段路径、集合类型及 Web 固定分支。未改 TypeScript 检查范围或使用忽略标记。
- TYPE-002：连续余料由实物账统一计算；已扣报废的余量不再重复扣减，修复单参数加法导致 NaN 的问题。新回归验证 100 米→报废 30 米后余 70 米→再报废 70 米后余 0，101/71 米超量分别阻断；已绑定印花的染色单阻断直接截断。
- IMG-FILL-001：新增 85 张本地实拍资源（约 15 MB），保留 10 项既有物料图片绑定；51 个款式、214 个成衣 SKU、19 个物料 SKU 共 284 项都有固定绑定。各尺码共享同款同色图片，后道每款五色分别对应照片，未知新款不再自动分配无关图。仅登记的旧 Mock URL 迁移，用户自有图片保留。
- 目视校对范围为品类、结构及可见颜色。外部商品照片用于原型选材，尺寸、物料编码与原供应商关系仍是 Mock 字段，不能据照片推定 HiGood 实物身份或供货事实。原有不透明色号 103 保留原档案物料图，不推断其色名；130CM、8坑等尺寸/纹理数字不作为照片量测结果。
- 源图 URL、来源页面、文件路径、SHA-256 和逐图记录：`docs/product-design/PCS图片素材来源清单.json`；每条业务对象对应关系：`docs/product-design/PCS图片素材逐项校对台账.csv`。原8图哈希池退出分配，仅保留识别历史 URL 的迁移清单。
- 图片预览：款式、成衣 SKU 和物料详情复用既有全局预览组件；缩略图在标识同块显示，补加载/失败/缺图反馈，避免旧款式弹窗触发整页重绘；关闭按钮、遮罩和 Esc 按既有全局处理。
- PDA/打印：本轮无入口、布局和打印映射改动；沿用前序 QC 来源专项。性能仍按用户已授权的本次例外，不把例外记成测速通过。

### 本轮证据

- 全量 `./node_modules/.bin/tsc --noEmit`：退出 0、0 条错误，日志 `/private/tmp/pcs-final-tsc.log`。
- `audit-pcs-archive-images.ts`：284/284 当前读取 URL、固定绑定、来源、文件哈希一致。
- `tests/unit/pcs-reviewed-images.test.ts`：同色跨尺码、未知对象空图、旧图迁移不覆盖用户图、QC 五色来源。
- PCS 测款/物料变种/BOM 计价、印花八列、上游裁剪、生产对象总览及 QC 主线专项均通过。
- `npm run build`：417/417 单测及 Vite 构建通过；同一 `dist/` 同步 `/private/tmp/pcs-repair-dist/`。后道 current-read-model / full-flow 回归通过（3×5×5，15 回货链/75 SKU 行），主线检查 12/12。

### 本轮浏览器证据与图片来源校对

环境：`codex/pcs-repair`，HEAD `478a4964a7079316ede0d6aea7c258218b2221ad` + 当前未提交修改；同一工作树最终构建 `http://localhost:4189`，IAB Chromium。验收保留已有浏览器样本，不清空用户数据。素材逐图经九组图库及替换项目视校对；95 项素材在构建服务全部加载成功（naturalWidth > 0，失败 0）。来源与每对象行见 JSON / CSV；同款同色跨尺码复用明确登记。

| 命名路由 / 场景 | 现场结果 |
| --- | --- |
| `/pcs/products/styles` 款式列表及 QC 款式详情 | 图片和款号同块；QC 款五色照片可见；规格档案页补缩略图。已有手工样本保留，页面 52 款，固定 Mock 核查范围 51 款。 |
| `/pcs/products/specifications` SKU 列表与雾蓝大图 | 215 条（含既有手工样本）图片加载无失败；同色共享、不同颜色分图。关闭按钮、Esc、遮罩均实测；固定 Mock 范围 214 SKU。 |
| `/pcs/materials/yarn` / 物料详情 | 黑白线锥缩略图和颜色 SKU 对应；黑线大图实拍。 |
| `/pcs/materials/parts`、`/pcs/materials/consumable` | 10 英寸裁刀、白色胶带实拍可打开；胶带大图 Esc 关闭。 |
| `/pcs/materials/fabric` | 棉布黑白两条均为布料图；临时拦截白布请求时缩略图和大图显示失败文案，解除后重开恢复。拦截和禁缓存已撤销。 |
| `/pcs/materials/accessory` | 粉色流苏大图与颜色一致；1280×720 下图像边界 x344–936/y93.5–685.5，无溢出。线锥大图 1366×768 下 x427–939/y118.5–708.5。 |
| SKU 缩略图失败态 | 临时拦截黑衬衫图片后显示“图片加载失败，点击重试预览”；恢复后正常加载。 |
| `/fcs/craft/post-finishing/qc-orders` | 旧浏览器 QC 快照刷新后五种颜色均为当前映射，旧示意路径 0；数量/质检结果保留。SKU 图片复用全局预览，保留本地局部弹窗方式。最终构建雾蓝 SKU 大图可打开、Esc 关闭；技术参数内款式图片大图位于表单上层，点关闭仅关图、表单保留，再关闭表单。1280×720 图像完整可见。宽表需横向滚动至 SKU 图片列可见处操作。 |
| QC 主线与印花列 | QC → 来源任务 → 同生产单/需求为 500 件、同一来源；印花选择列加八个业务列，时间/数量分列。 |

图片来源为公开商品/物料页，例如 AS Colour Chad Polo、Bovera 蕾丝上衣、Stitch Spares 裁刀、Valsan 黑线、Nature’s Fabrics 黑棉布；完整 URL、下载资源路径和 SHA-256 以清单为准。图片校对结果只覆盖原型选材外观，保留原档案 103 色号并明确不反推供应商色名。

最后一次 QC 弹窗层级调整后，重新执行全量 `tsc --noEmit`（0）、`npm run build`（417/417，Vite 12.86s），同步产物并完成上述 QC 两层弹窗验收。治理检查覆盖 39 个受管文件 / 1 记录，列表静态治理扫描 556 页通过。技术/图片验证通过不等于 Git 发布或产品接受。
