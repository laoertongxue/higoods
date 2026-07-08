# 生产准备时效准备项依赖优化实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将生产准备时效中的染色要求、染色调色、基码纸样、版衣制作、齐码纸样建立成真实准备项依赖，并让操作栏按依赖结果蓝色可点或灰色不可点。

**架构：** 继续沿用现有 TypeScript mock 数据、runtime 合并和字符串模板页面，不引入新框架。先用 `scripts/check-production-preparation-timing.ts` 固化业务反例，再补类型、mock、runtime 动态生成、页面操作栏和详情展示。依赖判断复用现有 `dependsOnItemIds`、`canOperateItem()` 和 `hasCompletionEvidence()`。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、现有本地 mock 数据、现有 assert 脚本。

---

## 规格来源

- `docs/superpowers/specs/2026-07-08-production-preparation-dependency-design.md`
- `src/data/fcs/production-preparation-timing.ts`
- `src/data/fcs/production-preparation-timing-runtime.ts`
- `src/pages/production/preparation-timing.ts`
- `scripts/check-production-preparation-timing.ts`

## 文件结构

- 修改：`scripts/check-production-preparation-timing.ts`
  - 增加依赖关系、置灰动作、统计口径和旧入口删除的校验。
- 修改：`src/data/fcs/production-preparation-timing.ts`
  - 增加 `确认染色要求（纱线）`、`确认染色要求（面料）` 类型、默认模板、责任团队、mock 记录和依赖关系。
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`
  - 让确认工作项后动态生成的染色调色项自动带上确认染色要求前置依赖。
- 修改：`src/pages/production/preparation-timing.ts`
  - 删除 `维护染色要求` 附加按钮，把染色要求作为普通准备项操作；更新动作文案和详情展示。
- 创建：`docs/prototype-review-records/2026-07-08-production-preparation-dependency.md`
  - 记录本次原型页面、mock 数据、操作栏和依赖关系自查。

## 任务 1：先补失败校验

**文件：**
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：增加依赖断言工具**

在已有 mock 数据校验区附近增加小工具，复用当前脚本里的 `assert` 和 `productionPreparationRecords`：

```ts
type DependencyCheckItem = {
  itemId: string
  itemType: string
  selectedByMerchandiser: boolean
  status: string
  dependsOnItemIds: string[]
  actualFinishAt: string
  uploads?: Array<{ fileName?: string; uploadedAt?: string; uploadedBy?: string }>
}

type DependencyCheckRecord = {
  recordNo: string
  items: DependencyCheckItem[]
}

function selectedDependencyItems(record: DependencyCheckRecord): DependencyCheckItem[] {
  return record.items.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
}

function itemByType(record: DependencyCheckRecord, itemType: string): DependencyCheckItem | undefined {
  return selectedDependencyItems(record).find((item) => item.itemType === itemType)
}

function isCompletedForDependency(item: DependencyCheckItem | undefined): boolean {
  return Boolean(
    item &&
      item.status === '已完成' &&
      item.actualFinishAt &&
      item.uploads?.some((upload) => upload.fileName && upload.uploadedAt && upload.uploadedBy),
  )
}

