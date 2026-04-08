// =============================================
// PDA / 权限域 — 当前原型仓直接使用的数据域定义
// 无 React 依赖，供页面与数据模块直接引用
// =============================================

import { indonesiaFactories, type IndonesiaFactory } from './indonesia-factories'

// =============================================
// 权限键
// =============================================
export type PermissionKey =
  | 'TASK_ACCEPT'
  | 'TASK_REJECT'
  | 'QUOTE_SUBMIT'
  | 'QUOTE_VIEW'
  | 'TASK_START'
  | 'TASK_MILESTONE_REPORT'
  | 'TASK_FINISH'
  | 'TASK_BLOCK'
  | 'TASK_UNBLOCK'
  | 'CUTTING_PICKUP_CONFIRM'
  | 'CUTTING_PICKUP_LENGTH_DISPUTE'
  | 'CUTTING_SPREADING_SAVE'
  | 'CUTTING_REPLENISHMENT_FEEDBACK'
  | 'CUTTING_HANDOVER_CONFIRM'
  | 'CUTTING_INBOUND_CONFIRM'
  | 'PICKUP_CONFIRM'
  | 'PICKUP_QTY_DISPUTE'
  | 'HANDOUT_CREATE'
  | 'HANDOUT_QTY_DISPUTE'
  | 'QC_CONFIRM_DEDUCTION'
  | 'QC_DISPUTE'
  | 'SETTLEMENT_VIEW'
  | 'SETTLEMENT_CONFIRM'
  | 'SETTLEMENT_DISPUTE'
  | 'SETTLEMENT_CHANGE_REQUEST'

export const allFactoryMobileAppPermissionKeys: PermissionKey[] = [
  'TASK_ACCEPT',
  'TASK_REJECT',
  'QUOTE_SUBMIT',
  'QUOTE_VIEW',
  'TASK_START',
  'TASK_MILESTONE_REPORT',
  'TASK_FINISH',
  'TASK_BLOCK',
  'TASK_UNBLOCK',
  'CUTTING_PICKUP_CONFIRM',
  'CUTTING_PICKUP_LENGTH_DISPUTE',
  'CUTTING_SPREADING_SAVE',
  'CUTTING_REPLENISHMENT_FEEDBACK',
  'CUTTING_HANDOVER_CONFIRM',
  'CUTTING_INBOUND_CONFIRM',
  'PICKUP_CONFIRM',
  'PICKUP_QTY_DISPUTE',
  'HANDOUT_CREATE',
  'HANDOUT_QTY_DISPUTE',
  'QC_CONFIRM_DEDUCTION',
  'QC_DISPUTE',
  'SETTLEMENT_VIEW',
  'SETTLEMENT_CONFIRM',
  'SETTLEMENT_DISPUTE',
  'SETTLEMENT_CHANGE_REQUEST',
]

export const operatorFactoryMobileAppPermissionKeys: PermissionKey[] =
  allFactoryMobileAppPermissionKeys.filter(
    (permissionKey) =>
      permissionKey !== 'TASK_ACCEPT' &&
      permissionKey !== 'TASK_REJECT' &&
      permissionKey !== 'QUOTE_SUBMIT' &&
      permissionKey !== 'QUOTE_VIEW' &&
      permissionKey !== 'SETTLEMENT_VIEW' &&
      permissionKey !== 'SETTLEMENT_CONFIRM' &&
      permissionKey !== 'SETTLEMENT_DISPUTE' &&
      permissionKey !== 'SETTLEMENT_CHANGE_REQUEST',
  )

// =============================================
// FactoryRole / FactoryUser（旧版简单模型）
// =============================================
export interface FactoryRole {
  roleId: string
  roleName: string
  permissionKeys: PermissionKey[]
}

export interface FactoryUser {
  userId: string
  factoryId: string
  name: string
  status: 'ACTIVE' | 'LOCKED'
  roleIds: string[]
}

// =============================================
// PDA Session Helpers（带 SSR 保护）
// =============================================
const PDA_SESSION_KEY = 'fcs_pda_session'

