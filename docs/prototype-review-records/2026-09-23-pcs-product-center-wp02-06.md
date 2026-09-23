# HiGood 原型变更治理记录 — PCS 商品中心重构 WP-02～WP-06（ARCH/MAT/TEST/SAMP/GATE）

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-23 |
| 相关需求 / 任务 | PCS 商品中心重构 WP-02～WP-06；ARCH-001～012、MAT-001～014、TEST-001～027（含两轮审查补录 025～027）、SAMP-001～014、GATE-001～006；分支 `codex/shangpinzhongxinyouhua001` HEAD `5fdc7a4c` + 工作树未提交变更 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs/testing/orders`（列表）、`/pcs/testing/orders/:id`（详情）；新增 `/pcs/testing/orders` 菜单项；物料变种页签（`/pcs/materials/:id` 内）；样衣管理（`/pcs/samples` 内类型互转/位置主数据）；档案渠道回链 `/pcs/products/channel-products/:id`；回写契约 `pcs-archive-writeback-contract.ts` |
| 端类型 | 管理端（桌面 Web） |
| 主要角色与任务 | 中国管理/计划角色：建档无测款门禁、测款单十步推进、物料五类+变种、样衣双类型互转、回写清单只读契约 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：新增测款单列表/详情路由与菜单项；档案创建 SPU/SKU 不再要求测款历史；渠道店铺归属商品档案分组；物料五类（无包材）+ 变种血缘页签；样衣样品类型仅营销/生产两类并支持互转、位置五类主数据；回写清单冻结 7 字段并在测款推进时写入；旧直播/短视频测款 URL 未注册（访问落到应用级未匹配）。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 测款单列表/详情为管理端标准列表/详情；物料变种为详情页签；样衣为管理台账+详情动作；档案/渠道/回写为既有模式局部增强 |
| 文案、状态、数量与单位 | 通过 | 状态用中文业务文案（进行中/已结束/大货三态/打标码值）；打标码=SKU；同 SPU 唯一性阻断文案可读 |
| 扫码、真实图片与对象识别 | 通过 | 测款单/物料/样衣缩略图与款号/编码同块；大图 `data-pda-image-preview-url` 打开 + 遮罩/Esc/关闭按钮 5 路径 PASS（`image-lightbox-acceptance.json`） |
| 防错、危险确认与主管兜底 | 通过 | 第二张进行中单阻断、打标码值≠SKU 阻断、买手/核价淘汰二次确认、待定不结束、旧 URL 未匹配 |
| 交接、跨端事实与异常追溯 | 不适用 | 本次不涉及 PDA / 打印 / 交接链路变更 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 无新上传路径与弱网场景；测款/样衣/物料为桌面管理端 |
| 命名路由、交互、图片大图与打印 | 通过 | 测款单列表 `@page-pattern: list` + 三件套 `check:list-page-governance` PASS；详情 `@page-pattern: detail`；`check:menu-routes` PASS；冷加载与 16 入口交互 max 177ms 见第 6 节 |

## 4. 问题标签

- 已识别并在 2026-09-23 两轮审查后修复：测款单缺④样衣入库/多余「档案回写」步、bulk 交互假 0ms 样本、默认页性能样本口径不一致、矩阵 §1/§12/§4.5/②完成条件覆盖缺口、GATE-006 边界表述、live/video 存储键说明。修复后以矩阵与本记录更新行为准。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 测款单步骤与设计 §4.1 不一致（缺④、多档案回写） | 算不准/做错风险 | 买手/仓储 | 补④样衣入库、删独立回写步、对齐十步命名与 spec | 否（修复后 spec PASS + 构建通过） |
| `interact-testing-bulk-visible` 原 0ms 假样本 | 算不准 | 中国管理/计划 | 改测 `to_seed_pending` 真实点击「待定」并等待面板就绪 | 否（重测后以最新 JSON 为准） |
| 默认页性能正文与 JSON 真源样本不一致 | 算不准 | 同上 | 统一为 `default-page-cold-load.json` max 240ms（240/159/158/158/158） | 否 |
| 矩阵缺 §1/§12/§4.5/②完成条件原子覆盖 | 漏做风险 | 产品/验收 | 已补 §3 覆盖与 TEST-025～027；产品确认待补 | 否（正向可追溯；新增 3 行待产品确认） |
| 详情文本框每键触发整页重绘，物流/采购等输入被清空，UI 无法推进到④样衣入库 | 做错风险/操作低效 | 买手/仓储 | `handlePcsTestingOrderInput` 原恒返回 true 且不写状态 → main input 分发重绘清值；改为返回 false（值仅在按钮动作时读取）；修复后 SPA 推进到④面板浏览器 PASS | 否（`detail-render-acceptance.json` 2/2 PASS + `pcs-testing-order.spec.ts` PASS + `npm test` 411/411） |

## 6. 最终结论

结论：通过

说明：

- **交付与接受**：功能提交 `f62108bd`，合并 `main` `1fce47c2` 已推送 `origin/main`（`delivered`）；产品确认人 laoertongxue 于 2026-09-23 明确接受 `1fce47c2`（GitHub commit comment `#commitcomment-201603472`，https://github.com/laoertongxue/higoods/commit/1fce47c2e7845e05fb142d51b0d5d4f25782ed61#commitcomment-201603472）。交付状态：**`accepted`**。
- WP-02～WP-06 边界与总体设计 §5～§9、§11、§13 及实施计划 WP-02～WP-06 一致；档案门禁删除、回写清单冻结、变种血缘、测款单十步（含④样衣入库与 §4.5 团队展示）、样衣双类型/位置主数据/打标门禁均已落地。
- `check-production-object-overview` 失败根因既有（PH-20260328-007）；本任务仅改脚本路径字面量，不纳入本记录通过条件。
- 性能（AGENTS.md §7.2）：受影响页面冷加载与交互测量见 `/tmp/pcs-wp01/default-page-cold-load.json`（WP-01 已测，默认页切换 5/5 max 240ms < 500ms）。本包新增/修改页面（测款单列表、测款单详情、物料变种页签、样衣管理）在当前工作树与 HEAD `5fdc7a4c` 下以 `vite preview` 构建产物 + Playwright chromium headless 各测 ≥5 样本，全部 <500ms；原始耗时与脚本见收据配套证据（若某入口样本缺失则该项按未完成处理，不得标记已验证）。


