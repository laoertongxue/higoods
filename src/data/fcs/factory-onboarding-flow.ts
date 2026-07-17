import {
  FACTORY_ADMIN_ROLE_ID,
  FACTORY_ADMIN_ROLE_NAME,
  FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS,
  canCreateFactoryProfile,
  canFactoryEditOnboarding,
  canFactoryEnterBusiness,
  canFactorySubmitOnboarding,
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
  type FactoryOnboardingCompletenessLevel,
  type FactoryOnboardingConversionRecord,
  type FactoryOnboardingDraftPayload,
  type FactoryOnboardingIdentityFile,
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
  canStartNewOnboarding,
  buildAdminAccountFromFactoryShortName,
  getLockedFactoryNameReason,
  isFactoryOnboardingLoginIdTaken,
  validateFactoryShortNameUnique,
  listFactoryOnboardingApplications,
  saveFactoryOnboardingApplication,
  setFactoryOnboardingApplicantSession,
} from './factory-onboarding-store.ts'
import {
  clearPdaSession,
  getPdaSession,
  upsertOfficialFactoryAdminFromOnboarding,
} from './store-domain-pda.ts'
import { getActiveCraftOptionsByProcess, getActiveProcessOptions } from './process-craft-dict.ts'
import { upsertFactoryMasterRecord } from './factory-master-store.ts'
import {
  getSampleVerificationByApplicationId,
  getSampleVerificationById,
} from './factory-sample-verification-store.ts'
import { createInitialCapacityProfileFromOnboarding as createCapacityProfileFromOnboardingStore } from './factory-capacity-profile-mock.ts'
import type {
  Factory,
  FactoryCapacityProfile,
  FactoryProcessAbility,
  FactoryType,
} from './factory-types.ts'

export type PdaPostLoginSession =
  | { kind: 'PDA'; session: NonNullable<ReturnType<typeof getPdaSession>> }
  | { kind: 'ONBOARDING'; session: FactoryOnboardingApplicantSession; application: FactoryOnboardingApplication }

export type PdaFactoryAccessReasonCode =
  | 'UNAUTHENTICATED'
  | 'NO_APPLICATION'
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'RETURNED'
  | 'WAITING_SAMPLE'
  | 'SAMPLE_REVIEW'
  | 'FORMAL_PENDING'
  | 'LOCKED'
  | 'COOPERATED'

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
  reviewResult: FactoryOnboardingReviewResult | string
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

function hasBasicMobileValue(value: string): boolean {
  const normalized = value.trim()
  return normalized.length >= 6 && /[0-9]/.test(normalized)
}

