import { generateFactoryCode } from './factory-mock-data.ts'
import { getFactoryMasterRecordById, upsertFactoryMasterRecord } from './factory-master-store.ts'
import type { Factory, FactoryProcessAbility, FactoryType } from './factory-types.ts'
import { createInitialCapacityProfileFromOnboarding } from './factory-capacity-profile-mock.ts'
import {
  FACTORY_ADMIN_ROLE_ID,
  FACTORY_ADMIN_ROLE_NAME,
  FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS,
  type FactoryOnboardingActionLog,
  type FactoryOnboardingActionName,
  type FactoryOnboardingAdminAccount,
  type FactoryOnboardingApplicantSession,
  type FactoryOnboardingApplication,
  type FactoryOnboardingCompletenessItem,
  type FactoryOnboardingCompletenessLevel,
  type FactoryOnboardingDraftPayload,
  type FactoryInferredTypeCode,
  type FactoryOnboardingMachineAbility,
  type FactoryOnboardingMachineValidationStatus,
  type FactoryOnboardingNode,
  type FactoryOnboardingNodeLog,
  type FactoryOnboardingNodeStatus,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingReviewRecord,
  type FactoryOnboardingReviewResult,
  type FactoryOnboardingSelectedCapability,
  type FactoryOnboardingStatus,
  type FactoryOnboardingSupplementRecord,
  type FactoryTypeMatchResult,
} from './factory-onboarding-domain.ts'
import {
  clearFactoryOnboardingApplicantSession,
  createEmptyFactoryOnboardingDraft,
  createFactoryOnboardingApplicantSession,
  findFactoryOnboardingApplicationByLoginId,
  getFactoryOnboardingApplicantSession,
  getFactoryOnboardingApplicationById,
  isFactoryOnboardingLoginIdTaken,
  listFactoryOnboardingApplications,
  saveFactoryOnboardingApplication,
  setFactoryOnboardingApplicantSession,
} from './factory-onboarding-store.ts'
import {
  clearPdaSession,
  createFactoryPdaUser,
  findFactoryPdaUserByLoginId,
  generatePresetRolesForFactory,
  getPdaSession,
  replaceFactoryPdaRoles,
} from './store-domain-pda.ts'
import { getActiveCraftOptionsByProcess, getActiveProcessOptions } from './process-craft-dict.ts'
import { normalizeWhatsApp, validateWhatsApp } from './whatsapp-validator.ts'

export type PdaPostLoginSession =
  | { kind: 'PDA'; session: NonNullable<ReturnType<typeof getPdaSession>> }
  | { kind: 'ONBOARDING'; session: FactoryOnboardingApplicantSession; application: FactoryOnboardingApplication }

export type PdaFactoryAccessReasonCode =
  | 'UNAUTHENTICATED'
  | 'NO_APPLICATION'
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'SUPPLEMENT_REQUIRED'
  | 'WAITING_COOPERATION'
  | 'REJECTED'
  | 'COOPERATED'
  | 'RELOGIN_REQUIRED'

export interface PdaFactoryAccessState {
  isLoggedIn: boolean
  canAccessBusiness: boolean
  isCooperatedFactory: boolean
  reasonCode: PdaFactoryAccessReasonCode
  reasonLabel: string
  sessionKind: 'NONE' | 'PDA' | 'ONBOARDING'
  route: string
  returnTo?: string
  onboardingApplication: FactoryOnboardingApplication | null
  applicantSession: FactoryOnboardingApplicantSession | null
  pdaSession: ReturnType<typeof getPdaSession>
}

export interface FactoryOnboardingNodeSummary {
  currentNode: FactoryOnboardingNode
  currentStatusLabel: string
  currentNodeStatus: FactoryOnboardingNodeStatus
  elapsedText: string
  actionCountText: string
  actionCount: number
  lastOperatedAt: string
  lastActionName: string
}

interface ReviewApplicationInput {
  applicationId: string
  reviewResult: FactoryOnboardingReviewResult
  reviewOpinion: string
  reviewer: string
  requiredFields?: FactoryOnboardingRequiredField[]
}

interface TransitionOptions {
  now?: string
  closingStatus?: FactoryOnboardingNodeStatus
  openingStatus?: FactoryOnboardingNodeStatus
  remark?: string
}

const COMPLETENESS_SUBMIT_THRESHOLD = 80

const FACTORY_TYPE_LABEL_MAP: Record<FactoryInferredTypeCode, string> = {
  CUTTING_FACTORY: '裁床厂',
  PRINTING_FACTORY: '印花厂',
  DYEING_FACTORY: '染厂',
  POST_FINISHING_FACTORY: '后道工厂',
  SPECIAL_CRAFT_FACTORY: '特殊工艺厂',
  SEWING_FACTORY: '车缝厂',
  MULTI_CAPABILITY_FACTORY: '全能力工厂',
}

const SPECIAL_CRAFT_NAMES = new Set([
  '绣花',
  '打条',
  '压褶',
  '打揽',
  '烫画',
  '直喷',
  '贝壳绣',
  '曲牙绣',
  '一字贝绣花',
  '模板工序',
  '激光开袋',
  '特种车缝（花样机）',
])

function nowTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function parseDateMs(value?: string): number {
  if (!value) return 0
  const parsed = new Date(value.replace(' ', 'T')).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase()
}

function buildQueryPath(path: string, params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) search.set(key, value)
  })
  const query = search.toString()
  return query ? `${path}?${query}` : path
}

function buildNodeLogId(nodeName: FactoryOnboardingNode, at: string): string {
  return `NODE-${nodeName}-${at.replace(/[-: ]/g, '')}`
}

function buildActionLogId(actionName: FactoryOnboardingActionName, at: string): string {
  return `ACT-${actionName}-${at.replace(/[-: ]/g, '')}`
}

function getProcessName(processCode: string): string {
  return getActiveProcessOptions().find((item) => item.processCode === processCode)?.processName || processCode
}

function getCraftName(processCode: string, craftCode: string): string {
  return getActiveCraftOptionsByProcess(processCode).find((item) => item.craftCode === craftCode)?.craftName || craftCode
}

function toRoundedScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function getCompletenessLevel(score: number): FactoryOnboardingCompletenessLevel {
  if (score >= 95) return '高完整'
  if (score >= 80) return '完整'
  if (score >= 60) return '基本完整'
  return '不完整'
}

function buildCompletenessItem(
  itemCode: string,
  itemName: string,
  weight: number,
  completedCount: number,
  totalCount: number,
  missingReason: string,
): FactoryOnboardingCompletenessItem {
  const ratio = totalCount <= 0 ? 0 : completedCount / totalCount
  return {
    itemCode,
    itemName,
    weight,
    isCompleted: completedCount >= totalCount,
    score: toRoundedScore(weight * ratio),
    missingReason,
  }
}

