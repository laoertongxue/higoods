import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createTechnicalDataVersionBootstrapSnapshot } from '../../src/data/pcs-technical-data-version-bootstrap.ts'
import { getMaterialArchiveBaseline } from '../../src/data/pcs-material-archive-repository.ts'
import { projectUneditedLegacyTechnicalDemo } from '../../src/data/pcs-technical-data-demo-projection.ts'
import {
  LEGACY_QC_MATERIAL_DEMO_REVISION,
  LEGACY_QC_MATERIAL_BINDINGS,
  completeLegacyQcMaterialDemoContent,
  getLegacyQcDemoMaterialBinding,
} from '../../src/data/pcs-legacy-qc-demo-materials.ts'
import type { TechnicalDataVersionStoreSnapshot } from '../../src/data/pcs-technical-data-version-types.ts'

const readJson = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const frozen = readJson('../../src/data/fcs/production-order-demo-tech-packs.json')
const colors = ['黑色', '白色', '雾蓝', '卡其', '酒红']

test('原三款静态正式资料与既有物料SPU/SKU逐一绑定，图片只识别本白/白色/本色原料', () => {
  const materials = getMaterialArchiveBaseline()
  const pcs = createTechnicalDataVersionBootstrapSnapshot(5)
  assert.equal(LEGACY_QC_MATERIAL_DEMO_REVISION, 'legacy-qc-material-demo-20261022-v1')
  assert.equal(LEGACY_QC_MATERIAL_BINDINGS.length, 3)
  for (const binding of LEGACY_QC_MATERIAL_BINDINGS) {
    const material = materials.records.find(row => row.materialId === binding.materialId)!
    const sku = materials.skuRecords.find(row => row.materialSkuId === binding.materialSkuId)!
    assert.ok(material); assert.ok(sku)
    assert.equal(material.kind, 'fabric')
    assert.equal(material.materialCode, binding.materialCode)
    assert.equal(sku.materialId, material.materialId)
    assert.equal(sku.materialSkuCode, binding.materialSkuCode)
    assert.equal(sku.skuImageUrl, binding.imageUrl)
    const image = readFileSync(new URL('../../public' + binding.imageUrl, import.meta.url))
    assert.equal(createHash('sha256').update(image).digest('hex'), binding.imageSha256)
    const content = pcs.contents.find(row => row.technicalVersionId === binding.technicalVersionId)!
    const snapshot = frozen[binding.productionOrderId]
    assert.equal(content.bomItems.length, 1)
    assert.equal(snapshot.bomItems.length, 1)
    const bom = content.bomItems[0]
    assert.equal(bom.id, binding.technicalVersionId + '-bom-main')
    for (const row of [bom, snapshot.bomItems[0]]) {
      assert.equal(row.materialCode, binding.materialCode)
      assert.equal(row.materialSkuId, binding.materialSkuId)
      assert.equal(row.materialSkuCode, binding.materialSkuCode)
      assert.equal(row.name, binding.materialName)
      assert.equal(row.colorLabel, binding.colorLabel)
      assert.equal(row.unit, binding.unit)
      assert.equal(row.unitConsumption, 1.2)
      assert.equal(row.lossRate, .03)
      assert.deepEqual(row.usageProcessCodes, ['CUT_PANEL', 'SEW'])
      assert.match(row.remark!, new RegExp(LEGACY_QC_MATERIAL_DEMO_REVISION))
      assert.equal(row.supplier, '原型演示资料')
    }
    assert.equal(snapshot.bomItems[0].materialImageUrl, binding.imageUrl)
    assert.equal(snapshot.bomItems[0].materialAlias, binding.imageLabel)
    assert.deepEqual(snapshot.imageSnapshot.materialImages, [binding.imageUrl])
    assert.deepEqual([...new Set(content.processEntries.map(row => row.processCode))], ['CUT_PANEL', 'SEW'])
    assert.deepEqual([...new Set(snapshot.processEntries.map((row: any) => row.processCode))], ['CUT_PANEL', 'SEW'])
  }
})

