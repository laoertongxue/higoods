import {
  getBrowserLocalStorage,
  readBrowserStorageItem,
  removeBrowserStorageItem,
  writeBrowserStorageItem,
} from '../browser-storage.ts'
import { listFactoryMasterRecords } from './factory-master-store.ts'
import { createInitialCapacityProfileFromOnboarding } from './factory-capacity-profile-mock.ts'
import { findFactoryPdaUserByLoginId } from './store-domain-pda.ts'
import {
  FACTORY_ADMIN_ROLE_ID,
  FACTORY_ADMIN_ROLE_NAME,
  type FactoryOnboardingActionLog,
  type FactoryOnboardingActionName,
  type FactoryOnboardingAdminAccount,
  type FactoryOnboardingApplicantSession,
  type FactoryOnboardingApplication,
  type FactoryOnboardingCompletenessItem,
  type FactoryOnboardingDraftPayload,
  type FactoryInferredTypeCode,
  type FactoryOnboardingMachineAbility,
  type FactoryOnboardingMachineValidationStatus,
  type FactoryOnboardingNode,
  type FactoryOnboardingNodeLog,
  type FactoryOnboardingNodeStatus,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingReviewRecord,
  type FactoryOnboardingSelectedCapability,
  type FactoryOnboardingStatus,
  type FactoryOnboardingSupplementRecord,
  type FactoryOnboardingSupplementStatus,
  type FactoryOnboardingTransferRecord,
  type FactoryTypeMatchResult,
} from './factory-onboarding-domain.ts'
import { getActiveCraftOptionsByProcess, getActiveProcessOptions } from './process-craft-dict.ts'
import { normalizeWhatsApp, validateWhatsApp } from './whatsapp-validator.ts'

const APPLICATION_STORE_KEY = 'fcs_factory_onboarding_store_v4'
const APPLICANT_SESSION_KEY = 'fcs_factory_onboarding_session_v1'

let cachedApplications: FactoryOnboardingApplication[] | null = null

function nowTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function getStorage(): Storage | null {
  const storage = getBrowserLocalStorage()
  if (!storage || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
    return null
  }
  return storage as Storage
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

function cloneAdminAccount(account: FactoryOnboardingAdminAccount): FactoryOnboardingAdminAccount {
  return { ...account }
}

function cloneCapability(item: FactoryOnboardingSelectedCapability): FactoryOnboardingSelectedCapability {
  return { ...item }
}

function cloneMachine(item: FactoryOnboardingMachineAbility): FactoryOnboardingMachineAbility {
  return { ...item }
}

function cloneNodeLog(item: FactoryOnboardingNodeLog): FactoryOnboardingNodeLog {
  return { ...item }
}

function cloneActionLog(item: FactoryOnboardingActionLog): FactoryOnboardingActionLog {
  return { ...item }
}

function cloneReviewRecord(item: FactoryOnboardingReviewRecord): FactoryOnboardingReviewRecord {
  return { ...item }
}

function cloneSupplementRecord(item: FactoryOnboardingSupplementRecord): FactoryOnboardingSupplementRecord {
  return {
    ...item,
    requiredFields: [...item.requiredFields],
    submittedFields: [...item.submittedFields],
  }
}

function cloneTransferRecord(item: FactoryOnboardingTransferRecord): FactoryOnboardingTransferRecord {
  return { ...item }
}

function cloneApplication(application: FactoryOnboardingApplication): FactoryOnboardingApplication {
  return {
    ...application,
    completenessItems: application.completenessItems.map((item) => ({ ...item })),
    inferredFactoryTypes: application.inferredFactoryTypes.map((item) => ({ ...item, matchedCapabilities: [...item.matchedCapabilities] })),
    adminAccount: cloneAdminAccount(application.adminAccount),
    selectedCapabilities: application.selectedCapabilities.map(cloneCapability),
    machines: application.machines.map(cloneMachine),
    nodeLogs: application.nodeLogs.map(cloneNodeLog),
    actionLogs: application.actionLogs.map(cloneActionLog),
    reviewRecords: application.reviewRecords.map(cloneReviewRecord),
    supplementRecords: application.supplementRecords.map(cloneSupplementRecord),
    transferRecords: application.transferRecords.map(cloneTransferRecord),
  }
}

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase()
}

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

function getCompletenessLevel(score: number): FactoryOnboardingApplication['completenessLevel'] {
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
  const score = totalCount <= 0 ? 0 : Math.round(weight * (completedCount / totalCount))
  return {
    itemCode,
    itemName,
    weight,
    isCompleted: completedCount >= totalCount,
    score,
    missingReason,
  }
}

function getCapabilityKeySet(capabilities: FactoryOnboardingSelectedCapability[]): Set<string> {
  return new Set(capabilities.map((item) => `${item.processCode}:${item.craftCode}`))
}

function resolveFactoryTypeCode(capability: FactoryOnboardingSelectedCapability): FactoryInferredTypeCode | null {
  if (capability.processCode === 'CUT_PANEL' || ['普通裁', '激光定位裁', '定向裁'].includes(capability.craftName)) return 'CUTTING_FACTORY'
  if (capability.processCode === 'PRINT') return 'PRINTING_FACTORY'
  if (capability.processCode === 'DYE') return 'DYEING_FACTORY'
  if (capability.processCode === 'POST_FINISHING' || ['质检', '复检', '包装', '熨烫'].includes(capability.craftName)) return 'POST_FINISHING_FACTORY'
  if (capability.processCode === 'SEW') return 'SEWING_FACTORY'
  if (capability.processCode === 'SPECIAL_CRAFT' || capability.processCode === 'EMBROIDERY' || capability.processCode === 'PLEATING' || SPECIAL_CRAFT_NAMES.has(capability.craftName)) return 'SPECIAL_CRAFT_FACTORY'
  return null
}

function inferFactoryTypes(capabilities: FactoryOnboardingSelectedCapability[]): FactoryTypeMatchResult[] {
  const grouped = new Map<FactoryInferredTypeCode, FactoryOnboardingSelectedCapability[]>()
  capabilities.forEach((item) => {
    const code = resolveFactoryTypeCode(item)
    if (!code) return
    grouped.set(code, [...(grouped.get(code) || []), item])
  })
  const total = Math.max(1, capabilities.length)
  return [...grouped.entries()].map(([factoryTypeCode, matched]) => ({
    factoryTypeCode,
    factoryTypeName: FACTORY_TYPE_LABEL_MAP[factoryTypeCode],
    confidence: Number((matched.length / total).toFixed(2)),
    matchedCapabilities: matched.map((item) => `${item.processName}/${item.craftName}`),
    reason: `匹配到 ${matched.map((item) => `${item.processName}/${item.craftName}`).join('、')}`,
  }))
}

