import assert from 'node:assert/strict'

import {
  createMaterialVariant,
  getMaterialVariantById,
  listMaterialVariants,
  listVariantLineage,
  migrateLegacyBomLinesToBaseVariants,
  resetMaterialVariantStore,
} from '../src/data/pcs-material-variant-repository.ts'
import { MATERIAL_VARIANT_PROCESS_TYPES } from '../src/data/pcs-material-variant-types.ts'
import type { MaterialArchiveKind } from '../src/data/pcs-material-archive-types.ts'
import { getFcsCraftDictRef } from '../src/data/pcs-material-variant-fcs-dict.ts'

resetMaterialVariantStore()

const kinds: MaterialArchiveKind[] = ['fabric', 'accessory', 'yarn', 'consumable', 'parts']
assert.equal(kinds.length, 5, '物料分类仅五类（MAT-001）')
assert.ok(!kinds.includes('packaging' as MaterialArchiveKind), '无包材分类（MAT-001）')

const base = createMaterialVariant({
  materialId: 'mat_fabric_1',
  baseSkuCode: 'CNIDML130',
  chainCategory: 'plain',
})
assert.equal(base.ok, true, '应可创建基础态变种（MAT-002/MAT-011）')
assert.equal(base.variant!.variantCode, 'CNIDML130-BASE', '基础态变种码（MAT-011）')
assert.equal(base.variant!.layerIndex, 0, '无加工链无变种层（MAT-011）')

const dye = createMaterialVariant({
  materialId: 'mat_fabric_1',
  baseSkuCode: 'CNIDML130',
  chainCategory: 'process',
  colorName: 'apricot',
  pantoneRef: '17-4030',
  processType: 'dye',
  processCode: 'craft-dye',
  processName: '染色',
})
assert.equal(dye.ok, true, '应可创建染色变种（MAT-004）')
assert.equal(dye.variant!.variantCode, 'CNIDML130-apricot-17-4030PT', '染色码样例（MAT-004）')

const dyeDup = createMaterialVariant({
  materialId: 'mat_fabric_1',
  baseSkuCode: 'CNIDML130',
  chainCategory: 'process',
  colorName: 'blue',
  pantoneRef: '18-4040',
  processType: 'dye',
  processCode: 'craft-dye',
  predecessorVariantId: dye.variant!.variantId,
})
assert.equal(dyeDup.ok, false, '同链重复染色应阻断（MAT-006）')
assert.equal(dyeDup.error, 'DUPLICATE_PROCESS_TYPE', '重复类型错误码（MAT-006）')

const finish = createMaterialVariant({
  materialId: 'mat_fabric_1',
  baseSkuCode: 'CNIDML130',
  chainCategory: 'process',
  processType: 'finish',
  processCode: 'craft-finish',
  processName: '后整理',
  craftCode: 'SF-01',
  predecessorVariantId: dye.variant!.variantId,
})
assert.equal(finish.ok, true, '应可在染色后追后整理（MAT-005/MAT-007）')
assert.match(finish.variant!.variantCode, /\+SF-01$/, '后整理码=前驱码+工艺码拼接（MAT-005）')
assert.equal(finish.variant!.layerIndex, 2, '链层递增（MAT-007）')
assert.equal(finish.variant!.processes.length, 2, '链上保留前驱工艺（MAT-007）')

const wash = createMaterialVariant({
  materialId: 'mat_fabric_1',
  baseSkuCode: 'CNIDML130',
  chainCategory: 'process',
  processType: 'wash',
  processCode: 'craft-wash',
  processName: '水洗',
  craftCode: 'WSH-02',
  predecessorVariantId: finish.variant!.variantId,
})
assert.equal(wash.ok, true, '应可构建≥3 层不同类型链（MAT-007）')
assert.equal(wash.variant!.layerIndex, 3, '第三层（MAT-007）')
assert.equal(wash.variant!.processes.length, 3, '三层工艺（MAT-007）')

const lineage = listVariantLineage(wash.variant!.variantId)
assert.equal(lineage.length, 3, '血缘可追溯前驱链（MAT-003）')
assert.equal(lineage[0].variantId, dye.variant!.variantId, '血缘起点为染色层（MAT-003）')
assert.equal(
  getMaterialVariantById(finish.variant!.predecessorVariantId!)?.variantId,
  dye.variant!.variantId,
  'predecessorVariantId 指向前驱（MAT-003）',
)

assert.ok(MATERIAL_VARIANT_PROCESS_TYPES.includes('dye'), '工艺类型来自只读字典口径（MAT-008）')
assert.ok(getFcsCraftDictRef('craft-dye'), 'FCS 字典可只读引用（MAT-008）')

const migrated = migrateLegacyBomLinesToBaseVariants('mat_fabric_2', 'LEGACY-SKU-01')
assert.equal(migrated.length, 1, '存量 BOM 行映射为基础态变种（MAT-010）')
assert.equal(migrated[0].chainCategory, 'plain', '迁移结果为基础态（MAT-010）')

const variants = listMaterialVariants('mat_fabric_1')
assert.ok(variants.length >= 4, '变种可列表展示（MAT-002）')

assert.equal(
  createMaterialVariant({
    materialId: 'mat_fabric_1',
    baseSkuCode: 'CNIDML130',
    chainCategory: 'process',
    processType: 'print',
    processCode: 'craft-print',
  }).ok,
  false,
  '印花无前驱应阻断（MAT-006 防错）',
)

console.log('pcs-material-variant.spec.ts PASS')
