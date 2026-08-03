# PCS 全局冷启动性能原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-08-03 |
| 相关需求 / 任务 | 查生产、仓库执行事实、PDA 路由和图标加载性能收口 |
| 涉及系统 | PCS / FCS / PDA |
| 涉及页面路径 | `/pcs/engineering/masters`、`/fcs/pda/cutting/inbound/:id`、`/fcs/pda/cutting/handover/:id` |
| 端类型 | 管理端 / 员工执行端 |
| 主要角色 | 跟单、仓库人员、裁床人员 |
| 主要任务 | 快速进入工程主单；按需查询生产对象；按当前 PDA 路由执行任务 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 未改变角色与业务动作 |
| 任务清晰度 | 通过 | 查生产入口与 PDA 原有任务不变 |
| 信息架构与导航 | 通过 | 路由、菜单和页面结构不变 |
| 页面模式 | 通过 | 仅调整加载边界 |
| 信息负荷 | 通过 | 搜索壳仅保留必要提示 |
| 文案 | 通过 | 全中文且动作明确 |
| 数量与状态 | 通过 | 仓库执行事实复用同一计算快照，口径不变 |
| 扫码与识别 | 通过 | PDA 扫码事件按当前路由加载，行为不变 |
| 防错 | 通过 | 非当前 PDA 路由不会加载或误处理其他页面事件 |
| UI 样式 | 通过 | 沿用既有样式 |
| 组件交互 | 通过 | 查生产搜索壳首次打开 34ms |
| 协作关系 | 通过 | 未改变上下游关系 |
| 异常与追溯 | 通过 | 未改变事实和追溯字段 |
| 现场设备可用性 | 通过 | 减少 PDA 非当前页面资源加载 |

## 4. 问题标签

- `视觉干扰`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 页面启动时构造全量生产搜索索引，阻塞所有页面 | 视觉干扰 | 全部用户 | 搜索壳与查询域拆分，点击打开轻量壳，输入后按需加载查询域 | 否 |
| 进度事实按任务重复生成全量仓库执行单 | 视觉干扰 | 跟单、仓库 | 一次生成执行单快照并按任务复用 | 否 |
| PDA 全局事件静态加载多个页面 | 视觉干扰 | 现场人员 | 按当前路由加载唯一事件处理器 | 否 |

## 6. 最终结论

结论：通过

说明：页面业务结构、动作和数据口径未改变；生产构建及真实浏览器验证通过。

## 7. 变更覆盖与验证

### 受管文件

- `src/main.ts`
- `src/components/shell.ts`
- `src/components/production-object-floating-entry.ts`
- `src/components/production-object-overview.ts`
- `src/icons/shell-icons.ts`
- `src/main-handlers/pda-handlers.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/fcs/store-domain-progress.ts`
- `src/data/fcs/warehouse-material-execution.ts`

### 页面路由

- `/pcs/engineering/masters`
- `/fcs/pda/cutting/inbound/:id`
- `/fcs/pda/cutting/handover/:id`

### 验证命令

- `npm test -- tests/pcs-global-cold-start-boundary.spec.ts`：通过
- `npm run build`：通过
- `npm run check:prototype-design-governance -- --all`：通过

### 例外

- 无
