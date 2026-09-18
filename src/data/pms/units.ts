import { appendPmsLog, PmsDomainError, type PmsActorRole } from './runtime.ts'

export type PmsUnitCategory = '长度' | '重量' | '数量' | '包装' | '面积' | '体积'

export interface PmsUnit {
  unitCode: string
  unitName: string
  symbol: string
  category: PmsUnitCategory
  precision: number
  baseUnitCode: string
  conversionRate: string
  status: '启用' | '停用'
  remark: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface PmsUnitSeed {
  unitName: string
  symbol: string
  category: PmsUnitCategory
  precision: number
  baseUnitCode: string
  conversionRate: string
  status: '启用' | '停用'
  remark: string
}

const seeds: PmsUnitSeed[] = [
  { unitName: '件', symbol: 'PCS', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '成衣与样衣基本单位' },
  { unitName: '个', symbol: 'PC', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '条', symbol: 'PCS', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '套', symbol: 'SET', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '1套=2件', status: '启用', remark: '' },
  { unitName: '双', symbol: 'PAIR', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '1双=2只', status: '启用', remark: '袜子等成对物料' },
  { unitName: '打', symbol: 'DOZ', category: '数量', precision: 0, baseUnitCode: '', conversionRate: '1打=12件', status: '启用', remark: '' },
  { unitName: '箱', symbol: 'CTN', category: '包装', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '按实际装箱数换算' },
  { unitName: '包', symbol: 'PKG', category: '包装', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '袋', symbol: 'BAG', category: '包装', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '板', symbol: 'CARD', category: '包装', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '捆', symbol: 'BUNDLE', category: '包装', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '盒', symbol: 'BOX', category: '包装', precision: 0, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '米', symbol: 'M', category: '长度', precision: 2, baseUnitCode: '', conversionRate: '', status: '启用', remark: '面料基本单位' },
  { unitName: '毫米', symbol: 'MM', category: '长度', precision: 0, baseUnitCode: '', conversionRate: '1厘米=10毫米', status: '启用', remark: '纽扣、拉链规格' },
  { unitName: '码', symbol: 'YD', category: '长度', precision: 2, baseUnitCode: '', conversionRate: '1码=0.9144米', status: '启用', remark: '' },
  { unitName: '厘米', symbol: 'CM', category: '长度', precision: 1, baseUnitCode: '', conversionRate: '1米=100厘米', status: '启用', remark: '' },
  { unitName: '英寸', symbol: 'IN', category: '长度', precision: 2, baseUnitCode: '', conversionRate: '1英寸=2.54厘米', status: '启用', remark: '' },
  { unitName: '卷', symbol: 'ROLL', category: '包装', precision: 0, baseUnitCode: '', conversionRate: '按供货档案折算', status: '启用', remark: '' },
  { unitName: '公斤', symbol: 'KG', category: '重量', precision: 2, baseUnitCode: '', conversionRate: '', status: '启用', remark: '纱线与罗纹基本单位' },
  { unitName: '克', symbol: 'G', category: '重量', precision: 0, baseUnitCode: '', conversionRate: '1公斤=1000克', status: '启用', remark: '小克重辅料' },
  { unitName: '磅', symbol: 'LB', category: '重量', precision: 2, baseUnitCode: '', conversionRate: '1磅=0.4536公斤', status: '停用', remark: '外贸扩展，暂不使用' },
  { unitName: '克', symbol: 'G', category: '重量', precision: 0, baseUnitCode: 'U-014', conversionRate: '1公斤=1000克', status: '启用', remark: '' },
  { unitName: '吨', symbol: 'T', category: '重量', precision: 3, baseUnitCode: 'U-014', conversionRate: '1吨=1000公斤', status: '启用', remark: '' },
  { unitName: '平方米', symbol: '㎡', category: '面积', precision: 2, baseUnitCode: '', conversionRate: '', status: '启用', remark: '' },
  { unitName: '立方米', symbol: 'm³', category: '体积', precision: 3, baseUnitCode: '', conversionRate: '', status: '启用', remark: '头程体积计费用' },
]

const units: PmsUnit[] = seeds.map((seed, index) => ({
  unitCode: `U-${String(index + 1).padStart(3, '0')}`,
  ...seed,
  createdBy: '采购主管',
  createdAt: '2026-01-06 10:00:00',
  updatedAt: '2026-04-30 10:00:00',
}))

let unitSequence = units.length

export function listPmsUnits(): PmsUnit[] {
  return units
}

export function getPmsUnit(unitCode: string): PmsUnit | undefined {
  return units.find((unit) => unit.unitCode === unitCode)
}

export interface PmsUnitInput {
  unitName: string
  symbol: string
  category: PmsUnitCategory
  precision: number
  baseUnitCode: string
  conversionRate: string
  remark: string
}

function validateUnitInput(input: PmsUnitInput, excludeCode = ''): void {
  if (!input.unitName.trim()) throw new PmsDomainError('UNIT_NAME_REQUIRED', '单位名称不能为空')
  if (!input.symbol.trim()) throw new PmsDomainError('UNIT_SYMBOL_REQUIRED', '单位缩写不能为空')
  if (!Number.isInteger(input.precision) || input.precision < 0 || input.precision > 4) throw new PmsDomainError('UNIT_PRECISION_INVALID', '小数位必须是 0 到 4 的整数')
  const nameDuplicated = units.find((unit) => unit.unitName === input.unitName.trim() && unit.unitCode !== excludeCode)
  if (nameDuplicated) throw new PmsDomainError('UNIT_NAME_DUPLICATE', '单位名称已存在')
  const symbolDuplicated = units.find((unit) => unit.symbol === input.symbol.trim() && unit.unitCode !== excludeCode)
  if (symbolDuplicated) throw new PmsDomainError('UNIT_SYMBOL_DUPLICATE', '单位缩写已存在')
}

export function createPmsUnit(input: PmsUnitInput, actor: { id: string; name: string; role: PmsActorRole }): PmsUnit {
  validateUnitInput(input)
  unitSequence += 1
  const unit: PmsUnit = {
    unitCode: `U-${String(unitSequence).padStart(3, '0')}`,
    unitName: input.unitName.trim(),
    symbol: input.symbol.trim(),
    category: input.category,
    precision: input.precision,
    baseUnitCode: input.baseUnitCode,
    conversionRate: input.conversionRate.trim(),
    status: '启用',
    remark: input.remark.trim(),
    createdBy: actor.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  units.push(unit)
  appendPmsLog({ objectType: 'unit', objectId: unit.unitCode, action: '创建', beforeValue: '', afterValue: `${unit.unitName}（${unit.symbol}）`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return unit
}

export function updatePmsUnit(unitCode: string, input: PmsUnitInput, actor: { id: string; name: string; role: PmsActorRole }): PmsUnit {
  const unit = getPmsUnit(unitCode)
  if (!unit) throw new PmsDomainError('UNIT_NOT_FOUND', `单位 ${unitCode} 不存在`)
  validateUnitInput(input, unitCode)
  const before = `${unit.unitName}（${unit.symbol}）`
  unit.unitName = input.unitName.trim()
  unit.symbol = input.symbol.trim()
  unit.category = input.category
  unit.precision = input.precision
  unit.baseUnitCode = input.baseUnitCode
  unit.conversionRate = input.conversionRate.trim()
  unit.remark = input.remark.trim()
  unit.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'unit', objectId: unitCode, action: '编辑', beforeValue: before, afterValue: `${unit.unitName}（${unit.symbol}）`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role })
  return unit
}

export function togglePmsUnitStatus(unitCode: string, actor: { id: string; name: string; role: PmsActorRole }): PmsUnit {
  const unit = getPmsUnit(unitCode)
  if (!unit) throw new PmsDomainError('UNIT_NOT_FOUND', `单位 ${unitCode} 不存在`)
  const before = unit.status
  unit.status = before === '启用' ? '停用' : '启用'
  unit.updatedAt = new Date().toISOString()
  appendPmsLog({ objectType: 'unit', objectId: unitCode, action: '启停', beforeValue: before, afterValue: unit.status, reason: '单位字典不提供删除', actorId: actor.id, actorName: actor.name, actorRole: actor.role, secondConfirmation: true })
  return unit
}
