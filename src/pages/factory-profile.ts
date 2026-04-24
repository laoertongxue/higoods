import { generateFactoryCode } from '../data/fcs/factory-mock-data'
import {
  listFactoryMasterRecords,
  removeFactoryMasterRecord,
  upsertFactoryMasterRecord,
} from '../data/fcs/factory-master-store'
import {
  cooperationModeConfig,
  factoryStatusConfig,
  type FactoryPostCapacityNodeCode,
  factoryTierConfig,
  factoryTypeConfig,
  type FactoryProcessAbility,
  typesByTier,
  type Factory,
  type FactoryFormData,
  type FactoryTier,
  type FactoryType,
} from '../data/fcs/factory-types'
import {
  getProcessDefinitionByCode,
  listCraftsByProcessCode,
  listProcessStages,
  listProcessesByStageCode,
} from '../data/fcs/process-craft-dict'
import {
  DEFAULT_FACTORY_MOBILE_APP_ROLE_ID,
  createFactoryPdaUser,
  ensureFactoryPdaSeed,
  type FactoryPdaRole,
  type FactoryPdaUser,
  type PermissionKey,
  findFactoryPdaUserByLoginId,
  listAllFactoryPdaRoles,
  listAllFactoryPdaUsers,
  listFactoryPdaRoles,
  listFactoryPdaUsers,
  permissionCatalog,
  removeFactoryPdaDataByFactory,
  resetFactoryPdaUserPassword,
  replaceFactoryPdaRoles,
  setFactoryPdaUserRole,
  toggleFactoryPdaUserLock,
} from '../data/fcs/store-domain-pda'
import { escapeHtml } from '../utils'
import { renderConfirmDialog } from '../components/ui/dialog'

const PAGE_SIZE = 10
const POST_CAPACITY_NODE_CODES = ['BUTTONHOLE', 'BUTTON_ATTACH', 'IRONING', 'PACKAGING'] as const satisfies FactoryPostCapacityNodeCode[]
const POST_BUSINESS_ACTIONS = [
  { craftCode: 'POST_FINISHING', craftName: '后道' },
  { craftCode: 'POST_QC', craftName: '质检' },
  { craftCode: 'POST_RECHECK', craftName: '复检' },
] as const

type SortField = 'code' | 'name' | 'status' | 'tier'

function cloneProcessAbility(item: FactoryProcessAbility): FactoryProcessAbility {
  return {
    processCode: item.processCode,
    craftCodes: [...item.craftCodes],
    capacityNodeCodes: item.capacityNodeCodes ? [...item.capacityNodeCodes] : undefined,
    abilityId: item.abilityId,
    processName: item.processName,
    craftNames: item.craftNames ? [...item.craftNames] : undefined,
    abilityName: item.abilityName,
    abilityScope: item.abilityScope,
    canReceiveTask: item.canReceiveTask,
    capacityManaged: item.capacityManaged,
    status: item.status,
    parentProcessCode: item.parentProcessCode,
  }
}

function getPostCapacityNodeOptions() {
  return POST_CAPACITY_NODE_CODES.map((processCode) => {
    const process = getProcessDefinitionByCode(processCode)
    return {
      processCode,
      processName: process?.processName ?? processCode,
    }
  })
}
function getPostBusinessActionOptions(factoryType: FactoryType) {
  return factoryType === 'SATELLITE_FINISHING'
    ? [...POST_BUSINESS_ACTIONS]
    : [POST_BUSINESS_ACTIONS[0]]
}

function isDedicatedPostFactoryType(factoryType: FactoryType): boolean {
  return factoryType === 'SATELLITE_FINISHING'
}
type PdaTab = 'users' | 'roles' | 'permissions'
type PdaUserStatus = 'ACTIVE' | 'LOCKED'

type DialogState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; factoryId: string }
  | { type: 'delete'; factoryId: string }

interface PdaUserRecord {
  userId: string
  factoryId: string
  name: string
  loginId: string
  status: PdaUserStatus
  roleId: string
  createdAt: string
  updatedAt?: string
}

interface FactoryPageState {
  factories: Factory[]
  searchKeyword: string
  statusFilter: string
  tierFilter: string
  typeFilter: string
  pdaFilter: string
  sortField: SortField
  sortOrder: 'asc' | 'desc'
  currentPage: number
  dialog: DialogState
  formDraft: FactoryFormData | null
  formError: string
  pdaTab: PdaTab
  pdaUsersByFactory: Record<string, PdaUserRecord[]>
  pdaRolesByFactory: Record<string, FactoryPdaRole[]>
  pdaAddOpen: boolean
  pdaNewName: string
  pdaNewLoginId: string
  pdaNewPassword: string
  pdaNewPasswordConfirm: string
  pdaNewRoleId: string
  pdaResetPasswordOpen: boolean
  pdaResetPasswordUserId: string | null
  pdaResetPasswordValue: string
  pdaResetPasswordConfirm: string
  pdaRoleFormOpen: boolean
  pdaEditingRoleId: string | null
  pdaRoleFormName: string
  pdaRoleFormPerms: PermissionKey[]
  pdaCopyFromRoleId: string
  pdaError: string
}

const DEFAULT_FORM_DATA: FactoryFormData = {
  name: '',
  address: '',
  contact: '',
  phone: '',
  status: 'active',
  cooperationMode: 'general',
  processAbilities: [],
  factoryTier: 'CENTRAL',
  factoryType: 'CENTRAL_POD',
  parentFactoryId: undefined,
  pdaEnabled: true,
  pdaTenantId: '',
  eligibility: {
    allowDispatch: true,
    allowBid: true,
    allowExecute: true,
    allowSettle: true,
  },
}

function mapInitialPdaUsersByFactory(): Record<string, PdaUserRecord[]> {
  const grouped: Record<string, PdaUserRecord[]> = {}

  for (const user of listAllFactoryPdaUsers()) {
    const record: PdaUserRecord = {
      userId: user.userId,
      factoryId: user.factoryId,
      name: user.name,
      loginId: user.loginId,
      status: user.status,
      roleId: user.roleId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }

    if (!grouped[user.factoryId]) grouped[user.factoryId] = []
    grouped[user.factoryId].push(record)
  }

  return grouped
}