export function calculateOnboardingCompleteness(application: Pick<
  FactoryOnboardingApplication,
  'factoryName' | 'bossName' | 'whatsapp' | 'address' | 'machineTotalCount' | 'effectiveWorkerCount' | 'availableStartDate' | 'selectedCapabilities' | 'machines' | 'adminAccount'
>): {
  completenessScore: number
  completenessLevel: FactoryOnboardingCompletenessLevel
  completenessItems: FactoryOnboardingCompletenessItem[]
  completenessUpdatedAt: string
} {
  const factoryWhatsAppValid = validateWhatsApp(application.whatsapp).isValid
  const adminWhatsAppValid = validateWhatsApp(application.adminAccount.whatsapp).isValid
  const capabilityCount = application.selectedCapabilities.filter((item) => item.processCode && item.craftCode).length
  const machines = applyMachineValidation(application.machines, application.selectedCapabilities)
  const machineBaseCompleted = machines.filter((item) => item.machineName.trim() && item.machineCount > 0 && item.condition).length
  const linkedCompleted = machines.filter((item) => item.validationStatus === '通过').length

  const items = [
    buildCompletenessItem(
      'ACCOUNT',
      '账号信息',
      10,
      [
        application.adminAccount.loginId.trim(),
        application.adminAccount.password.trim(),
        application.adminAccount.adminName.trim(),
        adminWhatsAppValid ? 'valid' : '',
      ].filter(Boolean).length,
      4,
      !application.adminAccount.loginId.trim()
        ? '缺少登录账户'
        : !application.adminAccount.password.trim()
          ? '缺少登录密码'
          : !application.adminAccount.adminName.trim()
            ? '缺少管理员姓名'
            : adminWhatsAppValid
              ? '已完整'
              : '管理员 WhatsApp 格式不正确',
    ),
    buildCompletenessItem(
      'FACTORY_BASE',
      '工厂基础信息',
      20,
      [
        application.factoryName.trim(),
        application.bossName.trim(),
        factoryWhatsAppValid ? 'valid' : '',
        application.address.trim(),
        application.availableStartDate.trim(),
      ].filter(Boolean).length,
      5,
      !application.factoryName.trim()
        ? '缺少工厂名称'
        : !application.bossName.trim()
          ? '缺少老板名字'
          : !factoryWhatsAppValid
            ? '工厂 WhatsApp 格式不正确'
            : !application.address.trim()
              ? '缺少地址'
              : !application.availableStartDate.trim()
                ? '缺少可开始合作时间'
                : '已完整',
    ),
    buildCompletenessItem(
      'WORKERS',
      '人员信息',
      10,
      application.effectiveWorkerCount > 0 ? 1 : 0,
      1,
      application.effectiveWorkerCount > 0 ? '已完整' : '有效工人数量未填写或小于等于 0',
    ),
    buildCompletenessItem(
      'MACHINES',
      '机器信息',
      20,
      [
        application.machineTotalCount > 0 ? 'valid' : '',
        machines.length > 0 ? 'valid' : '',
        machineBaseCompleted >= machines.length && machines.length > 0 ? 'valid' : '',
      ].filter(Boolean).length,
      3,
      application.machineTotalCount <= 0
        ? '机器总数未填写或小于等于 0'
        : machines.length <= 0
          ? '缺少机器明细'
          : machineBaseCompleted < machines.length
            ? '存在机器名称、数量或状态未补全'
            : '已完整',
    ),
    buildCompletenessItem(
      'CAPABILITY',
      '工序工艺能力',
      20,
      capabilityCount > 0 ? 1 : 0,
      1,
      capabilityCount > 0 ? '已完整' : '至少需要选择一个工序工艺能力',
    ),
    buildCompletenessItem(
      'MACHINE_CAPABILITY_LINK',
      '机器与工序工艺关联',
      15,
      machines.length > 0 ? linkedCompleted : 0,
      Math.max(1, machines.length || 1),
      machines.length <= 0
        ? '暂无机器明细'
        : linkedCompleted >= machines.length
          ? '已完整'
          : '存在机器未关联已选工序工艺',
    ),
    buildCompletenessItem(
      'WHATSAPP_FORMAT',
      'WhatsApp 格式',
      5,
      factoryWhatsAppValid && adminWhatsAppValid ? 1 : 0,
      1,
      factoryWhatsAppValid && adminWhatsAppValid ? '已完整' : 'WhatsApp 格式不正确',
    ),
  ]

  const completenessScore = toRoundedScore(items.reduce((total, item) => total + item.score, 0))
  return {
    completenessScore,
    completenessLevel: getCompletenessLevel(completenessScore),
    completenessItems: items,
    completenessUpdatedAt: nowTimestamp(),
  }
}

export function getCompletenessMissingItems(application: Pick<
  FactoryOnboardingApplication,
  'completenessItems' | 'factoryName' | 'bossName' | 'whatsapp' | 'address' | 'machineTotalCount' | 'effectiveWorkerCount' | 'availableStartDate' | 'selectedCapabilities' | 'machines' | 'adminAccount'
>): FactoryOnboardingCompletenessItem[] {
  const items = application.completenessItems?.length
    ? application.completenessItems
    : calculateOnboardingCompleteness(application).completenessItems
  return items.filter((item) => !item.isCompleted)
}

function resolveFactoryTypeMatchCode(capability: FactoryOnboardingSelectedCapability): FactoryInferredTypeCode | null {
  if (capability.processCode === 'CUT_PANEL' || ['普通裁', '激光定位裁', '定向裁'].includes(capability.craftName)) return 'CUTTING_FACTORY'
  if (capability.processCode === 'PRINT') return 'PRINTING_FACTORY'
  if (capability.processCode === 'DYE') return 'DYEING_FACTORY'
  if (capability.processCode === 'POST_FINISHING' || ['质检', '复检', '包装', '熨烫'].includes(capability.craftName)) return 'POST_FINISHING_FACTORY'
  if (capability.processCode === 'SEW') return 'SEWING_FACTORY'
  if (capability.processCode === 'SPECIAL_CRAFT' || capability.processCode === 'EMBROIDERY' || capability.processCode === 'PLEATING' || SPECIAL_CRAFT_NAMES.has(capability.craftName)) {
    return 'SPECIAL_CRAFT_FACTORY'
  }
  return null
}

export function inferFactoryTypesFromCapabilities(selectedCapabilities: FactoryOnboardingSelectedCapability[]): FactoryTypeMatchResult[] {
  const grouped = new Map<FactoryInferredTypeCode, FactoryOnboardingSelectedCapability[]>()
  selectedCapabilities.forEach((capability) => {
    const code = resolveFactoryTypeMatchCode(capability)
    if (!code) return
    grouped.set(code, [...(grouped.get(code) || []), capability])
  })

  const total = Math.max(1, selectedCapabilities.length)
  return [...grouped.entries()].map(([factoryTypeCode, capabilities]) => ({
    factoryTypeCode,
    factoryTypeName: FACTORY_TYPE_LABEL_MAP[factoryTypeCode],
    confidence: Number((capabilities.length / total).toFixed(2)),
    matchedCapabilities: capabilities.map((item) => `${item.processName}/${item.craftName}`),
    reason: `匹配到 ${capabilities.map((item) => `${item.processName}/${item.craftName}`).join('、')}`,
  })).sort((left, right) => right.confidence - left.confidence)
}

export function getPrimaryFactoryType(matchResults: FactoryTypeMatchResult[]): FactoryInferredTypeCode {
  const uniqueCodes = [...new Set(matchResults.map((item) => item.factoryTypeCode).filter((code) => code !== 'MULTI_CAPABILITY_FACTORY'))]
  if (uniqueCodes.length >= 3) return 'MULTI_CAPABILITY_FACTORY'
  return matchResults[0]?.factoryTypeCode || 'CUTTING_FACTORY'
}

export function buildFactoryTypeMatchReason(matchResults: FactoryTypeMatchResult[]): string {
  if (matchResults.length <= 0) return '尚未选择可识别的工序工艺。'
  const primary = getPrimaryFactoryType(matchResults)
  if (primary === 'MULTI_CAPABILITY_FACTORY') {
    return `同时命中 ${matchResults.map((item) => item.factoryTypeName).join('、')}，已按全能力工厂处理。`
  }
  return matchResults.map((item) => `${item.factoryTypeName}：${item.matchedCapabilities.join('、')}`).join('；')
}

function mapInferredTypeToArchiveFactoryType(primaryFactoryType: FactoryInferredTypeCode): FactoryType {
  if (primaryFactoryType === 'PRINTING_FACTORY') return 'CENTRAL_PRINT'
  if (primaryFactoryType === 'DYEING_FACTORY') return 'CENTRAL_DYE'
  if (primaryFactoryType === 'SPECIAL_CRAFT_FACTORY') return 'CENTRAL_SPECIAL'
  if (primaryFactoryType === 'POST_FINISHING_FACTORY') return 'SATELLITE_FINISHING'
  if (primaryFactoryType === 'SEWING_FACTORY') return 'SATELLITE_SEWING'
  if (primaryFactoryType === 'MULTI_CAPABILITY_FACTORY') return 'CENTRAL_GARMENT'
  return 'CENTRAL_CUTTING'
}

function isEditableStatus(status: FactoryOnboardingStatus): boolean {
  return status === '草稿' || status === '退回补充资料'
}