function hasValidIdentityFile(file: FactoryOnboardingIdentityFile | null): boolean {
  if (!file) return false
  return ['jpg', 'jpeg', 'png', 'pdf'].includes(file.fileType) && file.fileSizeMb > 0 && file.fileSizeMb <= 100
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
  'factoryShortName' | 'applicantName' | 'identityNo' | 'identityFile' | 'factoryCompanyName' | 'address' | 'mobilePhone' | 'mobileOrWhatsapp' | 'sourceChannel' | 'ppicName' | 'machineTotalCount' | 'effectiveWorkerCount' | 'availableStartDate' | 'selectedCapabilities' | 'machines' | 'adminAccount'
>): {
  completenessScore: number
  completenessLevel: FactoryOnboardingCompletenessLevel
  completenessItems: FactoryOnboardingCompletenessItem[]
  completenessUpdatedAt: string
} {
  const mobileValue = application.mobilePhone || application.mobileOrWhatsapp
  const mobileValid = hasBasicMobileValue(mobileValue)
  const capabilityCount = application.selectedCapabilities.filter((item) => item.processCode && item.craftCode).length
  const machines = applyMachineValidation(application.machines, application.selectedCapabilities)
  const machineBaseCompleted = machines.filter((item) => item.machineName.trim() && item.machineCount > 0 && item.condition).length
  const linkedCompleted = machines.filter((item) => item.validationStatus === '通过').length

  const items = [
    buildCompletenessItem(
      'IDENTITY',
      '基础身份信息',
      15,
      [application.applicantName.trim(), application.identityNo.trim(), hasValidIdentityFile(application.identityFile) ? 'valid' : ''].filter(Boolean).length,
      3,
      !application.applicantName.trim()
        ? '缺少姓名'
        : !application.identityNo.trim()
          ? '缺少身份证号码/护照号码'
          : hasValidIdentityFile(application.identityFile)
            ? '已完整'
            : '缺少身份证复印件/电子文件',
    ),
    buildCompletenessItem(
      'FACTORY_BASE',
      '工厂基础信息',
      25,
      [
        application.factoryShortName.trim(),
        application.factoryCompanyName.trim(),
        application.address.trim(),
        mobileValid ? 'valid' : '',
        application.sourceChannel.trim(),
        application.ppicName.trim(),
      ].filter(Boolean).length,
      6,
      !application.factoryShortName.trim()
        ? '缺少工厂简称'
        : !application.factoryCompanyName.trim()
        ? '缺少工厂/公司名称'
        : !application.address.trim()
          ? '缺少地址'
          : !mobileValid
            ? '请填写手机号'
            : !application.sourceChannel.trim()
              ? '缺少来源'
              : application.ppicName.trim()
                ? '已完整'
                : '缺少收到此通知的 PPIC 姓名',
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
      15,
      [
        application.machineTotalCount > 0 ? 'valid' : '',
        machines.length > 0 ? 'valid' : '',
        machineBaseCompleted >= machines.length && machines.length > 0 ? 'valid' : '',
      ].filter(Boolean).length,
      3,
      application.machineTotalCount <= 0
        ? '机器数量未填写或小于等于 0'
        : machines.length <= 0
          ? '缺少机器明细'
          : machineBaseCompleted < machines.length
            ? '存在机器名称、数量或状态未补全'
            : '已完整',
    ),
    buildCompletenessItem(
      'CAPABILITY',
      '工序工艺能力',
      15,
      capabilityCount > 0 ? 1 : 0,
      1,
      capabilityCount > 0 ? '已完整' : '至少需要选择一个工序工艺能力',
    ),
    buildCompletenessItem(
      'MACHINE_CAPABILITY_LINK',
      '机器与工序工艺关联',
      10,
      machines.length > 0 ? linkedCompleted : 0,
      Math.max(1, machines.length || 1),
      machines.length <= 0
        ? '暂无机器明细'
        : linkedCompleted >= machines.length
          ? '已完整'
          : '存在机器未关联已选工序工艺',
    ),
    buildCompletenessItem(
      'AVAILABLE_DATE',
      '可开始合作时间',
      5,
      application.availableStartDate.trim() ? 1 : 0,
      1,
      application.availableStartDate.trim() ? '已完整' : '缺少可开始合作时间',
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
  'completenessItems' | 'factoryShortName' | 'applicantName' | 'identityNo' | 'identityFile' | 'factoryCompanyName' | 'address' | 'mobilePhone' | 'mobileOrWhatsapp' | 'sourceChannel' | 'ppicName' | 'machineTotalCount' | 'effectiveWorkerCount' | 'availableStartDate' | 'selectedCapabilities' | 'machines' | 'adminAccount'
>): FactoryOnboardingCompletenessItem[] {
  const items = application.completenessItems?.length
    ? application.completenessItems
    : calculateOnboardingCompleteness(application).completenessItems
  return items.filter((item) => !item.isCompleted)
}

function resolveFactoryTypeMatchCode(capability: FactoryOnboardingSelectedCapability): FactoryInferredTypeCode | null {
  if (capability.processCode === 'CUT_PANEL' || ['普通裁', '激光定位裁', '定向裁', '定位裁'].includes(capability.craftName)) return 'CUTTING_FACTORY'
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

function isSelectableCraft(processCode: string, craftCode: string): boolean {
  const craft = getActiveCraftOptionsByProcess(processCode).find((item) => item.craftCode === craftCode)
  if (!craft) return false
  return craft.isExternalTask || craft.isCapacityNode || processCode === 'POST_FINISHING'
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
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
      validationMessage: '该机器关联的工序工艺未在接单能力中选择，请先选择对应工序工艺。',
    }
  }
  return { validationStatus: '通过', validationMessage: '校验通过' }
}

export function applyMachineValidation(
  machines: FactoryOnboardingMachineAbility[],
  selectedCapabilities: FactoryOnboardingSelectedCapability[],
): FactoryOnboardingMachineAbility[] {
  return machines.map((item) => {
    const validation = getMachineValidationResult(item, selectedCapabilities)
    return {
      ...item,
      validationStatus: validation.validationStatus,
      validationMessage: validation.validationMessage,
    }
  })
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
    工厂简称: application.factoryShortName || application.adminAccount.loginId || '未填写',
    姓名: application.applicantName || '未填写',
    '身份证号码/护照号码': application.identityNo || '未填写',
    '身份证复印件/电子文件': application.identityFile?.fileName || '未上传',
    '工厂/公司名称': application.factoryCompanyName || '未填写',
    地址: application.address || '未填写',
    手机号: application.mobilePhone || application.mobileOrWhatsapp || '未填写',
    来源: application.sourceChannel || '未填写',
    '收到此通知的 PPIC 姓名': application.ppicName || '未填写',
    机器数量: application.machineTotalCount > 0 ? String(application.machineTotalCount) : '未填写',
    有效工人数量: application.effectiveWorkerCount > 0 ? String(application.effectiveWorkerCount) : '未填写',
    可开始合作时间: application.availableStartDate || '未填写',
    工序工艺能力: application.selectedCapabilities.length > 0
      ? application.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、')
      : '未填写',
    机器明细: application.machines.length > 0
      ? application.machines.map((item) => `${item.machineName || '未命名设备'}×${item.machineCount || 0}`).join('、')
      : '未填写',
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

export function refreshApplicationDerived(application: FactoryOnboardingApplication, now = nowTimestamp()): FactoryOnboardingApplication {
  const status = normalizeOnboardingStatus(application.status)
  const currentNode = getOnboardingNodeByStatus(status)
  const factoryShortName = application.factoryShortName || application.adminAccount.loginId || ''
  const mobilePhone = application.mobilePhone || application.mobileOrWhatsapp || application.whatsapp || application.adminAccount.mobilePhone || application.adminAccount.mobileOrWhatsapp || application.adminAccount.whatsapp || ''
  const mobileOrWhatsapp = mobilePhone
  const factoryCompanyName = application.factoryCompanyName || application.factoryName || ''
  const applicantName = application.applicantName || application.bossName || application.adminAccount.adminName || ''
  const adminAccount: FactoryOnboardingAdminAccount = buildAdminAccountFromFactoryShortName({
    factoryShortName,
    applicantName,
    mobilePhone,
    adminAccount: application.adminAccount,
    status,
    accountLocked: application.accountLocked,
  })
  const machines = applyMachineValidation(application.machines || [], application.selectedCapabilities || [])
  const matchResults = inferFactoryTypesFromCapabilities(application.selectedCapabilities || [])
  const primaryFactoryType = getPrimaryFactoryType(matchResults)
  const completeness = calculateOnboardingCompleteness({
    ...application,
    applicantName,
    factoryCompanyName,
    mobileOrWhatsapp,
    machines,
    adminAccount,
  })
  const accountLocked = Boolean(application.accountLocked)
  const next: FactoryOnboardingApplication = {
    ...application,
    status,
    currentNode,
    factoryShortName,
    applicantName,
    identityNo: application.identityNo || '',
    identityFile: application.identityFile || null,
    factoryCompanyName,
    factoryName: factoryCompanyName,
    bossName: applicantName,
    mobileOrWhatsapp,
    mobilePhone,
    whatsapp: mobileOrWhatsapp,
    sourceChannel: application.sourceChannel || '',
    ppicName: application.ppicName || '',
    machines,
    adminAccount,
    accountLocked,
    accountLockedReason: application.accountLockedReason || (accountLocked ? '历史账号状态不可用。' : undefined),
    factoryNameLocked: Boolean(application.factoryNameLocked),
    sampleStatus: application.sampleStatus || (status === '待样衣验证'
      ? '待平台登记样衣'
      : [
          '待工厂确认收样',
          '待工厂提交样衣审核',
          '待平台审核样衣',
          '样衣审核退回',
          '样衣审核拒绝',
          '样衣审核通过待转正式',
          '已转正式合作',
        ].includes(status)
        ? status as FactoryOnboardingApplication['sampleStatus']
        : undefined),
    sampleVerificationId: application.sampleVerificationId,
    sampleIssuedAt: application.sampleIssuedAt,
    sampleExpectedSubmitAt: application.sampleExpectedSubmitAt,
    completenessScore: completeness.completenessScore,
    completenessLevel: completeness.completenessLevel,
    completenessItems: completeness.completenessItems.map((item) => ({ ...item })),
    completenessUpdatedAt: now,
    inferredFactoryTypes: matchResults.map((item) => ({ ...item, matchedCapabilities: [...item.matchedCapabilities] })),
    primaryFactoryType,
    factoryTypeMatchedAt: now,
    factoryTypeMatchReason: buildFactoryTypeMatchReason(matchResults),
    nodeLogs: (application.nodeLogs || []).map((item) => ({ ...item, nodeName: item.nodeName })),
    actionLogs: (application.actionLogs || []).map((item) => ({
      ...item,
      fromStatus: item.fromStatus === '未提交' ? '未提交' : normalizeOnboardingStatus(item.fromStatus),
      toStatus: item.toStatus === '未提交' ? '未提交' : normalizeOnboardingStatus(item.toStatus),
    })),
    reviewRecords: (application.reviewRecords || []).map((item) => ({
      ...item,
      requiredFields: item.requiredFields ? [...item.requiredFields] : [],
      fromStatus: normalizeOnboardingStatus(item.fromStatus),
      toStatus: normalizeOnboardingStatus(item.toStatus),
    })),
    supplementRecords: (application.supplementRecords || []).map((item) => ({ ...item, requiredFields: [...item.requiredFields], submittedFields: [...item.submittedFields] })),
    transferRecords: application.transferRecords || [],
  }
  next.nodeLogs = next.nodeLogs.map((item) => refreshNodeLogDerived(item, next, now))
  return next
}

function cloneDraftPayload(payload: FactoryOnboardingDraftPayload): FactoryOnboardingDraftPayload {
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

  const factoryShortName = (payload.factoryShortName || payload.adminAccount.loginId || '').trim()
  const mobilePhone = (payload.mobilePhone || payload.mobileOrWhatsapp || payload.whatsapp || payload.adminAccount.mobilePhone || payload.adminAccount.mobileOrWhatsapp || payload.adminAccount.whatsapp || '').trim()
  const mobileOrWhatsapp = mobilePhone
  const applicantName = (payload.applicantName || payload.bossName || payload.adminAccount.adminName || '').trim()
  const factoryCompanyName = (payload.factoryCompanyName || payload.factoryName || '').trim()
  const adminAccount = buildAdminAccountFromFactoryShortName({
    factoryShortName,
    applicantName,
    mobilePhone,
    adminAccount: payload.adminAccount,
    status: '草稿',
  })

  return {
    applicationId: payload.applicationId,
    applicationNo: payload.applicationNo,
    factoryTempId: payload.factoryTempId,
    factoryShortName,
    applicantName,
    identityNo: payload.identityNo.trim(),
    identityFile: payload.identityFile || null,
    factoryCompanyName,
    factoryName: factoryCompanyName,
    bossName: applicantName,
    address: payload.address.trim(),
    mobilePhone,
    mobileOrWhatsapp,
    whatsapp: mobileOrWhatsapp,
    sourceChannel: payload.sourceChannel.trim(),
    ppicName: payload.ppicName.trim(),
    machineTotalCount: Number(payload.machineTotalCount) || 0,
    effectiveWorkerCount: Number(payload.effectiveWorkerCount) || 0,
    availableStartDate: payload.availableStartDate.trim(),
    selectedCapabilities,
    machines,
    adminAccount,
  }
}

function validateDraftIdentityForSave(payload: FactoryOnboardingDraftPayload, _confirmPassword: string): void {
  if (payload.factoryShortName.trim()) {
    validateFactoryShortNameUnique(payload.factoryShortName, payload.applicationId)
  }
  if (payload.factoryCompanyName.trim() && !canStartNewOnboarding(payload.factoryCompanyName, payload.applicationId)) {
    throw new Error(getLockedFactoryNameReason(payload.factoryCompanyName, payload.applicationId))
  }
}

export function validateFactoryOnboardingDraftPayload(payload: FactoryOnboardingDraftPayload, _confirmPassword = ''): void {
  validateFactoryShortNameUnique(payload.factoryShortName, payload.applicationId)
  if (!payload.applicantName.trim()) throw new Error('请填写姓名')
  if (!payload.identityNo.trim()) throw new Error('请填写身份证号码/护照号码')
  if (!hasValidIdentityFile(payload.identityFile)) throw new Error('请上传身份证复印件/电子文件')
  if (!payload.factoryCompanyName.trim()) throw new Error('请填写工厂/公司名称')
  if (!canStartNewOnboarding(payload.factoryCompanyName, payload.applicationId)) {
    throw new Error(getLockedFactoryNameReason(payload.factoryCompanyName, payload.applicationId))
  }
  if (!payload.address.trim()) throw new Error('请填写地址')
  if (!payload.mobilePhone.trim() || !hasBasicMobileValue(payload.mobilePhone)) throw new Error('请填写手机号')
  if (!payload.sourceChannel.trim()) throw new Error('请填写来源')
  if (!payload.ppicName.trim()) throw new Error('请填写收到此通知的 PPIC 姓名')
  if (!payload.effectiveWorkerCount) throw new Error('请填写有效工人数量')
  if (payload.effectiveWorkerCount <= 0) throw new Error('有效工人数量必须大于 0')
  if (!payload.machineTotalCount) throw new Error('请填写机器数量')
  if (payload.machineTotalCount <= 0) throw new Error('机器数量必须大于 0')
  if (!payload.availableStartDate.trim()) throw new Error('请选择可开始合作时间')

  if (payload.selectedCapabilities.length <= 0) throw new Error('请至少选择一个工序工艺')
  payload.selectedCapabilities.forEach((item) => {
    if (!item.processCode || !item.craftCode) throw new Error('请选择工序下的具体工艺')
    if (!isSelectableCraft(item.processCode, item.craftCode)) throw new Error('请选择工序下的具体工艺')
  })

  if (payload.machines.length <= 0) throw new Error('请至少添加一条机器明细')
  payload.machines.forEach((machine) => {
    if (!machine.machineName.trim()) throw new Error('请填写机器名称')
    if (!machine.machineCount) throw new Error('请填写机器数量')
    if (machine.machineCount <= 0) throw new Error('机器数量必须大于 0')
  })

  const validatedMachines = applyMachineValidation(payload.machines, payload.selectedCapabilities)
  const firstInvalid = validatedMachines.find((item) => item.validationStatus !== '通过')
  if (firstInvalid) throw new Error(firstInvalid.validationMessage)
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
    status,
    currentNode,
    factoryShortName: normalized.factoryShortName,
    applicantName: normalized.applicantName,
    identityNo: normalized.identityNo,
    identityFile: normalized.identityFile,
    factoryCompanyName: normalized.factoryCompanyName,
    factoryName: normalized.factoryCompanyName,
    bossName: normalized.applicantName,
    address: normalized.address,
    mobilePhone: normalized.mobilePhone,
    mobileOrWhatsapp: normalized.mobileOrWhatsapp,
    whatsapp: normalized.mobileOrWhatsapp,
    sourceChannel: normalized.sourceChannel,
    ppicName: normalized.ppicName,
    machineTotalCount: normalized.machineTotalCount,
    effectiveWorkerCount: normalized.effectiveWorkerCount,
    availableStartDate: normalized.availableStartDate,
    selectedCapabilities: normalized.selectedCapabilities,
    machines: normalized.machines,
    adminAccount: {
      ...normalized.adminAccount,
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: canFactoryEnterBusiness(status) ? '已转正式' : '入驻中',
    },
    submittedAt: undefined,
    lastSubmittedAt: undefined,
    reviewedAt: undefined,
    sampleVerifiedAt: undefined,
    sampleIssuedAt: undefined,
    sampleExpectedSubmitAt: undefined,
    convertedAt: undefined,
    createdFactoryId: undefined,
    nodeLogs: [createNodeLog(currentNode, '进行中', now, normalized.adminAccount.adminName || normalized.applicantName || '工厂用户', '创建入驻申请')],
    actionLogs: [],
    reviewRecords: [],
    supplementRecords: [],
    accountLocked: false,
    accountLockedReason: undefined,
    factoryNameLocked: false,
    lockedAt: undefined,
    sampleVerificationId: undefined,
    sampleStatus: undefined,
    completenessScore: 0,
    completenessLevel: '不完整',
    completenessItems: [],
    completenessUpdatedAt: now,
    inferredFactoryTypes: [],
    primaryFactoryType: 'CUTTING_FACTORY',
    factoryTypeMatchedAt: now,
    factoryTypeMatchReason: '',
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
      const next = { ...item, nodeStatus: closingStatus, leftAt: now, operator, remark: remark || item.remark }
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

  return refreshApplicationDerived({ ...application, currentNode: toNode, nodeLogs: nextNodeLogs }, now)
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
  return refreshApplicationDerived({
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
  }, input.operatedAt)
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
    草稿: '草稿',
    待平台审核: '待平台审核',
    平台审核退回: '平台审核退回',
    平台审核拒绝: '平台审核退回',
    待样衣验证: '待样衣验证',
    待工厂确认收样: '待确认收样',
    待工厂提交样衣审核: '待提交样衣审核',
    待平台审核样衣: '待平台审核样衣',
    样衣审核退回: '样衣审核退回',
    样衣审核拒绝: '样衣审核退回',
    样衣审核通过待转正式: '待转正式合作',
    已转正式合作: '已转正式合作',
  }
  return map[status]
}

export function saveFactoryOnboardingDraft(payload: FactoryOnboardingDraftPayload, confirmPassword: string): FactoryOnboardingApplication {
  const normalized = cloneDraftPayload(payload)
  validateDraftIdentityForSave(normalized, confirmPassword)
  const now = nowTimestamp()
  const operator = normalized.adminAccount.adminName || normalized.applicantName || '工厂用户'
  const existing = normalized.applicationId ? getFactoryOnboardingApplicationById(normalized.applicationId) : null

  if (!existing) {
    let application = buildApplicationFromPayload(normalized, '草稿', '填写入驻申请')
    application = appendAction(application, {
      actionName: '保存草稿',
      nodeName: '填写入驻申请',
      operator,
      operatedAt: now,
      fromStatus: '未提交',
      toStatus: '草稿',
      fromNode: '未开始',
      toNode: '填写入驻申请',
      remark: '保存入驻草稿',
    })
    const saved = saveFactoryOnboardingApplication(application)
    setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
    clearPdaSession()
    return saved
  }

  const current = refreshApplicationDerived(existing, now)
  if (!canFactoryEditOnboarding(current.status)) return current

  let updated = refreshApplicationDerived({
    ...current,
    ...normalized,
    selectedCapabilities: normalized.selectedCapabilities,
    machines: normalized.machines,
    adminAccount: {
      ...normalized.adminAccount,
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: current.adminAccount.accountStatus === '已转正式' ? '已转正式' : '入驻中',
    },
  }, now)

  updated = appendAction(updated, {
    actionName: '保存草稿',
    nodeName: current.currentNode,
    operator,
    operatedAt: now,
    fromStatus: current.status,
    toStatus: current.status,
    fromNode: current.currentNode,
    toNode: current.currentNode,
    remark: current.status === '平台审核退回' ? '根据平台意见暂存入驻资料' : '更新入驻草稿',
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
  const operator = normalized.adminAccount.adminName || normalized.applicantName || '工厂用户'
  const existing = normalized.applicationId ? getFactoryOnboardingApplicationById(normalized.applicationId) : null
  const current = existing ? refreshApplicationDerived(existing, now) : null
  const isResubmit = current?.status === '平台审核退回'

  let application = current
    ? refreshApplicationDerived({
        ...current,
        ...normalized,
        selectedCapabilities: normalized.selectedCapabilities,
        machines: normalized.machines,
        adminAccount: {
          ...normalized.adminAccount,
          roleId: FACTORY_ADMIN_ROLE_ID,
          roleName: FACTORY_ADMIN_ROLE_NAME,
          accountStatus: '入驻中',
        },
      }, now)
    : buildApplicationFromPayload(normalized, '草稿', '填写入驻申请')

  if (!canFactorySubmitOnboarding(application.status)) {
    throw new Error('当前状态不可提交入驻申请')
  }

  if (application.completenessScore < COMPLETENESS_SUBMIT_THRESHOLD) {
    throw new Error(`资料完整性不足 ${COMPLETENESS_SUBMIT_THRESHOLD} 分，请先补充必填信息后再提交。`)
  }

  const fromStatus = current?.status || '未提交'
  const fromNode = current?.currentNode || '填写入驻申请'
  const toStatus: FactoryOnboardingStatus = '待平台审核'

  application = appendAction(application, {
    actionName: isResubmit ? '工厂重新提交' : '提交入驻申请',
    nodeName: '平台审核',
    operator,
    operatedAt: now,
    fromStatus,
    toStatus,
    fromNode,
    toNode: '平台审核',
    remark: isResubmit ? '根据平台退回意见再次提交平台审核' : '首次提交平台审核',
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
            ? { ...item, status: '已重新提交', submittedAt: now, submittedBy: operator, submittedFields }
            : item,
        ),
      }
    }
  }

  application = refreshApplicationDerived({
    ...application,
    status: toStatus,
    currentNode: '平台审核',
    submittedAt: application.submittedAt || now,
    lastSubmittedAt: now,
  }, now)

  const saved = saveFactoryOnboardingApplication(application)
  setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
  clearPdaSession()
  return saved
}

export function authenticateFactoryOnboardingAdmin(loginId: string, password: string): FactoryOnboardingApplication | null {
  const application = findFactoryOnboardingApplicationByLoginId(loginId)
  if (!application) return null
  const normalized = refreshApplicationDerived(application)
  if (normalizeLoginId(normalized.adminAccount.loginId) !== normalizeLoginId(loginId)) return null
  if (normalized.adminAccount.password.trim() !== password.trim()) return null
  if (normalized.accountLocked) return null
  return normalized
}

export function getFactoryOnboardingLoginFailureMessage(loginId: string, password: string): string {
  const application = findFactoryOnboardingApplicationByLoginId(loginId)
  if (!application) return '账号或密码错误'
  const normalized = refreshApplicationDerived(application)
  if (normalizeLoginId(normalized.adminAccount.loginId) !== normalizeLoginId(loginId)) return '账号或密码错误'
  if (normalized.adminAccount.password.trim() !== password.trim()) return '账号或密码错误'
  if (normalized.accountLocked) {
    return '账号状态不可用'
  }
  return '账号或密码错误'
}

export function getFactoryOnboardingCurrentNodeSummary(application: FactoryOnboardingApplication): FactoryOnboardingNodeSummary {
  const current = refreshApplicationDerived(application)
  const currentNodeLog = getCurrentNodeLog(current)
  const lastAction = getLatestAction(current, current.currentNode) || getLatestAction(current)
  const actionCount = getNodeActionCount(current, current.currentNode)
  return {
    currentNode: current.currentNode,
    currentStatusLabel: current.status,
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
  if (pdaSession) return { kind: 'PDA', session: pdaSession }

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
  const application = refreshApplicationDerived(session.application)
  if (canFactoryEnterBusiness(application.status)) return returnTo?.trim() || '/fcs/pda/exec'
  return buildPdaAuthOnboardingPath(returnTo, application.applicationId)
}

function getPdaReasonCode(status: FactoryOnboardingStatus): PdaFactoryAccessReasonCode {
  if (status === '草稿') return 'DRAFT'
  if (status === '平台审核退回') return 'RETURNED'
  if (status === '平台审核拒绝') return 'RETURNED'
  if (status === '样衣审核拒绝') return 'WAITING_SAMPLE'
  if (status === '待样衣验证' || status === '待工厂确认收样' || status === '待工厂提交样衣审核' || status === '样衣审核退回') return 'WAITING_SAMPLE'
  if (status === '待平台审核样衣') return 'SAMPLE_REVIEW'
  if (status === '样衣审核通过待转正式') return 'FORMAL_PENDING'
  if (status === '已转正式合作') return 'COOPERATED'
  return 'UNDER_REVIEW'
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
      reasonLabel: '已转正式合作工厂，可进入业务页面',
      sessionKind: 'PDA',
      route: '/fcs/pda/exec',
      onboardingApplication: null,
      applicantSession: null,
      pdaSession: session.session,
    }
  }

  const application = refreshApplicationDerived(session.application)
  const canAccessBusiness = canFactoryEnterBusiness(application.status)
  return {
    isLoggedIn: true,
    canAccessBusiness,
    isCooperatedFactory: canAccessBusiness,
    reasonCode: getPdaReasonCode(application.status),
    reasonLabel: buildStatusTipLabel(application.status),
    sessionKind: 'ONBOARDING',
    route: canAccessBusiness ? '/fcs/pda/exec' : buildPdaAuthOnboardingPath(undefined, application.applicationId),
    onboardingApplication: application,
    applicantSession: session.session,
    pdaSession: null,
  }
}

