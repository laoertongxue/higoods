# HiGood 原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-30 |
| 相关需求 / 任务 | 裁床中转袋三主状态、三流转阶段及上下游事实统一 |
| 涉及系统 | PFOS / WLS / FCS |
| 涉及页面路径 | 中转袋流转、中转袋详情、裁床待交出仓 Web、裁床 PDA 装袋 / 入仓 / 整袋交出、中转袋扫码详情、下游交接详情、特殊工艺回仓、标签打印 |
| 端类型 | 管理端 / 主管端 / 员工执行端 |
| 主要角色 | 裁床装袋人员、裁床仓管、交出人员、接收人员、特殊工艺仓管、裁床主管、管理人员 |
| 主要任务 | 用同一套物理袋事实完成装袋、入仓、整袋交出、特殊工艺回仓、物理回收和报废，并把下游接收回写与物理袋生命周期分开 |
| 上游来源 | 菲票、裁片单、生产单、车缝任务、特殊工艺任务 |
| 下游去向 | 裁片待交出仓、车缝或特殊工艺接收任务、物理袋回收、报废记录 |
| 是否涉及扫码 | 是：袋码、菲票、库位、任务 |
| 是否涉及数量 | 是：袋内菲票数、裁片数、生产单归属和差异数量 |
| 是否涉及交接或责任转移 | 是：整袋交出、接收确认、特殊工艺带袋回仓、物理回收 |
| 是否涉及异常或差异 | 是：重复操作、跨生产单装袋、历史模糊数据、接收差异、事实冲突、报废 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-30-cutting-transfer-bag-three-status-design.md`
- `docs/superpowers/plans/2026-07-30-cutting-transfer-bag-three-status.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 业务边界 | 通过 | 物理袋、使用周期、流转段、袋内快照和接收回写已分账 |
| 状态与阶段 | 通过 | 主状态仅保留空闲、使用中、已报废；使用中仅展示三个批准阶段 |
| 上下游闭环 | 通过 | Web、PDA、特殊工艺、下游接收、物理回收、报废、扫码与标签口径均已覆盖 |
| 现场可用性 | 通过 | 业务和源码门禁通过；标准列表、详情、待交出仓及 PDA 关键动作已完成浏览器验收 |

## 3A. 业务对象与边界复核

### 3.1 物理袋身份、使用周期和流转段

| 对象 | 业务定义 | 本次边界 |
| --- | --- | --- |
| 物理中转袋 | 可反复使用的实体袋，袋码和二维码长期稳定 | 主状态只允许“空闲、使用中、已报废” |
| 使用周期 | 从首次确认装袋开始，到物理回收或报废关闭 | 同一只袋可存在多个历史周期；当前周期与历史周期不得串账 |
| 交出流转段 | 同一使用周期内一次整袋交出及其后续去向 | 特殊工艺带袋回仓后关闭当前流转段，仍可在同一周期再次整袋交出 |
| 袋内快照 | 装袋确认时保存的菲票事实 | 第一张菲票确定生产单，后续菲票必须属于同一生产单；入仓和交出只读取，不重建 |
| 接收回写记录 | 下游对已交出对象的接收、差异、异议和回写事实 | 只影响接收记录，不改变物理袋主状态，不提前关闭使用周期 |

### 3.2 三主状态

| 主状态 | 判断口径 | 允许的现场动作 |
| --- | --- | --- |
| 空闲 | 没有未关闭使用周期 | 可开始新的菲票装袋；可由主管确认报废 |
| 使用中 | 已确认装袋，尚未物理回收或报废 | 按当前阶段执行入仓、整袋交出、带袋回仓、物理回收或报废 |
| 已报废 | 已有明确报废事实 | 只读追溯，不允许再次装袋、入仓、交出或回收复用 |

### 3.3 三流转阶段

| 流转阶段 | 已完成事实 | 下一步 |
| --- | --- | --- |
| 菲票已装袋 | 已确认袋号、使用周期和同生产单菲票快照 | 中转袋入仓 |
| 入仓暂存中 | 已确认袋号、库区和库位，袋内快照保持只读 | 整袋交出 |
| 已交出待回收 | 已建立一袋一条的责任转移事实 | 下游接收回写、特殊工艺带袋回仓、物理回收或报废 |

