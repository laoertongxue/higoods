# 三方车缝工厂试产考核评级规则实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将三方车缝工厂评级从“快照 + 文案”升级为“独立试产考核记录 + 最新结果快照 + 派单结算规则执行”的闭环。

**架构：** 新增独立试产考核数据文件，保存每轮试产单、质检事实、自动评级和人工结论；现有评级快照读取最新已生效试产考核结果，并保留当前 11 个工厂覆盖口径。页面继续使用标准列表页组件，新增试产单摘要列和详情轮次表；派单、结算和检查脚本只消费结构化规则。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、现有标准列表页组件、现有 `node --experimental-strip-types` 检查脚本。

---

## 文件结构

- 创建：`src/data/fcs/third-party-factory-trial-assessment.ts`
  - 职责：保存试产考核记录 mock，提供不良率计算、时效评级、质量评级、综合评级、系统建议、最新记录查询、未完成试产判断。
- 修改：`src/data/fcs/third-party-factory-rating.ts`
  - 职责：评级快照读取最新试产考核结果，派生合作状态、派单控制、结算控制、下一轮试产上限和页面摘要字段。
- 修改：`src/pages/third-party-factory-rating.ts`
  - 职责：列表展示最新试产单、试产轮次、时效、不良率、系统建议和人工结论；详情展示全部试产考核记录和规则命中表。
- 修改：`src/data/fcs/sewing-dispatch-workbench.ts`
  - 职责：继续通过 `evaluateThirdPartyFactoryDispatchPolicy()` 执行派单规则；如需要，只补足传入单据类型和确认上下文，不在页面另写规则。
- 修改：`src/pages/sewing-dispatch-workbench.ts`
  - 职责：如列表/弹窗缺少试产规则反馈，展示统一派单评估结果中的阻断原因和标签。
- 修改：`scripts/check-third-party-factory-rating.ts`
  - 职责：扩展对抗式检查，覆盖试产考核记录、责任原因、不良率公式、自动评级、延长考核、派单和结算闭环。
- 修改：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`
  - 职责：追加本次试产考核记录、页面可见性、派单结算规则和对抗式核查结论。
- 参考：`docs/superpowers/specs/2026-07-17-third-party-trial-assessment-rules-design.md`
  - 职责：本计划的产品规格来源。

---

## 任务 1：新增试产考核事实层

**文件：**
- 创建：`src/data/fcs/third-party-factory-trial-assessment.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-third-party-factory-rating.ts` 的三方评级 import 区后新增试产考核 import：

```typescript
import {
  SEWING_FACTORY_LIABILITY_REASONS,
} from '../src/data/fcs/factory-settlement-reconciliation.ts'
import {
  calculateTrialAssessmentDefectMetrics,
  getLatestThirdPartyFactoryTrialAssessmentRecord,
  hasOpenThirdPartyFactoryTrialAssessment,
  listThirdPartyFactoryTrialAssessmentRecords,
} from '../src/data/fcs/third-party-factory-trial-assessment.ts'
```

在快照覆盖检查后新增断言：

```typescript
const trialAssessmentRecords = listThirdPartyFactoryTrialAssessmentRecords()
assert.ok(trialAssessmentRecords.length >= snapshots.length, '每个三方车缝工厂至少需要一条可追溯的试产考核记录或等待首轮试产记录')

for (const snapshot of snapshots) {
  const records = trialAssessmentRecords.filter((item) => item.factoryId === snapshot.factoryId)
  assert.ok(records.length > 0, `${snapshot.factoryId} 必须有试产考核记录`)
  const rounds = new Set(records.map((item) => item.assessmentRound))
  assert.equal(rounds.size, records.length, `${snapshot.factoryId} 每个考核轮次只能有一个试产单`)
  assert.ok(getLatestThirdPartyFactoryTrialAssessmentRecord(snapshot.factoryId), `${snapshot.factoryId} 必须能读取最新试产考核记录`)
}

for (const record of trialAssessmentRecords) {
  for (const item of record.factoryLiabilityDefectReasonItems) {
    assert.ok(
      SEWING_FACTORY_LIABILITY_REASONS.includes(item.reasonName),
      `${record.assessmentId} 存在字典外工厂责任瑕疵原因 ${item.reasonName}`,
    )
  }
  const metrics = calculateTrialAssessmentDefectMetrics(record)
  assert.equal(record.factoryLiabilityDefectQty, metrics.factoryLiabilityDefectQty, `${record.assessmentId} 工厂责任瑕疵数量必须由原因明细求和`)
  assert.equal(record.defectiveQty, metrics.defectiveQty, `${record.assessmentId} 不良数量必须等于返工数量 + 工厂责任瑕疵数量`)
  assert.equal(record.defectRate, metrics.defectRate, `${record.assessmentId} 不良率必须由不良数量 / 质检数量计算`)
}

