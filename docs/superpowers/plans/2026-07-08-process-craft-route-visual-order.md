# 工序工艺字典完整顺序可视化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在工序工艺字典页增加只读入口，用大弹窗可视化展示完整基础工序工艺顺序。

**架构：** 复用现有 `src/pages/production-craft-dict.ts` 的字符串模板和 `data-craft-dict-action` 事件模式。路线图直接从现有字典数据和基础路线顺序派生，不新增数据源、不新增路由。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、现有 Node 检查脚本。

---

## 文件结构

- 修改：`scripts/check-production-craft-dict-page.ts`
  - 增加只读路线图入口、弹窗、完整数量、事件可达、关闭行为的验收断言。
- 修改：`src/pages/production-craft-dict.ts`
  - 增加 `查看完整工序顺序` 按钮。
  - 增加只读大弹窗渲染函数。
  - 增加打开 / 关闭弹窗事件。
- 创建：`docs/prototype-review-records/2026-07-08-process-craft-route-visual-order.md`
  - 记录本次原型设计自查。

## 任务 1：补充失败验收

**文件：**
- 修改：`scripts/check-production-craft-dict-page.ts`

- [ ] **步骤 1：编写失败检查**

在文件顶部现有 import 后增加页面函数 import：

```ts
import {
  handleProductionCraftDictEvent,
  isProductionCraftDictDialogOpen,
  renderProductionCraftDictPage,
} from '../src/pages/production-craft-dict.ts'
```

删除文件中对 `renderProductionCraftDictPage` 的重复局部获取方式（如果实现时已存在），保留一个 import 来源。

在 `const pageHtml = renderProductionCraftDictPage()` 后追加：

```ts
includesAll(
  craftDictPageSource,
  [
    'showRouteOrder',
    'renderProcessRouteOrderDialog',
    'data-craft-dict-action="open-route-order"',
    'data-craft-dict-action="close-route-order"',
    'data-testid="craft-route-order-dialog"',
    'data-testid="craft-route-order-card"',
  ],
  '工序工艺字典缺少完整顺序可视化入口或弹窗结构',
)

assert(pageHtml.includes('查看完整工序顺序'), '页面缺少查看完整工序顺序入口')
assert(!pageHtml.includes('data-testid="craft-route-order-dialog"'), '默认页面不应直接展开完整顺序弹窗')

const openHandled = handleProductionCraftDictEvent({
  closest(selector: string) {
    if (selector === '[data-craft-dict-field]') return null
    if (selector === '[data-craft-dict-action]') {
      return {
        dataset: {
          craftDictAction: 'open-route-order',
        },
      }
    }
    return null
  },
} as unknown as HTMLElement)
assert(openHandled === true, '查看完整顺序入口点击事件必须可达')
assert(isProductionCraftDictDialogOpen(), '打开完整顺序弹窗后应标记存在弹窗')

const routeDialogHtml = renderProductionCraftDictPage()
assert(routeDialogHtml.includes('完整工序工艺顺序'), '完整顺序弹窗缺少标题')
assert(routeDialogHtml.includes('基础路线顺序仅作为技术包路线默认参考'), '完整顺序弹窗缺少口径说明')
assert(routeDialogHtml.includes('未配置顺序'), '完整顺序弹窗必须有未配置顺序区域')
const routeDialogStart = routeDialogHtml.indexOf('data-testid="craft-route-order-dialog"')
assert(routeDialogStart >= 0, '完整顺序弹窗 DOM 不存在')
const routeDialogEnd = routeDialogHtml.indexOf('</section>', routeDialogStart)
const routeDialogOnlyHtml = routeDialogHtml.slice(routeDialogStart, routeDialogEnd >= 0 ? routeDialogEnd : undefined)
assert(!routeDialogOnlyHtml.includes('CRAFT_'), '完整顺序弹窗不应展示工艺编码')

const routeCardCount = routeDialogOnlyHtml.match(/data-testid="craft-route-order-card"/g)?.length ?? 0
assert(routeCardCount === activeRows.length, `完整顺序弹窗应展示全部 ${activeRows.length} 条可用工序工艺`)

const closeHandled = handleProductionCraftDictEvent({
  closest(selector: string) {
    if (selector === '[data-craft-dict-field]') return null
    if (selector === '[data-craft-dict-action]') {
      return {
        dataset: {
          craftDictAction: 'close-route-order',
        },
      }
    }
    return null
  },
} as unknown as HTMLElement)
assert(closeHandled === true, '关闭完整顺序弹窗事件必须可达')
assert(!isProductionCraftDictDialogOpen(), '关闭完整顺序弹窗后不应标记存在弹窗')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:production-craft-dict-page
```

