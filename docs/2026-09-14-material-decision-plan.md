# 物料监控与决策原型实施计划

基线：main a8a9b5cf；独立分支codex/material-decision-20260914。依据：material-decision-product-v2.md（含两个成衣仓修订）。

## 范围与完成条件

在DDS中实现七入口、详情、方案比较、风险处理和规则草稿试算发布的本地演示。明确演示快照，不接入或更改线上账务。真实图片缺失列为素材阻塞，不用无关图片冒充。生产连接器、服务端权限、真实审批通知及实物对账独立列矩阵，不能以本地交互代替验收。桌面验收1366×768、最低1280×720；额外分辨率仅以实际证据记录。

## 工作包与依赖

- [ ] W1 档案与对象：src/data/material-decision/model.ts、fixtures.ts；17仓、7加工类别、包材映射、来源与Mock标签，真实图片缺失保持阻塞。
- [ ] W2 计算规则：src/data/material-decision/calculations.ts；库存、需求覆盖、剩余供给、时间余额。processing.ts及packaging.ts为独立演算面板，不代表主库存联动；单元测试验证数量边界。
- [ ] W3 页面与导航：src/pages/material-decision/index.ts、views.ts、events.ts；七路由、详情、筛选导出、标准表格分页列偏好。src/router/routes.ts、src/data/app-shell-config.ts、src/main.ts仅做对应入口接线，保留其他入口。
- [ ] W4 模拟工作流：src/data/material-decision/workflow.ts与events.ts；风险、方案、草稿试算、版本与本地模拟发布，不调用真实执行接口。
- [ ] W5 集成边界：登记真实连接器、源账务、服务端权限、通知、审批等依赖；原型仅角色模拟与人工单号关联，未接入的生产能力保持已阻塞。
- [ ] W6 验收追踪：tests/unit/material-decision*.test.ts、tests/material-decision.spec.ts及config；专项及命名页面、最终类型构建治理CodeGraph收据；按原子条款更新矩阵和审查记录。

依赖W1→W2→W3/W4→W6；W5是独立生产依赖及原型边界，不因W6本地通过而解除。全量40验收及19章规范性要求逐条追踪，生产集成与缺素材不能标已验证；矩阵存在未完成项时不得声称完整交付。所有本地数量与行为只为原型演示。当前其他分支改动不吸收。