export function ensurePdaAccessForRoute(targetRoute: string): { allowed: boolean; redirectPath?: string; reasonLabel?: string } {
  if (!targetRoute.startsWith('/fcs/pda')) {
    return { allowed: true }
  }

  if (targetRoute.startsWith('/fcs/pda/auth/login') || targetRoute.startsWith('/fcs/pda/auth/onboarding')) {
    return { allowed: true }
  }

  const accessState = getPdaFactoryAccessState()
  if (accessState.canAccessBusiness) return { allowed: true }

  const returnTo = targetRoute || '/fcs/pda/exec'
  if (!accessState.isLoggedIn) {
    return { allowed: false, redirectPath: buildPdaAuthLoginPath(returnTo), reasonLabel: accessState.reasonLabel }
  }

  if (accessState.reasonCode === 'LOCKED') {
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
    待平台审核: applications.filter((item) => item.status === '待平台审核').length,
    平台审核退回: applications.filter((item) => item.status === '平台审核退回' || item.status === '平台审核拒绝').length,
    待样衣验证: applications.filter((item) => item.status === '待样衣验证').length,
    样衣审核中: applications.filter((item) => item.status === '待平台审核样衣' || item.status === '样衣审核退回' || item.status === '样衣审核拒绝').length,
    待转正式: applications.filter((item) => item.status === '样衣审核通过待转正式').length,
    已转正式合作: applications.filter((item) => item.status === '已转正式合作').length,
  }
}

