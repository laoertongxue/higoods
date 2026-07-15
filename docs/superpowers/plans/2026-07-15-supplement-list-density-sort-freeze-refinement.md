# 补料管理列表紧凑度、排序图标与冻结列修订实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将补料管理标准列表模板调整为 48px 单行摘要卡片、稳定可见的三态排序图标，以及从滚动起点即固定在左侧的冻结列，并把最终标准同步进 Agent 治理规则。

**架构：** 继续由 `list-page.ts` 和 `list-table.ts` 承担公共 UI，不在补料管理页面复制布局。冻结仅在渲染时把已冻结可见列分组到左侧，不改写用户保存的列顺序；排序图标由公共表格直接输出内联 SVG，避免局部刷新后的图标 hydration 依赖。补料管理 E2E 负责低分辨率与真实滚动验收，`AGENTS.md` 和专项检查负责约束后续页面。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Playwright、Node `assert`

---

## 文件结构

- 修改：`src/components/ui/list-page.ts` —— 将标准摘要卡片收敛为 48px 单行布局。
- 修改：`src/components/ui/list-table.ts` —— 输出内联排序 SVG；按冻结、普通、操作三组渲染可见列并计算 sticky 偏移。
- 修改：`scripts/check-standard-list-page-template.ts` —— 为摘要布局、排序图标和冻结分组增加公共组件回归检查。
- 修改：`tests/supplement-management-list-template.spec.ts` —— 在真实 Chromium 中验证单行摘要、图标刷新、多列冻结与取消冻结。
- 修改：`AGENTS.md` —— 写入最终标准列表摘要、排序图标和冻结列强制规则。
- 修改：`docs/prototype-review-records/2026-07-15-supplement-management-list-template.md` —— 记录本次视觉密度、低分辨率和固定列复审证据。

### 任务 1：标准摘要卡片与排序图标

**文件：**
- 修改：`src/components/ui/list-page.ts:22-37`
- 修改：`src/components/ui/list-table.ts:98-120`
- 测试：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：编写失败的公共组件检查**

在 `scripts/check-standard-list-page-template.ts` 增加以下行为断言：

```ts
const compactStatsHtml = renderStandardListStats([
  { label: '补料单', value: 12 },
  { label: '已确认', value: 12 },
])
assert.match(compactStatsHtml, /min-h-12/)
assert.match(compactStatsHtml, /items-center/)
assert.match(compactStatsHtml, /justify-between/)
assert.doesNotMatch(compactStatsHtml, /mt-1 text-xl/)

const unsortedHtml = renderStandardListTable({
  columns: testColumns,
  rows: [{ id: '1', qty: 12 }],
  preferences: defaultPreferences,
  sort: null,
  eventPrefix: 'test-list',
})
assert.match(unsortedHtml, /data-standard-list-sort-icon="none"/)
assert.match(unsortedHtml, /<svg[^>]+aria-hidden="true"/)
assert.doesNotMatch(unsortedHtml, /data-lucide="arrow-up-down"/)

const ascendingHtml = renderStandardListTable({
  columns: testColumns,
  rows: [{ id: '1', qty: 12 }],
  preferences: defaultPreferences,
  sort: { key: 'qty', direction: 'asc' },
  eventPrefix: 'test-list',
})
assert.match(ascendingHtml, /data-standard-list-sort-icon="asc"/)
assert.match(ascendingHtml, /aria-sort="ascending"/)
```

- [ ] **步骤 2：运行检查确认红灯**

运行：

```bash
npm run check:standard-list-page-template
```

预期：FAIL，至少缺少 `min-h-12` 单行摘要或 `data-standard-list-sort-icon` 内联 SVG。

- [ ] **步骤 3：实现 48px 单行摘要**

将 `renderStandardListStats()` 的卡片内部改为同一 flex 行：

```ts
<div class="flex min-h-12 min-w-[10rem] flex-1 items-center justify-between gap-4 rounded-lg border bg-card px-4">
  <span class="text-sm text-muted-foreground">${escapeHtml(item.label)}</span>
  <strong class="text-lg font-semibold tabular-nums">${escapeHtml(item.value)}</strong>
</div>
```