function isSelectableCraft(processCode: string, craftCode: string): boolean {
  const craft = getActiveCraftOptionsByProcess(processCode).find((item) => item.craftCode === craftCode)
  if (!craft) return false
  return craft.isExternalTask || craft.isCapacityNode || processCode === 'POST_FINISHING'
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

function cloneMachine(item: FactoryOnboardingMachineAbility): FactoryOnboardingMachineAbility {
  return { ...item }
}

function getCapabilityKeySet(capabilities: FactoryOnboardingSelectedCapability[]): Set<string> {
  return new Set(capabilities.map((item) => `${item.processCode}:${item.craftCode}`))
}

export function getMachineValidationResult(
  machine: FactoryOnboardingMachineAbility,
  selectedCapabilities: FactoryOnboardingSelectedCapability[],
): { validationStatus: FactoryOnboardingMachineValidationStatus; validationMessage: string } {
  if (!machine.linkedProcessCode.trim()) {
    return { validationStatus: '未关联工序', validationMessage: '请选择机器关联工序' }
  }
  if (!machine.linkedCraftCode.trim()) {
    return { validationStatus: '未关联工艺', validationMessage: '请选择机器关联工艺' }
  }
  const capabilityKeySet = getCapabilityKeySet(selectedCapabilities)
  if (!capabilityKeySet.has(`${machine.linkedProcessCode}:${machine.linkedCraftCode}`)) {
    return {
      validationStatus: '工序工艺未在接单能力中选择',
      validationMessage: '该机器关联的工序工艺未在接单能力中选择，请先选择对应工序工艺',
    }
  }
  return { validationStatus: '通过', validationMessage: '校验通过' }
}

export function applyMachineValidation(
  machines: FactoryOnboardingMachineAbility[],
  selectedCapabilities: FactoryOnboardingSelectedCapability[],
): FactoryOnboardingMachineAbility[] {
  return machines.map((item) => {
    const machine = cloneMachine(item)
    const validation = getMachineValidationResult(machine, selectedCapabilities)
    machine.validationStatus = validation.validationStatus
    machine.validationMessage = validation.validationMessage
    return machine
  })
}

function hasBlockingMachineValidation(machines: FactoryOnboardingMachineAbility[]): boolean {
  return machines.some((item) => item.validationStatus !== '通过')
}

export function calculateNodeElapsedMinutes(nodeLog: Pick<FactoryOnboardingNodeLog, 'nodeStatus' | 'enteredAt' | 'leftAt'>, now = nowTimestamp()): number {
  if (nodeLog.nodeStatus === '未开始' || nodeLog.nodeStatus === '已终止') return 0
  const start = parseDateMs(nodeLog.enteredAt)
  const end = parseDateMs(nodeLog.leftAt || now)
  if (!start || !end || end <= start) return 0
  return Math.max(1, Math.floor((end - start) / 60000))
}

export function formatNodeElapsedText(minutes: number): string {
  if (!minutes || minutes <= 0) return '-'
  if (minutes < 60) return `${minutes}分钟`
  if (minutes < 60 * 24) {
    const hours = Math.floor(minutes / 60)
    const remainMinutes = minutes % 60
    return `${hours}小时${remainMinutes}分钟`
  }
  const days = Math.floor(minutes / (60 * 24))
  const remainHours = Math.floor((minutes % (60 * 24)) / 60)
  return `${days}天${remainHours}小时`
}

function buildNodeElapsedText(nodeLog: Pick<FactoryOnboardingNodeLog, 'nodeStatus' | 'enteredAt' | 'leftAt'>, now = nowTimestamp()): string {
  if (nodeLog.nodeStatus === '未开始') return '-'
  if (nodeLog.nodeStatus === '已终止') return '已终止'
  return formatNodeElapsedText(calculateNodeElapsedMinutes(nodeLog, now))
}

function buildCurrentFieldValueMap(application: FactoryOnboardingApplication): Record<FactoryOnboardingRequiredField, string> {
  return {
    工厂名称: application.factoryName || '未填写',
    老板名字: application.bossName || '未填写',
    WhatsApp: application.whatsapp || '未填写',
    地址: application.address || '未填写',
    有效工人数量: application.effectiveWorkerCount > 0 ? String(application.effectiveWorkerCount) : '未填写',
    机器总数: application.machineTotalCount > 0 ? String(application.machineTotalCount) : '未填写',
    机器明细: application.machines.length > 0
      ? application.machines.map((item) => `${item.machineName || '未命名设备'}×${item.machineCount || 0}`).join('、')
      : '未填写',
    工序工艺能力: application.selectedCapabilities.length > 0
      ? application.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、')
      : '未填写',
    可开始合作时间: application.availableStartDate || '未填写',
    管理员账号: application.adminAccount.loginId || '未填写',
  }
}

function buildApplicationNo(): string {
  return `FON-${Date.now()}`
}

function buildFactoryTempId(): string {
  return `FACTORY-TEMP-${Date.now()}`
}

function createNodeLog(
  nodeName: FactoryOnboardingNode,
  nodeStatus: FactoryOnboardingNodeStatus,
  enteredAt: string,
  operator: string,
  remark: string,
  leftAt?: string,
): FactoryOnboardingNodeLog {
  const base: FactoryOnboardingNodeLog = {
    nodeLogId: buildNodeLogId(nodeName, enteredAt),
    nodeName,
    nodeStatus,
    enteredAt,
    leftAt,
    elapsedMinutes: 0,
    elapsedText: '-',
    actionCount: 0,
    lastActionAt: enteredAt,
    operator,
    remark,
  }
  base.elapsedMinutes = calculateNodeElapsedMinutes(base, enteredAt)
  base.elapsedText = buildNodeElapsedText(base, enteredAt)
  return base
}

function refreshNodeLogDerived(
  nodeLog: FactoryOnboardingNodeLog,
  application: Pick<FactoryOnboardingApplication, 'actionLogs'>,
  now = nowTimestamp(),
): FactoryOnboardingNodeLog {
  const actionCount = application.actionLogs.filter((item) => item.nodeName === nodeLog.nodeName).length
  const lastActionAt = application.actionLogs
    .filter((item) => item.nodeName === nodeLog.nodeName)
    .sort((left, right) => parseDateMs(right.operatedAt) - parseDateMs(left.operatedAt))[0]?.operatedAt
  const next = {
    ...nodeLog,
    actionCount,
    lastActionAt: lastActionAt || nodeLog.lastActionAt || nodeLog.enteredAt,
  }
  next.elapsedMinutes = calculateNodeElapsedMinutes(next, now)
  next.elapsedText = buildNodeElapsedText(next, now)
  return next
}

function refreshApplicationDerived(application: FactoryOnboardingApplication, now = nowTimestamp()): FactoryOnboardingApplication {
  const matchResults = inferFactoryTypesFromCapabilities(application.selectedCapabilities)
  const primaryFactoryType = getPrimaryFactoryType(matchResults)
  const completeness = calculateOnboardingCompleteness(application)
  const next: FactoryOnboardingApplication = {
    ...application,
    machines: applyMachineValidation(application.machines, application.selectedCapabilities),
    completenessScore: completeness.completenessScore,
    completenessLevel: completeness.completenessLevel,
    completenessItems: completeness.completenessItems.map((item) => ({ ...item })),
    completenessUpdatedAt: now,
    inferredFactoryTypes: matchResults.map((item) => ({ ...item, matchedCapabilities: [...item.matchedCapabilities] })),
    primaryFactoryType,
    factoryTypeMatchedAt: now,
    factoryTypeMatchReason: buildFactoryTypeMatchReason(matchResults),
    nodeLogs: application.nodeLogs.map((item) => ({ ...item })),
    actionLogs: application.actionLogs.map((item) => ({ ...item })),
    reviewRecords: application.reviewRecords.map((item) => ({ ...item })),
    supplementRecords: application.supplementRecords.map((item) => ({ ...item, requiredFields: [...item.requiredFields], submittedFields: [...item.submittedFields] })),
    transferRecords: application.transferRecords.map((item) => ({ ...item })),
  }
  next.nodeLogs = next.nodeLogs.map((item) => refreshNodeLogDerived(item, next, now))
  return next
}

function cloneDraftPayload(payload: FactoryOnboardingDraftPayload): FactoryOnboardingDraftPayload {
  const normalizedFactoryWhatsApp = normalizeWhatsApp(payload.whatsapp.trim())
  const normalizedAdminWhatsApp = normalizeWhatsApp(payload.adminAccount.whatsapp.trim())
  const selectedCapabilities = payload.selectedCapabilities.map((item) => ({
    ...item,
    processName: item.processName || getProcessName(item.processCode),
    craftName: item.craftName || getCraftName(item.processCode, item.craftCode),
    abilityScope: 'CRAFT',
    canReceiveTask: item.canReceiveTask !== false,
    capacityManaged: item.capacityManaged !== false,
    remark: item.remark || '',
  }))

  const machines = applyMachineValidation(
    payload.machines.map((machine, index) => ({
      ...machine,
      machineId: machine.machineId || `MCH-DRAFT-${index + 1}`,
      machineName: machine.machineName.trim(),
      machineNo: machine.machineNo.trim(),
      machineCount: Number(machine.machineCount) || 0,
      linkedProcessCode: machine.linkedProcessCode || '',
      linkedProcessName: machine.linkedProcessName || getProcessName(machine.linkedProcessCode),
      linkedCraftCode: machine.linkedCraftCode || '',
      linkedCraftName: machine.linkedCraftName || getCraftName(machine.linkedProcessCode, machine.linkedCraftCode),
      condition: machine.condition || '可用',
      remark: machine.remark || '',
      validationStatus: machine.validationStatus || '未关联工序',
      validationMessage: machine.validationMessage || '',
    })),
    selectedCapabilities,
  )

  return {
    applicationId: payload.applicationId,
    applicationNo: payload.applicationNo,
    factoryTempId: payload.factoryTempId,
    factoryName: payload.factoryName.trim(),
    bossName: payload.bossName.trim(),
    whatsapp: normalizedFactoryWhatsApp,
    address: payload.address.trim(),
    machineTotalCount: Number(payload.machineTotalCount) || 0,
    effectiveWorkerCount: Number(payload.effectiveWorkerCount) || 0,
    availableStartDate: payload.availableStartDate.trim(),
    selectedCapabilities,
    machines,
    adminAccount: {
      ...payload.adminAccount,
      loginId: payload.adminAccount.loginId.trim(),
      password: payload.adminAccount.password.trim(),
      adminName: payload.adminAccount.adminName.trim(),
      whatsapp: normalizedAdminWhatsApp,
      roleId: payload.adminAccount.roleId || FACTORY_ADMIN_ROLE_ID,
      roleName: payload.adminAccount.roleName || FACTORY_ADMIN_ROLE_NAME,
      accountStatus: payload.adminAccount.accountStatus || '待激活',
    },
  }
}

function validateDraftIdentityForSave(payload: FactoryOnboardingDraftPayload, confirmPassword: string): void {
  if (payload.adminAccount.loginId.trim() && isFactoryOnboardingLoginIdTaken(payload.adminAccount.loginId, payload.applicationId)) {
    throw new Error('登录账户已存在')
  }
  if (payload.adminAccount.password.trim() && payload.adminAccount.password.trim().length < 6) {
    throw new Error('登录密码至少 6 位')
  }
  if (confirmPassword.trim() && payload.adminAccount.password.trim() !== confirmPassword.trim()) {
    throw new Error('两次输入的密码不一致')
  }
}

function validateAdminAccount(adminAccount: FactoryOnboardingAdminAccount, applicationId?: string): void {
  if (!adminAccount.loginId.trim()) throw new Error('请填写登录账户')
  if (isFactoryOnboardingLoginIdTaken(adminAccount.loginId, applicationId)) throw new Error('登录账户已存在')
  if (!adminAccount.password.trim()) throw new Error('请填写登录密码')
  if (adminAccount.password.trim().length < 6) throw new Error('登录密码至少 6 位')
}

export function validateFactoryOnboardingDraftPayload(payload: FactoryOnboardingDraftPayload, confirmPassword: string): void {
  validateAdminAccount(payload.adminAccount, payload.applicationId)
  if (!confirmPassword.trim()) throw new Error('请再次输入登录密码')
  if (payload.adminAccount.password.trim() !== confirmPassword.trim()) throw new Error('两次输入的密码不一致')
  if (!payload.adminAccount.adminName.trim()) throw new Error('请填写管理员姓名')
  if (!payload.adminAccount.whatsapp.trim()) throw new Error('请填写管理员 WhatsApp')
  if (!validateWhatsApp(payload.adminAccount.whatsapp).isValid) throw new Error('WhatsApp 格式不正确，请填写印尼手机号，例如 +6281234567890')

  if (!payload.factoryName.trim()) throw new Error('请填写工厂名称')
  if (!payload.bossName.trim()) throw new Error('请填写老板名字')
  if (!payload.whatsapp.trim()) throw new Error('请填写 WhatsApp')
  if (!validateWhatsApp(payload.whatsapp).isValid) throw new Error('WhatsApp 格式不正确，请填写印尼手机号，例如 +6281234567890')
  if (!payload.address.trim()) throw new Error('请填写地址')
  if (!payload.availableStartDate.trim()) throw new Error('请选择可开始合作时间')

  if (!payload.effectiveWorkerCount) throw new Error('请填写有效工人数量')
  if (payload.effectiveWorkerCount <= 0) throw new Error('有效工人数量必须大于 0')
  if (!payload.machineTotalCount) throw new Error('请填写机器总数')
  if (payload.machineTotalCount <= 0) throw new Error('机器总数必须大于 0')

  if (payload.selectedCapabilities.length <= 0) throw new Error('请至少选择一个工序工艺')
  payload.selectedCapabilities.forEach((item) => {
    if (!item.processCode || !item.craftCode) throw new Error('请选择工序下的具体工艺')
    if (!isSelectableCraft(item.processCode, item.craftCode)) {
      throw new Error('请选择工序下的具体工艺')
    }
  })

  if (payload.machines.length <= 0) throw new Error('请至少添加一条机器明细')

  payload.machines.forEach((machine) => {
    if (!machine.machineName.trim()) throw new Error('请填写机器名称')
    if (!machine.machineCount) throw new Error('请填写机器数量')
    if (machine.machineCount <= 0) throw new Error('机器数量必须大于 0')
  })

  const validatedMachines = applyMachineValidation(payload.machines, payload.selectedCapabilities)
  const firstInvalid = validatedMachines.find((item) => item.validationStatus !== '通过')
  if (firstInvalid) {
    throw new Error(firstInvalid.validationMessage)
  }
}

function buildApplicationFromPayload(
  payload: FactoryOnboardingDraftPayload,
  status: FactoryOnboardingStatus,
  currentNode: FactoryOnboardingNode,
): FactoryOnboardingApplication {
  const now = nowTimestamp()
  const normalized = cloneDraftPayload(payload)
  return refreshApplicationDerived({
    applicationId: payload.applicationId || `FOA-${Date.now()}`,
    applicationNo: payload.applicationNo || buildApplicationNo(),
    factoryTempId: payload.factoryTempId || buildFactoryTempId(),
    factoryName: normalized.factoryName,
    bossName: normalized.bossName,
    whatsapp: normalized.whatsapp,
    address: normalized.address,
    machineTotalCount: normalized.machineTotalCount,
    effectiveWorkerCount: normalized.effectiveWorkerCount,
    availableStartDate: normalized.availableStartDate,
    selectedCapabilities: normalized.selectedCapabilities,
    machines: normalized.machines,
    adminAccount: {
      ...normalized.adminAccount,
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: status === '已合作' ? '已转正式' : status === '已拒绝' ? '已停用' : '待转正式',
    },
    status,
    currentNode,
    submittedAt: undefined,
    reviewedAt: undefined,
    contractedAt: undefined,
    createdFactoryId: undefined,
    completenessScore: 0,
    completenessLevel: '不完整',
    completenessItems: [],
    completenessUpdatedAt: now,
    inferredFactoryTypes: [],
    primaryFactoryType: 'CUTTING_FACTORY',
    factoryTypeMatchedAt: now,
    factoryTypeMatchReason: '',
    nodeLogs: [createNodeLog(currentNode, '进行中', now, normalized.adminAccount.adminName || normalized.bossName, '创建入驻申请')],
    actionLogs: [],
    reviewRecords: [],
    supplementRecords: [],
    transferRecords: [],
  }, now)
}

function getLatestAction(application: FactoryOnboardingApplication, nodeName?: FactoryOnboardingNode): FactoryOnboardingActionLog | null {
  const actions = nodeName ? application.actionLogs.filter((item) => item.nodeName === nodeName) : application.actionLogs
  if (actions.length <= 0) return null
  return [...actions].sort((left, right) => parseDateMs(right.operatedAt) - parseDateMs(left.operatedAt))[0] || null
}

export function getCurrentNodeLog(application: FactoryOnboardingApplication): FactoryOnboardingNodeLog | null {
  const matched = application.nodeLogs
    .filter((item) => item.nodeName === application.currentNode)
    .sort((left, right) => parseDateMs(right.enteredAt) - parseDateMs(left.enteredAt))[0]
  return matched ? refreshNodeLogDerived(matched, application) : null
}

export function getNodeActionCount(application: FactoryOnboardingApplication, nodeName: FactoryOnboardingNode): number {
  return application.actionLogs.filter((item) => item.nodeName === nodeName).length
}

export function getCurrentNodeElapsedText(application: FactoryOnboardingApplication): string {
  return getCurrentNodeLog(application)?.elapsedText || '-'
}

export function updateNodeLogOnTransition(
  application: FactoryOnboardingApplication,
  fromNode: FactoryOnboardingNode,
  toNode: FactoryOnboardingNode,
  _actionName: FactoryOnboardingActionName,
  operator: string,
  options: TransitionOptions = {},
): FactoryOnboardingApplication {
  const now = options.now || nowTimestamp()
  const closingStatus = options.closingStatus || '已完成'
  const openingStatus = options.openingStatus || '进行中'
  const remark = options.remark || ''

  let fromClosed = false
  const nextNodeLogs = application.nodeLogs.map((item) => {
    if (!fromClosed && item.nodeName === fromNode && !item.leftAt) {
      fromClosed = true
      const next = {
        ...item,
        nodeStatus: closingStatus,
        leftAt: now,
        operator,
        remark: remark || item.remark,
      }
      next.elapsedMinutes = calculateNodeElapsedMinutes(next, now)
      next.elapsedText = buildNodeElapsedText(next, now)
      return next
    }
    return { ...item }
  })

  const openedNode = createNodeLog(toNode, openingStatus, now, operator, remark || `${toNode}开始`)
  if (openingStatus === '已终止' || openingStatus === '已完成') {
    openedNode.leftAt = now
    openedNode.elapsedMinutes = calculateNodeElapsedMinutes(openedNode, now)
    openedNode.elapsedText = buildNodeElapsedText(openedNode, now)
  }
  nextNodeLogs.push(openedNode)

  return refreshApplicationDerived(
    {
      ...application,
      currentNode: toNode,
      nodeLogs: nextNodeLogs,
    },
    now,
  )
}

function appendAction(
  application: FactoryOnboardingApplication,
  input: {
    actionName: FactoryOnboardingActionName
    nodeName: FactoryOnboardingNode
    operator: string
    operatedAt: string
    fromStatus: FactoryOnboardingStatus | '未提交'
    toStatus: FactoryOnboardingStatus | '未提交'
    fromNode: FactoryOnboardingNode | '未开始'
    toNode: FactoryOnboardingNode
    remark: string
  },
): FactoryOnboardingApplication {
  const actionSequenceInNode = application.actionLogs.filter((item) => item.nodeName === input.nodeName).length + 1
  return refreshApplicationDerived(
    {
      ...application,
      actionLogs: [
        ...application.actionLogs,
        {
          actionLogId: buildActionLogId(input.actionName, input.operatedAt),
          actionName: input.actionName,
          nodeName: input.nodeName,
          operator: input.operator,
          operatedAt: input.operatedAt,
          actionSequenceInNode,
          fromStatus: input.fromStatus,
          toStatus: input.toStatus,
          fromNode: input.fromNode,
          toNode: input.toNode,
          remark: input.remark,
        },
      ],
    },
    input.operatedAt,
  )
}

function getNextReviewRoundNo(application: FactoryOnboardingApplication): number {
  return (application.reviewRecords.reduce((max, item) => Math.max(max, item.reviewRoundNo), 0) || 0) + 1
}

function getNextSupplementRoundNo(application: FactoryOnboardingApplication): number {
  return (application.supplementRecords.reduce((max, item) => Math.max(max, item.supplementRoundNo), 0) || 0) + 1
}

function getPendingSupplementRecord(application: FactoryOnboardingApplication): FactoryOnboardingSupplementRecord | null {
  const records = application.supplementRecords.filter((item) => item.status === '待补充')
  if (records.length <= 0) return null
  return [...records].sort((left, right) => right.supplementRoundNo - left.supplementRoundNo)[0] || null
}

function buildStatusTipLabel(status: FactoryOnboardingStatus): string {
  const map: Record<FactoryOnboardingStatus, string> = {
    草稿: '当前工厂仍在填写入驻信息，请先完成入驻资料。',
    已提交待审核: '当前工厂入驻资料正在平台审核，暂不能进入业务页面。',
    退回补充资料: '当前工厂资料已被退回，请补充后重新提交。',
    已重新提交待审核: '当前工厂补充资料后已重新提交审核，暂不能进入业务页面。',
    审核通过待确认合作: '平台已审核通过，待确认合作后方可进入业务页面。',
    已拒绝: '当前工厂入驻申请已拒绝，暂不能进入业务页面。',
    已合作: '已生成正式管理员账号，请重新登录进入业务页面。',
  }
  return map[status]
}

export function saveFactoryOnboardingDraft(payload: FactoryOnboardingDraftPayload, confirmPassword: string): FactoryOnboardingApplication {
  const normalized = cloneDraftPayload(payload)
  validateDraftIdentityForSave(normalized, confirmPassword)
  const now = nowTimestamp()
  const operator = normalized.adminAccount.adminName || normalized.bossName || '工厂用户'
  const existing = normalized.applicationId ? getFactoryOnboardingApplicationById(normalized.applicationId) : null

  if (!existing) {
    let application = buildApplicationFromPayload(normalized, '草稿', '填写入驻信息')
    application = appendAction(application, {
      actionName: '保存草稿',
      nodeName: '填写入驻信息',
      operator,
      operatedAt: now,
      fromStatus: '未提交',
      toStatus: '草稿',
      fromNode: '未开始',
      toNode: '填写入驻信息',
      remark: '保存入驻草稿',
    })
    const saved = saveFactoryOnboardingApplication(application)
    setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
    clearPdaSession()
    return saved
  }

  if (!isEditableStatus(existing.status)) {
    return refreshApplicationDerived(existing)
  }

  let updated: FactoryOnboardingApplication = refreshApplicationDerived({
    ...existing,
    ...normalized,
    selectedCapabilities: normalized.selectedCapabilities,
    machines: normalized.machines,
    adminAccount: {
      ...normalized.adminAccount,
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: existing.status === '已拒绝' ? '已停用' : existing.status === '已合作' ? '已转正式' : '待转正式',
    },
  }, now)

  updated = appendAction(updated, {
    actionName: '保存草稿',
    nodeName: existing.currentNode,
    operator,
    operatedAt: now,
    fromStatus: existing.status,
    toStatus: existing.status,
    fromNode: existing.currentNode,
    toNode: existing.currentNode,
    remark: existing.currentNode === '补充资料' ? '补充资料暂存' : '更新入驻草稿',
  })

  const saved = saveFactoryOnboardingApplication(updated)
  setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
  clearPdaSession()
  return saved
}

export function submitFactoryOnboardingApplication(payload: FactoryOnboardingDraftPayload, confirmPassword: string): FactoryOnboardingApplication {
  const normalized = cloneDraftPayload(payload)
  if (normalized.applicationId) {
    const completeness = calculateOnboardingCompleteness(normalized)
    if (completeness.completenessScore < COMPLETENESS_SUBMIT_THRESHOLD) {
      throw new Error(`资料完整性不足 ${COMPLETENESS_SUBMIT_THRESHOLD} 分，请先补充必填信息后再提交。`)
    }
  }
  validateFactoryOnboardingDraftPayload(normalized, confirmPassword)
  const now = nowTimestamp()
  const operator = normalized.adminAccount.adminName || normalized.bossName || '工厂用户'
  const existing = normalized.applicationId ? getFactoryOnboardingApplicationById(normalized.applicationId) : null
  const isResubmit = existing?.status === '退回补充资料'

  let application = existing
    ? refreshApplicationDerived({
        ...existing,
        ...normalized,
        selectedCapabilities: normalized.selectedCapabilities,
        machines: normalized.machines,
        adminAccount: {
          ...normalized.adminAccount,
          roleId: FACTORY_ADMIN_ROLE_ID,
          roleName: FACTORY_ADMIN_ROLE_NAME,
          accountStatus: '待转正式',
        },
      }, now)
    : buildApplicationFromPayload(normalized, '草稿', '填写入驻信息')

  if (application.completenessScore < COMPLETENESS_SUBMIT_THRESHOLD) {
    throw new Error(`资料完整性不足 ${COMPLETENESS_SUBMIT_THRESHOLD} 分，请先补充必填信息后再提交。`)
  }

  const fromStatus = existing?.status || '未提交'
  const fromNode = existing?.currentNode || '填写入驻信息'
  const toStatus: FactoryOnboardingStatus = isResubmit ? '已重新提交待审核' : '已提交待审核'

  application = appendAction(application, {
    actionName: isResubmit ? '工厂重新提交' : '提交入驻申请',
    nodeName: '平台审核',
    operator,
    operatedAt: now,
    fromStatus,
    toStatus,
    fromNode,
    toNode: '平台审核',
    remark: isResubmit ? '补充资料后重新提交平台审核' : '首次提交平台审核',
  })
  application = updateNodeLogOnTransition(application, fromNode, '平台审核', isResubmit ? '工厂重新提交' : '提交入驻申请', operator, {
    now,
    closingStatus: '已完成',
    openingStatus: '进行中',
    remark: isResubmit ? '已重新提交，等待平台复审' : '等待平台审核',
  })

  if (isResubmit) {
    const pending = getPendingSupplementRecord(application)
    if (pending) {
      const submittedFields = unique([...pending.requiredFields])
      application = {
        ...application,
        supplementRecords: application.supplementRecords.map((item) =>
          item.supplementId === pending.supplementId
            ? {
                ...item,
                status: '已重新提交',
                submittedAt: now,
                submittedBy: operator,
                submittedFields,
              }
            : item,
        ),
      }
    }
  }

  application = refreshApplicationDerived(
    {
      ...application,
      status: toStatus,
      currentNode: '平台审核',
      submittedAt: now,
    },
    now,
  )

  const saved = saveFactoryOnboardingApplication(application)
  setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
  clearPdaSession()
  return saved
}

export function authenticateFactoryOnboardingAdmin(loginId: string, password: string): FactoryOnboardingApplication | null {
  const application = findFactoryOnboardingApplicationByLoginId(loginId)
  if (!application) return null
  if (normalizeLoginId(application.adminAccount.loginId) !== normalizeLoginId(loginId)) return null
  if (application.adminAccount.password.trim() !== password.trim()) return null
  return refreshApplicationDerived(application)
}

export function getFactoryOnboardingCurrentNodeSummary(application: FactoryOnboardingApplication): FactoryOnboardingNodeSummary {
  const currentNodeLog = getCurrentNodeLog(application)
  const lastAction = getLatestAction(application, application.currentNode) || getLatestAction(application)
  const actionCount = getNodeActionCount(application, application.currentNode)
  return {
    currentNode: application.currentNode,
    currentStatusLabel: application.status,
    currentNodeStatus: currentNodeLog?.nodeStatus || '未开始',
    elapsedText: currentNodeLog?.elapsedText || '-',
    actionCountText: `第${Math.max(1, actionCount || 1)}次动作`,
    actionCount,
    lastOperatedAt: lastAction?.operatedAt || currentNodeLog?.lastActionAt || currentNodeLog?.enteredAt || '—',
    lastActionName: lastAction?.actionName || '尚未操作',
  }
}

export function getPdaCurrentAuthSession(): PdaPostLoginSession | null {
  const pdaSession = getPdaSession()
  if (pdaSession) {
    return { kind: 'PDA', session: pdaSession }
  }

  const applicantSession = getFactoryOnboardingApplicantSession()
  if (!applicantSession) return null
  const application = getFactoryOnboardingApplicationById(applicantSession.applicationId)
  if (!application) return null
  return { kind: 'ONBOARDING', session: applicantSession, application: refreshApplicationDerived(application) }
}

export function buildPdaAuthLoginPath(returnTo?: string): string {
  return buildQueryPath('/fcs/pda/auth/login', { returnTo })
}

export function buildPdaAuthOnboardingPath(returnTo?: string, applicationId?: string): string {
  return buildQueryPath('/fcs/pda/auth/onboarding', { returnTo, applicationId })
}

export function resolvePdaPostLoginRoute(session: PdaPostLoginSession | null, returnTo?: string): string {
  if (!session) return buildPdaAuthLoginPath(returnTo)
  if (session.kind === 'PDA') return returnTo?.trim() || '/fcs/pda/exec'
  if (session.application.status === '已合作') return returnTo?.trim() || '/fcs/pda/exec'
  return buildPdaAuthOnboardingPath(returnTo, session.application.applicationId)
}

export function getPdaFactoryAccessState(): PdaFactoryAccessState {
  const session = getPdaCurrentAuthSession()
  if (!session) {
    return {
      isLoggedIn: false,
      canAccessBusiness: false,
      isCooperatedFactory: false,
      reasonCode: 'UNAUTHENTICATED',
      reasonLabel: '未登录，请先进入登录页',
      sessionKind: 'NONE',
      route: buildPdaAuthLoginPath(),
      onboardingApplication: null,
      applicantSession: null,
      pdaSession: null,
    }
  }

  if (session.kind === 'PDA') {
    return {
      isLoggedIn: true,
      canAccessBusiness: true,
      isCooperatedFactory: true,
      reasonCode: 'COOPERATED',
      reasonLabel: '已合作工厂，可进入业务页面',
      sessionKind: 'PDA',
      route: '/fcs/pda/exec',
      onboardingApplication: null,
      applicantSession: null,
      pdaSession: session.session,
    }
  }

  const application = session.application
  return {
    isLoggedIn: true,
    canAccessBusiness: false,
    isCooperatedFactory: false,
    reasonCode:
      application.status === '草稿'
        ? 'DRAFT'
        : application.status === '退回补充资料'
          ? 'SUPPLEMENT_REQUIRED'
          : application.status === '审核通过待确认合作'
            ? 'WAITING_COOPERATION'
            : application.status === '已拒绝'
              ? 'REJECTED'
              : application.status === '已合作'
                ? 'RELOGIN_REQUIRED'
                : 'UNDER_REVIEW',
    reasonLabel: buildStatusTipLabel(application.status),
    sessionKind: 'ONBOARDING',
    route: application.status === '已合作' ? buildPdaAuthLoginPath('/fcs/pda/exec') : buildPdaAuthOnboardingPath(undefined, application.applicationId),
    onboardingApplication: application,
    applicantSession: session.session,
    pdaSession: null,
  }
}

export function ensurePdaAccessForRoute(targetRoute: string): { allowed: boolean; redirectPath?: string; reasonLabel?: string } {
  if (targetRoute.startsWith('/fcs/pda/auth/login') || targetRoute.startsWith('/fcs/pda/auth/onboarding')) {
    return { allowed: true }
  }

  const accessState = getPdaFactoryAccessState()
  if (accessState.canAccessBusiness) return { allowed: true }

  const returnTo = targetRoute || '/fcs/pda/exec'
  if (!accessState.isLoggedIn) {
    return { allowed: false, redirectPath: buildPdaAuthLoginPath(returnTo), reasonLabel: accessState.reasonLabel }
  }

  if (accessState.reasonCode === 'RELOGIN_REQUIRED') {
    clearFactoryOnboardingApplicantSession()
    return { allowed: false, redirectPath: buildPdaAuthLoginPath(returnTo), reasonLabel: accessState.reasonLabel }
  }

  return {
    allowed: false,
    redirectPath: buildPdaAuthOnboardingPath(returnTo, accessState.onboardingApplication?.applicationId),
    reasonLabel: accessState.reasonLabel,
  }
}

export function getPdaOnboardingApplicationFromSession(): FactoryOnboardingApplication | null {
  return getPdaFactoryAccessState().onboardingApplication
}

export function createPdaOnboardingSessionFromApplication(application: FactoryOnboardingApplication): FactoryOnboardingApplicantSession {
  return createFactoryOnboardingApplicantSession(application)
}

export function activateOnboardingSession(application: FactoryOnboardingApplication): void {
  setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(application))
  clearPdaSession()
}

