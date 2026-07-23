# 印染旧链路彻底清理实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除印花、染色需求单的一切旧对象与兼容逻辑，并用真实加工单完成成衣端到端链路验收。

**架构：** `ProcessWorkOrder` 是唯一印染执行事实；BOM 工艺属性只决定是否生成实际加工单。仓库/PDA/后道通过加工单、任务和生产单关联，不保留需求对象。每个状态动作要求实际正数 SKU 数量，跨域写回在失败时回滚。

**技术栈：** TypeScript、Vite、Vanilla string templates、Playwright、项目专项检查。

---

### 任务 1：删除印染需求对象与仓库兼容字段

**文件：**
- 修改：`src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- 修改：`src/data/fcs/process-warehouse-domain.ts`
- 修改：`src/data/fcs/process-warehouse-linkage-service.ts`
- 修改：`src/data/fcs/production-artifact-generation.ts`
- 修改：相关导入与专项检查

- [ ] 先增加静态/领域测试：印染准备页只读取实际加工单；仓库记录无 `sourceDemandId/sourceDemandNo`；不存在 `YHXQ/RSXQ/PRD-PRINT/DM-DYE`。
- [ ] 运行测试，确认当前代码因旧对象仍失败。
- [ ] 删除 `PrepRequirement*`、`listPrepRequirementDemands`、需求 artifact fallback、仓库需求字段/种子/映射以及印染需求产物特判；仅保留真实加工单投影。
- [ ] 运行相关专项与扩大零残留扫描；提交 `refactor(印染): 删除旧需求对象投影`。

### 任务 2：修正页面口径与失效测试入口

**文件：**
- 修改：`src/pages/production-order-progress-tracking.ts`
- 修改：`src/pages/process-factory/printing/dashboards.ts`
- 修改：`src/pages/process-factory/printing/statistics.ts`
- 修改：`src/pages/process-factory/printing/work-order-detail.ts`
- 修改：`tests/process-warehouse-handover-linkage.spec.ts`
- 修改：对应检查脚本及审查记录

- [ ] 先增加失败断言：生产单追踪不得显示印染需求节点；PFOS 不得显示“需求单印花数量”；特殊工艺测试须使用当前烫画/直喷 slug。
- [ ] 删除旧 Mock 节点和旧需求来源表达，改为真实印花/染色加工单口径。
- [ ] 将退休的 `sc-op-8192` 路由替换为 `aux-op-heat-transfer` / `aux-op-direct-print` 的真实工单。
- [ ] 跑页面专项、Playwright 和治理；提交 `fix(印染): 清理旧需求页面口径`。

### 任务 3：加固成衣动作与后道原子性

**文件：**
- 修改：`src/data/fcs/process-warehouse-linkage-service.ts`
- 修改：`src/data/fcs/factory-internal-warehouse.ts`
- 修改：`src/data/fcs/process-warehouse-domain.ts`
- 修改：`src/data/fcs/process-action-writeback-service.ts`
- 修改：`scripts/check-heat-transfer-and-print-dye-contract.ts`

- [ ] 先增加失败测试：全 SKU 为零的出库、收货、完工必须抛错且状态/库存不变；后道事实创建失败时交出和仓库写入必须恢复。
- [ ] 以至少一条正数量 SKU 为动作前置，保留每 SKU 上限和累计量校验。
- [ ] 将后道写入改为先准备、后提交；失败时回滚交出、待交出仓、后道入库和任务写入。
- [ ] 跑合同专项和真实领域链路；提交 `fix(烫画): 加固成衣仓储交出边界`。

### 任务 4：真实端到端浏览器验收与零残留门禁

**文件：**
- 修改：`tests/heat-transfer-and-print-dye-flow.spec.ts`
- 修改：`docs/prototype-review-records/2026-07-22-heat-transfer-and-print-dye-cleanup.md`
- 修改或新建：最小专项检查脚本

- [ ] 先写成衣烫画真实动作浏览器用例，覆盖出库、辅助收货、完工、交出、后道收货以及每一步数量/状态。
- [ ] 确认旧静态详情用例不能证明动作写回。
- [ ] 用真实 SKU、当前 operation slug 和实际加工单替换静态断言；保留直喷/烫画独立入口和补料三来源校验。
- [ ] 新增零残留检查，禁止旧印染需求对象名称、旧编号、旧仓库字段和旧投影 API；为生产需求/BOM 属性列出窄白名单。
- [ ] 跑 Playwright、印染/烫画专项、原型治理、列表治理、构建、CodeGraph；提交 `test(印染): 补齐真实链路与零残留门禁`。