function getPrimaryFactoryType(matchResults: FactoryTypeMatchResult[]): FactoryInferredTypeCode {
  const codes = [...new Set(matchResults.map((item) => item.factoryTypeCode))]
  if (codes.length >= 3) return 'MULTI_CAPABILITY_FACTORY'
  return matchResults[0]?.factoryTypeCode || 'CUTTING_FACTORY'
}

function buildFactoryTypeMatchReason(matchResults: FactoryTypeMatchResult[]): string {
  if (matchResults.length <= 0) return '尚未选择可识别的工序工艺。'
  const primary = getPrimaryFactoryType(matchResults)
  if (primary === 'MULTI_CAPABILITY_FACTORY') {
    return `同时命中 ${matchResults.map((item) => item.factoryTypeName).join('、')}，已按全能力工厂处理。`
  }
  return matchResults.map((item) => `${item.factoryTypeName}：${item.matchedCapabilities.join('、')}`).join('；')
}

function calculateCompleteness(application: Pick<FactoryOnboardingApplication, 'factoryName' | 'bossName' | 'whatsapp' | 'address' | 'machineTotalCount' | 'effectiveWorkerCount' | 'availableStartDate' | 'selectedCapabilities' | 'machines' | 'adminAccount'>) {
  const factoryWhatsAppValid = validateWhatsApp(application.whatsapp).isValid
  const adminWhatsAppValid = validateWhatsApp(application.adminAccount.whatsapp).isValid
  const capabilityCount = application.selectedCapabilities.filter((item) => item.processCode && item.craftCode).length
  const machineBaseCompleted = application.machines.filter((item) => item.machineName.trim() && item.machineCount > 0 && item.condition).length
  const machineLinkedCompleted = application.machines.filter((item) => item.validationStatus === '通过').length
  const items = [
    buildCompletenessItem('ACCOUNT', '账号信息', 10, [application.adminAccount.loginId.trim(), application.adminAccount.password.trim(), application.adminAccount.adminName.trim(), adminWhatsAppValid ? 'valid' : ''].filter(Boolean).length, 4, adminWhatsAppValid ? '已完整' : '管理员 WhatsApp 格式不正确'),
    buildCompletenessItem('FACTORY_BASE', '工厂基础信息', 20, [application.factoryName.trim(), application.bossName.trim(), factoryWhatsAppValid ? 'valid' : '', application.address.trim(), application.availableStartDate.trim()].filter(Boolean).length, 5, factoryWhatsAppValid ? '已完整' : '工厂 WhatsApp 格式不正确'),
    buildCompletenessItem('WORKERS', '人员信息', 10, application.effectiveWorkerCount > 0 ? 1 : 0, 1, application.effectiveWorkerCount > 0 ? '已完整' : '有效工人数量未填写或小于等于 0'),
    buildCompletenessItem('MACHINES', '机器信息', 20, [application.machineTotalCount > 0 ? 'valid' : '', application.machines.length > 0 ? 'valid' : '', machineBaseCompleted >= application.machines.length && application.machines.length > 0 ? 'valid' : ''].filter(Boolean).length, 3, application.machineTotalCount > 0 ? '已完整' : '机器总数未填写或小于等于 0'),
    buildCompletenessItem('CAPABILITY', '工序工艺能力', 20, capabilityCount > 0 ? 1 : 0, 1, capabilityCount > 0 ? '已完整' : '至少需要选择一个工序工艺能力'),
    buildCompletenessItem('LINK', '机器与工序工艺关联', 15, application.machines.length > 0 ? machineLinkedCompleted : 0, Math.max(1, application.machines.length || 1), machineLinkedCompleted >= application.machines.length ? '已完整' : '存在机器未关联已选工序工艺'),
    buildCompletenessItem('WHATSAPP', 'WhatsApp 格式', 5, factoryWhatsAppValid && adminWhatsAppValid ? 1 : 0, 1, factoryWhatsAppValid && adminWhatsAppValid ? '已完整' : 'WhatsApp 格式不正确'),
  ]
  const score = Math.max(0, Math.min(100, items.reduce((total, item) => total + item.score, 0)))
  return {
    completenessScore: score,
    completenessLevel: getCompletenessLevel(score),
    completenessItems: items,
    completenessUpdatedAt: nowTimestamp(),
  }
}

function decorateApplication(application: FactoryOnboardingApplication): FactoryOnboardingApplication {
  const normalizedWhatsApp = normalizeWhatsApp(application.whatsapp)
  const normalizedAdminWhatsApp = normalizeWhatsApp(application.adminAccount.whatsapp)
  const machines = applyMachineValidations(application.machines, application.selectedCapabilities)
  const matchResults = inferFactoryTypes(application.selectedCapabilities)
  const primaryFactoryType = getPrimaryFactoryType(matchResults)
  const completeness = calculateCompleteness({
    ...application,
    whatsapp: normalizedWhatsApp,
    adminAccount: { ...application.adminAccount, whatsapp: normalizedAdminWhatsApp },
    machines,
  })
  return {
    ...application,
    whatsapp: normalizedWhatsApp,
    machines,
    adminAccount: {
      ...application.adminAccount,
      whatsapp: normalizedAdminWhatsApp,
    },
    completenessScore: completeness.completenessScore,
    completenessLevel: completeness.completenessLevel,
    completenessItems: completeness.completenessItems,
    completenessUpdatedAt: completeness.completenessUpdatedAt,
    inferredFactoryTypes: matchResults,
    primaryFactoryType,
    factoryTypeMatchedAt: application.factoryTypeMatchedAt || nowTimestamp(),
    factoryTypeMatchReason: buildFactoryTypeMatchReason(matchResults),
  }
}

function createApplicationNo(seed: number): string {
  return `FON-${String(20260500 + seed).padStart(8, '0')}`
}