预期：FAIL，报错包含 `工序工艺字典缺少完整顺序可视化入口或弹窗结构`。

- [ ] **步骤 3：Commit**

```bash
git add scripts/check-production-craft-dict-page.ts
git commit -m "test: guard process craft route order dialog"
```

## 任务 2：实现只读可视化弹窗

**文件：**
- 修改：`src/pages/production-craft-dict.ts`

- [ ] **步骤 1：扩展页面状态**

在 `CraftDictState` 中增加：

```ts
  showRouteOrder: boolean
```

在 `state` 中增加：

```ts
  showRouteOrder: false,
```

- [ ] **步骤 2：增加分组和弹窗渲染函数**

在 `renderDictionaryRebuildSummary()` 之后、`renderCraftDetailSheet()` 之前增加：

```ts
function getRouteOrderGroups(): Array<{ order: number; rows: ProcessCraftDictRow[] }> {
  const groups = new Map<number, ProcessCraftDictRow[]>()
  for (const row of listProcessCraftDictRows()) {
    const order = getDefaultProcessRouteOrder(row.processCode)
    const current = groups.get(order) ?? []
    current.push(row)
    groups.set(order, current)
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left - right)
    .map(([order, rows]) => ({
      order,
      rows: rows
        .slice()
        .sort((left, right) =>
          left.stageName.localeCompare(right.stageName, 'zh-CN')
          || left.processName.localeCompare(right.processName, 'zh-CN')
          || left.craftName.localeCompare(right.craftName, 'zh-CN'),
        ),
    }))
}

function renderRouteOrderCard(row: ProcessCraftDictRow): string {
  return `
    <div class="rounded-md border bg-background p-3 shadow-sm" data-testid="craft-route-order-card">
      <div class="text-sm font-semibold text-slate-900">${escapeHtml(row.craftName)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.processName)}</div>
      <div class="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span class="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">${escapeHtml(row.targetObjectName)}</span>
        <span class="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">${escapeHtml(row.stageName)}</span>
        <span class="rounded border border-slate-200 bg-slate-50 px-2 py-0.5">出任务：${escapeHtml(row.generatesExternalTaskLabel)}</span>
      </div>
    </div>
  `
}

function renderProcessRouteOrderDialog(): string {
  const groups = getRouteOrderGroups()
  const configuredGroups = groups.filter((group) => group.order !== Number.MAX_SAFE_INTEGER)
  const unconfiguredRows = groups.find((group) => group.order === Number.MAX_SAFE_INTEGER)?.rows ?? []

  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-craft-dict-action="close-route-order"></div>
    <section class="fixed left-1/2 top-1/2 z-[121] flex max-h-[86vh] w-[min(1120px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-background shadow-xl" data-testid="craft-route-order-dialog">
      <header class="flex items-start justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 class="text-lg font-semibold">完整工序工艺顺序</h2>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">基础路线顺序仅作为技术包路线默认参考，最终以款式级技术包确认路线为准。</p>
        </div>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-craft-dict-action="close-route-order">关闭</button>
      </header>

      <div class="min-h-0 flex-1 overflow-auto p-5">
        <div class="flex min-w-max gap-3">
          ${configuredGroups
            .map(
              (group) => `
                <section class="w-48 shrink-0 rounded-md border bg-muted/20 p-3">
                  <div class="mb-3 text-sm font-semibold text-slate-800">第 ${group.order} 步</div>
                  <div class="space-y-2">
                    ${group.rows.map(renderRouteOrderCard).join('')}
                  </div>
                </section>
              `,
            )
            .join('')}
          <section class="w-56 shrink-0 rounded-md border border-dashed bg-slate-50 p-3">
            <div class="mb-3 text-sm font-semibold text-slate-800">未配置顺序</div>
            <div class="space-y-2">
              ${
                unconfiguredRows.length > 0
                  ? unconfiguredRows.map(renderRouteOrderCard).join('')
                  : '<div class="rounded-md border bg-background px-3 py-4 text-xs text-muted-foreground">当前没有未配置顺序的工序工艺</div>'
              }
            </div>
          </section>
        </div>
      </div>
    </section>
  `
}
```

- [ ] **步骤 3：增加页面入口**

把 `renderProductionCraftDictPage()` 里的 header 替换为：

```ts
      <header class="flex flex-wrap items-center justify-between gap-3" data-testid="craft-dict-page-header">
        <h1 class="text-xl font-semibold">工序工艺字典</h1>
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-craft-dict-action="open-route-order">
          查看完整工序顺序
        </button>
      </header>
