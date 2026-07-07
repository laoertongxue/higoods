# 工序工艺路线串并行与连续工序判断实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 HiGood 原型代码中补齐“工序工艺字典基础排序 -> 技术包款式级工艺路线串并行确认 -> 生产单冻结路线 -> 任务生成排序 -> 连续工序任务合并判断”的闭环。跟单必须能在技术包工序页直接编辑串行、并行路线并确认；未确认工艺路线不能发布正式技术包，也不能生成正式生产任务；连续工序任务只能由任务清单基于已冻结路线合并生成，不能由规则预先猜测。

**架构：** 工序工艺字典只提供基础默认顺序和能力元数据；每款 SPU 的技术包保存最终业务路线，包含串行步骤、并行组、并行组是否允许整体承接、确认人和确认时间；生产单创建时冻结技术包路线；任务生成按冻结路线生成任务顺序和依赖；任务清单合并连续工序时只读取冻结路线做校验，不回写技术包。

**技术栈：** Vite + TypeScript + Tailwind CSS + Vanilla TypeScript 字符串模板。沿用现有 `src/components/ui/` 轻量组件、现有 mock 数据和现有检查脚本风格，不引入 React 组件体系、状态管理或后端服务。

---

## 0. 当前代码事实

- `src/data/fcs/process-craft-dict.ts` 已维护阶段、工序、工艺字典，`ProcessStageDefinition.sort` 和 `ProcessDefinition.sort` 已经是基础顺序的雏形。
- `src/data/pcs-technical-data-version-types.ts` 的 `TechnicalProcessEntry` 已保存技术包工序工艺条目，但没有款式级路线步骤、并行组、路线确认状态。
- `src/pages/tech-pack/context.ts` 用本地 `TechniqueItem` 管理工序 Tab 状态，`syncTechPackToStore()` 将页面状态写回技术包版本。
- `src/pages/tech-pack/process-domain.ts` 的 `renderProcessTab()` 当前按阶段平铺工序卡片，没有串行、并行可视化编辑。
- `src/pages/tech-pack/events.ts` 已有新增、编辑、删除工序和审核动作，跟单审核通过前会同步技术包。
- `src/data/pcs-tech-pack-review.ts` 中 `PROCESS` 模块归属跟单审核；`src/data/pcs-project-technical-data-writeback.ts` 的 `publishTechnicalDataVersion()` 已禁止未通过跟单审核的版本发布正式版。
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`、`src/data/fcs/production-order-tech-pack-runtime.ts` 会把技术包工序带入生产单快照和运行时读取链路。
- `src/data/fcs/production-artifact-generation.ts` 当前主要用字典阶段排序和工序排序生成产物顺序。
- `src/data/fcs/process-tasks.ts` 会根据生成产物排序设置任务 `seq` 和前置依赖。
- `src/data/fcs/runtime-process-tasks.ts` 的 `mergeContinuousRuntimeTasks()` 当前只用“后一任务依赖前一任务”或“后一任务序号等于前一任务序号加一”判断连续，缺少技术包冻结路线语义。

---

## 1. 文件结构

### 1.1 需要修改的现有文件

- `src/data/fcs/process-craft-dict.ts`
- `src/pages/production-craft-dict.ts`
- `src/data/pcs-technical-data-version-types.ts`
- `src/data/pcs-technical-data-version-repository.ts`
- `src/data/pcs-technical-data-version-store.ts`
- `src/data/pcs-tech-pack-task-generation.ts`
- `src/data/pcs-tech-pack-review.ts`
- `src/data/pcs-project-technical-data-writeback.ts`
- `src/pages/tech-pack/context.ts`
- `src/pages/tech-pack/process-domain.ts`
- `src/pages/tech-pack/events.ts`
- `src/data/fcs/production-tech-pack-snapshot-builder.ts`
- `src/data/fcs/production-order-tech-pack-runtime.ts`
- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/process-tasks.ts`
- `src/data/fcs/runtime-process-tasks.ts`
- `src/pages/process/task-breakdown.ts`
- `src/pages/dispatch/continuous.ts`
- `src/data/app-shell-config.ts`

### 1.2 需要新增的文件