assert.ok(
  trialAssessmentRecords.some((item) => item.effectiveDecision === '延长考核' && item.assessmentRound === 1),
  '必须有首轮后延长考核样例',
)
assert.ok(
  trialAssessmentRecords.some((item) => item.assessmentRound >= 2 && item.autoRatingDecision),
  '必须有延长后重新评级的试产记录',
)
assert.ok(
  trialAssessmentRecords.some((item) => item.status === 'TRIAL_DISPATCHED' || item.status === 'WAIT_QC'),
  '必须有未完成试产考核记录用于验证重复派单阻断',
)
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：检查失败，错误指向缺少 `src/data/fcs/third-party-factory-trial-assessment.ts` 或缺少对应导出。

- [ ] **步骤 3：新增试产考核数据与计算函数**

创建 `src/data/fcs/third-party-factory-trial-assessment.ts`，核心结构如下：

```typescript
import { SEWING_FACTORY_LIABILITY_REASONS } from './factory-settlement-reconciliation.ts'

export type TrialAssessmentGrade = 'S' | 'A' | 'B' | 'C'
export type TrialAssessmentDecision = '转正' | '拉黑' | '延长考核'
export type TrialAssessmentStatus =
  | 'WAIT_TRIAL_DISPATCH'
  | 'TRIAL_DISPATCHED'
  | 'WAIT_QC'
  | 'AUTO_RATED'
  | 'MANUAL_CONFIRMED'

export interface TrialAssessmentDefectReasonItem {
  reasonName: (typeof SEWING_FACTORY_LIABILITY_REASONS)[number]
  qty: number
}

export interface ThirdPartyFactoryTrialAssessmentRecord {
  assessmentId: string
  factoryId: string
  factoryCode: string
  factoryName: string
  assessmentRound: number
  trialOrderNo: string
  productionOrderNo: string
  dispatchQty: number
  plannedDeliveryAt: string
  actualDeliveryAt: string
  delayDays: number
  qcOrderNo: string
  inspectedQty: number
  qualifiedQty: number
  reworkQty: number
  factoryLiabilityDefectReasonItems: TrialAssessmentDefectReasonItem[]
  factoryLiabilityDefectQty: number
  defectiveQty: number
  defectRate: number
  timelinessGrade: TrialAssessmentGrade
  qualityGrade: TrialAssessmentGrade
  autoRatingGrade: TrialAssessmentGrade
  autoRatingDecision: TrialAssessmentDecision | null
  manualDecision: TrialAssessmentDecision | null
  manualReason: string | null
  effectiveDecision: TrialAssessmentDecision | null
  status: TrialAssessmentStatus
}
```

添加纯函数：

```typescript
export function calculateTrialAssessmentDefectMetrics(record: Pick<
  ThirdPartyFactoryTrialAssessmentRecord,
  'inspectedQty' | 'reworkQty' | 'factoryLiabilityDefectReasonItems'
>): { factoryLiabilityDefectQty: number; defectiveQty: number; defectRate: number } {
  const factoryLiabilityDefectQty = record.factoryLiabilityDefectReasonItems
    .reduce((total, item) => total + item.qty, 0)
  const defectiveQty = record.reworkQty + factoryLiabilityDefectQty
  return {
    factoryLiabilityDefectQty,
    defectiveQty,
    defectRate: record.inspectedQty > 0 ? Number((defectiveQty / record.inspectedQty).toFixed(4)) : 0,
  }
}

export function evaluateTrialAssessmentTimelinessGrade(delayDays: number): TrialAssessmentGrade {
  if (delayDays <= 0) return 'S'
  if (delayDays <= 1) return 'A'
  if (delayDays <= 3) return 'B'
  return 'C'
}

export function evaluateTrialAssessmentQualityGrade(defectRate: number): TrialAssessmentGrade {
  if (defectRate <= 0.02) return 'S'
  if (defectRate <= 0.05) return 'A'
  if (defectRate <= 0.1) return 'B'
  return 'C'
}

export function getWorseTrialAssessmentGrade(left: TrialAssessmentGrade, right: TrialAssessmentGrade): TrialAssessmentGrade {
  const rank: Record<TrialAssessmentGrade, number> = { S: 0, A: 1, B: 2, C: 3 }
  return rank[left] >= rank[right] ? left : right
}

export function getTrialAssessmentAutoDecision(grade: TrialAssessmentGrade): TrialAssessmentDecision {
  if (grade === 'S' || grade === 'A') return '转正'
  if (grade === 'B') return '延长考核'
  return '拉黑'
}
```

添加覆盖 11 个工厂的 `thirdPartyFactoryTrialAssessmentRecords`。每条记录的 `factoryLiabilityDefectReasonItems.reasonName` 只允许：

```typescript
'做工原因'
'脏污'
'抽纱'
'做错'
'做毁'
'破洞'
```

必须包含这些场景：

```typescript
// ID-F021：首轮 S/A 后转正
// ID-F023：首轮 C 后拉黑
// ID-F025：首轮延长考核，第二轮重新评级
// ID-F030：等待首轮试产或首轮未完成，用于重复派单阻断
// ID-F028：B 级黄牌，正常合作但派单需要确认
```

