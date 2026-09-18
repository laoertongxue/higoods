import { appendPmsLog, PmsDomainError, type PmsActorRole } from './runtime.ts'

export type PmsSupplierStatus = '草稿' | '待审核' | '已启用' | '已驳回' | '已停用'

export const PMS_SUPPLIER_TYPES = ['面料供应商', '辅料供应商', '纱线供应商', '包材供应商', '成衣工厂', '样衣工厂', '综合供应商'] as const
export type PmsSupplierCategory = (typeof PMS_SUPPLIER_TYPES)[number]

export const PMS_SUPPLIER_LEVELS = ['A级', 'B级', 'C级', '临时供应商'] as const
export type PmsSupplierLevel = (typeof PMS_SUPPLIER_LEVELS)[number]

export const PMS_SUPPLIER_PAYMENT_METHODS = ['预付', '月结', '到货后付款', '对账后付款'] as const
export type PmsSupplierPaymentMethod = (typeof PMS_SUPPLIER_PAYMENT_METHODS)[number]

export const PMS_SUPPLIER_CURRENCIES = ['RMB', 'USD', 'IDR'] as const
export type PmsSupplierCurrency = (typeof PMS_SUPPLIER_CURRENCIES)[number]

export const PMS_SUPPLIER_DELIVERY_METHODS = ['供应商直发海外仓', '发至中国中转仓', '采购方自提', '货代上门提货'] as const
export type PmsSupplierDeliveryMethod = (typeof PMS_SUPPLIER_DELIVERY_METHODS)[number]

export const PMS_SUPPLIER_COUNTRIES = ['中国', '印度尼西亚', '越南', '其他'] as const

export const PMS_SUPPLIER_CITIES = ['广东广州', '广东深圳', '广东东莞', '浙江绍兴', '浙江杭州', '浙江宁波', '福建泉州', '江苏苏州', '山东青岛'] as const

export interface PmsSupplier {
  supplierCode: string
  supplierName: string
  shortName: string
  category: PmsSupplierCategory
  country?: string
  city?: string
  contactName: string
  contactPhone: string
  email: string
  wechat?: string
  level: PmsSupplierLevel
  paymentMethod: PmsSupplierPaymentMethod
  currency: PmsSupplierCurrency
  defaultDeliveryMethod?: PmsSupplierDeliveryMethod
  invoiceInfo?: string
  bankAccount?: string
  leadTimeDays: number
  address: string
  tags: string[]
  status: PmsSupplierStatus
  rejectReason: string
  materialCount: number
  totalPurchaseOrders?: number
  totalPurchaseAmount?: number
  onTimeDeliveryRate?: number
  qualityPassRate?: number
  recentPurchaseOrderNo?: string
  recentPurchaseDate?: string
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  remark: string
}