export function getPdaSession(): { userId?: string; factoryId?: string } {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PDA_SESSION_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function setPdaSession(userId: string, factoryId: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PDA_SESSION_KEY, JSON.stringify({ userId, factoryId }))
}

export function clearPdaSession(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(PDA_SESSION_KEY)
}

// =============================================
// 角色模板（固定少量）
// =============================================
export const defaultFactoryRoles: FactoryRole[] = [
  {
    roleId: 'ROLE_ADMIN',
    roleName: '管理员',
    permissionKeys: [...allFactoryMobileAppPermissionKeys],
  },
  {
    roleId: 'ROLE_OPERATOR',
    roleName: '操作工',
    permissionKeys: [...operatorFactoryMobileAppPermissionKeys],
  },
]

export const DEFAULT_FACTORY_MOBILE_APP_ROLE_ID = 'ROLE_OPERATOR'

function buildFactoryMobileAppNamePrefix(factoryName: string): string {
  return factoryName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join('_')
}

// 旧版简单模型仍保留兼容，不参与工厂档案中的工厂端移动应用账号默认展示。
export function generateFactoryUsers(factories: IndonesiaFactory[]): FactoryUser[] {
  const users: FactoryUser[] = []
  const userTemplates: Array<{ suffix: string; name: string; roleIds: string[] }> = [
    { suffix: 'dispatch', name: '调度员', roleIds: ['ROLE_DISPATCH', 'ROLE_HANDOVER'] },
    { suffix: 'prod', name: '生产员', roleIds: ['ROLE_PRODUCTION'] },
    { suffix: 'qc', name: '质检员', roleIds: ['ROLE_QC'] },
  ]
  factories
    .filter(f => f.status === 'ACTIVE')
    .forEach(f => {
      const namePrefix = buildFactoryMobileAppNamePrefix(f.name)
      userTemplates.forEach(tpl => {
        users.push({
          userId: `${f.id}_${tpl.suffix}`,
          factoryId: f.id,
          name: `${namePrefix}_${tpl.name}`,
          status: 'ACTIVE',
          roleIds: tpl.roleIds,
        })
      })
      users.push({
        userId: `${f.id}_admin`,
        factoryId: f.id,
        name: `${namePrefix}_管理员`,
        status: 'ACTIVE',
        roleIds: ['ROLE_ADMIN'],
      })
    })
  return users
}

export const initialFactoryUsers: FactoryUser[] = generateFactoryUsers(indonesiaFactories)
export const initialFactoryRoles: FactoryRole[] = defaultFactoryRoles

// =============================================
// FactoryPdaUser — 工厂 PDA 账号主数据（含 loginId）
// =============================================
export type PdaRoleId =
  | 'ROLE_ADMIN'
  | 'ROLE_OPERATOR'
  | 'ROLE_DISPATCH'
  | 'ROLE_PRODUCTION'
  | 'ROLE_HANDOVER'
  | 'ROLE_QC'
  | 'ROLE_FINANCE'
  | 'ROLE_VIEWER'

