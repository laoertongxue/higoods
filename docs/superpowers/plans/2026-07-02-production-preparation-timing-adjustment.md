# 生产准备时效调整实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有 `生产准备时效` 页面中补齐做大货入口口径、商品准备类型自动推导、跟单确认修正、四类准备项模板、产出统一展示和对应 mock/验收。

**架构：** 保持现有 Vanilla TypeScript 字符串模板页面，不新增后端、不新增规则引擎。把规则集中在 `src/data/fcs/production-preparation-timing.ts` 的本地 mock/domain 层，页面只消费字段并展示确认、准备项和产出状态。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript HTML 字符串渲染、`tsx` 自检脚本、CodeGraph。

---

## 文件结构

- 修改：`src/data/fcs/production-preparation-timing.ts`
  - 定义商品准备类型、准备项细分类型、推导字段、确认字段、做大货入口字段、产出字段。
  - 补齐 12 条 mock 记录，覆盖四类商品准备类型。
  - 调整统计过滤逻辑，只统计已选择准备项。

- 修改：`src/pages/production/preparation-timing.ts`
  - 列表展示商品类型、选品/买手/跟单、做大货阈值和达到天数、产出状态。
  - 详情抽屉展示来源信息、商品类型确认、准备项确认、准备项明细、准备产出。
  - 保留现有花型师筛选、分配、上传完成图片 mock 行为。

- 修改：`scripts/check-production-preparation-timing.ts`
  - 先补失败断言，再随实现逐步通过。
  - 校验四类模板、入口字段、推导确认、选填统计、产出展示、原有花型功能。

- 只读参考：`docs/superpowers/specs/2026-07-02-production-preparation-timing-adjustment-design.md`
  - 本计划以此规格为准。

---

## 任务 1：补失败检查，锁定新增业务口径

**文件：**
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：扩展数据断言**

在 import 后的 mock 数据断言区域增加以下检查。放在现有 `preparationItems` 基础断言之后：

```ts
const expectedPrepTypes = [
  '非烫画&非毛织（纯梭织）',
  '烫画&直喷',
  '毛织',
  '毛织&梭织',
] as const

for (const type of expectedPrepTypes) {
  assert.ok(
    productionPreparationRecords.some((record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === type),
    `缺少商品准备类型：${type}`,
  )
}

assert.ok(
  productionPreparationRecords.every((record: {
    selectionName?: string
    largeGoodsThresholdQty?: number
    largeGoodsReachedQty?: number
    largeGoodsReachedAt?: string
    largeGoodsReachedDays?: number
    derivedProductPrepType?: string
    confirmedProductPrepType?: string
    prepTypeSource?: string
    prepTypeConfirmedBy?: string
    prepTypeConfirmedAt?: string
  }) =>
    record.selectionName &&
    record.largeGoodsThresholdQty === 300 &&
    typeof record.largeGoodsReachedQty === 'number' &&
    Boolean(record.largeGoodsReachedAt) &&
    typeof record.largeGoodsReachedDays === 'number' &&
    Boolean(record.derivedProductPrepType) &&
    Boolean(record.confirmedProductPrepType) &&
    Boolean(record.prepTypeSource) &&
    Boolean(record.prepTypeConfirmedBy) &&
    Boolean(record.prepTypeConfirmedAt),
  ),
  '每条记录必须包含选品、做大货入口字段和商品类型确认字段',
)

const overriddenRecord = productionPreparationRecords.find(
  (record: { prepTypeSource?: string }) => record.prepTypeSource === '人工修正',
)
assert.ok(overriddenRecord, '必须有一条商品准备类型人工修正 mock')
assert.ok(
  overriddenRecord.prepTypeOverrideReason,
  '人工修正商品准备类型必须填写修正原因',
)
```

- [ ] **步骤 2：扩展准备项模板断言**

继续在同一脚本中增加 helper 和四类模板断言：

```ts
function itemNames(record: { items: Array<{ itemType: string; requiredKind?: string; selectedByMerchandiser?: boolean }> }): string[] {
  return record.items
    .filter((item) => item.selectedByMerchandiser !== false)
    .map((item) => item.itemType)
}

function assertRecordHasItems(
  record: { recordNo: string; items: Array<{ itemType: string; requiredKind?: string; selectedByMerchandiser?: boolean }> },
  expected: string[],
): void {
  const actual = itemNames(record)
  for (const itemType of expected) {
    assert.ok(actual.includes(itemType), `${record.recordNo} 缺少准备项 ${itemType}`)
  }
}

const wovenRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '非烫画&非毛织（纯梭织）',
)
const printRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '烫画&直喷',
)
const knitRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '毛织',
)
const mixedRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '毛织&梭织',
)

assert.ok(wovenRecord, '缺少纯梭织记录')
assert.ok(printRecord, '缺少烫画&直喷记录')
assert.ok(knitRecord, '缺少毛织记录')
assert.ok(mixedRecord, '缺少毛织&梭织记录')

assertRecordHasItems(wovenRecord, ['梭织基码纸样', '版衣制作', '梭织齐码纸样', '辅料下单'])
assert.deepEqual(itemNames(printRecord), ['数码印/DTF/DTG花型'], '烫画&直喷应有且仅有花型必做项')
assertRecordHasItems(knitRecord, ['毛织基码纸样', '版衣制作', '毛织齐码纸样', '辅料下单'])
assertRecordHasItems(mixedRecord, ['毛织基码纸样', '梭织基码纸样', '版衣制作', '毛织齐码纸样', '梭织齐码纸样', '辅料下单'])

assert.ok(
  preparationItems.some((item: { requiredKind?: string; selectedByMerchandiser?: boolean }) =>
    item.requiredKind === '选填' && item.selectedByMerchandiser === false,
  ),
  '必须存在未选择的选填准备项',
)
```