function assertDependsOn(record: DependencyCheckRecord, itemType: string, dependencyType: string): void {
  const item = itemByType(record, itemType)
  if (!item) return
  const dependency = itemByType(record, dependencyType)
  assert.ok(dependency, `${record.recordNo} ${itemType} 必须存在前置项 ${dependencyType}`)
  assert.ok(
    item.dependsOnItemIds.includes(dependency.itemId),
    `${record.recordNo} ${itemType} 必须依赖 ${dependencyType}`,
  )
}
```

- [ ] **步骤 2：增加染色依赖校验**

追加以下断言：

```ts
for (const record of productionPreparationRecords as DependencyCheckRecord[]) {
  assertDependsOn(record, '染色调色（纱线）', '确认染色要求（纱线）')
  assertDependsOn(record, '染色调色（面料）', '确认染色要求（面料）')

  for (const dyeType of ['染色调色（纱线）', '染色调色（面料）']) {
    const dyeItem = itemByType(record, dyeType)
    if (!dyeItem || dyeItem.status !== '已完成') continue
    const requirementType = dyeType === '染色调色（纱线）' ? '确认染色要求（纱线）' : '确认染色要求（面料）'
    assert.ok(isCompletedForDependency(itemByType(record, requirementType)), `${record.recordNo} ${dyeType} 已完成时，${requirementType} 必须已完成`)
  }
}
```

- [ ] **步骤 3：增加纸样链路校验**

追加以下断言：

```ts
for (const record of productionPreparationRecords as DependencyCheckRecord[]) {
  const selectedItems = selectedDependencyItems(record)
  const sampleItem = itemByType(record, '版衣制作')
  if (sampleItem) {
    for (const baseItem of selectedItems.filter((item) => item.itemType === '梭织基码纸样' || item.itemType === '毛织基码纸样')) {
      assert.ok(sampleItem.dependsOnItemIds.includes(baseItem.itemId), `${record.recordNo} 版衣制作必须依赖 ${baseItem.itemType}`)
    }
  }

  for (const fullSizeType of ['梭织齐码纸样', '毛织齐码纸样']) {
    assertDependsOn(record, fullSizeType, '版衣制作')
  }
}
```

- [ ] **步骤 4：增加页面置灰和旧入口删除校验**

在当前 HTML 校验区增加：

```ts
const dependencyActionHtml = renderProductionPreparationTimingPage({
  path: '/fcs/production/preparation-timing',
  query: new URLSearchParams('month=2026-03'),
})
assert.ok(!dependencyActionHtml.includes('maintain-dye-requirement'), '染色要求不应再作为 maintain-dye-requirement 附加动作出现')
assert.ok(!dependencyActionHtml.includes('维护染色要求'), '操作栏不应再显示维护染色要求附加按钮')
assert.ok(dependencyActionHtml.includes('确认面料染色要求') || dependencyActionHtml.includes('确认纱线染色要求'), '操作栏必须展示确认染色要求准备项动作')
```

- [ ] **步骤 5：运行检查，确认失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：失败，至少包含 `确认染色要求` 类型或依赖缺失相关断言。

- [ ] **步骤 6：Commit 失败校验**

```bash
git add scripts/check-production-preparation-timing.ts
git commit -m "test: cover preparation dependency rules"
```

## 任务 2：补数据类型、默认模板和责任团队

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`

- [ ] **步骤 1：补准备项类型和列表**

将 `PreparationItemType` 和 `preparationItemTypes` 扩展为：

```ts
export type PreparationItemType =
  | '梭织基码纸样'
  | '毛织基码纸样'
  | '版衣制作'
  | '梭织齐码纸样'
  | '毛织齐码纸样'
  | '数码印/DTF/DTG花型'
  | '确认染色要求（纱线）'
  | '染色调色（纱线）'
  | '确认染色要求（面料）'
  | '染色调色（面料）'
  | '辅料下单'
```

- [ ] **步骤 2：补默认模板**

在 `preparationTypeDefaultItems` 中，让每个可选染色调色项前都出现对应确认项：

```ts
{ itemType: '确认染色要求（面料）', defaultSelected: false, canUnselect: true },
{ itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
```

毛织&梭织中同时保留纱线和面料两组：

```ts
{ itemType: '确认染色要求（纱线）', defaultSelected: false, canUnselect: true },
{ itemType: '染色调色（纱线）', defaultSelected: false, canUnselect: true },
{ itemType: '确认染色要求（面料）', defaultSelected: false, canUnselect: true },
{ itemType: '染色调色（面料）', defaultSelected: false, canUnselect: true },
```

- [ ] **步骤 3：补责任团队**

如果 `preparationOwnerTeams` 缺少 `跟单角色`，加入它，并确认 `preparationOwnerRoleRules` 包含：

```ts
{ ownerTeam: '跟单角色', roleLabels: ['跟单'], actionScope: '确认工作项、确认染色要求' }
```

- [ ] **步骤 4：运行类型检查，确认当前 mock 仍失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：类型相关失败减少，mock 依赖和页面旧入口仍失败。

- [ ] **步骤 5：Commit 类型和模板**

```bash
git add src/data/fcs/production-preparation-timing.ts
git commit -m "feat: add dye requirement preparation items"
```