export function reviewFactoryOnboardingApplication(input: ReviewApplicationInput): FactoryOnboardingApplication {
  const { applicationId, reviewOpinion, reviewer } = input
  const reviewResult = normalizeReviewResult(input.reviewResult)
  const requiredFields = unique((input.requiredFields || []).filter((item): item is FactoryOnboardingRequiredField => FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS.includes(item)))
  if (!reviewOpinion.trim()) throw new Error('请填写审核意见')
  if (reviewResult === '未通过' && requiredFields.length <= 0) throw new Error('请至少选择一个需补充字段')

  const application = getFactoryOnboardingApplicationById(applicationId)
  if (!application) throw new Error('未找到入驻申请')
  const current = refreshApplicationDerived(application)
  if (current.status !== '待平台审核') throw new Error('当前状态不可审核')

  const now = nowTimestamp()
  const fromStatus = current.status
  const fromNode = current.currentNode
  let toStatus: FactoryOnboardingStatus
  let toNode: FactoryOnboardingNode
  let openingNodeStatus: FactoryOnboardingNodeStatus = '进行中'
  let actionName: FactoryOnboardingActionName
  let transitionRemark: string

  if (reviewResult === '已通过') {
    toStatus = '待样衣验证'
    toNode = '样衣验证'
    actionName = '平台初审已通过'
    transitionRemark = '平台初审已通过，等待平台登记并发放样衣'
  } else {
    toStatus = '平台审核退回'
    toNode = '填写入驻申请'
    openingNodeStatus = '进行中'
    actionName = '平台初审未通过'
    transitionRemark = '平台初审未通过，等待工厂补充资料'
  }

  let updated = appendAction(current, {
    actionName,
    nodeName: fromNode,
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
    closingStatus: reviewResult === '未通过' ? '已退回' : '已完成',
    openingStatus: openingNodeStatus,
    remark: transitionRemark,
  })

  const reviewId = `REV-${Date.now()}`
  const nextReviewRecord: FactoryOnboardingReviewRecord = {
    reviewId,
    reviewRoundNo: getNextReviewRoundNo(updated),
    reviewResult,
    reviewOpinion: reviewOpinion.trim(),
    resubmitAllowed: reviewResult === '未通过',
    requiredFields: reviewResult === '未通过' ? requiredFields : [],
    reviewer: reviewer.trim(),
    reviewedAt: now,
    fromStatus,
    toStatus,
    fromNode,
    toNode,
  }

  const supplementRecords = reviewResult === '未通过'
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

  updated = refreshApplicationDerived({
    ...updated,
    status: toStatus,
    currentNode: toNode,
    reviewedAt: now,
    sampleVerifiedAt: updated.sampleVerifiedAt,
    sampleVerificationId: updated.sampleVerificationId,
    sampleStatus: reviewResult === '已通过' ? '待平台登记样衣' : updated.sampleStatus,
    reviewRecords: [...updated.reviewRecords, nextReviewRecord],
    supplementRecords,
    accountLocked: false,
    accountLockedReason: undefined,
    factoryNameLocked: false,
    lockedAt: undefined,
    adminAccount: {
      ...updated.adminAccount,
      accountStatus: '入驻中',
    },
  }, now)

  const saved = saveFactoryOnboardingApplication(updated)
  const applicantSession = getFactoryOnboardingApplicantSession()
  if (applicantSession?.applicationId === saved.applicationId) {
    setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
  }
  return saved
}

