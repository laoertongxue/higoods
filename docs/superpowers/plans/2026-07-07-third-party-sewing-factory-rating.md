# 三方车缝工厂评级与派单结算拦截实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有原型中增加三方车缝工厂评级展示、车缝派单风险提示/拦截、黑名单禁止发起结算，并保留历史账本可见。

**架构：** 新增一份轻量评级 Mock 数据模块，页面只读取评级快照，不引入真实后端、真实评分任务或复杂状态管理。工厂档案负责解释评级，车缝分配工作台负责派单前拦截，对账单生成页负责结算前拦截。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `scripts/check-*.ts` 检查脚本。

---

## 文件结构

- 创建：`src/data/fcs/third-party-factory-rating.ts`
  - 定义评级快照、履约明细、90 天时效摘要和少量查询/判断函数。
  - 只服务本期原型，不建设仓储层或评分引擎。
- 修改：`src/pages/factory-profile.ts`
  - 在工厂档案中增加“评级与派单风控”区块。
- 修改：`src/pages/sewing-dispatch-workbench.ts`
  - 在派单弹窗工厂选择中展示评级，拦截黑名单/考核中工厂，B 级要求确认。
- 修改：`src/pages/statements.ts`
  - 在新建对账单页对黑名单工厂禁用生成动作并展示提示。
- 创建：`scripts/check-third-party-factory-rating.ts`
  - 覆盖评级数据、页面文案、派单拦截、结算拦截的静态和渲染检查。
- 修改：`package.json`
  - 增加 `check:third-party-factory-rating`。
- 创建：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`
  - 按项目治理要求记录本次原型审查。

---

### 任务 1：新增三方车缝工厂评级 Mock 数据

**文件：**
- 创建：`src/data/fcs/third-party-factory-rating.ts`
- 创建：`scripts/check-third-party-factory-rating.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写失败检查脚本**

创建 `scripts/check-third-party-factory-rating.ts`：

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  getThirdPartyFactoryRatingSnapshot,
  isThirdPartyFactorySettlementBlocked,
  listThirdPartyFactoryRatingSnapshots,
} from '../src/data/fcs/third-party-factory-rating.ts'

const snapshots = listThirdPartyFactoryRatingSnapshots()
assert.ok(snapshots.length >= 5, '至少需要 5 个三方车缝评级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'S'), '缺少 S 级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'A'), '缺少 A 级样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'B'), '缺少 B 级黄牌样例')
assert.ok(snapshots.some((item) => item.currentGrade === 'C' && item.cooperationStatusLabel === '黑名单'), '缺少 C 级黑名单样例')
assert.ok(snapshots.some((item) => item.cooperationStatusLabel === '考核中' && item.firstTrialLimitQty === 300), '缺少考核中小厂 300 件上限样例')

const blacklisted = snapshots.find((item) => item.cooperationStatusLabel === '黑名单')
assert.ok(blacklisted, '缺少黑名单工厂')
assert.equal(isThirdPartyFactorySettlementBlocked(blacklisted.factoryId), true, '黑名单工厂必须禁止发起结算')
assert.equal(getThirdPartyFactoryRatingSnapshot(blacklisted.factoryId)?.dispatchPolicyLabel.includes('禁止派单'), true, '黑名单工厂必须禁止派单')

const bGrade = snapshots.find((item) => item.currentGrade === 'B')
assert.ok(bGrade, '缺少 B 级工厂')
assert.equal(isThirdPartyFactorySettlementBlocked(bGrade.factoryId), false, 'B 级工厂不能禁止结算')
assert.ok(bGrade.dispatchPolicyLabel.includes('小单'), 'B 级工厂必须提示小单、简单单')

const source = readFileSync(new URL('../src/data/fcs/third-party-factory-rating.ts', import.meta.url), 'utf8')
assert.ok(source.includes('近 90 天仅用于生产时效查看'), '缺少 90 天非考核期说明')
assert.ok(!source.includes('TRIAL') && !source.includes('BLACKLISTED'), '页面数据不应直接暴露英文状态码')

