# FCS 统一任务分配工作台调整追踪矩阵

## 1. 目标与边界

统一任务分配工作台只承担生产任务的查找、分配、竞价、改派、固定模式合并及分配后的合同快捷闭环。生产准备加工单不进入工作台；车缝辅料、裁片与菲票装袋事实只在独立车缝或“车缝+烫包”的分配、竞价、改派弹窗中提示，不在列表形成字段、标签、筛选或独立入口。

生产合同管理继续保留独立页面。工作台只提供当前任务有效合同的单一“合同”入口，以及分配或定标成功后的生成、打印提示和失败重试。

自动分配业务范围不变：只处理启用配置的非车缝独立生产任务；车缝、合并任务、整单任务和生产准备加工单不参与。

## 2. 原子需求追踪矩阵

| 编号 | 来源章节 | 原子需求 | 工作包 | 实现位置 | 自动化验证 | 页面验证 | 状态 | 证据位置 | 产品确认人/版本 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LIST-001 | 列表字段 | 列表固定为任务对象、任务内容、数量、跟单责任、分配信息、价格、操作七列 | WP-LIST | `unified-dispatch-workbench.ts` `columns` | `check:fcs-dispatch-list-filters` | `/fcs/dispatch/workbench` 1366×768 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| LIST-002 | 列表字段 | 任务对象同列展示真实款式缩略图、SPU、款式名、生产单号和任务号，缩略图支持高清查看、遮罩、关闭按钮和 Esc | WP-LIST | `columns.taskObject`、图片预览事件 | 同上 | 命名页面图片交互 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| LIST-003 | 列表字段 | 任务内容展示任务类型、工序、工艺及固定合并责任范围；同一业务工序只展示一次，不因工艺明细重复拼接；不展示阶段、连续工序或合并源任务数量 | WP-LIST | `columns.taskContent`、`processNames` | 同上 | 命名页面 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-task-content-dedup.png` | 用户/当前分支 |
| LIST-004 | 列表字段 | 数量列只展示 SKU 数与任务总件数，不展示最小分配颗粒度、不可拆数量或整任务 | WP-LIST | `columns.quantity` | 同上 | 命名页面 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| LIST-005 | 列表字段 | 跟单责任同列展示国内跟单和印尼跟单，缺失时明确“未分配” | WP-LIST | `columns.tracking` | 同上 | 命名页面 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| LIST-006 | 列表字段 | 分配信息同列展示分配方式、分配进度、承接工厂和工厂接单状态 | WP-LIST | `columns.assignment` | 同上 | 命名页面 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| LIST-007 | 列表字段 | 价格同列展示标准价、派单价、币种、计价单位、价格偏差及冻结状态 | WP-LIST | `columns.price` | 同上 | 命名页面 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| LIST-008 | 列表字段 | 操作按状态提供详情、直接派单、发起竞价、改派、撤销合并、合同和日志；合同只有一个入口 | WP-LIST | `columns.actions`、详情/日志/合同弹窗 | 同上 | 命名页面操作 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| LIST-009 | 删除边界 | 列表不展示阶段、生产准备、准备风险、装袋标签、最小颗粒度和合同状态 | WP-LIST | `columns`、`taskListContext` | 同上 | 命名页面 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| FILTER-001 | 筛选条件 | 默认只展示综合搜索、分配进度、分配方式、工序、承接工厂和派单日期范围 | WP-FILTER | `renderTaskFilters` | `check:fcs-dispatch-list-filters` | 默认筛选区 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-compact-filters.png` | 用户/当前分支 |
| FILTER-002 | 筛选条件 | 更多筛选只展示国内跟单、印尼跟单和价格状态；选择具体工序后才增加与该工序关联的工艺筛选 | WP-FILTER | `renderTaskFilters` | 同上 | 更多筛选及工序联动 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-compact-filters.png`、`fcs-dispatch-task-content-dedup.png` | 用户/当前分支 |
| FILTER-003 | 删除边界 | 删除阶段、车缝准备风险、菲票装袋、合同状态、自动分配资格、自动分配配置、工厂接单状态、自动分配结果、合并模式、任务/SKU 数量、任务截止、币种和计价单位筛选及其标签、状态和过滤逻辑 | WP-FILTER | 筛选类型、默认值、标签、过滤逻辑 | 同上 | 默认/更多筛选 | 已验证 | 专项检查 + 页面截图 | 用户/当前分支 |
| FILTER-004 | 筛选联动 | 工序变更或清除时同步清空工艺；任务类型切换不再维护已经删除的合并模式筛选状态 | WP-FILTER | 事件处理 | 同上 | 类型切换与工序联动 | 已验证 | 专项检查 + 页面截图 | 用户/当前分支 |
| FILTER-005 | 筛选交互 | 已选条件使用中文标签，支持单项清除、全部重置、组合空态和分页同步 | WP-FILTER | `renderActiveFilters`、标准分页 | 同上 | 组合筛选场景 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| PREP-001 | 车缝分配提示 | 独立车缝和“车缝+烫包”的直接派单、竞价、改派弹窗展示车缝辅料配料及库存、裁片齐套/放行/目标和菲票装袋明细 | WP-DISPATCH | `renderDispatchDialog`、装袋快照 | `check:fcs-dispatch-bagging` | 三类分配动作 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| PREP-002 | 车缝分配提示 | “裁剪+车缝+烫包”和其他非车缝任务不展示上述车缝准备提示 | WP-DISPATCH | `policy.startsWithSewing` 边界 | 同上 | 合并模式对照 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| PREP-003 | 分配规则 | 车缝默认按菲票装袋推荐，也可自由分配；两种方式均以完整 SKU 选择，混装袋和准备风险不阻断 | WP-DISPATCH | 选择组件、提交校验 | 同上 | 派单/竞价/改派 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| PREP-004 | 删除边界 | 删除列表“准备情况”入口、风险知悉勾选及其强制校验；自由分配不立即生成拆袋重装待办 | WP-DISPATCH | 详情、弹窗状态、提交事件 | 同上 | 原场景回放 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| PRICE-001 | 价格 | 直接派单和改派提交前必须进入价格二次确认，展示固定警示文案，提交后冻结价格 | WP-DISPATCH | `renderDispatchDialog`、提交事件 | `check:fcs-unified-assignment-foundation` | 二次确认弹窗 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| CONTRACT-001 | 合同闭环 | 符合合同范围的分配或定标成功后生成合同并询问是否打印；合同失败不回滚分配并可重试 | WP-CONTRACT | 合同生成与提示 | `check:fcs-unified-assignment-foundation` | 分配后提示 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| CONTRACT-002 | 合同闭环 | 当前任务存在有效合同时只显示一个“合同”操作，弹窗提供查看/打印和上传签订扫描图 | WP-CONTRACT | `renderContractPrompt`、操作事件 | 同上 | 合同弹窗 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| CONTRACT-003 | 边界 | 合同状态不进入任务列、筛选或统计；完整合同检索、历史、失败重试和扫描图管理保留在生产合同管理页面 | WP-CONTRACT | 工作台统计与独立合同路由 | 同上 | 工作台/合同中心对照 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| CONTRACT-004 | 合同母版 | 用户提供的 `合同模板.pdf` 是唯一合同母版；固定条款、文字、字母、标点、版式、颜色和两页分页均不得改写 | WP-CONTRACT-TEMPLATE | `public/fcs/contracts/template/production-contract-master.pdf`、两页母版图 | `check:production-contract-template-fidelity` 校验 PDF 与页面图 SHA-256 | 实际合同 PDF 逐页对照 | 已验证 | 母版 PDF SHA-256 一致 + `output/playwright/production-contract-master-verified-final-*.png` | 用户/当前分支 |
| CONTRACT-005 | 合同数据 | 合同生成时冻结 PPIC、工厂 PIC、任务类型、工序类型、自然日规则、SPU、生产单、任务备注和数量；缺少采购单或领料日期时使用印尼文明确表示不可用或未领料，不伪造数据 | WP-CONTRACT-TEMPLATE | `ProductionContractTemplateSnapshot`、合同生成 | 同上 | 第一页全部动态字段 | 已验证 | 专项检查 + `CONTRACT-000001` 实际打印件第一页 | 用户/当前分支 |
| CONTRACT-006 | 合同语言 | 母版固定中印双语原文原样保留；所有系统生成的动态描述、角色、日期、任务类型、工序类型和缺省值使用印尼文，编号、数量和真实姓名保持原值 | WP-CONTRACT-TEMPLATE | 母版渲染字段映射与日期格式 | 同上 | 第一页字段逐项检查 | 已验证 | 专项检查 + `output/playwright/production-contract-master-verified-final-1.png` | 用户/当前分支 |
| CONTRACT-007 | 打印一致性 | 合同详情打印与通用打印服务必须调用同一母版渲染器，不得保留自拟合同标题、条款、SKU 明细页或续页 | WP-CONTRACT-TEMPLATE | 两个合同打印入口 | 同上 + `check:fcs-unified-assignment-foundation` | 两个入口对照 | 已验证 | 两个入口共用渲染器契约 + 合同路由验收 | 用户/当前分支 |
| CONTRACT-008 | 合同页数 | 每份合同严格为 A4 纵向两页；第一页覆盖母版动态占位区，第二页固定条款页直接使用母版，不新增或删减页面 | WP-CONTRACT-TEMPLATE | `renderProductionContractMasterTemplate` | 同上校验页数与 300 DPI 页面图 | 浏览器打印 PDF 两页 | 已验证 | `pdfinfo`：A4、2页；`output/playwright/production-contract-master-verified-final.pdf` | 用户/当前分支 |
| CONTRACT-009 | 动态字段适配 | 母版边框、固定行高和条款不变；动态字段按可用单元格高度自动调整字号与行高，长工厂名、角色、日期和任务备注可在单元格内换行，不截断、不越过边框 | WP-CONTRACT-TEMPLATE | `resolveAdaptiveFontSize`、动态覆盖字段 | `check:production-contract-template-fidelity` 校验自适应与换行契约 | 1366×768 页面 + A4 两页 PDF | 已验证 | `output/playwright/production-contract-adaptive-1366.png`、`production-contract-adaptive.pdf` | 用户/当前分支 |
| AUTO-001 | 自动分配 | 自动分配配置和执行功能保留，且仍只处理启用配置的非车缝独立生产任务 | WP-AUTO | 自动配置/执行弹窗 | `check:fcs-auto-dispatch` | 两个入口与预览 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| BOUNDARY-001 | 对象边界 | 生产准备加工单、质检和复检流程节点不进入任务列表、分配或合并任务 | WP-BOUNDARY | `isAssignableProductionExecutionTask` | `check:fcs-unified-assignment-foundation` | 命名页面 | 已验证 | 专项检查 + `output/playwright/fcs-dispatch-second-audit-*.png` | 用户/当前分支 |
| VERIFY-001 | 验证 | 最后一次修改后完成专项契约、列表治理、原型治理、构建、CodeGraph 同步和当前分支页面验收 | WP-VERIFY | 检查脚本与审查记录 | 全部命名检查 | 1366×768 | 已验证 | 二次追踪、治理、构建、CodeGraph 与任务收据 | 用户/当前分支 |
| VERIFY-002 | 二次核查 | 第一轮验证后按设计到实现正向追踪，并从代码、页面、Mock、测试反向追踪，修复遗漏后重跑受影响验证 | WP-AUDIT | 本矩阵与原型审查记录 | 差异扫描与命名检查 | 页面复核 | 已验证 | 二次追踪、治理、构建、CodeGraph 与任务收据 | 用户/当前分支 |

## 3. 完成门禁

- 所有原子需求必须达到“已验证”或有明确理由的“不适用”。
- 第二轮核查不得发现遗留的旧列、旧筛选、风险确认门禁或拆分合同操作。
- 构建通过不能代替命名页面交互；页面截图不能代替范围与状态契约。
- 最终证据必须来自当前分支、当前工作树和最后一次实质修改后的结果。
