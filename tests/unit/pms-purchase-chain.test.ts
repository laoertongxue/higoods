import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inboundPmsKolDemand,
  listPmsSuggestionViews,
  markSuggestionConverted,
  rejectPmsKolDemand,
} from '../../src/data/pms/purchase-suggestions.ts'
import {
  checkPmsGenerateMaterialRequirement,
  closePmsProductPurchaseOrder,
  createPmsProductPurchaseOrders,
  generatePmsMaterialRequirement,
  getPmsProductPurchaseOrder,
} from '../../src/data/pms/product-purchase-orders.ts'
import { listPmsMaterialRequirements } from '../../src/data/pms/material-requirements.ts'
import { PMS_BUYER_ACTOR, PMS_MANAGER_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

test('采购建议按缺口公式与折扣计算，并计入有效 KOL 申请', () => {
  const suggestion = listPmsSuggestionViews().find((row) => row.suggestionNo === 'PSG-2026-0001')
  assert.ok(suggestion)
  const whiteM = suggestion.skuItems.find((sku) => sku.sku === 'HG-TS-2601-WH-M')
  assert.ok(whiteM)
  assert.equal(whiteM.kolApplyQty, 600)
  assert.equal(whiteM.gapQty, 1800)
  assert.equal(whiteM.discount, 0.7)
  assert.equal(whiteM.suggestedQty, 1260)
  assert.equal(suggestion.totalSuggestedQty, 3780)
})

test('KOL 草稿与已驳回不计入建议缺口', () => {
  const draftSku = listPmsSuggestionViews()
    .flatMap((row) => row.skuItems)
    .find((sku) => sku.sku === 'HG-HD-2603-GY-M')
  assert.ok(draftSku)
  assert.equal(draftSku.kolApplyQty, 0)
})

test('建议转采购单后写回已转数量与部分生成状态', () => {
  const suggestion = listPmsSuggestionViews().find((row) => row.suggestionNo === 'PSG-2026-0002')
  assert.ok(suggestion)
  const firstSku = suggestion.skuItems[0]
  const [order] = createPmsProductPurchaseOrders(
    [
      {
        spu: suggestion.spu,
        productName: suggestion.productName,
        imageUrl: suggestion.imageUrl,
        purchaseType: suggestion.purchaseType,
        area: suggestion.area,
        supplierName: '佛山成衣加工厂',
        warehouse: '印尼雅加达成品仓',
        expectedDeliveryDate: '2026-07-30',
        sourceSuggestionNo: suggestion.suggestionNo,
        lines: [{ sku: firstSku.sku, color: firstSku.color, size: firstSku.size, qty: firstSku.availableQty, standardPrice: 58.6, actualPrice: 58.6 }],
      },
    ],
    PMS_BUYER_ACTOR,
  )
  markSuggestionConverted(suggestion.suggestionNo, order.purchaseOrderNo, [{ sku: firstSku.sku, qty: firstSku.availableQty }], PMS_BUYER_ACTOR)
  const converted = listPmsSuggestionViews().find((row) => row.suggestionNo === 'PSG-2026-0002')
  assert.ok(converted)
  assert.equal(converted.status, '部分生成')
  assert.equal(converted.skuItems.find((sku) => sku.sku === firstSku.sku)?.availableQty, 0)
})

test('面辅料需求按 BOM 用量与损耗扣减库存和采购中', () => {
  const result = generatePmsMaterialRequirement('CG-2026-0016', PMS_BUYER_ACTOR)
  const fabric = result.lines.find((line) => line.materialCode === 'FAB-2026-0001')
  assert.ok(fabric)
  assert.equal(fabric.plannedUsage, 0.3675)
  assert.equal(fabric.bomDemand, 2241.75)
  assert.equal(fabric.suggestedQty, 441.75)
  assert.equal(getPmsProductPurchaseOrder('CG-2026-0016')?.lines[0].materialStatus, '已生成')
  assert.ok(listPmsMaterialRequirements().some((requirement) => requirement.requirementNo === result.requirementNo))
})

test('重复生成、草稿采购单与非做货采购单均被阻断', () => {
  const repeated = checkPmsGenerateMaterialRequirement('CG-2026-0016')
  assert.equal(repeated.ok, false)
  assert.match(repeated.reason, /已经生成/)
  const draft = checkPmsGenerateMaterialRequirement('CG-2026-0019')
  assert.equal(draft.ok, false)
  assert.match(draft.reason, /草稿/)
  const garment = checkPmsGenerateMaterialRequirement('CG-2026-0022')
  assert.equal(garment.ok, false)
  assert.match(garment.reason, /做货/)
})

test('KOL 单条超量需要二次确认，超过申请量直接阻断', () => {
  assert.throws(
    () => inboundPmsKolDemand('KOL-2026-0002', { qty: 260, note: '' }, PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'KOL_OVER_CONFIRM_REQUIRED',
  )
  assert.throws(
    () => inboundPmsKolDemand('KOL-2026-0002', { qty: 999, note: '', overConfirm: true }, PMS_BUYER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'KOL_OVER_APPLY',
  )
})

test('驳回 KOL 需求后不再计入建议缺口', () => {
  rejectPmsKolDemand('KOL-2026-0006', '直播档期取消', PMS_BUYER_ACTOR)
  const sku = listPmsSuggestionViews()
    .flatMap((row) => row.skuItems)
    .find((item) => item.sku === 'HG-SK-2604-NV-M')
  assert.ok(sku)
  assert.equal(sku.kolApplyQty, 0)
})

test('关闭采购单必须填写原因且已关闭不可重复关闭', () => {
  const [order] = createPmsProductPurchaseOrders(
    [
      {
        spu: 'HG-SH-2607',
        productName: '商务衬衫',
        imageUrl: '/shirt-sample.jpg',
        purchaseType: '做货',
        area: '印尼',
        supplierName: '宁波衬衫制造有限公司',
        warehouse: '印尼雅加达成品仓',
        expectedDeliveryDate: '2026-08-10',
        lines: [{ sku: 'HG-SH-2607-WH-M', color: '白色', size: 'M', qty: 500, standardPrice: 49, actualPrice: 49 }],
      },
    ],
    PMS_BUYER_ACTOR,
  )
  assert.throws(() => closePmsProductPurchaseOrder(order.purchaseOrderNo, '', PMS_MANAGER_ACTOR), PmsDomainError)
  closePmsProductPurchaseOrder(order.purchaseOrderNo, '终端取消', PMS_MANAGER_ACTOR)
  assert.equal(getPmsProductPurchaseOrder(order.purchaseOrderNo)?.status, '已关闭')
  assert.throws(
    () => closePmsProductPurchaseOrder(order.purchaseOrderNo, '再次关闭', PMS_MANAGER_ACTOR),
    (error: unknown) => error instanceof PmsDomainError && error.code === 'PPO_CLOSED_BLOCKED',
  )
})