console.log('check:third-party-factory-rating passed')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-third-party-factory-rating.ts
```

预期：FAIL，报错找不到 `src/data/fcs/third-party-factory-rating.ts`。

- [ ] **步骤 3：新增最小评级数据模块**

创建 `src/data/fcs/third-party-factory-rating.ts`：

```ts
export type FactoryRatingGrade = 'S' | 'A' | 'B' | 'C' | '未评级'
export type FactoryScaleLabel = '大型工厂' | '小型工厂'
export type FactoryCooperationStatusLabel = '考核中' | '正常合作' | '黑名单'

export interface FactoryRatingSnapshot {
  factoryId: string
  factoryName: string
  factoryTierLabel: '第三方工厂'
  factoryTypeLabel: '车缝工厂'
  machineCount: number
  factoryScaleLabel: FactoryScaleLabel
  cooperationStatusLabel: FactoryCooperationStatusLabel
  currentGrade: FactoryRatingGrade
  totalScore: number
  deliveryPenaltyScore: number
  qualityPenaltyScore: number
  manualPenaltyScore: number
  firstTrialLimitQty: number
  dispatchPolicyLabel: string
  settlementPolicyLabel: string
  latestReason: string
  blacklistSettlementBlocked: boolean
}

export interface FactoryRatingPerformanceRecord {
  recordId: string
  factoryId: string
  productionOrderNo: string
  orderTypeLabel: '试产单' | '常规单'
  dispatchDate: string
  planDeliveryDate: string
  actualDeliveryDate: string
  delayDays: number
  dispatchQty: number
  reworkQty: number
  defectQty: number
  factoryResponsibleDefectQty: number
  deliveryPenaltyScore: number
  qualityPenaltyScore: number
  manualPenaltyScore: number
  resultLabel: string
}

export interface FactoryTimingSummary {
  factoryId: string
  periodLabel: string
  orderCount: number
  averageDelayDays: number
  onTimeRateLabel: string
  defectRateLabel: string
  note: string
}

export const thirdPartyFactoryRatingSnapshots: FactoryRatingSnapshot[] = [
  {
    factoryId: 'ID-FAC-0021',
    factoryName: 'CV Micro Sewing Jakarta Pusat',
    factoryTierLabel: '第三方工厂',
    factoryTypeLabel: '车缝工厂',
    machineCount: 60,
    factoryScaleLabel: '大型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'S',
    totalScore: 94,
    deliveryPenaltyScore: 0,
    qualityPenaltyScore: 4,
    manualPenaltyScore: 2,
    firstTrialLimitQty: 1000,
    dispatchPolicyLabel: '优先合作，可正常派单',
    settlementPolicyLabel: '可发起结算',
    latestReason: '近批次准时交付，后道质检归责不良率低。',
    blacklistSettlementBlocked: false,
  },
  {
    factoryId: 'ID-FAC-0022',
    factoryName: 'CV Micro Sewing Bandung Utara',
    factoryTierLabel: '第三方工厂',
    factoryTypeLabel: '车缝工厂',
    machineCount: 38,
    factoryScaleLabel: '大型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'A',
    totalScore: 82,
    deliveryPenaltyScore: 5,
    qualityPenaltyScore: 10,
    manualPenaltyScore: 3,
    firstTrialLimitQty: 1000,
    dispatchPolicyLabel: '标准合作，可正常派单',
    settlementPolicyLabel: '可发起结算',
    latestReason: '有轻微延期，质量表现仍在可接受范围。',
    blacklistSettlementBlocked: false,
  },
  {
    factoryId: 'ID-FAC-0023',
    factoryName: 'CV Sinar Sewing Depok',
    factoryTierLabel: '第三方工厂',
    factoryTypeLabel: '车缝工厂',
    machineCount: 26,
    factoryScaleLabel: '小型工厂',
    cooperationStatusLabel: '正常合作',
    currentGrade: 'B',
    totalScore: 68,
    deliveryPenaltyScore: 15,
    qualityPenaltyScore: 12,
    manualPenaltyScore: 5,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '黄牌提醒，建议只分配小单、简单单',
    settlementPolicyLabel: '可发起结算',
    latestReason: '近期有延期和返工，继续合作需人工判断。',
    blacklistSettlementBlocked: false,
  },
  {
    factoryId: 'ID-FAC-0024',
    factoryName: 'PT Garuda Sewing Bekasi',
    factoryTierLabel: '第三方工厂',
    factoryTypeLabel: '车缝工厂',
    machineCount: 45,
    factoryScaleLabel: '大型工厂',
    cooperationStatusLabel: '黑名单',
    currentGrade: 'C',
    totalScore: 52,
    deliveryPenaltyScore: 25,
    qualityPenaltyScore: 18,
    manualPenaltyScore: 5,
    firstTrialLimitQty: 1000,
    dispatchPolicyLabel: '黑名单工厂，禁止派单',
    settlementPolicyLabel: '禁止发起结算',
    latestReason: '严重延期且后道质检归责不良率高，已拉黑。',
    blacklistSettlementBlocked: true,
  },
  {
    factoryId: 'ID-FAC-0025',
    factoryName: 'CV Baru Sewing Tangerang',
    factoryTierLabel: '第三方工厂',
    factoryTypeLabel: '车缝工厂',
    machineCount: 18,
    factoryScaleLabel: '小型工厂',
    cooperationStatusLabel: '考核中',
    currentGrade: '未评级',
    totalScore: 0,
    deliveryPenaltyScore: 0,
    qualityPenaltyScore: 0,
    manualPenaltyScore: 0,
    firstTrialLimitQty: 300,
    dispatchPolicyLabel: '考核中，只能接试产单',
    settlementPolicyLabel: '试单完成后按账本处理',
    latestReason: '新合作工厂，考核期以首单接单到完成交出为准。',
    blacklistSettlementBlocked: false,
  },
]

