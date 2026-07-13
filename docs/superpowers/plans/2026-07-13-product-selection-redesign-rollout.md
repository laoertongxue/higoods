# 商品选品测款项目重构总实施计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 分三阶段删除商品项目工作项和模板体系，重构商品选品测款项目，并完成样衣一物一码及生产准备与工程任务串联。

**架构：** 先建立不依赖阶段、节点和模板的扁平商品项目及商品档案关系；再让样衣管理成为样衣实物的唯一事实来源；最后让工程开发任务成为生产准备工程类产出的唯一事实来源。每个阶段独立构建、验证和提交。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node/tsx 检查脚本、CodeGraph。

---

## 子计划和执行顺序

1. [商品项目核心重构](./2026-07-13-product-selection-project-core.md)
2. [样衣一物一码](./2026-07-13-sample-unique-code-lifecycle.md)
3. [生产准备与工程任务串联](./2026-07-13-production-preparation-engineering-linkage.md)

必须按顺序执行。第二、三阶段依赖第一阶段提供的扁平 `projectId + productArchiveId` 关系。

## 总体文件结构

### 新建

- `src/data/pcs-product-selection-project-domain.ts`：商品项目状态和结束条件。
- `src/data/pcs-product-selection-project-fixtures.ts`：不含阶段和工作项的演示数据。
- `src/data/pcs-sample-asset-domain.ts`：样衣唯一码、激活和闭环规则。
- `src/data/fcs/production-preparation-engineering-linkage.ts`：准备项与工程任务的映射和状态投影。
- 三个专项检查脚本和三份原型审查记录。

### 重点重写

- `src/data/pcs-project-types.ts`
- `src/data/pcs-project-repository.ts`
- `src/pages/pcs-projects.ts`
- `src/data/pcs-sample-management.ts`
- `src/pages/pcs-sample-management.ts`
- `src/data/fcs/production-preparation-timing.ts`
- `src/data/fcs/production-preparation-timing-runtime.ts`
- `src/pages/production/preparation-timing.ts`
- `src/data/pcs-task-project-relation-writeback.ts`

### 删除

- `src/pages/pcs-work-items.ts`
- `src/pages/pcs-templates.ts`
- `src/data/pcs-work-items.ts`
- `src/data/pcs-work-item-configs/`
- `src/data/pcs-templates.ts`
- `src/data/pcs-project-domain-contract.ts`
- `src/data/pcs-project-node-factory.ts`
- `src/data/pcs-project-instance-model.ts`
- `src/data/pcs-project-inline-node-record-*`
- `src/data/pcs-project-flow-service.ts`
- `src/data/pcs-project-decision-flow-service.ts`
- 只验证模板、工作项、阶段、节点和 inline record 的脚本与测试。

删除前必须使用 CodeGraph impact 和 `rg` 确认引用已经迁移。不得通过空导出、隐藏入口或兼容代理保留旧运行时。

## 跨阶段验收

- [ ] **步骤 1：运行专项检查**

```bash
npm run check:pcs-product-selection-project
npm run check:pcs-sample-unique-code
npm run check:production-preparation-engineering-linkage
```

预期：全部输出 `passed`。

- [ ] **步骤 2：检查旧体系残留**

```bash
rg -n "pcs/work-items|pcs/templates|projectNodeId|workItemTypeCode|工作项库|项目模板阶段" src/pages/pcs-projects.ts src/data/pcs-project* src/router/routes-pcs.ts src/main-handlers/pcs-handlers.ts src/data/app-shell-config.ts
```

预期：无匹配。

- [ ] **步骤 3：运行全局验证**

```bash
npm run check:menu-routes
npm run check:prototype-design-governance -- --all
npm run build
```

预期：全部通过。

- [ ] **步骤 4：浏览器验收**

验证 `/pcs/projects`、`/pcs/projects/create`、`/pcs/samples/inventory`、`/pcs/samples/return`、`/pcs/patterns`、`/pcs/samples/first-sample`、`/fcs/production/preparation-timing`。

预期：项目创建同步产生商品测款档案；暂保留只等待复判；同 SKU 多件样衣显示不同唯一码；退货逐件结案；生产准备工程项进入正式工程任务且不重复上传结果。

- [ ] **步骤 5：最终提交**

```bash
git add src tests scripts package.json docs/prototype-review-records
git commit -m "feat: complete product selection project redesign"
```

