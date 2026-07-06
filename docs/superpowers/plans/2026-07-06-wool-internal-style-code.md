# 毛织纸样内部货号实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在毛织纸样包录入内部货号，并让毛织加工单支持内部货号搜索、列表展示和筛选联动统计。

**架构：** 内部货号按 SPU / 款式级处理，毛织纸样包只是录入入口；实现上用现有技术包字符串模板、mock 数据和技术包快照传递字段。毛织加工单列表不引入新状态层，只在现有过滤函数和渲染函数中做局部扩展。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `scripts/check-*.ts` 断言脚本。

---

## 文件结构

- 修改：`src/data/fcs/tech-packs.ts`
  - 为 `TechPackPatternFile` 和 `TechPack` 增加内部货号字段。
- 修改：`src/pages/tech-pack/context.ts`
  - 为 `PatternItem` / `state.newPattern` 增加内部货号，demo 毛织纸样包补 `2585`。
  - 保存技术包时把最后一次非空毛织纸样内部货号同步到 SPU 级字段。
- 修改：`src/pages/tech-pack/pattern-domain.ts`
  - 毛织纸样包弹窗展示 `内部货号` 输入框；布料纸样隐藏。
- 修改：`src/pages/tech-pack/events.ts`
  - 读取 `new-pattern-internal-style-code` 字段，保存到纸样包。
- 修改：`src/data/fcs/production-tech-pack-snapshot-builder.ts`
  - 技术包快照保留纸样包内部货号，并计算 SPU 级最后非空内部货号。
- 修改：`src/data/fcs/wool-task-domain.ts`
  - `WoolWorkOrder` 增加 `internalStyleCode?: string`。
  - 生成毛织加工单时从生产单技术包快照读取 SPU 级内部货号。
  - `getWoolWorkOrderSummary` 支持传入订单列表，供筛选结果统计复用。
- 修改：`src/pages/process-factory/wool/work-orders.ts`
  - 款式筛选改为 `款式 / 内部货号`。
  - 筛选匹配内部货号。
  - 款式单元格第二行显示 `内部货号：2585 / 生产单号`。
  - 统计卡片改为筛选条件下方的紧凑统计条。
- 创建：`scripts/check-wool-internal-style-code.ts`
  - 断言字段展示、搜索、统计联动和快照传递。
- 修改：`package.json`
  - 增加 `check:wool-internal-style-code`。
- 创建：`docs/prototype-review-records/2026-07-06-wool-internal-style-code.md`
  - 按项目治理要求补原型审查记录。

## 任务 1：类型与技术包状态字段

**文件：**
- 修改：`src/data/fcs/tech-packs.ts`
- 修改：`src/pages/tech-pack/context.ts`
- 测试：`scripts/check-wool-internal-style-code.ts`
- 修改：`package.json`

- [ ] **步骤 1：创建失败的专项检查脚本**

创建 `scripts/check-wool-internal-style-code.ts`：

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(path, 'utf8')
}

const techPackTypes = read('src/data/fcs/tech-packs.ts')
assert.ok(techPackTypes.includes('internalStyleCode?: string'), '技术包类型必须声明内部货号字段')

