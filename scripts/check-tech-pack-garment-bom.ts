import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizeGarmentBomItem,
  partitionBomItemsByType,
  ensurePatternPoolDemoPackages,
  validateGarmentTechniqueBomLinks,
  validateGarmentBomItem,
  type BomItemRow,
} from '../src/pages/tech-pack/context.ts'
import { validateTechPackForPublish, type TechPack } from '../src/data/fcs/tech-packs.ts'
import { selectProductionMaterialBomItems } from '../src/data/fcs/production-artifact-generation.ts'

const garmentSeed = {
  id: 'bom-garment-1',
  type: '成衣',
  colorLabel: '黑色',
  materialCode: 'GARMENT-001',
  materialName: '旧成衣名称',
  spec: 'M',
  unit: '米',
  patternPieces: ['前片'],
  linkedPatternIds: ['pattern-1'],
  applicableSkuCodes: ['SKU-BLACK-M'],
  usageProcessCodes: ['AUX_HEAT_TRANSFER'],
  usage: 3,
  lossRate: 0.1,
  printRequirement: '有',
  waterSolubleRequirement: '是',
  dyeRequirement: '有',
  shrinkRequirement: '是',
  washRequirement: '是',
  printSideMode: 'SINGLE',
  frontPatternDesignId: 'design-1',
  frontPatternDesignIds: ['design-1'],
  insidePatternDesignId: 'design-2',
  insidePatternDesignIds: ['design-2'],
} satisfies BomItemRow

const normalized = normalizeGarmentBomItem(garmentSeed)
assert.equal(normalized.materialName, '成衣')
assert.equal(normalized.materialCode, '')
assert.equal(normalized.spec, '')
assert.equal(normalized.unit, '件')
assert.equal(normalized.usage, 1)
assert.equal(normalized.lossRate, 0)
assert.deepEqual(normalized.patternPieces, [])
assert.deepEqual(normalized.linkedPatternIds, [])
assert.equal(normalized.printRequirement, '无')
assert.equal(normalized.dyeRequirement, '无')
assert.equal(normalized.waterSolubleRequirement, '否')
assert.equal(normalized.shrinkRequirement, '否')
assert.equal(normalized.washRequirement, '否')
assert.equal(normalized.printSideMode, '')
assert.deepEqual(normalized.frontPatternDesignIds, [])
assert.deepEqual(normalized.insidePatternDesignIds, [])
assert.equal(validateGarmentBomItem(normalized), '')
assert.match(validateGarmentBomItem({ ...normalized, applicableSkuCodes: [] }), /SKU/)

const fabric = { ...normalized, id: 'bom-fabric-1', type: '面料', materialName: '主面料' }
assert.equal(normalizeGarmentBomItem(fabric), fabric, '非成衣 BOM 不应被改写')
const partitioned = partitionBomItemsByType([fabric, normalized])
assert.deepEqual(partitioned.materialBomItems.map((item) => item.id), ['bom-fabric-1'])
assert.deepEqual(partitioned.garmentBomItems.map((item) => item.id), ['bom-garment-1'])
const patternAssociations = ensurePatternPoolDemoPackages([], [normalized, fabric])
  .filter((item) => item.recordKind === 'MATERIAL_ASSOCIATION')
assert(patternAssociations.length > 0)
assert(patternAssociations.every((item) => item.linkedBomItemId === 'bom-fabric-1'), '纸样兜底不得关联排在首位的成衣 BOM')
assert.match(validateGarmentTechniqueBomLinks('成衣', ['bom-fabric-1'], [fabric, normalized]), /成衣 BOM/)
assert.equal(validateGarmentTechniqueBomLinks('成衣', ['bom-garment-1'], [fabric, normalized]), '')
assert.deepEqual(
  selectProductionMaterialBomItems([
    { id: 'garment-first', type: '成衣' },
    { id: 'fabric-second', type: '面料' },
  ]).map((item) => item.id),
  ['fabric-second'],
  '生产制品的水溶、印花和染色演示上下文不得把首条成衣当作物料',
)

