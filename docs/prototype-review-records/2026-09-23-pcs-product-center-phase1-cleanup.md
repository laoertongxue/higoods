# HiGood 原型变更治理记录 — PCS 商品中心重构阶段① 清理（WP-01 / CLEAN-001～012）

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-23 |
| 相关需求 / 任务 | PCS 商品中心重构 WP-01；CLEAN-001～CLEAN-012；分支 `codex/shangpinzhongxinyouhua001` HEAD `5fdc7a4c` + 工作树未提交变更 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS |
| 涉及页面路径 | `/pcs`（默认跳 `/pcs/products/styles`）；删除：`/pcs/projects`、`/pcs/projects/create`、`/pcs/projects/*`、`/pcs/testing/live`、`/pcs/testing/video`、`/pcs/workspace/overview`、`/pcs/workspace/todos`、`/pcs/workspace/alerts`、`/pcs/materials/packaging`、`/pcs/materials/packaging/new`、`/pcs/channels/products/mapping`、`/pcs/products/channel-attributes`、`pcs-reset-placeholder` 通配 |
| 端类型 | 管理端（桌面 Web） |
| 主要角色与任务 | 中国管理 / 计划角色在 PCS 侧栏进入商品档案、渠道店铺、物料五类、生产准备；不再进入商品项目、独立直播/短视频测款、工作台占位、包材档案 |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：PCS 侧栏删除「工作台」「商品项目管理」「直播测款」「短视频测款」「包材档案」菜单组/项；PCS 系统默认页从 `/pcs/workspace/overview` 改为 `/pcs/products/styles`；删除商品项目列表/详情页、直播测款页、短视频测款页、包材档案入口、清空占位页；旧路径不再注册路由（访问落到应用级未匹配，约 200 字节提示）；store 中废弃 Tab（含渠道属性对应）迁移时直接丢弃而非重定向；「测款通过」驱动档案生效/技术包启用/需求来源默认值的现行写链与文案删除；花型/制版需求来源不再写「预售测款通过」。生产准备、商品档案、渠道店铺、样衣、技术资料、花型库等保留路由行为不变（冒烟见第 7 节）。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端信息密度与列表模式不变；删除的均为废弃模块入口，保留页仍为标准列表/任务页 |
| 文案、状态、数量与单位 | 通过 | 删除旧「测款通过」回写文案与「预售测款通过」枚举文案；保留页文案未改业务口径 |
| 扫码、真实图片与对象识别 | 通过 | 本次不新增款式/物料展示对象；保留页图片行为未改（`pcs-material-archives` 等仅删包材分类） |
| 防错、危险确认与主管兜底 | 通过 | 旧路径未匹配即通用未匹配页，无假成功入口；无新增危险动作 |
| 交接、跨端事实与异常追溯 | 不适用 | 本次不涉及 PDA / 打印 / 交接链路变更 |
| 低分辨率、PDA、弱网与上传恢复 | 不适用 | 纯删除入口与菜单，无新交互与上传路径 |
| 命名路由、交互、图片大图与打印 | 通过 | `check:menu-routes` PASS（217 href，duplicates 0）；冒烟 6 条保留路由可渲染、9 条删除路由未匹配；默认页 `/pcs/products/styles` 冷加载 5/5 通过（max 240ms，见第 6 节） |

## 4. 问题标签

- 无（阶段①边界内）；关联两轮审查问题见 WP-02～WP-06 记录与矩阵变更记录（默认页性能真源口径、测款单十步等修复不改变本记录删除边界结论）。

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 无（阶段①边界内） | 无 | 无 | 无 | 否 |

## 6. 最终结论

结论：通过

说明：