test('五个成衣目标色及SKU范围保留，款色/裁片不把一个白色原料SKU冒充五种已染布', () => {
  const pcs = createTechnicalDataVersionBootstrapSnapshot(5)
  for (const binding of LEGACY_QC_MATERIAL_BINDINGS) {
    const content = pcs.contents.find(row => row.technicalVersionId === binding.technicalVersionId)!
    const snapshot = frozen[binding.productionOrderId]
    const skuCodes = colors.map((_, i) => binding.styleCode + '-' + String(i + 1).padStart(2, '0'))
    assert.deepEqual(content.bomItems[0].applicableSkuCodes, skuCodes)
    assert.deepEqual(snapshot.bomItems[0].applicableSkuCodes, skuCodes)
    assert.deepEqual(content.colorMaterialMappings.map(row => row.colorName), colors)
    assert.deepEqual(snapshot.colorMaterialMappings.map((row: any) => row.colorName), colors)
    for (const mappings of [content.colorMaterialMappings, snapshot.colorMaterialMappings]) for (const mapping of mappings) {
      assert.match(mapping.remark, /成衣目标色/)
      assert.ok(mapping.remark.includes(mapping.colorName))
      assert.equal(mapping.lines.length, 3)
      for (const line of mapping.lines) {
        assert.equal(line.bomItemId, content.bomItems[0].id)
        assert.equal(line.materialCode, binding.materialCode)
        assert.equal(line.materialName, binding.materialName)
        assert.equal(line.unit, binding.unit)
        assert.match(line.note, /不表示.*已染/)
      }
    }
    assert.equal(snapshot.cutPieceParts.length, 3)
    for (const part of snapshot.cutPieceParts) {
      assert.equal(part.materialSku, binding.materialSkuCode)
      assert.equal(part.materialName, binding.materialName)
      assert.equal(part.fabricColor, binding.colorLabel)
      assert.deepEqual(part.applicableColorList, colors)
      assert.match(part.remark, /适用成衣目标色/)
    }
    assert.equal(snapshot.imageSnapshot.styleImages.length, 5)
    assert.ok(snapshot.imageSnapshot.styleImages.every((url: string) => !snapshot.imageSnapshot.materialImages.includes(url)))
  }
})

test('新补全只处理三个确切静态身份，拒绝把未知/不完整BOM当可自动补图模板', () => {
  const pcs = createTechnicalDataVersionBootstrapSnapshot(5)
  const source = pcs.contents.find(row => row.technicalVersionId === 'tdv_demand_SPU_QC_001')!
  const copy = structuredClone(source), before = JSON.stringify(copy)
  const completed = completeLegacyQcMaterialDemoContent(copy)!
  assert.equal(JSON.stringify(copy), before)
  completed.bomItems[0].name = 'local caller edit'
  assert.notEqual(copy.bomItems[0].name, completed.bomItems[0].name)
  assert.equal(getLegacyQcDemoMaterialBinding('tdv_demand_SPU_QC_001-extra'), undefined)
  assert.equal(completeLegacyQcMaterialDemoContent({ ...copy, technicalVersionId: 'unknown-demo' }), null)
  assert.throws(() => completeLegacyQcMaterialDemoContent({ ...copy, bomItems: [] }), /主面料/)
  assert.throws(() => completeLegacyQcMaterialDemoContent({ ...copy, bomItems: [...copy.bomItems, { ...copy.bomItems[0], id: 'extra' }] }), /主面料/)
})

test('既存三款已保存内容与自定义图片不被当前静态修订投影覆盖，也不补回单独删除的记录', () => {
  const baseline = readJson('../../src/data/generated/pcs-record-baseline.json')
  const historical = JSON.parse(baseline['higood-pcs-technical-data-version-store-v5']) as TechnicalDataVersionStoreSnapshot
  const current = createTechnicalDataVersionBootstrapSnapshot(5)
  const selected = new Set(LEGACY_QC_MATERIAL_BINDINGS.map(row => row.technicalVersionId))
  const old: TechnicalDataVersionStoreSnapshot = { ...historical,
    records: historical.records.filter(row => selected.has(row.technicalVersionId)),
    contents: historical.contents.filter(row => selected.has(row.technicalVersionId)), pendingItems: [] }
  const before = JSON.stringify(old)
  const projected = projectUneditedLegacyTechnicalDemo(old, current)
  assert.equal(JSON.stringify(old), before)
  assert.deepEqual(projected.contents, old.contents)
  assert.ok(projected.contents.every(row => row.bomItems.length === 3), '真实旧generated基线的三面料不能被新单面料替代')
  old.contents[0].bomItems[0] = { ...old.contents[0].bomItems[0], materialSkuId: 'USER-PRESERVED-SKU', remark: '原保存依据', colorLabel: '用户维护颜色' }
  ;(old.contents[0].bomItems[0] as any).materialImageUrl = '/user-owned-specific-material.jpg'
  const edited = projectUneditedLegacyTechnicalDemo(old, current)
  assert.deepEqual(edited.contents, old.contents)
  const removedId = LEGACY_QC_MATERIAL_BINDINGS[2].technicalVersionId
  const deleted: TechnicalDataVersionStoreSnapshot = { ...old, records: old.records.filter(row => row.technicalVersionId !== removedId), contents: old.contents.filter(row => row.technicalVersionId !== removedId) }
  const result = projectUneditedLegacyTechnicalDemo(deleted, current)
  assert.ok(!result.records.some(row => row.technicalVersionId === removedId))
  assert.ok(!result.contents.some(row => row.technicalVersionId === removedId))
})