- [ ] **步骤 3：扩展页面和统计断言**

在 HTML 断言区域增加：

```ts
const adjustedLedgerHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03')
for (const text of [
  '做大货阈值：300',
  '达到做大货要求',
  '商品类型',
  '系统推导',
  '跟单确认',
  '准备项确认',
  '预计产出',
] as const) {
  assertHtmlIncludes(adjustedLedgerHtml, text, `调整后准备台账 HTML 缺少「${text}」`)
}

const readyOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-003')
assertHtmlIncludes(readyOutputHtml, '正式产出', '全部完成记录必须展示正式产出')
assertHtmlIncludes(readyOutputHtml, '已生成', '全部完成记录的产出状态必须为已生成')

const pendingOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001')
assertHtmlIncludes(pendingOutputHtml, '预计产出', '未全部完成记录必须只展示预计产出')
assert.ok(!pendingOutputHtml.includes('正式产出</h3>'), '未全部完成记录不应展示正式产出标题')

const marchUnselectedOptionalDetails = buildMonthlyPreparationCompletionDetails('2026-03').filter(
  (row: { requiredKind?: string; selectedByMerchandiser?: boolean }) =>
    row.requiredKind === '选填' && row.selectedByMerchandiser === false,
)
assert.equal(marchUnselectedOptionalDetails.length, 0, '未选择的选填项不应进入月度完成明细')
```

- [ ] **步骤 4：运行检查确认失败**

运行：

```bash
npm run check:production-preparation-timing
```

预期：失败，至少出现 `缺少商品准备类型` 或 `每条记录必须包含选品、做大货入口字段和商品类型确认字段`。

- [ ] **步骤 5：Commit**

```bash
git add scripts/check-production-preparation-timing.ts
git commit -m "test: cover preparation timing adjustment rules"
```

---

## 任务 2：调整数据模型、类型和统计口径

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：更新类型定义**

在 `src/data/fcs/production-preparation-timing.ts` 顶部替换 `PreparationItemType`，并新增商品准备类型和产出类型：

```ts
export type ProductPrepType =
  | '非烫画&非毛织（纯梭织）'
  | '烫画&直喷'
  | '毛织'
  | '毛织&梭织'

export type PreparationItemType =
  | '梭织基码纸样'
  | '毛织基码纸样'
  | '版衣制作'
  | '梭织齐码纸样'
  | '毛织齐码纸样'
  | '数码印/DTF/DTG花型'
  | '染色调色（纱线）'
  | '染色调色（面料）'
  | '辅料下单'

export type PreparationOutputType = '正式技术包' | '生产单' | '印花单' | '染色单' | '辅料采购单'
export type PreparationOutputStatus = '预计生成' | '已生成'
```

把 `ProductionPreparationItem` 扩展为：

```ts
export interface ProductionPreparationItem {
  itemId: string
  recordId: string
  itemType: PreparationItemType
  required: boolean
  requiredKind: '必做' | '选填'
  selectedByMerchandiser: boolean
  selectedAt: string
  sequenceGroup: string
  dependsOnItemIds: string[]
  parallelGroup: string
  status: PreparationItemStatus
  ownerTeam: string
  ownerName: string
  plannedStartAt: string
  plannedFinishAt: string
  actualFinishAt: string
  evidenceType: string
  evidenceSummary: string
  sourceObjectType: string
  sourceObjectNo: string
  sourceHref: string
  overdueHours: number
  remark: string
  patternTaskNo?: string
  patternDesignerId?: string
  patternDesignerName?: string
  patternTeamName?: string
  assignedAt?: string
  completionImageIds?: string[]
  patternFileIds?: string[]
  buyerReviewStatus?: '未提交' | '待确认' | '已通过' | '需调整'
}
```

把 `ProductionPreparationRecord` 扩展为：