const seeds: PmsSupplier[] = [
  { supplierCode: 'SUP-2026-0001', supplierName: '广州华盛面料有限公司', shortName: '华盛面料', category: '面料供应商', country: '中国', city: '广东广州', contactName: '张伟', contactPhone: '13800138201', email: 'zhangwei@huasheng.com', wechat: 'hs_fabric', level: 'A级', paymentMethod: '月结', currency: 'RMB', defaultDeliveryMethod: '供应商直发海外仓', invoiceInfo: '广州华盛面料有限公司 税号 91440101XXXX', bankAccount: '中国银行广州分行 6222****0001', leadTimeDays: 12, address: '广东省广州市海珠区纺织路 18 号', tags: ['面料', '长期合作'], status: '已启用', rejectReason: '', materialCount: 3, totalPurchaseOrders: 128, totalPurchaseAmount: 3560000, onTimeDeliveryRate: 95, qualityPassRate: 97, recentPurchaseOrderNo: 'PO-2026-0010', recentPurchaseDate: '2026-05-26', createdBy: '王采购', createdAt: '2026-01-08 09:00:00', updatedBy: '王采购', updatedAt: '2026-05-20 10:00:00', remark: '核心面料供应商' },
  { supplierCode: 'SUP-2026-0002', supplierName: '绍兴锦达纺织有限公司', shortName: '锦达纺织', category: '面料供应商', country: '中国', city: '浙江绍兴', contactName: '钱敏', contactPhone: '13800138202', email: 'qianmin@jinda.com', wechat: 'jinda_tex', level: 'A级', paymentMethod: '对账后付款', currency: 'RMB', defaultDeliveryMethod: '发至中国中转仓', invoiceInfo: '绍兴锦达纺织有限公司 税号 91330602XXXX', bankAccount: '建设银行绍兴分行 6227****0002', leadTimeDays: 15, address: '浙江省绍兴市柯桥区轻纺城大道 66 号', tags: ['卫衣布', '里布'], status: '已启用', rejectReason: '', materialCount: 2, totalPurchaseOrders: 96, totalPurchaseAmount: 2890000, onTimeDeliveryRate: 93, qualityPassRate: 96, recentPurchaseOrderNo: 'PO-2026-0008', recentPurchaseDate: '2026-05-23', createdBy: '王采购', createdAt: '2026-01-08 09:10:00', updatedBy: '商品中心同步任务', updatedAt: '2026-05-18 14:00:00', remark: '卫衣布主供应商' },
  { supplierCode: 'SUP-2026-0003', supplierName: '东莞宏远辅料有限公司', shortName: '宏远辅料', category: '辅料供应商', country: '中国', city: '广东东莞', contactName: '刘宏', contactPhone: '13800138203', email: 'liuhong@hongyuan.com', wechat: 'hy_trim', level: 'A级', paymentMethod: '到货后付款', currency: 'RMB', defaultDeliveryMethod: '供应商直发海外仓', invoiceInfo: '东莞宏远辅料有限公司 税号 91441900XXXX', bankAccount: '工商银行东莞分行 6222****0003', leadTimeDays: 9, address: '广东省东莞市虎门镇辅料城 A 区 21 号', tags: ['拉链', '纽扣', '织唛', '松紧带'], status: '已启用', rejectReason: '', materialCount: 5, totalPurchaseOrders: 78, totalPurchaseAmount: 1260000, onTimeDeliveryRate: 90, qualityPassRate: 94, recentPurchaseOrderNo: 'PO-2026-0009', recentPurchaseDate: '2026-05-24', createdBy: '王采购', createdAt: '2026-01-11 10:00:00', updatedBy: '王采购', updatedAt: '2026-05-23 15:00:00', remark: '拉链纽扣主供' },
  { supplierCode: 'SUP-2026-0004', supplierName: '佛山成衣加工厂', shortName: '佛山成衣', category: '成衣工厂', country: '中国', city: '广东广州', contactName: '陈国', contactPhone: '13800138204', email: 'chenguo@foshangarment.com', wechat: 'fs_factory', level: 'A级', paymentMethod: '对账后付款', currency: 'RMB', defaultDeliveryMethod: '供应商直发海外仓', invoiceInfo: '佛山成衣加工厂 税号 91440600XXXX', bankAccount: '交通银行佛山分行 6222****0004', leadTimeDays: 26, address: '广东省佛山市南海区工业大道 88 号', tags: ['成衣', '裤装'], status: '已启用', rejectReason: '', materialCount: 1, totalPurchaseOrders: 37, totalPurchaseAmount: 1980000, onTimeDeliveryRate: 89, qualityPassRate: 91, recentPurchaseOrderNo: 'PO-2026-0006', recentPurchaseDate: '2026-05-25', createdBy: '王采购', createdAt: '2026-01-17 09:30:00', updatedBy: '王采购', updatedAt: '2026-05-25 13:30:00', remark: '成衣产能稳定' },
  { supplierCode: 'SUP-2026-0005', supplierName: '中山针织制衣有限公司', shortName: '中山针织', category: '成衣工厂', country: '中国', city: '广东深圳', contactName: '黄志', contactPhone: '13800138205', email: 'huangzhi@zhongshan.com', wechat: 'zs_knit', level: 'A级', paymentMethod: '月结', currency: 'RMB', defaultDeliveryMethod: '发至中国中转仓', invoiceInfo: '中山针织制衣有限公司 税号 91442000XXXX', bankAccount: '中信银行中山分行 6226****0005', leadTimeDays: 28, address: '广东省中山市沙溪镇纺织路 12 号', tags: ['卫衣', '针织'], status: '已启用', rejectReason: '', materialCount: 1, totalPurchaseOrders: 63, totalPurchaseAmount: 1580000, onTimeDeliveryRate: 94, qualityPassRate: 95, recentPurchaseOrderNo: 'PO-2026-0003', recentPurchaseDate: '2026-05-22', createdBy: '王采购', createdAt: '2026-02-01 09:00:00', updatedBy: '王采购', updatedAt: '2026-05-21 11:00:00', remark: '针织卫衣产能稳定' },
  { supplierCode: 'SUP-2026-0006', supplierName: '宁波衬衫制造有限公司', shortName: '宁波衬衫', category: '成衣工厂', country: '中国', city: '浙江宁波', contactName: '王宁', contactPhone: '13800138206', email: 'wangning@nb-shirt.com', wechat: 'nb_shirt', level: 'B级', paymentMethod: '到货后付款', currency: 'RMB', defaultDeliveryMethod: '发至中国中转仓', invoiceInfo: '宁波衬衫制造有限公司 税号 91330200XXXX', bankAccount: '农业银行宁波分行 6228****0006', leadTimeDays: 24, address: '浙江省宁波市鄞州区服装产业园 3 号', tags: ['衬衫'], status: '已启用', rejectReason: '', materialCount: 1, totalPurchaseOrders: 52, totalPurchaseAmount: 860000, onTimeDeliveryRate: 88, qualityPassRate: 92, recentPurchaseOrderNo: 'PO-2026-0004', recentPurchaseDate: '2026-05-20', createdBy: '王采购', createdAt: '2026-02-10 10:00:00', updatedBy: '王采购', updatedAt: '2026-05-19 16:00:00', remark: '' },
  { supplierCode: 'SUP-2026-0007', supplierName: '杭州女装制衣有限公司', shortName: '杭州女装', category: '成衣工厂', country: '中国', city: '浙江杭州', contactName: '孙丽', contactPhone: '13800138207', email: 'sunli@hzwomen.com', wechat: 'hz_women', level: 'B级', paymentMethod: '月结', currency: 'RMB', defaultDeliveryMethod: '采购方自提', invoiceInfo: '杭州女装制衣有限公司 税号 91330100XXXX', bankAccount: '浦发银行杭州分行 6217****0007', leadTimeDays: 27, address: '浙江省杭州市余杭区服装小镇 6 幢', tags: ['连衣裙', '女装'], status: '已启用', rejectReason: '', materialCount: 1, totalPurchaseOrders: 40, totalPurchaseAmount: 590000, onTimeDeliveryRate: 91, qualityPassRate: 93, recentPurchaseOrderNo: 'PO-2026-0012', recentPurchaseDate: '2026-05-27', createdBy: '王采购', createdAt: '2026-02-12 09:20:00', updatedBy: '王采购', updatedAt: '2026-05-20 10:10:00', remark: '' },
  { supplierCode: 'SUP-2026-0008', supplierName: '苏州户外服饰有限公司', shortName: '苏州户外', category: '成衣工厂', country: '中国', city: '江苏苏州', contactName: '周强', contactPhone: '13800138208', email: 'zhouqiang@szoutdoor.com', wechat: 'sz_outdoor', level: 'B级', paymentMethod: '预付', currency: 'RMB', defaultDeliveryMethod: '货代上门提货', invoiceInfo: '苏州户外服饰有限公司 税号 91320500XXXX', bankAccount: '江苏银行苏州分行 6223****0008', leadTimeDays: 30, address: '江苏省苏州市吴中区户外产业园 9 号', tags: ['夹克', '户外'], status: '已启用', rejectReason: '', materialCount: 1, totalPurchaseOrders: 29, totalPurchaseAmount: 420000, onTimeDeliveryRate: 78, qualityPassRate: 84, recentPurchaseOrderNo: 'PO-2026-0007', recentPurchaseDate: '2026-05-18', createdBy: '王采购', createdAt: '2026-02-15 09:40:00', updatedBy: '王采购', updatedAt: '2026-05-22 14:20:00', remark: 'BOM 尚未匹配' },
  { supplierCode: 'SUP-2026-0009', supplierName: '泉州瑞达服装辅料有限公司', shortName: '瑞达辅料', category: '辅料供应商', country: '中国', city: '福建泉州', contactName: '吴瑞', contactPhone: '13800138209', email: 'wurui@ruida.com', wechat: 'rd_trim', level: 'C级', paymentMethod: '预付', currency: 'RMB', defaultDeliveryMethod: '发至中国中转仓', invoiceInfo: '泉州瑞达服装辅料有限公司 税号 91350500XXXX', bankAccount: '民生银行泉州分行 6226****0009', leadTimeDays: 9, address: '福建省泉州市石狮市辅料市场 5 号', tags: ['缝纫线'], status: '已驳回', rejectReason: '交期无法满足要求', materialCount: 1, totalPurchaseOrders: 11, totalPurchaseAmount: 96000, onTimeDeliveryRate: 72, qualityPassRate: 80, recentPurchaseOrderNo: 'PO-2026-0011', recentPurchaseDate: '2026-05-15', createdBy: '王采购', createdAt: '2026-02-18 11:00:00', updatedBy: '王采购', updatedAt: '2026-05-16 17:05:00', remark: '交期无法满足要求' },
  { supplierCode: 'SUP-2026-0010', supplierName: '宁波恒源纱线有限公司', shortName: '恒源纱线', category: '纱线供应商', country: '中国', city: '浙江宁波', contactName: '郑恒', contactPhone: '13800138210', email: 'zhengheng@hengyuan.com', wechat: 'hy_yarn', level: 'C级', paymentMethod: '预付', currency: 'USD', defaultDeliveryMethod: '供应商直发海外仓', invoiceInfo: '宁波恒源纱线有限公司 税号 91330200XXXX', bankAccount: '农业银行宁波分行 6228****0010', leadTimeDays: 18, address: '浙江省宁波市慈溪市轻纺路 27 号', tags: ['纱线'], status: '待审核', rejectReason: '', materialCount: 1, totalPurchaseOrders: 63, totalPurchaseAmount: 1580000, onTimeDeliveryRate: 94, qualityPassRate: 95, recentPurchaseOrderNo: 'PO-2026-0003', recentPurchaseDate: '2026-05-22', createdBy: '王采购', createdAt: '2026-05-28 09:00:00', updatedBy: '王采购', updatedAt: '2026-05-28 09:00:00', remark: '新供应商待审核' },
  { supplierCode: 'SUP-2026-0011', supplierName: '深圳优品包材有限公司', shortName: '优品包材', category: '包材供应商', country: '中国', city: '广东深圳', contactName: '刘洋', contactPhone: '13800138211', email: 'youpin@sample.com', wechat: 'yp_pkg', level: 'B级', paymentMethod: '预付', currency: 'RMB', defaultDeliveryMethod: '发至中国中转仓', invoiceInfo: '深圳优品包材有限公司 税号 91440300XXXX', bankAccount: '招商银行深圳分行 6225****0011', leadTimeDays: 14, address: '广东省深圳市宝安区包装产业园 8 号', tags: ['纸箱', '胶袋'], status: '已启用', rejectReason: '', materialCount: 2, totalPurchaseOrders: 52, totalPurchaseAmount: 860000, onTimeDeliveryRate: 88, qualityPassRate: 92, recentPurchaseOrderNo: 'PO-2026-0004', recentPurchaseDate: '2026-05-20', createdBy: '王采购', createdAt: '2026-03-05 10:00:00', updatedBy: '王采购', updatedAt: '2026-05-26 09:30:00', remark: '包材补充供应商' },
  { supplierCode: 'SUP-2026-0012', supplierName: '杭州样衣开发中心', shortName: '杭州样衣', category: '样衣工厂', country: '中国', city: '浙江杭州', contactName: '孙婷', contactPhone: '13800138212', email: 'sample@sample.com', wechat: 'hz_sample', level: '临时供应商', paymentMethod: '到货后付款', currency: 'RMB', defaultDeliveryMethod: '采购方自提', invoiceInfo: '杭州样衣开发中心 税号 91330100XXXX', bankAccount: '浦发银行杭州分行 6217****0012', leadTimeDays: 6, address: '浙江省杭州市余杭区打样中心 2 号', tags: ['样衣', '打样'], status: '草稿', rejectReason: '', materialCount: 0, totalPurchaseOrders: 8, totalPurchaseAmount: 126000, onTimeDeliveryRate: 82, qualityPassRate: 90, recentPurchaseOrderNo: 'PO-2026-0010', recentPurchaseDate: '2026-05-26', createdBy: '王采购', createdAt: '2026-03-12 16:00:00', updatedBy: '王采购', updatedAt: '2026-05-10 14:00:00', remark: '样衣快速打样' },
  { supplierCode: 'SUP-2026-0013', supplierName: '中山综合服饰供应链有限公司', shortName: '中山综合', category: '综合供应商', country: '中国', city: '广东深圳', contactName: '何杰', contactPhone: '13800138213', email: 'zhongshan@sample.com', wechat: 'zs_supply', level: 'C级', paymentMethod: '月结', currency: 'IDR', defaultDeliveryMethod: '货代上门提货', invoiceInfo: '中山综合服饰供应链有限公司 税号 91442000XXXX', bankAccount: '中信银行中山分行 6226****0013', leadTimeDays: 21, address: '广东省中山市小榄镇综合产业园 1 号', tags: ['面料', '辅料', '成衣'], status: '已停用', rejectReason: '', materialCount: 4, totalPurchaseOrders: 29, totalPurchaseAmount: 420000, onTimeDeliveryRate: 78, qualityPassRate: 84, recentPurchaseOrderNo: 'PO-2026-0007', recentPurchaseDate: '2026-05-18', createdBy: '王采购', createdAt: '2026-03-20 11:40:00', updatedBy: '王采购', updatedAt: '2026-05-12 09:00:00', remark: '近期开票准确率偏低' },
]

