# FCS 工艺细状态与平台聚合状态映射

## 目标

本轮只收口平台侧状态展示：工艺工厂运营系统和工厂端移动应用继续展示细状态，工厂生产协同系统展示平台可跟单的聚合状态、风险提示和下一步动作。

## 三端状态分层

1. 工艺工厂运营系统展示细状态，例如印花的待花型、打印中、转印中，染色的待原料、染色中、打卷中。
2. 工厂端移动应用展示现场执行状态，例如待开工、进行中、生产暂停、已完工。
3. 工厂生产协同系统展示平台聚合状态：待下发、待接单、待开工、准备中、加工中、待送货、待回写、待审核、异常、已完成、已关闭。

## 中文流程图

生产侧状态展示链路：

工艺工厂细状态
-> 读取工艺类型
-> 进入统一平台状态映射
-> 输出平台聚合状态
-> 输出风险提示
-> 输出下一步动作
-> 工厂生产协同系统展示平台状态

## 中文状态机

正常流转：

待映射
-> 识别工艺类型
-> 识别工艺细状态
-> 映射平台聚合状态
-> 生成风险提示
-> 平台侧展示

异常流转：

识别工艺细状态
-> 未知状态
-> 映射为异常
-> 输出需要补充映射规则

## Adapter

统一模块：

- `src/data/fcs/process-platform-status-adapter.ts`

核心函数：

- `mapCraftStatusToPlatformStatus`
- `mapPrintStatusToPlatformStatus`
- `mapDyeStatusToPlatformStatus`
- `mapCuttingStatusToPlatformStatus`
- `mapSpecialCraftStatusToPlatformStatus`
- `getPlatformStatusForProcessWorkOrder`
- `getPlatformStatusForRuntimeTask`
- `listPlatformStatusOptions`

输出字段：

- `platformStatusLabel`：平台主状态
- `craftStatusLabel`：工厂内部状态
- `platformRiskLabel`：风险提示
- `platformActionHint`：下一步动作
- `platformOwnerHint`：当前责任方

## 页面接入

平台侧：

- `/fcs/process/print-orders` 使用平台聚合状态作为主状态，保留“工厂内部状态”辅助字段。
- `/fcs/process/dye-orders` 使用平台聚合状态作为主状态，保留“工厂内部状态”辅助字段。
- `/fcs/progress/board` 在任务列表和详情中展示平台状态，同时保留现场执行状态说明。

工艺工厂运营系统：

- `/fcs/craft/printing/work-orders` 继续保留印花细状态。
- `/fcs/craft/dyeing/work-orders` 继续保留染色细状态。
- 裁片、特殊工艺页面继续保留各自内部细状态。

移动端：

- `/fcs/pda/exec` 继续保留待开工、进行中、生产暂停、已完工等现场执行分类。

## 裁片口径

本轮只做状态映射，不改变裁片主流程：

- 生产单不因配料、领料、裁剪安排而拆分或合并。
- 可裁判断发生在原始裁片单层。
- 合并裁剪批次只作为执行上下文。
- 菲票归属原始裁片单。
