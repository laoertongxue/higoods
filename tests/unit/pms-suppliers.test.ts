import assert from 'node:assert/strict'
import test from 'node:test'

import {
  PMS_SUPPLIER_CITIES,
  PMS_SUPPLIER_COUNTRIES,
  PMS_SUPPLIER_CURRENCIES,
  PMS_SUPPLIER_DELIVERY_METHODS,
  PMS_SUPPLIER_LEVELS,
  PMS_SUPPLIER_PAYMENT_METHODS,
  PMS_SUPPLIER_TYPES,
  advancePmsSupplierStatus,
  createPmsSupplier,
  getPmsSupplier,
  listPmsSuppliers,
  updatePmsSupplier,
  type PmsSupplierCategory,
  type PmsSupplierInput,
} from '../../src/data/pms/suppliers.ts'
import { listPmsLogs, PmsDomainError, PMS_BUYER_ACTOR } from '../../src/data/pms/runtime.ts'
import { renderPmsSupplierDetailOverlay, renderPmsSuppliersPage } from '../../src/pages/pms/suppliers.ts'

const BASE_NAME = 'M6 枚举对齐测试供应商'

function baseInput(): PmsSupplierInput {
  return {
    supplierName: BASE_NAME,
    shortName: 'M6测试',
    category: '面料供应商',
    country: '中国',
    city: '广东广州',
    contactName: '测试人',
    contactPhone: '13800000001',
    email: 'm6@example.com',
    wechat: 'm6_wechat',
    level: 'A级',
    paymentMethod: '月结',
    currency: 'RMB',
    defaultDeliveryMethod: '供应商直发海外仓',
    invoiceInfo: 'M6 枚举对齐测试供应商 税号 91440101XXXX',
    bankAccount: '中国银行广州分行 6222****0001',
    leadTimeDays: 12,
    address: '广东省广州市海珠区测试路 1 号',
    remark: '单元测试',
  }
}

function expectDomainError(run: () => unknown, code: string, message: string): void {
  assert.throws(run, (error: unknown) => {
    assert.ok(error instanceof PmsDomainError, `期望 PmsDomainError，实际 ${String(error)}`)
    assert.equal(error.code, code)
    assert.equal(error.message, message)
    return true
  })
}

test('供应商枚举与 SRM 完全一致，旧枚举不再出现', () => {
  assert.deepEqual([...PMS_SUPPLIER_TYPES], ['面料供应商', '辅料供应商', '纱线供应商', '包材供应商', '成衣工厂', '样衣工厂', '综合供应商'])
  assert.deepEqual([...PMS_SUPPLIER_LEVELS], ['A级', 'B级', 'C级', '临时供应商'])
  assert.deepEqual([...PMS_SUPPLIER_PAYMENT_METHODS], ['预付', '月结', '到货后付款', '对账后付款'])
  assert.deepEqual([...PMS_SUPPLIER_CURRENCIES], ['RMB', 'USD', 'IDR'])
  assert.deepEqual([...PMS_SUPPLIER_DELIVERY_METHODS], ['供应商直发海外仓', '发至中国中转仓', '采购方自提', '货代上门提货'])
  assert.deepEqual([...PMS_SUPPLIER_COUNTRIES], ['中国', '印度尼西亚', '越南', '其他'])
  assert.deepEqual([...PMS_SUPPLIER_CITIES], ['广东广州', '广东深圳', '广东东莞', '浙江绍兴', '浙江杭州', '浙江宁波', '福建泉州', '江苏苏州', '山东青岛'])
  const types = PMS_SUPPLIER_TYPES as readonly string[]
  const levels = PMS_SUPPLIER_LEVELS as readonly string[]
  const payments = PMS_SUPPLIER_PAYMENT_METHODS as readonly string[]
  const currencies = PMS_SUPPLIER_CURRENCIES as readonly string[]
  for (const legacy of ['面辅料', '成衣', '样衣', '综合']) assert.ok(!types.includes(legacy), `类型不应保留 ${legacy}`)
  assert.ok(!levels.includes('未评级'))
  for (const legacy of ['票结', '到付']) assert.ok(!payments.includes(legacy), `付款方式不应保留 ${legacy}`)
  assert.ok(!currencies.includes('EUR'))
})

