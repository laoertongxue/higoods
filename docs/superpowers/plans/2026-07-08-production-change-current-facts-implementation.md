# 生产单变更当前事实详情化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 `/fcs/production/changes/new` 第 1 步从粗略进度摘要改为可支撑变更判断的生产单当前事实视图。

**架构：** 在现有生产单变更 mock domain 中补一个当前事实读取入口，页面只负责渲染。第 1 步保持选择生产单 -> 查看事实，不新增快捷路径，不让业务人员在第 1 步选择处理方式。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `scripts/check-production-order-changes.ts`。

---

## 文件结构

- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`
  - 新增生产单当前事实类型、mock 数据和 `getProductionOrderChangeCurrentFacts(productionOrderId)`。
  - 数据覆盖：生产单需求数量、物料配料 / 领料、裁剪 / 铺布 / 裁片、印花 / 染色 / 特殊工艺、车缝 / 后道 / 交出、结算 / 成本、历史变更 / 锁定。
- 修改：`src/pages/production/changes-domain.ts`
  - 导入当前事实读取函数。
  - 替换 `renderProductionChangeCurrentFacts()` 内部粗略摘要渲染。
  - 保持第 1 步只读事实，不增加处理选择。
- 修改：`scripts/check-production-order-changes.ts`
  - 补新增页第 1 步断言：需求数量、行级物料数量、单据生成时间 / 状态、无风险标识。
- 修改：`docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md`
  - 更新审查记录，说明第 1 步补充当前事实明细，仍属于 FCS 管理端。

不新增文件、不新增依赖、不改路由、不改事件、不改生产单变更 4 步主流程。

## 任务 1：补当前事实 mock 数据入口

**文件：**
- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`
- 验证：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：先补失败断言**

在 `scripts/check-production-order-changes.ts` 的新增页第 1 步断言后补：

```typescript
assert.ok(newHtml.includes('生产单需求数量'), '新增页第 1 步必须展示生产单需求数量')
assert.ok(newHtml.includes('原需求数量'), '新增页第 1 步必须展示原需求数量')
assert.ok(newHtml.includes('当前需求数量'), '新增页第 1 步必须展示当前需求数量')
assert.ok(newHtml.includes('本次拟变更需求数量'), '新增页第 1 步必须展示拟变更需求数量')
assert.ok(newHtml.includes('应配'), '新增页第 1 步物料事实必须展示应配数量')
assert.ok(newHtml.includes('已配'), '新增页第 1 步物料事实必须展示已配数量')
assert.ok(newHtml.includes('已领'), '新增页第 1 步物料事实必须展示已领数量')
assert.ok(newHtml.includes('剩余可改'), '新增页第 1 步物料事实必须展示剩余可改数量')
assert.ok(newHtml.includes('生成时间'), '新增页第 1 步已生成单据必须展示生成时间')
assert.ok(!newHtml.includes('风险标识'), '新增页第 1 步不应展示未定义的风险标识')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:production-order-changes
```

预期：失败，至少提示缺少 `生产单需求数量` 或 `应配`。

- [ ] **步骤 3：新增最小数据结构和读取函数**

在 `src/data/fcs/production-tech-pack-change-domain.ts` 中新增：

```typescript
export interface ProductionOrderDemandQuantityFact {
  id: string
  scope: string
  originalDemandQty: number
  currentDemandQty: number
  proposedDemandQty: number
  generatedDocumentQty: number
  executedQty: number
  pendingQty: number
  note: string
}

export interface ProductionOrderMaterialFact {
  id: string
  material: string
  requiredQty: string
  preparedQty: string
  pickedQty: string
  changeableQty: string
  sourceDocument: string
  note: string
}

export interface ProductionOrderDocumentFact {
  id: string
  group: '裁剪/铺布/裁片' | '印花/染色/特殊工艺' | '车缝/后道/交出' | '结算/成本'
  documentNo: string
  generatedAt: string
  status: string
  plannedQty: string
  doneQty: string
  pendingQty: string
  note: string
}

export interface ProductionOrderHistoryFact {
  id: string
  changeOrderNo: string
  result: string
  status: string
  affectedScope: string
  lockStatus: string
  note: string
}

export interface ProductionOrderChangeCurrentFacts {
  productionOrderId: string
  demandQuantityFacts: ProductionOrderDemandQuantityFact[]
  materialFacts: ProductionOrderMaterialFact[]
  documentFacts: ProductionOrderDocumentFact[]
  historyFacts: ProductionOrderHistoryFact[]
}
```

同文件新增 `productionOrderChangeCurrentFacts`。至少覆盖 3 张生产单：

- `PO-202603-0004`：已有配料、领料、铺布，需求数量可减少。
- `PO-202603-0018`：已有印花 / 染色单，需求数量或色码结构可调整。
- `PO-202603-0013`：已有车缝交出和部分结算，减量只能追溯或补差。

新增读取函数：

```typescript
export function getProductionOrderChangeCurrentFacts(productionOrderId: string): ProductionOrderChangeCurrentFacts | null {
  const found = productionOrderChangeCurrentFacts.find((item) => item.productionOrderId === productionOrderId)
  return found ? clone(found) : null
}
```

- [ ] **步骤 4：运行检查仍失败**

运行：

```bash
npm run check:production-order-changes
```

预期：仍失败，因为页面还没渲染这些字段。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/production-tech-pack-change-domain.ts scripts/check-production-order-changes.ts
git commit -m "test: require production change current facts"
```

## 任务 2：替换新增页第 1 步当前事实渲染

**文件：**
- 修改：`src/pages/production/changes-domain.ts`
- 验证：`scripts/check-production-order-changes.ts`

- [ ] **步骤 1：导入当前事实读取函数**

在 `src/pages/production/changes-domain.ts` 现有 production-tech-pack-change-domain import 中加入：

```typescript
  getProductionOrderChangeCurrentFacts,
