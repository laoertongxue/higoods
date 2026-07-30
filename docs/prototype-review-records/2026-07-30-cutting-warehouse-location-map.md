# 裁床双仓库位图原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-30 |
| 相关需求 / 任务 | 裁床待加工仓、待交出仓库位可视化与库位图编排 |
| 涉及系统 | PFOS、PDA |
| 涉及页面路径 | `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`、`/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations`、`/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup`、`/fcs/pda/cutting/inbound/:taskId?action=inbound-location` |
| 端类型 | 管理端、员工执行端 |
| 主要角色 | 裁床仓管员、裁床主管、办公室文员 |
| 主要任务 | 查看库位空闲/占用；查看占用对象；编排库位组、货架与库位顺序；PDA 连续多选存放库位；扫码确认中转袋入仓 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-30-cutting-warehouse-location-map-design.md`
- `docs/superpowers/plans/2026-07-30-cutting-warehouse-location-map-implementation-plan.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | PFOS 面向仓管/主管查看和编排；PDA 面向现场仓管执行领料入仓。 |
| 任务清晰度 | 通过 | 页面只突出库位图、空闲/占用、占用明细和编排；PDA 直接进入选位或扫码确认。 |
| 信息架构与导航 | 通过 | 保留待加工仓、待交出仓现有工作台和路由，只把“库区库位”页签统一为“库位图”。 |
| 页面模式 | 通过 | PFOS 使用仓库地图式展示；PDA 使用现场执行式选择和扫码流程。 |
| 信息负荷 | 通过 | 业务状态只保留“空闲”和“占用”，不引入部分占用、预留等现场不需要的状态。 |
| 文案 | 通过 | 页面状态、按钮、错误提示均为中文业务语言。 |
| 数量与状态 | 通过 | 占用明细展示生产单、对象、数量、单位、入仓时间和入仓人；总数量不按库位重复分摊。 |
| 扫码与识别 | 通过 | 中转袋入仓保留袋码、库位码扫码，并验证库位属于当前裁床工厂待交出仓。 |
| 防错 | 通过 | 多选仅允许同货架连续空闲库位；中间取消、跨货架、跨空档、选占用库位均拦截。 |
| UI 样式 | 通过 | 沿用企业后台卡片、边框、状态色；空闲为绿色，占用为红色，选择态独立为蓝色。 |
| 组件交互 | 通过 | 共享库位图用于 PFOS 与 PDA；轻交互局部刷新，不触发整页重绘。 |
| 协作关系 | 通过 | PDA 领料会话、待加工仓事件账、PDA 中转袋入仓与 PFOS 待交出仓读取同一稳定库位事实。 |
| 异常与追溯 | 通过 | 历史文本库位不能唯一匹配时进入“待确认历史库位”；布局损坏、版本冲突和停用库位均有提示。 |
| 现场设备可用性 | 通过 | 库位触控目标不小于 44px，货架横向滚动；PDA 主动作和扫码输入保持单列。 |

## 4. 问题标签

- `选不对`
- `点错风险`
- `缺扫码识别`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 原页面使用静态库区库位表，不能反映真实空闲和占用 | 协作断裂、追溯不足 | 裁床仓管员、裁床主管 | 按当前工厂和仓库主数据生成库位图，并从待加工仓库存、待交出仓事件账投影占用。 | 否 |
| PDA 领料使用固定库区、库位下拉，不能选择连续多库位 | 选不对、点错风险 | 裁床仓管员 | 改为共享库位图，强制同货架、连续、空闲，多选范围一次性保存。 | 否 |
| 库位编号可变，历史业务若只保存编号会失联 | 追溯不足 | 仓管员、办公室文员 | 业务事实保存稳定 `locationId` 及完整仓库路径，编号只作为显示标签。 | 否 |
| 菲票装袋曾可能被误解为已占用待交出仓库位 | 协作断裂 | 装袋员、入仓员 | 只有“中转袋入仓”形成占用；换袋继承原物理库位，最终交出释放。 | 否 |
| 手工输入的库位码可能来自其他仓库或已停用 | 缺扫码识别、选不对 | 入仓员 | 按当前工厂待交出仓实时解析；不存在、停用或编号不唯一时禁止入仓。 | 否 |

## 6. 最终结论

结论：通过

说明：

- 业务状态严格收敛为“空闲 / 占用”两种。
- “库区”在页面上表现为可分散编排的“库位组”，库位组内按货架展示多个库位。
- 库位编号允许修改，但库存、领料会话和中转袋占用均以稳定库位标识追溯。
- 保留原待交出仓单页弹窗工作台，没有把菲票装袋、中转袋入仓和整袋交出重新拆成独立管理页。

## 7. 变更覆盖与验证

### 受管文件

- `src/components/ui/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/warehouse-location-layout-store.ts`
- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/main-handlers/fcs-handlers.ts`
- `src/data/fcs/cutting/pickup-node-domain.ts`
- `src/data/fcs/cutting/production-material-prep.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`

### 页面路由

- `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`
- `/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations`
- `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup`
- `/fcs/pda/cutting/inbound/:taskId?action=inbound-location`

### 验证命令

- `npm run check:cutting-warehouse-location-map`：通过
- `npm run check:factory-internal-warehouse-model`：通过
- `npm run check:pda-pickup-flow`：通过
- `npm run check:material-prep-pickup-management`：通过
- `npm run check:cutting-warehouse-management-switch`：通过
- `npm run check:pda-cutting-inbound-workflow`：通过
- `npm run check:pda-cutting-transfer-bag-handover`：通过
- `npm run check:web-cutting-transfer-bag-actions`：通过
- `npm run check:prototype-design-governance`：通过
- `npm run build`：通过
- PFOS 浏览器验收：1366×768 下待加工仓、待交出仓均正常显示库位组、货架和库位；页面无横向溢出、无控制台错误；库位顺序调整后刷新仍保留。验收中曾发现仓库路由判断未覆盖斜杠型路由，已修正并补入自动检查。
- PDA 浏览器验收：390×844 下领料页面可连续选择同一货架的 `A-01-01`、`A-01-02`，提示“已选 2 个”；中转袋入仓页正常显示袋码、库位码扫描输入和确认动作；页面无横向溢出、无控制台错误。

### 例外

- 库位编排在当前原型仓库中使用浏览器本地存储保存，不接入后端、权限或审批；符合本仓库“静态页面 + 本地 Mock 数据 + 轻量交互”的边界。
- 当前对库位组、货架和库位顺序以及库位编号提供直接编排；库位组、货架和库位实体仍来自既有仓库主数据，本次原型不新增或删除实体。