```

在页面模板底部 `${selected ? renderCraftDetailSheet(selected) : ''}` 后增加：

```ts
      ${state.showRouteOrder ? renderProcessRouteOrderDialog() : ''}
```

- [ ] **步骤 4：增加事件处理**

在 `handleProductionCraftDictEvent()` 的 action 分支中，放在分页动作之前：

```ts
  if (action === 'open-route-order') {
    state.showRouteOrder = true
    return true
  }

  if (action === 'close-route-order') {
    state.showRouteOrder = false
    return true
  }
```

把 `isProductionCraftDictDialogOpen()` 改为：

```ts
export function isProductionCraftDictDialogOpen(): boolean {
  return Boolean(state.viewCraftCode || state.showRouteOrder)
}
```

把 `closeProductionCraftDictDialog()` 改为：

```ts
export function closeProductionCraftDictDialog(): void {
  state.viewCraftCode = ''
  state.detailTab = 'CURRENT'
  state.showRouteOrder = false
  appStore.navigate('/fcs/production/craft-dict')
}
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:production-craft-dict-page
```

预期：PASS，输出 JSON 中包含 `页面字段口径`。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/production-craft-dict.ts
git commit -m "feat: add process craft route order dialog"
```

## 任务 3：补充原型审查记录并做收口验证

**文件：**
- 创建：`docs/prototype-review-records/2026-07-08-process-craft-route-visual-order.md`

- [ ] **步骤 1：创建审查记录**

创建文件：

```md
# HiGood 原型审查记录：工序工艺字典完整顺序可视化

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-08 |
| 相关需求 / 任务 | 工序工艺字典完整顺序只读可视化入口 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/production/craft-dict` |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 生产计划员、跟单、工艺配置人员 |
| 主要任务 | 查看基础工序工艺顺序 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 入口服务管理端查看，不面向一线执行。 |
| 任务清晰度 | 通过 | 入口文案为“查看完整工序顺序”，弹窗说明基础顺序是技术包路线默认参考。 |
| 信息架构与导航 | 通过 | 不新增菜单或路由，只在字典页标题区增加只读入口。 |
| 页面模式 | 通过 | 使用大弹窗承载路线图，关闭后回到原列表。 |
| 信息负荷 | 通过 | 列表不新增宽列，完整信息放入弹窗。 |
| 文案 | 通过 | 弹窗只展示中文业务字段，不展示工艺编码。 |
| 数量与状态 | 通过 | 展示全部可用工序工艺，卡片展示是否出任务和阶段。 |
| 防错 | 通过 | 同一步内纵向堆叠，避免误解成严格串行。 |
| UI 样式 | 通过 | 复用现有后台表格、弹窗、卡片风格。 |
| 组件交互 | 通过 | 打开、关闭为轻交互，不改变筛选和分页状态。 |
| 协作关系 | 通过 | 明确基础顺序仅作默认参考，不替代款式级技术包确认路线。 |
| 异常与追溯 | 通过 | 未配置顺序集中展示在“未配置顺序”区域。 |

## 4. 最终结论

结论：通过
```

- [ ] **步骤 2：运行相关验证**

运行：

```bash
npm run check:production-craft-dict-page
npm run check:process-craft-final-taxonomy
npm run check:prototype-design-governance -- --all
npm run build
```

预期：

- `check:production-craft-dict-page` 成功输出 JSON。
- `check:process-craft-final-taxonomy` 通过。
- `prototype design governance passed (all): review record found`。
- `vite build` 成功完成。

- [ ] **步骤 3：同步 CodeGraph**

运行：

```bash
codegraph sync && codegraph status
```

预期：`Index is up to date`。

- [ ] **步骤 4：Commit**

```bash
git add docs/prototype-review-records/2026-07-08-process-craft-route-visual-order.md
git commit -m "docs: review process craft route order dialog"
```

- [ ] **步骤 5：最终状态检查**

运行：

```bash
git status --short
```

预期：只允许出现执行前已经存在的 `docs/superpowers/specs/2026-07-07-production-order-change-design.md` 修改；不得出现本计划相关未提交文件。
