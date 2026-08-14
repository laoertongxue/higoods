import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildFeiTicketLabelPrintProjection } from '../src/pages/process-factory/cutting/fei-ticket-print-projection.ts'

const baseRecord = {
  feiTicketId: 'ticket-acceptance-001',
  feiTicketNo: 'FT-ACCEPTANCE-001',
  cutOrderId: 'cut-order-acceptance-001',
  cutOrderNo: 'CUT-ACCEPTANCE-001',
  productionOrderId: 'production-order-acceptance-001',
  productionOrderNo: 'PO-ACCEPTANCE-001',
  markerPlanId: 'marker-plan-acceptance-001',
  markerPlanNo: 'MP-ACCEPTANCE-001',
  markerNumber: 'MK4556',
  spreadingOrderId: 'spreading-order-acceptance-001',
  spreadingOrderNo: 'PB947',
  sourceTechPackSpuCode: 'ASYNR26022601',
  styleName: '验收款式',
  color: 'Blue-B-S98',
  size: 'XL',
  partCode: 'FRONT',
  partName: '前片',
  quantity: 18,
  layerCount: 18,
  partQuantityPerGarment: 1,
  materialSku: 'ASYNR26022601-FABRIC-A',
  materialIdentity: {
    materialName: '四面弹120g S98',
    materialAlias: '面kainA衬衣',
  },
  pieceSequenceLabel: '001-018',
  issuedAt: '2026-08-13 10:00:00',
}

const ordinary = buildFeiTicketLabelPrintProjection({ ...baseRecord, hasSpecialCraft: false })
const special = buildFeiTicketLabelPrintProjection({
  ...baseRecord,
  feiTicketId: 'ticket-acceptance-002',
  feiTicketNo: 'FT-ACCEPTANCE-002',
  hasSpecialCraft: true,
  specialCrafts: [{
    craftCategory: '辅助工艺',
    craftType: '绣花',
    receiverFactoryCode: 'SCF-001',
    receiverFactoryName: '绣花承接工厂',
  }],
})

assert.equal(ordinary.templateSize, '10cm x 10cm')
assert.equal(special.templateSize, '10cm x 10cm', '特殊工艺菲票必须与普通菲票使用相同物理尺寸')
assert.equal(ordinary.materialNameLabel, '四面弹120g S98')
assert.equal(ordinary.materialAliasLabel, '面kainA衬衣')
assert.equal(ordinary.markerNumber, 'MK4556')
assert.equal(ordinary.spreadingOrderNo, 'PB947')
assert.deepEqual(ordinary.specialCraftDisplayLines, ['无'])
assert.match(special.specialCraftDisplayLines.join(' / '), /绣花/)
assert.match(special.receiverFactoryDisplayLines.join(' / '), /绣花承接工厂/)

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const templateSource = readFileSync(`${projectRoot}/src/pages/print/templates/label-print-template.ts`, 'utf8')
const printStylesSource = readFileSync(`${projectRoot}/src/pages/print/print-styles.ts`, 'utf8')
const feiPageSource = readFileSync(`${projectRoot}/src/pages/process-factory/cutting/fei-tickets.ts`, 'utf8')
const printDocumentSegment = templateSource.slice(
  templateSource.indexOf('export function buildFeiTicketLabelPrintDocument'),
  templateSource.indexOf('export const buildFeiTicketReprintLabelPrintDocument'),
)

assert.match(printDocumentSegment, /'LABEL_100_100'/, '普通/特殊部位菲票应统一选择 100mm × 100mm 纸型')
assert.doesNotMatch(printDocumentSegment, /LABEL_150_100/, '部位菲票打印构建不得再选择 150mm × 100mm')
assert.match(printDocumentSegment, /白色热敏纸菲票与黄色热敏纸菲票不能合并打印/, '白色/黄色热敏纸分流门禁必须保留')
assert.match(printDocumentSegment, /承接工厂未明确，禁止正式打印/, '特殊工艺承接工厂门禁必须保留')
assert.match(templateSource, /label: '面料名称'/)
assert.match(templateSource, /label: '面料别名'/)
assert.match(templateSource, /label: '唛架编号'/)
assert.match(templateSource, /label: '铺布单号'/)
assert.match(templateSource, /renderFeiBusinessLinePairCell/, '面料/颜色与唛架/铺布应采用两行单元格')
assert.match(templateSource, /binding-strip-fei-ticket-business-card/, '捆条菲票必须使用独立的固定纸张布局')
assert.match(templateSource, /binding-strip-fei-ticket-business-grid/, '捆条菲票必须使用独立的紧凑信息网格')
assert.match(templateSource, /binding-strip-fei-ticket-business-qr-panel/, '捆条菲票二维码必须使用独立的底部区域')
assert.match(printStylesSource, /\.label-paper-label-100-100\s*\{[\s\S]*?width:\s*100mm;[\s\S]*?height:\s*100mm;/)
assert.match(
  printStylesSource,
  /\.binding-strip-fei-ticket-business-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
  '捆条菲票信息区必须使用三列网格，避免两列字段把 100mm 纸张撑高',
)
assert.match(
  printStylesSource,
  /\.binding-strip-fei-ticket-business-card\s+\.fei-ticket-business-body\s*\{[\s\S]*?grid-template-rows:\s*minmax\(0,\s*1fr\)\s+22mm;/,
  '捆条菲票正文必须为二维码预留固定底部空间',
)
assert.match(feiPageSource, /固定 10cm × 10cm/)
assert.doesNotMatch(feiPageSource, /特殊工艺菲票建议使用 15cm/)

console.log('cutting Fei-ticket fixed print layout contract passed')