export function logoutPdaAccess(): void {
  clearPdaSession()
  clearFactoryOnboardingApplicantSession()
}

export function listFactoryOnboardingStatusBuckets() {
  const applications = listFactoryOnboardingApplications().map((item) => refreshApplicationDerived(item))
  return {
    待审核: applications.filter((item) => item.status === '已提交待审核' || item.status === '已重新提交待审核').length,
    退回补充: applications.filter((item) => item.status === '退回补充资料').length,
    待确认合作: applications.filter((item) => item.status === '审核通过待确认合作').length,
    已合作: applications.filter((item) => item.status === '已合作').length,
    已拒绝: applications.filter((item) => item.status === '已拒绝').length,
  }
}

function buildFactoryTypeFromCapabilities(capabilities: FactoryOnboardingSelectedCapability[]): FactoryType {
  const processCode = capabilities[0]?.processCode
  if (processCode === 'PRINT') return 'CENTRAL_PRINT'
  if (processCode === 'DYE') return 'CENTRAL_DYE'
  if (processCode === 'SPECIAL_CRAFT') return 'CENTRAL_SPECIAL'
  if (processCode === 'POST_FINISHING') return 'SATELLITE_FINISHING'
  return 'CENTRAL_CUTTING'
}

function buildFactoryProcessAbilities(capabilities: FactoryOnboardingSelectedCapability[]): FactoryProcessAbility[] {
  const grouped = new Map<string, FactoryProcessAbility>()
  capabilities.forEach((item) => {
    const existing = grouped.get(item.processCode)
    if (existing) {
      if (!existing.craftCodes.includes(item.craftCode)) existing.craftCodes.push(item.craftCode)
      existing.craftNames = unique([...(existing.craftNames || []), item.craftName])
      return
    }

    grouped.set(item.processCode, {
      processCode: item.processCode,
      processName: item.processName,
      craftCodes: [item.craftCode],
      craftNames: [item.craftName],
      abilityScope: 'CRAFT',
      canReceiveTask: item.canReceiveTask,
      capacityManaged: item.capacityManaged,
      status: 'ACTIVE',
      abilityName: `${item.processName} / ${item.craftName}`,
    })
  })
  return [...grouped.values()]
}

