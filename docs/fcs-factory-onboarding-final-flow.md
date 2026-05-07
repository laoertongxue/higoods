# 工厂入驻最终口径

## 完整业务流程

工厂填写入驻申请
-> 填写工厂简称和手机号
-> 系统用工厂简称生成登录账号
-> 平台初审
-> 已通过进入待样衣验证
-> 未通过回到平台审核退回并可重新提交
-> 平台发放样衣
-> 工厂确认收样
-> 工厂提交样衣资料和工厂资料
-> 系统分配默认 PPIC
-> 平台样衣审核
-> 未通过回到样衣审核退回并可重新提交
-> 已通过进入样衣审核通过待转正式
-> 平台转正式合作
-> 生成工厂档案
-> 管理员账号转正式
-> 生成产能档案
-> 开放业务页

## 状态图

草稿
-> 待平台审核
-> 平台审核退回
-> 待平台审核

待平台审核
-> 待样衣验证
-> 待工厂确认收样
-> 待工厂提交样衣审核
-> 待平台审核样衣
-> 样衣审核退回
-> 待平台审核样衣
-> 样衣审核通过待转正式
-> 已转正式合作

## 关键规则

- 工厂简称作为登录账号，保存草稿和提交时自动写入 `adminAccount.loginId`。
- 手机号是页面主字段，不再展示 WhatsApp。
- 平台初审和样衣审核结果统一为已通过、未通过。
- 未通过均允许再次申请或重新提交，不再锁定账号。
- 工厂提交样衣审核时，样衣照片、样衣视频、工艺说明、工厂照片、工厂视频必填。
- 老板身份资料在工厂端非必填，平台样衣审核已通过前必须补齐。
- 工厂提交样衣后自动分配默认 PPIC，平台可修改 PPIC，并记录变更。
- 转正式后生成工厂档案、正式管理员账号和产能档案初始数据。
- 只有已转正式合作可以进入执行、交接、仓管、结算。
- 页面只保留标题、字段、状态、按钮、校验和短空状态，不保留说明性长文案。

## 验收

- 最终检查脚本：`scripts/check-factory-onboarding-final-flow.ts`
- 关键分步脚本：`scripts/check-factory-onboarding-step8-form-account-simplify.ts`、`scripts/check-factory-onboarding-step9-review-result-simplify.ts`、`scripts/check-factory-onboarding-step10-sample-submit-materials.ts`、`scripts/check-factory-onboarding-step11-ppic-assignment.ts`
- Playwright 覆盖：`tests/factory-onboarding-final-flow.spec.ts`