export interface FactoryPdaUser {
  userId: string
  factoryId: string
  name: string
  loginId: string
  status: 'ACTIVE' | 'LOCKED'
  roleId: PdaRoleId
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

// 固定角色模板（供 UI 选择 & 权限展示）
export interface PdaRoleTemplate {
  roleId: PdaRoleId
  roleName: string
  permissionKeys: PermissionKey[]
}

export const pdaRoleTemplates: PdaRoleTemplate[] = [
  { roleId: 'ROLE_ADMIN', roleName: '管理员', permissionKeys: [...allFactoryMobileAppPermissionKeys] },
  { roleId: 'ROLE_OPERATOR', roleName: '操作工', permissionKeys: [...operatorFactoryMobileAppPermissionKeys] },
]

export function createFactoryPdaUsersForFactory(
  factoryId: string,
  factoryName: string,
  now = '2024-01-01 00:00:00',
): FactoryPdaUser[] {
  const namePrefix = buildFactoryMobileAppNamePrefix(factoryName)
  return [
    {
      userId: `${factoryId}_operator`,
      factoryId,
      name: `${namePrefix}_操作工`,
      loginId: `${factoryId}_operator`,
      status: 'ACTIVE',
      roleId: 'ROLE_OPERATOR',
      createdAt: now,
      createdBy: 'SYSTEM',
    },
    {
      userId: `${factoryId}_admin`,
      factoryId,
      name: `${namePrefix}_管理员`,
      loginId: `${factoryId}_admin`,
      status: 'ACTIVE',
      roleId: 'ROLE_ADMIN',
      createdAt: now,
      createdBy: 'SYSTEM',
    },
  ]
}

export function generateFactoryPdaUsers(factories: IndonesiaFactory[], now = '2024-01-01 00:00:00'): FactoryPdaUser[] {
  return factories
    .filter((factory) => factory.status === 'ACTIVE')
    .flatMap((factory) => createFactoryPdaUsersForFactory(factory.id, factory.name, now))
}

export const initialFactoryPdaUsers: FactoryPdaUser[] = generateFactoryPdaUsers(indonesiaFactories)

// =============================================
// Permission Catalog（全局权限字典，只读）
// =============================================
export interface PermissionCatalogItem {
  key: PermissionKey
  nameZh: string
  group: '接单' | '报价' | '执行' | '裁片执行' | '交接' | '质检' | '结算'
  descriptionZh: string
}

export const permissionCatalog: PermissionCatalogItem[] = [
  { key: 'TASK_ACCEPT',                   nameZh: '接受任务',         group: '接单',     descriptionZh: '允许在工厂端移动应用中接受分配的生产任务。' },
  { key: 'TASK_REJECT',                   nameZh: '拒绝接单',         group: '接单',     descriptionZh: '允许在工厂端移动应用中拒绝不合适的生产任务。' },
  { key: 'QUOTE_SUBMIT',                 nameZh: '提交报价',         group: '报价',     descriptionZh: '允许对待报价招标单提交报价。' },
  { key: 'QUOTE_VIEW',                   nameZh: '查看报价结果',     group: '报价',     descriptionZh: '允许查看已报价、已中标等报价结果。' },
  { key: 'TASK_START',                   nameZh: '开工',             group: '执行',     descriptionZh: '允许在执行模块中将任务推进为生产中。' },
  { key: 'TASK_MILESTONE_REPORT',        nameZh: '关键节点上报',     group: '执行',     descriptionZh: '允许在执行模块中上报关键节点。' },
  { key: 'TASK_BLOCK',                   nameZh: '生产暂停上报',     group: '执行',     descriptionZh: '允许上报生产暂停并填写原因。' },
  { key: 'TASK_UNBLOCK',                 nameZh: '恢复执行',         group: '执行',     descriptionZh: '允许解除生产暂停并填写处理说明。' },
  { key: 'TASK_FINISH',                  nameZh: '完工',             group: '执行',     descriptionZh: '允许在执行模块中提交完工。' },
  { key: 'CUTTING_PICKUP_CONFIRM',       nameZh: '确认领料',         group: '裁片执行', descriptionZh: '允许在裁片执行中确认领料结果。' },
  { key: 'CUTTING_PICKUP_LENGTH_DISPUTE',nameZh: '提交领料长度异议', group: '裁片执行', descriptionZh: '允许在裁片执行中提交领料长度异议。' },
  { key: 'CUTTING_SPREADING_SAVE',       nameZh: '保存铺布记录',     group: '裁片执行', descriptionZh: '允许在裁片执行中保存铺布记录。' },
  { key: 'CUTTING_REPLENISHMENT_FEEDBACK', nameZh: '提交补料反馈',   group: '裁片执行', descriptionZh: '允许在裁片执行中提交补料反馈。' },
  { key: 'CUTTING_HANDOVER_CONFIRM',     nameZh: '确认交接',         group: '裁片执行', descriptionZh: '允许在裁片执行中确认裁片交接。' },
  { key: 'CUTTING_INBOUND_CONFIRM',      nameZh: '确认入仓',         group: '裁片执行', descriptionZh: '允许在裁片执行中确认入仓。' },
  { key: 'PICKUP_CONFIRM',               nameZh: '领料确认',         group: '交接',     descriptionZh: '允许在交接模块中确认仓库回写的领料记录。' },
  { key: 'PICKUP_QTY_DISPUTE',           nameZh: '提交领料数量异议', group: '交接',     descriptionZh: '允许在交接模块中对领料数量发起异议。' },
  { key: 'HANDOUT_CREATE',               nameZh: '新增交出记录',     group: '交接',     descriptionZh: '允许在交接模块中新增交出记录。' },
  { key: 'HANDOUT_QTY_DISPUTE',          nameZh: '提交交出数量异议', group: '交接',     descriptionZh: '允许在交接模块中对交出数量发起异议。' },
  { key: 'QC_CONFIRM_DEDUCTION',         nameZh: '确认处理质量扣款', group: '质检',     descriptionZh: '允许确认质量扣款处理结果。' },
  { key: 'QC_DISPUTE',                   nameZh: '发起质检异议',     group: '质检',     descriptionZh: '允许对质量扣款或责任判定发起异议。' },
  { key: 'SETTLEMENT_VIEW',              nameZh: '查看结算',         group: '结算',     descriptionZh: '允许查看结算单与结算资料。' },
  { key: 'SETTLEMENT_CONFIRM',           nameZh: '确认对账单',       group: '结算',     descriptionZh: '允许确认对账单金额。' },
  { key: 'SETTLEMENT_DISPUTE',           nameZh: '发起对账单异议',   group: '结算',     descriptionZh: '允许对对账单发起异议。' },
  { key: 'SETTLEMENT_CHANGE_REQUEST',    nameZh: '申请修改结算资料', group: '结算',     descriptionZh: '允许提交结算资料调整申请。' },
]

// =============================================
// FactoryPdaRole — 工厂租户级别的角色主数据
// =============================================
export interface FactoryPdaRoleAuditLog {
  id: string
  action: string
  detail: string
  at: string
  by: string
}

export interface FactoryPdaRole {
  roleId: string            // 'ROLE_ADMIN' | 'ROLE_CUSTOM_<timestamp>'
  factoryId: string
  roleName: string
  status: 'ACTIVE' | 'DISABLED'
  permissionKeys: PermissionKey[]
  isSystemPreset: boolean
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
  auditLogs: FactoryPdaRoleAuditLog[]
}

// 系统预设角色权限映射
const PRESET_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  ROLE_ADMIN: [...allFactoryMobileAppPermissionKeys],
  ROLE_OPERATOR: [...operatorFactoryMobileAppPermissionKeys],
}
const PRESET_ROLE_NAMES: Record<string, string> = {
  ROLE_ADMIN: '管理员',
  ROLE_OPERATOR: '操作工',
}