## 任务 3：修正 mock 数据依赖闭环

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`

- [ ] **步骤 1：为染色已选记录补确认项**

对每个已选 `染色调色（纱线）` 的记录，在该项前增加：

```ts
req('确认染色要求（纱线）', '已完成', '跟单角色', '跟单', '2026-03-03T09:00:00', '2026-03-03T12:00:00', '2026-03-03T10:10:00', '染色并行', [], '纱线染色', {
  evidenceSummary: '跟单已确认纱线颜色、潘通色号和对应纱线',
})
```

对每个已选 `染色调色（面料）` 的记录，在该项前增加：

```ts
req('确认染色要求（面料）', '已完成', '跟单角色', '跟单', '2026-03-03T09:00:00', '2026-03-03T12:00:00', '2026-03-03T10:25:00', '染色并行', [], '面料染色', {
  evidenceSummary: '跟单已确认面料颜色、潘通色号和对应面料',
})
```

已有 `dyeRequirement.maintainedBy` 和 `maintainedAt` 可同步到确认项的 `ownerName`、`actualFinishAt`。

- [ ] **步骤 2：给染色调色补依赖**

把每个已选染色调色项的 `dependsOnItemIds` 改为对应确认项 itemId，例如：

```ts
opt('染色调色（面料）', true, '进行中', '染色团队', 'Rini', '2026-03-03T09:00:00', '2026-03-06T18:00:00', '', '染色并行', '面料染色', {
  dependsOnItemIds: ['prep-202603-002-item-09'],
  evidenceSummary: '梭织拼接面料二次调色',
  overdueHours: 9,
  dyeRequirement: { ... }
})
```

如果当前 `opt()` 默认覆盖 `dependsOnItemIds: []`，使用 `extra.dependsOnItemIds` 覆盖即可。

- [ ] **步骤 3：补未确认导致置灰的 mock**

确保至少一条记录存在：

```ts
req('确认染色要求（面料）', '待开始', '跟单角色', '跟单', '2026-04-05T09:00:00', '2026-04-05T12:00:00', '', '染色并行', [], '面料染色', {
  evidenceSummary: '待跟单确认面料染色要求',
})
opt('染色调色（面料）', true, '待开始', '染色团队', 'Rini', '2026-04-05T13:00:00', '2026-04-08T18:00:00', '', '染色并行', '面料染色', {
  dependsOnItemIds: ['对应确认染色要求 itemId'],
  evidenceSummary: '等待面料染色要求确认后上传调色结果',
})
```

- [ ] **步骤 4：确认纸样依赖覆盖**

核对所有记录：

```ts
req('版衣制作', ..., ['梭织基码 itemId', '毛织基码 itemId'], ...)
req('梭织齐码纸样', ..., ['版衣制作 itemId'], ...)
req('毛织齐码纸样', ..., ['版衣制作 itemId'], ...)
```

只补缺失项，不重写无关 mock。

- [ ] **步骤 5：运行检查，确认页面旧入口仍失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：数据依赖断言通过，页面 `maintain-dye-requirement` 相关断言仍失败。

- [ ] **步骤 6：Commit mock 数据**

```bash
git add src/data/fcs/production-preparation-timing.ts
git commit -m "feat: model preparation item dependencies in mock data"
```

## 任务 4：修正 runtime 动态生成依赖

**文件：**
- 修改：`src/data/fcs/production-preparation-timing-runtime.ts`

- [ ] **步骤 1：扩展 runtime 依赖函数**

在 `runtimeDependencyTypes()` 中加入染色依赖：

```ts
if (itemType === '染色调色（纱线）') {
  return templateTypes.has('确认染色要求（纱线）') ? ['确认染色要求（纱线）'] : []
}
if (itemType === '染色调色（面料）') {
  return templateTypes.has('确认染色要求（面料）') ? ['确认染色要求（面料）'] : []
}
```

- [ ] **步骤 2：扩展 runtime 布局函数**

在 `runtimeItemLayout()` 中加入：

```ts
if (itemType === '确认染色要求（纱线）') return { sequenceGroup: '染色并行', parallelGroup: '纱线染色', ownerTeam: '跟单角色', ownerName: '待确认' }
if (itemType === '确认染色要求（面料）') return { sequenceGroup: '染色并行', parallelGroup: '面料染色', ownerTeam: '跟单角色', ownerName: '待确认' }
```

- [ ] **步骤 3：运行检查，确认 runtime 相关断言通过**

运行：

```bash
npm run check:production-preparation-timing
```

预期：runtime 切换商品类型后，染色调色项依赖对应确认染色要求。

- [ ] **步骤 4：Commit runtime**

```bash
git add src/data/fcs/production-preparation-timing-runtime.ts
git commit -m "feat: preserve preparation dependencies in runtime records"
```

## 任务 5：调整页面操作栏和染色要求入口

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`

