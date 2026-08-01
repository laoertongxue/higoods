# 毛织管理事实流原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-30 |
| 相关需求 / 任务 | 毛织加工单改为“确认接收 → 加工填报 → 发起交出 → 业务确认完成”的事实流，并重做横机动态关联、待交出仓和 PDA 承接 |
| 涉及系统 | PFOS、FCS PDA、技术包来源 |
| 涉及页面路径 | `/fcs/craft/wool/work-orders`、`/fcs/craft/wool/work-orders/:woolOrderId`、`/fcs/process-factory/wool/machine-associations`、`/fcs/craft/wool/machines`、`/fcs/craft/wool/wait-process-warehouse`、`/fcs/craft/wool/wait-handover-warehouse`、`/fcs/pda/exec/:taskId`、`/fcs/pda/handover/:handoverId` |
| 端类型 | 管理端、主管端、员工执行端 |
| 主要角色 | 毛织主管、毛织厂操作工、仓库收发人员、下游工厂操作工 |
| 主要任务 | 判断可否开工；多次接收、填报和交出；人工确认完成；维护横机与加工单关系；下游确认收货 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-30-wool-management-fact-workflow-design.md`
- `docs/superpowers/plans/2026-07-30-wool-management-fact-workflow-implementation-plan.md`

## 2.1 业务对象与协作关系核查

### 3.1 对象关系

1. 生产单提供款式、款色、计划数量和技术包快照。
2. 一张毛织加工单对应一个承接工厂、一个加工前对象集合和一个加工后 SKU 计划集合。
3. 确认接收记录保存本加工单实际收到的纱线 SKU、批次、数量和时间；允许多次发生。
4. 加工填报记录保存加工后 SKU 和本次合格数量；允许多次发生，不以纱线数量换算产能。
5. 发起交出记录从对应加工后对象的固定默认库位扣减；允许多次发生。
6. 完成记录是业务人员核对事实后的明确确认，不由系统推导。
7. 横机关联是一张加工单与多台横机的当前动态关系；横机同一时刻只关联一张加工单。
8. 下游收货确认从交出记录派生，只锁定该交出事实，不回写来源数量、不恢复毛织库存。

### 3.2 上下游闭环

| 环节 | 来源 | 当前页面表达 | 下游承接 |
| --- | --- | --- | --- |
| 必需纱线 | 生产单技术包快照中的款色用料对应关系 | 加工单详情和接收弹窗按纱线 SKU 展示 | 可开工门禁 |
| 确认接收 | 毛织厂现场实际收料 | 多次记录，显示 SKU、批次、数量、时间 | 加工填报资格 |
| 加工填报 | 已满足任一款色全部必需纱线 | 按加工后 SKU 多次填报 | 固定待交出仓库位库存 |
| 发起交出 | 对应固定库位可用数量 | 多次交出并扣减同一库位 | PDA 下游收货 |
| 完成加工单 | 至少存在一次交出 | 弹窗只陈列五类事实并二次确认 | 加工单已完成、自动解除横机 |
| 横机关联 | 可加工填报的加工单 | 加工单操作栏或横机生产关联页维护 | 横机空闲 / 生产中状态 |

## 2.2 核心规则核查

### 4.1 操作先后与多次操作

- 未确认接收：不显示加工填报和发起交出。
- 已确认接收但尚无任一款色齐料：不显示加工填报。
- 至少一个款色的全部必需纱线 SKU 均有有效确认接收：显示加工填报。
- 缺少任一必需纱线时，该颜色不可填报。
- 可开工只判断“某一款色所需的多种纱线是否都存在有效确认接收”，不按重量和单件用量换算最多可加工件数。
- 每个款色 / 加工后 SKU 的累计加工填报数量不得超过本加工单对应计划数量的 150%。
- 尚无加工填报：不显示发起交出。
- 至少一次加工填报：可以发起交出。
- 尚无交出：不显示完成加工单。
- 至少一次交出：显示完成加工单。
- 确认接收、加工填报、发起交出均可多次执行。

### 4.2 完成加工单

- 系统不判断数量是否“足够完成”。
- 二次确认弹窗展示：确认接收情况、加工填报情况、发起交出情况、待交出仓情况、当前横机关联。
- 由业务人员决定是否完成。
- 确认完成后，同一事务语义下解除该加工单的全部横机关联；设备随关系解除恢复空闲。
- 已完成加工单不再提供接收、填报、交出和新增设备关联入口。

### 4.3 横机关系与设备状态

- 删除“横机排查 / 排产是加工单状态节点”的旧业务表达。
- 删除“已排产”设备状态；页面只展示空闲、生产中、维修、停用。
- 空闲和生产中的设备可选；维修、停用可见但禁选。
- 关联后设备显示生产中；最后一条关联解除后显示空闲。
- 设备从甲加工单改关联到乙加工单时，必须展示原加工单和目标加工单并二次确认。
- 维护保存采用整组替换语义，避免重复打开弹窗后悄悄累加旧关系。
- 把已关联设备改为维修或停用时，在设备状态操作的二次确认弹窗中先展示将被解除的加工单，再自动解除关系并改变设备状态。

### 4.4 仓库与数量

- 加工后对象为裁片时，加工填报进入“毛织待交出仓 / 裁片默认库位”。
- 加工后对象为成衣时，加工填报进入“毛织待交出仓 / 成衣默认库位”。
- 发起交出根据对象类型，从上述同一个固定默认库位扣减。
- 毛织模块不保留旧的库位规则分配分支。
- 允许业务人员修改未被下游确认的接收、填报和交出数量。
- 下游已确认的交出记录锁定，不允许修改；下游确认本身不修改来源交出数量或库存流水。

### 4.5 删除范围

- 毛织管理页面不展示价格，毛织模块内价格字段、计算、筛选和文案均不再作为业务表达。
- “横机成片、缝盘、熨烫、包装、菲票打印”等旧节点不再作为毛织加工单流程节点或操作入口。
- 原“已排产”逻辑和文案从毛织设备状态、筛选和关联规则中移除。

## 2.3 页面与交互核查

### 5.1 毛织加工单列表

- 搜索条件位于 Tab 上方。
- 只保留“可以开工（数量）”“不可以开工（数量）”“已完成（数量）”三个 Tab。
- 不重复展示统计卡片；Tab 数量随当前搜索条件联动。
- 操作栏固定在右侧；加工填报、发起交出、完成加工单按事实门禁出现。
- “关联横机设备”仅在满足加工填报基础条件时出现。
- 表格有分页、排序、列显示、列顺序和冻结能力。
- 搜索输入、Tab、弹窗和行操作使用局部更新，输入不会替换整页根节点。

### 5.2 横机生产关联和设备页

- 横机生产关联列表默认展示所有横机的当前状态与当前加工单关系。
- 可按生产单、加工单、设备关键字、设备状态和是否关联筛选。
- 右上角“关联生产单”按“生产单 → 具体毛织加工单 → 横机设备”选择。
- 一张生产单存在多张可维护加工单时必须选到具体加工单。
- 维修、停用设备仍在列表可见，但在关联弹窗禁选。
- 设备页的维修 / 停用操作承担解除关系二次确认，不依赖加工单尚未完成。

### 5.3 待加工仓与待交出仓

- 两个列表均有筛选、标准表格、固定操作列和分页。
- 待交出仓明确显示裁片 / 成衣的固定默认库区库位和可交出数量。
- 交出入口回到具体加工单事实，不产生独立旧节点状态。

### 5.4 PDA

- 首屏只突出一个当前主操作，避免一线操作员在多个等权按钮中选择。
- 数量输入、弹窗、分页采用局部更新，不因输入触发整页重绘。
- 现场文案使用“确认接收、加工填报、发起交出、确认收货”等直接动作。
- 下游详情显示来源加工单、加工后 SKU、交出数量、接收状态和确认人。
- 已确认收货后不再显示确认按钮，保持来源事实只读。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 管理端负责关系维护和事实核对，PDA 负责现场单一动作 |
| 任务清晰度 | 通过 | 每页围绕开工、接收、填报、交出、关联或收货之一展开 |
| 信息架构与导航 | 通过 | 毛织菜单、加工单、横机、仓库和 PDA 路由可互相承接 |
| 页面模式 | 通过 | 管理端使用标准列表和业务弹窗，PDA 使用动作优先页面 |
| 信息负荷 | 通过 | 移除重复统计卡片、价格和废弃工艺节点 |
| 文案 | 通过 | 页面状态和动作均为中文业务语义 |
| 数量与状态 | 通过 | 150% 上限、固定库位、接收 / 填报 / 交出累计口径明确 |
| 扫码与识别 | 有条件通过 | 本轮目标是事实流与数量操作，沿用现有 PDA 任务识别入口 |
| 防错 | 通过 | 齐料、操作先后、设备禁选、跨单转移、下游锁定均有门禁 |
| UI 样式 | 通过 | 延续企业后台和 PDA 既有样式，不新增视觉范式 |
| 组件交互 | 通过 | 列表复用标准组件，弹窗和输入局部刷新 |
| 协作关系 | 通过 | 技术包、毛织加工、仓库交出和下游收货形成闭环 |
| 异常与追溯 | 通过 | 批次、操作者、时间、关联来源和下游确认均可追溯 |
| 现场设备可用性 | 通过 | 已覆盖 1366×768 和最低 1280×720，关键按钮保持可见 |

## 4. 问题标签与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧流程节点把横机关联误作加工单状态 | `状态抽象` | 毛织主管 | 删除旧节点，改为独立动态关系 | 否 |
| 重复统计卡片挤占列表首屏 | `视觉干扰` | 毛织主管 | 只保留带数量且随搜索联动的 Tab | 否 |
| 仅有部分纱线时可能错误填报款色 | `点错风险` | 毛织操作工 | 按任一款色全部必需纱线的存在性门禁 | 否 |
| 横机跨加工单选择可能覆盖原关系 | `选不对` | 毛织主管 | 展示转移影响并要求二次确认 | 否 |
| PDA 多个等权操作增加现场误触 | `点错风险` | 一线操作工 | 首屏只突出一个主操作 | 否 |
| 下游确认后仍修改来源事实 | `追溯不足` | 收发双方 | 已确认交出锁定且禁止库存反向变化 | 否 |

## 5. 自动验收场景

Playwright 用例使用 `mockScenarioCode` 查找业务场景，不依赖加工单号或数组顺序；每例把本地存储重置为同一基准快照，互不依赖前例残留。

1. 搜索条件联动三个 Tab，且无统计卡片。
2. 任一款色全部必需纱线均已接收才可加工填报，0.01 的有效接收也证明不按重量换算。
3. 每个加工后 SKU 累计填报不超过计划的 150%。
4. 填报前无交出、交出前无完成。
5. 完成弹窗展示五类事实，确认后自动解除横机。
6. 一单多设备、设备同时一单、维修停用禁选、状态自动切换。
7. 裁片和成衣进入各自固定默认库位。
8. 下游确认后锁定，来源交出数量和毛织库存不变。
9. PDA 首屏单一主操作、输入和弹窗局部更新、关键点击小于 200ms。
10. 1366×768 页面主体不横溢，宽表内部滚动，操作列和弹窗按钮可见。
11. 1280×720 最低分辨率下仍满足上述可用性。
12. 完成快照的纱线待加工库存按 SKU 聚合默认库位全部批次（含批次接收），与领用按批次扣减口径一致；复查批次口径后，检查脚本与 E2E 验收锚点同步对齐。

## 6. 最终结论

结论：通过。

说明：角色、对象关系、事实先后、数量口径、横机关系、固定库位、下游锁定、低分辨率可用性和局部交互均已形成明确验收口径；不存在未说明的业务例外。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/wool/work-orders.ts`
- `src/pages/process-factory/wool/work-order-detail.ts`
- `src/pages/process-factory/wool/machine-associations.ts`
- `src/pages/process-factory/wool/machines.ts`
- `src/pages/process-factory/wool/warehouse.ts`
- `src/pages/process-factory/wool/shared.ts`
- `src/pages/pda-wool-fact-execution.ts`
- `src/pages/pda-exec-detail.ts`
- `src/pages/pda-exec.ts`
- `src/pages/pda-handover.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-warehouse.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/data/fcs/wool-domain/types.ts`
- `src/data/fcs/wool-domain/store.ts`
- `src/data/fcs/wool-domain/commands.ts`
- `src/data/fcs/wool-domain/queries.ts`
- `src/data/fcs/wool-domain/tech-pack-source.ts`
- `src/data/fcs/wool-domain/machine-associations.ts`
- `src/data/fcs/wool-domain/warehouse-ledger.ts`
- `src/data/fcs/wool-domain/mobile.ts`
- `src/data/fcs/wool-domain/mock-data.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/data/pcs-pattern-library.ts`
- `src/data/fcs/pda-handover-events.ts`
- `src/data/fcs/wool-pda-task-access.ts`
- `src/data/fcs/wool-mobile-binding-entry.ts`
- `src/data/fcs/fcs-route-links.ts`
- `src/data/app-shell-config.ts`
- `src/router/route-renderers-fcs.ts`
- `src/router/routes-fcs.ts`
- `src/main-handlers/fcs-handlers.ts`