- 性能补测（2026-09-23 收尾，当前 HEAD `5fdc7a4c` + 工作树 `nowText` 修复后）：
  - 默认页 `/pcs/products/styles` 冷加载 5 次：max 240ms < 500ms，`/tmp/pcs-wp01/default-page-cold-load.json`，脚本 `/tmp/pcs-wp01/cold-load-default-page.mts`。
  - 受影响路由冷加载/站内切换 5 样本/入口：测款单列表、测款单列表二次导航、款式档案、渠道商品、渠道店铺、测款单详情 `to_seed_normal` 全部 pass，max 172ms < 500ms，`/tmp/pcs-wp01/affected-routes-cold-load.json`，脚本 `/tmp/pcs-wp01/cold-load-affected-routes.mts`。
  - 环境：chromium headless、cacheEnabled=false、`http://127.0.0.1:4173`（`npm run build` + `vite preview`）、1366 视口约定。
- 性能与大图终验收（2026-09-23 收尾补测，HEAD `5fdc7a4c` + 当前工作树，`vite preview` 构建产物）：
  - 16 入口交互/冷加载 5 样本/入口全部 PASS，max 177ms < 500ms：`/tmp/pcs-wp01/interaction-perf.json`（含 `cold-samples-inventory` max 177ms、`cold-samples-ledger` max 139ms、`cold-materials-fabric` max 132ms、`lightbox-testing-detail-image` max 25ms、`interact-product-archive-image-preview` max 95ms、`interact-testing-*` 测款 max ≤110ms、`interact-testing-bulk-visible` max 38ms 真实点击待定、`interact-sample-*` max ≤94ms、`interact-material-*` max ≤77ms；bulk 原 0ms 假样本已修复，以最新一次完整重测为准）。
  - 大图浏览器验收 5 例全 PASS（打开 → Esc 关闭 → 关闭按钮）：`/tmp/pcs-wp01/image-lightbox-acceptance.json`（TEST-022-detail、TEST-022-list、MAT-013-fabric、SAMP-013-inventory、ARCH-style-list）。
  - 冷加载复测（3 条样衣/物料路由 + 测款单列表）max 142ms PASS：`/tmp/pcs-wp01/cold-recheck.json`（与 `interaction-perf.json` 同源测量一致；早期并发噪声样本不作为证据）。
  - 环境：chromium headless、cacheEnabled=false、`http://127.0.0.1:4173`、1366×768、HEAD `5fdc7a4c` + 当前工作树。
