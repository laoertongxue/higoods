import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'
import type { SewingPickupSlipVersion } from '../../src/data/fcs/sewing-pickup-slips.ts'
import { buildPpicPickupSlipPrintDocument, renderMaterialSlipTemplate } from '../../src/pages/print/templates/ppic-pickup-slip-template.ts'

function version(): SewingPickupSlipVersion {
  return {
    slipId: 'PRINT-SLIP', slipNo: 'LL-001', versionId: 'PRINT-SLIP-V2', versionNo: 2, versionLabel: 'V2', status: 'CURRENT',
    assignmentId: 'ASSIGN-A', runtimeTaskId: 'TASK-A', taskNo: 'TASK-001', productionOrderId: 'PO-A', productionOrderNo: 'SC-001', taskKindLabel: '裁剪+车缝+烫包',
    factoryId: 'SEW-A', factoryName: '车缝厂A', ppicId: 'PPIC-A', ppicName: '跟单A', warehouseName: 'HILON辅料仓', objectKind: 'FABRIC_ACCESSORY',
    styleCode: 'ST-A', styleName: '测试款', styleImageUrl: '/shirt-sample.jpg', printedAt: '2026-10-19 09:00:00', printedByPpicId: 'PPIC-A', printedByPpicName: '跟单A',
    lines: [
      { lineId: 'FAB', sourceLineId: 'BOM-FAB', objectType: '面料', objectCode: 'FAB-A', objectName: '主面料', color: '红', size: 'M', part: '主身', unit: '米', requiredQty: 60, previouslyHandedOverQty: 10, availableQty: 50, imageUrl: '/materials/fabric.jpg' },
      { lineId: 'ZIP', sourceLineId: 'BOM-ZIP', objectType: '辅料', objectCode: 'ZIP-A', objectName: '拉链', color: '红', size: 'M', part: '前中', unit: '条', requiredQty: 40, previouslyHandedOverQty: 3, availableQty: 37, imageUrl: '/materials/zip.jpg' },
    ],
  }
}

test('轻量PPIC纸面保留混合物料原数量、单位、图片、二维码和责任对象', () => {
  const source = version(), before = structuredClone(source)
  const document = buildPpicPickupSlipPrintDocument({ documentType: 'PICKUP_SLIP', sourceType: 'PICKUP_SLIP_RECORD', sourceId: source.versionId }, source)
  assert.deepEqual(source, before)
  assert.equal(document.printTitle, '面辅料领料单')
  assert.equal(document.sourceId, source.versionId)
  assert.deepEqual(document.tables[0].rows.map(row => [row[5], row[6], row[7], row[10]]), [['60 米', '10 米', '50 米', '米'], ['40 条', '3 条', '37 条', '条']])
  assert.deepEqual(document.imageBlocks.map(image => image.imageUrl), ['/shirt-sample.jpg', '/materials/fabric.jpg', '/materials/zip.jpg'])
  const qr = new URLSearchParams(document.qrCodes[0].value)
  assert.equal(qr.get('sourceId'), source.versionId)
  assert.equal(qr.get('slipNo'), source.slipNo)
  assert.match(qr.get('targetRoute')!, /sewingPickupVersionId=PRINT-SLIP-V2/)
  assert.ok(document.headerFields.some(field => field.label === '打印版本' && field.value === 'V2 · 当前有效'))
  assert.ok(document.headerFields.some(field => field.label === '交出仓库' && field.value === 'HILON辅料仓'))
  const html = renderMaterialSlipTemplate(document)
  assert.match(html, /print-paper-a4/)
  assert.match(html, /50 米/)
  assert.match(html, /37 条/)
  assert.match(html, /HILON辅料仓/)
})

test('已作废版本仍保留原版本及历史数量，纯辅料和历史裁片标题不改变', () => {
  for (const [objectKind, title] of [['ACCESSORY', '辅料领料单'], ['CUT_PIECE', '裁片领料单']] as const) {
    const source = { ...version(), objectKind, status: 'VOIDED' as const }
    const document = buildPpicPickupSlipPrintDocument({ documentType: 'PICKUP_SLIP', sourceType: 'PICKUP_SLIP_RECORD', sourceId: source.versionId }, source)
    assert.equal(document.printTitle, title)
    assert.ok(document.headerFields.some(field => field.label === '打印版本' && field.value === 'V2 · 已失效'))
    assert.equal(document.tables[0].rows[0][6], '10 米')
    assert.equal(new URLSearchParams(document.qrCodes[0].value).get('sourceId'), 'PRINT-SLIP-V2')
  }
})

test('图片交互契约仅用于PICKUP_SLIP，其他物料凭证保留原纸面图片', () => {
  const source = version()
  const document = buildPpicPickupSlipPrintDocument({ documentType: 'PICKUP_SLIP', sourceType: 'PICKUP_SLIP_RECORD', sourceId: source.versionId }, source)
  const pickupHtml = renderMaterialSlipTemplate(document)
  assert.equal((pickupHtml.match(/data-print-image-url=/g) || []).length, 3)
  assert.equal((pickupHtml.match(/<img\b/g) || []).length, 3)
  for (const documentType of ['MATERIAL_PREP_SLIP', 'ISSUE_SLIP'] as const) {
    const html = renderMaterialSlipTemplate({ ...document, documentType })
    assert.equal(html.includes('data-print-image-url'), false)
    assert.equal(html.includes('data-print-image-frame'), false)
    assert.equal((html.match(/<img\b/g) || []).length, 3)
  }
})

test('已保存PPIC纸面入口不载入旧裁床Mock、裁床投影或全模板注册表', async () => {
  const result = await build({ entryPoints: ['src/pages/print/templates/ppic-pickup-slip-template.ts'], bundle: true, write: false, metafile: true, platform: 'browser', format: 'esm', logLevel: 'silent' })
  const dependencies = Object.keys(result.metafile!.inputs)
  assert.equal(dependencies.some(path => /(?:domain\/pickup\/mock|pda-cutting-execution-source|material-prep-projection|runtime-process-tasks|print-template-registry)\.ts$/.test(path)), false, dependencies.join('\n'))
})
