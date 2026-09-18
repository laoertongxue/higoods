import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPmsProductPurchaseOrders,
  getPmsProductPurchaseOrder,
  listPmsProductPurchaseOrders,
  pmsProductPurchaseOrderAmount,
  pmsProductPurchaseOrderLineAmount,
  updatePmsProductPurchaseOrder,
  type PmsCreatePurchaseOrderInput,
} from '../../src/data/pms/product-purchase-orders.ts'
import { PMS_BUYER_ACTOR, PmsDomainError, listPmsLogs, roundPmsQty } from '../../src/data/pms/runtime.ts'

function baseInput(): PmsCreatePurchaseOrderInput {
  return {
    spu: 'HG-TS-2601',
    productName: '男款圆领T恤',
    imageUrl: '/tshirt-sample.jpg',
    purchaseType: '做货',
    area: '印尼',
    supplierName: '广州华盛制衣有限公司',
    warehouse: '印尼雅加达成品仓',
    expectedDeliveryDate: '2026-08-15',
    lines: [{ sku: 'HG-TS-2601-WH-M', color: '白色', size: 'M', qty: 100, standardPrice: 31.5, actualPrice: 31.25 }],
  }
}

test('种子采购单按 SRM 生成器规律补齐单据级与明细级字段', () => {
  const first = getPmsProductPurchaseOrder('CG-2026-0016')
  assert.ok(first)
  assert.equal(first.purchaser, '王采购')
  assert.equal(first.isUrgent, '否')
  assert.equal(first.isFirstOrder, '否')
  assert.equal(first.productionArea, '印尼')
  assert.equal(getPmsProductPurchaseOrder('CG-2026-0017')?.purchaser, '陈采购')
  assert.equal(getPmsProductPurchaseOrder('CG-2026-0019')?.isUrgent, '是')
  assert.equal(getPmsProductPurchaseOrder('CG-2026-0020')?.isFirstOrder, '是')
  const line = first.lines[0]
  assert.equal(line.bomNo, 'BOM-HG-TS-2601-01')
  assert.equal(line.bomVersion, 'V1.0')
  assert.equal(line.bomStatus, '已匹配')
  assert.equal(line.applicant, '张三')
  assert.equal(line.creator, '李四')
  assert.equal(line.weight, 0.35)
  assert.equal(getPmsProductPurchaseOrder('CG-2026-0019')?.lines[0].bomStatus, '未匹配')
  const garmentLine = getPmsProductPurchaseOrder('CG-2026-0022')?.lines[0]
  assert.equal(garmentLine?.needBom, false)
  assert.equal(garmentLine?.bomNo, '')
  assert.equal(garmentLine?.bomVersion, '')
  assert.equal(garmentLine?.bomStatus, '未匹配')
  assert.equal(garmentLine?.weight, 0.35)
  assert.ok(listPmsProductPurchaseOrders().length >= 12)
})

test('新建做货采购单保存采购专员、加急、首单、区域与明细字段并可回显', () => {
  const [created] = createPmsProductPurchaseOrders(
    [
      {
        ...baseInput(),
        purchaser: '陈采购',
        isUrgent: '是',
        isFirstOrder: '是',
        productionArea: '其他',
        remark: 'SRM 字段对齐验证',
        lines: [{ sku: 'HG-TS-2601-WH-M', color: '白色', size: 'M', qty: 120, standardPrice: 31.5, actualPrice: 31.25, applicant: '张三', creator: '李四', weight: 0.42 }],
      },
    ],
    PMS_BUYER_ACTOR,
  )
  const saved = getPmsProductPurchaseOrder(created.purchaseOrderNo)
  assert.ok(saved)
  assert.equal(saved.purchaser, '陈采购')
  assert.equal(saved.isUrgent, '是')
  assert.equal(saved.isFirstOrder, '是')
  assert.equal(saved.productionArea, '其他')
  assert.equal(saved.remark, 'SRM 字段对齐验证')
  const line = saved.lines[0]
  assert.equal(line.bomNo, 'BOM-HG-TS-2601-01')
  assert.equal(line.bomVersion, 'V1.0')
  assert.equal(line.bomStatus, '已匹配')
  assert.equal(line.applicant, '张三')
  assert.equal(line.creator, '李四')
  assert.equal(line.weight, 0.42)
  assert.ok(listPmsLogs('product-purchase-order', created.purchaseOrderNo).some((log) => log.action === '创建'))
})

test('未传新增字段时沿用默认值并保持既有命令兼容', () => {
  const [created] = createPmsProductPurchaseOrders([baseInput()], PMS_BUYER_ACTOR)
  assert.equal(created.purchaser, PMS_BUYER_ACTOR.name)
  assert.equal(created.isUrgent, '否')
  assert.equal(created.isFirstOrder, '否')
  assert.equal(created.productionArea, '印尼')
  assert.equal(created.lines[0].weight, 0.35)
  const [garment] = createPmsProductPurchaseOrders([{ ...baseInput(), purchaseType: '成衣', productionArea: '' }], PMS_BUYER_ACTOR)
  assert.equal(garment.productionArea, '印尼')
  assert.equal(garment.lines[0].needBom, false)
  assert.equal(garment.lines[0].bomStatus, '未匹配')
})