```ts
export interface ProductionPreparationOutput {
  outputType: PreparationOutputType
  outputNo: string
  outputHref: string
  outputStatus: PreparationOutputStatus
}

export interface ProductionPreparationRecord {
  recordId: string
  recordNo: string
  spuCode: string
  spuName: string
  imageUrl: string
  selectionName: string
  buyerName: string
  merchandiserName: string
  sourceReason: '销量达标' | '人工加入' | '前置打板' | '新类目'
  craftTags: string[]
  categoryTags: string[]
  largeGoodsThresholdQty: number
  largeGoodsReachedQty: number
  largeGoodsReachedAt: string
  largeGoodsReachedDays: number
  reachedThresholdAt: string
  enteredAt: string
  derivedProductPrepType: ProductPrepType
  confirmedProductPrepType: ProductPrepType
  prepTypeSource: '系统推导' | '人工修正'
  prepTypeConfirmedBy: string
  prepTypeConfirmedAt: string
  prepTypeOverrideReason: string
  productionDemandNo: string
  productionOrderNo: string
  productionOrderHref: string
  techPackVersionLabel: string
  techPackPublishedAt: string
  status: PreparationRecordStatus
  currentBlockerText: string
  expectedFinishAt: string
  closedReason: string
  outputReady: boolean
  outputPublishedAt: string
  outputs: ProductionPreparationOutput[]
  items: ProductionPreparationItem[]
}
```

- [ ] **步骤 2：更新列表常量和 seed 默认值**

替换 `preparationItemTypes`：

```ts
export const preparationItemTypes: PreparationItemType[] = [
  '梭织基码纸样',
  '毛织基码纸样',
  '版衣制作',
  '梭织齐码纸样',
  '毛织齐码纸样',
  '数码印/DTF/DTG花型',
  '染色调色（纱线）',
  '染色调色（面料）',
  '辅料下单',
]
```

在 `createItems()` 默认对象中补：

```ts
requiredKind: seed.required ? '必做' : '选填',
selectedByMerchandiser: seed.required,
selectedAt: seed.required ? seed.plannedStartAt : '',
sequenceGroup: 'parallel',
dependsOnItemIds: [],
parallelGroup: '准备并行',
```

注意：这些默认值要放在 `...seed` 之前，让单条 seed 可覆盖。

- [ ] **步骤 3：更新统计过滤**

在 `hasPatternUploadGap()` 中把花型判断改为新 item type：

```ts
item.itemType === '数码印/DTF/DTG花型'
```

在 `buildProductionPreparationKpis()` 中把 required items 改成已选择项：

```ts
const requiredItems = flattenProductionPreparationItems(activeRecords).filter((item) => item.selectedByMerchandiser)
```

在 `buildMonthlyPreparationCompletionDetails()` 的 filter 条件里把 required 条件替换为：

```ts
item.selectedByMerchandiser === true &&
item.status === '已完成' &&
item.actualFinishAt.startsWith(month)
```

保留 `required` 字段向后兼容已有页面，但统计以 `selectedByMerchandiser` 为准。

- [ ] **步骤 4：让 TypeScript 指出剩余旧类型引用**

运行：

```bash
npm run build
```

