# 生产工艺路线与全阶段加工单增量迭代原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-09-09 |
| 相关需求 / 任务 | 生产工艺路线与全阶段加工单增量迭代；`GOV-001～012`、`ROUTE-001～020`、`BOM-001～005`、`EXEC-001～019`、`RPREP-001～007`、`RPROD-001～012`、`RPOST-001～028`、`CLEAN-001～010`、`TEST-001～007` |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PCS / FCS / PFOS / WLS |
| 涉及页面路径 | 技术包常规 BOM 与工艺路线、印花/染色/水溶加工单、专项仓库、PDA 执行、印花确认单及既有后道全流程；独立烫画 BOM 排除 |
| 端类型 | 管理端 / 主管端 / 员工执行端 / 打印 |
| 主要角色与任务 | 计划/管理人员查看来源与三个状态；工艺工厂接收、加工和交出；仓管接收；PDA 员工执行一个当前主动作 |
| 实施分支 | `codex/process-route-full-stage-incremental` |
| 基线 HEAD | `8d8f8ffd43d1000d9c852a1cffbb4c73e16bee12` |
| 实施工作树 | `/Users/laoer/Documents/higoods/.worktrees/process-route-full-stage-incremental` |
| 本地服务 | `http://127.0.0.1:5188/`；局域网 `http://192.168.0.17:5188/` |

## 2. 影响判定

- 用户可见影响：有
- 判定依据：常规 BOM 按线上 18 列、款色合并行、颜色级和行级操作维护，物料从带真实图片的物料档案选择；面料捆条、辅料橡筋定长切割与三阶段路线读取同一 BOM 行。技术包工艺路线收口为唯一三阶段工作区；准备阶段按 BOM 物料并行，各物料行直接前移/后移并由顶部统一确认；生产阶段显示裁剪、纸样包逐片工艺、BOM 绑定的面辅料加工与车缝汇合。加工单列表和详情新增独立接收状态及唯一接收方，收窄交出状态；非裁片/车缝的“备料/配料”改为投入接收。独立烫画 BOM 未改动。