- `src/data/tech-pack-process-route.ts`
- `scripts/check-tech-pack-process-route.ts`
- `scripts/check-continuous-process-route-eligibility.ts`
- `docs/prototype-review-records/2026-07-07-process-route-serial-parallel.md`

### 1.3 需要更新的脚本配置

- `package.json`
  - 新增 `check:tech-pack-process-route`
  - 新增 `check:continuous-process-route-eligibility`

---

## 2. 数据模型与基础工具

- [ ] 修改 `src/data/pcs-technical-data-version-types.ts`，为技术包工序条目和技术包内容增加路线字段。

  在 `TechnicalProcessEntry` 增加以下字段：

  ```ts
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
  routeParallelGroupName?: string
  routeParallelAcceptanceMode?: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
  routeSourceKind?: 'DICT_DEFAULT' | 'GARMENT_CATEGORY' | 'BOM_REQUIREMENT' | 'PATTERN_PACKAGE' | 'PIECE_CRAFT' | 'MANUAL'
  routeUpdatedBy?: string
  routeUpdatedAt?: string
  ```

  在 `TechnicalDataVersionContent` 增加以下字段：

  ```ts
  processRouteStatus?: 'UNCONFIRMED' | 'CONFIRMED'
  processRouteConfirmedBy?: string
  processRouteConfirmedAt?: string
  processRouteUpdatedBy?: string
  processRouteUpdatedAt?: string
  processRouteChangeReason?: string
  ```

  验收标准：
  - 旧数据不带这些字段时仍能加载。
  - 新技术包保存后每个 `processEntries` 条目都有 `routeStepNo` 和 `routeLaneNo`。
  - `processRouteStatus` 缺失时按 `UNCONFIRMED` 处理。

- [ ] 新增 `src/data/tech-pack-process-route.ts`，集中实现路线排序、并行组、确认状态和连续判断的纯函数。

  必须导出：

  ```ts
  export type RouteContinuityResult = {
    allowed: boolean
    reason: string
  }

  export function normalizeProcessRouteEntries<T extends {
    id: string
    stageCode: string
    processCode: string
    routeStepNo?: number
    routeLaneNo?: number
    routeParallelGroupId?: string
    routeParallelAcceptanceMode?: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
  }>(entries: T[]): T[]

  export function sortProcessRouteEntries<T extends {
    id: string
    stageCode: string
    routeStepNo?: number
    routeLaneNo?: number
  }>(entries: T[]): T[]

  export function areRouteEntriesContinuous(entries: Array<{
    id: string
    routeStepNo?: number
    routeParallelGroupId?: string
    routeParallelAcceptanceMode?: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
  }>): RouteContinuityResult
  ```

  业务规则：
  - `routeStepNo` 表示工艺路线纵向顺序，从 1 开始。
  - 同一个 `routeStepNo` 下多个工序代表并行。
  - 串行连续要求选择的工序按 `routeStepNo` 升序后，每个相邻步骤差值为 1。
  - 默认不允许把并行组中的单个工序与前后工序合并为连续工序任务。
  - 只有跟单明确把并行组设置为“并行组整体承接”，且选中的工序包含该并行组全部工序时，才允许并行组参与连续工序任务。
  - 不能跨生产单、不能包含已拆分源任务或已拆分结果任务，这些校验仍放在运行时合并函数中。

  验收标准：
  - 纯函数不依赖 DOM、不依赖页面状态。
  - 单元脚本能验证串行、断点、并行默认拦截、并行整体承接四类场景。

- [ ] 修改 `src/data/fcs/process-craft-dict.ts`，将现有字典排序显式暴露为基础路线排序。

  增加导出函数：

  ```ts
  export function getDefaultProcessRouteOrder(processCode: string): number
  export function listDefaultProcessRouteOrders(): Array<{
    processCode: string
    processName: string
    stageCode: CraftStageCode
    stageName: string
    routeOrder: number
  }>
  ```

  规则：
  - 先按阶段 `sort` 排序。
  - 同阶段内按工序 `sort` 排序。
  - 工艺条目继承所属工序的基础顺序，不把工艺自身作为跨工序排序依据。

  验收标准：
  - 生产工艺字典现有页面不报错。
  - 返回结果包含裁片、车缝、后道、辅助工艺、特种工艺等当前字典已有工序。