function buildFactoryArchiveFromOnboarding(application: FactoryOnboardingApplication, factoryId: string): Factory {
  const now = nowTimestamp()
  const existing = application.createdFactoryId ? getFactoryMasterRecordById(application.createdFactoryId) : null
  return {
    id: existing?.id || factoryId,
    code: existing?.code || generateFactoryCode(),
    name: application.factoryName,
    address: application.address,
    contact: application.bossName,
    phone: application.whatsapp,
    status: 'active',
    cooperationMode: 'general',
    processAbilities: buildFactoryProcessAbilities(application.selectedCapabilities),
    qualityScore: existing?.qualityScore ?? 92,
    deliveryScore: existing?.deliveryScore ?? 91,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    factoryTier: 'CENTRAL',
    factoryType: existing?.factoryType ?? mapInferredTypeToArchiveFactoryType(application.primaryFactoryType),
    parentFactoryId: existing?.parentFactoryId,
    pdaEnabled: true,
    pdaTenantId: existing?.pdaTenantId || factoryId,
    isTestFactory: existing?.isTestFactory,
    testFactoryScope: existing?.testFactoryScope,
    primaryFactoryType: application.primaryFactoryType,
    inferredFactoryTypes: application.inferredFactoryTypes.map((item) => ({ ...item, matchedCapabilities: [...item.matchedCapabilities] })),
    factoryTypeMatchedAt: application.factoryTypeMatchedAt,
    factoryTypeMatchReason: application.factoryTypeMatchReason,
    eligibility: {
      allowDispatch: true,
      allowBid: true,
      allowExecute: true,
      allowSettle: true,
    },
  }
}