空闲和已报废的当前流转阶段显示“—”。不增加“待清洗”“待维修”等标签或第四种主状态。

## 4. 上下游场景复核

| 场景 | 输入 | 写入事实 | 状态 / 阶段结果 | 防错结论 |
| --- | --- | --- | --- | --- |
| 菲票装袋 | 空闲袋、一个或多个菲票 | 新使用周期、不可变袋内快照、装袋确认事实 | 使用中 / 菲票已装袋 | 阻断非空闲袋、跨生产单、无效菲票、重复确认 |
| 中转袋入仓 | 使用中袋、库区、库位 | 袋级入仓事实，袋内快照由装袋事实派生 | 使用中 / 入仓暂存中 | 页面不再次选择、添加或删除菲票 |
| 中转袋交出 | 入仓暂存中的完整袋、接收任务、接收工厂 | 一袋一条整袋交出事实和流转段 | 使用中 / 已交出待回收 | 不允许按菲票拆分、过滤已交菲票后交剩余内容或一指令处理多袋 |
| 特殊工艺带袋回仓 | 原袋、来源流转段、回仓库位 | 袋级特殊工艺回仓事实并关闭当前流转段 | 使用中 / 入仓暂存中 | 必须扫描实际物理袋；后续可在同周期再次整袋交出 |
| 特殊工艺无袋回传 | 菲票或裁片 | 只更新菲票、裁片和特殊工艺回仓记录 | 中转袋不变 | 不因票据回传推断物理袋已回仓 |
| 下游接收、差异、异议、回写 | 已交出记录 | 接收回写记录 | 物理袋仍为使用中 / 已交出待回收 | 内容差异不自动回收，不自动报废 |
| 物理回收 | 实际回到回收点的袋 | 物理回收事实并关闭使用周期 | 空闲 / — | 只有实际物理回收才允许重新使用 |
| 报废 | 袋号、报废原因、授权主管 | 明确报废事实 | 已报废 / — | 与内容差异、清洁或维修意见分离；危险动作要求确认和操作记录 |
| 扫码详情 | 稳定袋码二维码 | 只读实时查询 | 分列显示物理袋状态、流转阶段、接收回写状态 | 冲突时提示主管核查；动作随物理阶段和记录状态收敛 |
| 标签打印 | 物理袋主档 | 稳定身份二维码 | 不携带实时状态、阶段、周期、库位或接收回写 | 避免可复用标签过期后误导现场 |

## 5. 原型审查清单

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | Web 主列表和详情服务管理、主管追溯；PDA 装袋、入仓、交出服务一线执行；下游详情服务接收和差异处理 |
| 任务清晰度 | 通过 | PDA 按装袋、入仓、整袋交出拆分当前动作；扫码详情只显示当前可执行动作 |
| 信息架构与导航 | 通过 | Web、PDA、扫码详情和下游交接详情读取同一袋级事实；历史“交出装袋确认”深链迁移到整袋交出 |
| 页面模式 | 通过 | 管理端使用标准列表、详情与分页；执行端使用卡片、扫码和单一确认按钮 |
| 信息负荷 | 通过 | 主列表只保留物理袋状态、流转阶段、位置、装载、最近记录和报废记录；执行页不展示完整内部状态机 |
| 文案 | 通过 | 主状态仅为“空闲、使用中、已报废”；阶段仅为“菲票已装袋、入仓暂存中、已交出待回收”；无英文状态码直出 |
| 数量与状态 | 通过 | 菲票、裁片数量带单位；同一生产单规则由系统校验；物理状态、阶段和接收回写分栏展示 |
| 扫码与识别 | 通过 | 袋码和库位优先扫码；二维码只保存稳定袋身份；扫码后实时展示袋号、生产单、接收对象和袋内明细 |
| 防错 | 通过 | 阻断跨生产单、重复确认、错误阶段、部分交出、无物理袋回仓误改状态、差异自动报废 |
| UI 样式 | 通过 | 标准列表列设置和拖拽门禁通过；1366×768、1280×720 下列表、详情和待交出仓页面主体均无横向溢出 |
| 组件交互 | 通过 | 详情页签、Web 弹窗和 PDA 扫码反馈采用局部更新；Web 提交失败不再触发整页重绘并关闭弹窗 |
| 协作关系 | 通过 | 装袋人员、仓管、交出方、接收方、特殊工艺仓管和回收人员写入不同事实，责任边界明确 |
| 异常与追溯 | 通过 | 保留使用周期、交出流转段、来源交出记录、操作人、时间、库位、差异和报废原因 |
| 现场设备可用性 | 通过 | PDA 结构为低信息密度、动作优先；1280×720 和 1366×768 浏览器验收均可完成主要查看与操作 |