- [ ] 修改 `src/pages/production-craft-dict.ts`，在工序工艺字典页面展示“基础路线顺序”。

  页面表现：
  - 在工序行或详情区域展示“基础顺序：第 N 步”。
  - 页面文案说明它只是技术包路线的默认参考，不替代款式级技术包路线。

  验收标准：
  - 页面中文展示，不出现英文状态码。
  - 不新增复杂维护表单。
  - 字典页仍是结果展示页，符合项目中“字典类页面默认按结果展示页处理”的约定。

---

## 3. 技术包工序路线编辑与确认

- [ ] 修改 `src/pages/tech-pack/context.ts` 的本地 `TechniqueItem`，增加与 `TechnicalProcessEntry` 对齐的路线字段。

  增加字段：

  ```ts
  routeStepNo: number
  routeLaneNo: number
  routeParallelGroupId?: string
  routeParallelGroupName?: string
  routeParallelAcceptanceMode: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
  routeSourceKind: 'DICT_DEFAULT' | 'GARMENT_CATEGORY' | 'BOM_REQUIREMENT' | 'PATTERN_PACKAGE' | 'PIECE_CRAFT' | 'MANUAL'
  routeUpdatedBy?: string
  routeUpdatedAt?: string
  ```

  修改点：
  - `toTechniqueItemFromEntry()` 从 `TechnicalProcessEntry` 读取路线字段。
  - `buildTechniquesFromTechPack()` 对缺失路线字段的旧数据调用 `normalizeProcessRouteEntries()` 回填。
  - `getChecklist()` 的工序工艺完成条件从“有工序”升级为“有工序且路线已确认”。
  - `syncTechPackToStore()` 写回 `processEntries` 时保留路线字段和 `processRouteStatus`。

  验收标准：
  - 旧技术包打开后自动按字典基础顺序生成路线。
  - 新增、删除工序后路线编号保持连续。
  - 未确认路线时工序工艺检查项显示未完成。

- [ ] 修改 `src/pages/tech-pack/process-domain.ts`，把工序 Tab 从阶段平铺卡片改成“路线主编辑 + 批量辅助 + 关系查看”三段式。

  页面结构：
  - 主编辑区：按路线步骤纵向展示，每一步显示一个或多个工序卡片。
  - 并行组：同一步多个卡片横向展示，组头显示“并行处理”。
  - 卡片操作：上移、下移、设为并行、移出并行、编辑、删除。
  - 并行组设置：默认显示“分别承接”，可切换为“并行组整体承接”。
  - 批量辅助区：表格展示工序、来源、步骤号、并行组、是否允许整体承接。
  - 关系查看区：只读展示从物料、纸样、裁片部位辅助/特种工艺推导来的来源关系。

  交互要求：
  - 跟单直接修改并保存，不走额外审批。
  - 保存路线后 `processRouteStatus` 改为 `UNCONFIRMED`。
  - 点击“确认工艺路线”后写入确认人和确认时间。
  - 路线确认后再次调整任一工序排序或并行组，自动取消确认。

  验收标准：
  - 工序 Tab 首屏能看到串行路线，不再只是卡片堆叠。
  - 并行组有明确中文文案：“并行处理”“分别承接”“并行组整体承接”。
  - 不出现 `routeStepNo`、`routeParallelGroupId` 等代码字段。

- [ ] 修改 `src/pages/tech-pack/events.ts`，补齐路线编辑事件。

  必须新增或扩展以下动作：
  - `move-technique-route-up`
  - `move-technique-route-down`
  - `make-techniques-parallel`
  - `remove-technique-from-parallel`
  - `toggle-parallel-group-acceptance`
  - `confirm-process-route`

  行为规则：
  - 上移、下移只改变路线顺序，不改变阶段和工序归属。
  - 设为并行只允许相邻步骤合并为同一步。
  - 解除并行后自动拆成连续两个步骤。
  - 并行组整体承接开关只影响连续工序任务合并资格，不影响任务生成。
  - 确认路线前调用 `normalizeProcessRouteEntries()`，保证步骤连续。

  验收标准：
  - 每个动作只局部更新工序 Tab 区域，不触发整页闪烁。
  - 点击响应不超过 200ms。
  - 新增、编辑、删除工序后路线状态准确变为未确认。