export function reviewFactoryOnboardingApplication(input: ReviewApplicationInput): FactoryOnboardingApplication {
  const { applicationId, reviewResult, reviewOpinion, reviewer } = input
  const requiredFields = unique((input.requiredFields || []).filter((item): item is FactoryOnboardingRequiredField => FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS.includes(item)))
  if (!reviewOpinion.trim()) throw new Error('请填写审核意见')
  if (reviewResult === '不通过且允许再次提交' && requiredFields.length <= 0) {
    throw new Error('请至少选择一个需补充字段')
  }

  const application = getFactoryOnboardingApplicationById(applicationId)
  if (!application) throw new Error('未找到入驻申请')
  if (!(application.status === '已提交待审核' || application.status === '已重新提交待审核')) {
    throw new Error('当前状态不可审核')
  }

  const now = nowTimestamp()
  const fromStatus = application.status
  const fromNode = application.currentNode
  let toStatus: FactoryOnboardingStatus
  let toNode: FactoryOnboardingNode
  let openingNodeStatus: FactoryOnboardingNodeStatus = '进行中'
  let actionName: FactoryOnboardingActionName

  if (reviewResult === '通过') {
    toStatus = '审核通过待确认合作'
    toNode = '确认合作'
    actionName = '平台审核通过'
  } else if (reviewResult === '不通过且允许再次提交') {
    toStatus = '退回补充资料'
    toNode = '补充资料'
    openingNodeStatus = '进行中'
    actionName = '平台退回补充资料'
  } else {
    toStatus = '已拒绝'
    toNode = '完成'
    openingNodeStatus = '已终止'
    actionName = '平台拒绝入驻'
  }

  let updated = appendAction(refreshApplicationDerived(application, now), {
    actionName,
    nodeName: toNode,
    operator: reviewer.trim(),
    operatedAt: now,
    fromStatus,
    toStatus,
    fromNode,
    toNode,
    remark: reviewOpinion.trim(),
  })
  updated = updateNodeLogOnTransition(updated, fromNode, toNode, actionName, reviewer.trim(), {
    now,
    closingStatus: reviewResult === '不通过且允许再次提交' ? '已退回' : reviewResult === '通过' ? '已完成' : '已终止',
    openingStatus: openingNodeStatus,
    remark:
      reviewResult === '通过'
        ? '平台审核通过，等待确认合作'
        : reviewResult === '不通过且允许再次提交'
          ? '平台已退回补充资料'
          : '平台已拒绝入驻申请',
  })

  const reviewId = `REV-${Date.now()}`
  const nextReviewRecord: FactoryOnboardingReviewRecord = {
    reviewId,
    reviewRoundNo: getNextReviewRoundNo(updated),
    reviewResult,
    reviewOpinion: reviewOpinion.trim(),
    allowResubmit: reviewResult === '不通过且允许再次提交',
    reviewer: reviewer.trim(),
    reviewedAt: now,
    fromStatus,
    toStatus,
    fromNode,
    toNode,
  }

  const supplementRecords = reviewResult === '不通过且允许再次提交'
    ? [
        ...updated.supplementRecords,
        {
          supplementId: `SUP-${Date.now()}`,
          supplementRoundNo: getNextSupplementRoundNo(updated),
          supplementReason: reviewOpinion.trim(),
          requiredFields,
          submittedFields: [],
          submittedAt: undefined,
          submittedBy: undefined,
          relatedReviewId: reviewId,
          status: '待补充',
        } satisfies FactoryOnboardingSupplementRecord,
      ]
    : updated.supplementRecords

  updated = refreshApplicationDerived(
    {
      ...updated,
      status: toStatus,
      currentNode: toNode,
      reviewedAt: now,
      reviewRecords: [...updated.reviewRecords, nextReviewRecord],
      supplementRecords,
      adminAccount: {
        ...updated.adminAccount,
        accountStatus: toStatus === '已拒绝' ? '已停用' : updated.adminAccount.accountStatus,
      },
    },
    now,
  )

  const saved = saveFactoryOnboardingApplication(updated)
  const applicantSession = getFactoryOnboardingApplicantSession()
  if (applicantSession?.applicationId === saved.applicationId) {
    setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
  }
  return saved
}

