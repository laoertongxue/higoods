import assert from 'node:assert/strict'
import test from 'node:test'

import {
  advancePmsFirstLegBatchStatus,
  createPmsFirstLegBatch,
  createPmsFirstLegCarrier,
  createPmsFirstLegChannel,
  getPmsFirstLegBatch,
  listPmsFirstLegBatches,
  listPmsFirstLegCarriers,
  listPmsFirstLegChannels,
  listPmsJoinableLogisticsRows,
  pmsFirstLegBatchAggregate,
  updatePmsFirstLegCarrier,
  updatePmsFirstLegChannel,
  type PmsCreateCarrierInput,
  type PmsCreateChannelInput,
  type PmsFirstLegTransportMethod,
} from '../../src/data/pms/first-leg-logistics.ts'
import { listPmsLogs, PMS_BUYER_ACTOR, PmsDomainError } from '../../src/data/pms/runtime.ts'

const baseCarrier: PmsCreateCarrierInput = {
  carrierName: '单元测试物流商',
  shortName: '单测物流',
  countryOrRegion: '中国',
  city: '深圳',
  level: 'B级',
  contactName: '测试联系人',
  contactPhone: '13800000000',
  settlementCurrency: 'RMB',
  paymentMethod: '月结',
  remark: '',
}

test('物流商新增字段保存回显并写入操作日志', () => {
  const created = createPmsFirstLegCarrier(
    {
      ...baseCarrier,
      carrierName: '单元测试物流商甲',
      email: 'ops@unit-test-logistics.com',
      wechat: 'unit-test-wechat',
      address: '深圳市南山区测试路 1 号',
      accountPeriodDays: 45,
      invoiceInfo: '增值税专用发票 6%',
      bankAccount: '中国银行深圳分行 6222 0000 1111 2222',
      payeeName: '单元测试物流商甲',
      supportedTransportMethods: ['海卡', '快递'],
      supportedDestinations: ['印尼', '美国'],
      supportTaxDeclaration: true,
      supportCustomsClearance: false,
      supportDelivery: true,
    },
    PMS_BUYER_ACTOR,
  )
  const carrier = listPmsFirstLegCarriers().find((item) => item.carrierCode === created.carrierCode)
  assert.ok(carrier)
  assert.equal(carrier.email, 'ops@unit-test-logistics.com')
  assert.equal(carrier.wechat, 'unit-test-wechat')
  assert.equal(carrier.address, '深圳市南山区测试路 1 号')
  assert.equal(carrier.accountPeriodDays, 45)
  assert.equal(carrier.invoiceInfo, '增值税专用发票 6%')
  assert.equal(carrier.bankAccount, '中国银行深圳分行 6222 0000 1111 2222')
  assert.equal(carrier.payeeName, '单元测试物流商甲')
  assert.deepEqual(carrier.supportedTransportMethods, ['海卡', '快递'])
  assert.deepEqual(carrier.supportedDestinations, ['印尼', '美国'])
  assert.equal(carrier.supportTaxDeclaration, true)
  assert.equal(carrier.supportCustomsClearance, false)
  assert.equal(carrier.supportDelivery, true)
  assert.equal(listPmsLogs('first-leg-carrier', created.carrierCode).length, 1)

  const updated = updatePmsFirstLegCarrier(
    created.carrierCode,
    { accountPeriodDays: 60, supportedDestinations: ['欧洲'], supportDelivery: false },
    PMS_BUYER_ACTOR,
  )
  assert.equal(updated.accountPeriodDays, 60)
  assert.deepEqual(updated.supportedDestinations, ['欧洲'])
  assert.equal(updated.supportDelivery, false)
  assert.equal(listPmsLogs('first-leg-carrier', created.carrierCode).length, 2)
})

test('物流商数字字段非负校验与运输方式枚举校验', () => {
  assert.throws(
    () => createPmsFirstLegCarrier({ ...baseCarrier, carrierName: '单元测试物流商乙', accountPeriodDays: -1 }, PMS_BUYER_ACTOR),
    /账期天数必须是非负数字/,
  )
  assert.throws(
    () => createPmsFirstLegCarrier({ ...baseCarrier, carrierName: '单元测试物流商丙', accountPeriodDays: Number.NaN }, PMS_BUYER_ACTOR),
    /账期天数必须是非负数字/,
  )
  assert.throws(
    () => createPmsFirstLegCarrier({ ...baseCarrier, carrierName: '单元测试物流商丁', supportedTransportMethods: ['火箭' as PmsFirstLegTransportMethod] }, PMS_BUYER_ACTOR),
    PmsDomainError,
  )
  assert.equal(listPmsFirstLegCarriers().some((item) => item.carrierName === '单元测试物流商乙'), false)
})