test('采购专员必填、做货必须选区域、重量非负均抛出中文 PmsDomainError', () => {
  assert.throws(
    () => createPmsProductPurchaseOrders([{ ...baseInput(), purchaser: '   ' }], PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'PPO_PURCHASER_REQUIRED' && /采购专员/.test(error.message),
  )
  assert.throws(
    () => createPmsProductPurchaseOrders([{ ...baseInput(), productionArea: '' }], PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'PPO_PRODUCTION_AREA_REQUIRED' && /采购区域/.test(error.message),
  )
  assert.throws(
    () => createPmsProductPurchaseOrders([{ ...baseInput(), lines: [{ ...baseInput().lines[0], weight: -0.1 }] }], PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'PPO_WEIGHT_INVALID' && /重量/.test(error.message),
  )
})

test('编辑采购单保存新增字段并回显，非法输入被阻断', () => {
  const [created] = createPmsProductPurchaseOrders([baseInput()], PMS_BUYER_ACTOR)
  updatePmsProductPurchaseOrder(
    created.purchaseOrderNo,
    {
      purchaser: '刘采购',
      isUrgent: '是',
      isFirstOrder: '否',
      productionArea: '其他',
      lines: [{ lineId: created.lines[0].lineId, qty: 150, actualPrice: 31.4, weight: 0.4 }],
    },
    PMS_BUYER_ACTOR,
  )
  const saved = getPmsProductPurchaseOrder(created.purchaseOrderNo)
  assert.ok(saved)
  assert.equal(saved.purchaser, '刘采购')
  assert.equal(saved.isUrgent, '是')
  assert.equal(saved.isFirstOrder, '否')
  assert.equal(saved.productionArea, '其他')
  assert.equal(saved.version, 2)
  assert.equal(saved.lines[0].qty, 150)
  assert.equal(saved.lines[0].weight, 0.4)
  assert.ok(listPmsLogs('product-purchase-order', created.purchaseOrderNo).some((log) => log.action === '编辑'))
  assert.throws(
    () => updatePmsProductPurchaseOrder(created.purchaseOrderNo, { purchaser: ' ' }, PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'PPO_PURCHASER_REQUIRED',
  )
  assert.throws(
    () => updatePmsProductPurchaseOrder(created.purchaseOrderNo, { productionArea: '' }, PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'PPO_PRODUCTION_AREA_REQUIRED',
  )
  assert.throws(
    () => updatePmsProductPurchaseOrder(created.purchaseOrderNo, { lines: [{ lineId: created.lines[0].lineId, qty: 150, actualPrice: 31.4, weight: -1 }] }, PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'PPO_WEIGHT_INVALID',
  )
})

test('BOM 状态与 bomMatched 一致，未发布 BOM 的做货明细为未匹配', () => {
  listPmsProductPurchaseOrders().forEach((order) => {
    order.lines.forEach((line) => {
      if (line.needBom) {
        assert.equal(line.bomStatus, line.bomMatched ? '已匹配' : '未匹配')
        assert.match(line.bomNo ?? '', /^BOM-/)
        assert.equal(line.bomVersion, 'V1.0')
        return
      }
      assert.equal(line.bomNo, '')
      assert.equal(line.bomVersion, '')
      assert.equal(line.bomStatus, '未匹配')
    })
  })
  const [jacket] = createPmsProductPurchaseOrders(
    [
      {
        ...baseInput(),
        spu: 'HG-JK-2605',
        productName: '轻薄夹克',
        area: '国内',
        productionArea: '国内',
        lines: [{ sku: 'HG-JK-2605-KH-M', color: '卡其', size: 'M', qty: 10, standardPrice: 112, actualPrice: 112 }],
      },
    ],
    PMS_BUYER_ACTOR,
  )
  assert.equal(jacket.lines[0].bomMatched, false)
  assert.equal(jacket.lines[0].bomStatus, '未匹配')
  assert.equal(jacket.lines[0].bomNo, 'BOM-HG-JK-2605-01')
})

test('行采购金额使用 roundPmsQty 且汇总等于逐行金额之和', () => {
  const order = getPmsProductPurchaseOrder('CG-2026-0016')
  assert.ok(order)
  order.lines.forEach((line) => {
    assert.equal(pmsProductPurchaseOrderLineAmount(line), roundPmsQty(line.actualPrice * line.qty))
  })
  const lineSum = order.lines.reduce((sum, line) => sum + pmsProductPurchaseOrderLineAmount(line), 0)
  assert.equal(pmsProductPurchaseOrderAmount(order), roundPmsQty(lineSum))
  const [created] = createPmsProductPurchaseOrders(
    [
      {
        ...baseInput(),
        lines: [
          { sku: 'HG-TS-2601-WH-M', color: '白色', size: 'M', qty: 3, standardPrice: 10, actualPrice: 10.005 },
          { sku: 'HG-TS-2601-BK-L', color: '黑色', size: 'L', qty: 7, standardPrice: 10, actualPrice: 3.333 },
        ],
      },
    ],
    PMS_BUYER_ACTOR,
  )
  assert.equal(
    pmsProductPurchaseOrderAmount(created),
    roundPmsQty(pmsProductPurchaseOrderLineAmount(created.lines[0]) + pmsProductPurchaseOrderLineAmount(created.lines[1])),
  )
})
