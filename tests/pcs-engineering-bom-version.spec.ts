import assert from 'node:assert/strict'

import type { EngineeringBomDraft } from '../src/data/pcs-engineering-bom-types.ts'
import {
  compareEngineeringBomDraftCustomCosts,
  compareEngineeringBomDraftLines,
  copyEngineeringBomDraftVersion,
  normalizeEngineeringBomDraftSkuScope,
  selectRecommendedEngineeringBomDraft,
} from '../src/data/pcs-engineering-bom-version.ts'

const source: EngineeringBomDraft = {
  bomDraftVersionId: 'BOM-V1',
  versionStatus: 'COMPLETED_CONFIRMED',
  styleCode: 'SPU-001',
  productColor: '黑色',
  applicableSkuIds: ['SPU-001-BLACK-S', 'SPU-001-BLACK-M'],
  copiedAt: '2026-08-01 10:00:00',
  copiedBy: '买手甲',
  completedConfirmedAt: '2026-08-01 11:00:00',
  completedConfirmedBy: '买手甲',
  materialLines: [{
    bomItemId: 'BOM-LINE-1',
    materialSkuId: 'MAT-SKU-1',
    productColor: '黑色',
    usage: 1.2,
    sampleQuantity: 2,
    usageUnit: '米',
    lossRate: 0.05,
    applicableSkuIds: ['SPU-001-BLACK-S', 'SPU-001-BLACK-M'],
    printRequirement: '是',
    dyeRequirement: '是',
    waterSolubleRequirementText: '需要水溶',
    printSide: '双面',
    frontPatternResultId: 'PATTERN-FRONT',
    liningPatternResultId: 'PATTERN-INSIDE',
    linkedPatternResultIds: ['PATTERN-FRONT', 'PATTERN-INSIDE'],
    processCode: 'PROC-PRINT',
  }],
  customCosts: [{
    customCostId: 'COST-SEW',
    title: '车位费',
    amountIdr: 45000,
    note: '整款费用',
    displayOrder: 1,
    maintainedBy: '买手甲',
    maintainedAt: '2026-08-01 09:00:00',
  }],
}

const normalizedAllSku = normalizeEngineeringBomDraftSkuScope(
  { ...source, applicableSkuIds: [], materialLines: source.materialLines.map((line) => ({ ...line, applicableSkuIds: [] })) },
  {
    styleCode: 'SPU-001',
    colors: [
      { productColor: '黑色', skuIds: ['SPU-001-BLACK-S', 'SPU-001-BLACK-M'] },
      { productColor: '白色', skuIds: ['SPU-001-WHITE-S'] },
    ],
  },
)
assert.deepEqual(normalizedAllSku.applicableSkuIds, ['SPU-001-BLACK-S', 'SPU-001-BLACK-M'], '未选 SKU 时默认覆盖该商品颜色全部 SKU')
assert.deepEqual(normalizedAllSku.materialLines[0]?.applicableSkuIds, normalizedAllSku.applicableSkuIds)

const normalizedPartialSku = normalizeEngineeringBomDraftSkuScope(
  {
    ...source,
    applicableSkuIds: ['SPU-001-BLACK-M'],
    materialLines: source.materialLines.map((line) => ({ ...line, applicableSkuIds: [] })),
  },
  { styleCode: 'SPU-001', colors: [{ productColor: '黑色', skuIds: ['SPU-001-BLACK-S', 'SPU-001-BLACK-M'] }] },
)
assert.deepEqual(normalizedPartialSku.applicableSkuIds, ['SPU-001-BLACK-M'])
assert.throws(
  () => normalizeEngineeringBomDraftSkuScope(
    { ...source, applicableSkuIds: ['FREE-TEXT-SKU'] },
    { styleCode: 'SPU-001', colors: [{ productColor: '黑色', skuIds: ['SPU-001-BLACK-S'] }] },
  ),
  /不属于目标 SPU/,
  '不能自由填写不存在的 SKU',
)
assert.throws(
  () => normalizeEngineeringBomDraftSkuScope(
    { ...source, productColor: '白色' },
    { styleCode: 'SPU-001', colors: [{ productColor: '黑色', skuIds: ['SPU-001-BLACK-S'] }] },
  ),
  /不存在商品颜色/,
)

const copied = copyEngineeringBomDraftVersion({
  source,
  targetVersionId: 'BOM-V2',
  copiedAt: '2026-08-02 10:00:00',
  copiedBy: '买手乙',
})
assert.equal(copied.versionStatus, 'DRAFT')
assert.equal(copied.sourceVersionId, 'BOM-V1')
assert.equal(copied.completedConfirmedAt, '')
assert.notEqual(copied.materialLines, source.materialLines)
assert.notEqual(copied.customCosts, source.customCosts)
assert.equal(copied.lineDiffs?.[0]?.changeType, 'UNCHANGED')
assert.equal(copied.customCostDiffs?.[0]?.changeType, 'UNCHANGED')

copied.materialLines[0]!.usage = 1.4
copied.customCosts[0]!.amountIdr = 50000
const lineDiffs = compareEngineeringBomDraftLines(source, copied)
const costDiffs = compareEngineeringBomDraftCustomCosts(source, copied)
assert.deepEqual(lineDiffs[0]?.changedFields, ['usage'])
assert.deepEqual(costDiffs[0]?.changedFields, ['amountIdr'])
assert.equal(source.materialLines[0]?.usage, 1.2, '新草稿修改不能覆盖来源版本')
assert.equal(source.customCosts[0]?.amountIdr, 45000, '新草稿费用修改不能覆盖来源版本')

assert.throws(
  () => copyEngineeringBomDraftVersion({
    source: { ...source, versionStatus: 'DRAFT' },
    targetVersionId: 'BOM-INVALID',
    copiedAt: '2026-08-02 10:00:00',
    copiedBy: '买手乙',
  }),
  /已完成确认|已形成正式技术包/,
)

const recommendation = selectRecommendedEngineeringBomDraft([
  source,
  { ...source, bomDraftVersionId: 'BOM-V0', copiedAt: '2026-07-01 10:00:00' },
  { ...source, bomDraftVersionId: 'BOM-DRAFT', versionStatus: 'DRAFT', copiedAt: '2026-08-03 10:00:00' },
])
assert.equal(recommendation?.bomDraftVersionId, 'BOM-V1', '只推荐最近一份已完成且已确认的版本')

console.log('PCS engineering BOM version checks passed')
