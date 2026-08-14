# FCS 菲票打印列表标准化迁移需求追踪与交付矩阵

> 状态值只使用：待实施、实施中、已实现待验证、已验证、已阻塞、不适用。

## 1. 需求登记与交付证据

| 编号 | 来源章节 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面／图片／打印验证 | 状态 | 证据位置 | 产品确认人／版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCOPE-001 | 总体设计 2、4 | 仅迁移部位菲票和捆条菲票两个顶层列表；四项阻塞只补素材、稳定样本和既有 PDA 入口 | WP-2、WP-3、WP-7～WP-10 | `renderListPage`、两套列定义及四项点名修复文件 | 专项源码、双路由及四项阻塞契约通过 | `01-part-list-1366x768.png`、`02-binding-list-1280x720.png` | 已验证 | `tests/cutting-fei-ticket-standard-lists.spec.ts`；最终任务 diff | 用户待验收／`main@1decb915` 当前工作树 |
| SCOPE-002 | 总体设计 3、4.2 | 详情页、打印模板及详情分页不迁移；既有打印动作保持 | WP-6 | 既有 `renderDetailOrChildPage`、`renderPrintableUnitPage`、打印处理分支保持 | 分纸打印 6/6；打印路由回归通过 | `07-white-paper-print-preview.png`、`08-yellow-paper-special-craft-print-preview.png` | 已验证 | `check:cutting-fei-ticket-paper-routing`；当前打印截图 | 用户待验收／`main@1decb915` 当前工作树 |
| PAGE-001 | 总体设计 5 | 两个顶层路由均使用统一列表骨架 | WP-2、WP-3 | `renderListPage` 调用 `renderStandardListPage` | 双路由标准骨架／表格／分页断言通过 | 两个命名路由截图 | 已验证 | 专项 10/10 | 用户待验收／`main@1decb915` 当前工作树 |
| PART-001 | 总体设计 6.1 | 部位列表完整保留七列及原单元格信息 | WP-2 | `partListColumns`、`renderPart*Cell` | 七列表头和关键内容断言通过 | `01-part-list-1366x768.png` | 已验证 | 专项“部位菲票打印使用统一骨架…” | 用户／开工 HEAD `1decb915` |
| PART-002 | 总体设计 6.1 | 部位列表仍按铺布单／手动批次聚合 | WP-2 | `getPartListRows` 继续调用 `buildSpreadingPrintObjectRows` | 装配 6 项通过；首屏行数与分页总数断言通过 | 部位列表保留铺布单／手动批次 | 已验证 | 装配专项＋专项列表测试 | 用户／开工 HEAD `1decb915` |
| PART-003 | 总体设计 3、6.1 | 特殊工艺列不可隐藏，继续显示是否、工艺和工厂 | WP-2 | `partListColumns.specialCraft`、`renderPartSpecialCraftCell` | 必需列禁用隐藏及内容断言通过 | 普通／特殊工艺行和黄纸预览 | 已验证 | 专项列设置；`08-yellow-paper-special-craft-print-preview.png` | 用户／开工 HEAD `1decb915` |
| BIND-001 | 总体设计 6.2 | 捆条列表完整保留八列及原单元格信息 | WP-3 | `bindingListColumns`、`renderBinding*Cell` | 八列表头和关键内容断言通过 | `02-binding-list-1280x720.png` | 已验证 | 专项“捆条菲票打印使用统一骨架…” | 用户／开工 HEAD `1decb915` |
| BIND-002 | 总体设计 3、6.2 | 捆条仍按加工单聚合且一个宽度对应一张票 | WP-3 | `getBindingListRows` 继续调用 `buildBindingFeiTicketPrintRows` | 捆条生成、宽度和唯一票专项通过 | 捆条列表／详情入口 | 已验证 | `check:cutting-binding-strip-flow` | 用户／开工 HEAD `1decb915` |
| IMAGE-001 | 总体设计 4.1、6.2、8.2 | 当前两张菲票列表读取的全部物料使用对象对应效果图／正式物料图，且与身份同列，保留缩略图、大图和失败态 | WP-3、WP-7 | `resolveProductionMaterialImageUrl`、`enrichBomItemsWithMaterialAssets`、`resolveMaterialImageUrl`、`renderBindingMaterialCell`、`renderBindingMaterialPreview` | 点名 BOM 为正式 PNG；当前 17 个捆条加工单／15 个物料颜色身份全部为存在且大于 100KB 的 PNG，0 SVG、0 缺图；10 类当前列表资源；补充校验拼接面料 Black／Charcoal／Navy／Khaki 四色一一映射，未知颜色保持缺图；大图与失败态契约通过 | `02-binding-list-1280x720.png`、`03-spu-017-material-preview.png` | 已验证 | `tests/cutting-fei-ticket-standard-lists.spec.ts`；`public/materials/fei-ticket/sources.json` | 用户待验收／`main@1decb915` 当前工作树 |
| HANDOVER-001 | 总体设计 3.5、4.1、8.2 | 特殊工艺承接工厂待补充时必须保留候选并阻止正式交出单 | WP-8 | `buildContent` 补入未配置专用工厂的手工钉珠样本；既有 `listSpecialCraftHandoverCandidates` 门禁不变 | 可交出与“承接工厂待补充”不可交出候选同时存在；`check:cutting-clean-mainline` 通过 | 原因由待交出投影可见；自动化验证正式交出被阻止 | 已验证 | 全仓裁剪主线专项和任务收据 | 用户待验收／`main@1decb915` 当前工作树 |
| PDA-001 | 总体设计 2、4.1、8.2 | PDA 待交出仓必须提供菲票打编号入口并打开既有编号页 | WP-9 | `getPdaCuttingWaitHandoverActions`、`resolvePdaCuttingWaitHandoverLegacyActionRoute` | 七入口顺序、key、路由、旧 numbering 入口和编号专项通过 | `04-pda-seven-actions-390x844.png`、`05-pda-numbering-page-390x844.png` | 已验证 | PDA 路由专项＋列表专项 PDA 场景 | 用户待验收／`main@1decb915` 当前工作树 |
| PRINT-001 | 总体设计 4.1、8.2 | 基线投影必须稳定提供待首打单元，首次打印路由不得误入已打印页 | WP-10 | `buildCompletedSpreadingSeedStore`、`buildSystemSeedFeiTicketLedger`、`ensureTraceabilityTicketRecords` | 投影精确同时包含 `WAITING_PRINT`、`PRINTED`、`NEED_REPRINT`；首次打印 Playwright 通过 | `06-first-print-waiting.png` | 已验证 | `tests/cutting-fei-ticket-print-route.spec.ts` | 用户待验收／`main@1decb915` 当前工作树 |
| LIST-001 | 总体设计 7 | 两个路由默认每页 10 条，可选 10／20／50，并显示总数和范围 | WP-2、WP-3 | 两个标准列表 controller 的 `pageSizeOptions` | 默认值、选项、行数、总数、范围断言通过 | 双路由分页 | 已验证 | 专项 10/10 | 用户／开工 HEAD `1decb915` |
| LIST-002 | 总体设计 7 | 排序为升序、降序、恢复默认三态 | WP-2、WP-3 | `handleStandardListControllerEvent` → `cycleSort` | asc／desc／none 断言通过 | 部位列表排序 | 已验证 | 专项局部交互测试 | 用户／开工 HEAD `1decb915` |
| LIST-003 | 总体设计 7 | 支持列显示、顺序、冻结和恢复默认 | WP-2、WP-3 | 两套 controller、`handleStandardListControllerEvent` | 隐藏、冻结、拖拽顺序、恢复入口通过 | 当前工作树自动化交互证据 | 已验证 | 专项列设置测试＋治理拖拽检查 | 用户／开工 HEAD `1decb915` |
| LIST-004 | 总体设计 7 | 两个路由的列偏好和每页条数独立保存 | WP-2、WP-3 | 两个独立 `preferenceKey` | localStorage 20／50 独立值断言通过 | 两路由切换 | 已验证 | 专项偏好隔离测试 | 用户／开工 HEAD `1decb915` |
| LIST-005 | 总体设计 7 | 重新进入路由时页码和排序恢复默认，持久偏好保留 | WP-4 | `resetStandardListEntryTransientStateOnRouteEntry` | 重入后第 1 页、无临时排序、20 条偏好保留 | 两路由重入 | 已验证 | 专项偏好重入测试 | 用户／开工 HEAD `1decb915` |
| FILTER-001 | 总体设计 4.1、7 | 原筛选字段和口径保持，筛选／清空后回到第 1 页 | WP-4 | 既有 `renderFilterArea`；`refreshListResults` | 输入筛选、结果匹配、清空和页码重置通过 | 部位筛选交互 | 已验证 | 专项局部交互测试 | 用户／开工 HEAD `1decb915` |
| PERF-001 | 总体设计 4.1、8 | 分页、排序、列设置和筛选在 200ms 内局部反馈，不整页重绘 | WP-4 | `refreshListResults`、controller `refresh`、局部 overlays | 筛选 DOM 变化小于 200ms；main／root／section 引用不变 | 双路由交互无整页闪烁 | 已验证 | 专项 DOM 稳定和计时断言 | 用户／开工 HEAD `1decb915` |
| LAYOUT-001 | 总体设计 2、8.2 | 1366×768 和 1280×720 无页面横向溢出，宽表内部滚动，操作列固定右侧 | WP-6 | 标准表格宽度／冻结配置，操作列 `actionColumn` | 两尺寸、两路由共 4 组 overflow／scroll／sticky 断言通过 | `01-part-list-1366x768.png`、`02-binding-list-1280x720.png` | 已验证 | 专项两项低分辨率测试 | 用户／开工 HEAD `1decb915` |
| REG-001 | 总体设计 3.2、4.2 | 普通／特殊工艺判断和白／黄纸分流不变 | WP-6 | 原特殊工艺投影和打印模板未改 | 分纸打印 6/6 通过；缺工厂行与可打印黄纸行分别验证 | `07-white-paper-print-preview.png`、`08-yellow-paper-special-craft-print-preview.png` | 已验证 | `check:cutting-fei-ticket-paper-routing` | 用户／开工 HEAD `1decb915` |
| REG-002 | 总体设计 3.4 | 混纸任务继续进入明细拆分打印 | WP-6 | 原 `buildSpreadingWorkbenchPrintPreviewHref`／详情分流保持 | 混纸进入明细、白黄纸隔离通过 | 部位全部打印入口 | 已验证 | 分纸打印第 6 项 | 用户／开工 HEAD `1decb915` |
| REG-003 | 总体设计 3.5 | 特殊工艺承接工厂缺失继续阻断打印 | WP-6 | 原打印门禁保持 | 缺承接工厂阻断断言通过 | 特殊工艺打印路径 | 已验证 | 分纸打印第 6 项 | 用户／开工 HEAD `1decb915` |
| REG-004 | 总体设计 3.6、4.2 | 手动建票、改量、删除和原因校验不变 | WP-6 | 既有手动建票、详情对话框和补打分支保持 | 手动批量建票、详情、白纸、锁定、非法层数／全零尺码阻断通过 | 手动建票入口和详情 | 已验证 | 分纸打印第 2、3 项 | 用户／开工 HEAD `1decb915` |
| REG-005 | 总体设计 3.7、4.2 | 捆条生成、宽度、裁切、长度、打印和详情不变 | WP-6 | `buildBindingFeiTicketPrintRows`、原捆条详情／打印地址保持 | 捆条流和性能契约通过 | 捆条列表／详情 | 已验证 | `check:cutting-binding-strip-flow` | 用户／开工 HEAD `1decb915` |
| NAV-001 | 总体设计 4.1、6 | 全部打印、菲票明细和返回裁剪结果核查地址不变 | WP-2、WP-3、WP-6 | 原 `build*Href` 函数由新列渲染复用 | 部位明细地址、双路由操作按钮和打印流程断言通过 | 命名路由点击验证 | 已验证 | 专项列表＋分纸打印 | 用户／开工 HEAD `1decb915` |
| GOV-001 | 总体设计 4.1、9 | 页面声明标准列表模式并删除唯一历史基线项 | WP-5 | `fei-tickets.ts` 首行；`standard-list-page-baseline.json` | 列表治理通过：扫描 355 页、历史基线 17 项；模板和 Chromium 拖拽通过 | 不适用（治理项） | 已验证 | `npm run check:list-page-governance` | 用户／开工 HEAD `1decb915` |
| GOV-002 | 总体设计 9 | 建立完整原型审查记录并绑定当前证据 | WP-5、WP-6 | `docs/prototype-review-records/2026-08-12-fcs-fei-ticket-standard-lists.md` | 原型治理通过并覆盖全部本次受管用户可见文件 | 两个列表、物料大图、PDA、首次打印及白／黄纸共 8 张截图 | 已验证 | `check:prototype-design-governance -- --all`；审查记录与截图目录 | 用户待验收／`main@1decb915` 当前工作树 |
| VER-001 | 总体设计 9 | 最后一次修改后重新运行专项、业务、治理、构建、全仓裁剪、CodeGraph 和任务收据 | WP-6 | package scripts、专项测试、审查记录、任务收据 | 列表 10/10、装配 6 项、分纸 6/6、编号、捆条、首次打印、主线、裁剪 266/266、治理、构建、CodeGraph 均通过；最终任务收据 `verified`、0 blockers | 当前工作树 8 张命名页面／图片／PDA／打印截图已刷新；PDA 为 390×844；控制台 0 error | 已验证 | `output/playwright/fei-ticket-complete-20260812/recheck/`；`/private/tmp/higoods-fei-ticket-recheck-receipt-20260812/task-receipt.json` | 用户待验收／`main@1decb915` 当前工作树 |