const LEGACY_COMPAT_ROLE_NAMES: Record<string, string> = {
  ROLE_DISPATCH: '调度员',
  ROLE_PRODUCTION: '生产员',
  ROLE_HANDOVER: '交接员',
  ROLE_QC: '质检员',
  ROLE_FINANCE: '财务',
  ROLE_VIEWER: '只读',
}

export function getFactoryMobileAppRoleName(roleId: string): string {
  return PRESET_ROLE_NAMES[roleId] || LEGACY_COMPAT_ROLE_NAMES[roleId] || roleId
}

export function generatePresetRolesForFactory(factoryId: string, now: string): FactoryPdaRole[] {
  return Object.keys(PRESET_ROLE_PERMISSIONS).map(roleId => ({
    roleId,
    factoryId,
    roleName: PRESET_ROLE_NAMES[roleId],
    status: 'ACTIVE' as const,
    permissionKeys: PRESET_ROLE_PERMISSIONS[roleId],
    isSystemPreset: true,
    createdAt: now,
    createdBy: 'SYSTEM',
    auditLogs: [],
  }))
}

const INIT_NOW = '2024-01-01 00:00:00'
export const initialFactoryPdaRoles: FactoryPdaRole[] = indonesiaFactories
  .filter(f => f.status === 'ACTIVE')
  .flatMap(f => generatePresetRolesForFactory(f.id, INIT_NOW))