function getOnboardingDigits(value: string): string {
  return value.replace(/\D/g, '').slice(-4).padStart(4, '0')
}

function mapOnboardingFactoryType(typeCode: FactoryInferredTypeCode): FactoryType {
  const map: Record<FactoryInferredTypeCode, FactoryType> = {
    CUTTING_FACTORY: 'CENTRAL_CUTTING',
    PRINTING_FACTORY: 'CENTRAL_PRINT',
    DYEING_FACTORY: 'CENTRAL_DYE',
    POST_FINISHING_FACTORY: 'SATELLITE_FINISHING',
    SPECIAL_CRAFT_FACTORY: 'CENTRAL_SPECIAL',
    SEWING_FACTORY: 'SATELLITE_SEWING',
    MULTI_CAPABILITY_FACTORY: 'CENTRAL_GARMENT',
  }
  return map[typeCode] || 'CENTRAL_GARMENT'
}

function buildFactoryProcessAbilitiesFromOnboarding(application: FactoryOnboardingApplication): FactoryProcessAbility[] {
  const grouped = new Map<string, FactoryProcessAbility>()
  application.selectedCapabilities.forEach((capability, index) => {
    const current = grouped.get(capability.processCode)
    if (current) {
      if (!current.craftCodes.includes(capability.craftCode)) current.craftCodes.push(capability.craftCode)
      const craftNames = current.craftNames || []
      if (!craftNames.includes(capability.craftName)) current.craftNames = [...craftNames, capability.craftName]
      current.canReceiveTask = Boolean(current.canReceiveTask || capability.canReceiveTask)
      current.capacityManaged = Boolean(current.capacityManaged || capability.capacityManaged)
      return
    }
    grouped.set(capability.processCode, {
      processCode: capability.processCode,
      craftCodes: [capability.craftCode],
      abilityId: `ONBOARDING-${application.applicationId}-${index + 1}`,
      processName: capability.processName,
      craftNames: [capability.craftName],
      abilityName: `${capability.processName}/${capability.craftName}`,
      abilityScope: 'CRAFT',
      canReceiveTask: capability.canReceiveTask,
      capacityManaged: capability.capacityManaged,
      status: 'ACTIVE',
    })
  })
  return [...grouped.values()]
}

