# 裁床中转袋按车缝任务交出、拆袋重装与回收报废审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 记录日期 | 2026-08-03 |
| 相关需求 / 任务 | 《裁床中转袋拆袋重装与流转闭环产品需求说明文档》 |
| 记录模式 | 完整产品审查 |
| 涉及系统 | PFOS / FCS |
| 涉及页面路径 | 裁床待交出仓、PDA 仓管待交出仓及中转袋操作页 |
| 端类型 | 员工执行 Web、PDA |
| 主要角色与任务 | 裁床仓管、裁片仓重装员和交出仓管按车缝任务完成直接交出或拆袋重装后交出，并处理来源袋回仓、空袋回收和报废 |

核心业务核查结果：

- 中转袋主状态只保留“使用中、空闲、已报废”；装袋、入仓和交出为阶段，不增加主状态。
- 一次只能处理一个生产单的一个车缝任务、一个接收工厂和该工厂的一名 PPIC；一个生产单对同一车缝工厂仅一个车缝任务。
- 袋内未分配菲票、其他任务菲票属于正常拆袋重装对象，不作为交出异常。
- 只有袋内全部当前有效菲票都属于本任务时才能整袋直接交出；同一批次允许直接交出袋和重装结果袋并存。
- 结果袋在当前流程中直接交出；未作为结果袋且仍有菲票的来源袋默认回原库位并允许修改，清空来源袋转为空闲。
- 特殊工艺回仓是 Web / PDA 独立操作；删除重复的“特殊工艺回仓扫码”说明模块，保留实际表单和记录。
- 回收和报废均有 Web / PDA 独立入口；有菲票不得直接回收或报废，已报废袋不可恢复。

## 2. 影响判定

- 用户可见影响：有
- 判定依据：Web 与 PDA 的中转袋交出从袋号优先或独立拆袋重装调整为按车缝任务启动的统一五步流程；入口、步骤、PPIC 选择、直接交出判定、来源袋复用、剩余袋回仓、特殊工艺回仓入口、回收报废提示和 Mock 数据均发生可见变化。

当前审查基线：

- `AGENTS.md` 第 4 节：印尼工厂现场产品设计基线。
- `AGENTS.md` 第 5 节：UI 与交互专项规则。
- `AGENTS.md` 第 7 节：验证原则。

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色、任务与页面模式 | 通过 | Web 手工填写或选择为主；PDA 扫码优先、手填兜底；两端一次只处理一个生产单的一个车缝任务。 |
| 文案、状态、数量与单位 | 通过 | 主状态只显示使用中、空闲、已报废；来源、直接交出、重装和回仓均显示袋、张、片。 |
| 扫码、真实图片与对象识别 | 通过 | PDA 任务、PPIC、结果袋、菲票和库位支持扫码识别及手填；本次没有新增款式或物料对象，真实图片门禁不适用。 |
| 防错、危险确认与主管兜底 | 通过 | 阻断跨生产单、跨任务、跨工厂、重复或遗漏菲票、已报废袋和未完成流转的无关袋；强制回收要求确认实物已收到、袋内为空并填写原因。 |
| 交接、跨端事实与异常追溯 | 通过 | Web / PDA 共用同一批次、袋票快照、任务、工厂和 PPIC 事实；每只交出袋单独留痕，来源袋重新入仓单独留痕。 |
| 低分辨率、PDA、弱网与上传恢复 | 通过 | Web 1366×768 和 PDA 390×844 可完成主流程；失败保留输入并提示修正；本次不涉及上传。 |
| 命名路由、交互、图片大图与打印 | 通过 | Web、PDA 新路由及旧深链均真实渲染；旧深链进入统一五步流程；本次不涉及图片大图和打印。 |
| Mock 数据完整性 | 通过 | 3 只已入仓来源袋，每袋 5 张 / 100 片并绑定不同库位；包含直接交出、未分配菲票和其他任务菲票三类场景。 |

## 4. 问题标签

