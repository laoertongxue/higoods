# FCS 移动端列表与直达详情一致

## 目标

修复 Web 端允许打开移动端执行详情，但在工厂端移动应用执行列表中搜索不到同一任务的问题。

## 中文流程图

```text
Web加工单详情
-> 读取移动端任务绑定
-> 校验任务可执行
-> 校验任务在移动端列表可见
-> 显示打开移动端执行页
-> 进入移动端任务详情
-> 返回移动端执行列表
-> 搜索任务号或加工单号
-> 定位同一任务
```

## 中文状态机

```text
待校验
-> 任务绑定有效
-> 移动端列表可见
-> 允许直达详情
-> 可搜索定位
```

异常流转：

```text
任务绑定有效
-> 移动端列表不可见
-> 禁止直达执行
-> 显示不可执行原因
```

```text
URL直达详情
-> 校验当前工厂
-> 校验可执行状态
-> 允许查看或显示不可执行原因
```

## 统一模块

- `/Users/laoer/Documents/higoods/src/data/fcs/mobile-execution-task-index.ts`
- `/Users/laoer/Documents/higoods/src/data/fcs/process-mobile-task-binding.ts`

## 核心收口

1. PDA 执行列表统一从 `listMobileExecutionTasks` 取数。
2. PDA 执行详情统一从 `getMobileExecutionTaskById` / `getMobileExecutionTaskBySource` 取数。
3. Web 端直达按钮统一携带 `returnTo`、`sourceType`、`sourceId`、`currentFactoryId`。
4. PDA 详情返回时优先回到带搜索关键字和 Tab 的执行列表。

## 搜索字段

执行列表搜索覆盖以下字段：

1. 任务 ID / 任务号
2. 加工单号 / 来源单号
3. 生产单号
4. 来源任务号
5. 工厂名称 / 工厂编号
6. 印花花型号 / 面料 SKU
7. 染色原料面料 SKU / 目标颜色 / 色号
8. 原始裁片单号 / 合并裁剪批次号
9. 特殊工艺工艺单号 / 特殊工艺名称 / 菲票号 / 裁片部位

## 详情页规则

1. 不属于当前工厂时，提示“当前任务不属于当前工厂”。
2. 未接单时，提示“当前任务尚未接单，不能执行”。
3. 报价或待定标时，提示“当前任务仍在报价或定标阶段，不能执行”。
4. 不可执行任务只显示只读提示，不显示开始、完工、交出等执行按钮。