function createTempFactoryId(seed: number): string {
  return `FACTORY-TEMP-${String(seed).padStart(4, '0')}`
}

function resolveCraftByName(processName: string, craftName: string) {
  const process = getActiveProcessOptions().find((item) => item.processName === processName)
  if (!process) {
    throw new Error(`未找到工序：${processName}`)
  }

  const craft = getActiveCraftOptionsByProcess(process.processCode).find((item) => item.craftName === craftName)
  if (!craft) {
    throw new Error(`未找到工艺：${processName} / ${craftName}`)
  }

  return {
    processCode: process.processCode,
    processName: process.processName,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
  }
}

function createCapability(processName: string, craftName: string, remark = ''): FactoryOnboardingSelectedCapability {
  const resolved = resolveCraftByName(processName, craftName)
  return {
    ...resolved,
    abilityScope: 'CRAFT',
    canReceiveTask: true,
    capacityManaged: true,
    remark,
  }
}

function minutesBetween(start: string, end: string): number {
  const startTime = new Date(start.replace(' ', 'T')).getTime()
  const endTime = new Date(end.replace(' ', 'T')).getTime()
  const diff = Math.max(0, endTime - startTime)
  return Math.max(0, Math.round(diff / 60000))
}

function formatElapsedText(minutes: number, nodeStatus: FactoryOnboardingNodeStatus): string {
  if (nodeStatus === '未开始') return '-'
  if (nodeStatus === '已终止') return '已终止'
  if (minutes <= 0) return '0分钟'
  if (minutes < 60) return `${minutes}分钟`
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60)
    const remain = minutes % 60
    return remain > 0 ? `${hours}小时${remain}分钟` : `${hours}小时`
  }
  const days = Math.floor(minutes / (24 * 60))
  const hours = Math.floor((minutes % (24 * 60)) / 60)
  return hours > 0 ? `${days}天${hours}小时` : `${days}天`
}

function createNodeLog(params: {
  seed: number
  nodeName: FactoryOnboardingNode
  nodeStatus: FactoryOnboardingNodeStatus
  enteredAt: string
  leftAt?: string
  actionCount: number
  lastActionAt?: string
  operator: string
  remark: string
}): FactoryOnboardingNodeLog {
  const elapsedMinutes = params.leftAt
    ? minutesBetween(params.enteredAt, params.leftAt)
    : params.nodeStatus === '进行中'
      ? minutesBetween(params.enteredAt, nowTimestamp())
      : 0
  return {
    nodeLogId: `NLOG-${params.seed}-${params.nodeName}`,
    nodeName: params.nodeName,
    nodeStatus: params.nodeStatus,
    enteredAt: params.enteredAt,
    leftAt: params.leftAt,
    elapsedMinutes,
    elapsedText: formatElapsedText(elapsedMinutes, params.nodeStatus),
    actionCount: params.actionCount,
    lastActionAt: params.lastActionAt || params.leftAt || params.enteredAt,
    operator: params.operator,
    remark: params.remark,
  }
}

function createActionLog(params: {
  seed: number
  seq: number
  actionName: FactoryOnboardingActionName
  nodeName: FactoryOnboardingNode
  operator: string
  operatedAt: string
  actionSequenceInNode: number
  fromStatus: FactoryOnboardingStatus
  toStatus: FactoryOnboardingStatus
  fromNode: FactoryOnboardingNode
  toNode: FactoryOnboardingNode
  remark: string
}): FactoryOnboardingActionLog {
  return {
    actionLogId: `ALOG-${params.seed}-${String(params.seq).padStart(2, '0')}`,
    actionName: params.actionName,
    nodeName: params.nodeName,
    operator: params.operator,
    operatedAt: params.operatedAt,
    actionSequenceInNode: params.actionSequenceInNode,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    fromNode: params.fromNode,
    toNode: params.toNode,
    remark: params.remark,
  }
}

function createReviewRecord(params: {
  seed: number
  round: number
  reviewResult: FactoryOnboardingReviewRecord['reviewResult']
  reviewOpinion: string
  allowResubmit: boolean
  reviewer: string
  reviewedAt: string
  fromStatus: FactoryOnboardingStatus
  toStatus: FactoryOnboardingStatus
  fromNode: FactoryOnboardingNode
  toNode: FactoryOnboardingNode
}): FactoryOnboardingReviewRecord {
  return {
    reviewId: `REV-${params.seed}-${String(params.round).padStart(2, '0')}`,
    reviewRoundNo: params.round,
    reviewResult: params.reviewResult,
    reviewOpinion: params.reviewOpinion,
    allowResubmit: params.allowResubmit,
    reviewer: params.reviewer,
    reviewedAt: params.reviewedAt,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    fromNode: params.fromNode,
    toNode: params.toNode,
  }
}

function createSupplementRecord(params: {
  seed: number
  round: number
  supplementReason: string
  requiredFields: FactoryOnboardingRequiredField[]
  submittedFields: FactoryOnboardingRequiredField[]
  submittedAt?: string
  submittedBy?: string
  relatedReviewId: string
  status: FactoryOnboardingSupplementStatus
}): FactoryOnboardingSupplementRecord {
  return {
    supplementId: `SUP-${params.seed}-${String(params.round).padStart(2, '0')}`,
    supplementRoundNo: params.round,
    supplementReason: params.supplementReason,
    requiredFields: [...params.requiredFields],
    submittedFields: [...params.submittedFields],
    submittedAt: params.submittedAt,
    submittedBy: params.submittedBy,
    relatedReviewId: params.relatedReviewId,
    status: params.status,
  }
}

function resolveMachineValidation(machine: FactoryOnboardingMachineAbility, capabilities: FactoryOnboardingSelectedCapability[]) {
  if (!machine.linkedProcessCode) {
    return { validationStatus: '未关联工序' as FactoryOnboardingMachineValidationStatus, validationMessage: '请选择机器关联工序' }
  }
  if (!machine.linkedCraftCode) {
    return { validationStatus: '未关联工艺' as FactoryOnboardingMachineValidationStatus, validationMessage: '请选择机器关联工艺' }
  }
  const matched = capabilities.some(
    (item) => item.processCode === machine.linkedProcessCode && item.craftCode === machine.linkedCraftCode,
  )
  if (!matched) {
    return {
      validationStatus: '工序工艺未在接单能力中选择' as FactoryOnboardingMachineValidationStatus,
      validationMessage: '该机器关联的工序工艺未在接单能力中选择，请先选择对应工序工艺',
    }
  }
  return { validationStatus: '通过' as FactoryOnboardingMachineValidationStatus, validationMessage: '校验通过' }
}