添加查询函数：

```typescript
export function listThirdPartyFactoryTrialAssessmentRecords(factoryIdOrCode?: string): ThirdPartyFactoryTrialAssessmentRecord[] {
  return thirdPartyFactoryTrialAssessmentRecords.filter((item) =>
    !factoryIdOrCode || item.factoryId === factoryIdOrCode || item.factoryCode === factoryIdOrCode,
  )
}

export function getLatestThirdPartyFactoryTrialAssessmentRecord(factoryIdOrCode: string): ThirdPartyFactoryTrialAssessmentRecord | undefined {
  return listThirdPartyFactoryTrialAssessmentRecords(factoryIdOrCode)
    .sort((left, right) => right.assessmentRound - left.assessmentRound)[0]
}

export function getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord(factoryIdOrCode: string): ThirdPartyFactoryTrialAssessmentRecord | undefined {
  return listThirdPartyFactoryTrialAssessmentRecords(factoryIdOrCode)
    .filter((item) => item.effectiveDecision)
    .sort((left, right) => right.assessmentRound - left.assessmentRound)[0]
}

export function hasOpenThirdPartyFactoryTrialAssessment(factoryIdOrCode: string): boolean {
  return listThirdPartyFactoryTrialAssessmentRecords(factoryIdOrCode)
    .some((item) => item.status === 'TRIAL_DISPATCHED' || item.status === 'WAIT_QC')
}
```

- [ ] **步骤 4：运行检查验证通过到下一处失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：试产考核文件可导入；如果仍失败，错误应指向快照未读取最新试产结果或派单规则尚未消费新字段。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/third-party-factory-trial-assessment.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: add third-party trial assessment records"
```

---

## 任务 2：评级快照读取最新试产考核结果

**文件：**
- 修改：`src/data/fcs/third-party-factory-rating.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `scripts/check-third-party-factory-rating.ts` 的延长考核断言附近新增：

```typescript
for (const snapshot of snapshots) {
  const latestRecord = getLatestThirdPartyFactoryTrialAssessmentRecord(snapshot.factoryId)
  assert.ok(latestRecord, `${snapshot.factoryId} 评级快照必须能关联最新试产考核记录`)
  assert.equal(snapshot.assessmentRound, latestRecord.assessmentRound, `${snapshot.factoryId} 当前考核轮次必须读取最新试产记录`)
  assert.equal(snapshot.latestTrialOrderNo, latestRecord.trialOrderNo, `${snapshot.factoryId} 快照必须展示最新试产单号`)
  assert.equal(snapshot.latestTrialProductionOrderNo, latestRecord.productionOrderNo, `${snapshot.factoryId} 快照必须展示最新试产生产单`)
  assert.equal(snapshot.latestTrialDefectRate, latestRecord.defectRate, `${snapshot.factoryId} 快照必须展示最新试产不良率`)
}

const extendedLatest = snapshots.find((item) => item.assessmentDecision === '延长考核')
assert.ok(extendedLatest, '必须有延长考核快照')
assert.equal(extendedLatest.cooperationStatusLabel, '考核中', '延长考核快照必须保持考核中')
assert.equal(extendedLatest.dispatchControl, 'TRIAL_ONLY', '延长考核快照必须保持试产派单控制')
assert.equal(extendedLatest.settlementControl, 'ALLOW', '延长考核快照不能做黑名单结算拦截')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，原因是 `FactoryRatingSnapshot` 没有 `latestTrialOrderNo` 等字段，或快照尚未从试产考核记录派生。

- [ ] **步骤 3：扩展快照字段**

在 `src/data/fcs/third-party-factory-rating.ts` 的 `FactoryRatingSnapshot` 增加字段：

```typescript
  latestTrialAssessmentId?: string
  latestTrialAssessmentStatus?: string
  latestTrialOrderNo?: string
  latestTrialProductionOrderNo?: string
  latestTrialDispatchQty?: number
  latestTrialDelayDays?: number
  latestTrialQcOrderNo?: string
  latestTrialDefectiveQty?: number
  latestTrialDefectRate?: number
  latestTrialAutoDecision?: FactoryRatingAssessmentDecision | null
  latestTrialManualDecision?: FactoryRatingAssessmentDecision | null
  hasOpenTrialAssessment?: boolean
```

导入试产函数：

```typescript
import {
  getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord,
  getLatestThirdPartyFactoryTrialAssessmentRecord,
  hasOpenThirdPartyFactoryTrialAssessment,
} from './third-party-factory-trial-assessment.ts'
```

- [ ] **步骤 4：实现快照派生**

在 `syncRatingSnapshotFromFactoryMaster()` 中，先取得：

```typescript
  const latestTrial = getLatestThirdPartyFactoryTrialAssessmentRecord(snapshot.factoryId)
  const latestEffectiveTrial = getLatestEffectiveThirdPartyFactoryTrialAssessmentRecord(snapshot.factoryId)
  const effectiveDecision = latestEffectiveTrial?.effectiveDecision ?? snapshot.assessmentDecision
