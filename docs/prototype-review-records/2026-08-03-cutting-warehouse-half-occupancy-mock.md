# 裁床两类仓库半数库位占用 Mock 原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-03 |
| 相关需求 / 任务 | 待加工仓、待交出仓的库位 Mock 数据约一半显示占用 |
| 涉及系统 | PFOS |
| 涉及页面路径 | `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`；`/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations` |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 裁床仓管员、裁床主管 |
| 主要任务 | 通过库位图同时识别空闲库位和占用库位，并查看占用对象 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 面向仓管员和主管展示仓储位置事实。 |
| 任务清晰度 | 通过 | 汇总直接显示空闲、占用和总库位数。 |
| 信息架构与导航 | 通过 | 沿用两类仓库既有库位图入口；仓库跟随当前工厂，不在库位图内跨工厂切换。 |
| 页面模式 | 通过 | 围绕“什么物料或中转袋在哪里”组织。 |
| 信息负荷 | 通过 | 工厂仓库信息、统计、版本和操作合并为一个头部卡片；不展示生产单占用摘要。 |
| 文案 | 通过 | 页面状态、对象和单位均使用中文业务语义。 |
| 数量与状态 | 通过 | 待加工仓展示卷数及 Yard / 米，待交出仓展示菲票及片数。 |
| 扫码与识别 | 通过 | 本次不修改扫码入口；占用详情保留对象图片和编号。 |
| 防错 | 通过 | 展示 Mock 仅注入 Web 库位图，执行选位投影仍只读取真实运行事实。 |
| UI 样式 | 通过 | 复用既有绿色空闲、红色占用样式，并移除占用摘要卡片区。 |
| 组件交互 | 通过 | 占用格继续复用局部详情抽屉。 |
| 协作关系 | 通过 | 占用详情保留入仓人和入仓时间。 |
| 异常与追溯 | 通过 | Mock 对象均带生产单、物料或袋号、库位和明细。 |
| 现场设备可用性 | 通过 | 不增加首屏 DOM 规模，仍使用既有货架视窗分页。 |

## 4. 问题标签

- 无

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 正常库位图未注入演示占用，且旧生成器最多只占 2 个库位 | `状态抽象` | 仓管员、主管 | Web 库位图默认按当前有效库位动态补足一半占用；待加工仓生成布卷物料，待交出仓生成唯一中转袋及菲票明细 | 否 |

## 6. 最终结论

结论：通过

说明：两类仓库均能同时演示空闲和占用状态；当货架层位数量变化时，展示占用数随当前有效库位数重新计算。执行选位投影不注入演示占用。

## 7. 变更覆盖与验证

### 受管文件

- `src/pages/process-factory/cutting/warehouse-location-map.ts`
- `src/components/ui/warehouse-location-map.ts`

### 页面路由

- `/fcs/craft/cutting/warehouse-management/wait-process?tab=locations`
- `/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations`

### 验证命令

- `npm run check:cutting-warehouse-location-map`：通过
- `npm run check:prototype-design-governance -- --all`：通过
- `npm run build`：通过

### 例外

- 无