预期：失败，报错指向仍使用旧 item type 的页面代码和 mock 数据。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts
git commit -m "feat: extend preparation timing domain model"
```

---

## 任务 3：重建 mock 数据，覆盖四类商品准备类型

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：补产出 helper**

在 `orderHref()` 后增加：

```ts
function outputsFor(recordNo: string, orderNo: string, ready: boolean): ProductionPreparationOutput[] {
  const status: PreparationOutputStatus = ready ? '已生成' : '预计生成'
  const prefix = ready ? '' : '预计'
  return [
    { outputType: '正式技术包', outputNo: `${prefix}TP-${orderNo}`, outputHref: `/fcs/production/orders/${encodeURIComponent(orderNo)}/tech-pack`, outputStatus: status },
    { outputType: '生产单', outputNo: orderNo, outputHref: orderHref(orderNo), outputStatus: status },
    { outputType: '印花单', outputNo: `${prefix}PR-${recordNo.slice(-3)}`, outputHref: '/fcs/craft/printing/orders', outputStatus: status },
    { outputType: '染色单', outputNo: `${prefix}DY-${recordNo.slice(-3)}`, outputHref: '/fcs/craft/dyeing/orders', outputStatus: status },
    { outputType: '辅料采购单', outputNo: `${prefix}AP-${recordNo.slice(-3)}`, outputHref: '/fcs/purchase/accessory-orders', outputStatus: status },
  ]
}
```

- [ ] **步骤 2：重建 12 条记录**

把 `productionPreparationRecords` 替换为 12 条覆盖记录。保留现有图片路径可复用。每类 3 条：

```ts
export const productionPreparationRecords: ProductionPreparationRecord[] = [
  // 纯梭织：进行中，选填花型已选择，预计产出
  {
    recordId: 'prep-202603-001',
    recordNo: 'PREP-202603-001',
    spuCode: 'SPU-WV-260301',
    spuName: '纯梭织通勤衬衫',
    imageUrl: '/mock/products/spring-print-dress.jpg',
    selectionName: '妮娜',
    buyerName: '沈若琳',
    merchandiserName: 'Maya',
    sourceReason: '销量达标',
    craftTags: ['梭织', '数码印'],
    categoryTags: ['梭织'],
    largeGoodsThresholdQty: 300,
    largeGoodsReachedQty: 426,
    largeGoodsReachedAt: '2026-03-01T10:00:00',
    largeGoodsReachedDays: 4,
    reachedThresholdAt: '2026-03-01T10:00:00',
    enteredAt: '2026-03-01T11:20:00',
    derivedProductPrepType: '非烫画&非毛织（纯梭织）',
    confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
    prepTypeSource: '系统推导',
    prepTypeConfirmedBy: 'Maya',
    prepTypeConfirmedAt: '2026-03-01T11:35:00',
    prepTypeOverrideReason: '',
    productionDemandNo: 'PD-202603-001',
    productionOrderNo: 'PO-202603-001',
    productionOrderHref: orderHref('PO-202603-001'),
    techPackVersionLabel: 'TP-v3.2',
    techPackPublishedAt: '2026-03-04T17:40:00',
    status: '进行中',
    currentBlockerText: '花型完成图已上传，等待买手确认',
    expectedFinishAt: '2026-03-05T18:00:00',
    closedReason: '',
    outputReady: false,
    outputPublishedAt: '',
    outputs: outputsFor('PREP-202603-001', 'PO-202603-001', false),
    items: createItems('prep-202603-001', 'PO-202603-001', [
      { itemType: '梭织基码纸样', required: true, requiredKind: '必做', selectedByMerchandiser: true, selectedAt: '2026-03-01T11:35:00', sequenceGroup: '梭织主线', dependsOnItemIds: [], parallelGroup: '梭织基码', status: '已完成', ownerTeam: '版师团队', ownerName: '陈版师', plannedStartAt: '2026-03-01T12:00:00', plannedFinishAt: '2026-03-03T12:00:00', actualFinishAt: '2026-03-02T18:00:00', evidenceType: '纸样文件', evidenceSummary: 'M 码基码纸样已上传' },
      { itemType: '版衣制作', required: true, requiredKind: '必做', selectedByMerchandiser: true, selectedAt: '2026-03-01T11:35:00', sequenceGroup: '梭织主线', dependsOnItemIds: ['prep-202603-001-item-01'], parallelGroup: '版衣', status: '已完成', ownerTeam: '车板团队', ownerName: 'Ayu', plannedStartAt: '2026-03-02T18:00:00', plannedFinishAt: '2026-03-03T18:00:00', actualFinishAt: '2026-03-03T16:30:00', evidenceType: '试版照片', evidenceSummary: '版衣照片已上传' },
      { itemType: '梭织齐码纸样', required: true, requiredKind: '必做', selectedByMerchandiser: true, selectedAt: '2026-03-01T11:35:00', sequenceGroup: '梭织主线', dependsOnItemIds: ['prep-202603-001-item-02'], parallelGroup: '梭织齐码', status: '进行中', ownerTeam: '版师团队', ownerName: '陈版师', plannedStartAt: '2026-03-03T16:30:00', plannedFinishAt: '2026-03-05T16:30:00', actualFinishAt: '', evidenceType: '齐码文件', evidenceSummary: 'S-L 齐码纸样整理中' },
      { itemType: '辅料下单', required: true, requiredKind: '必做', selectedByMerchandiser: true, selectedAt: '2026-03-01T11:35:00', sequenceGroup: '辅料并行', dependsOnItemIds: [], parallelGroup: '辅料', status: '已完成', ownerTeam: '采购团队', ownerName: '武汉辅料组', plannedStartAt: '2026-03-01T12:00:00', plannedFinishAt: '2026-03-03T12:00:00', actualFinishAt: '2026-03-02T15:00:00', evidenceType: '辅料采购单', evidenceSummary: '辅料采购单 AP-301 已同步' },
      { itemType: '数码印/DTF/DTG花型', required: false, requiredKind: '选填', selectedByMerchandiser: true, selectedAt: '2026-03-01T11:36:00', sequenceGroup: '花型并行', dependsOnItemIds: [], parallelGroup: '花型', status: '待确认', ownerTeam: '花型团队', ownerName: '冰冰', plannedStartAt: '2026-03-01T12:00:00', plannedFinishAt: '2026-03-03T12:00:00', actualFinishAt: '', evidenceType: '完成图', evidenceSummary: '完成图已上传，待买手确认', patternTaskNo: 'PAT-202603-001', patternDesignerId: 'designer-bingbing', patternDesignerName: '冰冰', patternTeamName: '中国花型组', completionImageIds: ['img-001'], patternFileIds: ['ai-001'], buyerReviewStatus: '待确认' },
      { itemType: '染色调色（面料）', required: false, requiredKind: '选填', selectedByMerchandiser: false, selectedAt: '', sequenceGroup: '染色并行', dependsOnItemIds: [], parallelGroup: '染色', status: '待判断', ownerTeam: '染色团队', ownerName: '待确认', plannedStartAt: '', plannedFinishAt: '', actualFinishAt: '', evidenceType: '', evidenceSummary: '跟单未选择面料染色调色' },
    ]),
  },
]
```

按下面固定清单补齐 12 条记录，供检查脚本使用：

| recordId | 月份 | 商品准备类型 | 状态 | 选填项 | 产出 | 特殊要求 |
| --- | --- | --- | --- | --- | --- | --- |
| `prep-202603-001` | 2026-03 | 非烫画&非毛织（纯梭织） | 进行中 | 花型已选择、面料染色未选择 | 预计产出 | 用于未全部完成断言 |
| `prep-202603-002` | 2026-03 | 毛织&梭织 | 部分超时 | 纱线染色已选择、面料染色已选择、花型未选择 | 预计产出 | 毛织基码与梭织基码并行，毛织纸样超时 |
| `prep-202603-003` | 2026-03 | 烫画&直喷 | 已完成 | 无 | 正式产出 | 有且仅有 `数码印/DTF/DTG花型`，`outputReady: true` |
| `prep-202603-004` | 2026-03 | 毛织 | 进行中 | 面料染色已选择 | 预计产出 | 系统推导正确，染色进行中 |
| `prep-202603-005` | 2026-03 | 非烫画&非毛织（纯梭织） | 未开始 | 花型未选择、面料染色未选择 | 预计产出 | 刚进入准备，必做项待开始 |
| `prep-202603-006` | 2026-03 | 毛织 | 已完成 | 面料染色未选择 | 正式产出 | 毛织主线全部完成 |
| `prep-202604-001` | 2026-04 | 非烫画&非毛织（纯梭织） | 已完成 | 花型未选择、面料染色未选择 | 正式产出 | 纯梭织全完成样例 |
| `prep-202604-002` | 2026-04 | 毛织 | 部分超时 | 面料染色已选择 | 预计产出 | 面料染色待上传色卡 |
| `prep-202604-003` | 2026-04 | 烫画&直喷 | 进行中 | 无 | 预计产出 | 花型分配 Diah，保留分配/上传检查依赖 |
| `prep-202604-004` | 2026-04 | 毛织&梭织 | 进行中 | 花型已选择、纱线染色未选择、面料染色已选择 | 预计产出 | 系统推导后被跟单人工修正，必须有修正原因 |
| `prep-202604-005` | 2026-04 | 烫画&直喷 | 未开始 | 无 | 预计产出 | 花型待分配 |
| `prep-202604-006` | 2026-04 | 毛织&梭织 | 已完成 | 花型未选择、纱线染色已选择、面料染色已选择 | 正式产出 | 双基码、版衣、双齐码、双染色全部完成 |

每条记录的 `largeGoodsThresholdQty` 必须为 `300`，`largeGoodsReachedQty` 必须大于等于 `300`，并且 `largeGoodsReachedAt` 和 `enteredAt` 都要有值。

- [ ] **步骤 3：更新检查脚本的旧 item type 文案**

把脚本中旧类型替换：

```ts
const baseCodeCount = getCompletedCount(marchStats, '梭织基码纸样') + getCompletedCount(marchStats, '毛织基码纸样')
const fullSizeCount = getCompletedCount(marchStats, '梭织齐码纸样') + getCompletedCount(marchStats, '毛织齐码纸样')
const patternCount = getCompletedCount(marchStats, '数码印/DTF/DTG花型')
const dyeCount = getCompletedCount(marchStats, '染色调色（纱线）') + getCompletedCount(marchStats, '染色调色（面料）')
assert.ok(baseCodeCount > 0, '2026-03 基码完成数量必须大于 0')
assert.ok(fullSizeCount > 0, '2026-03 齐码完成数量必须大于 0')
assert.ok(patternCount > 0, '2026-03 花型完成数量必须大于 0')
assert.ok(dyeCount > 0, '2026-03 染色完成数量必须大于 0')
```

把所有 `itemType: '花型'` 过滤更新为 `itemType: '数码印/DTF/DTG花型'`。

- [ ] **步骤 4：运行数据检查**

运行：

```bash
npm run check:production-preparation-timing
```

预期：数据断言通过，页面新增文案断言失败，失败信息指向 `调整后准备台账 HTML 缺少`。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: add preparation timing mock scenarios"
```

