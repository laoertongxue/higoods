// 结算周期类型
export type CycleType = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'PER_BATCH'

// 计价方式
export type PricingMode = 'BY_PIECE' | 'BY_PROCESS' | 'BY_ORDER'

// 扣款规则类型
export type RuleType = 'QUALITY_DEFECT' | 'DELAY_DELIVERY' | 'MATERIAL_LOSS'

// 规则计算方式
export type RuleMode = 'FIXED_AMOUNT' | 'PERCENTAGE'

// 状态
export type SettlementStatus = 'ACTIVE' | 'INACTIVE'

// 结算配置
export interface FactorySettlementProfile {
  id: string
  factoryId: string
  factoryName: string
  cycleType: CycleType
  settlementDayRule?: string
  pricingMode: PricingMode
  currency: string
  isActive: boolean
  effectiveFrom: string
  effectiveTo?: string
  updatedAt: string
}

// 收款账户
export interface FactoryBankAccount {
  id: string
  factoryId: string
  accountName: string
  bankName: string
  accountMasked: string
  currency: string
  isDefault: boolean
  status: SettlementStatus
}

// 默认扣款规则
export interface DefaultPenaltyRule {
  id: string
  factoryId: string
  ruleType: RuleType
  ruleMode: RuleMode
  ruleValue: number
  effectiveFrom: string
  effectiveTo?: string
  status: SettlementStatus
}

// 工厂结算情况（列表页用）
export interface FactorySettlementSummary {
  factoryId: string
  factoryName: string
  cycleType: CycleType
  pricingMode: PricingMode
  currency: string
  hasDefaultAccount: boolean
  status: SettlementStatus
  updatedAt: string
}

// 表单数据类型
export interface SettlementProfileFormData {
  cycleType: CycleType
  settlementDayRule?: string
  pricingMode: PricingMode
  currency: string
  effectiveFrom: string
}

export interface BankAccountFormData {
  accountName: string
  bankName: string
  accountMasked: string
  currency: string
  isDefault: boolean
  status: SettlementStatus
}

export interface PenaltyRuleFormData {
  ruleType: RuleType
  ruleMode: RuleMode
  ruleValue: number
  effectiveFrom: string
  status: SettlementStatus
}

// 配置映射
export const cycleTypeConfig: Record<CycleType, { label: string }> = {
  WEEKLY: { label: '每周' },
  BIWEEKLY: { label: '双周' },
  MONTHLY: { label: '每月' },
  PER_BATCH: { label: '按批次' },
}

export const pricingModeConfig: Record<PricingMode, { label: string }> = {
  BY_PIECE: { label: '按件计价' },
  BY_PROCESS: { label: '按工序计价' },
  BY_ORDER: { label: '按订单计价' },
}

export const ruleTypeConfig: Record<RuleType, { label: string }> = {
  QUALITY_DEFECT: { label: '质量缺陷' },
  DELAY_DELIVERY: { label: '延迟交付' },
  MATERIAL_LOSS: { label: '物料损耗' },
}

export const ruleModeConfig: Record<RuleMode, { label: string }> = {
  FIXED_AMOUNT: { label: '固定金额' },
  PERCENTAGE: { label: '百分比' },
}

export const settlementStatusConfig: Record<SettlementStatus, { label: string; color: string }> = {
  ACTIVE: { label: '生效', color: 'bg-green-50 text-green-700 border-green-200' },
  INACTIVE: { label: '失效', color: 'bg-gray-100 text-gray-600 border-gray-200' },
}