const suppliers: PmsSupplier[] = seeds.map((seed) => ({ ...seed }))

let supplierSequence = seeds.length

export function listPmsSuppliers(): PmsSupplier[] {
  return suppliers
}

export function getPmsSupplier(supplierCode: string): PmsSupplier | undefined {
  return suppliers.find((supplier) => supplier.supplierCode === supplierCode)
}

export interface PmsSupplierInput {
  supplierName: string
  shortName: string
  category: PmsSupplierCategory
  country?: string
  city?: string
  contactName: string
  contactPhone: string
  email: string
  wechat?: string
  level: PmsSupplierLevel
  paymentMethod: PmsSupplierPaymentMethod
  currency: PmsSupplierCurrency
  defaultDeliveryMethod?: PmsSupplierDeliveryMethod
  invoiceInfo?: string
  bankAccount?: string
  leadTimeDays: number
  address: string
  remark: string
}

interface PmsSupplierFormValues {
  supplierName: string
  shortName: string
  category: PmsSupplierCategory
  country: string
  city: string
  contactName: string
  contactPhone: string
  email: string
  wechat: string
  level: PmsSupplierLevel
  paymentMethod: PmsSupplierPaymentMethod
  currency: PmsSupplierCurrency
  defaultDeliveryMethod: PmsSupplierDeliveryMethod
  invoiceInfo: string
  bankAccount: string
  leadTimeDays: number
  address: string
  remark: string
}

