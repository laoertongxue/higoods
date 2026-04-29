# FCS 工艺工厂 Web 状态操作说明

## 目标

本轮让工艺工厂运营系统的印花、染色、裁片、特殊工艺详情页支持合法状态操作。Web 端只提供当前细状态允许的下一步动作，不提供自由状态下拉框。

## 中文流程图

工艺工厂Web详情  
-> 读取当前细状态  
-> 查询可执行动作  
-> 用户选择合法动作  
-> 填写必填字段  
-> 校验动作合法性  
-> 写回统一事实源  
-> 生成Web端操作记录  
-> 刷新工艺工厂细状态  
-> 平台聚合状态自动派生

## 中文状态机

待操作  
-> 读取可执行动作  
-> 用户确认操作  
-> 校验通过  
-> 写回事实源  
-> 生成操作记录  
-> 状态已更新

异常流转：

用户确认操作  
-> 校验不通过  
-> 显示不可操作原因  
-> 保持原状态

## 操作口径

1. Web 端只能操作合法下一步动作。
2. Web 端不提供自由状态下拉框。
3. Web 端和移动端写回同一事实源或等价 Web 写回 adapter。
4. 平台侧继续通过 `process-platform-status-adapter` 展示聚合状态。
5. 工艺工厂侧保留印花、染色、裁片、特殊工艺细状态。
6. 移动端保留现场执行动作。

## 接入点

- 统一动作模块：`src/data/fcs/process-web-status-actions.ts`
- 印花详情：`src/pages/process-factory/printing/work-order-detail.ts`
- 染色详情：`src/pages/process-factory/dyeing/work-order-detail.ts`
- 裁片原始裁片单抽屉：`src/pages/process-factory/cutting/original-orders.ts`
- 特殊工艺工艺单详情：`src/pages/process-factory/special-craft/work-order-detail.ts`

## 操作记录

Web 操作记录包含动作、前状态、后状态、操作人、操作时间、对象数量、单位、备注和来源。来源固定展示为“Web 端”，用于和移动端执行记录区分。

## 裁片冻结口径

裁片 Web 操作不改变生产单来源、原始裁片单、合并裁剪批次和菲票归属规则。菲票仍归属原始裁片单，合并裁剪批次只作为执行上下文。