const bomDomainSource = readFileSync('src/pages/tech-pack/bom-domain.ts', 'utf8')
assert.match(bomDomainSource, /'包装材料', '成衣', '其他'/)
assert.match(bomDomainSource, /data-tech-field="new-bom-remark"/)
assert.match(bomDomainSource, /const isGarment = state\.newBomItem\.type === '成衣'/)
assert.match(
  readFileSync('src/pages/tech-pack/process-domain.ts', 'utf8'),
  /data-tech-field="new-technique-garment-bom"/,
  '成衣辅助工艺必须只能选择成衣 BOM',
)

const sourceChecks = [
  ['纸样关联', 'src/pages/tech-pack/pattern-domain.ts'],
  ['款色用料映射', 'src/pages/tech-pack/color-mapping-domain.ts'],
  ['采购备料', 'src/data/fcs/material-request-drafts.ts'],
  ['裁片生成', 'src/data/fcs/cutting/generated-cut-orders.ts'],
] as const
sourceChecks.forEach(([label, path]) => {
  assert.match(readFileSync(path, 'utf8'), /type !== '成衣'/, `${label}必须隔离成衣 BOM`)
})
assert.match(
  readFileSync('src/data/fcs/production-process-snapshot-derivation.ts', 'utf8'),
  /不能绑定成衣 BOM/,
  '印染加工快照必须拒绝成衣 BOM',
)

const publishErrors = validateTechPackForPublish({
  patternFiles: [],
  processEntries: [],
  bomItems: [{
    id: 'bom-garment-empty-sku',
    type: '成衣',
    name: '成衣',
    spec: '',
    unit: '件',
    unitConsumption: 1,
    lossRate: 0,
    supplier: '-',
    applicableSkuCodes: [],
  }],
} as unknown as TechPack)
assert(publishErrors.some((message) => message.includes('成衣 BOM') && message.includes('SKU')))

const invalidGarmentCraftErrors = validateTechPackForPublish({
  patternFiles: [],
  bomItems: [{
    id: 'bom-garment-valid', type: '成衣', name: '成衣', spec: '', unit: '件',
    unitConsumption: 1, lossRate: 0, supplier: '-', applicableSkuCodes: ['SKU-1'],
  }],
  processEntries: [{
    id: 'craft-heat-transfer', entryType: 'CRAFT', stageCode: 'PROD', stageName: '生产',
    processCode: 'AUX', processName: '辅助工艺', craftCode: 'HEAT_TRANSFER', craftName: '烫画',
    isSpecialCraft: true, selectedTargetObject: '成衣', linkedBomItemIds: ['bom-fabric-invalid'],
  }],
} as unknown as TechPack)
assert(invalidGarmentCraftErrors.some((message) => message.includes('成衣辅助工艺') && message.includes('成衣 BOM')))

const eventsSource = readFileSync('src/pages/tech-pack/events.ts', 'utf8')
const releaseValidationIndex = eventsSource.indexOf('const validation = validateTechPackForPublish(state.techPack)')
const officialPublishIndex = eventsSource.indexOf('if (state.currentTechnicalVersionId)', eventsSource.indexOf('function performRelease'))
assert(releaseValidationIndex > 0 && releaseValidationIndex < officialPublishIndex, '正式版本发布前也必须执行技术包发布校验')
assert.doesNotMatch(eventsSource, /linkedBomItemIds: target\.selectedTargetObject === '成衣' \? \[\.\.\.\(target\.linkedBomItemIds/)
assert.match(eventsSource, /validateGarmentTechniqueBomLinks/)

const contextSource = readFileSync('src/pages/tech-pack/context.ts', 'utf8')
assert.doesNotMatch(contextSource, /fabricBomItems\[0\] \?\? bomItems\[0\]/)
assert.match(contextSource, /partitionBomItemsByType\(state\.bomItems\)\.materialBomItems\.flatMap/)

console.log('check-tech-pack-garment-bom: PASS')