function clonePdaUserRecord(user: FactoryPdaUser): PdaUserRecord {
  return {
    userId: user.userId,
    factoryId: user.factoryId,
    name: user.name,
    loginId: user.loginId,
    status: user.status,
    roleId: user.roleId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function renderTestFactoryBadge(factory: Pick<Factory, 'isTestFactory'>): string {
  return factory.isTestFactory
    ? '<span class="ml-2 inline-flex rounded border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">测试工厂</span>'
    : ''
}

function mapInitialPdaRolesByFactory(): Record<string, FactoryPdaRole[]> {
  const grouped: Record<string, FactoryPdaRole[]> = {}

  for (const role of listAllFactoryPdaRoles()) {
    if (!grouped[role.factoryId]) grouped[role.factoryId] = []
    grouped[role.factoryId].push({
      ...role,
      permissionKeys: [...role.permissionKeys],
      auditLogs: [...role.auditLogs],
    })
  }

  return grouped
}

const state: FactoryPageState = {
  factories: listFactoryMasterRecords(),
  searchKeyword: '',
  statusFilter: 'all',
  tierFilter: 'all',
  typeFilter: 'all',
  pdaFilter: 'all',
  sortField: 'code',
  sortOrder: 'asc',
  currentPage: 1,
  dialog: { type: 'none' },
  formDraft: null,
  formError: '',
  pdaTab: 'users',
  pdaUsersByFactory: mapInitialPdaUsersByFactory(),
  pdaRolesByFactory: mapInitialPdaRolesByFactory(),
  pdaAddOpen: false,
  pdaNewName: '',
  pdaNewLoginId: '',
  pdaNewPassword: '',
  pdaNewPasswordConfirm: '',
  pdaNewRoleId: DEFAULT_FACTORY_MOBILE_APP_ROLE_ID,
  pdaResetPasswordOpen: false,
  pdaResetPasswordUserId: null,
  pdaResetPasswordValue: '',
  pdaResetPasswordConfirm: '',
  pdaRoleFormOpen: false,
  pdaEditingRoleId: null,
  pdaRoleFormName: '',
  pdaRoleFormPerms: [],
  pdaCopyFromRoleId: '',
  pdaError: '',
}

function cloneFormDraft(data: FactoryFormData): FactoryFormData {
  return {
    ...data,
    processAbilities: data.processAbilities.map((item) => cloneProcessAbility(item)),
    eligibility: { ...data.eligibility },
  }
}

function ensureTypeForTier(data: FactoryFormData): FactoryFormData {
  const availableTypes = typesByTier[data.factoryTier] ?? []
  if (availableTypes.length === 0) return data

  if (!availableTypes.includes(data.factoryType)) {
    return {
      ...data,
      factoryType: availableTypes[0],
    }
  }

  return data
}

function createFormData(factory: Factory | null): FactoryFormData {
  if (!factory) return cloneFormDraft(DEFAULT_FORM_DATA)

  return {
    name: factory.name,
    address: factory.address,
    contact: factory.contact,
    phone: factory.phone,
    status: factory.status,
    cooperationMode: factory.cooperationMode,
    processAbilities: factory.processAbilities.map((item) => cloneProcessAbility(item)),
    factoryTier: factory.factoryTier,
    factoryType: factory.factoryType,
    parentFactoryId: factory.parentFactoryId,
    pdaEnabled: factory.pdaEnabled,
    pdaTenantId: factory.pdaTenantId ?? '',
    eligibility: { ...factory.eligibility },
  }
}

function getSelectedCraftCodes(processAbilities: FactoryProcessAbility[], processCode: string): string[] {
  return processAbilities.find((item) => item.processCode === processCode)?.craftCodes ?? []
}

function getSelectedCapacityNodeCodes(
  processAbilities: FactoryProcessAbility[],
  processCode: string,
): FactoryPostCapacityNodeCode[] {
  return processAbilities.find((item) => item.processCode === processCode)?.capacityNodeCodes ?? []
}

function upsertProcessAbility(
  processAbilities: FactoryProcessAbility[],
  processCode: string,
  craftCodes: string[],
  capacityNodeCodes?: FactoryPostCapacityNodeCode[],
): FactoryProcessAbility[] {
  const nextCraftCodes = [...new Set(craftCodes)]
  const nextCapacityNodeCodes = capacityNodeCodes ? [...new Set(capacityNodeCodes)] : undefined
  const nextAbilities = processAbilities
    .filter((item) => item.processCode !== processCode)
    .map((item) => cloneProcessAbility(item))

  if (nextCraftCodes.length > 0 || (nextCapacityNodeCodes?.length ?? 0) > 0) {
    const process = getProcessDefinitionByCode(processCode)
    nextAbilities.push({
      processCode,
      craftCodes: nextCraftCodes,
      capacityNodeCodes: nextCapacityNodeCodes,
      abilityId: `ABILITY_${processCode}`,
      processName: process?.processName ?? processCode,
      craftNames:
        processCode === 'POST_FINISHING'
          ? nextCapacityNodeCodes?.map((nodeCode) => getProcessDefinitionByCode(nodeCode)?.processName ?? nodeCode)
          : listCraftsByProcessCode(processCode)
              .filter((item) => nextCraftCodes.includes(item.craftCode))
              .map((item) => item.craftName),
      abilityName:
        processCode === 'SPECIAL_CRAFT' && nextCraftCodes.length === 1
          ? `特殊工艺 - ${listCraftsByProcessCode(processCode).find((item) => item.craftCode === nextCraftCodes[0])?.craftName ?? nextCraftCodes[0]}`
          : process?.processName ?? processCode,
      abilityScope:
        processCode === 'POST_FINISHING'
          ? 'PROCESS'
          : nextCraftCodes.length === 1
            ? 'CRAFT'
            : 'PROCESS',
      canReceiveTask: process?.generatesExternalTask ?? true,
      capacityManaged: process?.capacityEnabled ?? true,
      status: process?.isActive ? 'ACTIVE' : 'DISABLED',
      parentProcessCode: process?.parentProcessCode,
    })
  }

  return nextAbilities
}

function openCreateDialog(): void {
  state.dialog = { type: 'create' }
  state.formDraft = cloneFormDraft(DEFAULT_FORM_DATA)
  state.formError = ''
  state.pdaTab = 'users'
  resetPdaEditorState()
}

function openEditDialog(factoryId: string): void {
  const factory = state.factories.find((item) => item.id === factoryId)
  if (!factory) return

  ensurePdaDataForFactory(factory)
  state.dialog = { type: 'edit', factoryId }
  state.formDraft = createFormData(factory)
  state.formError = ''
  state.pdaTab = 'users'
  resetPdaEditorState()
}

function setDraft(updater: (prev: FactoryFormData) => FactoryFormData): void {
  if (!state.formDraft) return
  state.formDraft = ensureTypeForTier(updater(cloneFormDraft(state.formDraft)))
  state.formError = ''
}

function resetPdaEditorState(): void {
  state.pdaAddOpen = false
  state.pdaNewName = ''
  state.pdaNewLoginId = ''
  state.pdaNewPassword = ''
  state.pdaNewPasswordConfirm = ''
  state.pdaNewRoleId = DEFAULT_FACTORY_MOBILE_APP_ROLE_ID
  state.pdaResetPasswordOpen = false
  state.pdaResetPasswordUserId = null
  state.pdaResetPasswordValue = ''
  state.pdaResetPasswordConfirm = ''
  state.pdaRoleFormOpen = false
  state.pdaEditingRoleId = null
  state.pdaRoleFormName = ''
  state.pdaRoleFormPerms = []
  state.pdaCopyFromRoleId = ''
  state.pdaError = ''
}

function requestFactoryRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('higood:request-render'))
  }
}

function getCurrentDialogFactoryId(): string | null {
  return state.dialog.type === 'edit' ? state.dialog.factoryId : null
}

function ensurePdaDataForFactory(factory: Factory): void {
  if (factory.pdaEnabled && factory.status === 'active') {
    ensureFactoryPdaSeed(factory.id, factory.name)
  }

  state.pdaUsersByFactory = {
    ...state.pdaUsersByFactory,
    [factory.id]: listFactoryPdaUsers(factory.id).map(clonePdaUserRecord),
  }
  state.pdaRolesByFactory = {
    ...state.pdaRolesByFactory,
    [factory.id]: listFactoryPdaRoles(factory.id).map((role) => ({
      ...role,
      permissionKeys: [...role.permissionKeys],
      auditLogs: [...role.auditLogs],
    })),
  }
}

function getFactoryPdaUsers(factoryId: string): PdaUserRecord[] {
  return state.pdaUsersByFactory[factoryId] ?? []
}

function getFactoryPdaRoles(factoryId: string): FactoryPdaRole[] {
  return state.pdaRolesByFactory[factoryId] ?? []
}

function setFactoryPdaUsers(factoryId: string, users: PdaUserRecord[]): void {
  state.pdaUsersByFactory = {
    ...state.pdaUsersByFactory,
    [factoryId]: users,
  }
}

function setFactoryPdaRoles(factoryId: string, roles: FactoryPdaRole[]): void {
  replaceFactoryPdaRoles(factoryId, roles)
  state.pdaRolesByFactory = {
    ...state.pdaRolesByFactory,
    [factoryId]: roles,
  }
}

function setPdaError(message: string): void {
  state.pdaError = message
}

function clearPdaError(): void {
  state.pdaError = ''
}

function validatePdaPasswordDraft(password: string, confirmPassword: string): string | null {
  if (!password) return '请输入登录密码'
  if (!confirmPassword) return '请再次输入登录密码'
  if (password.length < 6) return '登录密码至少 6 位'
  if (password !== confirmPassword) return '两次输入的密码不一致'
  return null
}

function openRoleFormCreate(): void {
  state.pdaRoleFormOpen = true
  state.pdaEditingRoleId = null
  state.pdaRoleFormName = ''
  state.pdaRoleFormPerms = []
  state.pdaCopyFromRoleId = ''
  clearPdaError()
}

function openRoleFormEdit(factoryId: string, roleId: string): void {
  const role = getFactoryPdaRoles(factoryId).find((item) => item.roleId === roleId)
  if (!role) {
    setPdaError('未找到角色，无法编辑。')
    return
  }

  state.pdaRoleFormOpen = true
  state.pdaEditingRoleId = role.roleId
  state.pdaRoleFormName = role.roleName
  state.pdaRoleFormPerms = [...role.permissionKeys]
  state.pdaCopyFromRoleId = ''
  clearPdaError()
}

function copyRolePermissions(factoryId: string, roleId: string): void {
  const role = getFactoryPdaRoles(factoryId).find((item) => item.roleId === roleId)
  if (!role) return
  state.pdaRoleFormPerms = [...role.permissionKeys]
}

function toggleRolePermission(permissionKey: PermissionKey, checked?: boolean): void {
  const exists = state.pdaRoleFormPerms.includes(permissionKey)
  const shouldEnable = checked ?? !exists

  if (shouldEnable && !exists) {
    state.pdaRoleFormPerms = [...state.pdaRoleFormPerms, permissionKey]
  } else if (!shouldEnable && exists) {
    state.pdaRoleFormPerms = state.pdaRoleFormPerms.filter((item) => item !== permissionKey)
  }

  clearPdaError()
}

function setRoleGroupPermissions(group: string, selectAll: boolean): void {
  const groupPermissionKeys = permissionCatalog
    .filter((item) => item.group === group)
    .map((item) => item.key)

  if (selectAll) {
    state.pdaRoleFormPerms = [...new Set([...state.pdaRoleFormPerms, ...groupPermissionKeys])]
  } else {
    state.pdaRoleFormPerms = state.pdaRoleFormPerms.filter(
      (item) => !groupPermissionKeys.includes(item),
    )
  }
  clearPdaError()
}

async function createPdaUser(factoryId: string): Promise<void> {
  const name = state.pdaNewName.trim()
  const loginId = state.pdaNewLoginId.trim()
  const password = state.pdaNewPassword
  const confirmPassword = state.pdaNewPasswordConfirm
  const roleId = state.pdaNewRoleId

  if (!name || !loginId) {
    setPdaError('新增账号需要填写姓名和登录ID。')
    return
  }

  if (findFactoryPdaUserByLoginId(loginId)) {
    setPdaError('登录账户已存在，必须在所有工厂中唯一')
    return
  }

  const roles = getFactoryPdaRoles(factoryId)
  const activeRoles = roles.filter((role) => role.status === 'ACTIVE')

  if (activeRoles.length === 0) {
    setPdaError('当前无可用角色，请先启用或创建角色。')
    return
  }

  const passwordError = validatePdaPasswordDraft(password, confirmPassword)
  if (passwordError) {
    setPdaError(passwordError)
    return
  }

  const selectedRole = activeRoles.find((item) => item.roleId === roleId) ?? activeRoles[0]
  try {
    await createFactoryPdaUser({
      factoryId,
      name,
      loginId,
      password,
      roleId: selectedRole.roleId,
      createdBy: 'ADMIN',
    })
  } catch (error) {
    setPdaError(error instanceof Error ? error.message : '新增账号失败。')
    requestFactoryRender()
    return
  }

  setFactoryPdaUsers(factoryId, listFactoryPdaUsers(factoryId).map(clonePdaUserRecord))
  state.pdaAddOpen = false
  state.pdaNewName = ''
  state.pdaNewLoginId = ''
  state.pdaNewPassword = ''
  state.pdaNewPasswordConfirm = ''
  state.pdaNewRoleId = selectedRole.roleId
  clearPdaError()
  requestFactoryRender()
}