- [ ] 修改 `src/data/pcs-tech-pack-review.ts` 和 `src/data/pcs-project-technical-data-writeback.ts`，把路线确认纳入跟单审核和正式版本发布门禁。

  规则：
  - `PROCESS` 模块归属仍为跟单。
  - 跟单审核通过前必须满足：有工序、有路线、路线已确认。
  - `publishTechnicalDataVersion()` 在发布正式版时再次检查路线确认状态。
  - 未确认时抛出中文业务错误：“工艺路线未确认，不能发布正式技术包。”

  验收标准：
  - 跟单未确认路线时无法审核通过。
  - 跟单审核未通过时仍无法发布正式版本。
  - 现有“跟单审核通过后才能发布正式版本”的门禁仍保留。

---

## 4. 生产单冻结路线与任务生成

- [ ] 修改 `src/data/pcs-technical-data-version-repository.ts` 和 `src/data/pcs-technical-data-version-store.ts`，保证版本克隆、保存、发布时保留路线字段。

  修改点：
  - 所有 `cloneProcessEntries` 或等效克隆逻辑复制路线字段。
  - `buildTechnicalDataDerivedState()` 将缺失路线确认纳入 `PROCESS` 缺失项。

  验收标准：
  - 草稿复制为新版本后路线结构不丢失。
  - 正式版本内容中能看到 `processRouteStatus: 'CONFIRMED'`。
  - 缺路线确认的版本不会被计算为核心资料完整。

- [ ] 修改 `src/data/pcs-tech-pack-task-generation.ts`，让自动生成工序条目时写入初始路线字段。

  规则：
  - BOM 印染需求生成的准备工序继承字典基础顺序，来源标记为 `BOM_REQUIREMENT`。
  - 纸样包生成的裁片相关工序来源标记为 `PATTERN_PACKAGE`。
  - 物料关联纸样部位上的辅助/特种工艺来源标记为 `PIECE_CRAFT`。
  - 手工新增工序来源标记为 `MANUAL`。
  - 初始路线只作为草稿路线，状态仍为未确认，必须由跟单确认。

  验收标准：
  - 自动生成工序后路线顺序稳定。
  - 来源关系在技术包“关系查看区”可读。
  - 不因为自动生成就绕过跟单确认。

- [ ] 修改 `src/data/fcs/production-tech-pack-snapshot-builder.ts` 和 `src/data/fcs/production-order-tech-pack-runtime.ts`，生产单冻结技术包时完整冻结路线字段。

  规则：
  - 只允许冻结正式技术包版本。
  - 正式技术包版本必须路线已确认。
  - 生产单快照中的每个工序条目都带 `routeStepNo`、`routeLaneNo`、并行组和整体承接设置。

  验收标准：
  - 生产单快照读取到的是创建时的路线，不受之后技术包草稿调整影响。
  - 生产单快照中不缺任何路线字段。

- [ ] 修改 `src/data/fcs/production-artifact-generation.ts`，任务产物排序优先使用冻结路线。

  排序规则：
  - 首先按 `routeStepNo` 升序。
  - 同一步内按 `routeLaneNo` 升序。
  - 路线字段缺失时回退现有阶段和工序字典排序。
  - 保留后道汇总、辅助/特种工艺生成的现有业务逻辑。

  验收标准：
  - 使用同一技术包路线生成的任务列表顺序与技术包工序 Tab 一致。
  - 缺路线字段的旧 mock 数据仍可展示。
  - 任务生成产物不出现英文状态码。

- [ ] 修改 `src/data/fcs/process-tasks.ts`，将冻结路线写入任务并生成依赖。

  增加到 `ProcessTask`：

  ```ts
  routeStepNo?: number
  routeLaneNo?: number
  routeParallelGroupId?: string
  routeParallelGroupName?: string
  routeParallelAcceptanceMode?: 'INDEPENDENT_ONLY' | 'WHOLE_GROUP_ALLOWED'
  ```

  依赖规则：
  - 串行任务依赖前一个步骤的全部任务。
  - 同一步并行任务之间互不依赖。
  - 并行组后面的下一步任务依赖该并行组内全部任务。

  验收标准：
  - 任务清单可展示同一并行组任务。
  - 任务执行顺序不会把同一步并行任务误判成前后依赖。