## 6. 问题标签

- `状态抽象`
- `点错风险`
- `协作断裂`
- `追溯不足`
- `组件误用`

## 7. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 旧代码把“装袋中、待交出、已交出”等过程或记录状态当作袋状态 | `状态抽象` | 全部角色 | 建立三主状态和三阶段纯派生模型，页面分列展示 | 否 |
| Web 与 PDA 曾写不同临时账，刷新或跨端后可能不一致 | `协作断裂` | 装袋人员、仓管、主管 | 装袋、入仓、整袋交出统一写运行时事实账，并按袋码和使用周期投影 | 否 |
| 旧交出流程允许按菲票确认或过滤部分内容 | `点错风险` | 交出人员、接收人员 | 交出最小单位固定为完整中转袋，一次确认一袋 | 否 |
| 特殊工艺菲票回传可能被误判为物理袋回仓 | `协作断裂` | 特殊工艺仓管、裁床仓管 | 有袋和无袋回仓分支独立，只有实际扫描物理袋才改变袋阶段 | 否 |
| 下游接收差异可能被用于关闭或报废物理袋 | `状态抽象` | 接收人员、回收人员 | 接收回写和物理生命周期分账；只有物理回收或明确报废事实可关闭周期 | 否 |
| 物理标签携带实时状态会随复用过期 | `追溯不足` | 扫码人员 | 标签只打印稳定身份，实时状态扫码查询 | 否 |
| 最终复查发现主处理器仍保留旧装袋、入仓、交出直写分支，详情历史仍回退“交出装袋” | `协作断裂` | 管理人员、后续维护人员 | 删除旧分支的事件入口；详情历史统一映射到三个批准阶段；新增专项门禁 | 否 |
| 标准列表模板首次加载超过旧默认等待时间 | `组件误用` | 原型验收人员 | 只扩大首次加载等待时间；列设置、拖拽、冻结、分页和 DOM 稳定断言保持不变并已通过 | 否 |
| Web 弹窗校验失败后被通用整页重绘关闭，容易被误认成提交成功 | `点错风险` | 裁床仓管 | 提交按钮声明局部处理；失败保留弹窗和输入，成功才关闭并刷新统一事实 | 否 |
| 特殊工艺带袋交出只取当前扫描菲票，可能部分内容推动整袋阶段 | `协作断裂` | 特殊工艺交出人员、裁床仓管 | PDA 按整袋组装同工艺、同接收工厂明细；底层再次校验完整袋内快照和数量 | 否 |

## 8. 性能、分页与低分辨率复核

- 中转袋主列表保留分页、每页条数和总数口径，宽表在表格容器内滚动。
- 主列表的状态筛选只允许三个主状态，阶段筛选只允许三个流转阶段。
- 操作列保持右侧可见；袋码、状态、阶段和报废属于不可省略的防错信息。
- Web 弹窗、PDA 扫码反馈和详情动作采用局部状态更新，不因输入事件重绘整个应用外壳。
- 交互响应目标为 200ms 以内；PDA 成功/失败反馈和 Web 弹窗打开均用 `performance.now()` 实测，保持局部 DOM 更新。
- 1366×768 为标准验收分辨率、1280×720 为最低可用分辨率；列表、详情和待交出仓页面主体宽度均等于视口宽度，宽表只在表格容器内滚动。

## 6. 最终结论

结论：通过

说明：