## 2. 双向覆盖检查

### 2.1 正向追踪

- 总体设计第 2、4 节：SCOPE-001、SCOPE-002、LAYOUT-001、IMAGE-001、HANDOVER-001、PDA-001、PRINT-001。
- 总体设计第 3 节：PART-002、PART-003、BIND-002、REG-001～REG-005。
- 总体设计第 5、6 节：PAGE-001、PART-001～PART-003、BIND-001～BIND-002、IMAGE-001、NAV-001。
- 总体设计第 7 节：LIST-001～LIST-005、FILTER-001。
- 总体设计第 8 节：PERF-001、LAYOUT-001、REG-002～REG-005、IMAGE-001、HANDOVER-001、PDA-001、PRINT-001。
- 总体设计第 9 节：GOV-001、GOV-002、VER-001。

### 2.2 反向追踪边界

允许出现的业务代码变更限顶层列表渲染状态、列定义和局部事件处理，以及 IMAGE-001、HANDOVER-001、PDA-001、PRINT-001 对应的素材解析、稳定样本、PDA 动作卡和显式待打印样本的兼容补数排除。`src/router/`、`src/main-handlers/`、打印模板、核心状态推导、分类、生成数量、纸张分流、门禁算法或详情规则若出现变更，仍视为越界并撤回。