function resolveOnboardingSewingSeatCount(application: FactoryOnboardingApplication, factoryType: FactoryType): number | undefined {
  const hasSewingCapability = factoryType === 'THIRD_SEWING' || application.selectedCapabilities.some((item) => item.processCode === 'SEW')
  if (!hasSewingCapability) return undefined
  return application.effectiveWorkerCount > 0 ? application.effectiveWorkerCount : undefined
}

function getPassedSampleVerification(application: FactoryOnboardingApplication) {
  if (application.sampleVerificationId) {
    const verification = getSampleVerificationById(application.sampleVerificationId)
    if (verification) return verification
  }
  return getSampleVerificationByApplicationId(application.applicationId)
}

export function canConvertOnboardingToOfficialFactory(application: FactoryOnboardingApplication | null | undefined): boolean {
  if (!application) return false
  if (!canCreateFactoryProfile(application.status)) return false
  if (application.createdFactoryId) return false
  if (!application.adminAccount || application.adminAccount.accountStatus === '已转正式') return false
  if (application.selectedCapabilities.length <= 0 || application.machines.length <= 0) return false
  const sampleVerification = getPassedSampleVerification(application)
  return sampleVerification?.status === '样衣审核通过'
}

export function validateOfficialFactoryConversion(application: FactoryOnboardingApplication): string[] {
  const errors: string[] = []
  if (!canCreateFactoryProfile(application.status)) {
    errors.push('只有样衣审核通过待转正式的申请可以转为正式合作工厂。')
  }
  if (application.createdFactoryId) {
    errors.push('当前申请已生成工厂档案，请勿重复转档。')
  }
  if (!application.adminAccount?.loginId || !application.adminAccount?.adminName || !application.adminAccount?.password) {
    errors.push('当前申请缺少管理员账号，不能转正式。')
  }
  if (application.selectedCapabilities.length <= 0) {
    errors.push('当前申请缺少工序工艺能力，不能生成工厂档案。')
  }
  if (application.machines.length <= 0) {
    errors.push('当前申请缺少机器能力，不能生成产能档案初始数据。')
  }
  const sampleVerification = getPassedSampleVerification(application)
  if (canCreateFactoryProfile(application.status) && sampleVerification?.status !== '样衣审核通过') {
    errors.push('样衣验证未通过，不能转正式。')
  }
  return errors
}