test('种子字段满足 SRM 枚举且协同指标为数字', () => {
  const rows = listPmsSuppliers()
  assert.ok(rows.length >= 10)
  assert.ok(rows.every((row) => (PMS_SUPPLIER_TYPES as readonly string[]).includes(row.category)))
  assert.ok(rows.every((row) => (PMS_SUPPLIER_LEVELS as readonly string[]).includes(row.level)))
  assert.ok(rows.every((row) => (PMS_SUPPLIER_PAYMENT_METHODS as readonly string[]).includes(row.paymentMethod)))
  assert.ok(rows.every((row) => (PMS_SUPPLIER_CURRENCIES as readonly string[]).includes(row.currency)))
  assert.ok(rows.every((row) => (PMS_SUPPLIER_DELIVERY_METHODS as readonly string[]).includes(row.defaultDeliveryMethod ?? '')))
  assert.ok(rows.every((row) => (PMS_SUPPLIER_COUNTRIES as readonly string[]).includes(row.country ?? '')))
  assert.ok(rows.every((row) => (PMS_SUPPLIER_CITIES as readonly string[]).includes(row.city ?? '')))
  assert.ok(rows.every((row) => typeof row.totalPurchaseOrders === 'number' && typeof row.totalPurchaseAmount === 'number' && typeof row.onTimeDeliveryRate === 'number' && typeof row.qualityPassRate === 'number'))
  assert.ok(rows.some((row) => (row.totalPurchaseOrders ?? 0) > 0 && (row.totalPurchaseAmount ?? 0) > 0))
})

test('新增字段保存并回显，成功命令写入操作日志', () => {
  const supplier = createPmsSupplier(baseInput(), PMS_BUYER_ACTOR)
  assert.equal(supplier.status, '草稿')
  assert.equal(supplier.country, '中国')
  assert.equal(supplier.city, '广东广州')
  assert.equal(supplier.wechat, 'm6_wechat')
  assert.equal(supplier.invoiceInfo, 'M6 枚举对齐测试供应商 税号 91440101XXXX')
  assert.equal(supplier.bankAccount, '中国银行广州分行 6222****0001')
  assert.equal(supplier.defaultDeliveryMethod, '供应商直发海外仓')
  assert.equal(supplier.totalPurchaseOrders, 0)
  assert.equal(supplier.totalPurchaseAmount, 0)
  assert.equal(supplier.onTimeDeliveryRate, 0)
  assert.equal(supplier.qualityPassRate, 0)
  const fetched = getPmsSupplier(supplier.supplierCode)
  assert.equal(fetched?.city, '广东广州')
  assert.equal(fetched?.category, '面料供应商')
  const created = listPmsLogs('supplier', supplier.supplierCode).filter((log) => log.action === '创建')
  assert.equal(created.length, 1)
  expectDomainError(() => createPmsSupplier({ ...baseInput(), shortName: 'M6测试2' }, PMS_BUYER_ACTOR), 'SUPPLIER_NAME_DUPLICATE', '供应商名称已存在')
  expectDomainError(() => createPmsSupplier({ ...baseInput(), supplierName: 'M6 简称重复测试供应商' }, PMS_BUYER_ACTOR), 'SUPPLIER_SHORT_NAME_DUPLICATE', '供应商简称已存在')
})

test('编辑保存新增字段并保持状态机与事件名不变', () => {
  const supplier = listPmsSuppliers().find((row) => row.supplierName === BASE_NAME)
  assert.ok(supplier)
  const updated = updatePmsSupplier(supplier.supplierCode, {
    ...baseInput(),
    city: '广东深圳',
    wechat: 'm6_updated',
    invoiceInfo: 'M6 更新后开票信息',
    bankAccount: '招商银行深圳分行 6225****0002',
    defaultDeliveryMethod: '发至中国中转仓',
    currency: 'IDR',
  }, PMS_BUYER_ACTOR)
  assert.equal(updated.city, '广东深圳')
  assert.equal(updated.wechat, 'm6_updated')
  assert.equal(updated.defaultDeliveryMethod, '发至中国中转仓')
  assert.equal(updated.currency, 'IDR')
  assert.equal(updated.status, '草稿')
  assert.ok(listPmsLogs('supplier', supplier.supplierCode).some((log) => log.action === '编辑'))
  advancePmsSupplierStatus(supplier.supplierCode, '待审核', PMS_BUYER_ACTOR)
  advancePmsSupplierStatus(supplier.supplierCode, '已启用', PMS_BUYER_ACTOR)
  assert.equal(getPmsSupplier(supplier.supplierCode)?.status, '已启用')
  expectDomainError(() => advancePmsSupplierStatus(supplier.supplierCode, '已驳回', PMS_BUYER_ACTOR, ''), 'SUPPLIER_TRANSITION_BLOCKED', '已启用 不能直接流转到 已驳回')
})