function isSupplierOption<T extends string>(options: readonly T[], value: string): value is T {
  return (options as readonly string[]).includes(value)
}

function readSupplierOption<T extends string>(value: string | undefined, options: readonly T[], label: string, code: string): T {
  const text = (value ?? '').trim()
  if (!text) throw new PmsDomainError(`${code}_REQUIRED`, `${label}不能为空`)
  if (!isSupplierOption(options, text)) throw new PmsDomainError(`${code}_INVALID`, `${label}不在可选范围内`)
  return text
}

function validateSupplierInput(input: PmsSupplierInput, excludeCode = ''): PmsSupplierFormValues {
  const supplierName = input.supplierName.trim()
  if (!supplierName) throw new PmsDomainError('SUPPLIER_NAME_REQUIRED', '供应商名称不能为空')
  const shortName = input.shortName.trim()
  if (!shortName) throw new PmsDomainError('SUPPLIER_SHORT_NAME_REQUIRED', '供应商简称不能为空')
  const category = readSupplierOption(input.category, PMS_SUPPLIER_TYPES, '供应商类型', 'SUPPLIER_TYPE')
  const country = readSupplierOption(input.country, PMS_SUPPLIER_COUNTRIES, '国家/地区', 'SUPPLIER_COUNTRY')
  const city = readSupplierOption(input.city, PMS_SUPPLIER_CITIES, '省市', 'SUPPLIER_CITY')
  const level = readSupplierOption(input.level, PMS_SUPPLIER_LEVELS, '供应商等级', 'SUPPLIER_LEVEL')
  const contactName = input.contactName.trim()
  if (!contactName) throw new PmsDomainError('SUPPLIER_CONTACT_REQUIRED', '联系人不能为空')
  const contactPhone = input.contactPhone.trim()
  if (!contactPhone) throw new PmsDomainError('SUPPLIER_PHONE_REQUIRED', '联系电话不能为空')
  if (contactPhone.length < 6) throw new PmsDomainError('SUPPLIER_PHONE_INVALID', '联系电话至少需要 6 位')
  const email = (input.email ?? '').trim()
  if (email && !email.includes('@')) throw new PmsDomainError('SUPPLIER_EMAIL_INVALID', '邮箱格式不正确，必须包含 @')
  const paymentMethod = readSupplierOption(input.paymentMethod, PMS_SUPPLIER_PAYMENT_METHODS, '付款方式', 'SUPPLIER_PAYMENT_METHOD')
  const currency = readSupplierOption(input.currency, PMS_SUPPLIER_CURRENCIES, '币种', 'SUPPLIER_CURRENCY')
  const defaultDeliveryMethod = readSupplierOption(input.defaultDeliveryMethod, PMS_SUPPLIER_DELIVERY_METHODS, '默认交货方式', 'SUPPLIER_DELIVERY_METHOD')
  if (!Number.isInteger(input.leadTimeDays) || input.leadTimeDays <= 0) throw new PmsDomainError('SUPPLIER_LEAD_TIME_INVALID', '供货周期必须是大于 0 的天数')
  const duplicatedName = suppliers.find((supplier) => supplier.supplierName === supplierName && supplier.supplierCode !== excludeCode)
  if (duplicatedName) throw new PmsDomainError('SUPPLIER_NAME_DUPLICATE', '供应商名称已存在')
  const duplicatedShortName = suppliers.find((supplier) => supplier.shortName === shortName && supplier.supplierCode !== excludeCode)
  if (duplicatedShortName) throw new PmsDomainError('SUPPLIER_SHORT_NAME_DUPLICATE', '供应商简称已存在')
  return {
    supplierName,
    shortName,
    category,
    country,
    city,
    contactName,
    contactPhone,
    email,
    wechat: (input.wechat ?? '').trim(),
    level,
    paymentMethod,
    currency,
    defaultDeliveryMethod,
    invoiceInfo: (input.invoiceInfo ?? '').trim(),
    bankAccount: (input.bankAccount ?? '').trim(),
    leadTimeDays: input.leadTimeDays,
    address: input.address.trim(),
    remark: input.remark.trim(),
  }
}