当前审查基线为 `AGENTS.md` 第 4 节印尼工厂现场产品设计基线、第 5 节 UI/列表/真实图片门禁和第 7 节分层验证要求。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | 管理端保留完整来源、投入、要求、产出和三个状态；PDA 水溶详情只有一个“完成水溶”主动作 |
| 技术包路线可读性 | 通过 | 单一工作区直接显示准备→生产→后道；准备阶段每条 BOM 独占一行并直接前移/后移；生产阶段在 1280×720 可见裁剪→裁片并行→车缝箭头；页面没有二级 Tab 和画布工具栏 |
| 常规 BOM 线上样式 | 通过 | 表头顺序为线上 18 列，按款色合并行；颜色级添加/整色复制改为单行紧凑操作，数据行固定为可读密度；删除重复的“常规物料”标题和外层卡片边框，仅保留表格边界；行级编辑/复制/删除、行内用量/单位/损耗/四类需求/绑定工艺均保留；烫画 BOM 未改动 |
| 技术包头部信息密度 | 通过 | 保留标题、状态标识、版本、款式名称、做货难度、审核操作和关键项检查；删除技术包状态、当前生效版本、来源任务链和归档状态四项重复或低频信息 |
| BOM 绣花与绑定工艺 | 通过 | BOM 绣花生成准备阶段节点；面料只可单选捆条、辅料只可单选橡筋定长切割；腰口定长橡筋在生产阶段单独显示第 1 道橡筋定长切割，并与裁片共同汇入车缝 |
| 文案、状态、数量与单位 | 通过 | 接收、加工、交出分开计算；交出不再混入下游接收；普通列表移除历史提示、兼容说明和段落式算法解释 |
| 扫码、真实图片与对象识别 | 通过 | 当前涉及的款式、物料和花型图片全部实际加载；常规 BOM 腰口定长橡筋使用对应实拍图，缩略图与对象名称/编码同区；点击可看大图，关闭按钮和 Esc 可关闭；无图片物料不能保存 |
| 防错、危险确认与主管兜底 | 通过 | 无中央仓调拨/直接上游交出、错来源、重复接收、多个接收方、首次交出后改目标均有阻断或更正路径 |
| 交接、跨端事实与异常追溯 | 通过 | 上游交出与下游接收使用同一原记录；一张加工单只有一个接收方，可多批交出；后道连续两次跨端全链通过 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | 管理端 1366×768、1280×720、1024×768 与 PDA 390×844、360×800 无页面主体横向溢出；本次不新增上传和真实弱网基础设施 |
| 命名路由、交互、图片大图与打印 | 通过 | 技术包、印花、染色、水溶、PDA 和印花确认单均在当前服务验证；图片大图和打印 PDF 通过 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 原交出状态混入下游接收 | 状态抽象 / 协作断裂 | 计划、工厂、仓管 | 拆为接收、加工、交出三个维度；上游只读下游接收摘要 | 否 |
| 首道加工可无来源登记投入 | 追溯不足 | 工厂、仓管 | 必须引用中央仓原调拨；非首道必须引用直接上游原交出 | 否 |
| 路线分支可让一张加工单出现多个接收方 | 选不对 / 协作断裂 | 计划、工厂 | 执行单生成前按接收方拆单，首次有效交出后冻结目标 | 否 |
| 列表解释性文案过多 | 读不懂 / 字段过载 | 管理人员 | 删除历史提示、兼容说明和算法解释；保留业务字段与当前动作 | 否 |
| 部分专项页面图片缺少统一来源 | 对象识别 / 视觉干扰 | 管理、执行人员 | 增加对象级 manifest 和真实素材；统一缩略图与大图交互 | 否 |
| 宽表可能撑宽页面 | 组件误用 | 管理人员 | 页面主体限制宽度，宽表仅容器内滚动；按多尺寸实测 | 否 |
| 独立画布节点过小、操作复杂 | 看不清 / 顺序不明 | 跟单、工艺人员 | 删除独立画布，在三阶段路线的 BOM 物料行内用第 N 道和前移/后移直接排序 | 否 |
| 原页面没有三阶段主干 | 看不清 / 顺序不明 | 跟单、工艺人员 | 默认改为准备、生产、后道三阶段；准备按 BOM 并行，生产明确裁剪、裁片并行和车缝汇合 | 否 |
| 三个二级视图分散展示、排序与明细 | 读不懂 / 操作复杂 | 跟单、工艺人员 | 删除“三阶段路线/准备顺序/工艺明细”按钮，只保留三阶段内容和顶部统一确认 | 否 |
| 裁片多工艺顺序可被路线页重复维护 | 事实源冲突 | 版师、跟单 | 纸样包显示第 N 道并支持上移/下移；路线同步按纸样顺序生成，路线页阻断对纸样节点改边 | 否 |
| BOM 绣花和裁片绣花可能混为一类 | 路线阶段错误 | 跟单、工艺人员 | BOM 绣花固定生成准备阶段物料节点；纸样包逐片绣花仍生成生产阶段裁片节点 | 否 |
| 捆条/橡筋加工单可能回退到泛用物料 | 对象来源错误 | 计划、工厂 | BOM 绑定工艺按类型单选，路线 occurrence 和实际加工单均保存所绑定 BOM 行 | 否 |
| 常规 BOM 与线上维护方式不一致 | 操作路径变化 / 字段遗漏 | 跟单、工艺人员 | 恢复线上 18 列、款色合并行、颜色级和行级操作；扩展资料留在编辑弹窗 | 否 |
| 常规 BOM 物料图片缺失或与对象不符 | 对象识别 | 跟单、工艺人员 | 只能选择带真实图片的物料档案；缩略图点击高清大图，失败态可见 | 否 |
| 款色操作换行将单条 BOM 撑高，字段和控件显得松散 | 字段过载 / 视觉干扰 | 跟单、工艺人员 | 颜色操作单行显示，18 列使用固定列宽和统一控件高度；页面宽度不变 | 否 |
| 技术包头部重复状态与来源信息过多 | 字段过载 / 视觉干扰 | 跟单、工艺人员 | 删除技术包状态、当前生效版本、来源任务链和归档状态，保留标题级状态标识与核心操作 | 否 |
| 常规 BOM 重复标题和外层卡片造成层级过重 | 视觉干扰 | 跟单、工艺人员 | 删除“常规物料”标题及外层线框，保留表格自身边界 | 否 |