export async function confirmFactoryOnboardingCooperation(input: { applicationId: string; operator: string }): Promise<FactoryOnboardingApplication> {
  const application = getFactoryOnboardingApplicationById(input.applicationId)
  if (!application) throw new Error('未找到入驻申请')
  if (application.status !== '审核通过待确认合作') throw new Error('当前状态不可确认合作')

  const now = nowTimestamp()
  const operator = input.operator.trim() || '平台运营经理'
  const factoryId = application.createdFactoryId || `FACTORY-${Date.now()}`

  let updated = appendAction(refreshApplicationDerived(application, now), {
    actionName: '平台确认合作',
    nodeName: '确认合作',
    operator,
    operatedAt: now,
    fromStatus: application.status,
    toStatus: application.status,
    fromNode: '确认合作',
    toNode: '生成工厂档案',
    remark: '确认合作并开始生成工厂档案',
  })
  updated = updateNodeLogOnTransition(updated, '确认合作', '生成工厂档案', '平台确认合作', operator, {
    now,
    closingStatus: '已完成',
    openingStatus: '进行中',
    remark: '开始生成工厂档案与正式管理员账号',
  })

  const archive = buildFactoryArchiveFromOnboarding(updated, factoryId)
  upsertFactoryMasterRecord(archive)
  replaceFactoryPdaRoles(archive.id, generatePresetRolesForFactory(archive.id, now))

  updated = appendAction(updated, {
    actionName: '生成工厂档案',
    nodeName: '生成工厂档案',
    operator,
    operatedAt: now,
    fromStatus: '审核通过待确认合作',
    toStatus: '已合作',
    fromNode: '生成工厂档案',
    toNode: '生成工厂档案',
    remark: `已生成工厂档案 ${archive.id}`,
  })

  const existingUser = findFactoryPdaUserByLoginId(updated.adminAccount.loginId)
  const user = existingUser ?? await createFactoryPdaUser({
    factoryId: archive.id,
    name: updated.adminAccount.adminName,
    loginId: updated.adminAccount.loginId,
    password: updated.adminAccount.password,
    roleId: 'ROLE_ADMIN',
    createdBy: operator,
  })

  const capacityProfile = createInitialCapacityProfileFromOnboarding(updated, archive)

  updated = appendAction(updated, {
    actionName: '管理员账号转正',
    nodeName: '生成工厂档案',
    operator,
    operatedAt: now,
    fromStatus: '审核通过待确认合作',
    toStatus: '已合作',
    fromNode: '生成工厂档案',
    toNode: '完成',
    remark: `管理员账号 ${user.loginId} 已转正式`,
  })
  updated = updateNodeLogOnTransition(updated, '生成工厂档案', '完成', '管理员账号转正', operator, {
    now,
    closingStatus: '已完成',
    openingStatus: '已完成',
    remark: '已合作完成',
  })

  updated = refreshApplicationDerived(
    {
      ...updated,
      status: '已合作',
      currentNode: '完成',
      contractedAt: now,
      createdFactoryId: archive.id,
      adminAccount: {
        ...updated.adminAccount,
        roleId: FACTORY_ADMIN_ROLE_ID,
        roleName: FACTORY_ADMIN_ROLE_NAME,
        accountStatus: '已转正式',
      },
      transferRecords: [
        ...updated.transferRecords,
        {
          transferId: `TR-${Date.now()}`,
          factoryProfileGenerated: true,
          factoryProfileId: archive.id,
          adminAccountGenerated: true,
          capacityProfileGenerated: true,
          capacityProfileId: capacityProfile.capacityProfileId,
          operator,
          operatedAt: now,
          remark: `已生成正式管理员账号 ${user.loginId}，并初始化产能档案 ${capacityProfile.capacityProfileId}`,
        },
      ],
    },
    now,
  )

  const saved = saveFactoryOnboardingApplication(updated)
  clearFactoryOnboardingApplicantSession()
  clearPdaSession()
  return saved
}

