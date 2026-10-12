import test from 'node:test'
import assert from 'node:assert/strict'
import { buildProcessedMaterialCode } from '../../src/data/pcs-material-rules.ts'
import { addMaterialR1Demonstration } from '../../src/data/pcs-material-r1-seeds.ts'
import type { MaterialArchiveStoreSnapshot, MaterialProcessDraft } from '../../src/data/pcs-material-archive-types.ts'

const predecessor = 'TEST-FA-SZ-001-B01'
const dye: MaterialProcessDraft = { inputSkuId: 'base', processType: 'DYEING', dyeMethod: 'MJS', colorCode: 'black', pantoneSystem: 'TCX', pantoneCode: '19-4003', skuImageUrl: '/materials/pcs-reviewed/thread-black.png' }
const print: MaterialProcessDraft = { inputSkuId: 'base', processType: 'PRINTING', patternId: 'front', patternCode: 'pl001197', patternVersionId: 'front-v1', printSide: 'A', skuImageUrl: '/materials/fei-ticket/blue-white-print-cotton.png' }
const twoSides: MaterialProcessDraft = { ...print, printSide: 'AB', backPatternId: 'back', backPatternCode: 'pl001198', backPatternVersionId: 'back-v1' }

test('MJS and GTG create distinct identities for the same predecessor, color and Pantone', () => {
  const mjs = buildProcessedMaterialCode(predecessor, dye)
  const gtg = buildProcessedMaterialCode(predecessor, { ...dye, dyeMethod: 'GTG' })
  assert.equal(mjs, `${predecessor}-black-19-4003PT-MJS`)
  assert.equal(gtg, `${predecessor}-black-19-4003PT-GTG`)
  assert.notEqual(mjs, gtg)
  assert.equal(buildProcessedMaterialCode(predecessor, { ...dye, pantoneSystem: 'TPG' }), `${predecessor}-black-TPG-19-4003PT-MJS`)
  assert.throws(() => buildProcessedMaterialCode(predecessor, { ...dye, dyeMethod: undefined }), /MJS.*GTG/)
  assert.throws(() => buildProcessedMaterialCode(predecessor, { ...dye, dyeMethod: 'OTHER' } as unknown as MaterialProcessDraft), /MJS.*GTG/)
})

test('A, CT, AA and AB are exclusive printing identities, without an additional penetration flag', () => {
  const codes = ['A', 'CT', 'AA'].map(printSide => buildProcessedMaterialCode(predecessor, { ...print, printSide } as MaterialProcessDraft))
  codes.push(buildProcessedMaterialCode(predecessor, twoSides))
  assert.equal(new Set(codes).size, 4)
  assert.deepEqual(codes, [`${predecessor}-pl001197-AYH`, `${predecessor}-pl001197-CTYH`, `${predecessor}-pl001197-AAYH`, `${predecessor}-Fpl001197-Bpl001198-ABYH`])
  assert.throws(() => buildProcessedMaterialCode(predecessor, { ...print, printSide: undefined }), /A.*CT.*AA.*AB/)
  for (const penetration of [true, false]) assert.throws(() => buildProcessedMaterialCode(predecessor, { ...print, penetration } as unknown as MaterialProcessDraft), /不再单独/)
})

test('AB must explicitly identify the back pattern and version; it cannot substitute the front pattern', () => {
  assert.throws(() => buildProcessedMaterialCode(predecessor, { ...twoSides, backPatternCode: undefined }), /反面花型及其版本/)
  assert.throws(() => buildProcessedMaterialCode(predecessor, { ...twoSides, backPatternVersionId: undefined }), /反面花型及其版本/)
  assert.throws(() => buildProcessedMaterialCode(predecessor, { ...twoSides, backPatternVersionId: '  ' }), /反面花型及其版本/)
  for (const printSide of ['A', 'CT', 'AA'] as const) assert.throws(() => buildProcessedMaterialCode(predecessor, { ...twoSides, printSide }), /只选择一个花型/)
})

