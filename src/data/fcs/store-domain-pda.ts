// =============================================
// PDA / 权限域 — 从 fcs-store.tsx 拆出
// 不引入 React；fcs-store.tsx 从此处 import 并 re-export
// =============================================

import { indonesiaFactories, type IndonesiaFactory } from './indonesia-factories'

// =============================================
// 权限键
// =============================================
export type PermissionKey =
  | 'TASK_ACCEPT'
  | 'TASK_REJECT'
  | 'TASK_START'
  | 'TASK_FINISH'
  | 'TASK_BLOCK'
  | 'TASK_UNBLOCK'
  | 'HANDOVER_CONFIRM'
  | 'HANDOVER_DISPUTE'
  | 'QC_CREATE'
  | 'QC_SUBMIT'
  | 'SETTLEMENT_VIEW'
  | 'SETTLEMENT_CONFIRM'
  | 'SETTLEMENT_DISPUTE'

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
    permissionKeys: [
      'TASK_ACCEPT', 'TASK_REJECT', 'TASK_START', 'TASK_FINISH', 'TASK_BLOCK', 'TASK_UNBLOCK',
      'HANDOVER_CONFIRM', 'HANDOVER_DISPUTE',
      'QC_CREATE', 'QC_SUBMIT',
      'SETTLEMENT_VIEW', 'SETTLEMENT_CONFIRM', 'SETTLEMENT_DISPUTE',
    ],
  },
  {
    roleId: 'ROLE_DISPATCH',
    roleName: '调度员',
    permissionKeys: ['TASK_ACCEPT', 'TASK_REJECT'],
  },
  {
    roleId: 'ROLE_PRODUCTION',
    roleName: '生产员',
    permissionKeys: ['TASK_START', 'TASK_FINISH', 'TASK_BLOCK', 'TASK_UNBLOCK'],
  },
  {
    roleId: 'ROLE_HANDOVER',
    roleName: '交接员',
    permissionKeys: ['HANDOVER_CONFIRM', 'HANDOVER_DISPUTE'],
  },
  {
    roleId: 'ROLE_QC',
    roleName: '质检员',
    permissionKeys: ['QC_CREATE', 'QC_SUBMIT'],
  },
  {
    roleId: 'ROLE_FINANCE',
    roleName: '财务',
    permissionKeys: ['SETTLEMENT_VIEW', 'SETTLEMENT_CONFIRM', 'SETTLEMENT_DISPUTE'],
  },
  {
    roleId: 'ROLE_VIEWER',
    roleName: '只读',
    permissionKeys: [],
  },
]

