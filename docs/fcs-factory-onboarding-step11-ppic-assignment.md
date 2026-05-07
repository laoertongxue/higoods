# 工厂入驻 Step11：PPIC 默认分配与平台修改

## 业务定位

PPIC 用于标识入驻工厂样衣提交后的平台跟进人。当前原型统一在工厂提交样衣审核资料成功后分配默认 PPIC，平台可在工厂入驻管理中调整跟进人并保留变更记录。

## 默认分配规则

工厂端提交样衣审核资料成功后，系统检查入驻申请是否已有 `assignedPpicId`。

- 未分配：写入 `DEFAULT_FACTORY_ONBOARDING_PPIC`。
- 已分配：保持原 PPIC，不覆盖，不重复写默认分配记录。
- 当前所有自动分配统一使用同一个默认 PPIC。

## 平台修改规则

平台在 `/fcs/factories/onboarding` 的详情页点击“修改 PPIC”，只能选择启用状态的 PPIC。修改后写入当前 PPIC 字段，并新增 `ppicChangeLogs`。

变更记录字段：

- 变更时间
- 变更人
- 原 PPIC
- 新 PPIC
- 修改原因

## 列表与筛选

工厂入驻管理列表展示 PPIC 列。筛选区新增 PPIC 下拉：

- 全部
- 未分配
- 启用 PPIC

## 转正式映射

转正式合作时，入驻申请中的 `assignedPpicId`、`assignedPpicName`、`assignedPpicPhone` 映射到正式工厂档案，产能档案和管理员账号转正逻辑保持不变。

## 不变项

本次不改入驻表单、不改审核结果、不改样衣提交资料、不改正式转档主流程，不恢复 `/fcs/pda/login`。

## 中文流程图

工厂提交样衣审核资料
-> 系统检查是否已有 PPIC
-> 未分配则分配默认 PPIC
-> 写入 PPIC 变更记录
-> 平台列表展示 PPIC
-> 平台可修改 PPIC
-> 转正式后写入工厂档案

## 中文状态图

未分配 PPIC
-> 系统默认分配
-> 已分配 PPIC
-> 平台修改 PPIC
-> 已更新 PPIC
