import assert from 'node:assert/strict'
import test from 'node:test'

import {
  checkPmsMaterialRequirementPush,
  closePmsMaterialPurchaseOrder,
  getPmsMaterialPurchaseOrder,
  importPmsMaterialLogistics,
  listPmsMaterialLogisticsRecords,
  pushPmsMaterialRequirement,
  signPmsMaterialLogistics,
  validatePmsLogisticsImportRow,
  type PmsLogisticsImportRow,
} from '../../src/data/pms/material-purchase-orders.ts'
import { listPmsMaterialRequirements } from '../../src/data/pms/material-requirements.ts'
import { registerPmsMaterialPurchaseArrival } from '../../src/data/pms/material-purchase-orders.ts'
import {
  advancePmsFirstLegBatchStatus,
  createPmsFirstLegBatch,
  createPmsFirstLegChannel,
  getPmsFirstLegBatch,
  listPmsJoinableLogisticsRows,
  togglePmsFirstLegCarrierStatus,
  type PmsCreateChannelInput,
} from '../../src/data/pms/first-leg-logistics.ts'
import {
  checkPmsConfirmation,
  confirmPmsSupplierConfirmation,
  generatePmsConfirmationLabels,
  getPmsSupplierConfirmation,
} from '../../src/data/pms/supplier-confirmations.ts'
import { PMS_BUYER_ACTOR, PMS_MANAGER_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

test('面辅料需求种子就绪且可按物料行下推采购单', () => {
  assert.equal(listPmsMaterialRequirements().length, 3)
  const check = checkPmsMaterialRequirementPush('MREQ-0001')
  assert.equal(check.ok, true)
  const pushable = check.pushableLines.filter((line) => line.suggestedQty > 0)
  assert.equal(pushable.length, 3)
  const created = pushPmsMaterialRequirement(
    'MREQ-0001',
    pushable.map((line) => ({ lineNo: line.lineNo, actualQty: line.suggestedQty, unitPrice: 12 })),
    PMS_BUYER_ACTOR,
  )
  assert.equal(created.length, 3)
  assert.equal(created[0].status, '待采购')
  assert.equal(listPmsMaterialRequirements().find((requirement) => requirement.requirementNo === 'MREQ-0001')?.status, '部分下推')
  assert.throws(() => pushPmsMaterialRequirement('MREQ-0001', [{ lineNo: pushable[0].lineNo, actualQty: 1, unitPrice: 1 }], PMS_BUYER_ACTOR), PmsDomainError)
})

test('快递信息导入校验采购单存在、单号唯一、日期与数量合法', () => {
  const base: PmsLogisticsImportRow = {
    purchaseOrderNo: 'CGF-2026-0007',
    company: '顺丰速运',
    trackingNo: 'SF-UNIT-0001',
    shipDate: '2026-06-12',
    estimatedArrival: '2026-06-15',
    boxCount: 1,
    rolls: 1,
    qty: 100,
    fee: 60,
    remark: '',
  }
  assert.equal(validatePmsLogisticsImportRow(base, new Set(), new Set()), '')
  assert.match(validatePmsLogisticsImportRow({ ...base, purchaseOrderNo: 'CGF-XXXX' }, new Set(), new Set()), /不存在/)
  assert.match(validatePmsLogisticsImportRow({ ...base, shipDate: '06/12/2026' }, new Set(), new Set()), /YYYY-MM-DD/)
  assert.match(validatePmsLogisticsImportRow({ ...base, qty: 0 }, new Set(), new Set()), /大于 0/)
  assert.match(validatePmsLogisticsImportRow({ ...base, rolls: -1 }, new Set(), new Set()), /非负整数/)
  const imported = importPmsMaterialLogistics([base], PMS_BUYER_ACTOR)
  assert.equal(imported.length, 1)
  assert.throws(() => importPmsMaterialLogistics([base], PMS_BUYER_ACTOR), PmsDomainError)
  assert.equal(listPmsMaterialLogisticsRecords().some((record) => record.trackingNo === base.trackingNo), true)
})

test('国内签收、加入头程、状态推进与到仓自动签收', () => {
  const joinable = listPmsJoinableLogisticsRows()[0]
  assert.ok(joinable, '应存在可加入头程的物流记录')
  const record = joinable.record
  assert.throws(() => signPmsMaterialLogistics([record.recordNo], 'head', PMS_BUYER_ACTOR), PmsDomainError)
  const batch = createPmsFirstLegBatch(
    {
      batchNo: 'FL-UNIT-0001',
      batchName: '',
      carrierId: 'FL-CN-001',
      channelId: 'CH-CN-0001',
      transferCenter: '',
      destinationWarehouse: '',
      plannedShipDate: '2026-06-20',
      fee: 50,
      remark: '',
      allocations: [{ recordNo: record.recordNo, qty: joinable.joinableQty, rolls: joinable.joinableRolls }],
    },
    PMS_BUYER_ACTOR,
  )
  assert.equal(batch.status, '待起运')
  advancePmsFirstLegBatchStatus(batch.batchNo, '已装柜', PMS_BUYER_ACTOR)
  advancePmsFirstLegBatchStatus(batch.batchNo, '头程中', PMS_BUYER_ACTOR)
  advancePmsFirstLegBatchStatus(batch.batchNo, '已到仓', PMS_BUYER_ACTOR)
  assert.equal(getPmsFirstLegBatch(batch.batchNo)?.status, '已到仓')
  assert.equal(listPmsMaterialLogisticsRecords().find((item) => item.recordNo === record.recordNo)?.headSigned, true)
})

test('供应商确认单需标签齐备，确认后回写采购单', () => {
  const confirmation = getPmsSupplierConfirmation('CONF-2026-0001')
  assert.ok(confirmation)
  assert.equal(checkPmsConfirmation('CONF-2026-0001').ok, false)
  const missing = confirmation.rolls.filter((roll) => !roll.labelNo).map((roll) => roll.rollNo)
  generatePmsConfirmationLabels('CONF-2026-0001', missing, PMS_BUYER_ACTOR)
  assert.equal(checkPmsConfirmation('CONF-2026-0001').ok, true)
  confirmPmsSupplierConfirmation('CONF-2026-0001', PMS_MANAGER_ACTOR)
  assert.equal(getPmsSupplierConfirmation('CONF-2026-0001')?.status, '已确认')
  assert.equal(getPmsMaterialPurchaseOrder('CGF-2026-0001')?.supplierConfirmed, true)
})

test('整柜渠道必须完整配置四个箱型，物流商可启停', () => {
  const baseInput: PmsCreateChannelInput = {
    carrierId: 'FL-CN-002',
    channelName: '整柜测试渠道',
    transportMethod: '海卡',
    estimatedTransitDays: 15,
    billingMethod: '整柜',
    unitPrice: 0,
    currency: 'RMB',
    taxMethod: '不报税',
    containerPrices: [],
    originPlace: '广州',
    destinationWarehouse: '印尼雅加达面辅料仓',
    remark: '',
  }
  assert.throws(() => createPmsFirstLegChannel(baseInput, PMS_BUYER_ACTOR), PmsDomainError)
  const channel = createPmsFirstLegChannel(
    {
      ...baseInput,
      containerPrices: (['20GP', '40GP', '40HQ', '45HQ'] as const).map((type) => ({ containerType: type, weightLimit: 20000, volumeLimit: 60, price: 28000, currency: 'RMB' })),
    },
    PMS_BUYER_ACTOR,
  )
  assert.equal(channel.status, '启用')
  assert.equal(togglePmsFirstLegCarrierStatus('FL-CN-004', PMS_BUYER_ACTOR).status, '启用')
})


test('面辅料采购单可带原因关闭，关闭后不能再登记到货', () => {
  assert.throws(() => closePmsMaterialPurchaseOrder('CGF-2026-0007', '', PMS_BUYER_ACTOR), PmsDomainError)
  const order = closePmsMaterialPurchaseOrder('CGF-2026-0007', '供应商产能不足', PMS_BUYER_ACTOR)
  assert.equal(order.status, '已关闭')
  assert.equal(order.remark, '供应商产能不足')
  assert.throws(() => registerPmsMaterialPurchaseArrival('CGF-2026-0007', 1, PMS_BUYER_ACTOR), PmsDomainError)
  assert.throws(() => closePmsMaterialPurchaseOrder('CGF-2026-0007', '再次关闭', PMS_BUYER_ACTOR), PmsDomainError)
})