function togglePdaUserLock(factoryId: string, userId: string): void {
  toggleFactoryPdaUserLock(userId, 'ADMIN')
  setFactoryPdaUsers(factoryId, listFactoryPdaUsers(factoryId).map(clonePdaUserRecord))
  clearPdaError()
}

function setPdaUserRole(factoryId: string, userId: string, roleId: string): void {
  const roles = getFactoryPdaRoles(factoryId)
  const targetRole = roles.find((item) => item.roleId === roleId)
  if (!targetRole || targetRole.status !== 'ACTIVE') {
    setPdaError('目标角色不存在或已禁用。')
    return
  }

  setFactoryPdaUserRole(userId, roleId, 'ADMIN')
  setFactoryPdaUsers(factoryId, listFactoryPdaUsers(factoryId).map(clonePdaUserRecord))
  clearPdaError()
}

function openPdaResetPassword(factoryId: string, userId: string): void {
  const user = getFactoryPdaUsers(factoryId).find((item) => item.userId === userId)
  if (!user) {
    setPdaError('未找到账号，无法重置密码。')
    return
  }
  state.pdaResetPasswordOpen = true
  state.pdaResetPasswordUserId = userId
  state.pdaResetPasswordValue = ''
  state.pdaResetPasswordConfirm = ''
  clearPdaError()
}

async function submitPdaResetPassword(factoryId: string): Promise<void> {
  const userId = state.pdaResetPasswordUserId
  if (!userId) {
    setPdaError('未找到账号，无法重置密码。')
    return
  }

  const passwordError = validatePdaPasswordDraft(
    state.pdaResetPasswordValue,
    state.pdaResetPasswordConfirm,
  )
  if (passwordError) {
    setPdaError(passwordError)
    return
  }

  try {
    await resetFactoryPdaUserPassword(userId, state.pdaResetPasswordValue, 'ADMIN')
  } catch (error) {
    setPdaError(error instanceof Error ? error.message : '重置密码失败。')
    requestFactoryRender()
    return
  }

  setFactoryPdaUsers(factoryId, listFactoryPdaUsers(factoryId).map(clonePdaUserRecord))
  state.pdaResetPasswordOpen = false
  state.pdaResetPasswordUserId = null
  state.pdaResetPasswordValue = ''
  state.pdaResetPasswordConfirm = ''
  clearPdaError()
  requestFactoryRender()
}

function savePdaRole(factoryId: string): void {
  const roleName = state.pdaRoleFormName.trim()
  if (!roleName) {
    setPdaError('角色名称不能为空。')
    return
  }

  const roles = getFactoryPdaRoles(factoryId)
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

  if (state.pdaEditingRoleId) {
    const nextRoles = roles.map((role) =>
      role.roleId === state.pdaEditingRoleId
        ? {
            ...role,
            roleName,
            permissionKeys: [...state.pdaRoleFormPerms],
            updatedAt: now,
            updatedBy: 'ADMIN',
          }
        : role,
    )
    setFactoryPdaRoles(factoryId, nextRoles)
  } else {
    const newRole: FactoryPdaRole = {
      roleId: `ROLE_CUSTOM_${Date.now()}`,
      factoryId,
      roleName,
      status: 'ACTIVE',
      permissionKeys: [...state.pdaRoleFormPerms],
      isSystemPreset: false,
      createdAt: now,
      createdBy: 'ADMIN',
      auditLogs: [
        {
          id: `AR-${Date.now()}`,
          action: 'CREATE',
          detail: `创建角色 ${roleName}`,
          at: now,
          by: 'ADMIN',
        },
      ],
    }
    setFactoryPdaRoles(factoryId, [newRole, ...roles])
  }

  state.pdaRoleFormOpen = false
  state.pdaEditingRoleId = null
  state.pdaRoleFormName = ''
  state.pdaRoleFormPerms = []
  state.pdaCopyFromRoleId = ''
  clearPdaError()
}

function togglePdaRoleStatus(factoryId: string, roleId: string): void {
  const roles = getFactoryPdaRoles(factoryId)
  const nextRoles: FactoryPdaRole[] = roles.map((role) =>
    role.roleId === roleId
      ? {
          ...role,
          status: role.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
          updatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
          updatedBy: 'ADMIN',
        }
      : role,
  )
  setFactoryPdaRoles(factoryId, nextRoles)
  clearPdaError()
}

function getVisibleFactories() {
  let result = [...state.factories]

  if (state.searchKeyword.trim()) {
    const keyword = state.searchKeyword.toLowerCase()
    result = result.filter((factory) => {
      return (
        factory.name.toLowerCase().includes(keyword) ||
        factory.code.toLowerCase().includes(keyword) ||
        factory.contact.toLowerCase().includes(keyword) ||
        (factory.phone ?? '').toLowerCase().includes(keyword)
      )
    })
  }

  if (state.statusFilter !== 'all') {
    result = result.filter((factory) => factory.status === state.statusFilter)
  }

  if (state.tierFilter !== 'all') {
    result = result.filter((factory) => factory.factoryTier === state.tierFilter)
  }

  if (state.typeFilter !== 'all') {
    result = result.filter((factory) => factory.factoryType === state.typeFilter)
  }

  if (state.pdaFilter === 'enabled') {
    result = result.filter((factory) => factory.pdaEnabled)
  }

  if (state.pdaFilter === 'disabled') {
    result = result.filter((factory) => !factory.pdaEnabled)
  }

  result.sort((a, b) => {
    let left = ''
    let right = ''

    if (state.sortField === 'code') {
      left = a.code
      right = b.code
    }

    if (state.sortField === 'name') {
      left = a.name
      right = b.name
    }

    if (state.sortField === 'status') {
      left = a.status
      right = b.status
    }

    if (state.sortField === 'tier') {
      left = a.factoryTier
      right = b.factoryTier
    }

    if (left < right) return state.sortOrder === 'asc' ? -1 : 1
    if (left > right) return state.sortOrder === 'asc' ? 1 : -1
    return 0
  })

  return result
}

function getPagedFactories(filteredFactories: Factory[]): Factory[] {
  const start = (state.currentPage - 1) * PAGE_SIZE
  return filteredFactories.slice(start, start + PAGE_SIZE)
}

function getEditingFactory(): Factory | null {
  const dialog = state.dialog
  if (dialog.type !== 'edit') return null
  return state.factories.find((item) => item.id === dialog.factoryId) ?? null
}

function renderSortIcon(field: SortField): string {
  if (state.sortField !== field) return '↕'
  return state.sortOrder === 'asc' ? '↑' : '↓'
}