- `读不懂`
- `选不对`
- `点错风险`
- `状态抽象`
- `字段过载`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 拆袋重装与中转袋交出分开，操作员不清楚先后关系 | `读不懂`、`协作断裂` | Web / PDA 仓管 | 合并为按车缝任务启动的五步流程，一次确认直接交出与重装结果袋 | 否 |
| PPIC 下拉可选到其他工厂人员 | `选不对` | Web 仓管 | 选择任务后自动回填生产单和工厂，只展示当前工厂 PPIC；提交时再次校验 | 否 |
| 未分配或其他任务菲票被当作异常 | `状态抽象` | Web / PDA 仓管 | 改为正常拆袋重装提示，不阻断当前任务交出 | 否 |
| 来源袋保留菲票后可能没有位置 | `追溯不足` | Web / PDA 仓管 | 强制重新入仓，默认原库位并允许改为其他有效库位 | 否 |
| 特殊工艺回仓混在普通入仓且有重复扫码说明 | `字段过载` | Web / PDA 仓管 | 独立入口和表单，删除重复说明模块 | 否 |
| 旧 PDA 深链仍可能进入袋号优先页面 | `点错风险` | PDA 仓管 | 旧深链在读取旧任务上下文前直接进入统一五步任务交出页 | 否 |

Mock 数量守恒验收：3 袋共 15 张 / 300 片；复用 `BAG-REPACK-DEMO-01` 后，结果袋 10 张 / 198 片，另外 2 只来源袋保留 5 张 / 102 片，数量守恒。

## 6. 最终结论

结论：通过

说明：

- Web 1366×768 已真实完成任务和 PPIC 选择、三袋核对、复用来源袋、10 张目标菲票分配、来源袋回仓和最终提交；反馈为 1 袋已交出待回收、2 袋重新入仓。
- PDA 390×844 已真实完成相同五步流程；完成页逐袋显示 1 袋已交出待回收、2 袋已入仓原库位。
- Web 将来源袋回仓库位从默认 `A-R01-L01-P03` 改为有效库位 `A-R01-L01-P04` 后通过校验，证明默认值可修改。
- PDA 仓管待交出仓只显示六个操作入口，没有独立拆袋重装；特殊工艺回仓为独立页面，页面不包含已删除的重复模块。
- 自动专项、裁床全量、真实 Web 弹窗 E2E、构建和任务事实收据均以最后一次运行结果为交付依据。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/wait-handover-dialogs.ts`
- `src/pages/process-factory/cutting/wait-handover-actions.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/pda-cutting-wait-handover-actions.ts`
- `src/pages/pda-cutting-transfer-bag-repack.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/main-handlers/pda-cutting-keydown-routing.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/transfer-bag-lifecycle.ts`
- `src/data/fcs/cutting/transfer-bag-operations.ts`
- `src/data/fcs/cutting/transfer-bag-handover-mock.ts`
- `src/data/fcs/cutting/transfer-bag-repack-mock.ts`

### 页面路由

- `/fcs/craft/cutting/warehouse-management/wait-handover`
- `/fcs/pda/warehouse/wait-handover?scope=cutting`
- `/fcs/pda/cutting/transfer-bag/repack`
- `/fcs/pda/cutting/handover/:taskId?action=transfer-bag-handover`
- `/fcs/pda/cutting/handover/:taskId?action=special-craft-return`

### 验证命令

- `npm run check:cutting:all`：通过
- `npm run check:web-cutting-transfer-bag-actions`：通过
- `npm run check:pda-cutting-wait-handover-entry-routing`：通过
- `npm run check:pda-cutting-wait-handover-route-integration`：通过
- `npm run check:pda-cutting-transfer-bag-handover`：通过
- `npm run check:transfer-bag-repack-recovery`：通过
- `npm run check:cutting-wait-handover-transfer-bag-flow`：通过，265 项断言通过
- `npm run check:transfer-bag-three-status`：通过
- `npm run check:cutting-warehouse-management-switch`：通过
- `npm run test:cutting-wait-handover-web-modal:e2e`：通过，3 项真实浏览器用例通过
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --all`：通过

### 真实图片验证

- 本次页面没有新增款式或物料展示，真实图片门禁不适用。
- Web 第 2 步验收截图：`output/playwright/transfer-bag-web-handover-step2.png`。

### 例外

- 无