---

## 任务 4：调整台账列表和筛选展示

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：更新导入类型**

在页面 import 中增加：

```ts
type ProductPrepType,
```

把所有 `item.itemType === '花型'` 替换为：

```ts
item.itemType === '数码印/DTF/DTG花型'
```

删除 `requiredItems()` 中重复的第二个 return，并改为按已选择项：

```ts
function requiredItems(record: ProductionPreparationRecord): ProductionPreparationItem[] {
  return record.items.filter((item) => item.selectedByMerchandiser && item.status !== '无需')
}
```

- [ ] **步骤 2：新增展示 helper**

在 `statusTone()` 后增加：

```ts
function productPrepTone(type: ProductPrepType): 'slate' | 'blue' | 'green' | 'amber' | 'red' {
  if (type === '烫画&直喷') return 'blue'
  if (type === '毛织') return 'amber'
  if (type === '毛织&梭织') return 'red'
  return 'green'
}

function outputStatusText(record: ProductionPreparationRecord): string {
  return record.outputReady ? '正式产出已生成' : '预计产出'
}
```

- [ ] **步骤 3：更新列表表头**

在 `renderLedgerTable()` 中把表头替换为：

```ts
${['商品', '商品类型', '选品/买手/跟单', '达到做大货要求', '进入准备时间', '整体状态', '完成进度', '当前卡点', '产出状态', '预计完成时间', '操作'].map((head) => `<th class="px-4 py-3 font-medium">${escapeHtml(head)}</th>`).join('')}
```

空状态 colspan 保持 11。