test('AB encodes both front and back delivery revisions, including different revisions of the same pattern code', () => {
  const baseline = buildProcessedMaterialCode(predecessor, twoSides)
  const frontRevised = buildProcessedMaterialCode(predecessor, { ...twoSides, deliveryRevisionSegment: 'R02' })
  const backRevised = buildProcessedMaterialCode(predecessor, { ...twoSides, backPatternVersionId: 'back-v2', backDeliveryRevisionSegment: 'R02' })
  assert.equal(frontRevised, `${predecessor}-Fpl001197R02-Bpl001198-ABYH`)
  assert.equal(backRevised, `${predecessor}-Fpl001197-Bpl001198R02-ABYH`)
  assert.equal(new Set([baseline, frontRevised, backRevised]).size, 3)
  assert.equal(buildProcessedMaterialCode(predecessor, { ...twoSides, backPatternCode: 'pl001197', backPatternVersionId: 'front-v2', backDeliveryRevisionSegment: 'R02' }), `${predecessor}-Fpl001197-Bpl001197R02-ABYH`)
  assert.throws(() => buildProcessedMaterialCode(predecessor, { ...twoSides, backDeliveryRevisionSegment: '2' }), /反面交付修订/)
})

test('read adapter code helpers require explicit modes and keep accepted upstream identity intact', async () => {
  const { buildAppendedVariantCode, buildDyeVariantCode } = await import('../../src/data/pcs-material-variant-repository.ts')
  assert.equal(buildDyeVariantCode(predecessor, 'black', '19-4003', 'GTG'), `${predecessor}-black-19-4003PT-GTG`)
  const step = { processType: 'print' as const, processCode: 'PRINTING', processName: '印花', patternCode: 'pl001197', printSide: 'CT' as const }
  assert.equal(buildAppendedVariantCode('PERSISTED-OLD-CODE', step), 'PERSISTED-OLD-CODE-pl001197-CTYH')
  assert.throws(() => buildAppendedVariantCode(predecessor, { ...step, printSide: undefined }), /A.*CT.*AA.*AB/)
  assert.equal(buildProcessedMaterialCode('PERSISTED-OLD-CODE', { ...print, processType: 'EMBROIDERY', printSide: undefined }), 'PERSISTED-OLD-CODE-pl001197XH')
  assert.equal(buildProcessedMaterialCode('PERSISTED-OLD-CODE', { ...print, processType: 'HEAT_TRANSFER', printSide: undefined }), 'PERSISTED-OLD-CODE-pl001197TH')
})

test('static demonstrations carry all six explicit modes and independent fees, without mutating source records', () => {
  // The demonstration also has one chain originating at this existing baseline SKU.
  const source = { version: 1, records: [], skuRecords: [{ materialSkuId: 'material_fabric_001_sku_001', materialId: 'existing', materialSkuCode: 'EXISTING-PERSISTED-CODE', mainUnit: 'Yard', pricingUnit: 'Yard' }], usageRecords: [], logRecords: [] } as unknown as MaterialArchiveStoreSnapshot
  const original = structuredClone(source)
  const result = addMaterialR1Demonstration(source)
  assert.deepEqual(source, original)
  assert.equal(result.skuRecords[0].materialSkuCode, 'EXISTING-PERSISTED-CODE')
  const definitions = result.processDefinitions!
  assert.deepEqual([...new Set(definitions.filter(item => item.processType === 'DYEING').map(item => item.dyeMethod))].sort(), ['GTG', 'MJS'])
  assert.deepEqual([...new Set(definitions.filter(item => item.processType === 'PRINTING').map(item => item.printSide))].sort(), ['A', 'AA', 'AB', 'CT'])
  assert.ok(definitions.every(item => !('penetration' in item)))
  const fee = (suffix: string) => result.costVersions!.find(item => item.materialSkuId === `material-r1-process-${suffix}`)!.processStandardCny
  assert.notEqual(fee('dye'), fee('dye-gtg'))
  assert.notEqual(fee('double'), fee('double-different'))
  assert.equal(fee('penetration'), null)
})