const techPackContext = read('src/pages/tech-pack/context.ts')
assert.ok(techPackContext.includes('internalStyleCode:'), '技术包状态必须保存内部货号')
assert.ok(techPackContext.includes(\"internalStyleCode: '2585'\"), '毛织纸样 demo 数据必须包含内部货号 2585')

console.log('毛织内部货号专项检查通过')
```

- [ ] **步骤 2：接入 npm 脚本并验证失败**

在 `package.json` 的 `scripts` 中加入：

```json
"check:wool-internal-style-code": "tsx scripts/check-wool-internal-style-code.ts"
```

运行：`npm run check:wool-internal-style-code`

预期：FAIL，报错包含 `技术包类型必须声明内部货号字段`。

- [ ] **步骤 3：给技术包类型补最小字段**

在 `src/data/fcs/tech-packs.ts` 中给 `TechPackPatternFile` 增加字段，放在 `patternMaterialTypeLabel?: string` 后：

```typescript
  internalStyleCode?: string
```

在 `TechPack` 中给 SPU 级快照增加字段，放在 `spuName: string` 后：

```typescript
  internalStyleCode?: string
```

- [ ] **步骤 4：给技术包页面状态补字段**

在 `src/pages/tech-pack/context.ts` 的 `PatternItem` 类型中增加：

```typescript
  internalStyleCode: string
```

在 `NewPatternState` 类型中增加：

```typescript
  internalStyleCode: string
```

在 `createEmptyPatternState()` 返回值中加入：

```typescript
    internalStyleCode: '',
```

在 `mapTechPackToPatternItems()` 返回的每个 item 中加入：

```typescript
      internalStyleCode: item.internalStyleCode || techPack.internalStyleCode || '',
```

在 `createPatternPoolDemoPackage()` 返回值中加入：

```typescript
    internalStyleCode: isWool ? '2585' : '',
```

在 `createMaterialPatternDemoAssociation()` 返回值中继承纸样包字段：

```typescript
    internalStyleCode: patternPackage.internalStyleCode || '',
```

- [ ] **步骤 5：运行专项检查确认通过当前任务**

运行：`npm run check:wool-internal-style-code`

预期：PASS，输出 `毛织内部货号专项检查通过`。

- [ ] **步骤 6：Commit**

```bash
git add package.json scripts/check-wool-internal-style-code.ts src/data/fcs/tech-packs.ts src/pages/tech-pack/context.ts
git commit -m "feat: add wool internal style code fields"
```

## 任务 2：技术包表单展示与保存

**文件：**
- 修改：`src/pages/tech-pack/pattern-domain.ts`
- 修改：`src/pages/tech-pack/events.ts`
- 修改：`src/pages/tech-pack/context.ts`
- 测试：`scripts/check-wool-internal-style-code.ts`

- [ ] **步骤 1：扩展失败检查**

在 `scripts/check-wool-internal-style-code.ts` 中追加：

```typescript
const patternDomain = read('src/pages/tech-pack/pattern-domain.ts')
assert.ok(patternDomain.includes('内部货号'), '毛织纸样包弹窗必须展示内部货号字段')
assert.ok(patternDomain.includes('new-pattern-internal-style-code'), '内部货号输入框必须有 data-tech-field')
assert.ok(patternDomain.includes('例如：2585'), '内部货号输入框必须给出示例占位')

const patternEvents = read('src/pages/tech-pack/events.ts')
assert.ok(patternEvents.includes(\"field === 'new-pattern-internal-style-code'\"), '技术包事件必须读取内部货号字段')
assert.ok(patternEvents.includes('state.newPattern.internalStyleCode = value.trim()'), '内部货号保存前必须 trim')
```

运行：`npm run check:wool-internal-style-code`

预期：FAIL，报错包含 `毛织纸样包弹窗必须展示内部货号字段`。

- [ ] **步骤 2：毛织纸样包弹窗加入输入框**

在 `src/pages/tech-pack/pattern-domain.ts` 的 `patternFormPurpose === 'PACKAGE'` 表单中，`是否毛织` 与 `纸样分类` 后加入仅毛织展示的输入框：

```typescript
                  ${
                    state.newPattern.patternMaterialType === 'WOOL'
                      ? `<label class="space-y-1">
                          <span class="text-sm">内部货号</span>
                          <input class="w-full rounded-md border px-3 py-2 text-sm" data-tech-field="new-pattern-internal-style-code" value="${escapeHtml(state.newPattern.internalStyleCode || '')}" placeholder="例如：2585" />
                        </label>`
                      : ''
                  }
```

- [ ] **步骤 3：读取表单字段**

在 `src/pages/tech-pack/events.ts` 的 `handleTechPackFieldChange()` 中，放在 `new-pattern-file` 或 `new-pattern-remark` 分支附近：

```typescript
  if (field === 'new-pattern-internal-style-code') {
    state.newPattern.internalStyleCode = value.trim()
    return true
  }
```

- [ ] **步骤 4：保存纸样包字段**

在 `buildPatternItemFromForm()` 返回对象中加入：

```typescript
    internalStyleCode:
      normalizedPatternMaterialType === 'WOOL'
        ? state.newPattern.internalStyleCode.trim()
        : '',
```

在 `src/pages/tech-pack/context.ts` 的 `buildPatternFormStateFromItem()` 返回对象中加入回填：

```typescript
    internalStyleCode: item.internalStyleCode || state.techPack.internalStyleCode || '',
```

在 `src/pages/tech-pack/events.ts` 的 `applyPatternPackageToAssociation()` 中不需要单独赋值；它通过 `buildPatternFormStateFromItem(selectedPackage)` 继承该字段。

- [ ] **步骤 5：运行检查**

运行：`npm run check:wool-internal-style-code`

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add scripts/check-wool-internal-style-code.ts src/pages/tech-pack/pattern-domain.ts src/pages/tech-pack/events.ts src/pages/tech-pack/context.ts
git commit -m "feat: capture wool internal style code in tech pack"
```

## 任务 3：快照传递与最后非空值

**文件：**
- 修改：`src/pages/tech-pack/context.ts`
- 修改：`src/data/fcs/production-tech-pack-snapshot-builder.ts`
- 测试：`scripts/check-wool-internal-style-code.ts`

- [ ] **步骤 1：扩展失败检查**

在 `scripts/check-wool-internal-style-code.ts` 中追加：

```typescript
assert.ok(
  techPackContext.includes('resolveLatestWoolInternalStyleCode'),
  '保存技术包时必须计算最后一次非空毛织内部货号',
)

const snapshotBuilder = read('src/data/fcs/production-tech-pack-snapshot-builder.ts')
assert.ok(snapshotBuilder.includes('resolveLatestWoolInternalStyleCode'), '快照构建器必须计算内部货号')
assert.ok(snapshotBuilder.includes('internalStyleCode:'), '快照构建器必须输出内部货号')
```

运行：`npm run check:wool-internal-style-code`

预期：FAIL，报错包含 `保存技术包时必须计算最后一次非空毛织内部货号`。

- [ ] **步骤 2：在技术包页面保存时计算最后非空值**

在 `src/pages/tech-pack/context.ts` 中增加本地 helper，放在 `buildTechPackFromState()` 前：

```typescript
function resolveLatestWoolInternalStyleCode(items: Array<{ patternMaterialType?: string; internalStyleCode?: string }>): string {
  return [...items]
    .reverse()
    .find((item) => item.patternMaterialType === 'WOOL' && String(item.internalStyleCode || '').trim())
    ?.internalStyleCode?.trim() || ''
}
```

在 `buildTechPackFromState()` 的 `next: TechPack` 中加入：

```typescript
    internalStyleCode: resolveLatestWoolInternalStyleCode(state.patternItems) || state.techPack.internalStyleCode || '',
```

在 `patternFiles: state.patternItems.map(...)` 返回对象中加入：

```typescript
        internalStyleCode: item.patternMaterialType === 'WOOL' ? item.internalStyleCode.trim() || undefined : undefined,
```

- [ ] **步骤 3：在快照构建器保留字段**

在 `src/data/fcs/production-tech-pack-snapshot-builder.ts` 中增加 helper：

```typescript
function resolveLatestWoolInternalStyleCode(items: Array<{ patternMaterialType?: string; internalStyleCode?: string }>): string {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index]
    const value = normalizeText(item.internalStyleCode)
    if (item.patternMaterialType === 'WOOL' && value) return value
  }
  return ''
}
```

在 `normalizePatternFiles()` 返回对象中加入：

```typescript
      internalStyleCode: patternMaterialType === 'WOOL'
        ? normalizeText((item as { internalStyleCode?: string }).internalStyleCode) || undefined
        : undefined,
```

在构建最终 snapshot 的对象中加入：

```typescript
    internalStyleCode: resolveLatestWoolInternalStyleCode(patternFiles) || normalizeText(content.internalStyleCode) || undefined,
```

在当前已有的 snapshot 返回对象中加入该字段；不要新建后端模型。

- [ ] **步骤 4：运行检查**

运行：`npm run check:wool-internal-style-code`

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add scripts/check-wool-internal-style-code.ts src/pages/tech-pack/context.ts src/data/fcs/production-tech-pack-snapshot-builder.ts
git commit -m "feat: carry wool internal style code into snapshots"
```

## 任务 4：毛织加工单搜索、展示与紧凑统计

**文件：**
- 修改：`src/data/fcs/wool-task-domain.ts`
- 修改：`src/pages/process-factory/wool/work-orders.ts`
- 测试：`scripts/check-wool-internal-style-code.ts`

- [ ] **步骤 1：扩展失败检查**

在 `scripts/check-wool-internal-style-code.ts` 中追加：

```typescript
const woolDomain = read('src/data/fcs/wool-task-domain.ts')
assert.ok(woolDomain.includes('internalStyleCode?: string'), '毛织加工单类型必须包含内部货号')
assert.ok(woolDomain.includes('getWoolWorkOrderSummary(orders = listWoolWorkOrders())'), '毛织统计必须支持传入筛选结果')

const woolPage = read('src/pages/process-factory/wool/work-orders.ts')
assert.ok(woolPage.includes('款式 / 内部货号'), '毛织加工单筛选标签必须包含内部货号')
assert.ok(woolPage.includes('order.internalStyleCode'), '毛织加工单搜索和展示必须使用内部货号')
assert.ok(woolPage.includes('renderCompactSummaryTags(filteredOrders)'), '毛织加工单必须按筛选结果渲染紧凑统计')
```

运行：`npm run check:wool-internal-style-code`

预期：FAIL，报错包含 `毛织加工单类型必须包含内部货号`。

- [ ] **步骤 2：毛织加工单类型和生成逻辑**

在 `src/data/fcs/wool-task-domain.ts` 的 `WoolWorkOrder` 中增加：

```typescript
  internalStyleCode?: string
```

在 `buildGeneratedWoolWorkOrder()` 中读取 snapshot 值：

```typescript
  const snapshot = getProductionOrderTechPackSnapshot(task.productionOrderId)
```

在返回对象中加入：

```typescript
    internalStyleCode: snapshot?.internalStyleCode,
```

在 `buildManualSeedWoolWorkOrders()` 的手动 mock 里，至少给一组毛织订单补：

```typescript
      internalStyleCode: '2585',
```

- [ ] **步骤 3：统计函数支持筛选结果**

把 `getWoolWorkOrderSummary()` 签名改成：

```typescript
export function getWoolWorkOrderSummary(orders = listWoolWorkOrders()): WoolWorkOrderSummary {
  return {
    total: orders.length,
    // 其余统计保持原逻辑
  }
}
```

不要改变已有调用；无参仍返回全量统计。

- [ ] **步骤 4：页面筛选匹配内部货号**

在 `src/pages/process-factory/wool/work-orders.ts` 的 `renderFilterBar()` 中，将款式标签和 placeholder 改为：

```typescript
          <span class="text-xs text-muted-foreground">款式 / 内部货号</span>
          <input class="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.style)}" placeholder="款号 / 款名 / 内部货号" data-wool-filter-field="style" />
```

在 `listFilteredWoolWorkOrders()` 中将款式匹配改为：

```typescript
    if (!matchesKeyword(`${order.styleNo} ${order.styleName} ${order.internalStyleCode || ''}`, filters.style.trim())) return false
```

- [ ] **步骤 5：款式单元格展示内部货号**

在订单行 map 内增加：

```typescript
      const styleMeta = order.internalStyleCode
        ? `内部货号：${order.internalStyleCode} / ${order.productionOrderNo}`
        : order.productionOrderNo
```

将款式单元格第二行改为：

```typescript
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${order.styleNo} / ${styleMeta}`)}</div>
```

- [ ] **步骤 6：紧凑统计放在筛选下方**

用下面函数替换原大卡片统计调用，不需要删除 `renderMetricCard` import 以外的其他功能：

```typescript
function renderCompactSummaryTags(orders: WoolWorkOrder[]): string {
  const summary = getWoolWorkOrderSummary(orders)
  const tags = [
    ['加工单', `${summary.total}`],
    ['未接单', `${summary.waitAcceptCount}`],
    ['待领料', `${summary.waitPickupCount}`],
    ['领料中', `${summary.pickupInProgressCount}`],
    ['待排机', `${summary.waitMachineScheduleCount}`],
    ['横机中', `${summary.flatWoolCount}`],
    ['待打印菲票', `${summary.waitFeiTicketCount}`],
    ['计划数量', `${formatNumber(summary.plannedQty)} 件/片`],
    ['完成数量', `${formatNumber(summary.completedQty)} 件/片`],
  ]

  return `
    <section class="rounded-lg border bg-card px-3 py-3">
      <div class="flex flex-wrap gap-2">
        ${tags.map(([label, value]) => `
          <span class="inline-flex items-center rounded border bg-muted/40 px-3 py-1 text-xs text-slate-700">
            <span class="font-medium">${escapeHtml(label)}：</span>
            <span class="ml-1 font-semibold">${escapeHtml(value)}</span>
          </span>
        `).join('')}
      </div>
    </section>
  `
}
```

改 `renderOrdersTable()` 入参，避免重复过滤：

```typescript
function renderOrdersTable(filteredOrders: WoolWorkOrder[]): string {
```

在 `renderCraftWoolWorkOrdersPage()` 中：

```typescript
  const filteredOrders = listFilteredWoolWorkOrders(filters)
  return `
    <div class="space-y-4 p-4">
      ${renderPageHeader('毛织加工单', '周哥毛织厂自有任务管理，区分整件毛织与部位毛织。')}
      ${renderFilterBar(filters)}
      ${renderCompactSummaryTags(filteredOrders)}
      ${renderOrdersTable(filteredOrders)}
    </div>
  `
```

- [ ] **步骤 7：运行专项检查**

运行：`npm run check:wool-internal-style-code`

预期：PASS。

- [ ] **步骤 8：Commit**

```bash
git add scripts/check-wool-internal-style-code.ts src/data/fcs/wool-task-domain.ts src/pages/process-factory/wool/work-orders.ts
git commit -m "feat: search wool orders by internal style code"
```

## 任务 5：治理记录与验证收口

**文件：**
- 创建：`docs/prototype-review-records/2026-07-06-wool-internal-style-code.md`
- 修改：`scripts/check-wool-internal-style-code.ts`
- 修改：`package.json`

- [ ] **步骤 1：创建原型审查记录**

创建 `docs/prototype-review-records/2026-07-06-wool-internal-style-code.md`：

```markdown
# 毛织纸样内部货号与毛织加工单搜索原型审查记录

| 项目 | 内容 |
| --- | --- |
| 系统 | PCS / PFOS |
| 页面名称 | 技术包纸样包、毛织加工单 |
| 页面路径 | 技术包纸样包弹窗；`/fcs/craft/wool/work-orders` |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 跟单、版师、毛织厂管理人员 |
| 主要任务 | 录入毛织内部货号，并用内部货号搜索毛织加工单 |
| 上游来源 | 技术包毛织纸样包 |
| 下游去向 | 毛织加工单、毛织仓管与菲票相关页面 |
| 是否涉及扫码 | 否 |
| 是否涉及数量 | 是 |
| 是否涉及交接或责任转移 | 否 |
| 是否涉及异常或差异 | 否 |

## 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 技术包录入服务跟单/版师；毛织加工单服务管理查看，不下放到员工 PDA。 |
| 任务清晰度 | 通过 | 内部货号只在毛织纸样包出现，毛织加工单可直接搜索。 |
| 信息架构与导航 | 通过 | 不新增菜单，不改变路由。 |
| 页面模式 | 通过 | 列表页仍为管理端表格，统计缩小后放到筛选下方。 |
| 信息负荷 | 通过 | 不新增独立统计大卡，不展示空内部货号。 |
| 文案 | 通过 | 页面展示中文业务字段 `内部货号`。 |
| 数量与状态 | 通过 | 统计按筛选结果计算，计划和完成数量保留单位。 |
| 组件交互 | 通过 | 复用现有输入框、筛选按钮和字符串模板渲染。 |
| 协作关系 | 通过 | 技术包字段传递到毛织加工单，便于毛织厂按纸样单号查单。 |
| 异常与追溯 | 通过 | 原型按最后一次非空填写值展示，不做历史冲突面板。 |

## 例外

- 不做跨 SPU 唯一性校验。
- 不做内部货号历史版本追溯。
```

- [ ] **步骤 2：检查专项脚本覆盖审查记录**

在 `scripts/check-wool-internal-style-code.ts` 追加：

```typescript
const reviewRecord = read('docs/prototype-review-records/2026-07-06-wool-internal-style-code.md')
assert.ok(reviewRecord.includes('内部货号'), '原型审查记录必须覆盖内部货号')
assert.ok(reviewRecord.includes('不做跨 SPU 唯一性校验'), '原型审查记录必须说明例外')
```

- [ ] **步骤 3：运行全量相关检查**

运行：

```bash
npm run check:wool-internal-style-code
npm run check:fcs-tech-pack-pattern-parser
npm run check:wool-warehouse-unified-model
npm run check:prototype-design-governance
npm run build
codegraph sync && codegraph status
```

预期：

- 前四个 check 均 PASS。
- `npm run build` PASS。
- CodeGraph 显示 index up to date。

- [ ] **步骤 4：浏览器验证**

启动本地服务：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

打开：

```text
http://127.0.0.1:5173/fcs/craft/wool/work-orders?style=2585
```

人工确认：

- 搜索结果不为空。
- 统计条位于筛选条件下方。
- 统计条显示的 `加工单` 等于当前表格筛选结果数量。
- 款式单元格出现 `内部货号：2585 / PO-...`。

- [ ] **步骤 5：Commit**

```bash
git add package.json scripts/check-wool-internal-style-code.ts docs/prototype-review-records/2026-07-06-wool-internal-style-code.md
git commit -m "test: verify wool internal style code flow"
```

## 自检清单

- 规格目标 1：任务 2 覆盖毛织纸样包内部货号输入。
- 规格目标 2、3：任务 3 覆盖 SPU 级最后非空值。
- 规格目标 4：任务 4 覆盖搜索与款式单元格展示。
- 规格目标 5：任务 4 覆盖紧凑统计条，任务 5 覆盖浏览器验证。
- 治理要求：任务 5 创建原型审查记录并运行 `npm run check:prototype-design-governance`。
- CodeGraph 要求：执行前已同步；任务 5 收口时再次同步。