export const thirdPartyFactoryTimingSummaries: FactoryTimingSummary[] = thirdPartyFactoryRatingSnapshots.map((item) => ({
  factoryId: item.factoryId,
  periodLabel: '近 90 天',
  orderCount: item.cooperationStatusLabel === '考核中' ? 1 : 6,
  averageDelayDays: item.deliveryPenaltyScore > 0 ? Math.round(item.deliveryPenaltyScore / 5) : 0,
  onTimeRateLabel: item.currentGrade === 'C' ? '52%' : item.currentGrade === 'B' ? '76%' : '92%',
  defectRateLabel: item.currentGrade === 'C' ? '18%' : item.currentGrade === 'B' ? '12%' : '4%',
  note: '近 90 天仅用于生产时效查看，不代表新工厂考核期。',
}))

export const thirdPartyFactoryPerformanceRecords: FactoryRatingPerformanceRecord[] = [
  {
    recordId: 'RATING-PERF-001',
    factoryId: 'ID-FAC-0024',
    productionOrderNo: 'PO-202603-0008',
    orderTypeLabel: '常规单',
    dispatchDate: '2026-03-20',
    planDeliveryDate: '2026-04-05',
    actualDeliveryDate: '2026-04-10',
    delayDays: 5,
    dispatchQty: 300,
    reworkQty: 30,
    defectQty: 30,
    factoryResponsibleDefectQty: 60,
    deliveryPenaltyScore: 25,
    qualityPenaltyScore: 20,
    manualPenaltyScore: 5,
    resultLabel: '延期 5 天，后道质检归责不良率 20%。',
  },
]

export function listThirdPartyFactoryRatingSnapshots(): FactoryRatingSnapshot[] {
  return thirdPartyFactoryRatingSnapshots
}

export function getThirdPartyFactoryRatingSnapshot(factoryId?: string): FactoryRatingSnapshot | null {
  if (!factoryId) return null
  return thirdPartyFactoryRatingSnapshots.find((item) => item.factoryId === factoryId) ?? null
}

export function listThirdPartyFactoryPerformanceRecords(factoryId: string): FactoryRatingPerformanceRecord[] {
  return thirdPartyFactoryPerformanceRecords.filter((item) => item.factoryId === factoryId)
}

export function getThirdPartyFactoryTimingSummary(factoryId: string): FactoryTimingSummary | null {
  return thirdPartyFactoryTimingSummaries.find((item) => item.factoryId === factoryId) ?? null
}