```

然后用 `effectiveDecision` 派生：

```typescript
  const cooperationStatusLabel =
    effectiveDecision === '拉黑' ? '黑名单'
      : effectiveDecision === '延长考核' ? '考核中'
        : effectiveDecision === '转正' ? '正常合作'
          : snapshot.cooperationStatusLabel

  const dispatchControl =
    effectiveDecision === '拉黑' ? 'BLOCKED'
      : effectiveDecision === '延长考核' ? 'TRIAL_ONLY'
        : latestEffectiveTrial?.autoRatingGrade === 'S' ? 'PRIORITY'
          : snapshot.dispatchControl

  const settlementControl = effectiveDecision === '拉黑' ? 'BLOCK_NEW_STATEMENT' : 'ALLOW'
```

返回值中合并最新试产摘要：

```typescript
    currentGrade: latestEffectiveTrial?.autoRatingGrade ?? snapshot.currentGrade,
    cooperationStatusLabel,
    dispatchControl,
    settlementControl,
    settlementBlocked: settlementControl === 'BLOCK_NEW_STATEMENT',
    allowedDocumentTypes: dispatchControl === 'TRIAL_ONLY' ? ['试产单'] : dispatchControl === 'BLOCKED' ? [] : ['试产单', '常规单'],
    assessmentDecision: effectiveDecision ?? snapshot.assessmentDecision,
    assessmentRound: latestTrial?.assessmentRound ?? snapshot.assessmentRound,
    nextAllowedDocumentType: effectiveDecision === '延长考核' ? '试产单' : snapshot.nextAllowedDocumentType,
    nextTrialLimitQty: effectiveDecision === '延长考核' ? firstTrialLimitQty : snapshot.nextTrialLimitQty,
    latestTrialAssessmentId: latestTrial?.assessmentId,
    latestTrialAssessmentStatus: latestTrial?.status,
    latestTrialOrderNo: latestTrial?.trialOrderNo,
    latestTrialProductionOrderNo: latestTrial?.productionOrderNo,
    latestTrialDispatchQty: latestTrial?.dispatchQty,
    latestTrialDelayDays: latestTrial?.delayDays,
    latestTrialQcOrderNo: latestTrial?.qcOrderNo,
    latestTrialDefectiveQty: latestTrial?.defectiveQty,
    latestTrialDefectRate: latestTrial?.defectRate,
    latestTrialAutoDecision: latestTrial?.autoRatingDecision,
    latestTrialManualDecision: latestTrial?.manualDecision,
    hasOpenTrialAssessment: hasOpenThirdPartyFactoryTrialAssessment(snapshot.factoryId),
```

- [ ] **步骤 5：运行检查验证通过到下一处失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：快照读取最新试产记录的断言通过；如果失败，修正派生字段名或生效结论映射。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/third-party-factory-rating.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: derive ratings from trial assessments"
```

---

## 任务 3：派单规则执行试产轮次和未完成阻断

**文件：**
- 修改：`src/data/fcs/third-party-factory-rating.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `trialOverLimitDecision` 之后新增：

```typescript
const openTrialSnapshot = snapshots.find((item) => item.dispatchControl === 'TRIAL_ONLY' && item.hasOpenTrialAssessment)
assert.ok(openTrialSnapshot, '必须有未完成试产考核工厂用于验证重复试产单阻断')
const duplicateTrialDecision = evaluateThirdPartyFactoryDispatchPolicy({
  factoryId: openTrialSnapshot.factoryId,
  actionType: '直接派单',
  documentTypeLabel: '试产单',
  dispatchQty: Math.min(openTrialSnapshot.nextTrialLimitQty ?? openTrialSnapshot.firstTrialLimitQty ?? 300, 100),
  isUrgentOrder: false,
  riskConfirmed: false,
  isSupervisorAssigned: false,
})
assert.equal(duplicateTrialDecision.allowed, false, '当前轮已有未完成试产单时必须阻断重复派试产单')
assert.ok(duplicateTrialDecision.reason.includes('已有未完成试产'), '重复试产单阻断原因必须明确')
```

把现有首单上限断言中的文案从“首单上限”升级为“试产上限”：

```typescript
assert.ok(trialOverLimitDecision.reason.includes('试产上限'), '超量阻断原因必须明确试产上限')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，原因是重复试产单尚未阻断，或文案仍为“首单上限”。

- [ ] **步骤 3：更新 TRIAL_ONLY 派单判断**

在 `evaluateThirdPartyFactoryDispatchPolicy()` 的 `snapshot.dispatchControl === 'TRIAL_ONLY'` 分支改为：