- [ ] **步骤 4：更新列表行**

在 `renderLedgerRow()` 中替换商品和人员相关单元格为：

```ts
<td class="px-4 py-4">
  <div class="flex min-w-[230px] gap-3">
    <img src="${escapeHtml(record.imageUrl)}" alt="${escapeHtml(record.spuName)}" class="h-14 w-14 rounded-md border object-cover" />
    <div>
      <div class="font-medium text-foreground">${escapeHtml(record.spuName)}</div>
      <div class="mt-1 font-mono text-xs text-muted-foreground">${escapeHtml(record.spuCode)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(record.recordNo)}｜${escapeHtml(record.sourceReason)}</div>
    </div>
  </div>
</td>
<td class="px-4 py-4">
  ${renderBadge(record.confirmedProductPrepType, productPrepTone(record.confirmedProductPrepType))}
  <div class="mt-1 text-xs text-muted-foreground">系统推导：${escapeHtml(record.derivedProductPrepType)}</div>
  <div class="mt-1 text-xs text-muted-foreground">跟单确认：${escapeHtml(record.prepTypeSource)}</div>
</td>
<td class="px-4 py-4">
  <div>选品：${escapeHtml(record.selectionName)}</div>
  <div class="mt-1 text-xs text-muted-foreground">买手：${escapeHtml(record.buyerName)}</div>
  <div class="mt-1 text-xs text-muted-foreground">跟单：${escapeHtml(record.merchandiserName)}</div>
</td>
<td class="px-4 py-4">
  <div>做大货阈值：${record.largeGoodsThresholdQty}</div>
  <div class="mt-1 text-xs text-muted-foreground">达到：${record.largeGoodsReachedQty} 件</div>
  <div class="mt-1 text-xs text-muted-foreground">用时：${record.largeGoodsReachedDays} 天</div>
</td>
<td class="px-4 py-4 whitespace-nowrap">
  ${escapeHtml(formatDateTime(record.enteredAt))}
  <div class="mt-1 text-xs text-muted-foreground">达到做大货要求：${escapeHtml(formatDateTime(record.largeGoodsReachedAt))}</div>
</td>
```

把产出状态列替换原“最早超时项”列：

```ts
<td class="px-4 py-4">
  ${renderBadge(outputStatusText(record), record.outputReady ? 'green' : 'amber')}
  ${
    overdueItem
      ? `<div class="mt-1 text-xs text-red-600">最早超时：${escapeHtml(overdueItem.itemType)}</div>`
      : '<div class="mt-1 text-xs text-muted-foreground">暂无超时</div>'
  }
</td>
```

- [ ] **步骤 5：运行页面检查**

运行：

```bash
npm run check:production-preparation-timing
```

预期：列表新增文案相关断言通过，详情产出断言失败，失败信息指向 `未全部完成记录必须只展示预计产出` 或 `全部完成记录必须展示正式产出`。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "feat: show preparation source and type in ledger"
```

---

## 任务 5：调整详情抽屉，展示确认、准备项和产出

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`

- [ ] **步骤 1：替换详情抽屉结构**

在 `renderDetailDrawer()` 中把 body 顺序改为：

```ts
${renderSourceInfo(record)}
${renderProductTypeConfirmation(record)}
${renderPreparationSelection(record)}
${renderTimeline(record)}
<section id="prep-items" class="rounded-xl border bg-card p-4">
  <div class="mb-4 flex items-center justify-between">
    <h3 class="font-semibold">准备项明细卡片</h3>
    <span class="text-xs text-muted-foreground">已选择 ${requiredItems(record).length} 项</span>
  </div>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
    ${record.items.map((item) => renderItemCard(record, item, item.itemId === activeItemId, month, params)).join('')}
  </div>
</section>
${action === 'assign' && activeItem ? renderAssignPanel(record, activeItem, params, month) : ''}
${action === 'upload' && activeItem ? renderUploadPanel(record, activeItem, params, month) : ''}
${renderPreparationOutputs(record)}
${renderOperationLogs(record)}
```

保留 `renderBasicInfo()` 可删除或不再调用。

- [ ] **步骤 2：新增来源信息区块**

新增：

```ts
function renderSourceInfo(record: ProductionPreparationRecord): string {
  const fields = [
    ['选品', record.selectionName],
    ['买手', record.buyerName],
    ['跟单', record.merchandiserName],
    ['做大货阈值', `${record.largeGoodsThresholdQty} 件`],
    ['达到数量', `${record.largeGoodsReachedQty} 件`],
    ['达到做大货要求', formatDateTime(record.largeGoodsReachedAt)],
    ['达到天数', `${record.largeGoodsReachedDays} 天`],
    ['进入准备时间', formatDateTime(record.enteredAt)],
  ]
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">来源信息</h3>
      <div class="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        ${fields.map(([label, value]) => `
          <div class="rounded-lg bg-muted/40 p-3">
            <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
            <div class="mt-1 font-medium">${escapeHtml(value)}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `
}
```

- [ ] **步骤 3：新增商品类型确认区块**

新增：