function renderFactoryTableRows(factories: Factory[]): string {
  if (factories.length === 0) {
    return `
      <tr>
        <td colspan="12" class="h-24 px-4 text-center text-muted-foreground">暂无工厂数据</td>
      </tr>
    `
  }

  return factories
    .map((factory) => {
      const statusConfig = factoryStatusConfig[factory.status]
      const tierConfig = factoryTierConfig[factory.factoryTier]
      const typeLabel = factoryTypeConfig[factory.factoryType]?.label ?? factory.factoryType
      const parent = factory.parentFactoryId
        ? state.factories.find((item) => item.id === factory.parentFactoryId)
        : null

      return `
        <tr class="border-b last:border-0 hover:bg-muted/30" data-factory-id="${factory.id}">
          <td class="px-3 py-3 font-mono text-xs whitespace-nowrap">${escapeHtml(factory.code)}</td>
          <td class="px-3 py-3 font-medium">${escapeHtml(factory.name)}${renderTestFactoryBadge(factory)}</td>
          <td class="px-3 py-3 text-sm">${escapeHtml(factory.contact ?? '-')}</td>
          <td class="px-3 py-3 text-xs font-mono whitespace-nowrap">${escapeHtml(factory.phone ?? '-')}</td>
          <td class="max-w-[160px] px-3 py-3 text-sm text-muted-foreground truncate" title="${escapeHtml(factory.address ?? '-')}">${escapeHtml(factory.address ?? '-')}</td>
          <td class="px-3 py-3">
            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${tierConfig.color}">${escapeHtml(tierConfig.label)}</span>
          </td>
          <td class="px-3 py-3 text-sm">${escapeHtml(typeLabel)}</td>
          <td class="max-w-[140px] px-3 py-3 truncate text-sm text-muted-foreground" title="${escapeHtml(parent?.name ?? '-')}">
            ${escapeHtml(parent?.name ?? '-')}
          </td>
          <td class="px-3 py-3 text-xs">
            ${
              factory.pdaEnabled
                ? `<span class="inline-flex items-center gap-1 text-green-600"><span>●</span><span class="font-mono">${escapeHtml(factory.pdaTenantId?.slice(-6) ?? '-')}</span></span>`
                : '<span class="text-muted-foreground">未启用</span>'
            }
          </td>
          <td class="px-3 py-3">
            <div class="flex gap-1">
              ${[
                { key: 'allowDispatch', label: '派' },
                { key: 'allowBid', label: '竞' },
                { key: 'allowExecute', label: '执' },
                { key: 'allowSettle', label: '结' },
              ]
                .map((flag) => {
                  const enabled = factory.eligibility[flag.key as keyof typeof factory.eligibility]
                  return `<span class="inline-flex items-center justify-center rounded border px-1 py-0.5 text-[10px] font-medium ${
                    enabled
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-100 text-gray-400'
                  }">${flag.label}</span>`
                })
                .join('')}
            </div>
          </td>
          <td class="px-3 py-3">
            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusConfig.color}">${escapeHtml(statusConfig.label)}</span>
          </td>
          <td class="px-3 py-3 text-right">
            <div class="inline-flex gap-1">
              <button class="rounded-md px-2 py-1 text-xs hover:bg-blue-50 hover:text-blue-600" data-factory-action="edit" data-factory-id="${factory.id}">编辑</button>
              <button class="rounded-md px-2 py-1 text-xs hover:bg-red-50 hover:text-red-600" data-factory-action="delete" data-factory-id="${factory.id}">删除</button>
            </div>
          </td>
        </tr>
      `
    })
    .join('')
}

function renderPagination(total: number): string {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return ''

  const pages: number[] = []

  const start = Math.max(1, state.currentPage - 2)
  const end = Math.min(totalPages, start + 4)
  for (let page = start; page <= end; page += 1) {
    pages.push(page)
  }

  return `
    <div class="flex items-center justify-between">
      <div class="text-sm text-muted-foreground">第 ${state.currentPage} 页，共 ${totalPages} 页</div>
      <div class="flex items-center gap-1">
        <button
          data-factory-action="prev-page"
          class="rounded-md border px-3 py-1 text-sm ${state.currentPage === 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        >上一页</button>
        ${pages
          .map(
            (page) => `
              <button
                data-factory-action="goto-page"
                data-page="${page}"
                class="rounded-md border px-3 py-1 text-sm ${page === state.currentPage ? 'bg-blue-600 text-white' : 'hover:bg-muted'}"
              >${page}</button>
            `,
          )
          .join('')}
        <button
          data-factory-action="next-page"
          class="rounded-md border px-3 py-1 text-sm ${state.currentPage === totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}"
        >下一页</button>
      </div>
    </div>
  `
}

function renderPdaUsersSection(factoryId: string, pdaEnabled: boolean): string {
  if (!factoryId) {
    return '<p class="py-4 text-sm text-muted-foreground">保存工厂档案后，可在此配置工厂端移动应用账号与权限。</p>'
  }

  const users = getFactoryPdaUsers(factoryId)
  const roles = getFactoryPdaRoles(factoryId)
  const roleMap = new Map(roles.map((role) => [role.roleId, role]))
  const activeRoles = roles.filter((role) => role.status === 'ACTIVE')
  const resetTargetUser =
    state.pdaResetPasswordOpen && state.pdaResetPasswordUserId
      ? users.find((item) => item.userId === state.pdaResetPasswordUserId) ?? null
      : null

  return `
    <div class="space-y-3">
      ${
        users.length === 0
          ? '<p class="py-4 text-center text-sm text-muted-foreground">暂无工厂端移动应用账号</p>'
          : `
            <div class="overflow-x-auto rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">姓名</th>
                    <th class="px-3 py-2 text-left font-medium">登录ID</th>
                    <th class="px-3 py-2 text-left font-medium">角色</th>
                    <th class="px-3 py-2 text-left font-medium">状态</th>
                    <th class="px-3 py-2 text-left font-medium">有效权限数</th>
                    <th class="px-3 py-2 text-left font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${users
                    .map((user) => {
                      const userRole = roleMap.get(user.roleId)
                      const roleDisabled = userRole?.status === 'DISABLED'
                      const permissionCount = userRole?.permissionKeys.length ?? 0
                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 text-sm">${escapeHtml(user.name)}</td>
                          <td class="px-3 py-2 font-mono text-xs">${escapeHtml(user.loginId)}</td>
                          <td class="px-3 py-2">
                            <div class="space-y-1">
                              <select data-pda-user-role="${user.userId}" class="h-7 min-w-[120px] rounded border px-2 text-xs ${!pdaEnabled ? 'pointer-events-none bg-muted opacity-70' : ''}">
                                ${activeRoles
                                  .map(
                                    (role) =>
                                      `<option value="${role.roleId}" ${user.roleId === role.roleId ? 'selected' : ''}>${escapeHtml(role.roleName)}</option>`,
                                  )
                                  .join('')}
                              </select>
                              ${
                                roleDisabled
                                  ? '<span class="inline-flex rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] text-red-700">角色已停用</span>'
                                  : ''
                              }
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${
                              user.status === 'ACTIVE'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-slate-100 text-slate-700'
                            }">${user.status === 'ACTIVE' ? '启用' : '锁定'}</span>
                          </td>
                          <td class="px-3 py-2 text-sm">${permissionCount}</td>
                          <td class="px-3 py-2">
                            <div class="flex flex-wrap items-center gap-1">
                              <button type="button" data-factory-action="toggle-user-lock" data-user-id="${user.userId}" class="rounded px-2 py-1 text-xs hover:bg-muted ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">
                                ${user.status === 'ACTIVE' ? '锁定' : '解锁'}
                              </button>
                              <button type="button" data-factory-action="open-reset-user-password" data-user-id="${user.userId}" class="rounded px-2 py-1 text-xs hover:bg-muted ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">
                                重置密码
                              </button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }

      <button type="button" data-factory-action="toggle-add-user" class="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">
        <span>${state.pdaAddOpen ? '▾' : '▸'}</span>
        <span>新增工厂端移动应用账号</span>
      </button>

      ${
        state.pdaAddOpen
          ? `
            <div class="rounded-md border bg-muted/30 p-4">
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">姓名 *</span>
                  <input data-pda-field="new-user-name" value="${escapeHtml(state.pdaNewName)}" class="h-8 w-full rounded border px-2 text-sm" placeholder="请输入账号姓名" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">登录账户 *</span>
                  <input data-pda-field="new-user-login" value="${escapeHtml(state.pdaNewLoginId)}" class="h-8 w-full rounded border px-2 text-sm" placeholder="请输入唯一登录账户" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">登录密码 *</span>
                  <input type="password" data-pda-field="new-user-password" value="${escapeHtml(state.pdaNewPassword)}" class="h-8 w-full rounded border px-2 text-sm" placeholder="请输入登录密码" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">确认密码 *</span>
                  <input type="password" data-pda-field="new-user-password-confirm" value="${escapeHtml(state.pdaNewPasswordConfirm)}" class="h-8 w-full rounded border px-2 text-sm" placeholder="请再次输入登录密码" />
                </label>
              </div>
              <label class="mt-3 block space-y-1">
                <span class="text-xs text-muted-foreground">角色</span>
                <select data-pda-field="new-user-role" class="h-8 w-full rounded border px-2 text-sm">
                  ${activeRoles
                    .map(
                      (role) =>
                        `<option value="${role.roleId}" ${state.pdaNewRoleId === role.roleId ? 'selected' : ''}>${escapeHtml(role.roleName)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
              <div class="mt-3 flex gap-2">
                <button type="button" data-factory-action="cancel-add-user" class="rounded border px-3 py-1.5 text-xs hover:bg-muted">取消</button>
                <button type="button" data-factory-action="create-pda-user" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">创建账号</button>
              </div>
            </div>
          `
          : ''
      }

      ${
        state.pdaResetPasswordOpen
          ? `
            <div class="rounded-md border bg-muted/30 p-4">
              <div class="mb-3 text-xs text-muted-foreground">重置密码账号：${escapeHtml(resetTargetUser?.loginId || '暂无数据')}</div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">新密码 *</span>
                  <input type="password" data-pda-field="reset-user-password" value="${escapeHtml(state.pdaResetPasswordValue)}" class="h-8 w-full rounded border px-2 text-sm" placeholder="请输入新密码" />
                </label>
                <label class="space-y-1">
                  <span class="text-xs text-muted-foreground">确认新密码 *</span>
                  <input type="password" data-pda-field="reset-user-password-confirm" value="${escapeHtml(state.pdaResetPasswordConfirm)}" class="h-8 w-full rounded border px-2 text-sm" placeholder="请再次输入新密码" />
                </label>
              </div>
              <div class="mt-3 flex gap-2">
                <button type="button" data-factory-action="cancel-reset-user-password" class="rounded border px-3 py-1.5 text-xs hover:bg-muted">取消</button>
                <button type="button" data-factory-action="confirm-reset-user-password" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">确认重置</button>
              </div>
            </div>
          `
          : ''
      }
    </div>
  `
}

function renderPdaRoleForm(factoryId: string, pdaEnabled: boolean): string {
  if (!state.pdaRoleFormOpen) return ''
  const roles = getFactoryPdaRoles(factoryId)
  const isEdit = Boolean(state.pdaEditingRoleId)

  const groups = permissionCatalog.reduce<Record<string, typeof permissionCatalog>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = []
    acc[item.group].push(item)
    return acc
  }, {})

  return `
    <div class="rounded-md border bg-muted/30 p-4 space-y-3">
      <p class="text-xs font-semibold">${isEdit ? '编辑角色' : '新建角色'}</p>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label class="space-y-1">
          <span class="text-xs text-muted-foreground">角色名称 *</span>
          <input data-pda-field="role-form-name" value="${escapeHtml(state.pdaRoleFormName)}" class="h-8 w-full rounded border px-2 text-sm" placeholder="请输入角色名称" />
        </label>
        ${
          isEdit
            ? ''
            : `
              <label class="space-y-1">
                <span class="text-xs text-muted-foreground">复制现有角色</span>
                <select data-pda-field="role-copy-from" class="h-8 w-full rounded border px-2 text-sm">
                  <option value="">— 不复制 —</option>
                  ${roles
                    .map(
                      (role) =>
                        `<option value="${role.roleId}" ${state.pdaCopyFromRoleId === role.roleId ? 'selected' : ''}>${escapeHtml(role.roleName)}</option>`,
                    )
                    .join('')}
                </select>
              </label>
            `
        }
      </div>

      <div class="space-y-2">
        <p class="text-xs text-muted-foreground">按当前工厂端移动应用真实功能配置权限</p>
        ${Object.entries(groups)
          .map(([group, items]) => {
            return `
              <div class="space-y-1 rounded border bg-background p-2">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-medium text-muted-foreground">${escapeHtml(group)}</span>
                  <div class="flex items-center gap-2">
                    <button type="button" data-factory-action="role-select-group" data-group="${escapeHtml(group)}" class="text-xs text-blue-600 hover:underline">全选</button>
                    <button type="button" data-factory-action="role-clear-group" data-group="${escapeHtml(group)}" class="text-xs text-muted-foreground hover:underline">清空</button>
                  </div>
                </div>
                <div class="mt-1 flex flex-wrap gap-2">
                  ${items
                    .map((item) => {
                      const checked = state.pdaRoleFormPerms.includes(item.key)
                      return `
                        <label class="inline-flex items-center gap-1.5 text-xs">
                          <input type="checkbox" data-pda-role-perm="${item.key}" ${checked ? 'checked' : ''} class="h-3.5 w-3.5 rounded border" />
                          <span>${escapeHtml(item.nameZh)}</span>
                        </label>
                      `
                    })
                    .join('')}
                </div>
              </div>
            `
          })
          .join('')}
      </div>

      <div class="flex gap-2">
        <button type="button" data-factory-action="cancel-role-form" class="rounded border px-3 py-1.5 text-xs hover:bg-muted">取消</button>
        <button type="button" data-factory-action="save-role-form" class="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">保存角色</button>
      </div>
    </div>
  `
}

function renderPdaRolesSection(factoryId: string, pdaEnabled: boolean): string {
  if (!factoryId) {
    return '<p class="py-4 text-sm text-muted-foreground">保存工厂档案后，可在此管理工厂端移动应用角色。</p>'
  }

  const roles = getFactoryPdaRoles(factoryId)
  const users = getFactoryPdaUsers(factoryId)

  return `
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-xs text-muted-foreground">管理当前工厂端移动应用角色、权限与可用状态</p>
        <button type="button" data-factory-action="open-role-form-create" class="rounded border px-3 py-1.5 text-xs hover:bg-muted ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">新建角色</button>
      </div>

      ${renderPdaRoleForm(factoryId, pdaEnabled)}

      ${
        roles.length === 0
          ? '<p class="py-4 text-center text-sm text-muted-foreground">暂无角色数据</p>'
          : `
            <div class="overflow-x-auto rounded-md border">
              <table class="w-full text-sm">
                <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left font-medium">角色名称</th>
                    <th class="px-3 py-2 text-left font-medium">状态</th>
                    <th class="px-3 py-2 text-center font-medium">权限数</th>
                    <th class="px-3 py-2 text-center font-medium">账号数</th>
                    <th class="px-3 py-2 text-left font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  ${roles
                    .map((role) => {
                      const userCount = users.filter((user) => user.roleId === role.roleId).length
                      return `
                        <tr class="border-b last:border-0">
                          <td class="px-3 py-2 text-sm">
                            <div class="flex items-center gap-1.5">
                              <span>${escapeHtml(role.roleName)}</span>
                              <span class="inline-flex rounded border px-1 py-0 text-[10px] ${role.isSystemPreset ? 'border-slate-300 text-slate-500' : 'border-blue-200 text-blue-700'}">${role.isSystemPreset ? '预设' : '自定义'}</span>
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            <span class="inline-flex rounded border px-2 py-0.5 text-xs ${
                              role.status === 'ACTIVE'
                                ? 'border-blue-200 bg-blue-50 text-blue-700'
                                : 'border-slate-200 bg-slate-100 text-slate-700'
                            }">${role.status === 'ACTIVE' ? '启用' : '禁用'}</span>
                          </td>
                          <td class="px-3 py-2 text-center text-sm tabular-nums">${role.permissionKeys.length}</td>
                          <td class="px-3 py-2 text-center text-sm tabular-nums">${userCount}</td>
                          <td class="px-3 py-2">
                            <div class="flex gap-1">
                              <button type="button" data-factory-action="open-role-form-edit" data-role-id="${role.roleId}" class="rounded px-2 py-1 text-xs hover:bg-muted ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">编辑</button>
                              <button type="button" data-factory-action="toggle-role-status" data-role-id="${role.roleId}" class="rounded px-2 py-1 text-xs hover:bg-muted ${!pdaEnabled ? 'pointer-events-none opacity-50' : ''}">
                                ${role.status === 'ACTIVE' ? '禁用' : '启用'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
            </div>
          `
      }
    </div>
  `
}

function renderPdaPermissionsSection(): string {
  const groups = permissionCatalog.reduce<Record<string, typeof permissionCatalog>>((acc, permission) => {
    if (!acc[permission.group]) acc[permission.group] = []
    acc[permission.group].push(permission)
    return acc
  }, {})

  return `
    <div class="space-y-3">
      <p class="rounded bg-muted px-3 py-2 text-xs text-muted-foreground">权限矩阵按当前工厂端移动应用真实功能整理，实际授权请在“角色管理”中配置。</p>
      ${Object.entries(groups)
        .map(
          ([group, items]) => `
            <section class="space-y-1">
              <p class="text-xs font-semibold text-foreground">${escapeHtml(group)}</p>
              <div class="overflow-x-auto rounded-md border">
                <table class="w-full text-sm">
                  <thead class="border-b bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">权限名</th>
                      <th class="px-3 py-2 text-left font-medium">权限键</th>
                      <th class="px-3 py-2 text-left font-medium">说明</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${items
                      .map(
                        (permission) => `
                          <tr class="border-b last:border-0">
                            <td class="px-3 py-2 text-sm">${escapeHtml(permission.nameZh)}</td>
                            <td class="px-3 py-2 font-mono text-xs text-muted-foreground">${escapeHtml(permission.key)}</td>
                            <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(permission.descriptionZh)}</td>
                          </tr>
                        `,
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>
            </section>
          `,
        )
        .join('')}
    </div>
  `
}

function renderFactoryDrawer(): string {
  if (state.dialog.type !== 'create' && state.dialog.type !== 'edit') {
    return ''
  }

  const draft = state.formDraft
  if (!draft) return ''

  const editingFactory = getEditingFactory()
  const factoryId = editingFactory?.id ?? ''
  const availableTypes = typesByTier[draft.factoryTier] ?? []
  const parentCandidates = state.factories.filter(
    (factory) => factory.factoryTier === 'CENTRAL' && (!editingFactory || factory.id !== editingFactory.id),
  )
  const selectedParentName = draft.parentFactoryId
    ? state.factories.find((factory) => factory.id === draft.parentFactoryId)?.name ?? draft.parentFactoryId
    : ''

  const sectionTitleClass = 'border-b pb-1 text-sm font-semibold text-foreground'

  return `
    <div class="fixed inset-0 z-50">
      <button class="absolute inset-0 bg-black/45" data-factory-action="close-dialog" aria-label="关闭抽屉"></button>

      <section class="absolute inset-y-0 right-0 flex w-full flex-col border-l bg-background shadow-2xl sm:max-w-[720px]">
        <header class="sticky top-0 z-10 border-b bg-background px-6 py-4">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-semibold">${state.dialog.type === 'create' ? '新增工厂档案' : '编辑工厂档案'}</h3>
            <button type="button" data-factory-action="close-dialog" class="rounded-md border px-2 py-1 text-xs hover:bg-muted">关闭</button>
          </div>
        </header>

        <form class="flex min-h-0 flex-1 flex-col" data-factory-form="true">
          <div class="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
            <section class="space-y-4" data-testid="factory-process-abilities">
              <h4 class="${sectionTitleClass}">基本信息</h4>
              <div class="grid grid-cols-2 gap-4">
                <label class="space-y-1.5">
                  <span class="text-sm">工厂名称 *</span>
                  <input data-factory-field="name" value="${escapeHtml(draft.name)}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入工厂名称" />
                </label>
                <label class="space-y-1.5">
                  <span class="text-sm">联系人 *</span>
                  <input data-factory-field="contact" value="${escapeHtml(draft.contact)}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入联系人姓名" />
                </label>
              </div>

              <label class="space-y-1.5">
                <span class="text-sm">联系电话 *</span>
                <input data-factory-field="phone" value="${escapeHtml(draft.phone)}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入联系电话" />
              </label>

              <label class="space-y-1.5">
                <span class="text-sm">工厂地址 *</span>
                <input data-factory-field="address" value="${escapeHtml(draft.address)}" class="w-full rounded-md border px-3 py-2 text-sm" placeholder="请输入工厂详细地址" />
              </label>

              <div class="grid grid-cols-2 gap-4">
                <label class="space-y-1.5">
                  <span class="text-sm">工厂状态</span>
                  <select data-factory-field="status" class="w-full rounded-md border px-3 py-2 text-sm">
                    ${Object.entries(factoryStatusConfig)
                      .map(
                        ([key, config]) =>
                          `<option value="${key}" ${draft.status === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`,
                      )
                      .join('')}
                  </select>
                </label>
                <label class="space-y-1.5">
                  <span class="text-sm">合作模式</span>
                  <select data-factory-field="cooperationMode" class="w-full rounded-md border px-3 py-2 text-sm">
                    ${Object.entries(cooperationModeConfig)
                      .map(
                        ([key, config]) =>
                          `<option value="${key}" ${draft.cooperationMode === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`,
                      )
                      .join('')}
                  </select>
                </label>
              </div>
            </section>

            <section class="space-y-4">
              <h4 class="${sectionTitleClass}">工厂层级 / 工厂类型</h4>
              <div class="grid grid-cols-2 gap-4">
                <label class="space-y-1.5">
                  <span class="text-sm">工厂层级</span>
                  <select data-factory-field="factoryTier" class="w-full rounded-md border px-3 py-2 text-sm">
                    ${Object.entries(factoryTierConfig)
                      .map(
                        ([key, config]) =>
                          `<option value="${key}" ${draft.factoryTier === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`,
                      )
                      .join('')}
                  </select>
                </label>
                <label class="space-y-1.5">
                  <span class="text-sm">工厂类型</span>
                  <select data-factory-field="factoryType" class="w-full rounded-md border px-3 py-2 text-sm">
                    ${availableTypes
                      .map(
                        (type) =>
                          `<option value="${type}" ${draft.factoryType === type ? 'selected' : ''}>${escapeHtml(factoryTypeConfig[type].label)}</option>`,
                      )
                      .join('')}
                  </select>
                  <p class="text-xs text-muted-foreground">类型用于分配开始条件与产能/绩效归类</p>
                </label>
              </div>

              <label class="space-y-1.5">
                <span class="text-sm">上级工厂</span>
                <select data-factory-field="parentFactoryId" class="w-full rounded-md border px-3 py-2 text-sm">
                  <option value="" ${!draft.parentFactoryId ? 'selected' : ''}>— 无上级工厂 —</option>
                  ${parentCandidates
                    .map(
                      (factory) =>
                        `<option value="${factory.id}" ${draft.parentFactoryId === factory.id ? 'selected' : ''}>${escapeHtml(factory.name)} (${escapeHtml(factory.code)})</option>`,
                    )
                    .join('')}
                </select>
                ${
                  draft.factoryTier === 'SATELLITE' || draft.factoryTier === 'THIRD_PARTY'
                    ? '<p class="text-xs text-amber-600">卫星工厂/三方工厂建议绑定上级中央工厂，便于组织层级管理。</p>'
                    : ''
                }
                ${
                  draft.parentFactoryId
                    ? `<p class="text-xs text-muted-foreground">层级路径：${escapeHtml(factoryTierConfig[draft.factoryTier].label)} / ${escapeHtml(selectedParentName)}</p>`
                    : ''
                }
              </label>
            </section>

            <section class="space-y-4">
              <h4 class="${sectionTitleClass}">生产流程开始条件</h4>
              <div class="grid grid-cols-2 gap-3">
                ${[
                  { key: 'allowDispatch', label: '允许派单' },
                  { key: 'allowBid', label: '允许竞价' },
                  { key: 'allowExecute', label: '允许执行' },
                  { key: 'allowSettle', label: '允许结算' },
                ]
                  .map((item) => {
                    const checked = draft.eligibility[item.key as keyof typeof draft.eligibility]
                    return `
                      <label class="flex items-center gap-3">
                        <input type="checkbox" data-factory-field="${item.key}" ${checked ? 'checked' : ''} class="h-4 w-4 rounded border" />
                        <span class="text-sm">${item.label}</span>
                      </label>
                    `
                  })
                  .join('')}
              </div>
              <p class="text-xs text-muted-foreground">关闭开始条件会影响对应业务流转，请谨慎操作。</p>
            </section>

            <section class="space-y-4">
              <h4 class="${sectionTitleClass}">接单能力</h4>
              <div class="space-y-4">
                ${listProcessStages()
                  .map((stage) => {
                    const processes = listProcessesByStageCode(stage.stageCode).filter((process) => process.generatesExternalTask)
                    return `
                      <div class="rounded-lg border bg-muted/20 p-4">
                        <div class="mb-3">
                          <p class="text-sm font-medium text-foreground">${escapeHtml(stage.stageName)}</p>
                        </div>
                        <div class="space-y-3">
                          ${processes
                            .map((process) => {
                              const crafts = process.processCode === 'POST_FINISHING'
                                ? getPostBusinessActionOptions(draft.factoryType)
                                : listCraftsByProcessCode(process.processCode)
                              const selectedCraftCodes = getSelectedCraftCodes(draft.processAbilities, process.processCode)
                              const selectedNodeCodes = getSelectedCapacityNodeCodes(draft.processAbilities, process.processCode)
                              const hasPostAbility = process.processCode === 'POST_FINISHING' && selectedNodeCodes.length > 0
                              const selectedCodes = process.processCode === 'POST_FINISHING'
                                ? hasPostAbility
                                  ? crafts.map((craft) => craft.craftCode)
                                  : []
                                : selectedCraftCodes
                              const fixedPostAbility = process.processCode === 'POST_FINISHING' && isDedicatedPostFactoryType(draft.factoryType)
                              const checked = fixedPostAbility || (crafts.length > 0 && selectedCodes.length === crafts.length)
                              return `
                                <div class="rounded-md border bg-background p-3">
                                  <label class="flex items-center gap-2 text-sm font-medium text-foreground">
                                    <input
                                      type="checkbox"
                                      data-factory-process-toggle="${process.processCode}"
                                      ${checked ? 'checked' : ''}
                                      ${fixedPostAbility ? 'disabled' : ''}
                                      class="h-4 w-4 rounded border"
                                    />
                                    <span>${escapeHtml(process.processName)}</span>
                                  </label>
                                  <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 pl-6">
                                    ${crafts
                                      .map((craft) => {
                                        const craftChecked = fixedPostAbility || selectedCodes.includes(craft.craftCode)
                                        return `
                                          <label class="inline-flex items-center gap-2 text-sm">
                                            <input
                                              type="checkbox"
                                              ${process.processCode === 'POST_FINISHING'
                                                ? ''
                                                : `data-factory-craft-toggle="${craft.craftCode}"`}
                                              data-factory-process-code="${process.processCode}"
                                              ${craftChecked ? 'checked' : ''}
                                              ${process.processCode === 'POST_FINISHING' ? 'disabled' : ''}
                                              class="h-4 w-4 rounded border"
                                            />
                                            <span>${escapeHtml(craft.craftName)}</span>
                                          </label>
                                        `
                                      })
                                      .join('')}
                                  </div>
                                </div>
                              `
                            })
                            .join('')}
                        </div>
                      </div>
                    `
                  })
                  .join('')}
              </div>
            </section>

            <section class="space-y-4">
              <h4 class="${sectionTitleClass}">工厂端移动应用配置（主数据）</h4>
              <label class="flex items-center gap-3">
                <input type="checkbox" data-factory-field="pdaEnabled" ${draft.pdaEnabled ? 'checked' : ''} class="h-4 w-4 rounded border" />
                <span class="text-sm">启用工厂端移动应用</span>
              </label>

              <label class="space-y-1.5">
                <span class="text-sm">工厂端移动应用 Tenant ID ${draft.pdaEnabled ? '<span class="text-red-600">*</span>' : ''}</span>
                <input data-factory-field="pdaTenantId" ${draft.pdaEnabled ? '' : 'disabled'} value="${escapeHtml(draft.pdaTenantId ?? '')}" class="w-full rounded-md border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-muted" placeholder="默认与工厂ID一致，可自定义" />
                <p class="text-xs text-muted-foreground">账号与权限在“工厂端移动应用账号与权限”模块维护。</p>
              </label>
            </section>

            <section class="space-y-3">
              <h4 class="${sectionTitleClass}">工厂端移动应用账号与权限</h4>
              ${
                !draft.pdaEnabled
                  ? '<p class="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">工厂端移动应用未启用，无法创建账号；可查看已有账号。</p>'
                  : ''
              }

              <div class="grid w-full grid-cols-3 rounded-md border p-1">
                <button type="button" data-factory-action="switch-pda-tab" data-pda-tab="users" class="rounded px-2 py-1 text-xs ${
                  state.pdaTab === 'users' ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted'
                }">账号列表</button>
                <button type="button" data-factory-action="switch-pda-tab" data-pda-tab="roles" class="rounded px-2 py-1 text-xs ${
                  state.pdaTab === 'roles' ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted'
                }">角色管理</button>
                <button type="button" data-factory-action="switch-pda-tab" data-pda-tab="permissions" class="rounded px-2 py-1 text-xs ${
                  state.pdaTab === 'permissions' ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted'
                }">权限矩阵</button>
              </div>
              ${state.pdaError ? `<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.pdaError)}</p>` : ''}

              ${
                state.pdaTab === 'users'
                  ? renderPdaUsersSection(factoryId, draft.pdaEnabled)
                  : state.pdaTab === 'roles'
                    ? renderPdaRolesSection(factoryId, draft.pdaEnabled)
                    : renderPdaPermissionsSection()
              }
            </section>
          </div>

          <footer class="border-t px-6 py-4">
            ${state.formError ? `<p class="mb-2 text-sm text-red-600">${escapeHtml(state.formError)}</p>` : ''}
            <div class="flex items-center justify-between gap-3">
              <button type="button" data-factory-action="close-dialog" class="rounded-md border px-4 py-2 text-sm hover:bg-muted">取消</button>
              <button type="submit" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">${
                state.dialog.type === 'edit' ? '保存' : '创建工厂'
              }</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  `
}

function renderDeleteDialog(): string {
  const dialog = state.dialog
  if (dialog.type !== 'delete') return ''

  const factory = state.factories.find((item) => item.id === dialog.factoryId)
  if (!factory) return ''

  return renderConfirmDialog(
    {
      title: '确认删除工厂档案',
      closeAction: { prefix: 'factory', action: 'close-dialog' },
      confirmAction: { prefix: 'factory', action: 'confirm-delete', label: '删除' },
      danger: true,
      width: 'sm',
    },
    `<p class="text-sm text-muted-foreground">确定删除工厂 <span class="font-medium text-foreground">${escapeHtml(factory.name)}</span> 的档案吗？此操作不可撤销。</p>`
  )
}

export function renderFactoryProfilePage(): string {
  state.factories = listFactoryMasterRecords()
  const filteredFactories = getVisibleFactories()
  const paginated = getPagedFactories(filteredFactories)

  const availableTypes =
    state.tierFilter !== 'all'
      ? typesByTier[state.tierFilter as FactoryTier] ?? []
      : (Object.keys(factoryTypeConfig) as FactoryType[])

  const dialogHtml = `${renderFactoryDrawer()}${renderDeleteDialog()}`

  return `
    <div class="space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold text-foreground">工厂档案</h1>
          <p class="mt-1 text-sm text-muted-foreground">管理合作工厂的核心主数据，包括组织层级、工厂端移动应用配置、生产流程开始条件等。</p>
        </div>
        <button class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-factory-action="open-create">
          新增工厂
        </button>
      </div>

      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-sm font-medium text-foreground">后道接单能力口径</h2>
            <p class="mt-1 text-xs text-muted-foreground">专门后道工厂固定具备后道、质检、复检；非专门工厂只展示后道，质检和复检由后道工厂承接。</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">后道</span>
            <span class="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">质检</span>
            <span class="rounded border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700">复检</span>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-3">
        <label class="relative min-w-[220px] flex-1 max-w-sm">
          <input
            data-factory-filter="search"
            value="${escapeHtml(state.searchKeyword)}"
            placeholder="搜索名称、编号、联系人、电话..."
            class="w-full rounded-md border py-2 pl-3 pr-3 text-sm"
          />
        </label>

        <select data-factory-filter="tier" class="rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.tierFilter === 'all' ? 'selected' : ''}>全部层级</option>
          ${Object.entries(factoryTierConfig)
            .map(
              ([key, config]) =>
                `<option value="${key}" ${state.tierFilter === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`,
            )
            .join('')}
        </select>

        <select data-factory-filter="type" class="rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.typeFilter === 'all' ? 'selected' : ''}>全部类型</option>
          ${availableTypes
            .map(
              (type) =>
                `<option value="${type}" ${state.typeFilter === type ? 'selected' : ''}>${escapeHtml(factoryTypeConfig[type].label)}</option>`,
            )
            .join('')}
        </select>

        <select data-factory-filter="pda" class="rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.pdaFilter === 'all' ? 'selected' : ''}>全部工厂端移动应用</option>
          <option value="enabled" ${state.pdaFilter === 'enabled' ? 'selected' : ''}>已启用</option>
          <option value="disabled" ${state.pdaFilter === 'disabled' ? 'selected' : ''}>未启用</option>
        </select>

        <select data-factory-filter="status" class="rounded-md border px-3 py-2 text-sm">
          <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
          ${Object.entries(factoryStatusConfig)
            .map(
              ([key, config]) =>
                `<option value="${key}" ${state.statusFilter === key ? 'selected' : ''}>${escapeHtml(config.label)}</option>`,
            )
            .join('')}
        </select>

        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-factory-action="reset">重置</button>

        <div class="ml-auto text-sm text-muted-foreground">共 ${filteredFactories.length} 条记录</div>
      </div>

      <div class="overflow-x-auto rounded-lg border bg-card">
        <table class="w-full min-w-[1200px] text-sm">
          <thead class="border-b bg-muted/30">
            <tr>
              <th class="px-3 py-3 text-left">
                <button data-factory-action="sort" data-sort-field="code" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">工厂编号 ${renderSortIcon('code')}</button>
              </th>
              <th class="px-3 py-3 text-left">
                <button data-factory-action="sort" data-sort-field="name" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">工厂名称 ${renderSortIcon('name')}</button>
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">联系人</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">联系电话</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">地址</th>
              <th class="px-3 py-3 text-left">
                <button data-factory-action="sort" data-sort-field="tier" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">工厂层级 ${renderSortIcon('tier')}</button>
              </th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂类型</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">上级工厂</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">工厂端移动应用</th>
              <th class="px-3 py-3 text-left text-xs font-medium text-muted-foreground">资格开始条件</th>
              <th class="px-3 py-3 text-left">
                <button data-factory-action="sort" data-sort-field="status" class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">状态 ${renderSortIcon('status')}</button>
              </th>
              <th class="px-3 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
            </tr>
          </thead>
          <tbody>
            ${renderFactoryTableRows(paginated)}
          </tbody>
        </table>
      </div>

      ${renderPagination(filteredFactories.length)}
      ${dialogHtml}
    </div>
  `
}

function closeDialog(): void {
  state.dialog = { type: 'none' }
  state.formDraft = null
  state.formError = ''
  state.pdaTab = 'users'
  resetPdaEditorState()
}

function updateTypeFilterByTier(): void {
  if (state.tierFilter === 'all') return

  const available = typesByTier[state.tierFilter as FactoryTier] ?? []
  if (available.length === 0) return

  if (!available.includes(state.typeFilter as FactoryType)) {
    state.typeFilter = 'all'
  }
}

function upsertFactory(data: FactoryFormData, editingFactory: Factory | null): void {
  if (editingFactory) {
    const nextFactory: Factory = {
      ...editingFactory,
      ...data,
      processAbilities: data.processAbilities.map((item) => cloneProcessAbility(item)),
      updatedAt: new Date().toISOString().split('T')[0],
    }

    upsertFactoryMasterRecord(nextFactory)
    state.factories = listFactoryMasterRecords()
    if (nextFactory.pdaEnabled && nextFactory.status === 'active') {
      ensurePdaDataForFactory(nextFactory)
    }

    return
  }

  const today = new Date().toISOString().split('T')[0]

  const newFactory: Factory = {
    id: `f-${Date.now()}`,
    code: generateFactoryCode(),
    name: data.name,
    address: data.address,
    contact: data.contact,
    phone: data.phone,
    status: data.status,
    cooperationMode: data.cooperationMode,
    processAbilities: data.processAbilities.map((item) => cloneProcessAbility(item)),
    qualityScore: 0,
    deliveryScore: 0,
    createdAt: today,
    updatedAt: today,
    factoryTier: data.factoryTier,
    factoryType: data.factoryType,
    parentFactoryId: data.parentFactoryId,
    pdaEnabled: data.pdaEnabled,
    pdaTenantId: data.pdaTenantId,
    eligibility: data.eligibility,
  }

  upsertFactoryMasterRecord(newFactory)
  state.factories = listFactoryMasterRecords()
  if (newFactory.pdaEnabled && newFactory.status === 'active') {
    ensurePdaDataForFactory(newFactory)
  }
}

export function handleFactoryPageEvent(target: HTMLElement): boolean {
  const formField = target.closest<HTMLElement>('[data-factory-field]')
  if ((formField instanceof HTMLInputElement || formField instanceof HTMLSelectElement) && state.formDraft) {
    const field = formField.dataset.factoryField
    if (!field) return true

    if (field === 'name' || field === 'contact' || field === 'address' || field === 'phone') {
      setDraft((prev) => ({ ...prev, [field]: formField.value }))
      return true
    }

    if (field === 'status') {
      setDraft((prev) => ({ ...prev, status: formField.value as Factory['status'] }))
      return true
    }

    if (field === 'cooperationMode') {
      setDraft((prev) => ({ ...prev, cooperationMode: formField.value as Factory['cooperationMode'] }))
      return true
    }

    if (field === 'factoryTier') {
      const nextTier = formField.value as FactoryTier
      setDraft((prev) => {
        const nextType = (typesByTier[nextTier] ?? [prev.factoryType])[0]
        return {
          ...prev,
          factoryTier: nextTier,
          factoryType: nextType,
        }
      })
      return true
    }

    if (field === 'factoryType') {
      setDraft((prev) => ({ ...prev, factoryType: formField.value as FactoryType }))
      return true
    }

    if (field === 'parentFactoryId') {
      setDraft((prev) => ({
        ...prev,
        parentFactoryId: formField.value || undefined,
      }))
      return true
    }

    if (field === 'pdaEnabled' && formField instanceof HTMLInputElement) {
      setDraft((prev) => ({
        ...prev,
        pdaEnabled: formField.checked,
      }))
      return true
    }

    if (field === 'pdaTenantId') {
      setDraft((prev) => ({ ...prev, pdaTenantId: formField.value }))
      return true
    }

    if (
      (field === 'allowDispatch' ||
        field === 'allowBid' ||
        field === 'allowExecute' ||
        field === 'allowSettle') &&
      formField instanceof HTMLInputElement
    ) {
      setDraft((prev) => ({
        ...prev,
        eligibility: {
          ...prev.eligibility,
          [field]: formField.checked,
        },
      }))
      return true
    }

    return true
  }

  const processToggleField = target.closest<HTMLElement>('[data-factory-process-toggle]')
  if (processToggleField instanceof HTMLInputElement && state.formDraft) {
    const processCode = processToggleField.dataset.factoryProcessToggle
    if (!processCode) return true

    const craftCodes = processCode === 'POST_FINISHING'
      ? []
      : processToggleField.checked
        ? listCraftsByProcessCode(processCode).map((item) => item.craftCode)
        : []
    const capacityNodeCodes = processCode === 'POST_FINISHING' && processToggleField.checked
      ? [...POST_CAPACITY_NODE_CODES]
      : []

    setDraft((prev) => ({
      ...prev,
      processAbilities: upsertProcessAbility(
        prev.processAbilities,
        processCode,
        craftCodes,
        processCode === 'POST_FINISHING' ? capacityNodeCodes : undefined,
      ),
    }))

    return true
  }

  const craftToggleField = target.closest<HTMLElement>('[data-factory-craft-toggle]')
  if (craftToggleField instanceof HTMLInputElement && state.formDraft) {
    const processCode = craftToggleField.dataset.factoryProcessCode
    const craftCode = craftToggleField.dataset.factoryCraftToggle
    if (!processCode || !craftCode) return true

    setDraft((prev) => {
      const selectedCraftCodes = getSelectedCraftCodes(prev.processAbilities, processCode)
      const nextCraftCodes = craftToggleField.checked
        ? [...selectedCraftCodes, craftCode]
        : selectedCraftCodes.filter((item) => item !== craftCode)

      return {
        ...prev,
        processAbilities: upsertProcessAbility(prev.processAbilities, processCode, nextCraftCodes),
      }
    })

    return true
  }

  const nodeToggleField = target.closest<HTMLElement>('[data-factory-node-toggle]')
  if (nodeToggleField instanceof HTMLInputElement && state.formDraft) {
    const processCode = nodeToggleField.dataset.factoryProcessCode
    const nodeCode = nodeToggleField.dataset.factoryNodeToggle as FactoryPostCapacityNodeCode | undefined
    if (!processCode || !nodeCode) return true

    setDraft((prev) => {
      const selectedNodeCodes = getSelectedCapacityNodeCodes(prev.processAbilities, processCode)
      const nextNodeCodes = nodeToggleField.checked
        ? [...selectedNodeCodes, nodeCode]
        : selectedNodeCodes.filter((item) => item !== nodeCode)

      return {
        ...prev,
        processAbilities: upsertProcessAbility(prev.processAbilities, processCode, [], nextNodeCodes),
      }
    })

    return true
  }

  const pdaField = target.closest<HTMLElement>('[data-pda-field]')
  if (pdaField instanceof HTMLInputElement || pdaField instanceof HTMLSelectElement) {
    const field = pdaField.dataset.pdaField
    if (!field) return true

    if (field === 'new-user-name') {
      state.pdaNewName = pdaField.value
      clearPdaError()
      return true
    }

    if (field === 'new-user-login') {
      state.pdaNewLoginId = pdaField.value
      clearPdaError()
      return true
    }

    if (field === 'new-user-password') {
      state.pdaNewPassword = pdaField.value
      clearPdaError()
      return true
    }

    if (field === 'new-user-password-confirm') {
      state.pdaNewPasswordConfirm = pdaField.value
      clearPdaError()
      return true
    }

    if (field === 'new-user-role') {
      state.pdaNewRoleId = pdaField.value
      clearPdaError()
      return true
    }

    if (field === 'role-form-name') {
      state.pdaRoleFormName = pdaField.value
      clearPdaError()
      return true
    }

    if (field === 'role-copy-from') {
      state.pdaCopyFromRoleId = pdaField.value
      const factoryId = getCurrentDialogFactoryId()
      if (factoryId && pdaField.value) {
        copyRolePermissions(factoryId, pdaField.value)
      }
      clearPdaError()
      return true
    }

    if (field === 'reset-user-password') {
      state.pdaResetPasswordValue = pdaField.value
      clearPdaError()
      return true
    }

    if (field === 'reset-user-password-confirm') {
      state.pdaResetPasswordConfirm = pdaField.value
      clearPdaError()
      return true
    }

    return true
  }

  const rolePermissionField = target.closest<HTMLElement>('[data-pda-role-perm]')
  if (rolePermissionField instanceof HTMLInputElement) {
    const permissionKey = rolePermissionField.dataset.pdaRolePerm as PermissionKey | undefined
    if (!permissionKey) return true
    toggleRolePermission(permissionKey, rolePermissionField.checked)
    return true
  }

  const userRoleField = target.closest<HTMLElement>('[data-pda-user-role]')
  if (userRoleField instanceof HTMLSelectElement) {
    const userId = userRoleField.dataset.pdaUserRole
    const factoryId = getCurrentDialogFactoryId()
    if (!userId || !factoryId) return true
    setPdaUserRole(factoryId, userId, userRoleField.value)
    return true
  }

  const filterNode = target.closest<HTMLElement>('[data-factory-filter]')
  if (filterNode instanceof HTMLInputElement || filterNode instanceof HTMLSelectElement) {
    const filter = filterNode.dataset.factoryFilter
    const value = filterNode.value

    if (filter === 'search') state.searchKeyword = value
    if (filter === 'status') state.statusFilter = value
    if (filter === 'tier') {
      state.tierFilter = value
      updateTypeFilterByTier()
    }
    if (filter === 'type') state.typeFilter = value
    if (filter === 'pda') state.pdaFilter = value

    state.currentPage = 1
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-factory-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.factoryAction
  if (!action) return false

  if (action === 'open-create') {
    openCreateDialog()
    return true
  }

  if (action === 'edit') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    openEditDialog(factoryId)
    return true
  }

  if (action === 'delete') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    state.dialog = { type: 'delete', factoryId }
    return true
  }

  if (action === 'confirm-delete') {
    const factoryId = actionNode.dataset.factoryId
    if (!factoryId) return true
    removeFactoryMasterRecord(factoryId)
    removeFactoryPdaDataByFactory(factoryId)
    delete state.pdaUsersByFactory[factoryId]
    delete state.pdaRolesByFactory[factoryId]
    state.factories = listFactoryMasterRecords()
    closeDialog()
    return true
  }

  if (action === 'switch-pda-tab') {
    const tab = actionNode.dataset.pdaTab as PdaTab | undefined
    if (tab === 'users' || tab === 'roles' || tab === 'permissions') {
      state.pdaTab = tab
    }
    return true
  }

  if (action === 'toggle-add-user') {
    if (!state.pdaAddOpen) {
      const factoryId = getCurrentDialogFactoryId()
      if (factoryId) {
        const activeRole = getFactoryPdaRoles(factoryId).find(
          (role) => role.status === 'ACTIVE' && role.roleId === DEFAULT_FACTORY_MOBILE_APP_ROLE_ID,
        ) || getFactoryPdaRoles(factoryId).find((role) => role.status === 'ACTIVE')
        if (activeRole) {
          state.pdaNewRoleId = activeRole.roleId
        }
      }
    }
    state.pdaAddOpen = !state.pdaAddOpen
    clearPdaError()
    return true
  }

  if (action === 'cancel-add-user') {
    state.pdaAddOpen = false
    state.pdaNewName = ''
    state.pdaNewLoginId = ''
    state.pdaNewPassword = ''
    state.pdaNewPasswordConfirm = ''
    state.pdaNewRoleId = DEFAULT_FACTORY_MOBILE_APP_ROLE_ID
    clearPdaError()
    return true
  }

  if (action === 'create-pda-user') {
    const factoryId = getCurrentDialogFactoryId()
    if (!factoryId) {
      setPdaError('请先保存工厂档案，再新增工厂端移动应用账号。')
      return true
    }

    void createPdaUser(factoryId)
    return true
  }

  if (action === 'toggle-user-lock') {
    const factoryId = getCurrentDialogFactoryId()
    const userId = actionNode.dataset.userId
    if (!factoryId || !userId) return true
    togglePdaUserLock(factoryId, userId)
    return true
  }

  if (action === 'open-reset-user-password') {
    const factoryId = getCurrentDialogFactoryId()
    const userId = actionNode.dataset.userId
    if (!factoryId || !userId) return true
    openPdaResetPassword(factoryId, userId)
    return true
  }

  if (action === 'cancel-reset-user-password') {
    state.pdaResetPasswordOpen = false
    state.pdaResetPasswordUserId = null
    state.pdaResetPasswordValue = ''
    state.pdaResetPasswordConfirm = ''
    clearPdaError()
    return true
  }

  if (action === 'confirm-reset-user-password') {
    const factoryId = getCurrentDialogFactoryId()
    if (!factoryId) return true
    void submitPdaResetPassword(factoryId)
    return true
  }

  if (action === 'open-role-form-create') {
    openRoleFormCreate()
    return true
  }

  if (action === 'open-role-form-edit') {
    const factoryId = getCurrentDialogFactoryId()
    const roleId = actionNode.dataset.roleId
    if (!factoryId || !roleId) return true
    openRoleFormEdit(factoryId, roleId)
    return true
  }

  if (action === 'cancel-role-form') {
    state.pdaRoleFormOpen = false
    state.pdaEditingRoleId = null
    state.pdaRoleFormName = ''
    state.pdaRoleFormPerms = []
    state.pdaCopyFromRoleId = ''
    clearPdaError()
    return true
  }

  if (action === 'save-role-form') {
    const factoryId = getCurrentDialogFactoryId()
    if (!factoryId) {
      setPdaError('请先保存工厂档案，再创建或编辑角色。')
      return true
    }

    savePdaRole(factoryId)
    return true
  }

  if (action === 'toggle-role-status') {
    const factoryId = getCurrentDialogFactoryId()
    const roleId = actionNode.dataset.roleId
    if (!factoryId || !roleId) return true
    togglePdaRoleStatus(factoryId, roleId)
    return true
  }

  if (action === 'role-select-group' || action === 'role-clear-group') {
    const group = actionNode.dataset.group
    if (!group) return true
    setRoleGroupPermissions(group, action === 'role-select-group')
    return true
  }

  if (action === 'close-dialog') {
    closeDialog()
    return true
  }

  if (action === 'sort') {
    const field = actionNode.dataset.sortField as SortField | undefined
    if (!field) return true

    if (state.sortField === field) {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc'
    } else {
      state.sortField = field
      state.sortOrder = 'asc'
    }

    return true
  }

  const totalPages = Math.max(1, Math.ceil(getVisibleFactories().length / PAGE_SIZE))

  if (action === 'prev-page') {
    state.currentPage = Math.max(1, state.currentPage - 1)
    return true
  }

  if (action === 'next-page') {
    state.currentPage = Math.min(totalPages, state.currentPage + 1)
    return true
  }

  if (action === 'goto-page') {
    const page = Number(actionNode.dataset.page ?? '1')
    state.currentPage = Math.max(1, Math.min(totalPages, page))
    return true
  }

  if (action === 'reset') {
    state.searchKeyword = ''
    state.statusFilter = 'all'
    state.tierFilter = 'all'
    state.typeFilter = 'all'
    state.pdaFilter = 'all'
    state.currentPage = 1
    return true
  }

  return false
}

export function handleFactoryPageSubmit(form: HTMLFormElement): boolean {
  if (form.dataset.factoryForm !== 'true') return false

  if (!state.formDraft) {
    state.formError = '表单状态异常，请重新打开抽屉。'
    return true
  }

  const data = cloneFormDraft(state.formDraft)
  data.name = data.name.trim()
  data.contact = data.contact.trim()
  data.phone = data.phone.trim()
  data.address = data.address.trim()
  data.pdaTenantId = (data.pdaTenantId ?? '').trim()

  if (!data.name || !data.contact || !data.phone || !data.address) {
    state.formError = '请完整填写工厂名称、联系人、联系电话和工厂地址。'
    return true
  }

  if (data.pdaEnabled && !data.pdaTenantId) {
    state.formError = '启用工厂端移动应用时必须填写工厂端移动应用 Tenant ID。'
    return true
  }

  if (!data.pdaEnabled) {
    data.pdaTenantId = ''
  }

  if (!data.parentFactoryId) {
    data.parentFactoryId = undefined
  }

  const editingFactory = getEditingFactory()
  upsertFactory(data, editingFactory)
  closeDialog()
  return true
}

export function isFactoryPageOpenDialog(): boolean {
  return state.dialog.type !== 'none'
}