export function createDefaultMachineDraft(seed: number): FactoryOnboardingMachineAbility {
  return {
    machineId: `MCH-DRAFT-${seed}`,
    machineName: '',
    machineNo: '',
    machineCount: 1,
    linkedProcessCode: '',
    linkedProcessName: '',
    linkedCraftCode: '',
    linkedCraftName: '',
    condition: '可用',
    remark: '',
    validationStatus: '未关联工序',
    validationMessage: '请选择机器关联工序',
  }
}

export function createDefaultOnboardingDraft(): FactoryOnboardingDraftPayload {
  return createEmptyFactoryOnboardingDraft()
}

export function createCapabilityFromSelection(processCode: string, craftCode: string): FactoryOnboardingSelectedCapability | null {
  if (!processCode || !craftCode) return null
  const processName = getProcessName(processCode)
  const craftName = getCraftName(processCode, craftCode)
  if (!processName || !craftName || !isSelectableCraft(processCode, craftCode)) return null
  return {
    processCode,
    processName,
    craftCode,
    craftName,
    abilityScope: 'CRAFT',
    canReceiveTask: true,
    capacityManaged: true,
    remark: '',
  }
}

export function listSelectableProcessCraftOptions() {
  return getActiveProcessOptions()
    .map((process) => ({
      processCode: process.processCode,
      processName: process.processName,
      crafts: getActiveCraftOptionsByProcess(process.processCode)
        .filter((craft) => isSelectableCraft(process.processCode, craft.craftCode))
        .map((craft) => ({
          processCode: process.processCode,
          processName: process.processName,
          craftCode: craft.craftCode,
          craftName: craft.craftName,
        })),
    }))
    .filter((item) => item.crafts.length > 0)
}

export function getOnboardingStatusActionLabel(application: FactoryOnboardingApplication | null): string {
  if (!application) return '提交入驻申请'
  if (application.status === '退回补充资料') return '重新提交入驻申请'
  if (application.status === '草稿') return '提交入驻申请'
  return '查看入驻进度'
}

export function canEditOnboardingApplication(application: FactoryOnboardingApplication | null): boolean {
  if (!application) return true
  return isEditableStatus(application.status)
}

export function canSubmitOnboardingApplication(application: FactoryOnboardingApplication | null): boolean {
  if (!application) return true
  return isEditableStatus(application.status)
}

export function getOnboardingStatusTip(application: FactoryOnboardingApplication | null): string {
  if (!application) return '请补全入驻信息后提交平台审核。'
  const map: Record<FactoryOnboardingStatus, string> = {
    草稿: '请补全入驻信息后提交平台审核。',
    已提交待审核: '入驻申请已提交，请等待平台审核。',
    退回补充资料: '平台已退回资料，请按审核意见补充后重新提交。',
    已重新提交待审核: '补充资料已提交，请等待平台重新审核。',
    审核通过待确认合作: '平台审核已通过，请等待平台确认合作。',
    已拒绝: '入驻申请未通过，当前不可再次提交。',
    已合作: '已成为合作工厂，可以进入业务页面。',
  }
  return map[application.status]
}

export function getLatestReviewRecord(application: FactoryOnboardingApplication | null): FactoryOnboardingReviewRecord | null {
  if (!application || application.reviewRecords.length <= 0) return null
  return [...application.reviewRecords].sort((left, right) => parseDateMs(right.reviewedAt) - parseDateMs(left.reviewedAt))[0] || null
}

export function getLatestSupplementRecord(application: FactoryOnboardingApplication | null): FactoryOnboardingSupplementRecord | null {
  if (!application || application.supplementRecords.length <= 0) return null
  return [...application.supplementRecords].sort((left, right) => right.supplementRoundNo - left.supplementRoundNo)[0] || null
}

export function listCurrentFieldValues(application: FactoryOnboardingApplication | null): Array<{ field: FactoryOnboardingRequiredField; value: string }> {
  if (!application) return []
  const fieldMap = buildCurrentFieldValueMap(application)
  return FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS.map((field) => ({ field, value: fieldMap[field] }))
}