---

## 5. 连续工序任务合并判断

- [ ] 修改 `src/data/fcs/runtime-process-tasks.ts` 的 `mergeContinuousRuntimeTasks()`，连续判断改为读取冻结路线字段。

  保留现有硬性限制：
  - 必须同一生产单。
  - 必须是单工序任务。
  - 不能是已拆分源任务。
  - 不能是已拆分结果任务。
  - 必须未分配且未开工。

  新增路线限制：
  - 必须存在冻结路线字段。
  - 选择的任务按路线步骤排序后必须连续。
  - 默认不允许跨并行组。
  - 并行组只有在“并行组整体承接”开启且选中了组内全部任务时，才允许作为整体参与连续合并。
  - 不允许按明细拆分连续工序任务。

  验收标准：
  - 断开的步骤不能合并。
  - 只选并行组的一部分不能合并。
  - 完整选择允许整体承接的并行组可以合并。
  - 合并后的连续工序任务仍只分配给一个承接工厂。

- [ ] 修改 `src/pages/process/task-breakdown.ts`，任务清单合并入口展示路线依据。

  页面规则：
  - 任务清单中展示“路线步骤”和“并行组”。
  - 合并弹窗展示被选任务是否连续、是否跨并行、能否合并。
  - 不能合并时给出中文原因，例如“中间缺少后道步骤”“并行组未选择完整”“该并行组未允许整体承接”。
  - 继续保持操作栏固定在右侧，长详情放入详情弹窗。

  验收标准：
  - 用户不需要理解代码字段也能知道为什么能合并或不能合并。
  - 合并动作不进入车缝分配工作台或非车缝任务分配页面。

- [ ] 修改 `src/pages/dispatch/continuous.ts`，连续工序任务分配页按连续任务类型展示。

  页面规则：
  - 仅展示已经由任务清单合并生成的连续工序任务。
  - 分 Tab 展示“车缝+后道连续任务”和“其他连续工序任务”。
  - “车缝+后道连续任务”复用车缝分配工作台关键判断口径：裁片是否可做成衣、辅料是否满足生产。
  - “其他连续工序任务”展示覆盖工序、承接能力、产能窗口、接单截止、任务截止。
  - 不提供再次拆分、按明细分配入口。

  验收标准：
  - 连续工序任务分配页不是生成连续任务的入口，只是分配入口。
  - 仅包含车缝和后道的连续任务具备车缝分配必要的裁片和辅料判断。

- [ ] 修改 `src/data/app-shell-config.ts`，确认任务分配菜单包含连续工序任务分配。

  菜单结构：
  - 任务分配
  - 非车缝任务分配
  - 车缝分配工作台
  - 连续工序任务分配

  验收标准：
  - `/fcs/dispatch/continuous` 可以从侧边菜单进入。
  - 菜单中文名称与业务表达一致。

---

## 6. Mock 数据与跨页面演示闭环

- [ ] 补充技术包 mock 数据，覆盖三类路线。

  数据场景：
  - KOL 整单任务：整单任务不生成裁片单，不参与普通任务分配。
  - 单工序任务：按冻结路线生成普通任务，可进入车缝或非车缝分配。
  - 连续工序候选：在任务清单中由跟单选择相邻工序合并生成连续工序任务。

  验收标准：
  - `KOL样品小单` 仍走整单任务，不被错误造为连续工序任务。
  - 连续工序任务来自任务清单合并，不来自生产单任务生成规则。

- [ ] 补充并行路线 mock 数据。

  数据场景：
  - 一个并行组默认分别承接，验证不能合并。
  - 一个并行组开启整体承接，验证完整选择后可合并。
  - 一个并行组只选部分工序，验证不能合并。

  验收标准：
  - 页面和脚本都能覆盖并行组边界。

---

## 7. 验证脚本

- [ ] 新增 `scripts/check-tech-pack-process-route.ts`。

  脚本断言：
  - 技术包工序条目都有路线步骤。
  - 路线步骤连续。
  - 同一步多工序时存在并行组信息。
  - 未确认路线不能发布正式技术包。
  - 跟单审核通过前必须确认路线。

  `package.json` 增加：

  ```json
  "check:tech-pack-process-route": "tsx scripts/check-tech-pack-process-route.ts"
  ```

  通过标准：
  - 输出包含“技术包工艺路线检查通过”。
  - 进程退出码为 0。