## 6. 最终结论

结论：通过

说明：当前分支的软件实现、专项契约、命名页面、PDA、真实图片、大图、打印、尺寸和后道跨端回归均形成当前证据。结论对应本地 `verified`；用户尚未对当前版本作产品接受回执，因此不标记 `accepted`。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/dye-work-order-online-domain.ts`
- `src/data/fcs/dye-work-order-online-view.ts`
- `src/data/fcs/dyeing-material-receipts.ts`
- `src/data/fcs/dyeing-task-domain.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/pda-task-mock-factory.ts`
- `src/data/fcs/preparation-material-receipt-sources.ts`
- `src/data/fcs/printing-material-receipts.ts`
- `src/data/fcs/printing-task-domain.ts`
- `src/data/fcs/printing-work-order-business.ts`
- `src/data/fcs/process-action-writeback-service.ts`
- `src/data/fcs/process-execution-writeback.ts`
- `src/data/fcs/process-order-flow-contract.ts`
- `src/data/fcs/process-order-image-manifest.ts`
- `src/data/fcs/process-order-input-transfer-fixtures.ts`
- `src/data/fcs/process-order-receiving-target.ts`
- `src/data/fcs/process-order-three-axis-view.ts`
- `src/data/fcs/process-platform-status-adapter.ts`
- `src/data/fcs/process-quantity-labels.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/process-warehouse-domain.ts`
- `src/data/fcs/process-web-status-actions.ts`
- `src/data/fcs/production-confirmation.ts`
- `src/data/fcs/special-craft-task-orders.ts`
- `src/data/fcs/tech-packs.ts`
- `src/data/fcs/warehouse-material-execution.ts`
- `src/data/fcs/water-soluble-material-receipts.ts`
- `src/data/fcs/water-soluble-task-domain.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/print/templates/printing-work-order-template.ts`
- `src/pages/process-dye-orders.ts`
- `src/pages/process-factory/cutting/binding-strip-order-types.ts`
- `src/pages/process-factory/cutting/binding-strip-orders.ts`
- `src/pages/process-factory/dyeing/combined-dyeing.ts`
- `src/pages/process-factory/dyeing/dye-orders.ts`
- `src/pages/process-factory/dyeing/reports.ts`
- `src/pages/process-factory/dyeing/water-soluble-orders.ts`
- `src/pages/process-factory/dyeing/work-order-detail.ts`
- `src/pages/process-factory/dyeing/work-order-overlays.ts`
- `src/pages/process-factory/dyeing/work-orders.ts`
- `src/pages/process-factory/printing/dashboards.ts`
- `src/pages/process-factory/printing/dialogs.ts`
- `src/pages/process-factory/printing/events.ts`
- `src/pages/process-factory/printing/pending-review.ts`
- `src/pages/process-factory/printing/work-order-detail.ts`
- `src/pages/process-factory/printing/work-orders.ts`
- `src/pages/process-print-orders.ts`
- `src/pages/process-water-soluble-orders.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/bom-domain.ts`
- `src/pages/tech-pack/core.ts`
- `src/pages/tech-pack/color-mapping-domain.ts`
- `src/pages/tech-pack/bom-process-linkage.ts`
- `src/pages/tech-pack/dialogs.ts`
- `src/pages/tech-pack/events.ts`
- `src/pages/tech-pack/pattern-domain.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/pages/tech-pack/process-route-logicflow.ts`（已删除）
- `src/data/tech-pack-process-route.ts`
- `src/data/pcs-engineering-bom-pricing.ts`
- `src/data/pcs-material-archive-repository.ts`
- `src/data/pcs-tech-pack-review-diff.ts`
- `src/data/pcs-technical-data-version-bootstrap.ts`
- `src/data/pcs-technical-data-version-types.ts`

### 页面路由

- `/pcs/technical-data/tech-packs` 及 `/pcs/products/styles/:styleId/technical-data/:versionId` 的工艺路线页签
- `/pcs/products/styles/:styleId/technical-data/:versionId` 的物料清单页签（仅常规 BOM；烫画 BOM 排除）
- `/fcs/craft/printing/work-orders`
- `/fcs/craft/dyeing/work-orders`
- `/fcs/process/water-soluble-orders`
- `/fcs/craft/dyeing/water-soluble-orders`
- `/fcs/pda/exec/:taskId`
- `/fcs/print/preview?documentType=PRINTING_CONFIRMATION&sourceType=PRINTING_WORK_ORDER&sourceId=PWO-PRINT-001`
- 既有后道 Web、PDA、仓库和打印入口（由两次跨端全链验证覆盖）

### 验证命令

- 常规 BOM/路线/生成：`check:tech-pack-bom-unit-guard`、`check:tech-pack-process-route`、`check:cutting-binding-strip-flow`、`check:process-route-material-replacement`、`check:process-order-task-relations`、`check:production-process-work-order-generation`、`check:process-work-order-generation-service-isolated`：通过
- 三状态/来源：`check:process-order-three-axis-flow`、`check:preparation-real-receipt-chain`、印花/染色/水溶来源和分批专项检查：通过
- 准备域：印花、染色、合并染色、水溶的业务、页面、PDA、权限和打印专项检查：通过
- 生产域：裁片放行、裁剪/车缝、毛织、花边、辅助/特种工艺、统一仓库专项检查：通过
- 后道：full-flow、surface、traceability、当前读模型、管理列表、QC、出货打印、跨端 UI/证据等专项检查：通过
- `npm run check:process-route-full-stage-delivery`：通过，PREP 12 + PROD 28 + POST 17，共 57 项
- `npm run check:process-order-real-images`：通过
- `npm run typecheck`：通过
- `npm run build`：通过
- `npm run check:list-page-governance`：通过
- `npm run check:prototype-design-governance`：通过
- `git diff --check`：通过
- `codegraph sync .`、`codegraph status .`：通过，索引无待同步文件
- `npm run workflow:verify -- --output /tmp/process-route-full-stage-incremental/task-receipt.json --task-boundary "技术包头部按线上信息密度收口，删除四项冗余事实；常规 BOM 删除重复标题和外层边框"`：通过

### 浏览器证据

- `output/playwright/process-route-incremental/tech-pack-single-three-stage-route-1366x768.png`（单一三阶段工作区；旧二级切换按钮已删除）
- `output/playwright/process-route-incremental/tech-pack-inline-prep-ordering-1280x720.png`（准备阶段 BOM 行内排序、统一确认；页面主体无横向溢出）
- `output/playwright/process-route-incremental/tech-pack-three-stage-route-all-stages.png`（同一工作区内准备、生产、后道阶段连续展示）
- 当前页面实测：首条 BOM 从“染色→印花”调整为“印花→染色”，点击“确认工艺路线”后显示“路线已确认”，刷新重开后顺序与确认状态保持一致；1366×768、1280×720 下 `documentElement.scrollWidth === innerWidth`；控制台 error 为 0。
- 当前页面实测：将 `ACC-ELASTIC-42CM` 的印花需求从“数码印”改回“无”后，准备阶段立即恢复为“无需准备加工”，旧印花节点不再保留；生产阶段仍保留“第 1 道 橡筋定长切割”。
- `output/playwright/process-route-incremental/tech-pack-bom-left-final-1366x768.png`（BOM 左侧身份列、SKU 不竖排，页面主体无横向溢出）
- `output/playwright/process-route-incremental/tech-pack-bom-craft-fields-final-1366x768.png`（表格内部滚动后的绣花需求和绑定工艺）
- `output/playwright/process-route-incremental/tech-pack-regular-bom-online-layout-1366x768.png`（线上 18 列、款色分组及表格内部滚动）
- 当前 Chrome 页面实测：常规 BOM 保留线上 18 列；表头 40px、两条物料行均为 61px；表格宽 1840px，仅在 1388px 容器内横向滚动，页面 `documentElement.scrollWidth === innerWidth === 1710`；右侧绣花需求、绑定工艺和操作区滚入可见后布局完整。
- 当前 Chrome 页面实测：头部不再出现“技术包状态、是否当前生效版本、来源任务链、归档状态”；常规 BOM 不再显示重复标题，外层容器 `borderTopWidth === 0px` 且背景透明；表格自身边界保留，1840px 内容仅在 1420px 表格容器内滚动，页面 `documentElement.scrollWidth === innerWidth === 1710`。
- 当前 Chrome 页面实测：历史面料 `tdv_seed_project_018_base-bom-main` 缩略图实际加载 `/materials/fabric-main.jpg`，点击后大图加载完成且弹窗完整位于视口内，关闭按钮可关闭。
- `output/playwright/process-route-incremental/tech-pack-regular-bom-elastic-binding-1280x720.png`（真实橡筋物料与橡筋定长切割绑定）
- `output/playwright/process-route-incremental/tech-pack-elastic-real-image-large-1280x720.png`（腰口定长橡筋高清大图）
- `output/playwright/process-route-incremental/tech-pack-elastic-production-route-1280x720.png`（生产阶段第 1 道橡筋定长切割）
- `output/playwright/process-route-incremental/tech-pack-bom-embroidery-binding-route-final-1280x720.png`（准备阶段 BOM 绣花与三阶段顺序）
- `output/playwright/process-route-incremental/tech-pack-bom-embroidery-binding-route-detail-final-1280x720.png`（生产阶段捆条分支与车缝汇合）
- `output/playwright/process-route-incremental/printing-list-final-1366x768.png`
- `output/playwright/process-route-incremental/printing-large-image-1366x768.png`
- `output/playwright/process-route-incremental/dye-large-image-1280x720.png`
- `output/playwright/process-route-incremental/water-platform-1024x768.png`
- `output/playwright/process-route-incremental/water-factory-1024x768.png`
- `output/playwright/process-route-incremental/water-pda-390x844.png`
- `output/playwright/process-route-incremental/printing-confirmation-final-1366x768.png`
- `output/playwright/process-route-incremental/printing-confirmation-final.pdf`
- `output/verification/post-finishing-full-flow/2026-09-08-final-pass-1/`
- `output/verification/post-finishing-full-flow/2026-09-08-final-pass-2/`

### 真实图片验证

- 图片来源：商品/技术包现有正式款式图，`public/materials/fei-ticket/`、`public/materials/process-orders/` 已登记对象级素材，以及 `public/materials/accessory-elastic-band.jpg` 的实际松紧带照片；来源和许可保存在 `public/materials/sources.json`。
- 对象对应：`process-order-image-manifest.ts` 按印花单、染色单、水溶物料业务 ID 显式绑定，不按工艺类型随机复用。
- 列表与详情：款式/物料缩略图和名称、编码同区展示；当前印花列表 41 张图片逐张触发懒加载后全部 `naturalWidth > 0`。
- 大图：印花款式图 1024×1024、染色款式图 1024×1024、水溶物料图 1200×1200 均能打开，保持比例且不溢出；关闭按钮和 Esc 均有效。
- 失败态：保留明确加载失败提示，不静默显示浏览器破图。
- 常规 BOM：每条物料从物料档案解析图片；腰口定长橡筋 `ACC-ELASTIC-42CM` 使用对应实际松紧带照片；历史演示物料 `tdv_seed_project_018_base-bom-main` 使用已登记的实际面料色卡图。当前 Chrome 实测两张缩略图均 `naturalWidth > 0`，点击历史演示物料缩略图可打开 960×625 高清大图。保存新物料时，没有真实图片的档案被阻断。

### 例外

- 独立烫画 BOM 按用户明确范围不改动、不迁移、不纳入本轮页面验收。

### 纸样与款色映射视觉精简

- 删除纸样管理重复标题与外层卡片，将添加纸样包移至纸样池标题行右侧；保留纸样包卡片。
- 物料与纸样关联表添加外框和全部表头、单元格横纵线，宽表在容器内滚动。
- 款色用料对应在编辑、只读两种视图均删除重复标题、外层卡片及整组映射备注区，保留行备注。
- 当前 5188 工作树 Chrome 实测：纸样池与添加按钮同排；关联表全部单元格底线及非末列右线均为 1px，外框 1px；款色页面重复标题与映射备注控件数量均为 0；两个页面主体宽度与视口均为 1710px。历史演示纸样原文件/图片缺失仍明确显示，本次不以无关素材补充。