```typescript
  if (snapshot.dispatchControl === 'TRIAL_ONLY') {
    const trialLimitQty = snapshot.nextTrialLimitQty ?? snapshot.firstTrialLimitQty ?? 300
    if (snapshot.hasOpenTrialAssessment) {
      return createDispatchDecision(false, 'BLOCK', '该工厂当前轮已有未完成试产单，不能重复派试产单。', ['已有未完成试产'], false, 70)
    }
    if (input.dispatchQty > trialLimitQty) {
      return createDispatchDecision(
        false,
        'BLOCK',
        `本次派单数量 ${input.dispatchQty} 件超过试产上限 ${trialLimitQty} 件。`,
        ['超过试产上限'],
        false,
        70,
      )
    }
    return createDispatchDecision(true, 'ALLOW', '考核中工厂在试产额度内可以派单。', ['考核中', '试产额度内'], false, 70)
  }
```

同步更新 `getThirdPartyFactoryDispatchPolicyLabel()`：

```typescript
  if (snapshot.dispatchControl === 'TRIAL_ONLY') {
    const trialLimitQty = snapshot.nextTrialLimitQty ?? snapshot.firstTrialLimitQty ?? 300
    return `仅允许试产单，单次试产最多 ${trialLimitQty} 件，完成交出和质检后再判断结论。`
  }
```

- [ ] **步骤 4：运行检查验证通过到下一处失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：派单规则检查通过；如果现有旧断言仍检查“首单上限”，同步把检查口径改为“试产上限”。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/third-party-factory-rating.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: enforce trial assessment dispatch rules"
```

---

## 任务 4：评级列表展示试产单情况

**文件：**
- 修改：`src/pages/third-party-factory-rating.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在页面源检查中新增：

```typescript
assert.ok(ratingPageSource.includes('latestTrialOrderNo'), '三方工厂评级列表必须展示最新试产单号')
assert.ok(ratingPageSource.includes('latestTrialDefectRate'), '三方工厂评级列表必须展示最新试产不良率')
assert.ok(ratingPageSource.includes('latestTrialAutoDecision'), '三方工厂评级列表必须展示系统建议')
assert.ok(ratingPageSource.includes('trialSummary'), '三方工厂评级页必须有试产单情况列')
assert.ok(ratingPageSource.includes('试产轮次'), '三方工厂评级列表必须展示试产轮次')
assert.ok(ratingPageSource.includes('不良率'), '三方工厂评级列表必须展示不良率')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，原因是列表列定义尚未包含试产单摘要。

- [ ] **步骤 3：增加列表格式化函数**

在 `src/pages/third-party-factory-rating.ts` 的 `renderTrialLimit()` 后新增：

```typescript
function formatPercent(value: number | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '未质检'
  return `${(value * 100).toFixed(1)}%`
}

function renderTrialSummary(row: FactoryRatingSnapshot): string {
  const roundText = row.assessmentRound ? `第 ${row.assessmentRound} 轮` : '未开始'
  const orderText = row.latestTrialOrderNo ?? '等待试产单'
  const delayText = typeof row.latestTrialDelayDays === 'number'
    ? row.latestTrialDelayDays > 0 ? `延期 ${row.latestTrialDelayDays} 天` : '准时'
    : '未交出'
  return `
    <div class="space-y-1">
      <div class="font-medium">${escapeHtml(roundText)} / ${escapeHtml(orderText)}</div>
      <div class="text-xs text-muted-foreground">${escapeHtml(row.latestTrialProductionOrderNo ?? '未关联生产单')}</div>
      <div class="text-xs text-muted-foreground">${escapeHtml(delayText)}，不良率 ${escapeHtml(formatPercent(row.latestTrialDefectRate))}</div>
    </div>
  `
}

function renderAssessmentResult(row: FactoryRatingSnapshot): string {
  const autoDecision = row.latestTrialAutoDecision ?? '未评级'
  const manualDecision = row.latestTrialManualDecision ?? row.assessmentDecision ?? '未确认'
  return `
    <div class="space-y-1">
      <div class="text-sm">系统建议：${escapeHtml(autoDecision)}</div>
      <div class="text-xs text-muted-foreground">人工结论：${escapeHtml(manualDecision)}</div>
    </div>
  `
}
```

- [ ] **步骤 4：调整列定义**

在 `columns` 中加入两个列，放在 `scale` 后、`dispatch` 前：

```typescript
  {
    key: 'trialSummary',
    title: '试产单情况',
    width: 260,
    sortable: true,
    render: (row) => renderTrialSummary(row),
    sortValue: (row) => row.assessmentRound ?? 0,
  },
  {
    key: 'assessmentResult',
    title: '试产结论',
    width: 180,
    sortable: true,
    render: (row) => renderAssessmentResult(row),
    sortValue: (row) => row.latestTrialDefectRate ?? 999,
  },
```

如果表格过宽，保留容器横向滚动，不移除标准列表页能力。

- [ ] **步骤 5：运行检查验证通过到下一处失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：列表试产展示检查通过。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/third-party-factory-rating.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: show trial assessment summary in rating list"
```

---

## 任务 5：评级详情展示全部试产考核轮次和规则命中

