import type { SamCurrentFieldKey } from './process-craft-dict'

// 工厂状态
export type FactoryStatus = 'active' | 'paused' | 'blacklist' | 'inactive'

// 合作模式
export type CooperationMode = 'exclusive' | 'preferred' | 'general'

// 组织层级
export type FactoryTier = 'CENTRAL' | 'SATELLITE' | 'THIRD_PARTY'

// 工厂类型
export type FactoryType =
  // 中央工厂类型
  | 'CENTRAL_GARMENT'    // 成衣厂
  | 'CENTRAL_PRINT'       // 印花厂
  | 'CENTRAL_DYE'         // 染厂
  | 'CENTRAL_CUTTING'     // 裁床厂
  | 'CENTRAL_SPECIAL'     // 特种工艺厂
  | 'CENTRAL_AUX'         // 辅助工艺厂
  | 'CENTRAL_LACE'        // 花边厂
  | 'CENTRAL_RIBBON'      // 织带厂
  | 'CENTRAL_KNIT'        // 毛织厂
  | 'CENTRAL_POD'         // POD工厂
  | 'CENTRAL_DENIM_WASH'  // 牛仔水洗厂
  // 卫星工厂类型
  | 'SATELLITE_SEWING'    // 缝纫工厂
  | 'SATELLITE_FINISHING' // 后道工厂
  // 三方工厂类型
  | 'THIRD_SEWING'        // 小微缝纫工厂

// 生产流程开始条件
export interface FactoryEligibility {
  allowDispatch: boolean
  allowBid: boolean
  allowExecute: boolean
  allowSettle: boolean
}

export type FactoryAbilityScope = 'PROCESS' | 'CRAFT'
export type FactoryAbilityStatus = 'ACTIVE' | 'PAUSED' | 'DISABLED'
export type FactoryPostCapacityNodeCode = 'BUTTONHOLE' | 'BUTTON_ATTACH' | 'IRONING' | 'PACKAGING'
export type FactoryCapacityEquipmentStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'STOPPED' | 'FROZEN'
export type FactoryEquipmentStatus = FactoryCapacityEquipmentStatus

export interface FactoryProcessAbility {
  processCode: string
  craftCodes: string[]
  capacityNodeCodes?: FactoryPostCapacityNodeCode[]
  abilityId?: string
  processName?: string
  craftNames?: string[]
  abilityName?: string
  abilityScope?: FactoryAbilityScope
  canReceiveTask?: boolean
  capacityManaged?: boolean
  status?: FactoryAbilityStatus
  parentProcessCode?: string
}

export type FactoryCapacityFieldValue = number | string

// 工厂档案
export interface Factory {
  id: string
  code: string
  name: string
  address: string
  contact: string
  phone: string
  status: FactoryStatus
  cooperationMode: CooperationMode
  processAbilities: FactoryProcessAbility[]
  qualityScore: number
  deliveryScore: number
  createdAt: string
  updatedAt: string
  // 新增：组织层级
  factoryTier: FactoryTier
  factoryType: FactoryType
  parentFactoryId?: string
  // 新增：PDA 配置
  pdaEnabled: boolean
  pdaTenantId?: string
  // 新增：生产流程开始条件
  eligibility: FactoryEligibility
}

// 工厂表单数据
export interface FactoryFormData {
  name: string
  address: string
  contact: string
  phone: string
  status: FactoryStatus
  cooperationMode: CooperationMode
  processAbilities: FactoryProcessAbility[]
  // 新增字段
  factoryTier: FactoryTier
  factoryType: FactoryType
  parentFactoryId?: string
  pdaEnabled: boolean
  pdaTenantId?: string
  eligibility: FactoryEligibility
}

export interface FactoryCapacityEntry {
  processCode: string
  craftCode: string
  values: Partial<Record<SamCurrentFieldKey, FactoryCapacityFieldValue>>
  note: string
}

export interface FactoryCapacityProfile {
  factoryId: string
  entries: FactoryCapacityEntry[]
}

export interface FactoryCapacityEquipmentAbility {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  efficiencyValue: number
  efficiencyUnit: string
}

export interface FactoryCapacityEquipment {
  equipmentId: string
  factoryId: string
  equipmentName: string
  equipmentNo: string
  equipmentType?: 'GENERAL' | 'PRINT_MACHINE' | 'DYE_VAT' | 'POST_NODE'
  abilityList: FactoryCapacityEquipmentAbility[]
  quantity: number
  singleShiftMinutes: number
  status: FactoryCapacityEquipmentStatus
  displaySpecValue?: number
  displaySpecUnit?: string
  supportedMaterialTypes?: string[]
  remark?: string
}