export function createPmsSupplier(input: PmsSupplierInput, actor: { id: string; name: string; role: PmsActorRole }): PmsSupplier {
  const values = validateSupplierInput(input)
  supplierSequence += 1
  const now = new Date().toISOString()
  const supplier: PmsSupplier = {
    supplierCode: `SUP-2026-${String(supplierSequence).padStart(4, '0')}`,
    ...values,
    tags: [],
    status: '草稿',
    rejectReason: '',
    materialCount: 0,
    totalPurchaseOrders: 0,
    totalPurchaseAmount: 0,
    onTimeDeliveryRate: 0,
    qualityPassRate: 0,
    recentPurchaseOrderNo: '',
    recentPurchaseDate: '',
    createdBy: actor.name,
    createdAt: now,
    updatedBy: actor.name,
    updatedAt: now,
  }
  suppliers.unshift(supplier)
  appendPmsLog({ objectType: 'supplier', objectId: supplier.supplierCode, action: '创建', beforeValue: '', afterValue: `${supplier.supplierName} · 草稿`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return supplier
}

export function updatePmsSupplier(supplierCode: string, input: PmsSupplierInput, actor: { id: string; name: string; role: PmsActorRole }): PmsSupplier {
  const supplier = getPmsSupplier(supplierCode)
  if (!supplier) throw new PmsDomainError('SUPPLIER_NOT_FOUND', `供应商 ${supplierCode} 不存在`)
  if (supplier.status === '已启用' || supplier.status === '已停用') {
    throw new PmsDomainError('SUPPLIER_EDIT_BLOCKED', '已启用/已停用的供应商需先停用或由管理员调整，本原型仅支持草稿与驳回状态编辑')
  }
  const values = validateSupplierInput(input, supplierCode)
  Object.assign(supplier, values)
  supplier.updatedBy = actor.name
  supplier.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'supplier', objectId: supplierCode, action: '编辑', beforeValue: '', afterValue: supplier.supplierName, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return supplier
}

const SUPPLIER_TRANSITIONS: Record<PmsSupplierStatus, PmsSupplierStatus[]> = {
  草稿: ['待审核'],
  待审核: ['已启用', '已驳回'],
  已驳回: ['草稿'],
  已启用: ['已停用'],
  已停用: ['已启用'],
}

export function pmsAllowedSupplierNextStatuses(status: PmsSupplierStatus): PmsSupplierStatus[] {
  return SUPPLIER_TRANSITIONS[status]
}

export function advancePmsSupplierStatus(
  supplierCode: string,
  nextStatus: PmsSupplierStatus,
  actor: { id: string; name: string; role: PmsActorRole },
  reason = '',
): PmsSupplier {
  const supplier = getPmsSupplier(supplierCode)
  if (!supplier) throw new PmsDomainError('SUPPLIER_NOT_FOUND', `供应商 ${supplierCode} 不存在`)
  if (!SUPPLIER_TRANSITIONS[supplier.status].includes(nextStatus)) {
    throw new PmsDomainError('SUPPLIER_TRANSITION_BLOCKED', `${supplier.status} 不能直接流转到 ${nextStatus}`)
  }
  if (nextStatus === '已驳回' && !reason.trim()) throw new PmsDomainError('SUPPLIER_REASON_REQUIRED', '驳回必须填写原因')
  const before = supplier.status
  supplier.status = nextStatus
  if (nextStatus === '已驳回') supplier.rejectReason = reason.trim()
  if (nextStatus === '草稿') supplier.rejectReason = ''
  supplier.updatedBy = actor.name
  supplier.updatedAt = new Date().toISOString()
  appendPmsLog({
    objectType: 'supplier',
    objectId: supplierCode,
    action: `状态流转 · ${nextStatus}`,
    beforeValue: before,
    afterValue: nextStatus,
    reason: reason.trim(),
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    secondConfirmation: nextStatus === '已停用' || nextStatus === '已驳回',
  })
  return supplier
}
