# 生产单管理计划/状态/交付仓清理设计

## 背景

当前 FCS 的「生产单管理」分组下存在三个独立入口：

- 生产单计划
- 状态管理
- 交付仓配置

这三个入口对应的页面和事件逻辑会维护生产单计划、生命周期状态和交付仓字段。现在需要从原型中彻底删除这些概念，避免菜单、页面、事件和数据模型继续保留无效能力。

## 目标

1. 删除「生产单计划」「状态管理」「交付仓配置」三个菜单入口和路由。
2. 删除三个专属页面模块及其事件处理。
3. 从生产单数据模型和 mock seed 中移除 `plan*`、`deliveryWarehouse*`、`lifecycle*` 字段。
4. 其他页面中凡是仅展示这些字段的位置，直接删掉展示，不做空值兜底。
5. 保持生产单管理、生产需求、任务拆解、生产准备时效、生产单变更、工序工艺字典等现有有效入口可用。

## 非目标

- 不引入新的计划页、状态页或交付仓替代页。
- 不新增真实后端、权限、状态机、API 层或状态管理库。
- 不重构生产单任务拆解、生产单变更、生产准备时效、交接、仓储或结算链路。
- 不保留旧路径兼容跳转页。
- 不用空字符串、`-`、`待配置` 等占位方式继续展示被删除概念。

## 范围

### 导航与路由

删除以下路由和菜单项：

- `/fcs/production/plan`
- `/fcs/production/status`
- `/fcs/production/delivery`
- 对应的「生产单计划」「状态管理」「交付仓配置」菜单配置。

旧路径访问可以落入现有未匹配路由处理，不新增兼容逻辑。

### 页面模块

删除或断开以下专属页面模块：

- `src/pages/production/plan-domain.ts`
- `src/pages/production/status-domain.ts`
- `src/pages/production/delivery-domain.ts`

同时清理 `src/pages/production/context.ts` 和路由分发中对这些模块的导入、调用和状态依赖。

### 事件与页面状态

清理 `src/pages/production/events.ts` 中下列专属动作：

- 保存生产单计划。
- 下发生产单计划。
- 打开/保存交付仓配置。
- 推进或回退生命周期状态。
- 与这些动作绑定的表单字段、筛选字段、提示消息和临时状态。

清理 `src/pages/production/context.ts` 中下列状态：

- 计划表单和计划筛选。
- 交付仓表单。
- 生命周期状态标签、样式、筛选和备注状态。

### 数据模型

从 `ProductionOrder` 和 `ProductionOrderSeed` 中删除：

- `planStartDate`
- `planEndDate`
- `planStatus`
- `planQty`
- `planFactoryId`
- `planFactoryName`
- `planRemark`
- `planUpdatedAt`
- `planUpdatedBy`
- `deliveryWarehouseId`
- `deliveryWarehouseName`
- `deliveryWarehouseStatus`
- `deliveryWarehouseRemark`
- `deliveryWarehouseUpdatedAt`
- `deliveryWarehouseUpdatedBy`
- `lifecycleStatus`
- `lifecycleStatusRemark`
- `lifecycleUpdatedAt`
- `lifecycleUpdatedBy`

同步删除生产单 mock seed 中这些字段。

### 其他展示位置

凡是页面或模板只为展示上述字段，应直接删除对应 UI：

- 打印模板中的交付仓、交付方式、生产单状态中仅依赖被删字段的展示。
- 产能页、进度页、生产单详情、状态汇总中仅展示计划、交付仓或生命周期状态的列、卡片、筛选、统计。
- 检查脚本中要求这些菜单或字段存在的断言。

若某处同时展示其他有效事实，只删除被删字段对应的行、列或文案，保留其余真实链路信息。

## 保留内容

以下内容不属于本次删除：

- 生产单基础状态 `status`，例如待拆解、待分配、执行中、已完成。
- 主工厂和任务分配信息。
- 技术包快照和需求快照。
- 任务拆解、生产准备时效、生产单变更。
- 工序工艺、加工单、交接、仓储、质检、结算事实。

## 清洁要求

实现后不应出现：

- 可见菜单中的「生产单计划」「状态管理」「交付仓配置」。
- 可访问路由分支继续渲染三个旧页面。
- `data-prod-action` 中残留计划、交付仓、生命周期状态专属动作。
- 页面状态中残留未使用的计划表单、交付仓表单、生命周期状态筛选。
- TypeScript 类型中残留已删除字段。
- 检查脚本继续断言这些入口存在。

允许历史设计文档中保留旧需求描述，不要求清理历史记录。

## 验证

最小验证集合：

1. `npm run check:menu-routes`
2. `npm run check:production-order-changes`
3. 更新并运行生产单管理相关检查脚本，例如：
   - `scripts/check-production-order-tech-pack-column.ts`
   - `scripts/check-production-order-ledger-row.ts`
   - `scripts/check-production-order-identity-column.ts`
4. `npm run check:prototype-design-governance -- --all`
5. `npm run build`
6. 浏览器验证：
   - `/fcs/production/orders` 可打开。
   - 生产单管理分组不再出现三个被删入口。
   - 页面控制台无未捕获错误。

## 设计结论

采用彻底删除方案。删除入口、页面、事件、状态和底层字段；其他页面遇到这些概念直接删展示，不做空值占位。这样代码最干净，也避免继续维护已经不需要的伪能力。