### 页面路由

- `/fcs/craft/wool/work-orders`
- `/fcs/craft/wool/work-orders/:woolOrderId`
- `/fcs/process-factory/wool/machine-associations`
- `/fcs/craft/wool/machines`
- `/fcs/craft/wool/wait-process-warehouse`
- `/fcs/craft/wool/wait-handover-warehouse`
- `/fcs/pda/exec/:taskId`
- `/fcs/pda/handover/:handoverId`

### 验证命令

- `npm run test:wool-fact-workflow:e2e`：通过（11/11，独立服务串行执行）
- `npm run check:wool-fact-workflow`：通过（含完成快照批次聚合断言与 E2E 验收锚点）
- `npm run check:wool-warehouse-unified-model`：通过
- `npm run check:pda-handover-pages`：通过
- `npm run check:pda-handover-detail-source`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:list-page-governance`：通过（复查批次口径后重新验证）
- `npm run workflow:verify`：通过（状态 verified，受影响检查路由全部 exitCode 0，无阻塞项）
- `npm run build`：通过

### 运行时竞态与性能修复（复查补充）

复查中发现并闭环两类运行时问题，均涉及 `src/data/` 数据层，按治理要求补充记录：

1. **PCS 数据水合整页重渲染竞态**：`src/data/pcs-pattern-library.ts` 的 `requestRender` 在任意路由触发 `APP_RENDER_EVENT`，非 PCS 页面整页重绘会覆盖输入值与 DOM 属性。修复为仅 `window.location.pathname.startsWith('/pcs/')` 时派发，消除跨域重绘。
2. **毛织运行时任务无 memo 导致主线程长阻塞**：`src/data/fcs/runtime-process-tasks.ts` 的 `listRuntimeProcessTasks()` 每次调用全量重建（实测单次约 0.7s），毛织 store seed 对 N 个任务多次触发全量构建，CPU Profiler 实测 28.7s 阻塞（92% selfTime），E2E evaluate 排队超时。修复为 `runtimeTasksCache` memo：12 处变更点（override/split/merge/reassign/restore 等）统一失效；`processTasks` 可被外部直接修改，在 `process-tasks.ts` 增加 `setProcessTasksMutatedListener` 变更钩子，`runtime-process-tasks.ts` 惰性注册（模块顶层注册会因循环依赖触发 TDZ，已实证并修复），并导出 `clearRuntimeProcessTasksCache` 供治理脚本显式清理。
3. **复查批次口径（A1）与 E2E 验收锚点（B1）**：完成快照纱线待加工库存按 SKU 聚合默认库位全部批次（含批次接收），与领用按批次扣减口径一致；6 处 E2E 锚点同步对齐。

### 例外

- 齐料门禁的业务例外：只核验任一款色全部必需纱线 SKU 是否存在有效确认接收；不按接收数量、单件用量或损耗率计算最多可加工件数。替代防错是加工后 SKU 累计填报不得超过计划数量的 150%。
- 扫码能力沿用现有 PDA 任务入口，本次未新增独立扫码页面；不影响本次事实流验收。
- 本仓库为原型项目，库存、横机关联和收货确认由同一浏览器本地 Mock 事实存储演示，不代表已接入真实后端事务。
