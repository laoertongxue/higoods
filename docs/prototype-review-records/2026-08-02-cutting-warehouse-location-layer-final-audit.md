# 裁床库位层最终审计与 PDA 事实链修正原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-02 |
| 相关需求 / 任务 | 裁床库位层任务 10 最终逐项审计、全量回归缺口修正 |
| 涉及系统 | FCS / PFOS 裁床与 PDA 仓管 |
| 涉及页面路径 | 生产单总览、PDA 菲票编号与装袋、PDA 中转袋交出、PDA 待加工仓领料差异 |
| 端类型 | 管理端 / 员工执行端 |
| 主要角色 | 裁床主管、裁床仓管员、裁床操作员 |
| 主要任务 | 查看真实裁床事实详情，完成扫码、编号、装袋、交出和领料差异记录 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | Web 面向裁床主管查看事实，PDA 面向现场操作员执行扫码与确认。 |
| 任务清晰度 | 通过 | 每个 PDA 页面仍以当前对象和单一主动作优先。 |
| 信息架构与导航 | 通过 | 生产单状态只在存在裁床事实时进入裁床详情，否则回到生产单台账。 |
| 页面模式 | 通过 | Web 保持只读总览，PDA 保持现场执行页面。 |
| 信息负荷 | 通过 | 没有新增说明卡、管理字段或候选大列表。 |
| 文案 | 通过 | 新增反馈均为短中文动作或阻断原因。 |
| 数量与状态 | 通过 | 数量、编号完成状态和事件账事实不使用前端猜测。 |
| 扫码与识别 | 通过 | 库位扫码 Enter、特殊工艺回仓扫码和菲票编号完成记录均可识别。 |
| 防错 | 通过 | 无效库位、缺袋码、缺编号事实均阻断；不会写入部分事实。 |
| UI 样式 | 通过 | 复用既有字符串模板、现场输入和反馈样式。 |
| 组件交互 | 通过 | 高频输入与失败反馈局部更新，保持焦点、页面壳和滚动位置。 |
| 协作关系 | 通过 | PDA 写入的编号、交出和差异事实可供 Web 与后续装袋校验消费。 |
| 异常与追溯 | 通过 | 菲票编号完成记录、事件账和真实详情路由均保留来源。 |
| 现场设备可用性 | 通过 | CPU 降速与主线程竞争条件下关键局部反馈低于 200ms。 |

## 4. 问题标签

- `选不对`
- `缺扫码识别`
- `协作断裂`
- `追溯不足`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 库位扫码框未进入全局 Enter 分发 | 缺扫码识别 | 裁床仓管员 | 将 `locationScan` 纳入裁床扫码 Enter 路由，并以无效完整编号验证中文反馈、焦点与局部更新。 | 否 |
| 缺少袋码时仍先构建完整候选投影 | 点错风险 | 裁床仓管员 | 输入级必填失败跳过事实账候选汇总，保留原校验和局部反馈。 | 否 |
| 菲票编号完成后装袋校验仍可能误判缺编号 | 协作断裂 | 裁床操作员 | 持久化统一编号完成记录，装袋前按菲票 ID 或编号识别该事实。 | 否 |
| 领料差异输入导致文件控件被整页重绘替换 | 追溯不足 | 裁床仓管员 | 数量、备注、差异行和照片输入跳过整页重绘，照片名在当前节点局部反馈。 | 否 |
| 生产单状态入口可能进入不存在的裁床详情 | 选不对 | 裁床主管 | 以生产进度投影中的真实详情行为准；无裁床事实时回生产单台账。 | 否 |
| 款式图候选可能落到占位图 | 视觉干扰 | 裁床主管 | 过滤占位候选并使用已有样衣 Mock 图作为加载兜底。 | 否 |
| 畸形编号账可能被误认作已完成 | 协作断裂 | 裁床操作员 | 完成记录统一校验票据关系、正整数编号区间、数量一致性、操作人与完成时间；无效记录不持久化且装袋继续阻断。 | 否 |
| 浏览器无法检测可用资源时仍可能生成大量库位 | 防错不足 | 裁床主管、文员 | 资源 API 不可测时关闭生成，保留输入并提示拆分货架或减少单次生成后重试；不设置固定业务上限。 | 否 |

## 6. 最终结论

结论：通过

说明：

- 本次修正不新增后台、权限、复杂状态机或新的页面层级。
- Web 与 PDA 继续消费同一裁床事实，未恢复已经下线的旧入口或旧流程。
- 当前无产品设计例外。

## 7. 变更覆盖与验证

### 受管文件

- `src/data/fcs/cutting/fei-ticket-numbering.ts`
- `src/main-handlers/pda-cutting-keydown-routing.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-warehouse-wait-process.ts`
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/pages/process-factory/cutting/production-order-overview-projection.ts`
- `src/pages/process-factory/cutting/production-order-overview-view.ts`

### 页面路由

- `/fcs/craft/cutting/production-progress`
- `/fcs/pda/cutting/inbound/:taskId?action=inbound-location`
- `/fcs/pda/cutting/handover/:taskId?action=transfer-bag-handover`
- `/fcs/pda/warehouse/wait-process?scope=cutting`

### 验证命令

- `npm audit --audit-level=low`：通过
- `npm run build`：通过
- `npm run check:factory-internal-warehouse-model`：通过
- `npm run check:cutting-warehouse-location-map`：通过
- `npm run check:cutting:all`：通过
- `npm run check:cutting-warehouse-location-map-e2e`：通过
- `npm run test:cutting:all:e2e`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run check:list-page-governance`：通过
- `node --experimental-strip-types --test tests/workflow-governance/stage-trace.test.ts`：通过（本轮 12/12）

### 例外

- 无