test('非法或缺失输入抛 PmsDomainError 且不写入数据', () => {
  const before = listPmsSuppliers().length
  const cases: Array<[Partial<PmsSupplierInput>, string, string]> = [
    [{ supplierName: '   ' }, 'SUPPLIER_NAME_REQUIRED', '供应商名称不能为空'],
    [{ shortName: '' }, 'SUPPLIER_SHORT_NAME_REQUIRED', '供应商简称不能为空'],
    [{ category: '面辅料' as PmsSupplierCategory }, 'SUPPLIER_TYPE_INVALID', '供应商类型不在可选范围内'],
    [{ country: '' }, 'SUPPLIER_COUNTRY_REQUIRED', '国家/地区不能为空'],
    [{ country: '美国' }, 'SUPPLIER_COUNTRY_INVALID', '国家/地区不在可选范围内'],
    [{ city: '' }, 'SUPPLIER_CITY_REQUIRED', '省市不能为空'],
    [{ city: '广东佛山' }, 'SUPPLIER_CITY_INVALID', '省市不在可选范围内'],
    [{ level: 'S级' as PmsSupplierInput['level'] }, 'SUPPLIER_LEVEL_INVALID', '供应商等级不在可选范围内'],
    [{ contactName: '' }, 'SUPPLIER_CONTACT_REQUIRED', '联系人不能为空'],
    [{ contactPhone: '123' }, 'SUPPLIER_PHONE_INVALID', '联系电话至少需要 6 位'],
    [{ email: 'not-an-email' }, 'SUPPLIER_EMAIL_INVALID', '邮箱格式不正确，必须包含 @'],
    [{ paymentMethod: '票结' as PmsSupplierInput['paymentMethod'] }, 'SUPPLIER_PAYMENT_METHOD_INVALID', '付款方式不在可选范围内'],
    [{ currency: 'EUR' as PmsSupplierInput['currency'] }, 'SUPPLIER_CURRENCY_INVALID', '币种不在可选范围内'],
    [{ defaultDeliveryMethod: '' }, 'SUPPLIER_DELIVERY_METHOD_REQUIRED', '默认交货方式不能为空'],
    [{ defaultDeliveryMethod: '快递' as PmsSupplierInput['defaultDeliveryMethod'] }, 'SUPPLIER_DELIVERY_METHOD_INVALID', '默认交货方式不在可选范围内'],
    [{ leadTimeDays: 0 }, 'SUPPLIER_LEAD_TIME_INVALID', '供货周期必须是大于 0 的天数'],
  ]
  for (const [patch, code, message] of cases) {
    const input: PmsSupplierInput = { ...baseInput(), supplierName: `M6 非法输入-${code}`, shortName: `M6-${code}`, ...patch }
    expectDomainError(() => createPmsSupplier(input, PMS_BUYER_ACTOR), code, message)
    assert.equal(listPmsSuppliers().some((row) => row.supplierName === input.supplierName), false)
  }
  assert.equal(listPmsSuppliers().length, before)
})

test('详情与列表展示新增字段、SRM 枚举与协同指标', () => {
  const detail = renderPmsSupplierDetailOverlay('SUP-2026-0001')
  for (const label of ['供应商类型', '国家/地区', '省市', '微信', '开票信息', '银行账户', '默认交货方式', '累计采购单数', '累计采购金额', '准时交付率', '质量合格率']) {
    assert.ok(detail.includes(label), `详情应展示 ${label}`)
  }
  assert.ok(detail.includes('128 单'))
  assert.ok(detail.includes('95%'))
  assert.ok(detail.includes('97%'))
  assert.match(detail, /3,?560,?000/)
  const page = renderPmsSuppliersPage()
  for (const type of PMS_SUPPLIER_TYPES) assert.ok(page.includes(`>${type}<`), `筛选应包含 ${type}`)
  for (const legacy of ['面辅料', '未评级', '票结', '到付']) assert.ok(!page.includes(`>${legacy}<`), `筛选不应包含 ${legacy}`)
  assert.ok(page.includes('面料供应商'))
})