test('渠道新增字段保存回显，条件计费字段按计费方式保留', () => {
  const created = createPmsFirstLegChannel(
    {
      carrierId: 'FL-CN-001',
      channelName: '单元测试计费重渠道',
      transportMethod: '空派',
      estimatedTransitDays: 7,
      billingMethod: '计费重',
      unitPrice: 32,
      currency: 'USD',
      taxMethod: '报税',
      originPlace: '深圳',
      destinationWarehouse: '印尼雅加达面辅料仓',
      remark: '',
      minTransitDays: 5,
      maxTransitDays: 9,
      cutoffTime: '18:00',
      departureFrequency: '每日发运',
      chargeWeightFactor: 1,
      volumeDivisor: 6000,
      minChargeWeight: 21,
      includeTax: true,
      includeCustomsClearance: true,
      includeDelivery: false,
      taxRemark: '双清包税',
      destinationCountry: '印尼',
      applicableArea: '雅加达',
      transferCenter: '深圳转运中心',
      supportBattery: true,
      supportLiquid: false,
      supportSensitiveGoods: true,
      supportNormalGoods: true,
      maxBoxWeight: 30,
      maxBoxVolume: 0.5,
    },
    PMS_BUYER_ACTOR,
  )
  const channel = listPmsFirstLegChannels().find((item) => item.channelCode === created.channelCode)
  assert.ok(channel)
  assert.equal(channel.minTransitDays, 5)
  assert.equal(channel.maxTransitDays, 9)
  assert.equal(channel.cutoffTime, '18:00')
  assert.equal(channel.departureFrequency, '每日发运')
  assert.equal(channel.chargeWeightFactor, 1)
  assert.equal(channel.volumeDivisor, 6000)
  assert.equal(channel.minChargeWeight, 21)
  assert.equal(channel.firstWeightPrice, undefined)
  assert.equal(channel.includeTax, true)
  assert.equal(channel.includeCustomsClearance, true)
  assert.equal(channel.includeDelivery, false)
  assert.equal(channel.taxRemark, '双清包税')
  assert.equal(channel.destinationCountry, '印尼')
  assert.equal(channel.applicableArea, '雅加达')
  assert.equal(channel.transferCenter, '深圳转运中心')
  assert.equal(channel.supportBattery, true)
  assert.equal(channel.supportLiquid, false)
  assert.equal(channel.supportSensitiveGoods, true)
  assert.equal(channel.supportNormalGoods, true)
  assert.equal(channel.maxBoxWeight, 30)
  assert.equal(channel.maxBoxVolume, 0.5)
  assert.equal(listPmsLogs('first-leg-channel', created.channelCode).length, 1)

  const updated = updatePmsFirstLegChannel(
    created.channelCode,
    { firstWeightPrice: 35, additionalWeightPrice: 8, includeDelivery: true, volumeDivisor: 5000 },
    PMS_BUYER_ACTOR,
  )
  assert.equal(updated.firstWeightPrice, 35)
  assert.equal(updated.additionalWeightPrice, 8)
  assert.equal(updated.includeDelivery, true)
  assert.equal(updated.volumeDivisor, 5000)
  assert.equal(listPmsLogs('first-leg-channel', created.channelCode).length, 2)
})

test('整柜渠道不要求新增计费字段，仍要求四箱型完整配置', () => {
  const base: PmsCreateChannelInput = {
    carrierId: 'FL-CN-002',
    channelName: '单元测试整柜渠道',
    transportMethod: '海卡',
    estimatedTransitDays: 15,
    billingMethod: '整柜',
    unitPrice: 0,
    currency: 'RMB',
    taxMethod: '不报税',
    originPlace: '广州',
    destinationWarehouse: '印尼雅加达面辅料仓',
    remark: '',
  }
  assert.throws(() => createPmsFirstLegChannel(base, PMS_BUYER_ACTOR), /整柜计费必须完整配置/)
  const channel = createPmsFirstLegChannel(
    {
      ...base,
      containerPrices: (['20GP', '40GP', '40HQ', '45HQ'] as const).map((type) => ({ containerType: type, weightLimit: 20000, volumeLimit: 60, price: 28000, currency: 'RMB' as const })),
      includeTax: false,
      includeCustomsClearance: false,
      taxRemark: '整柜不含税',
    },
    PMS_BUYER_ACTOR,
  )
  assert.equal(channel.chargeWeightFactor, undefined)
  assert.equal(channel.includeTax, false)
  assert.equal(channel.taxRemark, '整柜不含税')
})