// 每个 ACTIVE 工厂生成 3 个用户（调度/生产/质检）+ 1 个管理员
export function generateFactoryUsers(factories: IndonesiaFactory[]): FactoryUser[] {
  const users: FactoryUser[] = []
  const userTemplates: Array<{ suffix: string; name: string; roleIds: string[] }> = [
    { suffix: 'dispatch', name: '调度员', roleIds: ['ROLE_DISPATCH', 'ROLE_HANDOVER'] },
    { suffix: 'prod',     name: '生产员', roleIds: ['ROLE_PRODUCTION'] },
    { suffix: 'qc',       name: '质检员', roleIds: ['ROLE_QC'] },
  ]
  factories
    .filter(f => f.status === 'ACTIVE')
    .forEach(f => {
      userTemplates.forEach(tpl => {
        users.push({
          userId: `${f.id}_${tpl.suffix}`,
          factoryId: f.id,
          name: `${f.name.split(' ').slice(0, 2).join('_')}_${tpl.name}`,
          status: 'ACTIVE',
          roleIds: tpl.roleIds,
        })
      })
      users.push({
        userId: `${f.id}_admin`,
        factoryId: f.id,
        name: `${f.name.split(' ').slice(0, 2).join('_')}_管理员`,
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
  { roleId: 'ROLE_ADMIN',      roleName: '管理员', permissionKeys: ['TASK_ACCEPT','TASK_REJECT','TASK_START','TASK_FINISH','TASK_BLOCK','TASK_UNBLOCK','HANDOVER_CONFIRM','HANDOVER_DISPUTE','QC_CREATE','QC_SUBMIT','SETTLEMENT_VIEW','SETTLEMENT_CONFIRM','SETTLEMENT_DISPUTE'] },
  { roleId: 'ROLE_DISPATCH',   roleName: '调度员', permissionKeys: ['TASK_ACCEPT','TASK_REJECT'] },
  { roleId: 'ROLE_PRODUCTION', roleName: '生产员', permissionKeys: ['TASK_START','TASK_FINISH','TASK_BLOCK','TASK_UNBLOCK'] },
  { roleId: 'ROLE_HANDOVER',   roleName: '交接员', permissionKeys: ['HANDOVER_CONFIRM','HANDOVER_DISPUTE'] },
  { roleId: 'ROLE_QC',         roleName: '质检员', permissionKeys: ['QC_CREATE','QC_SUBMIT'] },
  { roleId: 'ROLE_FINANCE',    roleName: '财务',   permissionKeys: ['SETTLEMENT_VIEW','SETTLEMENT_CONFIRM','SETTLEMENT_DISPUTE'] },
  { roleId: 'ROLE_VIEWER',     roleName: '只读',   permissionKeys: [] },
]

export const initialFactoryPdaUsers: FactoryPdaUser[] = []

// =============================================
// Permission Catalog（全局权限字典，只读）
// =============================================
export interface PermissionCatalogItem {
  key: PermissionKey
  nameZh: string
  group: '任务接收' | '生产执行' | '交接' | '质量' | '结算'
  descriptionZh: string
}

export const permissionCatalog: PermissionCatalogItem[] = [
  { key: 'TASK_ACCEPT',        nameZh: '接受任务',     group: '任务接收', descriptionZh: '允许在 PDA 上接受分配的生产任务' },
  { key: 'TASK_REJECT',        nameZh: '拒绝任务',     group: '任务接收', descriptionZh: '允许在 PDA 上拒绝不合适的生产任务' },
  { key: 'TASK_START',         nameZh: '开始生产',     group: '生产执行', descriptionZh: '允许将任务状态推进至"生产中"' },
  { key: 'TASK_FINISH',        nameZh: '完成生产',     group: '生产执行', descriptionZh: '允许将任务状态推进至"已完成"' },
  { key: 'TASK_BLOCK',         nameZh: '阻塞任务',     group: '生产执行', descriptionZh: '允许上报生产阻塞并填写原因' },
  { key: 'TASK_UNBLOCK',       nameZh: '解除阻塞',     group: '生产执行', descriptionZh: '允许解除已阻塞任务并填写处理说明' },
  { key: 'HANDOVER_CONFIRM',   nameZh: '确认交接',     group: '交接',     descriptionZh: '允许确认物料/成品交接数量无误' },
  { key: 'HANDOVER_DISPUTE',   nameZh: '提出交接异议', group: '交接',     descriptionZh: '允许提出数量差异或质量问题的交接异议' },
  { key: 'QC_CREATE',          nameZh: '创建质检',     group: '质量',     descriptionZh: '允许创建质量检验单' },
  { key: 'QC_SUBMIT',          nameZh: '提交质检',     group: '质量',     descriptionZh: '允许提交质量检验结果（含 FAIL 触发扣款）' },
  { key: 'SETTLEMENT_VIEW',    nameZh: '查看结算',     group: '结算',     descriptionZh: '允许查看结算单详情' },
  { key: 'SETTLEMENT_CONFIRM', nameZh: '确认结算',     group: '结算',     descriptionZh: '允许代表工厂确认结算金额' },
  { key: 'SETTLEMENT_DISPUTE', nameZh: '申请结算复议', group: '结算',     descriptionZh: '允许对结算金额发起复议申请' },
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
  ROLE_ADMIN:      ['TASK_ACCEPT','TASK_REJECT','TASK_START','TASK_FINISH','TASK_BLOCK','TASK_UNBLOCK','HANDOVER_CONFIRM','HANDOVER_DISPUTE','QC_CREATE','QC_SUBMIT','SETTLEMENT_VIEW','SETTLEMENT_CONFIRM','SETTLEMENT_DISPUTE'],
  ROLE_DISPATCH:   ['TASK_ACCEPT','TASK_REJECT'],
  ROLE_PRODUCTION: ['TASK_START','TASK_FINISH','TASK_BLOCK','TASK_UNBLOCK'],
  ROLE_HANDOVER:   ['HANDOVER_CONFIRM','HANDOVER_DISPUTE'],
  ROLE_QC:         ['QC_CREATE','QC_SUBMIT'],
  ROLE_FINANCE:    ['SETTLEMENT_VIEW','SETTLEMENT_CONFIRM','SETTLEMENT_DISPUTE'],
  ROLE_VIEWER:     [],
}
const PRESET_ROLE_NAMES: Record<string, string> = {
  ROLE_ADMIN: '管理员', ROLE_DISPATCH: '调度员', ROLE_PRODUCTION: '生产员',
  ROLE_HANDOVER: '交接员', ROLE_QC: '质检员', ROLE_FINANCE: '财务', ROLE_VIEWER: '只读',
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