- [ ] **步骤 1：更新动作文案**

把 `PREPARATION_ACTION_LABELS` 调整为：

```ts
const PREPARATION_ACTION_LABELS: Record<PreparationItemType, string> = {
  梭织基码纸样: '上传梭织基码纸样',
  毛织基码纸样: '上传毛织基码纸样',
  版衣制作: '上传版衣结果',
  梭织齐码纸样: '上传梭织齐码纸样',
  毛织齐码纸样: '上传毛织齐码纸样',
  '数码印/DTF/DTG花型': '上传花型文件',
  '确认染色要求（纱线）': '确认纱线染色要求',
  '染色调色（纱线）': '上传纱线调色结果',
  '确认染色要求（面料）': '确认面料染色要求',
  '染色调色（面料）': '上传面料调色结果',
  辅料下单: '登记辅料下单',
}
```

- [ ] **步骤 2：删除附加按钮**

在 `renderLedgerActions()` 中删除：

```ts
const showDyeRequirementAction = !(valueOf(params, 'recordId') && !valueOf(params, 'action'))
const dyeRequirementHref = buildLedgerActionHref(...)
showDyeRequirementAction && isDyeItem(item) ? ...
```

保留每个准备项只有一个入口：

```ts
return operable
  ? `<button type="button" class="text-left text-sm text-blue-600 hover:underline" data-nav="${escapeHtml(operateHref)}">${escapeHtml(preparationActionLabel(item))}</button>`
  : `<span class="text-sm text-muted-foreground opacity-60">${escapeHtml(preparationActionLabel(item))}</span>`
```

- [ ] **步骤 3：让确认染色要求复用现有染色要求表单**

把 `renderDyeRequirementDialog()` 的入口判断从 `maintain-dye-requirement + isDyeItem` 改成 `operate-item + isDyeRequirementItem`：

```ts
function isDyeRequirementItem(item: ProductionPreparationItem): boolean {
  return item.itemType === '确认染色要求（纱线）' || item.itemType === '确认染色要求（面料）'
}
```

判断：

```ts
if (valueOf(params, 'action') !== 'operate-item' || !isDyeRequirementItem(item) || !isSelectedPreparationItem(item)) return ''
```

- [ ] **步骤 4：提交处理识别确认染色要求**

在 `handleProductionPreparationTimingSubmit()` 中，原 `maintain-dye-requirement` 分支改为处理确认染色要求项；保存到 `runtime.dyeRequirements[item.itemId]`，并写入一条完成证据所需的上传或确认记录。如果当前 runtime 只支持 uploads，新增一条轻量 upload 记录：

```ts
{
  uploadId: `dye-requirement-${Date.now()}`,
  recordId,
  itemId,
  itemType: item.itemType,
  fileName: '染色要求确认记录',
  fileUrl: '',
  uploadedBy: maintainedBy,
  uploadedAt: maintainedAt,
  remark: `${colorName} / ${pantoneCode}`,
}
```

- [ ] **步骤 5：运行检查，确认操作栏断言通过**

运行：

```bash
npm run check:production-preparation-timing
```

预期：不再出现 `maintain-dye-requirement`，确认染色要求动作可见，前置未完成的染色调色动作置灰。

- [ ] **步骤 6：Commit 页面行为**

```bash
git add src/pages/production/preparation-timing.ts
git commit -m "feat: show preparation dependency actions"
```

## 任务 6：补详情展示和统计口径

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：详情中展示前置项**

在准备项详情卡片中增加前置项文本：

```ts
function dependencyText(item: ProductionPreparationItem, record: ProductionPreparationRecord): string {
  if (!item.dependsOnItemIds.length) return '无前置准备项'
  return item.dependsOnItemIds
    .map((depId) => record.items.find((candidate) => candidate.itemId === depId)?.itemType)
    .filter(Boolean)
    .join('、')
}
```

展示：

```html
<div>前置准备项：${escapeHtml(dependencyText(item, record))}</div>
```

- [ ] **步骤 2：详情中展示染色要求内容**

对 `isDyeRequirementItem(item)` 展示 `item.dyeRequirement`：