export function buildFactoryProfileFromOnboarding(application: FactoryOnboardingApplication): Factory {
  const digits = getOnboardingDigits(application.applicationId || application.applicationNo)
  const factoryId = `FACTORY-ONBOARD-${digits}`
  const now = nowTimestamp()
  const factoryType = mapOnboardingFactoryType(application.primaryFactoryType)
  const sewingSeatCount = resolveOnboardingSewingSeatCount(application, factoryType)
  const processAbilities = buildFactoryProcessAbilitiesFromOnboarding(application)
  const sampleVerification = getPassedSampleVerification(application)
  return {
    id: factoryId,
    code: `FOF-${digits}`,
    name: application.factoryCompanyName,
    factoryShortName: application.factoryShortName,
    address: application.address,
    contact: application.applicantName,
    mobilePhone: application.mobilePhone,
    phone: application.mobilePhone || application.mobileOrWhatsapp,
    status: 'active',
    cooperationMode: 'general',
    processAbilities,
    qualityScore: 0,
    deliveryScore: 0,
    createdAt: now,
    updatedAt: now,
    factoryTier: factoryType.startsWith('SATELLITE') ? 'SATELLITE' : 'CENTRAL',
    factoryType,
    pdaEnabled: true,
    pdaTenantId: factoryId,
    primaryFactoryType: application.primaryFactoryType,
    inferredFactoryTypes: application.inferredFactoryTypes,
    factoryTypeMatchedAt: application.factoryTypeMatchedAt,
    factoryTypeMatchReason: application.factoryTypeMatchReason,
    onboardingApplicationId: application.applicationId,
    onboardingApplicationNo: application.applicationNo,
    sourceChannel: application.sourceChannel,
    ppicName: application.ppicName,
    assignedPpicId: application.assignedPpicId,
    assignedPpicName: application.assignedPpicName,
    assignedPpicPhone: application.assignedPpicPhone,
    identityNo: application.identityNo,
    identityFile: application.identityFile,
    machineTotalCount: application.machineTotalCount,
    effectiveWorkerCount: application.effectiveWorkerCount,
    sewingSeatCount,
    availableStartDate: application.availableStartDate,
    selectedCapabilities: application.selectedCapabilities.map((item) => ({ ...item })),
    machines: application.machines.map((item) => ({ ...item })),
    sampleVerificationId: application.sampleVerificationId,
    sampleStatus: '样衣审核通过',
    bossIdentityNo: sampleVerification?.bossIdentityNo,
    bossIdentityFiles: sampleVerification?.bossIdentityFiles?.map((item) => ({ ...item })) || [],
    factorySitePhotos: sampleVerification?.factorySitePhotos?.map((item) => ({ ...item })) || [],
    factorySiteVideos: sampleVerification?.factorySiteVideos?.map((item) => ({ ...item })) || [],
    eligibility: {
      allowDispatch: true,
      allowBid: true,
      allowExecute: true,
      allowSettle: true,
    },
  }
}

export async function convertOnboardingAdminAccountToOfficial(
  application: FactoryOnboardingApplication,
  createdFactory: Factory,
) {
  return upsertOfficialFactoryAdminFromOnboarding({
    applicationId: application.applicationId,
    adminName: application.adminAccount.adminName,
    loginId: application.adminAccount.loginId,
    password: application.adminAccount.password,
    createdFactory,
    convertedAt: nowTimestamp(),
    updatedBy: '平台转档',
  })
}

export function createInitialCapacityProfileFromOnboarding(
  application: FactoryOnboardingApplication,
  createdFactory: Factory,
): FactoryCapacityProfile {
  return createCapacityProfileFromOnboardingStore(application, createdFactory)
}