export interface FactoryPostCapacityNode {
  capacityNodeId: string
  factoryId: string
  parentProcessCode: 'POST_FINISHING'
  nodeCode: FactoryPostCapacityNodeCode
  nodeName: string
  machineType?: string
  machineCount: number
  operatorCount?: number
  shiftMinutes: number
  efficiencyValue?: number
  efficiencyUnit?: string
  setupMinutes?: number
  switchMinutes?: number
  status: FactoryEquipmentStatus
  effectiveFrom?: string
}

export interface FactoryPrintMachineCapacity {
  printerId: string
  factoryId: string
  printerNo: string
  printerName?: string
  speedValue: number
  speedUnit: string
  shiftMinutes: number
  status: FactoryEquipmentStatus
  remark?: string
}

export interface FactoryDyeVatCapacity {
  dyeVatId: string
  factoryId: string
  dyeVatNo: string
  capacityQty: number
  capacityUnit: string
  supportedMaterialTypes: string[]
  shiftMinutes?: number
  status: FactoryEquipmentStatus
  remark?: string
}

// 状态配置
export const factoryStatusConfig: Record<FactoryStatus, { label: string; color: string }> = {
  active: { label: '在合作', color: 'bg-green-100 text-green-700 border-green-200' },
  paused: { label: '暂停', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  blacklist: { label: '黑名单', color: 'bg-red-100 text-red-700 border-red-200' },
  inactive: { label: '未激活', color: 'bg-gray-100 text-gray-700 border-gray-200' },
}

// 合作模式配置
export const cooperationModeConfig: Record<CooperationMode, { label: string }> = {
  exclusive: { label: '独家合作' },
  preferred: { label: '优先合作' },
  general: { label: '普通合作' },
}

// 层级显示配置
export const factoryTierConfig: Record<FactoryTier, { label: string; color: string }> = {
  CENTRAL:     { label: '中央工厂', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  SATELLITE:   { label: '卫星工厂', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  THIRD_PARTY: { label: '三方工厂', color: 'bg-orange-100 text-orange-700 border-orange-200' },
}

// 类型显示配置
export const factoryTypeConfig: Record<FactoryType, { label: string }> = {
  CENTRAL_GARMENT:     { label: '成衣厂' },
  CENTRAL_PRINT:       { label: '印花厂' },
  CENTRAL_DYE:         { label: '染厂' },
  CENTRAL_CUTTING:     { label: '裁床厂' },
  CENTRAL_SPECIAL:     { label: '特种工艺厂' },
  CENTRAL_AUX:         { label: '辅助工艺厂' },
  CENTRAL_LACE:        { label: '花边厂' },
  CENTRAL_RIBBON:      { label: '织带厂' },
  CENTRAL_KNIT:        { label: '毛织厂' },
  CENTRAL_POD:         { label: 'POD工厂' },
  CENTRAL_DENIM_WASH:  { label: '牛仔水洗厂' },
  SATELLITE_SEWING:    { label: '缝纫工厂' },
  SATELLITE_FINISHING: { label: '后道工厂' },
  THIRD_SEWING:        { label: '小微缝纫工厂' },
}

export const factoryAbilityScopeLabel: Record<FactoryAbilityScope, string> = {
  PROCESS: '工序',
  CRAFT: '工艺',
}

export const factoryAbilityStatusLabel: Record<FactoryAbilityStatus, string> = {
  ACTIVE: '可用',
  PAUSED: '暂停',
  DISABLED: '历史停用',
}

export const factoryCapacityEquipmentStatusLabel: Record<FactoryCapacityEquipmentStatus, string> = {
  AVAILABLE: '可用',
  IN_USE: '使用中',
  MAINTENANCE: '维护中',
  STOPPED: '停用',
  FROZEN: '冻结',
}

export const factoryEquipmentStatusLabel = factoryCapacityEquipmentStatusLabel

// tier 对应的 type 选项
export const typesByTier: Record<FactoryTier, FactoryType[]> = {
  CENTRAL: [
    'CENTRAL_GARMENT', 'CENTRAL_PRINT', 'CENTRAL_DYE', 'CENTRAL_CUTTING', 'CENTRAL_SPECIAL',
    'CENTRAL_AUX', 'CENTRAL_LACE', 'CENTRAL_RIBBON', 'CENTRAL_KNIT',
    'CENTRAL_POD', 'CENTRAL_DENIM_WASH',
  ],
  SATELLITE: ['SATELLITE_SEWING', 'SATELLITE_FINISHING'],
  THIRD_PARTY: ['THIRD_SEWING'],
}