```ts
function renderTagList(tags: string[]): string {
  return tags.length
    ? tags.map((tag) => `<span class="rounded-full bg-muted px-2 py-0.5 text-xs">${escapeHtml(tag)}</span>`).join('')
    : '<span class="text-xs text-muted-foreground">无</span>'
}

function renderProductTypeConfirmation(record: ProductionPreparationRecord): string {
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">商品类型确认</h3>
        ${renderBadge(record.prepTypeSource, record.prepTypeSource === '人工修正' ? 'amber' : 'green')}
      </div>
      <div class="grid gap-3 text-sm md:grid-cols-2">
        <div class="rounded-lg bg-muted/40 p-3"><div class="text-xs text-muted-foreground">工艺标签</div><div class="mt-2 flex flex-wrap gap-1">${renderTagList(record.craftTags)}</div></div>
        <div class="rounded-lg bg-muted/40 p-3"><div class="text-xs text-muted-foreground">品类标签</div><div class="mt-2 flex flex-wrap gap-1">${renderTagList(record.categoryTags)}</div></div>
        <div class="rounded-lg bg-muted/40 p-3"><div class="text-xs text-muted-foreground">系统推导</div><div class="mt-1 font-medium">${escapeHtml(record.derivedProductPrepType)}</div></div>
        <div class="rounded-lg bg-muted/40 p-3"><div class="text-xs text-muted-foreground">跟单确认</div><div class="mt-1 font-medium">${escapeHtml(record.confirmedProductPrepType)}</div></div>
        <div class="rounded-lg bg-muted/40 p-3"><div class="text-xs text-muted-foreground">确认人</div><div class="mt-1 font-medium">${escapeHtml(record.prepTypeConfirmedBy)}</div></div>
        <div class="rounded-lg bg-muted/40 p-3"><div class="text-xs text-muted-foreground">确认时间</div><div class="mt-1 font-medium">${escapeHtml(formatDateTime(record.prepTypeConfirmedAt))}</div></div>
      </div>
      ${record.prepTypeOverrideReason ? `<p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">修正原因：${escapeHtml(record.prepTypeOverrideReason)}</p>` : ''}
    </section>
  `
}
```

- [ ] **步骤 4：新增准备项确认区块**

新增：

```ts
function renderPreparationSelection(record: ProductionPreparationRecord): string {
  const required = record.items.filter((item) => item.requiredKind === '必做')
  const optional = record.items.filter((item) => item.requiredKind === '选填')
  const renderSelectionItem = (item: ProductionPreparationItem) => `
    <div class="flex items-start justify-between gap-3 rounded-lg border bg-background p-3">
      <div>
        <div class="font-medium">${escapeHtml(item.itemType)}</div>
        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sequenceGroup)}｜${escapeHtml(item.parallelGroup)}</div>
        <div class="mt-1 text-xs text-muted-foreground">确认时间：${escapeHtml(item.selectedAt ? formatDateTime(item.selectedAt) : '未选择')}</div>
      </div>
      ${renderBadge(item.requiredKind === '必做' ? '必做' : item.selectedByMerchandiser ? '已选择' : '未选择', item.requiredKind === '必做' || item.selectedByMerchandiser ? 'green' : 'slate')}
    </div>
  `
  return `
    <section class="rounded-xl border bg-card p-4">
      <h3 class="mb-3 font-semibold">准备项确认</h3>
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <div class="mb-2 text-sm font-medium">必做项</div>
          <div class="space-y-2">${required.map(renderSelectionItem).join('')}</div>
        </div>
        <div>
          <div class="mb-2 text-sm font-medium">选填项</div>
          <div class="space-y-2">${optional.map(renderSelectionItem).join('') || '<div class="rounded-lg border bg-background p-3 text-sm text-muted-foreground">无选填项</div>'}</div>
        </div>
      </div>
    </section>
  `
}
```

- [ ] **步骤 5：新增产出区块**

用 `renderPreparationOutputs()` 替代 `renderRelatedObjects()`：

```ts
function renderPreparationOutputs(record: ProductionPreparationRecord): string {
  const title = record.outputReady ? '正式产出' : '预计产出'
  const missingItems = requiredItems(record).filter((item) => item.status !== '已完成')
  return `
    <section class="rounded-xl border bg-card p-4">
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-semibold">${escapeHtml(title)}</h3>
        ${renderBadge(record.outputReady ? '已生成' : '预计生成', record.outputReady ? 'green' : 'amber')}
      </div>
      ${record.outputReady ? `<p class="mb-3 text-sm text-muted-foreground">统一生成时间：${escapeHtml(formatDateTime(record.outputPublishedAt))}</p>` : ''}
      ${!record.outputReady && missingItems.length ? `<p class="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">仍需完成：${escapeHtml(missingItems.map((item) => item.itemType).join('、'))}</p>` : ''}
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        ${record.outputs.map((output) => `
          <button type="button" class="rounded-lg border bg-background p-3 text-left hover:bg-muted" data-nav="${escapeHtml(output.outputHref)}">
            <div class="text-xs text-muted-foreground">${escapeHtml(output.outputType)}</div>
            <div class="mt-1 font-medium">${escapeHtml(output.outputNo)}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(output.outputStatus)}</div>
          </button>
        `).join('')}
      </div>
    </section>
  `
}
```