## 3. 变更记录

| 日期 | 版本 | 变更 |
| --- | --- | --- |
| 2026-08-12 | V1 | 根据用户确认方案建立迁移范围、零业务变更边界和 26 条原子需求。 |
| 2026-08-12 | V2 | 回填实际实现位置、专项证据和页面／打印截图；IMAGE-001 因上游生成色板不满足真实物料图门禁而标记素材阻塞。 |
| 2026-08-12 | V3 | 回填最终治理、构建、CodeGraph 和任务收据；全仓收据既存失败与本任务直接通过项分开记录。 |
| 2026-08-12 | V4 | 用户要求四项全部修复；扩展范围到真实物料图、缺工厂交出门禁稳定样本、PDA 编号入口和首次打印稳定样本，总计 29 条原子需求，旧收据失效。 |
| 2026-08-12 | V5 | 回填四项实际实现和当前浏览器证据；明确首次打印只修正显式待打印样本的兼容补数，核心三态推导和打印逻辑未改；等待最终统一验证和新任务收据。 |
| 2026-08-12 | V6 | 最终专项、完整裁剪、治理、构建和 CodeGraph 全部通过；新任务收据状态为 `verified` 且 blockers 为空，29 条原子需求全部已验证。 |
| 2026-08-12 | V7 | 第二轮查漏补缺：为拼接物料补齐 Navy／Khaki 对象图和显式门禁，撤回会改变裁单稳定 ID／唯一菲票数的越界改动；旧证据失效，列表专项与捆条流已重跑，其余最终证据重新生成。 |
| 2026-08-12 | V8 | 当前工作树重新生成双列表、物料大图、390×844 PDA 七入口与编号页、待首打、白纸和黄纸共 8 张证据；浏览器控制台 0 error，等待最终 CodeGraph 和任务收据收口。 |
| 2026-08-12 | V9 | CodeGraph 同步后无 pending；最终任务收据 `verified`、0 blockers，29 条原子需求全部达到“已验证”。 |