保留外层 `flex flex-wrap gap-3`，不改变统计数据来源。

- [ ] **步骤 4：实现稳定的三态内联 SVG**

在 `list-table.ts` 增加纯渲染函数，不引入新的图标库：

```ts
function renderSortIcon(direction: 'asc' | 'desc' | null): string {
  const body = direction === 'asc'
    ? '<path d="m18 15-6-6-6 6"/><path d="M12 9v12"/>'
    : direction === 'desc'
      ? '<path d="m6 9 6 6 6-6"/><path d="M12 15V3"/>'
      : '<path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/>'
  const state = direction ?? 'none'
  return `<span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded" data-standard-list-sort-icon="${state}"><svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg></span>`
}
```

`renderSortHeader()` 必须调用该函数并删除 `data-lucide` 图标。

- [ ] **步骤 5：运行检查确认绿灯**

运行：

```bash
npm run check:standard-list-page-template
```

预期：PASS，输出 `standard list page template check passed`。

- [ ] **步骤 6：提交任务 1**

```bash
git add src/components/ui/list-page.ts src/components/ui/list-table.ts scripts/check-standard-list-page-template.ts
git commit -m "feat: compact standard list stats and sort icons"
```

### 任务 2：冻结列从滚动起点固定左侧

**文件：**
- 修改：`src/components/ui/list-table.ts:37-178`
- 测试：`scripts/check-standard-list-page-template.ts`

- [ ] **步骤 1：编写失败的冻结分组检查**

增加一个列顺序为 `recordNo, target, qty, actions`、仅冻结中间列 `qty` 的表格用例：

```ts
const middleFrozenHtml = renderStandardListTable({
  columns: freezeTestColumns,
  rows: [{ recordNo: 'SUP-001', target: '裁片单', qty: 12 }],
  preferences: {
    visibleKeys: ['recordNo', 'target', 'qty', 'actions'],
    order: ['recordNo', 'target', 'qty', 'actions'],
    frozenKeys: ['qty'],
    pageSize: 10,
  },
  sort: null,
  eventPrefix: 'freeze-test',
})
const headerKeys = [...middleFrozenHtml.matchAll(/<th[\s\S]*?data-column-key="([^"]+)"/g)].map((match) => match[1])
assert.deepEqual(headerKeys, ['qty', 'recordNo', 'target', 'actions'])
assert.match(middleFrozenHtml, /data-column-key="qty"[\s\S]*?left: 0px/)
```

再增加多列冻结断言：当 `frozenKeys` 为 `target, qty` 时，渲染顺序必须是 `target, qty, recordNo, actions`，且第二个冻结列的 `left` 等于第一个冻结列宽度。

- [ ] **步骤 2：运行检查确认红灯**

运行：

```bash
npm run check:standard-list-page-template
```

预期：FAIL，当前实现仍按普通列顺序渲染冻结的中间列。

- [ ] **步骤 3：实现渲染期冻结分组**

保留 `orderedColumns()` 作为用户列顺序真相，新增只影响可见表格的分组函数：

```ts
function visibleTableColumns<T>(
  columns: readonly StandardListColumn<T>[],
  preferences: Readonly<StandardListColumnPreferences>,
): StandardListColumn<T>[] {
  const visibleKeys = new Set(preferences.visibleKeys)
  const frozenKeys = new Set(preferences.frozenKeys)
  const visible = orderedColumns(columns, preferences.order).filter((column) =>
    isColumnVisible(column, visibleKeys),
  )
  const actionColumns = visible.filter((column) => column.actionColumn)
  const regular = visible.filter((column) => !column.actionColumn)
  return [
    ...regular.filter((column) => frozenKeys.has(column.key)),
    ...regular.filter((column) => !frozenKeys.has(column.key)),
    ...actionColumns,
  ]
}
```

`renderStandardListTable()` 使用该函数；列设置抽屉继续使用 `orderedColumns()`，保证冻结不改写用户顺序。

- [ ] **步骤 4：统一 sticky left 样式与冻结边界**

每个冻结表头和单元格都必须显式输出 `left: Npx`，包括第一个冻结列的 `0px`；最后一个冻结列增加右侧阴影标记：

```ts
const isLastFrozen = frozenColumnKeys.at(-1) === column.key
const classes = [
  baseClasses,
  isFrozen ? frozenClass(column, header) : '',
  isLastFrozen ? 'shadow-[6px_0_8px_-8px_rgba(15,23,42,0.75)]' : '',
]
const stickyStyle = left !== undefined && !column.actionColumn ? ` left: ${left}px;` : ''
```

操作列继续使用 `sticky right-0`，并保持左侧分隔线或阴影。

- [ ] **步骤 5：运行公共组件检查**

运行：

```bash
npm run check:standard-list-page-template
```

预期：PASS，单列和多列冻结顺序、偏移及操作列末位断言全部通过。

- [ ] **步骤 6：提交任务 2**

```bash
git add src/components/ui/list-table.ts scripts/check-standard-list-page-template.ts
git commit -m "fix: pin frozen standard list columns left"
```

### 任务 3：补料管理真实浏览器验收

**文件：**
- 修改：`tests/supplement-management-list-template.spec.ts:185-530`
- 修改：`docs/prototype-review-records/2026-07-15-supplement-management-list-template.md`

- [ ] **步骤 1：编写失败的摘要与排序图标 E2E**

新增用例，先在当前实现上确认失败：

```ts
test('摘要卡片单行紧凑且排序图标在局部刷新后保持可见', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openList(page)
  const cards = page.locator('[data-standard-list-stats] > div')
  await expect(cards).toHaveCount(3)
  for (const card of await cards.all()) {
    const box = await visibleBox(card, '摘要卡片')
    expect(box.height).toBeLessThanOrEqual(49)
  }
  const quantityHeader = page.locator('th[data-column-key="supplementQty"]')
  await expect(quantityHeader.locator('[data-standard-list-sort-icon="none"] svg')).toBeVisible()
  await quantityHeader.getByRole('button').click()
  await expect(quantityHeader.locator('[data-standard-list-sort-icon="asc"] svg')).toBeVisible()
})
```

- [ ] **步骤 2：编写失败的中间列与多列冻结 E2E**

冻结原本位于中间的“补料数量”，在未滚动时就断言它是首列表头，再横向滚动验证坐标不变：

```ts
await openColumnSettings(page)
await settingRow(page, 'supplementQty').getByLabel('冻结').check()
await page.getByRole('button', { name: '关闭', exact: true }).click()
expect((await headerOrder(page))[0]).toBe('supplementQty')
const before = await visibleBox(page.locator('th[data-column-key="supplementQty"]'), '冻结补料数量')
await scroll.evaluate((element) => { element.scrollLeft = element.scrollWidth })
const after = await visibleBox(page.locator('th[data-column-key="supplementQty"]'), '滚动后冻结补料数量')
expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1)
```

随后同时冻结 `recordNo` 与 `supplementQty`，断言两列位于最左侧、互不覆盖；取消 `supplementQty` 冻结后，断言它回到用户保存的普通列位置。

- [ ] **步骤 3：运行新用例确认红灯**

运行：

```bash
npm run test:supplement-management-list-template:e2e -- --grep "摘要卡片|中间列"
```

预期：FAIL，当前摘要高度、图标或中间冻结列首位断言不满足。

- [ ] **步骤 4：运行实现后的 E2E 绿灯**

运行：

```bash
npm run test:supplement-management-list-template:e2e
```

预期：全部用例 PASS；1366×768 和 1280×720 均无页面横向溢出，`console.error` 与 `pageerror` 为 0。

- [ ] **步骤 5：更新原型审查记录**

在既有审查记录中补充：

- 选择 B「平衡紧凑」，摘要卡片 48px 单行。
- 排序图标使用内联 SVG，局部刷新后仍可见。
- 非首列冻结后立即进入左侧固定区，多列冻结无覆盖。
- 两档低分辨率与操作列右侧固定复验结果。

- [ ] **步骤 6：提交任务 3**

```bash
git add tests/supplement-management-list-template.spec.ts docs/prototype-review-records/2026-07-15-supplement-management-list-template.md
git commit -m "test: cover compact stats and true frozen columns"
```

### 任务 4：同步最终规格到 Agent 治理

**文件：**
- 修改：`AGENTS.md:230-250`
- 修改：`scripts/check-standard-list-page-template.ts:42-145`

- [ ] **步骤 1：先写治理规则失败断言**

在 `assertStandardListGovernanceSection()` 增加完整行、方向明确的断言：

```ts
assert.match(
  section,
  /^- 标准列表摘要卡片必须采用 48px 单行布局，标签和值水平排列，不得使用上下两段造成额外垂直占用。$/m,
)
assert.match(
  section,
  /^- 所有可排序列必须显示未排序、升序和降序三态图标；图标必须由组件直接输出，局部刷新后仍保持可见。$/m,
)
assert.match(
  section,
  /^- 用户冻结的普通列必须立即进入表格最左侧固定区，从横向滚动开始到结束都不移动；多列冻结按用户列顺序排列，取消冻结后恢复普通列位置。$/m,
)
```

将对应否定变体加入 `rejectedGovernanceVariants`，确保“不必单行”“不必显示图标”“冻结列可以随滚动移动”等文本不能通过检查。

- [ ] **步骤 2：运行检查确认红灯**

运行：

```bash
npm run check:standard-list-page-template
```

预期：FAIL，提示 `AGENTS.md` 缺少新治理规则。

- [ ] **步骤 3：更新 `AGENTS.md` 标准列表治理章节**

在 `### 7.3 标准列表页模板治理` 的强制规则中加入与步骤 1 完全一致的三条规则。保留既有分页、持久化、低分辨率、说明文案和操作列规则；不得将本次规则写成仅适用于补料管理的例外。