- [ ] **步骤 6：运行详情检查**

运行：

```bash
npm run check:production-preparation-timing
```

预期：新增详情和产出断言通过。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/production/preparation-timing.ts
git commit -m "feat: show preparation confirmation and outputs"
```

---

## 任务 6：调整统计展示、CSV 和兼容旧花型操作

**文件：**
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：新增统计分组 helper**

在 `renderStatsSummary()` 前增加：

```ts
function getGroupedCompletedCount(stats: StatsTableRow[], itemTypes: PreparationItemType[]): number {
  return itemTypes.reduce((sum, itemType) => sum + (stats.find((row) => row.itemType === itemType)?.completedCount ?? 0), 0)
}
```

- [ ] **步骤 2：调整统计卡片**

在 `renderStatsSummary()` 中替换 `cards` 的基码、齐码、花型、染色统计：

```ts
const cards = [
  ['本月完成准备项', details.length, '项'],
  ['完成基码', getGroupedCompletedCount(stats, ['梭织基码纸样', '毛织基码纸样']), '项'],
  ['完成齐码', getGroupedCompletedCount(stats, ['梭织齐码纸样', '毛织齐码纸样']), '项'],
  ['完成花型', getGroupedCompletedCount(stats, ['数码印/DTF/DTG花型']), '项'],
  ['完成染色', getGroupedCompletedCount(stats, ['染色调色（纱线）', '染色调色（面料）']), '项'],
  ['按时完成', onTime, '项'],
  ['超时完成', overdue, '项'],
  ['平均耗时', averageHours, '小时'],
]
```

- [ ] **步骤 3：调整 CSV 明细字段**

在 `buildDetailCsvRows()` 中加入商品类型和选择状态字段：

```ts
[
  '统计月份',
  '准备记录编号',
  'SPU',
  '商品名',
  '生产单号',
  '商品类型',
  '买手',
  '跟单',
  '准备项',
  '必做/选填',
  '责任团队',
  '责任人',
  '计划完成时间',
  '实际完成时间',
  '是否超时',
  '证据摘要',
]
```

行数据增加：

```ts
row.confirmedProductPrepType,
row.requiredKind,
```

为此需要在 `FlattenedPreparationItem` 中补 `confirmedProductPrepType`，任务 2 没补则在这里补：

```ts
confirmedProductPrepType: ProductPrepType
```

并在 `flattenProductionPreparationItems()` map 中补：

```ts
confirmedProductPrepType: record.confirmedProductPrepType,
```

- [ ] **步骤 4：保留花型分配上传行为**

确认这些位置都使用新花型 item type：

```ts
record.items.find((item) => item.itemType === '数码印/DTF/DTG花型')
activeItem ? renderAssignPanel(record, activeItem, params, month) : ''
activeItem ? renderUploadPanel(record, activeItem, params, month) : ''
```

上传 mock 中保留：

```ts
status: submittedBuyerReviewStatus === '已通过' ? '已完成' : '待确认',
selectedByMerchandiser: true,
required: true,
```

- [ ] **步骤 5：运行统计检查**

运行：

```bash
npm run check:production-preparation-timing
```

预期：PASS，输出 `production preparation timing checks passed`。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/production-preparation-timing.ts src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "fix: align preparation timing stats"
```

---

## 任务 7：完整验证和收尾

**文件：**
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`src/pages/production/preparation-timing.ts`
- 修改：`scripts/check-production-preparation-timing.ts`

- [ ] **步骤 1：运行专项检查**

```bash
npm run check:production-preparation-timing
```

预期：

```text
production preparation timing checks passed
```

- [ ] **步骤 2：运行菜单检查**

```bash
npm run check:menu-routes
```

预期包含：

```text
PASS menu route integrity
```

- [ ] **步骤 3：运行构建**

```bash
npm run build
```

预期包含：

```text
✓ built
```

- [ ] **步骤 4：检查页面源码禁用项**

```bash
rg -n "PENDING|DONE|IN_PROGRESS|CANCELLED|ON_HOLD" src/pages/production/preparation-timing.ts src/data/fcs/production-preparation-timing.ts
```

预期：无输出。

```bash
rg -n "fetch\\(|axios|localStorage|zustand|createRoot|React" src/pages/production/preparation-timing.ts src/data/fcs/production-preparation-timing.ts
```

预期：无输出。

- [ ] **步骤 5：同步 CodeGraph**

```bash
codegraph sync
codegraph status
```

预期包含：

```text
✓ Index is up to date
```

- [ ] **步骤 6：查看最终 diff**

```bash
git diff --stat HEAD
git status -sb
```

预期：只包含本计划范围内三个实现文件，工作区干净或仅有待提交实现改动。

- [ ] **步骤 7：最终 Commit**

如果任务 6 后仍有收尾改动：

```bash
git add src/data/fcs/production-preparation-timing.ts src/pages/production/preparation-timing.ts scripts/check-production-preparation-timing.ts
git commit -m "chore: verify preparation timing adjustment"
```

如果没有收尾改动，不创建空提交。