- 详情渲染与④样衣入库面板浏览器验收（输入重绘修复后，HEAD `5fdc7a4c` + 工作树含 `handlePcsTestingOrderInput` 修复，重建 `vite preview`）：
  - `/tmp/pcs-wp01/detail-render-acceptance.json` 2/2 PASS：`DETAIL-TEAM-STEPS`（`to_seed_normal` 当前步骤责任团队=买手、十步标题含④样衣入库）、`SAMPLE-INBOUND-PANEL-UI`（结束 TO-0001 → SPA 新建 → 推进至④，面板文案 + 团队=仓储/现场）。
  - 截图：`/tmp/pcs-wp01/detail-team-steps.png`、`/tmp/pcs-wp01/sample-inbound-panel.png`；脚本 `/tmp/pcs-wp01/detail-render-acceptance.mts`。
  - 渲染契约补测：`renderPcsTestingOrderDetailPage(orderId)` 在 sample-inbound 步断言团队/面板/按钮 6/6 PASS。
  - 回归：`tests/pcs-testing-order.spec.ts` PASS；`npm test` 411/411；`npx tsc --noEmit` 任务范围 `pcs-testing-order*` 0 错；`npm run build` PASS。

### 反向追踪补充（收尾）

- 旧用户可见面：`src/router` / `app-shell-config` / `pcs-handlers` 中 `pcs/projects`、`pcs/testing/live`、`pcs/testing/video`、`renderPcsLive*`、`renderPcsVideo*`、`renderPcsResetPlaceholder`、`pcs-menu-projects` 残留 = 0；旧文案「预售测款通过 / 测款通过才 / 可无码流转」= 0。
- `src/pages/pcs-projects.ts`、`pcs-projects-list.ts`、`pcs-live-testing.ts`、`pcs-video-testing.ts`、`pcs-reset-placeholder.ts` 文件不存在；`scripts/standard-list-page-baseline.json` 仅删除上述 4 个已删页面条目（无哈希改写）。
- `pcs-live/video-testing-*` 数据层仍被 `pcs-project-relation-repository` / `pcs-project-instance-model` / `pcs-channel-product-project-repository` 作历史关系投影只读引用：设计 §4.6 对旧直播/短视频测款仅要求删除独立列表页/详情页及菜单（已满足），无用户可见入口；生产准备依赖的共享 relation 仓储按 CLEAN-003 保留。**存储键例外（A-09）**：`higood-pcs-live-testing-store-v1`、`higood-pcs-video-testing-store-v1` 仅服务上述只读历史投影的 localStorage 持久化，无页面/菜单/事件写入口；清理存储键会破坏生产准备 relation 回读，故正式记例外而非删除。不作为本包越界实现。
- GATE-006 冻结回归：`pcs-production-preparation-transition`、`pcs-design-revision-production-preparation-five-flows`(5/5)、`pcs-engineering-bom-version-workflow`、`pcs-engineering-preparation-projection`、`pcs-production-engineering-full-flow`、`pcs-engineering-preparation-color-projection` 均 PASS；九列表菜单项仍在 `pcs-menu-production-preparation`。`pcs-tech-pack-bom-pricing-page.spec` / `production-preparation-timing-filters.spec` 失败为任务边界外既有问题（相关测试文件工作树未改），不纳入本包阻断。`check-production-object-overview`：本任务 diff 仅 `scripts/check-production-object-overview.ts` 路径字面量 `/pcs/projects`→`/pcs/products/styles`（A-08 更正，非「相关文件未改」），失败根因仍为既有 PH-20260328-007 数据问题，属边界外。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pcs-archive-writeback-contract.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-material-archive-types.ts`
- `src/data/pcs-material-variant-fcs-dict.ts`
- `src/data/pcs-material-variant-repository.ts`
- `src/data/pcs-material-variant-types.ts`
- `src/data/pcs-pattern-task-repository.ts`
- `src/data/pcs-pattern-task-types.ts`
- `src/data/pcs-product-lifecycle-governance.ts`
- `src/data/pcs-project-demo-seed-service.ts`（删除）
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-image-types.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-style-archive-generation.ts`
- `src/data/pcs-sample-location-master.ts`
- `src/data/pcs-sample-management.ts`
- `src/data/pcs-sku-archive-repository.ts`
- `src/data/pcs-sku-archive-types.ts`
- `src/data/pcs-style-archive-bootstrap.ts`
- `src/data/pcs-style-archive-repository.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
- `src/data/pcs-testing-order-repository.ts`
- `src/main-handlers/pcs-handlers.ts`
- `src/pages/pcs-channel-products.ts`
- `src/pages/pcs-engineering-tasks/shared.ts`
- `src/pages/pcs-live-testing.ts`（删除）
- `src/pages/pcs-material-archives.ts`
- `src/pages/pcs-product-archives.ts`
- `src/pages/pcs-projects-list.ts`（删除）
- `src/pages/pcs-projects.ts`（删除）
- `src/pages/pcs-reset-placeholder.ts`（删除）
- `src/pages/pcs-sample-management.ts`
- `src/pages/pcs-technical-data.ts`
- `src/pages/pcs-testing-order-detail.ts`
- `src/pages/pcs-testing-order-list.ts`
- `src/pages/pcs-video-testing.ts`（删除）
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`
- `src/router/routes.ts`
- `src/state/store.ts`