function createMachine(params: {
  seed: number
  capability: FactoryOnboardingSelectedCapability
  condition: FactoryOnboardingMachineAbility['condition']
  machineName?: string
  machineNo?: string
  machineCount?: number
  linkedProcessCode?: string
  linkedProcessName?: string
  linkedCraftCode?: string
  linkedCraftName?: string
  remark?: string
}): FactoryOnboardingMachineAbility {
  const machine: FactoryOnboardingMachineAbility = {
    machineId: `MCH-${String(params.seed).padStart(4, '0')}`,
    machineName: params.machineName || `${params.capability.craftName}设备`,
    machineNo: params.machineNo || `EQ-${String(params.seed).padStart(4, '0')}`,
    machineCount: params.machineCount || 1 + (params.seed % 3),
    linkedProcessCode: params.linkedProcessCode ?? params.capability.processCode,
    linkedProcessName: params.linkedProcessName ?? params.capability.processName,
    linkedCraftCode: params.linkedCraftCode ?? params.capability.craftCode,
    linkedCraftName: params.linkedCraftName ?? params.capability.craftName,
    condition: params.condition,
    remark:
      params.remark ||
      (params.condition === '维修中' ? '本月保养排程中' : params.condition === '停用' ? '备用产线停用' : '当前可承接任务'),
    validationStatus: '通过',
    validationMessage: '校验通过',
  }
  return machine
}

function applyMachineValidations(
  machines: FactoryOnboardingMachineAbility[],
  capabilities: FactoryOnboardingSelectedCapability[],
): FactoryOnboardingMachineAbility[] {
  return machines.map((item) => {
    const validation = resolveMachineValidation(item, capabilities)
    return {
      ...item,
      validationStatus: validation.validationStatus,
      validationMessage: validation.validationMessage,
    }
  })
}

function applySeedWhatsAppVariant(
  seed: number,
  payload: FactoryOnboardingDraftPayload,
): FactoryOnboardingDraftPayload {
  if (seed <= 3) {
    const invalid = `08中文-${seed}`
    return {
      ...payload,
      whatsapp: invalid,
      adminAccount: {
        ...payload.adminAccount,
        whatsapp: invalid,
      },
    }
  }
  if (seed >= 4 && seed <= 6) {
    const local = `0812345678${seed}`
    return {
      ...payload,
      whatsapp: local,
      adminAccount: {
        ...payload.adminAccount,
        whatsapp: local,
      },
    }
  }
  if (seed >= 7 && seed <= 9) {
    const country = `62812345678${seed}`
    return {
      ...payload,
      whatsapp: country,
      adminAccount: {
        ...payload.adminAccount,
        whatsapp: country,
      },
    }
  }
  if (seed >= 10 && seed <= 12) {
    const plus = `+62812345678${seed}`
    return {
      ...payload,
      whatsapp: plus,
      adminAccount: {
        ...payload.adminAccount,
        whatsapp: plus,
      },
    }
  }
  return payload
}

function applySeedCompletenessVariant(seed: number, payload: FactoryOnboardingDraftPayload): FactoryOnboardingDraftPayload {
  if (seed <= 3) {
    return {
      ...payload,
      address: '',
      availableStartDate: '',
      effectiveWorkerCount: 0,
      machineTotalCount: 0,
      adminAccount: {
        ...payload.adminAccount,
        adminName: '',
      },
    }
  }
  if (seed >= 7 && seed <= 9) {
    return {
      ...payload,
      address: '',
      availableStartDate: '',
      effectiveWorkerCount: 0,
    }
  }
  if (seed >= 13) {
    return {
      ...payload,
      address: `${payload.address}（资料齐全版）`,
      adminAccount: {
        ...payload.adminAccount,
        password: '12345678',
      },
    }
  }
  return payload
}

function createBasePayload(
  seed: number,
  status: FactoryOnboardingStatus,
  capabilityNames: Array<[string, string]>,
  condition: FactoryOnboardingMachineAbility['condition'],
  machineScenario: 'valid' | 'missingProcess' | 'missingCraft' | 'capabilityMismatch' = 'valid',
): FactoryOnboardingDraftPayload {
  const selectedCapabilities = capabilityNames.map(([processName, craftName], index) =>
    createCapability(processName, craftName, index === 0 ? '主接单能力' : '补充能力'),
  )
  const baseCapability = selectedCapabilities[0]
  const machines: FactoryOnboardingMachineAbility[] = [
    createMachine({ seed: seed * 10 + 1, capability: baseCapability, condition }),
  ]

  if (machineScenario === 'missingProcess') {
    machines.push(
      createMachine({
        seed: seed * 10 + 2,
        capability: baseCapability,
        condition,
        linkedProcessCode: '',
        linkedProcessName: '',
        linkedCraftCode: '',
        linkedCraftName: '',
        remark: '待补充工序信息',
      }),
    )
  } else if (machineScenario === 'missingCraft') {
    machines.push(
      createMachine({
        seed: seed * 10 + 2,
        capability: baseCapability,
        condition,
        linkedCraftCode: '',
        linkedCraftName: '',
        remark: '待补充工艺信息',
      }),
    )
  } else if (machineScenario === 'capabilityMismatch') {
    const mismatchCapability = selectedCapabilities.some((item) => item.processCode === 'POST_FINISHING')
      ? createCapability('印花', '数码印', '异常演示能力')
      : createCapability('后道', '包装', '异常演示能力')
    machines.push(
      createMachine({
        seed: seed * 10 + 2,
        capability: mismatchCapability,
        condition,
        remark: '当前机器关联能力未纳入接单能力',
      }),
    )
  } else if (selectedCapabilities[1]) {
    machines.push(createMachine({ seed: seed * 10 + 2, capability: selectedCapabilities[1], condition }))
  }

  const normalizedMachines = applyMachineValidations(machines, selectedCapabilities)
  const factoryName = `${selectedCapabilities[0]?.craftName || '工艺'}演示工厂${seed}`
  const bossName = `老板${seed}`
  const whatsapp = `+62-812-9000-${String(100 + seed).slice(-3)}`

  return {
    applicationNo: createApplicationNo(seed),
    factoryTempId: createTempFactoryId(seed),
    factoryName,
    bossName,
    whatsapp,
    address: `雅加达示范工业园 ${seed} 号楼 ${seed} 层`,
    machineTotalCount: normalizedMachines.reduce((total, item) => total + item.machineCount, 0),
    effectiveWorkerCount: 18 + seed,
    availableStartDate: `2026-05-${String((seed % 9) + 10).padStart(2, '0')}`,
    selectedCapabilities,
    machines: normalizedMachines,
    adminAccount: {
      loginId: `onboarding_${seed}`,
      password: '123456',
      adminName: bossName,
      whatsapp,
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: status === '已合作' ? '已转正式' : status === '已拒绝' ? '已停用' : '待转正式',
    },
  }
}