- [ ] 新增 `scripts/check-continuous-process-route-eligibility.ts`。

  脚本断言：
  - 相邻串行任务可合并。
  - 非相邻任务不可合并。
  - 并行组默认不可部分合并。
  - 并行组整体承接且完整选择时可合并。
  - 连续工序任务不能按明细拆分。

  `package.json` 增加：

  ```json
  "check:continuous-process-route-eligibility": "tsx scripts/check-continuous-process-route-eligibility.ts"
  ```

  通过标准：
  - 输出包含“连续工序路线合并资格检查通过”。
  - 进程退出码为 0。

- [ ] 更新或补充现有检查脚本。

  必跑命令：

  ```bash
  npm run check:tech-pack-process-route
  npm run check:continuous-process-route-eligibility
  npm run check:fcs-task-generation-rules
  npm run check:fcs-production-tech-pack-snapshot
  npm run check:prototype-design-governance
  npm run build
  ```

  通过标准：
  - 所有命令退出码为 0。
  - 任务生成规则检查仍能证明整单任务不被连续工序规则污染。
  - 生产单技术包快照检查能证明路线字段已冻结。

---

## 8. 浏览器验收

- [ ] 启动本地服务。

  ```bash
  npm run dev -- --host 0.0.0.0 --port 5173
  ```

  验证：

  ```bash
  curl -I http://$(ipconfig getifaddr en0):5173/fcs/production/task-generation-rules
  ```

  通过标准：
  - 本机局域网地址返回可达。
  - 如 `en0` 为空，用 `en1` 获取局域网地址。

- [ ] 验收技术包工序 Tab。

  路径：
  - 技术包页面的工序 Tab

  检查项：
  - 能看到串行步骤。
  - 能看到并行组。
  - 能把相邻步骤设为并行。
  - 能把并行组切换为整体承接。
  - 调整后路线状态变为未确认。
  - 点击确认路线后显示确认人和确认时间。

  通过标准：
  - 点击响应无明显卡顿。
  - 不出现英文代码字段。
  - 不出现整页闪烁。

- [ ] 验收任务清单。

  路径：
  - `/fcs/process/task-breakdown`

  检查项：
  - 任务列表展示路线步骤。
  - 合并连续工序时展示连续判断结果。
  - 断点、并行组未完整选择、未允许整体承接时均给出中文拦截原因。
  - 合并成功后生成连续工序任务。

  通过标准：
  - 操作栏固定在右侧。
  - 合并入口不进入车缝或非车缝分配页。

- [ ] 验收连续工序任务分配。

  路径：
  - `/fcs/dispatch/continuous`

  检查项：
  - 只展示已经合并生成的连续工序任务。
  - “车缝+后道连续任务”展示裁片是否可做成衣和辅料是否满足生产。
  - “其他连续工序任务”展示承接能力、产能窗口和任务期限。
  - 页面没有拆分和按明细分配入口。

  通过标准：
  - 连续工序任务只分配给一个工厂。
  - 页面中文文案符合现场协同规范。

---

## 9. 原型治理记录

- [ ] 新增 `docs/prototype-review-records/2026-07-07-process-route-serial-parallel.md`。

  必须记录：
  - 本次涉及页面：技术包工序 Tab、工序工艺字典、任务清单、连续工序任务分配。
  - 角色：跟单、PPIC、平台运营、工厂接单人员。
  - 端类型：管理后台、PDA 只受下游任务结果影响。
  - 关键业务决策：路线确认前不能发布正式技术包；连续工序任务只能从任务清单合并；连续任务不能按明细拆分。
  - 自查结果：中文文案、列表分页、交互响应、无英文状态码、无整页闪烁。

  通过标准：
  - `npm run check:prototype-design-governance` 通过。

---

## 10. 实施顺序

- [ ] 第 1 批：数据模型与纯函数
  - `src/data/pcs-technical-data-version-types.ts`
  - `src/data/tech-pack-process-route.ts`
  - `src/data/fcs/process-craft-dict.ts`

