# FCS 工厂入驻 Step1：模型、状态机、表单字段纠偏

## 1. 纠偏背景

本次不是重做工厂入驻，而是在已有 `factory-onboarding` 模块上把入驻申请模型、工厂端表单、平台初审流转和 PDA 业务准入统一到业务同事当前表单口径。

旧实现把平台审核通过直接推到确认合作或转档链路，容易把“入驻资料初审通过”误表达成“正式合作工厂”。本次只处理平台初审前后的状态纠偏，并为后续样衣验证预留状态字段。

## 2. 平台审核通过不等于正式合作

平台审核只确认工厂提交的身份、联系、能力和机器资料满足进入样衣验证的条件。正式合作还需要后续样衣验证和样衣审核，因此平台初审通过后只能进入 `待样衣验证`。

本次规则：

- 平台审核通过：状态变为 `待样衣验证`，节点变为 `样衣验证`。
- 不生成工厂档案。
- 不转正式管理员账号。
- 不开放执行、交接、仓管、结算业务页。
- 工厂档案只允许在 `样衣审核通过待转正式` 阶段由后续功能处理。

## 3. 入驻申请字段说明

核心模型为 `FactoryOnboardingApplication`，字段分为：

- 基础字段：`applicationId`、`applicationNo`、`factoryTempId`、`status`、`currentNode`。
- 账号字段：`adminAccount.loginId`、`adminAccount.password`、`adminAccount.adminName`、`adminAccount.mobileOrWhatsapp`、`adminAccount.roleId`、`adminAccount.roleName`、`adminAccount.accountStatus`。
- 业务表单字段：`applicantName`、`identityNo`、`identityFile`、`factoryCompanyName`、`address`、`mobileOrWhatsapp`、`sourceChannel`、`ppicName`。
- 系统补充字段：`machineTotalCount`、`effectiveWorkerCount`、`availableStartDate`、`selectedCapabilities`、`machines`。
- 流程字段：`submittedAt`、`lastSubmittedAt`、`reviewedAt`、`sampleVerifiedAt`、`convertedAt`、`createdFactoryId`。
- 记录字段：`nodeLogs`、`actionLogs`、`reviewRecords`、`supplementRecords`。
- 锁定字段：`accountLocked`、`accountLockedReason`、`factoryNameLocked`、`lockedAt`。
- 样衣预留字段：`sampleVerificationId`、`sampleStatus`。

## 4. 状态机说明

当前入驻状态统一为：

`草稿`、`待平台审核`、`平台审核退回`、`平台审核拒绝`、`待样衣验证`、`待工厂确认收样`、`待工厂提交样衣审核`、`待平台审核样衣`、`样衣审核退回`、`样衣审核拒绝`、`样衣审核通过待转正式`、`已转正式合作`。

旧状态通过 `normalizeOnboardingStatus` 兼容迁移，页面只展示新状态文案。

## 5. 节点与状态映射

- `草稿` -> `填写入驻申请`
- `待平台审核` -> `平台审核`
- `平台审核退回` -> `填写入驻申请`
- `平台审核拒绝` -> `完成`
- `待样衣验证` -> `样衣验证`
- `待工厂确认收样` -> `样衣验证`
- `待工厂提交样衣审核` -> `样衣验证`
- `待平台审核样衣` -> `样衣审核`
- `样衣审核退回` -> `样衣验证`
- `样衣审核拒绝` -> `完成`
- `样衣审核通过待转正式` -> `正式合作`
- `已转正式合作` -> `完成`

## 6. 工厂端入驻表单字段说明

工厂端 `/fcs/pda/auth/onboarding` 页面结构：

- 顶部流程节点
- 账号信息：登录账户、登录密码、确认密码
- 基础身份信息：姓名、身份证号码/护照号码、身份证复印件/电子文件
- 工厂联系信息：工厂/公司名称、地址、手机号码/WhatsApp、来源、收到此通知的 PPIC 姓名
- 能力与机器信息：机器数量、有效工人数量、可开始合作时间、工序工艺能力、机器明细
- 附件资料
- 提交确认

机器明细必须关联已选择的工序工艺。保存草稿允许异常，提交入驻申请不允许异常。

## 7. 平台审核三种结果

平台工厂入驻管理页 `/fcs/factories/onboarding` 的初审结果为：

- `通过`：进入 `待样衣验证`。
- `不通过且允许再次申请`：进入 `平台审核退回`，账号保留，工厂可登录后补充资料并再次提交。
- `不通过且不允许再次申请`：进入 `平台审核拒绝`，账号锁定，同名工厂不能再次发起入驻。

## 8. 流程图

```text
工厂填写入驻申请
-> 提交平台审核
-> 平台审核
-> 审核通过进入待样衣验证
-> 审核退回允许再次申请
-> 审核拒绝锁定账号
```

## 9. 中文状态图

```text
草稿
-> 待平台审核
-> 平台审核退回
-> 待平台审核
-> 待样衣验证

待平台审核
-> 平台审核拒绝

待样衣验证
-> 待工厂确认收样
-> 待工厂提交样衣审核
-> 待平台审核样衣
-> 样衣审核退回
-> 待工厂提交样衣审核
-> 待平台审核样衣
-> 样衣审核通过待转正式
-> 已转正式合作

待平台审核样衣
-> 样衣审核拒绝
```

## 10. 转档规则

`canCreateFactoryProfile(status)` 只有在 `样衣审核通过待转正式` 时返回 true。即使具备该判断，本次也不执行转档，不生成工厂档案，不生成产能档案，不转正式管理员账号。

`canFactoryEnterBusiness(status)` 只有在 `已转正式合作` 时返回 true。`待样衣验证`、样衣审核中、待转正式都不能进入执行、交接、仓管、结算。

## 11. 本次不实现内容

本次不实现完整样衣对象、样衣发放页面、工厂确认收样页面、样衣资料提交页面、样衣审核页面和转正式页面。当前只预留 `sampleVerificationId`、`sampleStatus` 以及样衣相关状态，供下一步继续补齐。