function createSeedApplication(
  seed: number,
  status: FactoryOnboardingStatus,
  capabilityNames: Array<[string, string]>,
  condition: FactoryOnboardingMachineAbility['condition'],
  archivedFactoryId?: string,
  machineScenario: 'valid' | 'missingProcess' | 'missingCraft' | 'capabilityMismatch' = 'valid',
): FactoryOnboardingApplication {
  const payload = applySeedCompletenessVariant(
    seed,
    applySeedWhatsAppVariant(seed, createBasePayload(seed, status, capabilityNames, condition, machineScenario)),
  )
  const baseDay = (seed % 4) + 1
  const submitAt = `2026-05-${String(baseDay).padStart(2, '0')} 09:${String((seed * 7) % 60).padStart(2, '0')}:00`
  const firstReviewAt = `2026-05-${String(baseDay + 1).padStart(2, '0')} 14:${String((seed * 5) % 60).padStart(2, '0')}:00`
  const supplementAt = `2026-05-${String(baseDay + 2).padStart(2, '0')} 10:${String((seed * 4) % 60).padStart(2, '0')}:00`
  const secondReviewAt = `2026-05-${String(baseDay + 3).padStart(2, '0')} 11:${String((seed * 6) % 60).padStart(2, '0')}:00`
  const contractAt = `2026-05-${String(baseDay + 4).padStart(2, '0')} 16:${String((seed * 3) % 60).padStart(2, '0')}:00`
  const finishAt = `2026-05-${String(baseDay + 5).padStart(2, '0')} 09:${String((seed * 2) % 60).padStart(2, '0')}:00`
  const fillAt = `2026-05-${String(baseDay).padStart(2, '0')} 08:15:00`
  const operator = `${payload.factoryName}管理员`
  const reviewer = '平台审核员'
  const cooperationOperator = '平台运营经理'
  const nodeLogs: FactoryOnboardingNodeLog[] = []
  const actionLogs: FactoryOnboardingActionLog[] = []
  const reviewRecords: FactoryOnboardingReviewRecord[] = []
  const supplementRecords: FactoryOnboardingSupplementRecord[] = []
  const transferRecords: FactoryOnboardingTransferRecord[] = []
  let actionSeq = 0

  actionLogs.push(
    createActionLog({
      seed,
      seq: ++actionSeq,
      actionName: '保存草稿',
      nodeName: '填写入驻信息',
      operator,
      operatedAt: fillAt,
      actionSequenceInNode: 1,
      fromStatus: '草稿',
      toStatus: '草稿',
      fromNode: '填写入驻信息',
      toNode: '填写入驻信息',
      remark: '首次保存入驻草稿',
    }),
  )

  if (status === '草稿') {
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '填写入驻信息',
        nodeStatus: '进行中',
        enteredAt: fillAt,
        actionCount: 1,
        lastActionAt: fillAt,
        operator,
        remark: '请补全入驻信息后提交平台审核。',
      }),
    )
  } else {
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '填写入驻信息',
        nodeStatus: '已完成',
        enteredAt: fillAt,
        leftAt: submitAt,
        actionCount: 2,
        lastActionAt: submitAt,
        operator,
        remark: '已完成基础资料填写。',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '提交平台审核',
        nodeStatus: '已完成',
        enteredAt: submitAt,
        leftAt: submitAt,
        actionCount: 1,
        lastActionAt: submitAt,
        operator,
        remark: '已提交平台审核。',
      }),
    )
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '提交入驻申请',
        nodeName: '平台审核',
        operator,
        operatedAt: submitAt,
        actionSequenceInNode: 1,
        fromStatus: '草稿',
        toStatus: '已提交待审核',
        fromNode: '填写入驻信息',
        toNode: '平台审核',
        remark: '提交平台审核',
      }),
    )
  }

  if (status === '已提交待审核') {
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '平台审核',
        nodeStatus: '进行中',
        enteredAt: submitAt,
        actionCount: 1,
        lastActionAt: submitAt,
        operator: reviewer,
        remark: '等待平台审核。',
      }),
    )
  }

  if (status === '退回补充资料' || status === '已重新提交待审核') {
    const requiredFields: FactoryOnboardingRequiredField[] =
      seed % 3 === 1 ? ['机器明细', '工序工艺能力'] : seed % 3 === 2 ? ['地址', '可开始合作时间'] : ['管理员账号', '机器总数']
    const reviewRecord = createReviewRecord({
      seed,
      round: 1,
      reviewResult: '不通过且允许再次提交',
      reviewOpinion: '资料需补充，请根据退回项完善后重新提交。',
      allowResubmit: true,
      reviewer,
      reviewedAt: firstReviewAt,
      fromStatus: '已提交待审核',
      toStatus: '退回补充资料',
      fromNode: '平台审核',
      toNode: '补充资料',
    })
    reviewRecords.push(reviewRecord)
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '平台退回补充资料',
        nodeName: '平台审核',
        operator: reviewer,
        operatedAt: firstReviewAt,
        actionSequenceInNode: 1,
        fromStatus: '已提交待审核',
        toStatus: '退回补充资料',
        fromNode: '平台审核',
        toNode: '补充资料',
        remark: `需补充字段：${requiredFields.join('、')}`,
      }),
    )

    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '平台审核',
        nodeStatus: '已退回',
        enteredAt: submitAt,
        leftAt: firstReviewAt,
        actionCount: status === '已重新提交待审核' ? 2 : 1,
        lastActionAt: status === '已重新提交待审核' ? supplementAt : firstReviewAt,
        operator: reviewer,
        remark: status === '已重新提交待审核' ? '已完成退回补充后的再次审核进入中。' : '平台已退回补充资料。',
      }),
    )

    supplementRecords.push(
      createSupplementRecord({
        seed,
        round: 1,
        supplementReason: reviewRecord.reviewOpinion,
        requiredFields,
        submittedFields: status === '已重新提交待审核' ? requiredFields : [],
        submittedAt: status === '已重新提交待审核' ? supplementAt : undefined,
        submittedBy: status === '已重新提交待审核' ? operator : undefined,
        relatedReviewId: reviewRecord.reviewId,
        status: status === '已重新提交待审核' ? '已重新提交' : '待补充',
      }),
    )

    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '补充资料',
        nodeStatus: status === '已重新提交待审核' ? '已完成' : '进行中',
        enteredAt: firstReviewAt,
        leftAt: status === '已重新提交待审核' ? supplementAt : undefined,
        actionCount: status === '已重新提交待审核' ? 2 : 1,
        lastActionAt: status === '已重新提交待审核' ? supplementAt : firstReviewAt,
        operator,
        remark: status === '已重新提交待审核' ? '已补充资料并重新提交。' : '等待工厂补充资料。',
      }),
    )

    if (status === '已重新提交待审核') {
      actionLogs.push(
        createActionLog({
          seed,
          seq: ++actionSeq,
          actionName: '工厂重新提交',
          nodeName: '补充资料',
          operator,
          operatedAt: supplementAt,
          actionSequenceInNode: 2,
          fromStatus: '退回补充资料',
          toStatus: '已重新提交待审核',
          fromNode: '补充资料',
          toNode: '平台审核',
          remark: '已根据审核意见补充并重新提交。',
        }),
      )
      nodeLogs.push(
        createNodeLog({
          seed,
          nodeName: '平台审核',
          nodeStatus: '进行中',
          enteredAt: supplementAt,
          actionCount: 2,
          lastActionAt: supplementAt,
          operator: reviewer,
          remark: '补充资料已提交，等待平台重新审核。',
        }),
      )
    }
  }

  if (status === '审核通过待确认合作') {
    const fromStatus = seed % 2 === 0 ? '已重新提交待审核' : '已提交待审核'
    const fromNode = '平台审核'
    reviewRecords.push(
      createReviewRecord({
        seed,
        round: fromStatus === '已重新提交待审核' ? 2 : 1,
        reviewResult: '通过',
        reviewOpinion: '资料齐全，进入确认合作。',
        allowResubmit: false,
        reviewer,
        reviewedAt: firstReviewAt,
        fromStatus,
        toStatus: '审核通过待确认合作',
        fromNode,
        toNode: '确认合作',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '平台审核',
        nodeStatus: '已完成',
        enteredAt: submitAt,
        leftAt: firstReviewAt,
        actionCount: 1,
        lastActionAt: firstReviewAt,
        operator: reviewer,
        remark: '平台审核已通过。',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '确认合作',
        nodeStatus: '进行中',
        enteredAt: firstReviewAt,
        actionCount: 1,
        lastActionAt: firstReviewAt,
        operator: cooperationOperator,
        remark: '等待平台确认合作。',
      }),
    )
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '平台审核通过',
        nodeName: '平台审核',
        operator: reviewer,
        operatedAt: firstReviewAt,
        actionSequenceInNode: 1,
        fromStatus,
        toStatus: '审核通过待确认合作',
        fromNode,
        toNode: '确认合作',
        remark: '审核通过，等待平台确认合作。',
      }),
    )
  }

  if (status === '已拒绝') {
    reviewRecords.push(
      createReviewRecord({
        seed,
        round: 1,
        reviewResult: '不通过且不允许再次提交',
        reviewOpinion: '当前工艺能力与平台合作范围不匹配，暂不开放再次提交。',
        allowResubmit: false,
        reviewer,
        reviewedAt: firstReviewAt,
        fromStatus: '已提交待审核',
        toStatus: '已拒绝',
        fromNode: '平台审核',
        toNode: '完成',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '平台审核',
        nodeStatus: '已终止',
        enteredAt: submitAt,
        leftAt: firstReviewAt,
        actionCount: 1,
        lastActionAt: firstReviewAt,
        operator: reviewer,
        remark: '平台审核拒绝。',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '完成',
        nodeStatus: '已终止',
        enteredAt: firstReviewAt,
        actionCount: 1,
        lastActionAt: firstReviewAt,
        operator: reviewer,
        remark: '已拒绝，流程结束。',
      }),
    )
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '平台拒绝入驻',
        nodeName: '平台审核',
        operator: reviewer,
        operatedAt: firstReviewAt,
        actionSequenceInNode: 1,
        fromStatus: '已提交待审核',
        toStatus: '已拒绝',
        fromNode: '平台审核',
        toNode: '完成',
        remark: '审核不通过且不允许再次提交。',
      }),
    )
  }

  if (status === '已合作') {
    reviewRecords.push(
      createReviewRecord({
        seed,
        round: 1,
        reviewResult: '通过',
        reviewOpinion: '资料齐全，进入合作。',
        allowResubmit: false,
        reviewer,
        reviewedAt: firstReviewAt,
        fromStatus: '已提交待审核',
        toStatus: '审核通过待确认合作',
        fromNode: '平台审核',
        toNode: '确认合作',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '平台审核',
        nodeStatus: '已完成',
        enteredAt: submitAt,
        leftAt: firstReviewAt,
        actionCount: 1,
        lastActionAt: firstReviewAt,
        operator: reviewer,
        remark: '平台审核通过。',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '确认合作',
        nodeStatus: '已完成',
        enteredAt: firstReviewAt,
        leftAt: contractAt,
        actionCount: 1,
        lastActionAt: contractAt,
        operator: cooperationOperator,
        remark: '平台已确认合作。',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '生成工厂档案',
        nodeStatus: '已完成',
        enteredAt: contractAt,
        leftAt: finishAt,
        actionCount: 2,
        lastActionAt: finishAt,
        operator: cooperationOperator,
        remark: '已生成工厂档案并转正管理员账号。',
      }),
    )
    nodeLogs.push(
      createNodeLog({
        seed,
        nodeName: '完成',
        nodeStatus: '已完成',
        enteredAt: finishAt,
        leftAt: finishAt,
        actionCount: 1,
        lastActionAt: finishAt,
        operator: cooperationOperator,
        remark: '已合作完成。',
      }),
    )
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '平台审核通过',
        nodeName: '平台审核',
        operator: reviewer,
        operatedAt: firstReviewAt,
        actionSequenceInNode: 1,
        fromStatus: '已提交待审核',
        toStatus: '审核通过待确认合作',
        fromNode: '平台审核',
        toNode: '确认合作',
        remark: '审核通过。',
      }),
    )
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '平台确认合作',
        nodeName: '确认合作',
        operator: cooperationOperator,
        operatedAt: contractAt,
        actionSequenceInNode: 1,
        fromStatus: '审核通过待确认合作',
        toStatus: '审核通过待确认合作',
        fromNode: '确认合作',
        toNode: '生成工厂档案',
        remark: '确认合作并进入转档。',
      }),
    )
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '生成工厂档案',
        nodeName: '生成工厂档案',
        operator: cooperationOperator,
        operatedAt: finishAt,
        actionSequenceInNode: 1,
        fromStatus: '审核通过待确认合作',
        toStatus: '已合作',
        fromNode: '生成工厂档案',
        toNode: '完成',
        remark: '生成正式工厂档案。',
      }),
    )
    actionLogs.push(
      createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '管理员账号转正',
        nodeName: '生成工厂档案',
        operator: cooperationOperator,
        operatedAt: finishAt,
        actionSequenceInNode: 2,
        fromStatus: '审核通过待确认合作',
        toStatus: '已合作',
        fromNode: '生成工厂档案',
        toNode: '完成',
        remark: '入驻管理员账号转为正式工厂管理员账号。',
      }),
    )
    transferRecords.push({
      transferId: `TR-${seed}`,
      factoryProfileGenerated: true,
      factoryProfileId: archivedFactoryId,
      adminAccountGenerated: true,
      operator: cooperationOperator,
      operatedAt: finishAt,
      remark: '已转为正式合作工厂。',
    })
  }

  const currentNode: FactoryOnboardingNode =
    status === '草稿'
      ? '填写入驻信息'
      : status === '退回补充资料'
        ? '补充资料'
        : status === '审核通过待确认合作'
          ? '确认合作'
          : status === '已拒绝' || status === '已合作'
            ? '完成'
            : '平台审核'

  return {
    applicationId: `FOA-${String(seed).padStart(4, '0')}`,
    applicationNo: payload.applicationNo || createApplicationNo(seed),
    factoryTempId: payload.factoryTempId || createTempFactoryId(seed),
    factoryName: payload.factoryName,
    bossName: payload.bossName,
    whatsapp: payload.whatsapp,
    address: payload.address,
    machineTotalCount: payload.machineTotalCount,
    effectiveWorkerCount: payload.effectiveWorkerCount,
    availableStartDate: payload.availableStartDate,
    selectedCapabilities: payload.selectedCapabilities,
    machines: payload.machines,
    adminAccount: payload.adminAccount,
    status,
    currentNode,
    submittedAt: status === '草稿' ? undefined : submitAt,
    reviewedAt:
      status === '退回补充资料' ||
      status === '已重新提交待审核' ||
      status === '审核通过待确认合作' ||
      status === '已拒绝' ||
      status === '已合作'
        ? status === '已重新提交待审核' ? firstReviewAt : firstReviewAt
        : undefined,
    contractedAt: status === '已合作' ? contractAt : undefined,
    createdFactoryId: status === '已合作' ? archivedFactoryId : undefined,
    completenessScore: 0,
    completenessLevel: '不完整',
    completenessItems: [],
    completenessUpdatedAt: finishAt,
    inferredFactoryTypes: [],
    primaryFactoryType: 'CUTTING_FACTORY',
    factoryTypeMatchedAt: finishAt,
    factoryTypeMatchReason: '',
    nodeLogs,
    actionLogs,
    reviewRecords,
    supplementRecords,
    transferRecords,
  }
}

