# 工厂入驻第 6 步：样衣通过后正式转档

## 业务定位

只有样衣审核通过后的入驻申请，才能进入正式转档。平台初审通过、发放样衣、工厂确认收样、工厂提交样衣审核、样衣审核退回或拒绝，都不是正式合作。

样衣审核通过后，入驻申请先停留在“样衣审核通过待转正式”。平台确认转档后，系统才生成正式工厂档案、转正管理员账号、生成产能档案初始数据，并将入驻状态变为“已转正式合作”。

## 转正式合作边界

- 仅允许状态为“样衣审核通过待转正式”的入驻申请转正式。
- 转正式前必须关联状态为“样衣审核通过”的样衣验证记录。
- 已生成工厂档案的申请不能重复转档。
- 缺少管理员账号、工序工艺能力或机器能力时，不允许转档。
- 平台初审通过不得直接转正式。

## 字段映射

FactoryOnboardingApplication 到 FactoryProfile 的关键映射：

- `factoryCompanyName` -> 工厂名称
- `applicantName` -> 联系人姓名
- `mobileOrWhatsapp` -> 联系方式
- `address` -> 地址
- `sourceChannel` -> 来源
- `ppicName` -> PPIC 姓名
- `identityNo` / `identityFile` -> 身份资料
- `machineTotalCount` / `effectiveWorkerCount` -> 机器与工人规模
- `availableStartDate` -> 可开始合作时间
- `selectedCapabilities` -> 工序工艺能力
- `machines` -> 机器能力
- `sampleVerificationId` -> 准入样衣验证记录
- `applicationId` / `applicationNo` -> 来源入驻申请

## 管理员账号转正规则

入驻阶段管理员账号保持原 `loginId`，转为正式工厂管理员账号：

- `roleName = 工厂管理员`
- `accountStatus = 已转正式`
- `isTemporary = false`
- 写入 `factoryId`、`factoryName`、`onboardingApplicationId`、`convertedAt`

## 产能档案初始数据

转档时根据入驻资料生成产能档案初始数据：

- `sourceApplicationId` / `sourceApplicationNo`
- `effectiveWorkerCount`
- `machineTotalCount`
- `capabilityItems`
- `machineItems`
- `defaultDailyAvailablePublishedSam = 0`
- `calculationStatus = 待补充产能字段`

如果缺少完整产能计算字段，不按机器数量或人数乱算默认日可供给发布工时 SAM，也不生成产能当前状态、白班、夜班或按周默认供给能力。

## PDA 与派单规则

只有“已转正式合作”才允许进入执行、交接、仓管、结算。转正式前，即使是“样衣审核通过待转正式”，也仍然被拦截到入驻页。

派单候选工厂只来自正式工厂档案。未转档的入驻申请不会进入任务分配候选工厂。

## 中文流程图

样衣审核通过
-> 样衣审核通过待转正式
-> 平台点击转正式合作
-> 生成正式工厂档案
-> 管理员账号转正式账号
-> 生成产能档案初始数据
-> 入驻状态变为已转正式合作
-> 工厂端开放执行交接仓管结算
-> 平台允许派单

## 中文状态图

样衣审核通过待转正式
-> 已转正式合作
-> 完成

非法状态：

待样衣验证
-> 不允许转正式

待工厂确认收样
-> 不允许转正式

待工厂提交样衣审核
-> 不允许转正式

待平台审核样衣
-> 不允许转正式

样衣审核退回
-> 不允许转正式

样衣审核拒绝
-> 不允许转正式