```ts
${item.dyeRequirement ? `
  <div>对应物料：${escapeHtml(item.dyeRequirement.materialName)} / ${escapeHtml(item.dyeRequirement.materialNo)}</div>
  <div>颜色：${escapeHtml(item.dyeRequirement.colorName)} / ${escapeHtml(item.dyeRequirement.pantoneCode)}</div>
  <div>确认：${escapeHtml(item.dyeRequirement.maintainedBy)} ${escapeHtml(item.dyeRequirement.maintainedAt)}</div>
` : '<div class="text-muted-foreground">待确认染色要求</div>'}
```

- [ ] **步骤 3：更新统计校验**

删除脚本中旧断言：

```ts
assert.ok(!detailStatsHtml.includes('维护染色要求完成'), ...)
```

增加统计断言：

```ts
assert.ok(detailStatsHtml.includes('确认染色要求（面料）') || detailStatsHtml.includes('确认染色要求（纱线）'), '明细统计必须计入确认染色要求准备项')
```

- [ ] **步骤 4：运行检查**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS。

- [ ] **步骤 5：Commit 详情和统计**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: show preparation dependency details"
```

## 任务 7：原型治理记录和完整验证

**文件：**
- 创建：`docs/prototype-review-records/2026-07-08-production-preparation-dependency.md`

- [ ] **步骤 1：新增审查记录**

复制 `docs/prototype-review-record-template.md` 的结构，填写：

```md
# 生产准备时效准备项依赖优化原型审查记录

| 项目 | 内容 |
| --- | --- |
| 页面路径 | /fcs/production/preparation-timing |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 跟单、版师团队、车板团队、染色团队 |
| 主要任务 | 确认准备项前置依赖，避免未确认染色要求或未完成纸样前置时误操作 |
| 审查结论 | 通过 |
| 问题标签 | 无 |

## 自查结论

- 染色要求作为跟单准备工作项，染色调色依赖该项完成。
- 基码纸样、版衣制作、齐码纸样按业务顺序推进。
- 不可操作入口直接置灰，降低一线判断成本。
- 详情页保留前置项、责任人、时间和证据，便于主管追溯。
```

- [ ] **步骤 2：运行完整验证**

运行：

```bash
npm run check:production-preparation-timing
npm run check:prototype-design-governance -- --all
npm run build
git diff --check
codegraph sync
codegraph status
```

预期：全部通过，CodeGraph 状态为 up to date。

- [ ] **步骤 3：Commit 审查记录**

```bash
git add docs/prototype-review-records/2026-07-08-production-preparation-dependency.md
git commit -m "docs: review preparation dependency prototype"
```

## 任务 8：最终质量审查

**文件：**
- 审查：`src/data/fcs/production-preparation-timing.ts`
- 审查：`src/data/fcs/production-preparation-timing-runtime.ts`
- 审查：`src/pages/production/preparation-timing.ts`
- 审查：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：规格覆盖审查**

逐条核对 `docs/superpowers/specs/2026-07-08-production-preparation-dependency-design.md` 的验收标准：

```text
确认染色要求是准备项
染色调色依赖确认染色要求
基码纸样到版衣制作到齐码纸样依赖成立
不可操作直接置灰
mock 覆盖 14 个场景
check 脚本能阻断反例
```

- [ ] **步骤 2：反例审查**

手工搜索确认：

```bash
rg -n "maintain-dye-requirement|维护染色要求" src scripts
rg -n "确认染色要求|染色调色|dependsOnItemIds" src/data/fcs/production-preparation-timing.ts src/data/fcs/production-preparation-timing-runtime.ts scripts/check-production-preparation-timing.ts
```

预期：

- 第一条不应在页面操作入口中出现。
- 第二条能看到确认染色要求类型、染色调色依赖和脚本断言。

- [ ] **步骤 3：最终状态检查**

运行：

```bash
git status --short
git log --oneline -8
```

预期：工作区干净，提交顺序清晰。

## 自检

- 规格覆盖：任务 1 到任务 8 覆盖类型、mock、runtime、页面、详情、统计、治理记录和验证。
- 占位符扫描：计划不包含未定义的占位任务；每个代码改动步骤都有目标文件和代码片段。
- 类型一致性：新增准备项类型统一使用 `确认染色要求（纱线）`、`确认染色要求（面料）`。
- 范围控制：不做快捷路径、不做真实权限、不引入新框架。