- [ ] **步骤 4：运行治理与专项检查**

运行：

```bash
npm run check:standard-list-page-template
npm run check:prototype-design-governance -- --all
```

预期：两个命令均 PASS；专项检查的三类否定变体均被拒绝。

- [ ] **步骤 5：运行最终完整验证**

运行：

```bash
npm run test:supplement-management-list-template:e2e
npm run build
git diff --check
codegraph sync
codegraph status
```

预期：E2E 全部通过；Vite 构建退出码 0；`git diff --check` 无输出；CodeGraph 显示 `Index is up to date`。

- [ ] **步骤 6：提交任务 4**

```bash
git add AGENTS.md scripts/check-standard-list-page-template.ts
git commit -m "docs: govern compact stats and frozen columns"
```

### 任务 5：最终审查与现场确认

**文件：**
- 只读审查：`a449ff59..HEAD`

- [ ] **步骤 1：进行需求符合性审查**

逐项核对设计规格八个章节，确认未迁移其他页面、未改变补料业务字段和分页口径，并确认 Agent 规则已经更新。

- [ ] **步骤 2：进行代码质量审查**

重点检查：

- 冻结分组不改写 `preferences.order`。
- 多列 sticky `left` 偏移无重叠。
- 内联 SVG 没有不合法路径或无障碍回归。
- 摘要布局在 1280×720 不换行。
- 相关交互仍为局部刷新。

- [ ] **步骤 3：在运行中的本地页面复验**

访问：

```text
http://localhost:5180/fcs/craft/cutting/supplement-management
```

手工确认摘要单行、排序图标三态、冻结中间列从滚动起点固定左侧、操作列固定右侧。

- [ ] **步骤 4：处理审查发现并重新验证**

如审查失败，回到对应任务先补失败测试，再实施最小修复，重复该任务的完整验证；所有审查通过前不得合并或推送。