- [ ] 第 2 批：技术包工序路线编辑和确认
  - `src/pages/tech-pack/context.ts`
  - `src/pages/tech-pack/process-domain.ts`
  - `src/pages/tech-pack/events.ts`
  - `src/data/pcs-tech-pack-review.ts`
  - `src/data/pcs-project-technical-data-writeback.ts`

- [ ] 第 3 批：技术包版本、生产单快照和任务生成
  - `src/data/pcs-technical-data-version-repository.ts`
  - `src/data/pcs-technical-data-version-store.ts`
  - `src/data/pcs-tech-pack-task-generation.ts`
  - `src/data/fcs/production-tech-pack-snapshot-builder.ts`
  - `src/data/fcs/production-order-tech-pack-runtime.ts`
  - `src/data/fcs/production-artifact-generation.ts`
  - `src/data/fcs/process-tasks.ts`

- [ ] 第 4 批：连续工序任务合并与分配页面
  - `src/data/fcs/runtime-process-tasks.ts`
  - `src/pages/process/task-breakdown.ts`
  - `src/pages/dispatch/continuous.ts`
  - `src/data/app-shell-config.ts`

- [ ] 第 5 批：脚本、治理记录和浏览器验收
  - `scripts/check-tech-pack-process-route.ts`
  - `scripts/check-continuous-process-route-eligibility.ts`
  - `package.json`
  - `docs/prototype-review-records/2026-07-07-process-route-serial-parallel.md`

---

## 11. 总体验收清单

- [ ] 工序工艺字典展示基础路线顺序。
- [ ] 技术包工序 Tab 支持串行路线可视化编辑。
- [ ] 技术包工序 Tab 支持并行组可视化编辑。
- [ ] 并行组默认不允许整体承接。
- [ ] 跟单可以明确选择并行组整体承接。
- [ ] 跟单修改路线后自动取消路线确认。
- [ ] 跟单确认路线后记录确认人和确认时间。
- [ ] 未确认工艺路线不能通过跟单审核。
- [ ] 未确认工艺路线不能发布正式技术包。
- [ ] 生产单冻结技术包时冻结路线字段。
- [ ] 任务生成顺序优先使用冻结路线。
- [ ] 并行任务之间不互相依赖。
- [ ] 并行组之后的任务依赖组内全部任务。
- [ ] 连续工序任务只能由任务清单合并生成。
- [ ] 连续工序合并必须基于冻结路线判断。
- [ ] 非相邻工序不能合并为连续工序任务。
- [ ] 并行组未允许整体承接时不能参与连续合并。
- [ ] 并行组允许整体承接但只选部分工序时不能合并。
- [ ] 连续工序任务不允许按明细拆分。
- [ ] 连续工序任务分配页只负责分配，不负责生成。
- [ ] 仅包含车缝和后道的连续任务展示裁片和辅料判断。
- [ ] `KOL样品小单` 仍走整单任务，不被连续工序规则污染。
- [ ] 所有页面展示中文业务文案，不展示英文状态码。
- [ ] 所有新增或修改的列表保留分页或受控渲染量。
- [ ] 关键点击响应不超过 200ms。
- [ ] CodeGraph 同步后状态为最新。
- [ ] `npm run check:tech-pack-process-route` 通过。
- [ ] `npm run check:continuous-process-route-eligibility` 通过。
- [ ] `npm run check:fcs-task-generation-rules` 通过。
- [ ] `npm run check:fcs-production-tech-pack-snapshot` 通过。
- [ ] `npm run check:prototype-design-governance` 通过。
- [ ] `npm run build` 通过。

---

## 12. 自查

- 覆盖范围：已覆盖工序工艺字典、技术包、审核发布、生产单快照、任务生成、任务清单、连续工序任务分配、检查脚本和治理记录。
- 业务边界：整单任务不进入普通分配；连续工序任务不由规则生成；连续工序任务不允许按明细拆分。
- 技术边界：不引入后端、状态管理、React 页面迁移或新 UI 框架。
- 风险点：技术包工序 Tab 现有逻辑较集中，实施时如果局部 patch 继续加重复杂度，允许在 `process-domain.ts` 当前模块范围内重写工序 Tab 渲染函数，但必须保持事件入口和 `syncTechPackToStore()` 写回兼容。