### 页面路由

- 新增且命名页可打开：`/pcs/testing/orders`（列表）、`/pcs/testing/orders/:id`（详情，动态 `pattern.test('/pcs/testing/orders/to_seed_normal')`）；菜单组 `pcs-menu-testing` 含 `pcs-menu-testing` 子项 href `/pcs/testing/orders` 标题「测款单」
- 删除且冒烟未匹配：`/pcs/projects`、`/pcs/projects/create`、`/pcs/testing/live`、`/pcs/testing/video`、`/pcs/materials/packaging`、`/pcs/workspace/*`、`/pcs/reset-placeholder`（沿用 WP-01）
- 保留且可渲染：`/pcs/products/styles`、`/pcs/products/channel-products`、`/pcs/channels/stores`、物料详情变种页签、样衣管理页

### 验证命令

- `npm test`（411/411）：通过
- `npm run build`：通过（8.84s）
- `npm run check:menu-routes`：通过
- `npm run check:list-page-governance`：通过（scanned 556 pages, baseline 12；template check passed）
- `npx tsc --noEmit`（任务范围内 `pcs-testing-order|pcs-sample-management|pcs-material-archives|pcs-material-variant|pcs-sample-location|pcs-archive-writeback` 过滤）：通过（0 错误）
- `npx tsx tests/pcs-testing-order.spec.ts`：通过
- `npx tsx tests/pcs-product-archives.spec.ts`：通过
- `npx tsx tests/pcs-material-variant.spec.ts`：通过
- `npx tsx tests/pcs-sample-management.spec.ts`：通过
- `npm run check:prototype-design-governance -- --all`：通过（本记录作为关联审查记录）
- `codegraph sync` / `codegraph status`：通过
- `npm run workflow:verify -- --output /tmp/pcs-wp01/task-receipt.json --task-boundary "PCS商品中心重构 WP-02～WP-06"`：通过（`state=verified`, blockers `[]`）
- 冷加载 `npx tsx /tmp/pcs-wp01/cold-load-default-page.mts`（5 次，max 240ms < 500ms）：通过（`/tmp/pcs-wp01/default-page-cold-load.json`）