**文件：**
- 修改：`src/pages/third-party-factory-rating.ts`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：编写失败检查**

在 `renderAssessmentDecisionDetail` 相关检查后新增：

```typescript
assert.ok(ratingPageSource.includes('renderTrialAssessmentRecords'), '评级详情必须展示试产考核记录表')
assert.ok(ratingPageSource.includes('listThirdPartyFactoryTrialAssessmentRecords'), '评级详情必须读取全部试产考核轮次')
assert.ok(ratingPageSource.includes('factoryLiabilityDefectReasonItems'), '评级详情必须展示工厂责任瑕疵原因明细')
assert.ok(ratingPageSource.includes('timelinessGrade'), '评级详情必须展示时效命中等级')
assert.ok(ratingPageSource.includes('qualityGrade'), '评级详情必须展示质量命中等级')
assert.ok(ratingPageSource.includes('autoRatingGrade'), '评级详情必须展示综合评级')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，原因是详情仍只展示履约记录或简化考核结论。

- [ ] **步骤 3：导入试产记录并新增详情渲染**

在页面 import 中加入：

```typescript
import {
  listThirdPartyFactoryTrialAssessmentRecords,
  type ThirdPartyFactoryTrialAssessmentRecord,
} from '../data/fcs/third-party-factory-trial-assessment.ts'
```

新增函数：

```typescript
function renderDefectReasons(record: ThirdPartyFactoryTrialAssessmentRecord): string {
  if (record.factoryLiabilityDefectReasonItems.length === 0) return '无工厂责任瑕疵'
  return record.factoryLiabilityDefectReasonItems
    .map((item) => `${item.reasonName} ${item.qty} 件`)
    .join('，')
}

