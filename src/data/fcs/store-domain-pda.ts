// =============================================
// PDA / 权限域 — 当前原型仓直接使用的数据域定义
// 无 React 依赖，供页面与数据模块直接引用
// =============================================

import {
  getBrowserLocalStorage,
  readBrowserStorageItem,
  removeBrowserStorageItem,
  writeBrowserStorageItem,
} from '../browser-storage.ts'
import { getFactoryMasterRecordById, listFactoryMasterRecords } from './factory-master-store.ts'
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
    .filter((factory) => factory.status === 'ACTIVE')
    .forEach((factory) => {
      const namePrefix = buildFactoryMobileAppNamePrefix(factory.name)
      userTemplates.forEach((tpl) => {
        users.push({
          userId: `${factory.id}_${tpl.suffix}`,
          factoryId: factory.id,
          name: `${namePrefix}_${tpl.name}`,
          status: 'ACTIVE',
          roleIds: tpl.roleIds,
        })
      })
      users.push({
        userId: `${factory.id}_admin`,
        factoryId: factory.id,
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
  passwordHash: string
  passwordUpdatedAt?: string
  status: 'ACTIVE' | 'LOCKED'
  roleId: PdaRoleId
  createdAt: string
  createdBy: string
  updatedAt?: string
  updatedBy?: string
}

export interface FactoryPdaSession {
  userId: string
  loginId: string
  userName: string
  roleId: string
  factoryId: string
  factoryName: string
  loggedAt: string
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

const LEGACY_DEFAULT_PDA_PASSWORD_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'

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
      passwordHash: LEGACY_DEFAULT_PDA_PASSWORD_HASH,
      passwordUpdatedAt: now,
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
      passwordHash: LEGACY_DEFAULT_PDA_PASSWORD_HASH,
      passwordUpdatedAt: now,
      status: 'ACTIVE',
      roleId: 'ROLE_ADMIN',
      createdAt: now,
      createdBy: 'SYSTEM',
    },
  ]
}

export function generateFactoryPdaUsers(
  factories: IndonesiaFactory[],
  now = '2024-01-01 00:00:00',
): FactoryPdaUser[] {
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
  { key: 'TASK_ACCEPT', nameZh: '接受任务', group: '接单', descriptionZh: '允许在工厂端移动应用中接受分配的生产任务。' },
  { key: 'TASK_REJECT', nameZh: '拒绝接单', group: '接单', descriptionZh: '允许在工厂端移动应用中拒绝不合适的生产任务。' },
  { key: 'QUOTE_SUBMIT', nameZh: '提交报价', group: '报价', descriptionZh: '允许对待报价招标单提交报价。' },
  { key: 'QUOTE_VIEW', nameZh: '查看报价结果', group: '报价', descriptionZh: '允许查看已报价、已中标等报价结果。' },
  { key: 'TASK_START', nameZh: '开工', group: '执行', descriptionZh: '允许在执行模块中将任务推进为生产中。' },
  { key: 'TASK_MILESTONE_REPORT', nameZh: '关键节点上报', group: '执行', descriptionZh: '允许在执行模块中上报关键节点。' },
  { key: 'TASK_BLOCK', nameZh: '生产暂停上报', group: '执行', descriptionZh: '允许上报生产暂停并填写原因。' },
  { key: 'TASK_UNBLOCK', nameZh: '恢复执行', group: '执行', descriptionZh: '允许解除生产暂停并填写处理说明。' },
  { key: 'TASK_FINISH', nameZh: '完工', group: '执行', descriptionZh: '允许在执行模块中提交完工。' },
  { key: 'CUTTING_PICKUP_CONFIRM', nameZh: '确认领料', group: '裁片执行', descriptionZh: '允许在裁片执行中确认领料结果。' },
  { key: 'CUTTING_PICKUP_LENGTH_DISPUTE', nameZh: '提交领料长度异议', group: '裁片执行', descriptionZh: '允许在裁片执行中提交领料长度异议。' },
  { key: 'CUTTING_SPREADING_SAVE', nameZh: '保存铺布记录', group: '裁片执行', descriptionZh: '允许在裁片执行中保存铺布记录。' },
  { key: 'CUTTING_REPLENISHMENT_FEEDBACK', nameZh: '提交补料反馈', group: '裁片执行', descriptionZh: '允许在裁片执行中提交补料反馈。' },
  { key: 'CUTTING_HANDOVER_CONFIRM', nameZh: '确认交接', group: '裁片执行', descriptionZh: '允许在裁片执行中确认裁片交接。' },
  { key: 'CUTTING_INBOUND_CONFIRM', nameZh: '确认入仓', group: '裁片执行', descriptionZh: '允许在裁片执行中确认入仓。' },
  { key: 'PICKUP_CONFIRM', nameZh: '领料确认', group: '交接', descriptionZh: '允许在交接模块中确认仓库回写的领料记录。' },
  { key: 'PICKUP_QTY_DISPUTE', nameZh: '提交领料数量异议', group: '交接', descriptionZh: '允许在交接模块中对领料数量发起异议。' },
  { key: 'HANDOUT_CREATE', nameZh: '新增交出记录', group: '交接', descriptionZh: '允许在交接模块中新增交出记录。' },
  { key: 'HANDOUT_QTY_DISPUTE', nameZh: '提交交出数量异议', group: '交接', descriptionZh: '允许在交接模块中对交出数量发起异议。' },
  { key: 'QC_CONFIRM_DEDUCTION', nameZh: '确认处理质量扣款', group: '质检', descriptionZh: '允许确认质量扣款处理结果。' },
  { key: 'QC_DISPUTE', nameZh: '发起质检异议', group: '质检', descriptionZh: '允许对质量扣款或责任判定发起异议。' },
  { key: 'SETTLEMENT_VIEW', nameZh: '查看结算', group: '结算', descriptionZh: '允许查看结算单与结算资料。' },
  { key: 'SETTLEMENT_CONFIRM', nameZh: '确认对账单', group: '结算', descriptionZh: '允许确认对账单金额。' },
  { key: 'SETTLEMENT_DISPUTE', nameZh: '发起对账单异议', group: '结算', descriptionZh: '允许对对账单发起异议。' },
  { key: 'SETTLEMENT_CHANGE_REQUEST', nameZh: '申请修改结算资料', group: '结算', descriptionZh: '允许提交结算资料调整申请。' },
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
  roleId: string
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
  return Object.keys(PRESET_ROLE_PERMISSIONS).map((roleId) => ({
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
  .filter((factory) => factory.status === 'ACTIVE')
  .flatMap((factory) => generatePresetRolesForFactory(factory.id, INIT_NOW))

// =============================================
// 本地持久化 PDA 用户 / 角色 / 会话
// =============================================
const PDA_USER_STORE_KEY = 'fcs_pda_user_store_v1'
const PDA_ROLE_STORE_KEY = 'fcs_pda_role_store_v1'
const PDA_SESSION_KEY = 'fcs_pda_session'

let cachedPdaUsers: FactoryPdaUser[] | null = null
let cachedPdaRoles: FactoryPdaRole[] | null = null

function clonePermissionKeys(permissionKeys: PermissionKey[]): PermissionKey[] {
  return [...permissionKeys]
}

function clonePdaUser(user: FactoryPdaUser): FactoryPdaUser {
  return {
    ...user,
  }
}

function clonePdaRole(role: FactoryPdaRole): FactoryPdaRole {
  return {
    ...role,
    permissionKeys: clonePermissionKeys(role.permissionKeys),
    auditLogs: role.auditLogs.map((item) => ({ ...item })),
  }
}

function clonePdaSession(session: FactoryPdaSession): FactoryPdaSession {
  return {
    ...session,
  }
}

function getStorage(): Storage | null {
  const storage = getBrowserLocalStorage()
  if (!storage || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    return null
  }
  return storage as Storage
}

export function normalizePdaLoginId(loginId: string): string {
  return loginId.trim().toLowerCase()
}

export function normalizePdaPassword(password: string): string {
  return password.trim()
}

function getPdaSubtleCrypto(): SubtleCrypto {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle
  throw new Error('当前环境不支持密码摘要。')
}

export async function hashPdaPassword(rawPassword: string): Promise<string> {
  const normalizedPassword = normalizePdaPassword(rawPassword)
  const digest = await getPdaSubtleCrypto().digest(
    'SHA-256',
    new TextEncoder().encode(normalizedPassword),
  )
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyPdaPassword(rawPassword: string, passwordHash: string): Promise<boolean> {
  const normalizedHash = String(passwordHash || '').trim().toLowerCase()
  if (!normalizedHash) return false
  const nextHash = await hashPdaPassword(rawPassword)
  return nextHash === normalizedHash
}

function readStoredJson<T>(key: string): T | null {
  const raw = readBrowserStorageItem(getStorage(), key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeStoredJson(key: string, value: unknown): void {
  writeBrowserStorageItem(getStorage(), key, JSON.stringify(value))
}

function normalizeStoredPdaUser(input: Partial<FactoryPdaUser>): FactoryPdaUser | null {
  const userId = String(input.userId || '').trim()
  const factoryId = String(input.factoryId || '').trim()
  const loginId = String(input.loginId || '').trim()
  const name = String(input.name || '').trim()
  const roleId = String(input.roleId || '').trim()
  const createdAt = String(input.createdAt || '').trim()
  const createdBy = String(input.createdBy || '').trim()

  if (!userId || !factoryId || !loginId || !name || !roleId || !createdAt || !createdBy) {
    return null
  }

  return {
    userId,
    factoryId,
    loginId,
    passwordHash: String(input.passwordHash || '').trim().toLowerCase(),
    passwordUpdatedAt: input.passwordUpdatedAt?.trim() || undefined,
    name,
    roleId: roleId as PdaRoleId,
    status: input.status === 'LOCKED' ? 'LOCKED' : 'ACTIVE',
    createdAt,
    createdBy,
    updatedAt: input.updatedAt?.trim() || undefined,
    updatedBy: input.updatedBy?.trim() || undefined,
  }
}

function normalizeStoredPdaRole(input: Partial<FactoryPdaRole>): FactoryPdaRole | null {
  const roleId = String(input.roleId || '').trim()
  const factoryId = String(input.factoryId || '').trim()
  const roleName = String(input.roleName || '').trim()
  const createdAt = String(input.createdAt || '').trim()
  const createdBy = String(input.createdBy || '').trim()

  if (!roleId || !factoryId || !roleName || !createdAt || !createdBy) {
    return null
  }

  return {
    roleId,
    factoryId,
    roleName,
    status: input.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
    permissionKeys: clonePermissionKeys((input.permissionKeys ?? []) as PermissionKey[]),
    isSystemPreset: Boolean(input.isSystemPreset),
    createdAt,
    createdBy,
    updatedAt: input.updatedAt?.trim() || undefined,
    updatedBy: input.updatedBy?.trim() || undefined,
    auditLogs: Array.isArray(input.auditLogs) ? input.auditLogs.map((item) => ({ ...item })) : [],
  }
}

function ensurePdaUserStore(): FactoryPdaUser[] {
  if (cachedPdaUsers) return cachedPdaUsers

  const stored = readStoredJson<FactoryPdaUser[]>(PDA_USER_STORE_KEY)
  if (Array.isArray(stored) && stored.length > 0) {
    const now = nowTimestamp()
    let needsMigration = false
    cachedPdaUsers = stored
      .map((item) => normalizeStoredPdaUser(item))
      .filter((item): item is FactoryPdaUser => Boolean(item))
      .map((item) => {
        if (item.passwordHash) return item
        needsMigration = true
        return {
          ...item,
          passwordHash: LEGACY_DEFAULT_PDA_PASSWORD_HASH,
          passwordUpdatedAt: item.passwordUpdatedAt || now,
        }
      })
    if (needsMigration) {
      writeStoredJson(PDA_USER_STORE_KEY, cachedPdaUsers)
    }
    return cachedPdaUsers
  }

  cachedPdaUsers = initialFactoryPdaUsers.map(clonePdaUser)
  writeStoredJson(PDA_USER_STORE_KEY, cachedPdaUsers)
  return cachedPdaUsers
}

function ensurePdaRoleStore(): FactoryPdaRole[] {
  if (cachedPdaRoles) return cachedPdaRoles

  const stored = readStoredJson<FactoryPdaRole[]>(PDA_ROLE_STORE_KEY)
  if (Array.isArray(stored) && stored.length > 0) {
    cachedPdaRoles = stored
      .map((item) => normalizeStoredPdaRole(item))
      .filter((item): item is FactoryPdaRole => Boolean(item))
    return cachedPdaRoles
  }

  cachedPdaRoles = initialFactoryPdaRoles.map(clonePdaRole)
  writeStoredJson(PDA_ROLE_STORE_KEY, cachedPdaRoles)
  return cachedPdaRoles
}

function persistPdaUsers(users: FactoryPdaUser[]): void {
  cachedPdaUsers = users.map(clonePdaUser)
  writeStoredJson(PDA_USER_STORE_KEY, cachedPdaUsers)
}

function persistPdaRoles(roles: FactoryPdaRole[]): void {
  cachedPdaRoles = roles.map(clonePdaRole)
  writeStoredJson(PDA_ROLE_STORE_KEY, cachedPdaRoles)
}

function nowTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function getFactoryName(factoryId: string): string {
  const runtimeFactory = getFactoryMasterRecordById(factoryId)
  if (runtimeFactory) return runtimeFactory.name
  const seedFactory = indonesiaFactories.find((item) => item.id === factoryId)
  return seedFactory?.name ?? factoryId
}

function isRuntimeFactoryExisting(factoryId: string): boolean {
  return listFactoryMasterRecords().some((factory) => factory.id === factoryId)
}

function normalizeSession(session: Partial<FactoryPdaSession> | null | undefined): FactoryPdaSession | null {
  if (!session) return null
  const userId = String(session.userId || '').trim()
  const loginId = String(session.loginId || '').trim()
  const userName = String(session.userName || '').trim()
  const roleId = String(session.roleId || '').trim()
  const factoryId = String(session.factoryId || '').trim()
  const factoryName = String(session.factoryName || '').trim()
  const loggedAt = String(session.loggedAt || '').trim()
  if (!userId || !loginId || !userName || !roleId || !factoryId || !factoryName || !loggedAt) return null
  return {
    userId,
    loginId,
    userName,
    roleId,
    factoryId,
    factoryName,
    loggedAt,
  }
}

export function createPdaSessionFromUser(user: FactoryPdaUser): FactoryPdaSession {
  return {
    userId: user.userId,
    loginId: user.loginId,
    userName: user.name,
    roleId: user.roleId,
    factoryId: user.factoryId,
    factoryName: getFactoryName(user.factoryId),
    loggedAt: nowTimestamp(),
  }
}

export function listAllFactoryPdaUsers(): FactoryPdaUser[] {
  return ensurePdaUserStore().map(clonePdaUser)
}

export function listFactoryPdaUsers(factoryId: string): FactoryPdaUser[] {
  return ensurePdaUserStore()
    .filter((item) => item.factoryId === factoryId)
    .map(clonePdaUser)
}

export function listAllFactoryPdaRoles(): FactoryPdaRole[] {
  return ensurePdaRoleStore().map(clonePdaRole)
}

export function listFactoryPdaRoles(factoryId: string): FactoryPdaRole[] {
  return ensurePdaRoleStore()
    .filter((item) => item.factoryId === factoryId)
    .map(clonePdaRole)
}

export function findFactoryPdaRoleById(roleId: string, factoryId?: string): FactoryPdaRole | null {
  return (
    ensurePdaRoleStore().find(
      (item) => item.roleId === roleId && (!factoryId || item.factoryId === factoryId),
    ) ?? null
  )
}

export function replaceFactoryPdaRoles(factoryId: string, roles: FactoryPdaRole[]): void {
  const current = ensurePdaRoleStore().filter((item) => item.factoryId !== factoryId)
  persistPdaRoles([...current, ...roles.map(clonePdaRole)])
}

export function findFactoryPdaUserByLoginId(loginId: string): FactoryPdaUser | null {
  const normalizedLoginId = normalizePdaLoginId(loginId)
  if (!normalizedLoginId) return null
  return (
    ensurePdaUserStore().find(
      (item) => normalizePdaLoginId(item.loginId) === normalizedLoginId,
    ) ?? null
  )
}

export function getFactoryPdaUserById(userId: string): FactoryPdaUser | null {
  return ensurePdaUserStore().find((item) => item.userId === userId) ?? null
}

function validateGlobalUniqueLoginId(loginId: string, excludeUserId?: string): void {
  const normalizedLoginId = normalizePdaLoginId(loginId)
  const duplicated = ensurePdaUserStore().some(
    (item) =>
      item.userId !== excludeUserId && normalizePdaLoginId(item.loginId) === normalizedLoginId,
  )
  if (duplicated) {
    throw new Error('登录账户已存在，必须在所有工厂中唯一')
  }
}

export async function createFactoryPdaUser(input: {
  factoryId: string
  name: string
  loginId: string
  password: string
  roleId: string
  createdBy?: string
}): Promise<FactoryPdaUser> {
  const factoryId = input.factoryId.trim()
  const name = input.name.trim()
  const loginId = input.loginId.trim()
  const password = normalizePdaPassword(input.password)
  const roleId = input.roleId.trim()

  if (!factoryId || !name || !loginId || !password || !roleId) {
    throw new Error('新增账号需要填写姓名和登录账户。')
  }

  validateGlobalUniqueLoginId(loginId)
  const passwordHash = await hashPdaPassword(password)

  const now = nowTimestamp()
  const user: FactoryPdaUser = {
    userId: `PDAU-${Date.now()}`,
    factoryId,
    name,
    loginId,
    passwordHash,
    passwordUpdatedAt: now,
    status: 'ACTIVE',
    roleId: roleId as PdaRoleId,
    createdAt: now,
    createdBy: input.createdBy?.trim() || 'ADMIN',
  }

  persistPdaUsers([user, ...ensurePdaUserStore()])
  return clonePdaUser(user)
}

export async function resetFactoryPdaUserPassword(
  userId: string,
  rawPassword: string,
  updatedBy = 'ADMIN',
): Promise<FactoryPdaUser | null> {
  const current = getFactoryPdaUserById(userId)
  if (!current) return null

  const password = normalizePdaPassword(rawPassword)
  if (!password) {
    throw new Error('请输入登录密码')
  }

  const passwordHash = await hashPdaPassword(password)
  const updated: FactoryPdaUser = {
    ...current,
    passwordHash,
    passwordUpdatedAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
    updatedBy,
  }

  persistPdaUsers(
    ensurePdaUserStore().map((item) => (item.userId === current.userId ? updated : item)),
  )

  const session = getPdaSession()
  if (session && session.userId === current.userId) {
    setPdaSession(createPdaSessionFromUser(updated))
  }

  return clonePdaUser(updated)
}

export function updateFactoryPdaUser(
  userId: string,
  patch: Partial<Pick<FactoryPdaUser, 'name' | 'loginId' | 'status' | 'roleId' | 'updatedBy'>>,
): FactoryPdaUser | null {
  const current = getFactoryPdaUserById(userId)
  if (!current) return null

  const nextLoginId =
    patch.loginId !== undefined ? String(patch.loginId).trim() : current.loginId
  if (!nextLoginId) {
    throw new Error('登录账户不能为空。')
  }
  validateGlobalUniqueLoginId(nextLoginId, current.userId)

  const updated: FactoryPdaUser = {
    ...current,
    name: patch.name !== undefined ? String(patch.name).trim() || current.name : current.name,
    loginId: nextLoginId,
    status: patch.status === 'LOCKED' ? 'LOCKED' : patch.status === 'ACTIVE' ? 'ACTIVE' : current.status,
    roleId: patch.roleId ? (patch.roleId as PdaRoleId) : current.roleId,
    updatedAt: nowTimestamp(),
    updatedBy: patch.updatedBy?.trim() || 'ADMIN',
  }

  persistPdaUsers(
    ensurePdaUserStore().map((item) => (item.userId === current.userId ? updated : item)),
  )

  const session = getPdaSession()
  if (session && session.userId === current.userId) {
    setPdaSession(createPdaSessionFromUser(updated))
  }

  return clonePdaUser(updated)
}

export function toggleFactoryPdaUserLock(userId: string, updatedBy = 'ADMIN'): FactoryPdaUser | null {
  const current = getFactoryPdaUserById(userId)
  if (!current) return null
  const nextStatus = current.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE'
  return updateFactoryPdaUser(userId, {
    status: nextStatus,
    updatedBy,
  })
}

export function setFactoryPdaUserRole(userId: string, roleId: string, updatedBy = 'ADMIN'): FactoryPdaUser | null {
  return updateFactoryPdaUser(userId, {
    roleId,
    updatedBy,
  })
}

export function ensureFactoryPdaSeed(factoryId: string, factoryName: string): void {
  const users = ensurePdaUserStore()
  const roles = ensurePdaRoleStore()
  const nextUsers =
    users.some((item) => item.factoryId === factoryId)
      ? users
      : [...users, ...createFactoryPdaUsersForFactory(factoryId, factoryName, nowTimestamp())]
  const nextRoles =
    roles.some((item) => item.factoryId === factoryId)
      ? roles
      : [...roles, ...generatePresetRolesForFactory(factoryId, nowTimestamp())]

  if (nextUsers !== users) persistPdaUsers(nextUsers)
  if (nextRoles !== roles) persistPdaRoles(nextRoles)
}

export function removeFactoryPdaDataByFactory(factoryId: string): void {
  persistPdaUsers(ensurePdaUserStore().filter((item) => item.factoryId !== factoryId))
  persistPdaRoles(ensurePdaRoleStore().filter((item) => item.factoryId !== factoryId))

  const session = getPdaSession()
  if (session?.factoryId === factoryId) {
    clearPdaSession()
  }
}

function readRawPdaSession(): FactoryPdaSession | null {
  return normalizeSession(readStoredJson<FactoryPdaSession>(PDA_SESSION_KEY))
}

export function getPdaSession(): FactoryPdaSession | null {
  const session = readRawPdaSession()
  if (!session) return null

  const user = getFactoryPdaUserById(session.userId)
  if (!user) {
    clearPdaSession()
    return null
  }
  if (user.status === 'LOCKED') {
    clearPdaSession()
    return null
  }
  if (!isRuntimeFactoryExisting(user.factoryId)) {
    clearPdaSession()
    return null
  }

  return {
    ...session,
    loginId: user.loginId,
    userName: user.name,
    roleId: user.roleId,
    factoryId: user.factoryId,
    factoryName: getFactoryName(user.factoryId),
  }
}

export function setPdaSession(session: FactoryPdaSession | null): void {
  if (!session) {
    clearPdaSession()
    return
  }
  writeStoredJson(PDA_SESSION_KEY, clonePdaSession(session))
}

export function clearPdaSession(): void {
  removeBrowserStorageItem(getStorage(), PDA_SESSION_KEY)
}

export function getCurrentPdaFactoryId(): string | null {
  return getPdaSession()?.factoryId ?? null
}

export function getCurrentPdaUser(): FactoryPdaUser | null {
  const session = getPdaSession()
  if (!session) return null
  return getFactoryPdaUserById(session.userId)
}

export function authenticateFactoryPdaUserByLoginId(loginId: string): {
  user: FactoryPdaUser | null
  error: '' | 'NOT_FOUND' | 'LOCKED'
} {
  const user = findFactoryPdaUserByLoginId(loginId)
  if (!user) {
    return {
      user: null,
      error: 'NOT_FOUND',
    }
  }
  if (user.status === 'LOCKED') {
    return {
      user,
      error: 'LOCKED',
    }
  }
  return {
    user,
    error: '',
  }
}

export async function authenticateFactoryPdaUserByCredentials(
  loginId: string,
  rawPassword: string,
): Promise<{
  user: FactoryPdaUser | null
  error: '' | 'NOT_FOUND' | 'LOCKED' | 'INVALID_CREDENTIALS'
}> {
  const loginResult = authenticateFactoryPdaUserByLoginId(loginId)
  if (!loginResult.user || loginResult.error) {
    return {
      user: loginResult.user,
      error: loginResult.error || 'NOT_FOUND',
    }
  }

  const passwordValid = await verifyPdaPassword(rawPassword, loginResult.user.passwordHash)
  if (!passwordValid) {
    return {
      user: null,
      error: 'INVALID_CREDENTIALS',
    }
  }

  return {
    user: loginResult.user,
    error: '',
  }
}