- 阶段① 删除边界与总体设计 §4.6、§5.2、实施计划 WP-01 一致；菜单、路由、页面、种子、事件处理器、store 死别名、包材分类、占位实现均已落地。
- `check-production-object-overview` 失败为既有问题（FCS 打印花工单 `PH-20260328-007` 关联生产单 `PO-20260328-077` 在 Mock 生产单库中不存在；本任务唯一脚本改动在断言之后，且 `src/data/fcs/*` 未改），记为任务边界外既有失败，不纳入 WP-01 通过条件。
- 性能（AGENTS.md §7.2）：默认页切换 `/pcs/products/styles` 冷加载测量 5 次全部通过。以 `/tmp/pcs-wp01/default-page-cold-load.json` 为真源，原始耗时 240 / 159 / 158 / 158 / 158 ms，max 240ms，阈值 500ms，判定通过。测量脚本 `/tmp/pcs-wp01/cold-load-default-page.mts`；环境：分支 `codex/shangpinzhongxinyouhua001` HEAD `5fdc7a4c` 工作树（后续业务修复会重跑该 JSON）、`vite preview` 构建产物 `http://127.0.0.1:4173`、Playwright chromium headless、每样本独立 context（`cacheEnabled: false`）、macOS。计时从 `page.goto` 到首屏正文就绪且含可交互元素（`button`/`a[href]`），内容抽查含商品中心默认页文案。删除路径不再进入业务页，无对应加载样本；保留页冒烟即时渲染，未另测交互入口（菜单/路由删除不新增交互样本）。历史行中「200/157/157/156/157ms，max 200ms」为过时口径，以当前 JSON 真值为准。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/app-shell-config.ts`
- `src/data/pcs-channel-product-project-repository.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-material-archive-types.ts`
- `src/data/pcs-pattern-task-repository.ts`
- `src/data/pcs-pattern-task-types.ts`
- `src/data/pcs-product-lifecycle-governance.ts`
- `src/data/pcs-project-demo-seed-service.ts`（删除）
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-image-types.ts`
- `src/data/pcs-project-inline-node-record-bootstrap.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-task-bootstrap.ts`
- `src/data/pcs-task-project-relation-writeback.ts`
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
- `src/pages/pcs-video-testing.ts`（删除）
- `src/router/route-renderers.ts`
- `src/router/routes-pcs.ts`
- `src/router/routes.ts`
- `src/state/store.ts`

### 页面路由

- 保留且冒烟可渲染：`/pcs`、`/pcs/products/styles`、`/pcs/production-preparation/tech-pack`、`/pcs/production-preparation/orders`、`/pcs/production-preparation/artwork`、`/pcs/channels/stores`
- 删除且冒烟未匹配（不渲染商品项目/直播测款/短视频测款/包材/概览看板真实页）：`/pcs/projects`、`/pcs/projects/create`、`/pcs/testing/live`、`/pcs/testing/video`、`/pcs/materials/packaging`、`/pcs/workspace/overview`、`/pcs/workspace/todos`、`/pcs/workspace/alerts`、`/pcs/reset-placeholder`

### 验证命令

- `npm test`（411/411）：通过
- `npm run build`：通过
- `npm run check:menu-routes`：通过
- `npm run check:list-page-governance:static`：通过（scanned 554 pages, baseline 12）
- `npm run check:standard-list-page-template`：通过
- 修改后的 23 个 spec（`node --experimental-strip-types --test`）：通过
- 修改后的 9 个 check scripts：8 通过；`npm run check:production-object-overview`：失败（既有，见第 6 节）
- 冒烟 `npx tsx /tmp/pcs-smoke.mts`（resolvePage 6 保留 + 9 删除）：通过
- 冷加载 `npx tsx /tmp/pcs-wp01/cold-load-default-page.mts`（5 次，max 240ms < 500ms，JSON 真源 `240/159/158/158/158`）：通过（`/tmp/pcs-wp01/default-page-cold-load.json`）
- `npm run check:prototype-design-governance -- --all`：通过（29 user-visible files, 1 linked record）
- `codegraph sync` / `codegraph status`：通过（Synced 2139 files；status Files 2139）
- `npm run workflow:verify -- --output /tmp/pcs-wp01/task-receipt.json`：通过（`status=verified`, blockers `[]`）

### 真实图片验证

- 本次删除入口与菜单，未新增款式/物料对象展示；保留页图片链路未改，不适用新增图片验收。

### 例外

- `check-production-object-overview` 既有失败（见第 6 节），不作为 WP-01 阻断项。
- 无（§7.2 已对默认页切换补 5 次冷加载测量并通过，见第 6 节）。
