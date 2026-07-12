import {
  getBrowserLocalStorage,
  readBrowserStorageItem,
  removeBrowserStorageItem,
  writeBrowserStorageItem,
} from '../browser-storage.ts'
import { findFactoryPdaUserByLoginId } from './store-domain-pda.ts'
import { listFactoryMasterRecords } from './factory-master-store.ts'
import {
  DEFAULT_FACTORY_ONBOARDING_PPIC,
  FACTORY_ONBOARDING_PPIC_OPTIONS,
  getAvailableOnboardingPpicOptions as listAvailableOnboardingPpicOptions,
  getOnboardingPpicName as resolveOnboardingPpicName,
  getOnboardingPpicOptionById,
} from './factory-onboarding-ppic.ts'
import {
  FACTORY_ADMIN_ROLE_ID,
  FACTORY_ADMIN_ROLE_NAME,
  canFactoryEnterBusiness,
  getOnboardingNodeByStatus,
  isFactoryAccountLocked,
  normalizeOnboardingStatus,
  normalizeReviewResult,
  type FactoryInferredTypeCode,
  type FactoryOnboardingActionLog,
  type FactoryOnboardingActionName,
  type FactoryOnboardingAdminAccount,
  type FactoryOnboardingApplicantSession,
  type FactoryOnboardingApplication,
  type FactoryOnboardingCompletenessItem,
  type FactoryOnboardingConversionRecord,
  type FactoryOnboardingDraftPayload,
  type FactoryOnboardingIdentityFile,
  type FactoryOnboardingMachineAbility,
  type FactoryOnboardingMachineValidationStatus,
  type FactoryOnboardingNode,
  type FactoryOnboardingNodeLog,
  type FactoryOnboardingNodeStatus,
  type FactoryOnboardingPpicChangeLog,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingReviewRecord,
  type FactoryOnboardingReviewResult,
  type FactoryOnboardingSampleStatus,
  type FactoryOnboardingSelectedCapability,
  type FactoryOnboardingStatus,
  type FactoryOnboardingSupplementRecord,
  type FactoryOnboardingSupplementStatus,
  type FactoryOnboardingTransferRecord,
  type FactoryTypeMatchResult,
} from './factory-onboarding-domain.ts'
import { getActiveCraftOptionsByProcess, getActiveProcessOptions } from './process-craft-dict.ts'

const APPLICATION_STORE_KEY = 'fcs_factory_onboarding_store_v6'
const APPLICANT_SESSION_KEY = 'fcs_factory_onboarding_session_v1'
export const LOCKED_FACTORY_NAME_MESSAGE = '该工厂入驻申请已被拒绝，不能再次发起入驻。'

let cachedApplications: FactoryOnboardingApplication[] | null = null

function nowTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function getStorage(): Storage | null {
  const storage = getBrowserLocalStorage()
  if (!storage || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') return null
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

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase()
}

export function normalizeFactoryShortName(factoryShortName: string): string {
  return factoryShortName.trim().toLowerCase()
}

export function buildAdminAccountFromFactoryShortName(input: {
  factoryShortName?: string
  applicantName?: string
  mobilePhone?: string
  adminAccount?: Partial<FactoryOnboardingAdminAccount>
  status?: FactoryOnboardingStatus | string
  accountLocked?: boolean
}): FactoryOnboardingAdminAccount {
  const factoryShortName = (input.factoryShortName || input.adminAccount?.loginId || '').trim()
  const mobilePhone = (input.mobilePhone || input.adminAccount?.mobilePhone || input.adminAccount?.mobileOrWhatsapp || input.adminAccount?.whatsapp || '').trim()
  const applicantName = (input.applicantName || input.adminAccount?.adminName || '').trim()
  const status = normalizeOnboardingStatus(input.status || '草稿')
  const accountStatus: FactoryOnboardingAdminAccount['accountStatus'] =
    input.accountLocked || isFactoryAccountLocked(status)
      ? '已锁定'
      : canFactoryEnterBusiness(status)
        ? '已转正式'
        : '入驻中'

  return {
    loginId: factoryShortName,
    password: (input.adminAccount?.password || '123456').trim() || '123456',
    adminName: applicantName,
    mobilePhone,
    mobileOrWhatsapp: mobilePhone,
    whatsapp: mobilePhone,
    roleId: input.adminAccount?.roleId || FACTORY_ADMIN_ROLE_ID,
    roleName: input.adminAccount?.roleName || FACTORY_ADMIN_ROLE_NAME,
    accountStatus,
    isTemporary: !canFactoryEnterBusiness(status),
  }
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

function cloneConversionRecord(item: FactoryOnboardingConversionRecord): FactoryOnboardingConversionRecord {
  return { ...item }
}

function clonePpicChangeLog(item: FactoryOnboardingPpicChangeLog): FactoryOnboardingPpicChangeLog {
  return { ...item }
}

function cloneApplication(application: FactoryOnboardingApplication): FactoryOnboardingApplication {
  return {
    ...application,
    completenessItems: (application.completenessItems || []).map((item) => ({ ...item })),
    inferredFactoryTypes: (application.inferredFactoryTypes || []).map((item) => ({ ...item, matchedCapabilities: [...item.matchedCapabilities] })),
    adminAccount: cloneAdminAccount(application.adminAccount),
    selectedCapabilities: (application.selectedCapabilities || []).map(cloneCapability),
    machines: (application.machines || []).map(cloneMachine),
    nodeLogs: (application.nodeLogs || []).map(cloneNodeLog),
    actionLogs: (application.actionLogs || []).map(cloneActionLog),
    reviewRecords: (application.reviewRecords || []).map(cloneReviewRecord),
    supplementRecords: (application.supplementRecords || []).map(cloneSupplementRecord),
    ppicChangeLogs: (application.ppicChangeLogs || []).map(clonePpicChangeLog),
    conversionRecords: (application.conversionRecords || []).map(cloneConversionRecord),
    transferRecords: (application.transferRecords || []).map(cloneTransferRecord),
  }
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
  '激光开袋',
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

function hasBasicMobileValue(value: string): boolean {
  const normalized = value.trim()
  return normalized.length >= 6 && /[0-9]/.test(normalized)
}

function hasValidIdentityFile(file: FactoryOnboardingIdentityFile | null): boolean {
  if (!file) return false
  return ['jpg', 'jpeg', 'png', 'pdf'].includes(file.fileType) && file.fileSizeMb > 0 && file.fileSizeMb <= 100
}

function calculateCompleteness(application: Pick<FactoryOnboardingApplication, 'factoryShortName' | 'applicantName' | 'identityNo' | 'identityFile' | 'factoryCompanyName' | 'address' | 'mobilePhone' | 'mobileOrWhatsapp' | 'sourceChannel' | 'ppicName' | 'machineTotalCount' | 'effectiveWorkerCount' | 'availableStartDate' | 'selectedCapabilities' | 'machines' | 'adminAccount'>) {
  const mobileValue = application.mobilePhone || application.mobileOrWhatsapp
  const mobileValid = hasBasicMobileValue(mobileValue)
  const capabilityCount = application.selectedCapabilities.filter((item) => item.processCode && item.craftCode).length
  const machineBaseCompleted = application.machines.filter((item) => item.machineName.trim() && item.machineCount > 0 && item.condition).length
  const machineLinkedCompleted = application.machines.filter((item) => item.validationStatus === '通过').length
  const items = [
    buildCompletenessItem('IDENTITY', '基础身份信息', 15, [application.applicantName.trim(), application.identityNo.trim(), hasValidIdentityFile(application.identityFile) ? 'valid' : ''].filter(Boolean).length, 3, hasValidIdentityFile(application.identityFile) ? '已完整' : '缺少身份证复印件/电子文件'),
    buildCompletenessItem('FACTORY_BASE', '工厂基础信息', 25, [application.factoryShortName.trim(), application.factoryCompanyName.trim(), application.address.trim(), mobileValid ? 'valid' : '', application.sourceChannel.trim(), application.ppicName.trim()].filter(Boolean).length, 6, mobileValid ? '已完整' : '请填写手机号'),
    buildCompletenessItem('WORKERS', '人员信息', 10, application.effectiveWorkerCount > 0 ? 1 : 0, 1, application.effectiveWorkerCount > 0 ? '已完整' : '有效工人数量未填写或小于等于 0'),
    buildCompletenessItem('MACHINES', '机器信息', 15, [application.machineTotalCount > 0 ? 'valid' : '', application.machines.length > 0 ? 'valid' : '', machineBaseCompleted >= application.machines.length && application.machines.length > 0 ? 'valid' : ''].filter(Boolean).length, 3, application.machineTotalCount > 0 ? '已完整' : '机器数量未填写或小于等于 0'),
    buildCompletenessItem('CAPABILITY', '工序工艺能力', 15, capabilityCount > 0 ? 1 : 0, 1, capabilityCount > 0 ? '已完整' : '至少需要选择一个工序工艺能力'),
    buildCompletenessItem('LINK', '机器与工序工艺关联', 10, application.machines.length > 0 ? machineLinkedCompleted : 0, Math.max(1, application.machines.length || 1), machineLinkedCompleted >= application.machines.length ? '已完整' : '存在机器未关联已选工序工艺'),
    buildCompletenessItem('AVAILABLE_DATE', '可开始合作时间', 5, application.availableStartDate.trim() ? 1 : 0, 1, application.availableStartDate.trim() ? '已完整' : '缺少可开始合作时间'),
  ]
  const score = Math.max(0, Math.min(100, items.reduce((total, item) => total + item.score, 0)))
  return {
    completenessScore: score,
    completenessLevel: getCompletenessLevel(score),
    completenessItems: items,
    completenessUpdatedAt: nowTimestamp(),
  }
}

function getCapabilityKeySet(capabilities: FactoryOnboardingSelectedCapability[]): Set<string> {
  return new Set(capabilities.map((item) => `${item.processCode}:${item.craftCode}`))
}

function resolveMachineValidation(machine: FactoryOnboardingMachineAbility, capabilities: FactoryOnboardingSelectedCapability[]) {
  if (!machine.linkedProcessCode) return { validationStatus: '未关联工序' as FactoryOnboardingMachineValidationStatus, validationMessage: '请选择机器关联工序' }
  if (!machine.linkedCraftCode) return { validationStatus: '未关联工艺' as FactoryOnboardingMachineValidationStatus, validationMessage: '请选择机器关联工艺' }
  const matched = getCapabilityKeySet(capabilities).has(`${machine.linkedProcessCode}:${machine.linkedCraftCode}`)
  if (!matched) {
    return {
      validationStatus: '工序工艺未在接单能力中选择' as FactoryOnboardingMachineValidationStatus,
      validationMessage: '该机器关联的工序工艺未在接单能力中选择，请先选择对应工序工艺。',
    }
  }
  return { validationStatus: '通过' as FactoryOnboardingMachineValidationStatus, validationMessage: '校验通过' }
}

function applyMachineValidations(
  machines: FactoryOnboardingMachineAbility[],
  capabilities: FactoryOnboardingSelectedCapability[],
): FactoryOnboardingMachineAbility[] {
  return machines.map((item) => {
    const validation = resolveMachineValidation(item, capabilities)
    return { ...item, validationStatus: validation.validationStatus, validationMessage: validation.validationMessage }
  })
}

function resolveFactoryTypeCode(capability: FactoryOnboardingSelectedCapability): FactoryInferredTypeCode | null {
  if (capability.processCode === 'CUT_PANEL' || ['普通裁', '激光定位裁', '定向裁', '定位裁'].includes(capability.craftName)) return 'CUTTING_FACTORY'
  if (capability.processCode === 'PRINT') return 'PRINTING_FACTORY'
  if (capability.processCode === 'DYE' || capability.processCode === 'WATER_SOLUBLE') return 'DYEING_FACTORY'
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
  if (primary === 'MULTI_CAPABILITY_FACTORY') return `同时命中 ${matchResults.map((item) => item.factoryTypeName).join('、')}，已按全能力工厂处理。`
  return matchResults.map((item) => `${item.factoryTypeName}：${item.matchedCapabilities.join('、')}`).join('；')
}

function normalizeNodeName(nodeName: string | undefined, status: FactoryOnboardingStatus): FactoryOnboardingNode {
  if (nodeName === '填写入驻申请' || nodeName === '平台审核' || nodeName === '样衣验证' || nodeName === '样衣审核' || nodeName === '正式合作' || nodeName === '完成') return nodeName
  if (nodeName === '填写入驻信息' || nodeName === '提交平台审核' || nodeName === '补充资料') return status === '待平台审核' ? '平台审核' : '填写入驻申请'
  if (nodeName === '确认' + '合作') return '样衣验证'
  if (nodeName === '生成工厂' + '档案') return '完成'
  return getOnboardingNodeByStatus(status)
}

function normalizeActionName(actionName: string): FactoryOnboardingActionName {
  const legacyApproved = '平台审核' + '通过'
  const legacyReturned = '平台审核' + '退回'
  const legacyRejected = '平台审核' + '拒绝'
  if (actionName === legacyApproved || actionName === '平台初审通过') return '平台初审已通过'
  if (actionName === legacyReturned || actionName === '平台退回补充' + '资料' || actionName === '平台初审退回') return '平台初审未通过'
  if (actionName === legacyRejected || actionName === '平台拒绝入驻') return '平台初审拒绝'
  return actionName as FactoryOnboardingActionName
}

function decorateApplication(rawApplication: FactoryOnboardingApplication): FactoryOnboardingApplication {
  const raw = rawApplication as FactoryOnboardingApplication & Record<string, unknown>
  const status = normalizeOnboardingStatus(String(raw.status || '草稿'))
  const factoryCompanyName = String(raw.factoryCompanyName || raw.factoryName || '')
  const applicantName = String(raw.applicantName || raw.bossName || raw.adminAccount?.adminName || '')
  const factoryShortName = String(raw.factoryShortName || raw.adminAccount?.loginId || '').trim()
  const mobilePhone = String(raw.mobilePhone || raw.mobileOrWhatsapp || raw.whatsapp || raw.adminAccount?.mobilePhone || raw.adminAccount?.mobileOrWhatsapp || raw.adminAccount?.whatsapp || '').trim()
  const mobileOrWhatsapp = mobilePhone
  const identityFile = (raw.identityFile as FactoryOnboardingIdentityFile | null | undefined) || null
  const adminAccount = buildAdminAccountFromFactoryShortName({
    factoryShortName,
    applicantName,
    mobilePhone,
    adminAccount: raw.adminAccount as Partial<FactoryOnboardingAdminAccount> | undefined,
    status,
    accountLocked: Boolean(raw.accountLocked),
  })
  const selectedCapabilities = ((raw.selectedCapabilities as FactoryOnboardingSelectedCapability[] | undefined) || []).map(cloneCapability)
  const machines = applyMachineValidations(((raw.machines as FactoryOnboardingMachineAbility[] | undefined) || []).map(cloneMachine), selectedCapabilities)
  const matchResults = inferFactoryTypes(selectedCapabilities)
  const primaryFactoryType = getPrimaryFactoryType(matchResults)
  const completeness = calculateCompleteness({
    applicantName,
    identityNo: String(raw.identityNo || ''),
    identityFile,
    factoryShortName,
    factoryCompanyName,
    address: String(raw.address || ''),
    mobilePhone,
    mobileOrWhatsapp,
    sourceChannel: String(raw.sourceChannel || ''),
    ppicName: String(raw.ppicName || ''),
    machineTotalCount: Number(raw.machineTotalCount) || 0,
    effectiveWorkerCount: Number(raw.effectiveWorkerCount) || 0,
    availableStartDate: String(raw.availableStartDate || ''),
    selectedCapabilities,
    machines,
    adminAccount,
  })
  const currentNode = getOnboardingNodeByStatus(status)
  const normalizedNodeLogs = ((raw.nodeLogs as FactoryOnboardingNodeLog[] | undefined) || []).map((item) => ({
    ...item,
    nodeName: normalizeNodeName(String(item.nodeName), status),
  }))
  const normalizedActionLogs = ((raw.actionLogs as FactoryOnboardingActionLog[] | undefined) || []).map((item) => ({
    ...item,
    actionName: normalizeActionName(String(item.actionName)),
    nodeName: normalizeNodeName(String(item.nodeName), status),
    fromStatus: item.fromStatus === '未提交' ? '未提交' : normalizeOnboardingStatus(String(item.fromStatus)),
    toStatus: item.toStatus === '未提交' ? '未提交' : normalizeOnboardingStatus(String(item.toStatus)),
    fromNode: item.fromNode === '未开始' ? '未开始' : normalizeNodeName(String(item.fromNode), status),
    toNode: normalizeNodeName(String(item.toNode), status),
  }))
  const normalizedReviewRecords = ((raw.reviewRecords as FactoryOnboardingReviewRecord[] | undefined) || []).map((item) => ({
    ...item,
    reviewResult: normalizeReviewResult(String(item.reviewResult)),
    requiredFields: item.requiredFields ? [...item.requiredFields] : [],
    fromStatus: normalizeOnboardingStatus(String(item.fromStatus)),
    toStatus: normalizeOnboardingStatus(String(item.toStatus)),
    fromNode: normalizeNodeName(String(item.fromNode), status),
    toNode: normalizeNodeName(String(item.toNode), status),
  }))
  const accountLocked = Boolean(raw.accountLocked)
  const rawTransferRecords = ((raw.transferRecords as FactoryOnboardingTransferRecord[] | undefined) || []).map(cloneTransferRecord)
  const rawConversionRecords = ((raw.conversionRecords as FactoryOnboardingConversionRecord[] | undefined) || []).map(cloneConversionRecord)
  const conversionRecords = rawConversionRecords.length > 0
    ? rawConversionRecords
    : rawTransferRecords
        .filter((item) => item.factoryProfileGenerated && item.factoryProfileId)
        .map((item, index): FactoryOnboardingConversionRecord => ({
          conversionId: `CONV-${String(item.transferId || index + 1)}`,
          convertedAt: item.operatedAt,
          convertedBy: item.operator,
          fromStatus: '样衣审核通过待转正式',
          toStatus: '已转正式合作',
          createdFactoryId: item.factoryProfileId || '',
          createdFactoryNo: item.factoryProfileId || '',
          adminAccountConverted: item.adminAccountGenerated,
          officialAdminAccountId: item.factoryProfileId ? `PDAU-${item.factoryProfileId}-ADMIN` : undefined,
          capacityProfileCreated: Boolean(item.capacityProfileGenerated),
          capacityProfileId: item.capacityProfileId,
          remark: item.remark,
        }))
  const assignedPpicId = String(raw.assignedPpicId || '')
  const assignedPpicName = String(raw.assignedPpicName || (assignedPpicId ? resolveOnboardingPpicName(assignedPpicId) : '') || '')
  const assignedPpicPhone = String(raw.assignedPpicPhone || raw.assignedPpicMobilePhone || '')
  const ppicChangeLogs = ((raw.ppicChangeLogs as FactoryOnboardingPpicChangeLog[] | undefined) || []).map(clonePpicChangeLog)
  return {
    applicationId: String(raw.applicationId || `FOA-${Date.now()}`),
    applicationNo: String(raw.applicationNo || `FON-${Date.now()}`),
    factoryTempId: String(raw.factoryTempId || `FACTORY-TEMP-${Date.now()}`),
    status,
    currentNode,
    adminAccount,
    factoryShortName,
    applicantName,
    identityNo: String(raw.identityNo || ''),
    identityFile,
    factoryCompanyName,
    factoryName: factoryCompanyName,
    bossName: applicantName,
    address: String(raw.address || ''),
    mobilePhone,
    mobileOrWhatsapp,
    whatsapp: mobileOrWhatsapp,
    sourceChannel: String(raw.sourceChannel || ''),
    ppicName: String(raw.ppicName || ''),
    assignedPpicId: assignedPpicId || undefined,
    assignedPpicName: assignedPpicName || undefined,
    assignedPpicPhone: assignedPpicPhone || undefined,
    assignedPpicAt: raw.assignedPpicAt as string | undefined,
    assignedPpicBy: raw.assignedPpicBy as string | undefined,
    ppicChangeLogs,
    machineTotalCount: Number(raw.machineTotalCount) || 0,
    effectiveWorkerCount: Number(raw.effectiveWorkerCount) || 0,
    availableStartDate: String(raw.availableStartDate || ''),
    selectedCapabilities,
    machines,
    submittedAt: raw.submittedAt as string | undefined,
    lastSubmittedAt: (raw.lastSubmittedAt || raw.submittedAt) as string | undefined,
    reviewedAt: raw.reviewedAt as string | undefined,
    sampleVerifiedAt: raw.sampleVerifiedAt as string | undefined,
    sampleIssuedAt: raw.sampleIssuedAt as string | undefined,
    sampleExpectedSubmitAt: raw.sampleExpectedSubmitAt as string | undefined,
    convertedAt: (raw.convertedAt || raw.contractedAt) as string | undefined,
    createdFactoryId: raw.createdFactoryId as string | undefined,
    nodeLogs: normalizedNodeLogs,
    actionLogs: normalizedActionLogs,
    reviewRecords: normalizedReviewRecords,
    supplementRecords: ((raw.supplementRecords as FactoryOnboardingSupplementRecord[] | undefined) || []).map(cloneSupplementRecord),
    accountLocked,
    accountLockedReason: (raw.accountLockedReason as string | undefined) || (accountLocked ? '历史账号状态不可用。' : undefined),
    factoryNameLocked: Boolean(raw.factoryNameLocked),
    lockedAt: raw.lockedAt as string | undefined,
    sampleVerificationId: raw.sampleVerificationId as string | undefined,
    sampleStatus: raw.sampleStatus as FactoryOnboardingSampleStatus | undefined,
    completenessScore: completeness.completenessScore,
    completenessLevel: completeness.completenessLevel,
    completenessItems: completeness.completenessItems,
    completenessUpdatedAt: completeness.completenessUpdatedAt,
    inferredFactoryTypes: matchResults,
    primaryFactoryType,
    factoryTypeMatchedAt: String(raw.factoryTypeMatchedAt || nowTimestamp()),
    factoryTypeMatchReason: buildFactoryTypeMatchReason(matchResults),
    conversionRecords,
    transferRecords: rawTransferRecords,
    contractedAt: (raw.convertedAt || raw.contractedAt) as string | undefined,
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
  if (!process) throw new Error(`未找到工序：${processName}`)
  const craft = getActiveCraftOptionsByProcess(process.processCode).find((item) => item.craftName === craftName)
  if (!craft) throw new Error(`未找到工艺：${processName} / ${craftName}`)
  return {
    processCode: process.processCode,
    processName: process.processName,
    craftCode: craft.craftCode,
    craftName: craft.craftName,
  }
}

function createCapability(processName: string, craftName: string, remark = ''): FactoryOnboardingSelectedCapability {
  return {
    ...resolveCraftByName(processName, craftName),
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
  reviewResult: FactoryOnboardingReviewResult
  reviewOpinion: string
  resubmitAllowed: boolean
  requiredFields?: FactoryOnboardingRequiredField[]
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
    resubmitAllowed: params.resubmitAllowed,
    requiredFields: params.requiredFields ? [...params.requiredFields] : [],
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

function createPpicChangeLog(params: {
  seed?: number
  fromPpicId?: string
  fromPpicName?: string
  toPpicId: string
  toPpicName: string
  changedAt: string
  changedBy: string
  changeReason: string
}): FactoryOnboardingPpicChangeLog {
  const idPrefix = params.seed ? `PPICLOG-${params.seed}` : `PPICLOG-${params.changedAt.replace(/[-: ]/g, '')}`
  return {
    changeLogId: `${idPrefix}-${params.toPpicId}`,
    fromPpicId: params.fromPpicId,
    fromPpicName: params.fromPpicName,
    toPpicId: params.toPpicId,
    toPpicName: params.toPpicName,
    changedAt: params.changedAt,
    changedBy: params.changedBy,
    changeReason: params.changeReason,
  }
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
    remark: params.remark || (params.condition === '维修中' ? '本月保养排程中' : params.condition === '停用' ? '备用产线停用' : '当前可承接任务'),
    validationStatus: '通过',
    validationMessage: '校验通过',
  }
  return machine
}

function createIdentityFile(seed: number): FactoryOnboardingIdentityFile {
  const fileType = seed % 4 === 0 ? 'pdf' : seed % 4 === 1 ? 'jpg' : seed % 4 === 2 ? 'jpeg' : 'png'
  return {
    fileId: `IDF-${String(seed).padStart(4, '0')}`,
    fileName: `身份文件-${String(seed).padStart(4, '0')}.${fileType}`,
    fileType,
    fileSizeMb: 2 + (seed % 9),
    uploadedAt: `2026-05-${String((seed % 9) + 1).padStart(2, '0')} 08:30:00`,
  }
}

function createBasePayload(
  seed: number,
  status: FactoryOnboardingStatus,
  capabilityNames: Array<[string, string]>,
  condition: FactoryOnboardingMachineAbility['condition'],
  machineScenario: 'valid' | 'missingProcess' | 'missingCraft' | 'capabilityMismatch' = 'valid',
): FactoryOnboardingDraftPayload {
  const selectedCapabilities = capabilityNames.map(([processName, craftName], index) => createCapability(processName, craftName, index === 0 ? '主接单能力' : '补充能力'))
  const baseCapability = selectedCapabilities[0]
  const machines: FactoryOnboardingMachineAbility[] = [createMachine({ seed: seed * 10 + 1, capability: baseCapability, condition })]
  if (machineScenario === 'missingProcess') {
    machines.push(createMachine({ seed: seed * 10 + 2, capability: baseCapability, condition, linkedProcessCode: '', linkedProcessName: '', linkedCraftCode: '', linkedCraftName: '', remark: '待补充工序信息' }))
  } else if (machineScenario === 'missingCraft') {
    machines.push(createMachine({ seed: seed * 10 + 2, capability: baseCapability, condition, linkedCraftCode: '', linkedCraftName: '', remark: '待补充工艺信息' }))
  } else if (machineScenario === 'capabilityMismatch') {
    const mismatchCapability = selectedCapabilities.some((item) => item.processCode === 'POST_FINISHING') ? createCapability('印花', '数码印', '异常演示能力') : createCapability('后道', '包装', '异常演示能力')
    machines.push(createMachine({ seed: seed * 10 + 2, capability: mismatchCapability, condition, remark: '当前机器关联能力未纳入接单能力' }))
  } else if (selectedCapabilities[1]) {
    machines.push(createMachine({ seed: seed * 10 + 2, capability: selectedCapabilities[1], condition }))
  }
  const normalizedMachines = applyMachineValidations(machines, selectedCapabilities)
  const applicantName = `申请人${seed}`
  const factoryShortName = `onboarding_${seed}`
  const mobilePhone = `+62-812-90${String(100000 + seed).slice(-6)}`
  const mobileOrWhatsapp = mobilePhone
  const factoryCompanyName = `${selectedCapabilities[0]?.craftName || '工艺'}演示工厂${seed}`
  return {
    applicationNo: createApplicationNo(seed),
    factoryTempId: createTempFactoryId(seed),
    factoryShortName,
    applicantName,
    identityNo: seed % 2 === 0 ? `ID-${String(3200000000000000 + seed)}` : `P-${String(88000000 + seed)}`,
    identityFile: createIdentityFile(seed),
    factoryCompanyName,
    factoryName: factoryCompanyName,
    bossName: applicantName,
    address: `雅加达示范工业园 ${seed} 号楼 ${seed % 6 + 1} 层`,
    mobilePhone,
    mobileOrWhatsapp,
    whatsapp: mobileOrWhatsapp,
    sourceChannel: seed % 3 === 0 ? 'PPIC 转介绍' : seed % 3 === 1 ? '平台招商消息' : '合作工厂推荐',
    ppicName: `PPIC-${seed}`,
    machineTotalCount: normalizedMachines.reduce((total, item) => total + item.machineCount, 0),
    effectiveWorkerCount: 18 + seed,
    availableStartDate: `2026-05-${String((seed % 9) + 10).padStart(2, '0')}`,
    selectedCapabilities,
    machines: normalizedMachines,
    adminAccount: {
      loginId: factoryShortName,
      password: '123456',
      adminName: applicantName,
      mobilePhone,
      mobileOrWhatsapp,
      whatsapp: mobileOrWhatsapp,
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: canFactoryEnterBusiness(status) ? '已转正式' : isFactoryAccountLocked(status) ? '已锁定' : '入驻中',
      isTemporary: !canFactoryEnterBusiness(status),
    },
  }
}

function createSeedApplication(
  seed: number,
  status: FactoryOnboardingStatus,
  capabilityNames: Array<[string, string]>,
  condition: FactoryOnboardingMachineAbility['condition'],
  machineScenario: 'valid' | 'missingProcess' | 'missingCraft' | 'capabilityMismatch' = 'valid',
): FactoryOnboardingApplication {
  const payload = createBasePayload(seed, status, capabilityNames, condition, machineScenario)
  const baseDay = (seed % 4) + 1
  const fillAt = `2026-05-${String(baseDay).padStart(2, '0')} 08:15:00`
  const submitAt = `2026-05-${String(baseDay).padStart(2, '0')} 09:${String((seed * 7) % 60).padStart(2, '0')}:00`
  const reviewAt = `2026-05-${String(baseDay + 1).padStart(2, '0')} 14:${String((seed * 5) % 60).padStart(2, '0')}:00`
  const sampleAt = `2026-05-${String(baseDay + 2).padStart(2, '0')} 10:${String((seed * 4) % 60).padStart(2, '0')}:00`
  const sampleReviewAt = `2026-05-${String(baseDay + 3).padStart(2, '0')} 11:${String((seed * 6) % 60).padStart(2, '0')}:00`
  const formalAt = `2026-05-${String(baseDay + 4).padStart(2, '0')} 16:${String((seed * 3) % 60).padStart(2, '0')}:00`
  const operator = `${payload.factoryCompanyName}管理员`
  const reviewer = '平台审核员'
  const nodeLogs: FactoryOnboardingNodeLog[] = []
  const actionLogs: FactoryOnboardingActionLog[] = []
  const reviewRecords: FactoryOnboardingReviewRecord[] = []
  const supplementRecords: FactoryOnboardingSupplementRecord[] = []
  const conversionRecords: FactoryOnboardingConversionRecord[] = []
  const transferRecords: FactoryOnboardingTransferRecord[] = []
  let actionSeq = 0

  actionLogs.push(createActionLog({
    seed,
    seq: ++actionSeq,
    actionName: '保存草稿',
    nodeName: '填写入驻申请',
    operator,
    operatedAt: fillAt,
    actionSequenceInNode: 1,
    fromStatus: '草稿',
    toStatus: '草稿',
    fromNode: '填写入驻申请',
    toNode: '填写入驻申请',
    remark: '首次保存入驻草稿',
  }))

  if (status === '草稿') {
    nodeLogs.push(createNodeLog({ seed, nodeName: '填写入驻申请', nodeStatus: '进行中', enteredAt: fillAt, actionCount: 1, lastActionAt: fillAt, operator, remark: '请补全入驻信息后提交平台审核。' }))
  } else {
    nodeLogs.push(createNodeLog({ seed, nodeName: '填写入驻申请', nodeStatus: '已完成', enteredAt: fillAt, leftAt: submitAt, actionCount: 2, lastActionAt: submitAt, operator, remark: '已完成入驻申请填写。' }))
    actionLogs.push(createActionLog({
      seed,
      seq: ++actionSeq,
      actionName: '提交入驻申请',
      nodeName: '平台审核',
      operator,
      operatedAt: submitAt,
      actionSequenceInNode: 1,
      fromStatus: '草稿',
      toStatus: '待平台审核',
      fromNode: '填写入驻申请',
      toNode: '平台审核',
      remark: '提交平台审核',
    }))
  }

  const afterPlatformReview = !['草稿', '待平台审核'].includes(status)
  if (status === '待平台审核') {
    nodeLogs.push(createNodeLog({ seed, nodeName: '平台审核', nodeStatus: '进行中', enteredAt: submitAt, actionCount: 1, lastActionAt: submitAt, operator: reviewer, remark: '等待平台审核。' }))
  }

  if (status === '平台审核退回') {
    const requiredFields: FactoryOnboardingRequiredField[] = seed % 3 === 1 ? ['机器明细', '工序工艺能力'] : seed % 3 === 2 ? ['地址', '可开始合作时间'] : ['身份证复印件/电子文件', '手机号']
    const reviewRecord = createReviewRecord({
      seed,
      round: 1,
      reviewResult: '未通过',
      reviewOpinion: '资料需补充，请根据退回项完善后重新提交。',
      resubmitAllowed: true,
      requiredFields,
      reviewer,
      reviewedAt: reviewAt,
      fromStatus: '待平台审核',
      toStatus: '平台审核退回',
      fromNode: '平台审核',
      toNode: '填写入驻申请',
    })
    reviewRecords.push(reviewRecord)
    supplementRecords.push(createSupplementRecord({ seed, round: 1, supplementReason: reviewRecord.reviewOpinion, requiredFields, submittedFields: [], relatedReviewId: reviewRecord.reviewId, status: '待补充' }))
    actionLogs.push(createActionLog({ seed, seq: ++actionSeq, actionName: '平台初审未通过', nodeName: '平台审核', operator: reviewer, operatedAt: reviewAt, actionSequenceInNode: 1, fromStatus: '待平台审核', toStatus: '平台审核退回', fromNode: '平台审核', toNode: '填写入驻申请', remark: `需补充字段：${requiredFields.join('、')}` }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '平台审核', nodeStatus: '已退回', enteredAt: submitAt, leftAt: reviewAt, actionCount: 1, lastActionAt: reviewAt, operator: reviewer, remark: '平台初审未通过，等待工厂补充资料。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '填写入驻申请', nodeStatus: '进行中', enteredAt: reviewAt, actionCount: 1, lastActionAt: reviewAt, operator, remark: '等待工厂补充资料后再次提交。' }))
  } else if (status === '平台审核拒绝') {
    reviewRecords.push(createReviewRecord({ seed, round: 1, reviewResult: '未通过', reviewOpinion: '历史记录已终止，当前仅用于兼容展示。', resubmitAllowed: true, reviewer, reviewedAt: reviewAt, fromStatus: '待平台审核', toStatus: '平台审核拒绝', fromNode: '平台审核', toNode: '完成' }))
    actionLogs.push(createActionLog({ seed, seq: ++actionSeq, actionName: '平台初审退回', nodeName: '平台审核', operator: reviewer, operatedAt: reviewAt, actionSequenceInNode: 1, fromStatus: '待平台审核', toStatus: '平台审核拒绝', fromNode: '平台审核', toNode: '完成', remark: '历史入驻记录已终止。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '平台审核', nodeStatus: '已终止', enteredAt: submitAt, leftAt: reviewAt, actionCount: 1, lastActionAt: reviewAt, operator: reviewer, remark: '历史入驻记录已终止。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '完成', nodeStatus: '已完成', enteredAt: reviewAt, leftAt: reviewAt, actionCount: 1, lastActionAt: reviewAt, operator: reviewer, remark: '历史入驻记录已终止。' }))
  } else if (afterPlatformReview) {
    reviewRecords.push(createReviewRecord({ seed, round: 1, reviewResult: '已通过', reviewOpinion: '资料齐全，进入待样衣验证。', resubmitAllowed: false, reviewer, reviewedAt: reviewAt, fromStatus: '待平台审核', toStatus: '待样衣验证', fromNode: '平台审核', toNode: '样衣验证' }))
    actionLogs.push(createActionLog({ seed, seq: ++actionSeq, actionName: '平台初审已通过', nodeName: '平台审核', operator: reviewer, operatedAt: reviewAt, actionSequenceInNode: 1, fromStatus: '待平台审核', toStatus: '待样衣验证', fromNode: '平台审核', toNode: '样衣验证', remark: '平台初审已通过，等待平台登记并发放样衣。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '平台审核', nodeStatus: '已完成', enteredAt: submitAt, leftAt: reviewAt, actionCount: 1, lastActionAt: reviewAt, operator: reviewer, remark: '平台初审已通过。' }))
  }

  let sampleStatus: FactoryOnboardingSampleStatus | undefined
  let sampleVerificationId: string | undefined
  let sampleVerifiedAt: string | undefined

  if ([
    '待样衣验证',
    '待工厂确认收样',
    '待工厂提交样衣审核',
    '待平台审核样衣',
    '样衣审核退回',
    '样衣审核拒绝',
    '样衣审核通过待转正式',
    '已转正式合作',
  ].includes(status)) {
    sampleVerificationId = status === '待样衣验证' ? undefined : `SV-${String(seed).padStart(4, '0')}`
    sampleStatus =
      status === '待样衣验证'
        ? '待平台登记样衣'
        : status === '已转正式合作'
          ? '已转正式合作'
          : status
    sampleVerifiedAt = status === '待样衣验证' ? undefined : reviewAt
  }

  if (status === '待样衣验证') {
    nodeLogs.push(createNodeLog({ seed, nodeName: '样衣验证', nodeStatus: '进行中', enteredAt: reviewAt, actionCount: 1, lastActionAt: reviewAt, operator: reviewer, remark: '等待平台登记并发放样衣。' }))
  }
  if (status === '待工厂确认收样') {
    actionLogs.push(createActionLog({ seed, seq: ++actionSeq, actionName: '平台登记并发放样衣', nodeName: '样衣验证', operator: reviewer, operatedAt: sampleAt, actionSequenceInNode: 2, fromStatus: '待样衣验证', toStatus: '待工厂确认收样', fromNode: '样衣验证', toNode: '样衣验证', remark: '平台已登记并发放样衣。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '样衣验证', nodeStatus: '进行中', enteredAt: reviewAt, actionCount: 2, lastActionAt: sampleAt, operator: reviewer, remark: '等待工厂确认收样。' }))
  }
  if (status === '待工厂提交样衣审核' || status === '样衣审核退回') {
    const fromStatus = status === '样衣审核退回' ? '待平台审核样衣' : '待工厂确认收样'
    actionLogs.push(createActionLog({ seed, seq: ++actionSeq, actionName: status === '样衣审核退回' ? '样衣审核未通过' : '工厂确认收到样衣', nodeName: status === '样衣审核退回' ? '样衣审核' : '样衣验证', operator: status === '样衣审核退回' ? reviewer : operator, operatedAt: sampleAt, actionSequenceInNode: 2, fromStatus, toStatus: status, fromNode: status === '样衣审核退回' ? '样衣审核' : '样衣验证', toNode: '样衣验证', remark: status === '样衣审核退回' ? '样衣审核未通过，后续可重新提交样衣资料。' : '工厂已确认收样，等待提交样衣审核资料。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '样衣验证', nodeStatus: status === '样衣审核退回' ? '已退回' : '进行中', enteredAt: reviewAt, actionCount: 2, lastActionAt: sampleAt, operator: reviewer, remark: status === '样衣审核退回' ? '样衣审核退回，等待后续重新提交功能。' : '等待工厂提交样衣审核。' }))
  }
  if (status === '待平台审核样衣') {
    actionLogs.push(createActionLog({ seed, seq: ++actionSeq, actionName: '工厂提交样衣审核', nodeName: '样衣审核', operator, operatedAt: sampleAt, actionSequenceInNode: 1, fromStatus: '待工厂提交样衣审核', toStatus: '待平台审核样衣', fromNode: '样衣验证', toNode: '样衣审核', remark: '待平台审核样衣。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '样衣验证', nodeStatus: '已完成', enteredAt: reviewAt, leftAt: sampleAt, actionCount: 2, lastActionAt: sampleAt, operator, remark: '已提交样衣资料。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '样衣审核', nodeStatus: '进行中', enteredAt: sampleAt, actionCount: 1, lastActionAt: sampleAt, operator: reviewer, remark: '等待平台审核样衣。' }))
  }
  if (status === '样衣审核拒绝') {
    actionLogs.push(createActionLog({ seed, seq: ++actionSeq, actionName: '样衣审核未通过', nodeName: '样衣审核', operator: reviewer, operatedAt: sampleReviewAt, actionSequenceInNode: 2, fromStatus: '待平台审核样衣', toStatus: '样衣审核拒绝', fromNode: '样衣审核', toNode: '完成', remark: '历史样衣审核记录已终止。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '样衣审核', nodeStatus: '已终止', enteredAt: sampleAt, leftAt: sampleReviewAt, actionCount: 2, lastActionAt: sampleReviewAt, operator: reviewer, remark: '历史样衣审核记录已终止。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '完成', nodeStatus: '已终止', enteredAt: sampleReviewAt, leftAt: sampleReviewAt, actionCount: 1, lastActionAt: sampleReviewAt, operator: reviewer, remark: '历史样衣审核记录已终止。' }))
  }
  if (status === '样衣审核通过待转正式' ||
    status === '已转正式合作') {
    actionLogs.push(createActionLog({
      seed,
      seq: ++actionSeq,
      actionName: '平台样衣审核通过',
      nodeName: '样衣审核',
      operator: reviewer,
      operatedAt: sampleReviewAt,
      actionSequenceInNode: 2,
      fromStatus: '待平台审核样衣',
      toStatus: '样衣审核通过待转正式',
      fromNode: '样衣审核',
      toNode: '正式合作',
      remark: '样衣审核通过，请等待平台转为正式合作工厂。',
    }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '样衣审核', nodeStatus: '已完成', enteredAt: sampleAt, leftAt: sampleReviewAt, actionCount: 2, lastActionAt: sampleReviewAt, operator: reviewer, remark: '样衣审核已通过。' }))
    nodeLogs.push(createNodeLog({ seed, nodeName: '正式合作', nodeStatus: status === '已转正式合作' ? '已完成' : '进行中', enteredAt: sampleReviewAt, leftAt: status === '已转正式合作' ? formalAt : undefined, actionCount: status === '已转正式合作' ? 2 : 1, lastActionAt: status === '已转正式合作' ? formalAt : sampleReviewAt, operator: reviewer, remark: status === '已转正式合作' ? '已转为正式合作工厂。' : '等待平台转为正式合作工厂。' }))
    if (status === '已转正式合作') {
      actionLogs.push(createActionLog({
        seed,
        seq: ++actionSeq,
        actionName: '样衣通过后转正式合作',
        nodeName: '正式合作',
        operator: reviewer,
        operatedAt: formalAt,
        actionSequenceInNode: 2,
        fromStatus: '样衣审核通过待转正式',
        toStatus: '已转正式合作',
        fromNode: '正式合作',
        toNode: '完成',
        remark: '样衣审核通过后转为正式合作工厂，生成正式档案、管理员账号和产能档案初始数据。',
      }))
      nodeLogs.push(createNodeLog({ seed, nodeName: '完成', nodeStatus: '已完成', enteredAt: formalAt, leftAt: formalAt, actionCount: 1, lastActionAt: formalAt, operator: reviewer, remark: '正式合作流程完成。' }))
      const officialFactoryId = `FACTORY-ONBOARD-${String(seed).padStart(4, '0')}`
      const officialFactoryNo = `FOF-${String(seed).padStart(4, '0')}`
      const officialAdminAccountId = `PDAU-${officialFactoryId}-ADMIN`
      const capacityProfileId = `FCP-${officialFactoryId}`
      conversionRecords.push({
        conversionId: `CONV-${seed}`,
        convertedAt: formalAt,
        convertedBy: reviewer,
        fromStatus: '样衣审核通过待转正式',
        toStatus: '已转正式合作',
        createdFactoryId: officialFactoryId,
        createdFactoryNo: officialFactoryNo,
        adminAccountConverted: true,
        officialAdminAccountId,
        capacityProfileCreated: true,
        capacityProfileId,
        remark: '样衣审核通过后转为正式合作工厂。',
      })
      transferRecords.push({
        transferId: `TR-${seed}`,
        factoryProfileGenerated: true,
        factoryProfileId: officialFactoryId,
        adminAccountGenerated: true,
        capacityProfileGenerated: true,
        capacityProfileId,
        operator: reviewer,
        operatedAt: formalAt,
        remark: '样衣审核通过后转为正式合作工厂。',
      })
    }
  }

  const createdFactoryId = status === '已转正式合作' ? `FACTORY-ONBOARD-${String(seed).padStart(4, '0')}` : undefined
  const shouldAssignPpic = [
    '待平台审核样衣',
    '样衣审核退回',
    '样衣审核通过待转正式',
    '已转正式合作',
  ].includes(status)
  const manuallyChangedPpic = [24, 27, 33].includes(seed)
  const activePpicOptions = listAvailableOnboardingPpicOptions()
  const defaultPpic = DEFAULT_FACTORY_ONBOARDING_PPIC
  const changedPpic = activePpicOptions.find((item) => item.ppicId !== defaultPpic.ppicId) || defaultPpic
  const assignedPpic = shouldAssignPpic ? (manuallyChangedPpic ? changedPpic : defaultPpic) : undefined
  const ppicChangeLogs: FactoryOnboardingPpicChangeLog[] = []
  if (shouldAssignPpic && assignedPpic) {
    ppicChangeLogs.push(createPpicChangeLog({
      seed,
      toPpicId: defaultPpic.ppicId,
      toPpicName: defaultPpic.ppicName,
      changedAt: sampleAt,
      changedBy: '系统默认分配',
      changeReason: '工厂提交样衣审核资料后自动分配默认 PPIC',
    }))
    if (manuallyChangedPpic && changedPpic.ppicId !== defaultPpic.ppicId) {
      ppicChangeLogs.push(createPpicChangeLog({
        seed,
        fromPpicId: defaultPpic.ppicId,
        fromPpicName: defaultPpic.ppicName,
        toPpicId: changedPpic.ppicId,
        toPpicName: changedPpic.ppicName,
        changedAt: sampleReviewAt,
        changedBy: '平台运营员',
        changeReason: '根据跟进区域调整 PPIC',
      }))
    }
  }
  return decorateApplication({
    applicationId: `FOA-${String(seed).padStart(4, '0')}`,
    applicationNo: payload.applicationNo || createApplicationNo(seed),
    factoryTempId: payload.factoryTempId || createTempFactoryId(seed),
    status,
    currentNode: getOnboardingNodeByStatus(status),
    adminAccount: payload.adminAccount,
    factoryShortName: payload.factoryShortName,
    applicantName: payload.applicantName,
    identityNo: payload.identityNo,
    identityFile: payload.identityFile,
    factoryCompanyName: payload.factoryCompanyName,
    factoryName: payload.factoryCompanyName,
    bossName: payload.applicantName,
    address: payload.address,
    mobilePhone: payload.mobilePhone,
    mobileOrWhatsapp: payload.mobileOrWhatsapp,
    whatsapp: payload.mobileOrWhatsapp,
    sourceChannel: payload.sourceChannel,
    ppicName: payload.ppicName,
    assignedPpicId: assignedPpic?.ppicId,
    assignedPpicName: assignedPpic?.ppicName,
    assignedPpicPhone: assignedPpic?.mobilePhone,
    assignedPpicAt: assignedPpic ? (manuallyChangedPpic ? sampleReviewAt : sampleAt) : undefined,
    assignedPpicBy: assignedPpic ? (manuallyChangedPpic ? '平台运营员' : '系统默认分配') : undefined,
    ppicChangeLogs,
    machineTotalCount: payload.machineTotalCount,
    effectiveWorkerCount: payload.effectiveWorkerCount,
    availableStartDate: payload.availableStartDate,
    selectedCapabilities: payload.selectedCapabilities,
    machines: payload.machines,
    submittedAt: status === '草稿' ? undefined : submitAt,
    lastSubmittedAt: status === '草稿' ? undefined : submitAt,
    reviewedAt: afterPlatformReview || status === '平台审核退回' || status === '平台审核拒绝' ? reviewAt : undefined,
    sampleVerifiedAt,
    sampleIssuedAt: sampleVerificationId ? sampleAt : undefined,
    sampleExpectedSubmitAt: sampleVerificationId ? sampleReviewAt : undefined,
    convertedAt: status === '已转正式合作' ? formalAt : undefined,
    contractedAt: status === '已转正式合作' ? formalAt : undefined,
    createdFactoryId,
    nodeLogs,
    actionLogs,
    reviewRecords,
    supplementRecords,
    accountLocked: false,
    accountLockedReason: undefined,
    factoryNameLocked: false,
    lockedAt: undefined,
    sampleVerificationId,
    sampleStatus,
    completenessScore: 0,
    completenessLevel: '不完整',
    completenessItems: [],
    completenessUpdatedAt: formalAt,
    inferredFactoryTypes: [],
    primaryFactoryType: 'CUTTING_FACTORY',
    factoryTypeMatchedAt: formalAt,
    factoryTypeMatchReason: '',
    conversionRecords,
    transferRecords,
  })
}

const CAPABILITY_SETS: Array<Array<[string, string]>> = [
  [['裁片', '定位裁']],
  [['印花', '数码印']],
  [['染色', '匹染']],
  [['后道', '包装']],
  [['特殊工艺', '打揽']],
  [['裁片', '定位裁'], ['印花', '数码印'], ['染色', '匹染']],
  [['印花', '丝网印']],
  [['染色', '色织']],
  [['特殊工艺', '打条']],
  [['绣花', '绣花']],
  [['后道', '包装']],
  [['裁片', '定向裁'], ['后道', '包装']],
]

function createSeedApplications(): FactoryOnboardingApplication[] {
  const statuses: FactoryOnboardingStatus[] = [
    '草稿',
    '待平台审核',
    '平台审核退回',
    '平台审核拒绝',
    '待样衣验证',
    '待工厂确认收样',
    '待工厂提交样衣审核',
    '待平台审核样衣',
    '样衣审核退回',
    '样衣审核拒绝',
    '样衣审核通过待转正式',
    '已转正式合作',
  ]
  const scenarios: Array<'valid' | 'missingProcess' | 'missingCraft' | 'capabilityMismatch'> = ['valid', 'missingProcess', 'missingCraft', 'capabilityMismatch']
  const statusSeeds = statuses.flatMap((status, statusIndex) =>
    [0, 1, 2].map((offset) => {
      const seed = statusIndex * 3 + offset + 1
      const capabilityNames = CAPABILITY_SETS[(statusIndex + offset) % CAPABILITY_SETS.length]
      const condition: FactoryOnboardingMachineAbility['condition'] = offset === 0 ? '可用' : offset === 1 ? '维修中' : '停用'
      const scenario = status === '草稿' || status === '平台审核退回'
        ? scenarios[(statusIndex + offset) % scenarios.length]
        : 'valid'
      return createSeedApplication(seed, status, capabilityNames, condition, scenario)
    }),
  )
  const dyeWaterSeed = createSeedApplication(
    statusSeeds.length + 1,
    '已转正式合作',
    [['染色', '匹染'], ['水溶', '水溶']],
    '可用',
    'valid',
  )
  return [...statusSeeds, dyeWaterSeed]
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
  return ensureApplicationStore().some((item) => item.applicationId !== excludeApplicationId && normalizeLoginId(item.adminAccount.loginId) === normalized)
}

export function isFactoryShortNameTaken(factoryShortName: string, currentApplicationId?: string): boolean {
  const normalized = normalizeFactoryShortName(factoryShortName)
  if (!normalized) return false
  const current = currentApplicationId ? ensureApplicationStore().find((item) => item.applicationId === currentApplicationId) : null
  const duplicatedApplication = ensureApplicationStore().some((item) =>
    item.applicationId !== currentApplicationId &&
    normalizeFactoryShortName(item.factoryShortName || item.adminAccount.loginId || '') === normalized,
  )
  if (duplicatedApplication) return true

  return listFactoryMasterRecords().some((factory) => {
    if (current && (factory.id === current.createdFactoryId || factory.onboardingApplicationId === current.applicationId)) return false
    const officialShortName = normalizeFactoryShortName(factory.factoryShortName || '')
    const officialNameFallback = normalizeFactoryShortName(factory.name || '')
    return officialShortName === normalized || (!officialShortName && officialNameFallback === normalized)
  })
}

export function validateFactoryShortNameUnique(factoryShortName: string, currentApplicationId?: string): void {
  if (!factoryShortName.trim()) throw new Error('请填写工厂简称')
  if (isFactoryShortNameTaken(factoryShortName, currentApplicationId)) throw new Error('工厂简称已存在，请更换')
}

export { DEFAULT_FACTORY_ONBOARDING_PPIC, FACTORY_ONBOARDING_PPIC_OPTIONS } from './factory-onboarding-ppic.ts'

export function getAvailableOnboardingPpicOptions() {
  return listAvailableOnboardingPpicOptions()
}

export function getOnboardingPpicName(ppicId: string): string {
  return resolveOnboardingPpicName(ppicId)
}

export function assignDefaultPpicForOnboarding(applicationId: string, operator = '系统默认分配'): FactoryOnboardingApplication {
  const application = getFactoryOnboardingApplicationById(applicationId)
  if (!application) throw new Error('未找到入驻申请')
  if (application.assignedPpicId) return application

  const assignedAt = nowTimestamp()
  const defaultPpic = DEFAULT_FACTORY_ONBOARDING_PPIC
  return saveFactoryOnboardingApplication({
    ...application,
    assignedPpicId: defaultPpic.ppicId,
    assignedPpicName: defaultPpic.ppicName,
    assignedPpicPhone: defaultPpic.mobilePhone,
    assignedPpicAt: assignedAt,
    assignedPpicBy: operator || '系统默认分配',
    ppicChangeLogs: [
      ...(application.ppicChangeLogs || []),
      createPpicChangeLog({
        toPpicId: defaultPpic.ppicId,
        toPpicName: defaultPpic.ppicName,
        changedAt: assignedAt,
        changedBy: operator || '系统默认分配',
        changeReason: '工厂提交样衣审核资料后自动分配默认 PPIC',
      }),
    ],
  })
}

export function updateOnboardingPpic(
  applicationId: string,
  nextPpicId: string,
  operator: string,
  changeReason = '',
): FactoryOnboardingApplication {
  const application = getFactoryOnboardingApplicationById(applicationId)
  if (!application) throw new Error('未找到入驻申请')
  if (!nextPpicId.trim()) throw new Error('请选择 PPIC')

  const nextPpic = getOnboardingPpicOptionById(nextPpicId)
  if (!nextPpic || nextPpic.status !== '启用') throw new Error('该 PPIC 不可用，请重新选择')
  if (application.assignedPpicId === nextPpic.ppicId) return application

  const changedAt = nowTimestamp()
  return saveFactoryOnboardingApplication({
    ...application,
    assignedPpicId: nextPpic.ppicId,
    assignedPpicName: nextPpic.ppicName,
    assignedPpicPhone: nextPpic.mobilePhone,
    assignedPpicAt: changedAt,
    assignedPpicBy: operator,
    ppicChangeLogs: [
      ...(application.ppicChangeLogs || []),
      createPpicChangeLog({
        fromPpicId: application.assignedPpicId,
        fromPpicName: application.assignedPpicName,
        toPpicId: nextPpic.ppicId,
        toPpicName: nextPpic.ppicName,
        changedAt,
        changedBy: operator,
        changeReason: changeReason.trim(),
      }),
    ],
  })
}

export function isFactoryCompanyNameLocked(factoryCompanyName: string, excludeApplicationId?: string): boolean {
  void factoryCompanyName
  void excludeApplicationId
  return false
}

export function canStartNewOnboarding(factoryCompanyName: string, excludeApplicationId?: string): boolean {
  return !isFactoryCompanyNameLocked(factoryCompanyName, excludeApplicationId)
}

export function getLockedFactoryNameReason(factoryCompanyName: string, excludeApplicationId?: string): string {
  void factoryCompanyName
  void excludeApplicationId
  return ''
}

export function isFactoryOnboardingFactoryCompanyNameLocked(factoryCompanyName: string, excludeApplicationId?: string): boolean {
  return isFactoryCompanyNameLocked(factoryCompanyName, excludeApplicationId)
}

export function createEmptyFactoryOnboardingDraft(): FactoryOnboardingDraftPayload {
  return {
    factoryShortName: '',
    applicantName: '',
    identityNo: '',
    identityFile: null,
    factoryCompanyName: '',
    factoryName: '',
    bossName: '',
    address: '',
    mobilePhone: '',
    mobileOrWhatsapp: '',
    whatsapp: '',
    sourceChannel: '',
    ppicName: '',
    machineTotalCount: 0,
    effectiveWorkerCount: 0,
    availableStartDate: '',
    selectedCapabilities: [],
    machines: [],
    adminAccount: {
      loginId: '',
      password: '123456',
      adminName: '',
      mobilePhone: '',
      mobileOrWhatsapp: '',
      whatsapp: '',
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: '入驻中',
      isTemporary: true,
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
    factoryName: application.factoryCompanyName,
    loggedAt: nowTimestamp(),
  }
}