function createSeedApplications(): FactoryOnboardingApplication[] {
  const archivedFactories = listFactoryMasterRecords().slice(0, 3)
  const cooperatedApps = archivedFactories.map((factory, index) => {
    const capabilitySets: Array<Array<[string, string]>> = [
      [
        ['裁片', '定位裁'],
        ['特殊工艺', '激光切'],
      ],
      [
        ['印花', '丝网印'],
        ['特殊工艺', '打揽'],
      ],
      [
        ['染色', '匹染'],
        ['后道', '包装'],
      ],
    ]
    return {
      seed: 19 + index,
      application: createSeedApplication(19 + index, '已合作', capabilitySets[index], index % 2 === 0 ? '可用' : '维修中', factory.id),
      factory,
    }
  })

  return [
    createSeedApplication(1, '草稿', [['裁片', '定位裁']], '可用', undefined, 'missingProcess'),
    createSeedApplication(2, '草稿', [['裁片', '定向裁']], '维修中', undefined, 'missingCraft'),
    createSeedApplication(3, '草稿', [['裁片', '定位裁']], '停用', undefined, 'capabilityMismatch'),
    createSeedApplication(4, '已提交待审核', [['印花', '数码印']], '可用'),
    createSeedApplication(5, '已提交待审核', [['印花', '丝网印']], '维修中'),
    createSeedApplication(6, '已提交待审核', [['印花', '数码印']], '停用'),
    createSeedApplication(7, '退回补充资料', [['后道', '包装']], '可用', undefined, 'missingProcess'),
    createSeedApplication(8, '退回补充资料', [['后道', '包装']], '维修中', undefined, 'missingCraft'),
    createSeedApplication(9, '退回补充资料', [['后道', '包装']], '停用', undefined, 'capabilityMismatch'),
    createSeedApplication(10, '已重新提交待审核', [['染色', '色织']], '可用', undefined, 'missingProcess'),
    createSeedApplication(11, '已重新提交待审核', [['染色', '匹染']], '维修中', undefined, 'missingCraft'),
    createSeedApplication(12, '已重新提交待审核', [['染色', '匹染']], '停用', undefined, 'capabilityMismatch'),
    createSeedApplication(13, '审核通过待确认合作', [['特殊工艺', '打揽']], '可用'),
    createSeedApplication(14, '审核通过待确认合作', [['特殊工艺', '打条']], '维修中'),
    createSeedApplication(15, '审核通过待确认合作', [['绣花', '绣花']], '停用'),
    createSeedApplication(16, '已拒绝', [['裁片', '定位裁'], ['印花', '数码印'], ['染色', '匹染']], '可用'),
    createSeedApplication(17, '已拒绝', [['印花', '丝网印'], ['染色', '色织'], ['后道', '包装']], '维修中'),
    createSeedApplication(18, '已拒绝', [['裁片', '定向裁'], ['特殊工艺', '激光切'], ['后道', '包装']], '停用'),
    ...cooperatedApps.map((item) => {
      const matchedAdminLogin = `${item.factory.id}_admin`
      item.application.adminAccount = {
        ...item.application.adminAccount,
        loginId: matchedAdminLogin,
        adminName: item.factory.contact || `${item.factory.name}管理员`,
        whatsapp: item.factory.phone || item.application.adminAccount.whatsapp,
        accountStatus: '已转正式',
      }
      item.application.factoryName = item.factory.name
      item.application.bossName = item.factory.contact || item.application.bossName
      item.application.whatsapp = item.factory.phone || item.application.whatsapp
      item.application.address = item.factory.address || item.application.address
      const capacityProfile = createInitialCapacityProfileFromOnboarding(decorateApplication(item.application), item.factory)
      item.application.transferRecords = item.application.transferRecords.map((record) => ({
        ...record,
        capacityProfileGenerated: true,
        capacityProfileId: capacityProfile.capacityProfileId,
      }))
      return item.application
    }),
  ]
}