export function buildOfficialFactoryConversionRecord(
  application: FactoryOnboardingApplication,
  createdFactory: Factory,
  capacityProfile: FactoryCapacityProfile,
  operator: string,
  officialAdminAccountId?: string,
): FactoryOnboardingConversionRecord {
  const convertedAt = nowTimestamp()
  return {
    conversionId: `CONV-${application.applicationId}-${convertedAt.replace(/[-: ]/g, '')}`,
    convertedAt,
    convertedBy: operator.trim() || '平台转档',
    fromStatus: '样衣审核通过待转正式',
    toStatus: '已转正式合作',
    createdFactoryId: createdFactory.id,
    createdFactoryNo: createdFactory.code,
    adminAccountConverted: true,
    officialAdminAccountId: officialAdminAccountId || `PDAU-${createdFactory.id}-ADMIN`,
    capacityProfileCreated: true,
    capacityProfileId: capacityProfile.capacityProfileId,
    remark: '样衣审核通过后转为正式合作工厂。',
  }
}

export async function convertOnboardingToOfficialFactory(
  applicationId: string,
  operator: string,
): Promise<{
  application: FactoryOnboardingApplication
  createdFactory: Factory
  capacityProfile: FactoryCapacityProfile
  conversionRecord: FactoryOnboardingConversionRecord
}> {
  const application = getFactoryOnboardingApplicationById(applicationId)
  if (!application) throw new Error('未找到入驻申请')
  const errors = validateOfficialFactoryConversion(application)
  if (errors.length > 0) throw new Error(errors[0])
  if (!canConvertOnboardingToOfficialFactory(application)) {
    throw new Error('只有样衣审核通过待转正式的申请可以转为正式合作工厂。')
  }

  const operatedAt = nowTimestamp()
  const operatedBy = operator.trim() || '平台转档'
  const createdFactory = buildFactoryProfileFromOnboarding(application)
  upsertFactoryMasterRecord(createdFactory)
  const officialAdminAccount = await upsertOfficialFactoryAdminFromOnboarding({
    applicationId: application.applicationId,
    adminName: application.adminAccount.adminName,
    loginId: application.adminAccount.loginId,
    password: application.adminAccount.password,
    createdFactory,
    convertedAt: operatedAt,
    updatedBy: operatedBy,
  })
  const capacityProfile = createInitialCapacityProfileFromOnboarding(application, createdFactory)
  const conversionRecord: FactoryOnboardingConversionRecord = {
    ...buildOfficialFactoryConversionRecord(application, createdFactory, capacityProfile, operatedBy, officialAdminAccount.userId),
    convertedAt: operatedAt,
    convertedBy: operatedBy,
  }

  let updated = refreshApplicationDerived({
    ...application,
    status: '已转正式合作',
    currentNode: '完成',
    convertedAt: operatedAt,
    contractedAt: operatedAt,
    createdFactoryId: createdFactory.id,
    sampleStatus: '已转正式合作',
    accountLocked: false,
    accountLockedReason: undefined,
    factoryNameLocked: false,
    adminAccount: {
      ...application.adminAccount,
      roleId: FACTORY_ADMIN_ROLE_ID,
      roleName: FACTORY_ADMIN_ROLE_NAME,
      accountStatus: '已转正式',
    },
    conversionRecords: [...(application.conversionRecords || []), conversionRecord],
    transferRecords: [
      ...(application.transferRecords || []),
      {
        transferId: conversionRecord.conversionId.replace(/^CONV-/, 'TR-'),
        factoryProfileGenerated: true,
        factoryProfileId: createdFactory.id,
        adminAccountGenerated: true,
        capacityProfileGenerated: true,
        capacityProfileId: capacityProfile.capacityProfileId,
        operator: operatedBy,
        operatedAt,
        remark: conversionRecord.remark,
      },
    ],
  }, operatedAt)

  updated = appendAction(updated, {
    actionName: '样衣通过后转正式合作',
    nodeName: '正式合作',
    operator: operatedBy,
    operatedAt,
    fromStatus: '样衣审核通过待转正式',
    toStatus: '已转正式合作',
    fromNode: '正式合作',
    toNode: '完成',
    remark: '生成正式工厂档案、转正管理员账号并生成产能档案初始数据。',
  })
  updated = updateNodeLogOnTransition(updated, '正式合作', '完成', '样衣通过后转正式合作', operatedBy, {
    now: operatedAt,
    closingStatus: '已完成',
    openingStatus: '已完成',
    remark: '正式合作流程完成。',
  })
  const saved = saveFactoryOnboardingApplication(updated)
  const applicantSession = getFactoryOnboardingApplicantSession()
  if (applicantSession?.applicationId === saved.applicationId) {
    setFactoryOnboardingApplicantSession(createFactoryOnboardingApplicantSession(saved))
  }
  return { application: saved, createdFactory, capacityProfile, conversionRecord }
}

export async function confirmFactoryOnboardingCooperation(input: { applicationId: string; operator: string }): Promise<FactoryOnboardingApplication> {
  const result = await convertOnboardingToOfficialFactory(input.applicationId, input.operator)
  return result.application
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
  if (application.status === '平台审核退回') return '重新提交入驻申请'
  if (application.status === '草稿') return '提交入驻申请'
  return '查看入驻进度'
}

export function canEditOnboardingApplication(application: FactoryOnboardingApplication | null): boolean {
  if (!application) return true
  return canFactoryEditOnboarding(application.status)
}

export function canSubmitOnboardingApplication(application: FactoryOnboardingApplication | null): boolean {
  if (!application) return true
  return canFactorySubmitOnboarding(application.status)
}

export function getOnboardingStatusTip(application: FactoryOnboardingApplication | null): string {
  if (!application) return '请补全入驻信息后提交平台审核。'
  return buildStatusTipLabel(normalizeOnboardingStatus(application.status))
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

export {
  canCreateFactoryProfile,
  canFactoryEditOnboarding,
  canFactoryEnterBusiness,
  canFactorySubmitOnboarding,
  getOnboardingNodeByStatus,
  isFactoryAccountLocked,
  normalizeOnboardingStatus,
}