test('渠道数字字段非负与时效区间校验', () => {
  const base: PmsCreateChannelInput = {
    carrierId: 'FL-CN-001',
    channelName: '单元测试校验渠道',
    transportMethod: '空派',
    estimatedTransitDays: 7,
    billingMethod: '计费重',
    unitPrice: 10,
    currency: 'RMB',
    taxMethod: '报税',
    originPlace: '深圳',
    destinationWarehouse: '印尼雅加达面辅料仓',
    remark: '',
  }
  assert.throws(() => createPmsFirstLegChannel({ ...base, minTransitDays: 10, maxTransitDays: 5 }, PMS_BUYER_ACTOR), /最短运输天数不能大于最长运输天数/)
  assert.throws(() => createPmsFirstLegChannel({ ...base, channelName: '单元测试校验渠道B', volumeDivisor: -1 }, PMS_BUYER_ACTOR), /体积重除数必须是非负数字/)
  assert.throws(() => createPmsFirstLegChannel({ ...base, channelName: '单元测试校验渠道C', firstWeightPrice: -0.5 }, PMS_BUYER_ACTOR), /首重价格必须是非负数字/)
  assert.throws(() => createPmsFirstLegChannel({ ...base, channelName: '单元测试校验渠道D', maxBoxWeight: -3 }, PMS_BUYER_ACTOR), /最大单箱重量必须是非负数字/)
})

test('头程批次聚合展示总箱数、总重量、总体积与转运天数', () => {
  const seeded = listPmsFirstLegBatches().find((batch) => batch.batchNo === 'FL-2026-0001')
  assert.ok(seeded)
  const seededAggregate = pmsFirstLegBatchAggregate(seeded)
  assert.equal(seededAggregate.boxCount, seeded.records.reduce((sum, record) => sum + record.boxCount, 0))
  assert.equal(seededAggregate.totalWeightKg, 1380)
  assert.equal(seededAggregate.totalVolumeM3, 5.8)
  assert.equal(seededAggregate.transitDays, null)

  const arrived = listPmsFirstLegBatches().find((batch) => batch.batchNo === 'FL-2026-0003')
  assert.ok(arrived)
  assert.equal(pmsFirstLegBatchAggregate(arrived).transitDays, 6)

  const joinable = listPmsJoinableLogisticsRows()[0]
  assert.ok(joinable)
  const created = createPmsFirstLegBatch(
    {
      batchNo: 'FL-UNIT-9001',
      batchName: '',
      carrierId: 'FL-CN-001',
      channelId: 'CH-CN-0001',
      transferCenter: '',
      destinationWarehouse: '',
      plannedShipDate: '2026-07-01',
      fee: 0,
      remark: '',
      allocations: [{ recordNo: joinable.record.recordNo, qty: joinable.joinableQty, rolls: joinable.joinableRolls }],
    },
    PMS_BUYER_ACTOR,
  )
  const createdAggregate = pmsFirstLegBatchAggregate(created)
  assert.equal(createdAggregate.boxCount, joinable.record.boxCount)
  assert.equal(createdAggregate.totalWeightKg, null)
  assert.equal(createdAggregate.totalVolumeM3, null)
  assert.equal(createdAggregate.transitDays, null)

  advancePmsFirstLegBatchStatus(created.batchNo, '已装柜', PMS_BUYER_ACTOR)
  advancePmsFirstLegBatchStatus(created.batchNo, '头程中', PMS_BUYER_ACTOR)
  advancePmsFirstLegBatchStatus(created.batchNo, '已到仓', PMS_BUYER_ACTOR)
  const batch = getPmsFirstLegBatch(created.batchNo)
  assert.ok(batch)
  const arrivedAggregate = pmsFirstLegBatchAggregate(batch)
  assert.equal(arrivedAggregate.boxCount, joinable.record.boxCount)
  assert.equal(typeof arrivedAggregate.transitDays, 'number')
})