function ensureApplicationStore(): FactoryOnboardingApplication[] {
  if (cachedApplications) return cachedApplications

  const stored = readStoredJson<FactoryOnboardingApplication[]>(APPLICATION_STORE_KEY)
  if (Array.isArray(stored) && stored.length > 0) {
    cachedApplications = stored.map((item) => decorateApplication(cloneApplication(item)))
    return cachedApplications
  }

  cachedApplications = createSeedApplications().map((item) => decorateApplication(cloneApplication(item)))
  writeStoredJson(APPLICATION_STORE_KEY, cachedApplications)
  return cachedApplications
}

function persistApplications(applications: FactoryOnboardingApplication[]): void {
  cachedApplications = applications.map((item) => decorateApplication(cloneApplication(item)))
  writeStoredJson(APPLICATION_STORE_KEY, cachedApplications)
}

export function listFactoryOnboardingApplications(): FactoryOnboardingApplication[] {
  return ensureApplicationStore().map(cloneApplication)
}

export function getFactoryOnboardingApplicationById(applicationId: string): FactoryOnboardingApplication | null {
  const matched = ensureApplicationStore().find((item) => item.applicationId === applicationId)
  return matched ? cloneApplication(matched) : null
}

export function findFactoryOnboardingApplicationByLoginId(loginId: string): FactoryOnboardingApplication | null {
  const normalized = normalizeLoginId(loginId)
  if (!normalized) return null
  const matched = ensureApplicationStore().find((item) => normalizeLoginId(item.adminAccount.loginId) === normalized)
  return matched ? cloneApplication(matched) : null
}