function renderTrialAssessmentRecords(records: ThirdPartyFactoryTrialAssessmentRecord[]): string {
  if (records.length === 0) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="font-semibold">试产考核记录</h3>
        <p class="mt-3 rounded-md border bg-background p-4 text-sm text-muted-foreground">暂无试产考核记录</p>
      </section>
    `
  }

  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="font-semibold">试产考核记录</h3>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full min-w-[980px] border-collapse text-sm">
          <thead class="border-b bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left">轮次</th>
              <th class="px-3 py-2 text-left">试产单</th>
              <th class="px-3 py-2 text-right">数量</th>
              <th class="px-3 py-2 text-right">延期</th>
              <th class="px-3 py-2 text-right">质检</th>
              <th class="px-3 py-2 text-left">工厂责任原因</th>
              <th class="px-3 py-2 text-left">规则命中</th>
              <th class="px-3 py-2 text-left">结论</th>
            </tr>
          </thead>
          <tbody>
            ${records.map((record) => `
              <tr class="border-b last:border-b-0 align-top">
                <td class="px-3 py-2 font-medium">第 ${escapeHtml(record.assessmentRound)} 轮</td>
                <td class="px-3 py-2">
                  <div class="font-medium">${escapeHtml(record.trialOrderNo)}</div>
                  <div class="text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)} / ${escapeHtml(record.qcOrderNo)}</div>
                </td>
                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(record.dispatchQty)} 件</td>
                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(record.delayDays)} 天</td>
                <td class="px-3 py-2 text-right tabular-nums">
                  <div>返工 ${escapeHtml(record.reworkQty)} 件</div>
                  <div class="text-xs text-muted-foreground">不良 ${escapeHtml(record.defectiveQty)} / ${escapeHtml(formatPercent(record.defectRate))}</div>
                </td>
                <td class="px-3 py-2 text-muted-foreground">${escapeHtml(renderDefectReasons(record))}</td>
                <td class="px-3 py-2 text-muted-foreground">时效 ${escapeHtml(record.timelinessGrade)} / 质量 ${escapeHtml(record.qualityGrade)} / 综合 ${escapeHtml(record.autoRatingGrade)}</td>
                <td class="px-3 py-2">
                  <div>系统：${escapeHtml(record.autoRatingDecision ?? '未评级')}</div>
                  <div class="text-xs text-muted-foreground">人工：${escapeHtml(record.manualDecision ?? '未确认')}</div>
                  ${record.manualReason ? `<div class="text-xs text-muted-foreground">${escapeHtml(record.manualReason)}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}
```

- [ ] **步骤 4：接入抽屉**

在 `renderRatingDrawer()` 中读取并展示：

```typescript
  const trialRecords = listThirdPartyFactoryTrialAssessmentRecords(snapshot.factoryId)
    .sort((left, right) => right.assessmentRound - left.assessmentRound)
```

将抽屉内容改为：

```typescript
          ${renderRatingScoreDetail(snapshot)}
          ${renderAssessmentDecisionDetail(snapshot)}
          ${renderStrategyDetail(snapshot)}
          ${renderTrialAssessmentRecords(trialRecords)}
          ${renderTimingDetail(snapshot)}
          ${renderPerformanceRecords(records)}
```

- [ ] **步骤 5：运行检查验证通过到下一处失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：详情轮次和规则命中检查通过。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/third-party-factory-rating.ts scripts/check-third-party-factory-rating.ts
git commit -m "feat: show trial assessment records in rating detail"
```

---

## 任务 6：派单和结算闭环反例补强

**文件：**
- 修改：`scripts/check-third-party-factory-rating.ts`
- 修改：`src/data/fcs/sewing-dispatch-workbench.ts`
- 修改：`src/pages/sewing-dispatch-workbench.ts`
- 修改：`src/data/fcs/store-domain-settlement-seeds.ts`
- 修改：`src/pages/statements.ts`

- [ ] **步骤 1：编写派单反例检查**

在车缝分配反例段增加：

```typescript
const openTrialBlockedRow = getAvailableDispatchRow('车缝分配工作台必须有可验证未完成试产阻断的齐套 SKU 行')
const openTrialDraft = createSewingDispatchWorkbenchDraft({
  actionType: '直接派单',
  rowIds: [openTrialBlockedRow.rowId],
  factoryIdByRowId: { [openTrialBlockedRow.rowId]: openTrialSnapshot.factoryId },
  policyOverrideByRowId: {
    [openTrialBlockedRow.rowId]: {
      documentTypeLabel: '试产单',
      dispatchQty: openTrialBlockedRow.remainingQty,
      isUrgentOrder: false,
    },
  },
  by: '对抗式核查',
})
assert.equal(openTrialDraft.ok, false, '未完成试产工厂不能绕过页面重复创建试产派单草稿')
assert.ok(openTrialDraft.message.includes('已有未完成试产'), '未完成试产域层阻断原因必须透出')
```

- [ ] **步骤 2：编写结算反例检查**

保留现有黑名单结算检查，并新增考核中结算允许检查：

```typescript
const assessmentSettlementSnapshot = snapshots.find((item) => item.cooperationStatusLabel === '考核中' && item.settlementControl === 'ALLOW')
assert.ok(assessmentSettlementSnapshot, '必须有考核中但允许结算的工厂样例')
const assessmentSettlementPolicy = evaluateThirdPartyFactorySettlementPolicy(assessmentSettlementSnapshot.factoryId)
assert.equal(assessmentSettlementPolicy.allowedToCreateNewStatement, true, '考核中工厂不做黑名单结算拦截')
assert.equal(assessmentSettlementPolicy.historyReadable, true, '考核中工厂历史账本必须可读')
```

- [ ] **步骤 3：运行检查验证失败或确认已满足**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：如果域函数已经通过任务 3 生效，此处可能直接通过；若页面或域层仍有旧“首单”文案或未透出阻断原因，检查失败。

- [ ] **步骤 4：补齐域层或页面调用**

如果 `createSewingDispatchWorkbenchDraft()` 没有透出统一规则原因，保持 `evaluateGovernedDispatchPolicy()` 直接返回：

```typescript
  const decision = evaluateThirdPartyFactoryDispatchPolicy(input)
  if (!decision.allowed) return { ok: false, message: decision.reason }
```

如果页面仍展示旧“首单”文案，把页面中可见文案统一改为 `getThirdPartyFactoryDispatchPolicyLabel(row)` 和 `decision.reason`，不新增页面自定义规则。

结算侧保持 `createStatementFromEligibleLedgers()` 和 `syncStatementDraftFromBuild()` 使用：

```typescript
  const settlementPolicy = evaluateThirdPartyFactorySettlementPolicy(input.settlementPartyId)
  if (!settlementPolicy.allowedToCreateNewStatement) {
    return { ok: false, message: settlementPolicy.reason }
  }
```

- [ ] **步骤 5：运行检查验证通过**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：派单重复试产、超量试产、常规单阻断、黑名单结算阻断、考核中结算允许全部通过。

- [ ] **步骤 6：Commit**

```bash
git add scripts/check-third-party-factory-rating.ts src/data/fcs/sewing-dispatch-workbench.ts src/pages/sewing-dispatch-workbench.ts src/data/fcs/store-domain-settlement-seeds.ts src/pages/statements.ts
git commit -m "test: cover trial assessment dispatch and settlement closure"
```

---

## 任务 7：原型审查记录和治理检查

**文件：**
- 修改：`docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md`
- 修改：`scripts/check-third-party-factory-rating.ts`

- [ ] **步骤 1：补充审查记录检查**

在 `scripts/check-third-party-factory-rating.ts` 增加审查记录源检查：

```typescript
const reviewRecordSource = readRequiredSource(
  new URL('../docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md', import.meta.url),
  '缺少三方车缝工厂评级原型审查记录',
)
assert.ok(reviewRecordSource.includes('独立试产考核记录'), '原型审查记录必须说明独立试产考核记录')
assert.ok(reviewRecordSource.includes('返工数量 + 工厂责任瑕疵数量'), '原型审查记录必须说明不良率口径')
assert.ok(reviewRecordSource.includes('做工原因') && reviewRecordSource.includes('破洞'), '原型审查记录必须说明工厂责任瑕疵原因清单')
assert.ok(reviewRecordSource.includes('重复派试产单阻断'), '原型审查记录必须说明未完成试产重复派单阻断')
```

- [ ] **步骤 2：运行检查验证失败**

运行：

```bash
npm run check:third-party-factory-rating
```

预期：失败，原因是审查记录还没有本次新增口径。

- [ ] **步骤 3：追加审查记录**

在 `docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md` 的“自查结论”列表末尾追加：

```markdown
- 2026-07-17 试产考核记录复审：三方车缝工厂评级新增独立试产考核记录，评级快照只读取最新生效结果；列表展示试产轮次、最新试产单、完成时效、不良率、系统建议和人工结论，详情展示全部试产考核轮次。
- 2026-07-17 不良率口径复审：评级不良数量明确为返工数量 + 工厂责任瑕疵数量；工厂责任瑕疵原因只允许做工原因、脏污、抽纱、做错、做毁、破洞，mock 数据不得使用字典外原因。
- 2026-07-17 延长考核复审：延长考核不是独立状态，工厂继续保持考核中和 TRIAL_ONLY；每次延长只开放下一轮一个试产单，当前轮已有未完成试产时重复派试产单阻断。
- 2026-07-17 派单结算闭环复审：派单继续消费统一派单评估函数，考核中常规单、试产超量、未完成试产重复派单、黑名单派单均在域层阻断；结算继续消费统一结算评估函数，黑名单禁止新建结算，考核中允许按账本结算。
```

- [ ] **步骤 4：运行治理检查**

运行：

```bash
npm run check:third-party-factory-rating
npm run check:list-page-governance
npm run check:prototype-design-governance -- --all
```

预期：三条检查通过。如果治理检查指出审查记录缺字段，按模板补齐本次复审结论。

- [ ] **步骤 5：Commit**

```bash
git add docs/prototype-review-records/2026-07-07-third-party-sewing-factory-rating.md scripts/check-third-party-factory-rating.ts
git commit -m "docs: review trial assessment rating closure"
```

---

## 任务 8：最终验证和本地查看

**文件：**
- 修改：无业务文件，仅在必要时修复检查暴露的问题。

- [ ] **步骤 1：同步 CodeGraph**

运行：

```bash
codegraph sync && codegraph status
```

预期：索引为 up to date。

- [ ] **步骤 2：运行构建和专项检查**

运行：

```bash
npm run check:third-party-factory-rating
npm run build
```

预期：两条命令通过。

- [ ] **步骤 3：启动本地服务**

运行：

```bash
npm run dev -- --host 0.0.0.0 --port 5174
```

如果端口被占用，使用：

```bash
npm run dev -- --host 0.0.0.0 --port 5175
```

- [ ] **步骤 4：验证本机和局域网地址**

运行：

```bash
ipconfig getifaddr en0 || ipconfig getifaddr en1
curl -I http://127.0.0.1:5174/fcs/factories/third-party-rating
```

预期：Vite 返回应用入口，浏览器可打开 `/fcs/factories/third-party-rating`。

- [ ] **步骤 5：浏览器验收**

在页面验证：

```text
筛选区在统计卡片上方。
统计卡片随筛选结果变化。
列表可见试产轮次、最新试产单、不良率、系统建议、人工结论。
查看评级抽屉可见全部试产考核轮次。
延长考核工厂显示考核中、试产单、下一轮上限。
黑名单工厂显示禁止派单和禁止新建结算。
列设置打开和关闭可用。
分页、排序、筛选可用。
```

- [ ] **步骤 6：最终 Commit**

如果步骤 1 至步骤 5 中有修复：

```bash
git add <修复过的文件>
git commit -m "fix: verify trial assessment rating flow"
```

如果没有修复，不提交空 commit。

---

## 自检

### 规格覆盖度

- 结构化规则：任务 1、任务 2、任务 3、任务 6 覆盖。
- 不良率公式和责任原因：任务 1 覆盖。
- 单工厂单轮一个试产单：任务 1 和任务 3 覆盖。
- 延长考核多轮：任务 1、任务 2、任务 3 覆盖。
- 列表展示试产单情况：任务 4 覆盖。
- 详情记录全部试产轮次：任务 5 覆盖。
- 派单结算应用规则：任务 3、任务 6 覆盖。
- 原型审查和治理：任务 7、任务 8 覆盖。

### 红旗扫描

本文档没有未完成标记、空泛步骤或未命名文件。每个实现步骤都包含目标文件、核心代码形状、运行命令和预期结果。

### 类型一致性

- `FactoryRatingAssessmentDecision` 与 `TrialAssessmentDecision` 的中文取值保持一致：转正、拉黑、延长考核。
- `TrialAssessmentGrade` 与 `FactoryRatingGrade` 的取值保持一致：S、A、B、C。
- 快照新增字段统一使用 `latestTrial*` 前缀。
- 派单重复试产判断统一使用 `hasOpenTrialAssessment`。
