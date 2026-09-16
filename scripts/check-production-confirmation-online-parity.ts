import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { buildProductionConfirmationSnapshot, getProductionConfirmationByOrderId } from '../src/data/fcs/production-confirmation.ts'
import {
  buildProductionConfirmationPrintDocument,
  renderProductionConfirmationTemplate,
} from '../src/pages/print/templates/production-material-confirmation-template.ts'

const order = productionOrders.find((row) => row.productionOrderId === 'PO-202603-0002')!
assert(order.techPackSnapshot)
const original = structuredClone(order.techPackSnapshot)
const originalSkuLines = structuredClone(order.demandSnapshot.skuLines)
try {
  order.demandSnapshot.skuLines = [{ skuCode: 'PARITY-GREY-M', color: 'Grey', size: 'M', qty: 2102 }]
  order.techPackSnapshot.onlineConfirmationFacts = {
    sourceRef: 'contract-fixture:production-confirmation:PO-202603-0002',
    purchaseOrderNos: ['PURCHASE-PARITY-1', 'PURCHASE-PARITY-2'],
    retailTagPrice: { amount: 302000, currency: 'IDR', sourceRef: 'contract-fixture:product-price' },
    milestones: [{ key: 'cuttingCompleted', actualAt: '2026-09-15 14:30', sourceRef: 'contract-fixture:cutting-record' }],
    fabricRolls: [{ rollId: 'ROLL-PARITY-1', sourceRef: 'contract-fixture:roll-1' }, { rollId: 'ROLL-PARITY-1', sourceRef: 'contract-fixture:roll-1-copy' }, { rollId: 'ROLL-PARITY-2', sourceRef: 'contract-fixture:roll-2' }],
    originalLabelFields: [{ label: 'Apakah itu undang-undang dasar', value: '否', sourceRef: 'contract-fixture:original-field' }],
    colorImages: [{ color: 'Grey', skuCodes: ['PARITY-GREY-M'], imageUrl: '/jacket-sample.jpg', sourceRef: 'contract-fixture:color-image' }],
  }
  order.techPackSnapshot.bomItems[0].unitConsumption = 0.142
  order.techPackSnapshot.bomItems[0].unit = 'Yard'
  order.techPackSnapshot.bomItems[0].lossRate = 0.05
  order.techPackSnapshot.bomItems[0].applicableSkuCodes = ['PARITY-GREY-M']
  const snap = buildProductionConfirmationSnapshot(order.productionOrderId)
  assert.equal(snap.bomSnapshot[0].netUsageQty, 298.484, '2102 × 0.142 的三位小数必须保留')
  assert.equal(snap.bomSnapshot[0].plannedUsageQty, 313.4082, '含损耗备料量不能被版式修改覆盖为净用量')
  assert.equal(snap.onlineDisplaySnapshot.fabricRollIds?.length, 2, '布卷按唯一卷号去重')
  assert.equal(snap.onlineDisplaySnapshot.retailTagPrice?.currency, 'IDR')
  assert.equal(snap.onlineDisplaySnapshot.orderDate, order.createdAt, '未提供专属日期时只能读取生产单创建事实')
  assert.equal(snap.onlineDisplaySnapshot.milestones.find((row) => row.key === 'factoryArrived'), undefined, '不得制造未发生节点')
  assert.equal(snap.onlineDisplaySnapshot.colorImages[0].color, 'Grey', '颜色图有明确颜色身份')
  assert(snap.onlineDisplaySnapshot.originalLabelFields.every((row) => row.sourceRef))
  const printableOrder = productionOrders.find((row) => getProductionConfirmationByOrderId(row.productionOrderId))!
  const doc = buildProductionConfirmationPrintDocument(printableOrder.productionOrderId)
  // Use this isolated mapping fixture without changing the saved production-confirmation version.
  const html = renderProductionConfirmationTemplate({ ...doc, confirmationSnapshot: snap })
  assert(html.includes('298.484 Yard'))
  assert(html.includes('313.4082 Yard'))
  assert(html.includes('含损耗备料'))
  assert(html.includes('data-real-barcode'))
  assert(html.includes(`data-barcode-value="${order.productionOrderNo}"`))
  const expectedSections = ['warna &amp; gambar', 'Kain &amp; aksesoris', 'Daftar SK', 'Graf ukura']
  let last = -1
  expectedSections.forEach((label) => { const next = html.indexOf(label); assert(next > last, `区块顺序不符：${label}`); last = next })
  assert(!html.includes('PrintDocument'))
  assert(!html.includes('已关联物料图'))
  assert(!html.includes('local://'), '没有文件来源时不能构造假链接')
  assert(html.includes('未发生'), '节点未发生要明确表达')
  assert(html.includes('data-print-image'), '图片必须接入预览与加载门禁')
  assert(html.includes('直译：那是宪法吗？') && html.includes('相同的'), '按用户确认提供原印尼语直译，不猜服装业务含义')
  assert(html.includes('302000.00 IDR'), '吊牌价与币种成对展示')
  assert.equal(snap.productionOrderSnapshot.plannedQty, snap.sizeQtySnapshot.rows.reduce((sum, row) => sum + row.totalQty, 0))
  order.techPackSnapshot.onlineConfirmationFacts = { sourceRef: 'contract-fixture:missing' }
  const absent = buildProductionConfirmationSnapshot(order.productionOrderId)
  assert.equal(absent.onlineDisplaySnapshot.retailTagPrice, undefined)
  assert.equal(absent.onlineDisplaySnapshot.fabricRollIds, null, '没有卷资料应为未维护，不能猜 0 卷')
  assert.equal(absent.onlineDisplaySnapshot.colorImages.length, 0, '不能把无键图片数组随机对应颜色')
  console.log('[check-production-confirmation-online-parity] PASS: sourced fields, precision, roll identity, keyed images, real barcode, six-section layout and honest missing values')
} finally {
  order.techPackSnapshot = original
  order.demandSnapshot.skuLines = originalSkuLines
}

const manifestPath = resolve('public/production-confirmation-demo/sources.json')
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { assets: Array<{ path: string }> }
  manifest.assets.forEach((asset) => assert(existsSync(resolve('public', asset.path.replace(/^\//, ''))), `缺少附件：${asset.path}`))
}