export function isThirdPartyFactorySettlementBlocked(factoryId?: string): boolean {
  return getThirdPartyFactoryRatingSnapshot(factoryId)?.blacklistSettlementBlocked === true
}
```

- [ ] **步骤 4：注册检查脚本**

修改 `package.json` 的 `scripts`，增加一行：

```json
"check:third-party-factory-rating": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-third-party-factory-rating.ts"
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：PASS，输出 `check:third-party-factory-rating passed`。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/third-party-factory-rating.ts scripts/check-third-party-factory-rating.ts package.json
git commit -m "feat: add third-party factory rating mock data"
```

---

### 任务 2：工厂档案页增加评级与派单风控区块

**文件：**
- 修改：`src/pages/factory-profile.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：扩展检查脚本**

在 `scripts/check-third-party-factory-rating.ts` 末尾 `console.log` 前加入：

```ts
const factoryProfileSource = readFileSync(new URL('../src/pages/factory-profile.ts', import.meta.url), 'utf8')
assert.ok(factoryProfileSource.includes('评级与派单风控'), '工厂档案缺少评级与派单风控区块')
assert.ok(factoryProfileSource.includes('getThirdPartyFactoryRatingSnapshot'), '工厂档案未读取评级快照')
assert.ok(factoryProfileSource.includes('近 90 天仅用于生产时效查看'), '工厂档案缺少 90 天非考核期说明')
assert.ok(factoryProfileSource.includes('不能派单，不能发起结算'), '工厂档案缺少黑名单双拦截提示')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：FAIL，报错 `工厂档案缺少评级与派单风控区块`。

- [ ] **步骤 3：导入评级数据**

在 `src/pages/factory-profile.ts` 顶部导入：

```ts
import {
  getThirdPartyFactoryRatingSnapshot,
  getThirdPartyFactoryTimingSummary,
  listThirdPartyFactoryPerformanceRecords,
  type FactoryRatingSnapshot,
} from '../data/fcs/third-party-factory-rating.ts'
```

- [ ] **步骤 4：新增渲染函数**

在 `renderTestFactoryBadge` 附近增加：

```ts
function renderFactoryRatingPanel(factory: Factory): string {
  const rating = getThirdPartyFactoryRatingSnapshot(factory.id)
  if (!rating) return ''
  const timing = getThirdPartyFactoryTimingSummary(factory.id)
  const records = listThirdPartyFactoryPerformanceRecords(factory.id).slice(0, 5)
  const riskClass = rating.cooperationStatusLabel === '黑名单'
    ? 'border-red-200 bg-red-50 text-red-800'
    : rating.currentGrade === 'B'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800'

  return `
    <section class="rounded-lg border bg-card p-4 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">评级与派单风控</h2>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(rating.latestReason)}</p>
        </div>
        <span class="rounded-full border px-3 py-1 text-sm font-medium ${riskClass}">${escapeHtml(rating.currentGrade)} · ${escapeHtml(rating.cooperationStatusLabel)}</span>
      </div>
      ${rating.cooperationStatusLabel === '黑名单' ? '<div class="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">该工厂已拉黑，不能派单，不能发起结算。历史账款需主管处理。</div>' : ''}
      <div class="mt-4 grid gap-3 md:grid-cols-4">
        ${renderRatingMetric('车位与规模', `${rating.machineCount} 个车位 · ${rating.factoryScaleLabel}`)}
        ${renderRatingMetric('试单上限', `${rating.firstTrialLimitQty.toLocaleString('zh-CN')} 件`)}
        ${renderRatingMetric('派单策略', rating.dispatchPolicyLabel)}
        ${renderRatingMetric('结算策略', rating.settlementPolicyLabel)}
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-4">
        ${renderRatingMetric('当前总分', `${rating.totalScore || '未评级'}`)}
        ${renderRatingMetric('交期扣分', `${rating.deliveryPenaltyScore} 分`)}
        ${renderRatingMetric('质量扣分', `${rating.qualityPenaltyScore} 分`)}
        ${renderRatingMetric('人工扣分', `${rating.manualPenaltyScore} 分`)}
      </div>
      ${timing ? `<div class="mt-4 rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">${escapeHtml(timing.note)} 派单 ${timing.orderCount} 单，准时率 ${escapeHtml(timing.onTimeRateLabel)}，不良率 ${escapeHtml(timing.defectRateLabel)}。</div>` : ''}
      ${records.length ? `<div class="mt-4 overflow-hidden rounded-md border"><table class="w-full text-sm"><thead class="bg-muted/50 text-muted-foreground"><tr><th class="px-3 py-2 text-left">生产单</th><th class="px-3 py-2 text-left">交期</th><th class="px-3 py-2 text-left">数量</th><th class="px-3 py-2 text-left">结果</th></tr></thead><tbody>${records.map((record) => `<tr class="border-t"><td class="px-3 py-2">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.orderTypeLabel)}</td><td class="px-3 py-2">延期 ${record.delayDays} 天</td><td class="px-3 py-2">${record.dispatchQty.toLocaleString('zh-CN')} 件</td><td class="px-3 py-2">${escapeHtml(record.resultLabel)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </section>
  `
}

function renderRatingMetric(label: string, value: string): string {
  return `
    <div class="rounded-md border bg-background p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-medium">${escapeHtml(value)}</div>
    </div>
  `
}
```

- [ ] **步骤 5：挂载评级区块**

在 `renderFactoryProfilePage()` 中找到工厂详情主体卡片区域，将以下调用放在基础信息和能力信息附近：

```ts
${renderFactoryRatingPanel(factory)}
```

- [ ] **步骤 6：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/factory-profile.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: show third-party factory rating in profile"
```

---

### 任务 3：车缝分配工作台增加派单拦截

**文件：**
- 修改：`src/pages/sewing-dispatch-workbench.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：扩展检查脚本**

在 `scripts/check-third-party-factory-rating.ts` 的页面检查区域加入：

```ts
const sewingDispatchSource = readFileSync(new URL('../src/pages/sewing-dispatch-workbench.ts', import.meta.url), 'utf8')
assert.ok(sewingDispatchSource.includes('getThirdPartyFactoryRatingSnapshot'), '车缝分配工作台未读取评级快照')
assert.ok(sewingDispatchSource.includes('dispatchRiskConfirmed'), '车缝分配工作台缺少 B 级确认状态')
assert.ok(sewingDispatchSource.includes('该工厂为黄牌工厂，建议只分配小单、简单单'), '车缝分配缺少 B 级黄牌提醒')
assert.ok(sewingDispatchSource.includes('该工厂已拉黑，不能派单。请更换工厂。'), '车缝分配缺少黑名单派单拦截')
assert.ok(sewingDispatchSource.includes('该工厂还在试用期，只能接试产单。'), '车缝分配缺少考核中拦截')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：FAIL，报错 `车缝分配工作台未读取评级快照`。

- [ ] **步骤 3：扩展页面状态**

在 `src/pages/sewing-dispatch-workbench.ts` 导入评级函数：

```ts
import { getThirdPartyFactoryRatingSnapshot } from '../data/fcs/third-party-factory-rating.ts'
```

给 `SewingDispatchWorkbenchState` 增加字段：

```ts
dispatchRiskConfirmed: boolean
```

给 `state` 初始值增加：

```ts
dispatchRiskConfirmed: false,
```

- [ ] **步骤 4：新增工厂风险提示渲染**

在 `renderDispatchAcceptanceSlaPreview` 附近增加：

```ts
function renderDispatchFactoryRisk(factoryId: string): string {
  const rating = getThirdPartyFactoryRatingSnapshot(factoryId)
  if (!rating) return ''
  if (rating.cooperationStatusLabel === '黑名单') {
    return '<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">该工厂已拉黑，不能派单。请更换工厂。</div>'
  }
  if (rating.cooperationStatusLabel === '考核中') {
    return '<div class="rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-sm text-orange-700">该工厂还在试用期，只能接试产单。</div>'
  }
  if (rating.currentGrade === 'B') {
    return `
      <label class="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        <input type="checkbox" data-sewing-dispatch-field="dispatchRiskConfirmed" ${state.dispatchRiskConfirmed ? 'checked' : ''} />
        <span>该工厂为黄牌工厂，建议只分配小单、简单单。请确认已人工判断。</span>
      </label>
    `
  }
  return `<div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">${escapeHtml(rating.currentGrade)} 级 · ${escapeHtml(rating.dispatchPolicyLabel)}</div>`
}
```

- [ ] **步骤 5：在工厂下拉中展示评级并禁用高风险工厂**

替换 `renderDispatchDialog` 中 `factories.map` 的 option 渲染逻辑：

```ts
${factories.map((factory) => {
  const rating = getThirdPartyFactoryRatingSnapshot(factory.id)
  const disabled = rating?.cooperationStatusLabel === '黑名单' || rating?.cooperationStatusLabel === '考核中'
  const label = rating ? `${factory.name} · ${rating.currentGrade} · ${rating.dispatchPolicyLabel}` : factory.name
  return `<option value="${escapeHtml(factory.id)}" ${state.dispatchFactoryId === factory.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</option>`
}).join('')}
```

在 SLA 预览前加入：

```ts
${state.dispatchActionType === '直接派单' ? renderDispatchFactoryRisk(state.dispatchFactoryId) : ''}
```

- [ ] **步骤 6：处理 B 级确认输入**

在字段变更处理函数中加入：

```ts
if (field === 'dispatchRiskConfirmed') {
  state.dispatchRiskConfirmed = (node as HTMLInputElement).checked
  requestRender()
  return true
}
```

在 `dispatchFactoryId` 变更时重置：

```ts
state.dispatchRiskConfirmed = false
```

- [ ] **步骤 7：提交派单前拦截**

在 `handleSewingDispatchWorkbenchEvent` 的创建草稿前加入：

```ts
const rating = getThirdPartyFactoryRatingSnapshot(state.dispatchFactoryId)
if (rating?.cooperationStatusLabel === '黑名单') {
  state.dispatchError = '该工厂已拉黑，不能派单。请更换工厂。'
  requestRender()
  return true
}
if (rating?.cooperationStatusLabel === '考核中') {
  state.dispatchError = '该工厂还在试用期，只能接试产单。'
  requestRender()
  return true
}
if (rating?.currentGrade === 'B' && !state.dispatchRiskConfirmed) {
  state.dispatchError = '该工厂为黄牌工厂，建议只分配小单、简单单。请确认已人工判断。'
  requestRender()
  return true
}
```

创建成功后，如果是 B 级：

```ts
state.feedbackMessage = rating?.currentGrade === 'B' ? '已记录黄牌工厂派单确认。' : state.feedbackMessage
```

- [ ] **步骤 8：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:sewing-dispatch-workbench
```

预期：两个命令 PASS。

- [ ] **步骤 9：Commit**

```bash
git add src/pages/sewing-dispatch-workbench.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: block risky third-party sewing dispatch"
```

---

### 任务 4：对账单生成页增加黑名单结算拦截

**文件：**
- 修改：`src/pages/statements.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：扩展检查脚本**

在 `scripts/check-third-party-factory-rating.ts` 加入：

```ts
const statementsSource = readFileSync(new URL('../src/pages/statements.ts', import.meta.url), 'utf8')
assert.ok(statementsSource.includes('isThirdPartyFactorySettlementBlocked'), '对账单页面未判断黑名单结算拦截')
assert.ok(statementsSource.includes('该工厂已拉黑，不能发起结算。请主管处理历史账款。'), '对账单页面缺少黑名单结算提示')
assert.ok(statementsSource.includes('blacklistSettlementBlocked'), '对账单页面缺少黑名单结算阻断变量')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：FAIL，报错 `对账单页面未判断黑名单结算拦截`。

- [ ] **步骤 3：导入结算拦截函数**

在 `src/pages/statements.ts` 导入：

```ts
import { isThirdPartyFactorySettlementBlocked } from '../data/fcs/third-party-factory-rating.ts'
```

- [ ] **步骤 4：在构建页计算拦截状态**

在 `renderBuildView(scopes)` 中读取 `state.buildFactoryId` 后增加：

```ts
const blacklistSettlementBlocked = isThirdPartyFactorySettlementBlocked(state.buildFactoryId)
```

在构建页顶部或工厂选择后展示：

```ts
${blacklistSettlementBlocked ? '<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">该工厂已拉黑，不能发起结算。请主管处理历史账款。历史账本仍可查看。</div>' : ''}
```

- [ ] **步骤 5：禁用生成动作**

找到生成/保存对账单按钮，给按钮增加：

```ts
${blacklistSettlementBlocked ? 'disabled' : ''}
```

并在按钮附近保留账本列表渲染，不隐藏历史账本。

- [ ] **步骤 6：事件提交前二次拦截**

在新建对账单事件处理、调用创建草稿前加入：

```ts
if (isThirdPartyFactorySettlementBlocked(state.buildFactoryId)) {
  state.buildRemark = '该工厂已拉黑，不能发起结算。请主管处理历史账款。'
  requestRender()
  return true
}
```

如果当前页面已有专门错误字段，优先写入该错误字段；不要新增复杂状态机。

- [ ] **步骤 7：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:statements
npm run check:factory-settlement-statements
```

预期：三个命令 PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/statements.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: block blacklisted factory settlement"
```

---

### 任务 5：补原型审查记录

**文件：**
- 创建：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`

- [ ] **步骤 1：创建审查记录**

创建 `docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`：

```md
# 三方车缝工厂评级与派单结算拦截原型审查记录

## 页面基本信息

| 项目 | 内容 |
| --- | --- |
| 系统 | FCS |
| 页面名称 | 工厂档案、车缝分配工作台、对账单生成 |
| 页面路径 | `/fcs/factory-profile`、`/fcs/dispatch/sewing`、对账单生成页 |
| 端类型 | 管理端 |
| 主要角色 | PPIC、工厂管理、跟单/结算人员、业务主管 |
| 主要任务 | 查看评级、派单前风控、结算前拦截 |
| 上游来源 | 工厂档案、车缝派单、后道质检、履约记录 |
| 下游去向 | 车缝派单草稿、对账单生成、主管处理 |
| 是否涉及扫码 | 否 |
| 是否涉及数量 | 是 |
| 是否涉及交接或责任转移 | 是 |
| 是否涉及异常或差异 | 是 |

## 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/superpowers/specs/2026-07-07-third-party-sewing-factory-rating-design.md`

## 自查结论

- 角色边界清晰：PPIC 负责派单判断，主管负责评级解释，结算人员只被阻断黑名单结算。
- 信息负荷可控：评级以卡片、提示和少量履约记录展示，不引入完整后台配置。
- 数量口径明确：试单上限区分 1000 件和 300 件，近 90 天只做生产时效查看。
- 防错明确：C 级/黑名单禁止派单和发起结算，B 级只做黄牌提醒。
- 中文状态完整：页面不展示 `TRIAL`、`ACTIVE`、`BLACKLISTED`。

## 例外说明

- 本期是原型演示，不实现真实评分任务、真实 API 校验、真实 PPS 处罚流。
- 黑名单历史账本保留可见，只阻断新发起结算。
```

- [ ] **步骤 2：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：PASS。

- [ ] **步骤 3：Commit**

```bash
git add docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md
git commit -m "docs: add third-party factory rating prototype review"
```

---

### 任务 6：最终验证

**文件：**
- 无新文件。只运行命令并修复发现的问题。

- [ ] **步骤 1：运行专项检查**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:sewing-dispatch-workbench
npm run check:statements
npm run check:factory-settlement-statements
npm run check:prototype-design-governance
```

预期：全部 PASS。

- [ ] **步骤 2：运行构建**

运行：

```bash
npm run build
```

预期：PASS，无 TypeScript 或 Vite 构建错误。

- [ ] **步骤 3：同步 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：`Index is up to date`。

- [ ] **步骤 4：查看工作区状态**

运行：

```bash
git status --short
```

预期：只剩用户原有未跟踪文件或无待提交实现改动。

- [ ] **步骤 5：最终提交修正**

如果步骤 1 或步骤 2 修复了问题：

```bash
git add src/data/fcs/third-party-factory-rating.ts src/pages/factory-profile.ts src/pages/sewing-dispatch-workbench.ts src/pages/statements.ts scripts/check-third-party-factory-rating.ts package.json docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md
git commit -m "fix: stabilize third-party factory rating checks"
```

如果没有修复文件，不提交。