- `npx tsx tests/pcs-production-preparation-transition.spec.ts`：通过
- `npx tsx tests/pcs-design-revision-production-preparation-five-flows.spec.ts`：通过（5/5）
- `npx tsx tests/pcs-engineering-bom-version-workflow.spec.ts`：通过
- `npx tsx tests/pcs-engineering-preparation-projection.spec.ts`：通过
- `npx tsx tests/pcs-production-engineering-full-flow.spec.ts`：通过
- `npx tsx tests/pcs-engineering-preparation-color-projection.spec.ts`：通过
- 受影响路由冷加载 `npx tsx /tmp/pcs-wp01/cold-load-affected-routes.mts`（5 样本/入口，max 172ms < 500ms）：通过（`/tmp/pcs-wp01/affected-routes-cold-load.json`）
- 交互/冷加载终测 `npx tsx /tmp/pcs-wp01/interaction-perf.mts`（16 入口 × 5 样本，max 177ms < 500ms，bulk 真实点击 38ms）：通过（`/tmp/pcs-wp01/interaction-perf.json`）
- 大图验收 `npx tsx /tmp/pcs-wp01/image-lightbox-acceptance.mts`（5 例：打开/Esc/关闭按钮）：通过（`/tmp/pcs-wp01/image-lightbox-acceptance.json`，cases=5）
- 冷加载复测 `npx tsx /tmp/pcs-wp01/cold-recheck.mts`（样衣×2/物料/测款单列表，max 142ms）：通过（`/tmp/pcs-wp01/cold-recheck.json`）
- 详情渲染与④样衣入库面板 `npx tsx /tmp/pcs-wp01/detail-render-acceptance.mts`（DETAIL-TEAM-STEPS + SAMPLE-INBOUND-PANEL-UI，输入重绘修复后重建 preview）：通过（`/tmp/pcs-wp01/detail-render-acceptance.json`，cases=2）
- 大图验收复跑（输入修复后）`npx tsx /tmp/pcs-wp01/image-lightbox-acceptance.mts`：通过（cases=5）
- `npm test`（输入修复后全量复跑 411/411）：通过
- `npx tsc --noEmit`（过滤 `pcs-testing-order`）：通过（0 错误）
- `npm run build`（输入修复后）：通过

### 真实图片验证

- 测款单列表/详情款式缩略图与款号/款名同块展示，来自 `file.higood.id` 或既有款式 `mainImageUrl`；缩略图按钮带 `data-pda-image-preview-url`，点击打开 `role=dialog` 大图（遮罩 + 关闭按钮 + Esc）。
- 物料变种页签展示基础态/染色/后整理变种码（`CNIDML130-BASE`、`CNIDML130-apricot-17-4030PT` 等），实物图沿用物料档案既有图片（五类均有图）；面料列表缩略图同一预览链路。
- 样衣库存表格/卡片/抽屉详情图均接 `data-pda-image-preview-url`；`/pcs/samples/inventory` 大图 5 路径 PASS。
- 款式档案列表 `renderStyleImagePreviewButton` 本页预览（`open-image-preview` 遮罩 + × 关闭 + Esc）与全站 PDA 大图并存；`/pcs/products/styles` ARCH 例 PASS。
- 浏览器证据：`/tmp/pcs-wp01/image-lightbox-acceptance.json`（TEST-022-detail、TEST-022-list、MAT-013-fabric、SAMP-013-inventory、ARCH-style-list 全 PASS，每例 load → thumb-visible → open → esc-close → button-close）。

### 例外

- `check-production-object-overview` 既有失败（见第 6 节），不作为本包阻断项。
- 无其他例外（§7.2 已对受影响页面补测量；若缺样本则对应需求不得标「已验证」）。
