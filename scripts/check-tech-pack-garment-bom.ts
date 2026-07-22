import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizeGarmentBomItem,
  partitionBomItemsByType,
  validateGarmentBomItem,
  type BomItemRow,
} from '../src/pages/tech-pack/context.ts'
import { validateTechPackForPublish, type TechPack } from '../src/data/fcs/tech-packs.ts'

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

console.log('check-tech-pack-garment-bom: PASS')