- 业务模型、状态边界、上下游事实写入、跨端投影、防错、历史周期、二维码和标签口径通过源码审查与专项自动检查。
- 本轮复查新增清理了主事件处理器中的旧装袋 / 入仓 / 交出直写入口，并将中转袋详情历史阶段统一到三阶段口径。
- 逐项复查继续补齐了真实标准列表接线、11 个详情事实区、特殊工艺任务/进度上游、特殊工艺整袋交出以及 Web 失败弹窗保留。
- 本地实现与验证闭环不等于远端交付；没有 GitHub provider 回执时不得表述为远端“已交付”。

## 7. 变更覆盖与验证

### 受管文件

#### 数据与事实

- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/qr-codes.ts`
- `src/data/fcs/cutting/qr-payload.ts`
- `src/data/fcs/cutting/transfer-bag-lifecycle.ts`
- `src/data/fcs/cutting/transfer-bag-runtime.ts`

#### Web 页面与交互

- `src/main.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/pages/process-factory/cutting/transfer-bag-return-model.ts`
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/process-factory/cutting/transfer-bags-projection.ts`
- `src/pages/process-factory/cutting/transfer-bags.ts`
- `src/pages/process-factory/cutting/transfer-bags/detail.ts`
- `src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
- `src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- `src/pages/process-factory/cutting/transfer-bags/list.ts`（删除）
- `src/pages/process-factory/cutting/transfer-bags/state.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/wait-handover-web-actions.ts`（删除）

#### PDA、下游与打印

- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-handover-detail.ts`
- `src/pages/pda-transfer-bag-detail.ts`
- `src/pages/print/templates/label-print-template.ts`
- `src/pages/process-factory/special-craft/task-orders.ts`
- `src/pages/process-factory/special-craft/task-detail.ts`
- `src/data/fcs/progress-statistics-linkage.ts`

### 页面路由

- `/fcs/craft/cutting/transfer-bags`
- `/fcs/craft/cutting/transfer-bag-detail`
- `/fcs/craft/cutting/warehouse-management/wait-handover`
- `/fcs/pda/warehouse/wait-handover?scope=cutting`
- `/fcs/pda/cutting/inbound/:taskId`
- `/fcs/pda/cutting/handover/:taskId`
- `/fcs/pda/transfer-bag-detail?bagNo=:bagNo`
- `/fcs/pda/handover/:handoverId`

### 验证命令

- `npm run check:transfer-bag-three-status`：通过
- `npm run check:cutting-wait-handover-transfer-bag-flow`：通过
- `npm run check:web-cutting-transfer-bag-actions`：通过
- `npm run check:pda-cutting-inbound-workflow`：通过
- `npm run check:pda-cutting-transfer-bag-handover`：通过
- `npm run check:pda-cutting-wait-handover-entry-routing`：通过
- `npm run check:transfer-bag-mobile-closed-loop`：通过
- `npm run check:pda-handover-detail-source`：通过
- `npm run check:cutting-sewing-dispatch`：通过
- `npm run check:list-page-governance`：通过
- `npm run check:standard-list-page-template`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- 相关 8 个中转袋 Playwright 文件：通过
- 1366×768、1280×720 列表 / 详情 / 待交出仓页面宽度检查：通过
- `npm run build`：通过
- `npm run workflow:verify`：失败（任务相关检查均通过，但受未改动页面 `production-order-overview-view.ts` 的既有 `min-w >= 1600px` 全量门禁阻断，收据状态为 `implemented`）

### 例外

- `npm run check:cutting:all` 已进入并通过本次新增中转袋门禁，随后在未改动的 `src/pages/process-factory/cutting/production-order-overview-view.ts` 命中既有 `min-w >= 1600px` 失败。本任务不扩大到该宽表页面。
- `check:handover-writeback-difference-unification` 在未改动的 `src/pages/process-factory/printing/work-order-detail.ts` 因缺少“交出面料米数”失败；该问题在任务基线已存在，不属于中转袋物理生命周期。
- 上述两项是仓库其他页面的既有全量门禁问题；本任务相关专项门禁、浏览器验收、生产构建和 CodeGraph 均已独立通过。最终任务收据必须如实保留全量门禁结果，因此状态为 `implemented`，不得表述为 `verified`。