```

- [ ] **步骤 2：新增小渲染函数**

在 `renderProductionChangeFactList()` 后新增：

```typescript
function renderProductionChangeFactTable(headers: string[], rows: string[][], emptyText: string): string {
  if (rows.length === 0) {
    return `<div class="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`
  }
  return `
    <div class="overflow-x-auto rounded-md border">
      <table class="w-full min-w-[920px] text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground">
          <tr>${headers.map((header) => `<th class="px-3 py-2 text-left font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody class="divide-y">
          ${rows.map((row) => `
            <tr class="align-top">
              ${row.map((cell) => `<td class="px-3 py-2">${escapeHtml(cell)}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}
```

- [ ] **步骤 3：改写 `renderProductionChangeCurrentFacts()`**

保留基本信息和技术包关系，新增当前事实：

```typescript
  const facts = getProductionOrderChangeCurrentFacts(relation.productionOrderId)
```

把原 `生产进度` 和旧 `已生成单据` 卡片替换为：

```typescript
${renderProductionChangeFactCard(
  '生产单需求数量 / 色码需求数量',
  renderProductionChangeFactTable(
    ['色码范围', '原需求数量', '当前需求数量', '本次拟变更需求数量', '已生成单据数量', '已执行数量', '未执行数量', '数量差异说明'],
    (facts?.demandQuantityFacts ?? []).map((row) => [
      row.scope,
      `${row.originalDemandQty} 件`,
      `${row.currentDemandQty} 件`,
      `${row.proposedDemandQty} 件`,
      `${row.generatedDocumentQty} 件`,
      `${row.executedQty} 件`,
      `${row.pendingQty} 件`,
      row.note,
    ]),
    '暂无生产单需求数量差异',
  ),
)}
${renderProductionChangeFactCard(
  '物料配料 / 领料事实',
  renderProductionChangeFactTable(
    ['物料', '应配', '已配', '已领', '剩余可改', '单据来源', '事实说明'],
    (facts?.materialFacts ?? []).map((row) => [
      row.material,
      row.requiredQty,
      row.preparedQty,
      row.pickedQty,
      row.changeableQty,
      row.sourceDocument,
      row.note,
    ]),
    '暂无物料配料 / 领料事实',
  ),
)}
```

再按 `documentFacts.group` 渲染四个模块：

```typescript
const documentGroups = ['裁剪/铺布/裁片', '印花/染色/特殊工艺', '车缝/后道/交出', '结算/成本'] as const
```

每组表头：

```typescript
['单据号', '生成时间', '当前状态', '计划数量', '已执行', '未执行', '事实说明']
```

历史变更继续使用现有 `changeOrders`，但优先展示 `facts?.historyFacts`，字段为变更单号、变更结果、状态、影响范围、锁定状态、事实说明。

- [ ] **步骤 4：运行检查验证通过**

运行：

```bash
npm run check:production-order-changes
```

预期：`production order changes check passed`。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/production/changes-domain.ts
git commit -m "feat: show production change current facts"
```

## 任务 3：补治理审查记录

**文件：**
- 修改：`docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md`
- 验证：`npm run check:prototype-design-governance`

- [ ] **步骤 1：更新审查说明**

在 `主要任务` 或 `数量与状态` 自查说明中补充：

```markdown
新增页第 1 步展示生产单需求数量、色码需求数量、物料配料 / 领料、裁剪、印染、车缝交出、结算和历史锁定事实；数量带单位，系统直接展示已生成、已执行、未执行数量，避免业务人员靠百分比或手算判断。
```

- [ ] **步骤 2：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：通过。

- [ ] **步骤 3：Commit**

```bash
git add docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md
git commit -m "docs: review production change current facts"
```

## 任务 4：最终验证

**文件：**
- 检查：`src/data/fcs/production-tech-pack-change-domain.ts`
- 检查：`src/pages/production/changes-domain.ts`
- 检查：`scripts/check-production-order-changes.ts`
- 检查：`docs/prototype-review-records/2026-07-08-production-order-change-management-ia-refactor.md`

- [ ] **步骤 1：运行专项检查**

```bash
npm run check:production-order-changes
```

预期：`production order changes check passed`。

- [ ] **步骤 2：运行治理检查**

```bash
npm run check:prototype-design-governance
```

预期：通过。

- [ ] **步骤 3：运行构建**

```bash
npm run build
```

预期：Vite build 成功。

- [ ] **步骤 4：本地浏览器验证**

启动：

```bash
npm run dev -- --host 0.0.0.0 --port 5175
```

访问：

```text
http://<局域网 IP>:5175/fcs/production/changes/new
```

检查：

- 第 1 步选择 `PO-202603-0004` 后能看到生产单需求数量表。
- 物料行展示应配、已配、已领、剩余可改。
- 已生成单据展示生成时间、当前状态、计划数量、已执行、未执行。
- 页面不出现“风险标识”。
- 第 2、3、4 步仍可点击进入，主流程未变。

- [ ] **步骤 5：CodeGraph 同步**

```bash
codegraph sync
codegraph status
```

预期：索引无 pending sync。

## 自检

- 规格覆盖：覆盖了生产单需求数量、物料配料 / 领料、裁剪 / 铺布 / 裁片、印花 / 染色 / 特殊工艺、车缝 / 后道 / 交出、结算 / 成本、历史变更 / 补丁 / 锁定。
- 页面边界：第 1 步只展示事实，不选择处理方式；第 3 步继续负责影响范围和处理建议。
- 简化项：不接真实后端，不引入新依赖，不新增快捷路径，不重写 4 步主流程。
