# 工厂入驻口径收口第 1 步：入驻表单与账号口径收口

## 背景

本次收口将工厂端入驻表单从“工厂手动填写账号信息”改为“系统根据工厂简称自动生成登录账号”。入驻页只表达业务资料采集，不再让工厂填写登录账户、登录密码、确认密码。

## 删除账号信息模块的原因

入驻申请的核心是采集工厂身份、联系、能力和机器资料。账号是系统内部结果，不应成为工厂端入驻表单的独立采集模块。删除账号信息模块后，页面更贴近业务同事的采集表，也避免登录账号与工厂身份不一致。

## 工厂简称作为登录账号

- 工厂端入驻表单新增字段：工厂简称。
- 工厂简称必填。
- 工厂简称 trim 后不能为空。
- 工厂简称作为该入驻工厂的登录账号来源。
- 保存草稿和提交入驻申请时，系统自动生成或更新 `adminAccount.loginId = factoryShortName`。
- 页面如需提示登录账号，只显示“登录账号：工厂简称”，不展示密码。

## 工厂简称全局唯一范围

工厂简称唯一性覆盖：

- 所有入驻流程中的 `FactoryOnboardingApplication.factoryShortName`。
- 所有正式工厂档案中的 `FactoryProfile.factoryShortName`。
- 正式工厂档案缺少简称时，以工厂名称作为兜底比对。

校验提示：

- 未填写：请填写工厂简称。
- 重复：工厂简称已存在，请更换。

## 入驻申请与正式工厂档案关系

入驻阶段和正式合作阶段使用同一套工厂简称口径。转正式时：

- `application.factoryShortName -> factoryProfile.factoryShortName`
- `application.mobilePhone -> factoryProfile.mobilePhone`
- `application.adminAccount.loginId = factoryShortName`

这样可以防止未转正式或已转正式的工厂通过重复简称再次入驻。

## adminAccount 自动生成规则

当入驻申请保存草稿或提交时，系统根据表单字段生成临时管理员账号：

- `loginId = factoryShortName`
- `adminName = applicantName`
- `mobilePhone = mobilePhone`
- `roleName = 工厂管理员`
- `accountStatus = 入驻中`
- `isTemporary = true`

系统内部可保留默认模拟密码用于原型登录，但入驻表单不展示密码字段。

## 手机号替代 WhatsApp

用户界面统一使用“手机号”：

- 工厂端入驻页显示“手机号”。
- 平台入驻管理列表和详情显示“手机号”。
- 正式工厂档案显示“手机号”。
- `mobileOrWhatsapp` 仅作为兼容字段保留，不再作为页面展示字段。

## 不变范围

本次不调整：

- 平台初审三种结果。
- 样衣发放、确认收样、提交样衣资料字段。
- 样衣审核结果。
- PPIC 字段和逻辑。
- 正式转档状态机和生成逻辑。
- `/fcs/pda/auth/login` 与 `/fcs/pda/auth/onboarding` 路由。

禁止恢复 `/fcs/pda/login` 或增加兼容跳转。

## 中文流程图

工厂填写入驻申请  
-> 填写工厂简称  
-> 系统校验工厂简称是否唯一  
-> 唯一则保存入驻申请  
-> 系统用工厂简称生成登录账号  
-> 工厂使用工厂简称登录

## 中文状态图

未填写工厂简称  
-> 无法提交

工厂简称重复  
-> 无法提交

工厂简称唯一  
-> 生成入驻申请  
-> 自动生成临时管理员账号