export function saveFactoryOnboardingApplication(application: FactoryOnboardingApplication): FactoryOnboardingApplication {
  const store = ensureApplicationStore()
  const next = decorateApplication(cloneApplication(application))
  const index = store.findIndex((item) => item.applicationId === next.applicationId)
  if (index >= 0) {
    const updated = [...store]
    updated[index] = next
    persistApplications(updated)
    return cloneApplication(next)
  }

  persistApplications([next, ...store])
  return cloneApplication(next)
}

export function replaceFactoryOnboardingApplications(applications: FactoryOnboardingApplication[]): void {
  persistApplications(applications)
}

export function updateFactoryOnboardingApplication(
  applicationId: string,
  updater: (application: FactoryOnboardingApplication) => FactoryOnboardingApplication,
): FactoryOnboardingApplication | null {
  const current = getFactoryOnboardingApplicationById(applicationId)
  if (!current) return null
  return saveFactoryOnboardingApplication(updater(current))
}

export function isFactoryOnboardingLoginIdTaken(loginId: string, excludeApplicationId?: string): boolean {
  const normalized = normalizeLoginId(loginId)
  if (!normalized) return false
  if (findFactoryPdaUserByLoginId(normalized)) return true
  return ensureApplicationStore().some(
    (item) => item.applicationId !== excludeApplicationId && normalizeLoginId(item.adminAccount.loginId) === normalized,
  )
}

export function createEmptyFactoryOnboardingDraft(): FactoryOnboardingDraftPayload {
  return {
    factoryName: '',
    bossName: '',
    whatsapp: '',
    address: '',
    machineTotalCount: 0,
    effectiveWorkerCount: 0,
    availableStartDate: '',
    selectedCapabilities: [],
    machines: [],
    adminAccount: {
      loginId: '',
      password: '',
      adminName: '',
      whatsapp: '',
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: '待激活',
    },
  }
}

export function getFactoryOnboardingApplicantSession(): FactoryOnboardingApplicantSession | null {
  const stored = readStoredJson<FactoryOnboardingApplicantSession>(APPLICANT_SESSION_KEY)
  if (!stored) return null
  if (!stored.applicationId || !stored.loginId || !stored.factoryName) return null
  return { ...stored }
}

export function setFactoryOnboardingApplicantSession(session: FactoryOnboardingApplicantSession | null): void {
  if (!session) {
    removeBrowserStorageItem(getStorage(), APPLICANT_SESSION_KEY)
    return
  }
  writeStoredJson(APPLICANT_SESSION_KEY, session)
}

export function clearFactoryOnboardingApplicantSession(): void {
  removeBrowserStorageItem(getStorage(), APPLICANT_SESSION_KEY)
}

export function createFactoryOnboardingApplicantSession(application: FactoryOnboardingApplication): FactoryOnboardingApplicantSession {
  return {
    applicationId: application.applicationId,
    loginId: application.adminAccount.loginId,
    adminName: application.adminAccount.adminName,
    factoryTempId: application.factoryTempId,
    factoryName: application.factoryName,
    loggedAt: nowTimestamp(),
  }
}
