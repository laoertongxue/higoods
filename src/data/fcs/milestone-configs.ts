import { OWN_WOOL_FACTORY_ID } from './factory-mock-data.ts'
import { getFactoryMasterRecordById } from './factory-master-store.ts'
import { processTasks } from './process-tasks'

export type MilestoneRuleType = 'AFTER_N_PIECES' | 'AFTER_N_YARD'
export type MilestoneTargetUnit = 'PIECE' | 'YARD'
export type MilestoneProofRequirement = 'NONE' | 'IMAGE' | 'VIDEO' | 'IMAGE_OR_VIDEO'
export type MilestoneExceptionSeverity = 'S1' | 'S2' | 'S3'
export type ExecutionFactoryTypeScope =
  | 'ALL'
  | 'OWN_WOOL_FACTORY'
  | 'PROCESS_FACTORY'
  | 'CUTTING_FACTORY'
  | 'POST_FACTORY'
export type ExecutionTaskTypeScope =
  | 'ALL'
  | 'WHOLE_GARMENT'
  | 'PART_PANEL'
  | 'CUTTING'
  | 'PRINT_DYE'
  | 'SEWING'
  | 'POST_FINISHING'
  | 'SPECIAL_CRAFT'

export interface MilestoneConfig {
  id: string
  processCode: string
  processNameZh: string
  factoryTypeScope: ExecutionFactoryTypeScope
  factoryTypeScopeLabel: string
  taskTypeScope: ExecutionTaskTypeScope
  taskTypeScopeLabel: string
  startRequired: boolean
  startProofRequirement: MilestoneProofRequirement
  startProofRequirementLabel: string
  startDueHours: number
  enabled: boolean
  ruleType: MilestoneRuleType
  targetQty: number
  targetUnit: MilestoneTargetUnit
  ruleLabel: string
  proofRequirement: MilestoneProofRequirement
  proofRequirementLabel: string
  overdueExceptionEnabled: boolean
  overdueHours: number
  exceptionSeverity: MilestoneExceptionSeverity
  updatedAt: string
  updatedBy: string
  remark?: string
}

export interface MilestoneProcessOption {
  processCode: string
  processNameZh: string
}

export const MILESTONE_RULE_TYPE_LABEL: Record<MilestoneRuleType, string> = {
  AFTER_N_PIECES: '完成第 N 件后上报',
  AFTER_N_YARD: '完成第 N Yard 后上报',
}

export const MILESTONE_TARGET_UNIT_LABEL: Record<MilestoneTargetUnit, string> = {
  PIECE: '件',
  YARD: 'Yard',
}

export const MILESTONE_PROOF_REQUIREMENT_LABEL: Record<MilestoneProofRequirement, string> = {
  NONE: '不要求凭证',
  IMAGE: '要求上传图片',
  VIDEO: '要求上传视频',
  IMAGE_OR_VIDEO: '图片或视频任选其一',
}

export const EXECUTION_FACTORY_TYPE_SCOPE_LABEL: Record<ExecutionFactoryTypeScope, string> = {
  ALL: '全部工厂类型',
  OWN_WOOL_FACTORY: '自有毛织厂',
  PROCESS_FACTORY: '工序工艺工厂',
  CUTTING_FACTORY: '裁床厂',
  POST_FACTORY: '后道工厂',
}

export const EXECUTION_TASK_TYPE_SCOPE_LABEL: Record<ExecutionTaskTypeScope, string> = {
  ALL: '全部任务类型',
  WHOLE_GARMENT: '整件毛织',
  PART_PANEL: '部位毛织',
  CUTTING: '裁片任务',
  PRINT_DYE: '印花 / 染色任务',
  SEWING: '车缝任务',
  POST_FINISHING: '后道任务',
  SPECIAL_CRAFT: '特殊工艺任务',
}

export interface UpsertMilestoneConfigPayload {
  processCode: string
  processNameZh: string
  factoryTypeScope: ExecutionFactoryTypeScope
  taskTypeScope: ExecutionTaskTypeScope
  startRequired: boolean
  startProofRequirement: MilestoneProofRequirement
  startDueHours: number
  enabled: boolean
  ruleType: MilestoneRuleType
  targetQty: number
  proofRequirement: MilestoneProofRequirement
  overdueExceptionEnabled: boolean
  overdueHours: number
  remark?: string
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

export function getMilestoneTargetUnitByRuleType(ruleType: MilestoneRuleType): MilestoneTargetUnit {
  return ruleType === 'AFTER_N_YARD' ? 'YARD' : 'PIECE'
}

export function buildMilestoneRuleLabel(
  ruleType: MilestoneRuleType,
  targetQty: number,
  targetUnit?: MilestoneTargetUnit,
): string {
  const safeQty = Math.max(1, Math.floor(targetQty))
  const unit = targetUnit || getMilestoneTargetUnitByRuleType(ruleType)
  if (unit === 'YARD') return `完成第 ${safeQty} Yard 后上报`
  return `完成第 ${safeQty} 件后上报`
}

const milestoneConfigs: MilestoneConfig[] = [
  {
    id: 'MC-PROC-SEW',
    processCode: 'PROC_SEW',
    processNameZh: '车缝',
    factoryTypeScope: 'PROCESS_FACTORY',
    factoryTypeScopeLabel: EXECUTION_FACTORY_TYPE_SCOPE_LABEL.PROCESS_FACTORY,
    taskTypeScope: 'SEWING',
    taskTypeScopeLabel: EXECUTION_TASK_TYPE_SCOPE_LABEL.SEWING,
    startRequired: true,
    startProofRequirement: 'IMAGE_OR_VIDEO',
    startProofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE_OR_VIDEO,
    startDueHours: 48,
    enabled: true,
    ruleType: 'AFTER_N_PIECES',
    targetQty: 5,
    targetUnit: 'PIECE',
    ruleLabel: buildMilestoneRuleLabel('AFTER_N_PIECES', 5),
    proofRequirement: 'IMAGE_OR_VIDEO',
    proofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE_OR_VIDEO,
    overdueExceptionEnabled: true,
    overdueHours: 48,
    exceptionSeverity: 'S2',
    updatedAt: '2026-03-12 10:00:00',
    updatedBy: '平台运营',
    remark: '车缝工序统一要求关键节点上报',
  },
  {
    id: 'MC-PROC-IRON',
    processCode: 'PROC_IRON',
    processNameZh: '整烫',
    factoryTypeScope: 'POST_FACTORY',
    factoryTypeScopeLabel: EXECUTION_FACTORY_TYPE_SCOPE_LABEL.POST_FACTORY,
    taskTypeScope: 'POST_FINISHING',
    taskTypeScopeLabel: EXECUTION_TASK_TYPE_SCOPE_LABEL.POST_FINISHING,
    startRequired: true,
    startProofRequirement: 'IMAGE',
    startProofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE,
    startDueHours: 48,
    enabled: true,
    ruleType: 'AFTER_N_YARD',
    targetQty: 20,
    targetUnit: 'YARD',
    ruleLabel: buildMilestoneRuleLabel('AFTER_N_YARD', 20),
    proofRequirement: 'IMAGE',
    proofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE,
    overdueExceptionEnabled: true,
    overdueHours: 48,
    exceptionSeverity: 'S2',
    updatedAt: '2026-03-12 10:30:00',
    updatedBy: '平台运营',
    remark: '整烫工序采用 Yard 阈值示例',
  },
  {
    id: 'MC-PROC-CUT',
    processCode: 'PROC_CUT',
    processNameZh: '裁片',
    factoryTypeScope: 'CUTTING_FACTORY',
    factoryTypeScopeLabel: EXECUTION_FACTORY_TYPE_SCOPE_LABEL.CUTTING_FACTORY,
    taskTypeScope: 'CUTTING',
    taskTypeScopeLabel: EXECUTION_TASK_TYPE_SCOPE_LABEL.CUTTING,
    startRequired: true,
    startProofRequirement: 'IMAGE',
    startProofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE,
    startDueHours: 24,
    enabled: false,
    ruleType: 'AFTER_N_PIECES',
    targetQty: 3,
    targetUnit: 'PIECE',
    ruleLabel: buildMilestoneRuleLabel('AFTER_N_PIECES', 3),
    proofRequirement: 'NONE',
    proofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.NONE,
    overdueExceptionEnabled: false,
    overdueHours: 48,
    exceptionSeverity: 'S2',
    updatedAt: '2026-03-11 16:20:00',
    updatedBy: '平台运营',
    remark: '当前裁片工序不启用关键节点上报',
  },
  {
    id: 'MC-PROC-WOOL-WHOLE',
    processCode: 'PROC_WOOL',
    processNameZh: '毛织',
    factoryTypeScope: 'OWN_WOOL_FACTORY',
    factoryTypeScopeLabel: EXECUTION_FACTORY_TYPE_SCOPE_LABEL.OWN_WOOL_FACTORY,
    taskTypeScope: 'WHOLE_GARMENT',
    taskTypeScopeLabel: EXECUTION_TASK_TYPE_SCOPE_LABEL.WHOLE_GARMENT,
    startRequired: true,
    startProofRequirement: 'IMAGE_OR_VIDEO',
    startProofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE_OR_VIDEO,
    startDueHours: 24,
    enabled: true,
    ruleType: 'AFTER_N_PIECES',
    targetQty: 20,
    targetUnit: 'PIECE',
    ruleLabel: '横机完成首批 20 件后上报',
    proofRequirement: 'IMAGE_OR_VIDEO',
    proofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE_OR_VIDEO,
    overdueExceptionEnabled: true,
    overdueHours: 24,
    exceptionSeverity: 'S2',
    updatedAt: '2026-05-10 09:00:00',
    updatedBy: '平台运营',
    remark: '自有毛织厂整件毛织：要求开工，横机首批完成后上报关键节点，完成后交后道工厂。',
  },
  {
    id: 'MC-PROC-WOOL-PART',
    processCode: 'PROC_WOOL',
    processNameZh: '毛织',
    factoryTypeScope: 'OWN_WOOL_FACTORY',
    factoryTypeScopeLabel: EXECUTION_FACTORY_TYPE_SCOPE_LABEL.OWN_WOOL_FACTORY,
    taskTypeScope: 'PART_PANEL',
    taskTypeScopeLabel: EXECUTION_TASK_TYPE_SCOPE_LABEL.PART_PANEL,
    startRequired: true,
    startProofRequirement: 'IMAGE_OR_VIDEO',
    startProofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE_OR_VIDEO,
    startDueHours: 24,
    enabled: true,
    ruleType: 'AFTER_N_PIECES',
    targetQty: 80,
    targetUnit: 'PIECE',
    ruleLabel: '横机完成首批 80 片后上报',
    proofRequirement: 'IMAGE_OR_VIDEO',
    proofRequirementLabel: MILESTONE_PROOF_REQUIREMENT_LABEL.IMAGE_OR_VIDEO,
    overdueExceptionEnabled: true,
    overdueHours: 24,
    exceptionSeverity: 'S2',
    updatedAt: '2026-05-10 09:10:00',
    updatedBy: '平台运营',
    remark: '自有毛织厂部位毛织：要求开工和横机节点上报，完成后交裁床待交出仓，并按部位打印毛织菲票。',
  },
]

let milestoneConfigSeq = 1

function nextMilestoneConfigId(processCode: string): string {
  const sanitized = processCode.replace(/[^A-Z0-9_-]/gi, '').toUpperCase() || 'PROC'
  while (milestoneConfigs.some((item) => item.id === `MC-${sanitized}-${String(milestoneConfigSeq).padStart(4, '0')}`)) {
    milestoneConfigSeq += 1
  }
  const id = `MC-${sanitized}-${String(milestoneConfigSeq).padStart(4, '0')}`
  milestoneConfigSeq += 1
  return id
}

function getExecutionFactoryTypeScopeLabel(scope: ExecutionFactoryTypeScope): string {
  return EXECUTION_FACTORY_TYPE_SCOPE_LABEL[scope]
}

function getExecutionTaskTypeScopeLabel(scope: ExecutionTaskTypeScope): string {
  return EXECUTION_TASK_TYPE_SCOPE_LABEL[scope]
}

function normalizeConfig(item: MilestoneConfig): MilestoneConfig {
  const factoryTypeScope = item.factoryTypeScope || 'PROCESS_FACTORY'
  const taskTypeScope = item.taskTypeScope || 'ALL'
  const startProofRequirement = item.startProofRequirement || 'IMAGE_OR_VIDEO'

  return {
    ...item,
    factoryTypeScope,
    factoryTypeScopeLabel: getExecutionFactoryTypeScopeLabel(factoryTypeScope),
    taskTypeScope,
    taskTypeScopeLabel: getExecutionTaskTypeScopeLabel(taskTypeScope),
    startRequired: item.startRequired ?? true,
    startProofRequirement,
    startProofRequirementLabel: getMilestoneProofRequirementLabel(startProofRequirement),
    startDueHours: normalizeTargetQty(item.startDueHours || 48),
    proofRequirementLabel: getMilestoneProofRequirementLabel(item.proofRequirement),
  }
}

function cloneConfig(item: MilestoneConfig): MilestoneConfig {
  return normalizeConfig({ ...item })
}

function normalizeTargetQty(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}

function getConfigIndexById(id: string): number {
  return milestoneConfigs.findIndex((config) => config.id === id)
}

function getConfigIndexByScope(
  processCode: string,
  processNameZh: string,
  factoryTypeScope: ExecutionFactoryTypeScope,
  taskTypeScope: ExecutionTaskTypeScope,
): number {
  return milestoneConfigs.findIndex(
    (config) =>
      config.processCode === processCode &&
      config.processNameZh === processNameZh &&
      config.factoryTypeScope === factoryTypeScope &&
      config.taskTypeScope === taskTypeScope,
  )
}

export function listMilestoneConfigs(): MilestoneConfig[] {
  return milestoneConfigs
    .map(cloneConfig)
    .sort((a, b) => a.processNameZh.localeCompare(b.processNameZh, 'zh-Hans-CN'))
}

export function getMilestoneConfigById(id: string): MilestoneConfig | undefined {
  const item = milestoneConfigs.find((config) => config.id === id)
  return item ? cloneConfig(item) : undefined
}

export function getMilestoneConfigByProcess(
  processCode?: string,
  processNameZh?: string,
): MilestoneConfig | undefined {
  if (!processCode && !processNameZh) return undefined

  const exact = milestoneConfigs.find((config) => {
    if (processCode && config.processCode !== processCode) return false
    if (processNameZh && config.processNameZh !== processNameZh) return false
    return true
  })
  if (exact) return cloneConfig(exact)

  if (processCode) {
    const byCode = milestoneConfigs.find((config) => config.processCode === processCode)
    if (byCode) return cloneConfig(byCode)
  }

  if (processNameZh) {
    const byName = milestoneConfigs.find((config) => config.processNameZh === processNameZh)
    if (byName) return cloneConfig(byName)
  }

  return undefined
}

export interface ExecutionRuleTaskContext {
  taskId?: string
  processCode?: string
  processNameZh?: string
  processBusinessCode?: string
  processBusinessName?: string
  craftCode?: string
  craftName?: string
  taskCategoryZh?: string
  taskTypeCode?: string
  taskTypeLabel?: string
  taskType?: string
  assignedFactoryId?: string
  factoryType?: string
  woolKind?: string
  isSpecialCraft?: boolean
}

function normalizeText(value?: string): string {
  return (value || '').trim().toUpperCase()
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword))
}

export function resolveExecutionFactoryTypeScope(input: ExecutionRuleTaskContext): ExecutionFactoryTypeScope {
  const explicitFactoryType = normalizeText(input.factoryType)
  const factory = input.assignedFactoryId ? getFactoryMasterRecordById(input.assignedFactoryId) : undefined
  const factoryType = normalizeText(factory?.factoryType) || explicitFactoryType

  if (input.assignedFactoryId === OWN_WOOL_FACTORY_ID || explicitFactoryType === 'OWN_WOOL_FACTORY') {
    return 'OWN_WOOL_FACTORY'
  }
  if (factory?.id === OWN_WOOL_FACTORY_ID) return 'OWN_WOOL_FACTORY'
  if (factoryType === 'CENTRAL_WOOL' && factory?.id === OWN_WOOL_FACTORY_ID) return 'OWN_WOOL_FACTORY'
  if (includesAny(`${factoryType} ${explicitFactoryType}`, ['CUTTING', 'CUT'])) return 'CUTTING_FACTORY'
  if (includesAny(`${factoryType} ${explicitFactoryType}`, ['FINISHING', 'POST', 'MANAGED_POST_FACTORY'])) return 'POST_FACTORY'
  return 'PROCESS_FACTORY'
}

export function resolveExecutionTaskTypeScope(input: ExecutionRuleTaskContext): ExecutionTaskTypeScope {
  const codeText = normalizeText(
    [
      input.woolKind,
      input.taskTypeCode,
      input.taskType,
      input.craftCode,
      input.processBusinessCode,
      input.processCode,
    ]
      .filter(Boolean)
      .join(' '),
  )
  const labelText = [
    input.taskTypeLabel,
    input.taskCategoryZh,
    input.craftName,
    input.processBusinessName,
    input.processNameZh,
  ]
    .filter(Boolean)
    .join(' ')

  if (includesAny(codeText, ['WHOLE_GARMENT']) || labelText.includes('整件毛织')) return 'WHOLE_GARMENT'
  if (includesAny(codeText, ['PART_PANEL']) || labelText.includes('部位毛织')) return 'PART_PANEL'
  if (includesAny(codeText, ['CUTTING', 'CUT']) || labelText.includes('裁片')) return 'CUTTING'
  if (includesAny(codeText, ['PRINT', 'DYE']) || labelText.includes('印花') || labelText.includes('染色')) {
    return 'PRINT_DYE'
  }
  if (includesAny(codeText, ['SEW']) || labelText.includes('车缝')) return 'SEWING'
  if (includesAny(codeText, ['POST_FINISHING', 'IRON', 'PACK']) || labelText.includes('后道') || labelText.includes('整烫')) {
    return 'POST_FINISHING'
  }
  if (input.isSpecialCraft || labelText.includes('特殊工艺')) return 'SPECIAL_CRAFT'
  return 'ALL'
}

function scoreConfigMatch(
  config: MilestoneConfig,
  factoryScope: ExecutionFactoryTypeScope,
  taskScope: ExecutionTaskTypeScope,
): number {
  let score = 0
  if (config.factoryTypeScope === factoryScope) score += 20
  else if (config.factoryTypeScope !== 'ALL') return -1

  if (config.taskTypeScope === taskScope) score += 10
  else if (config.taskTypeScope !== 'ALL') return -1

  return score
}

export function getMilestoneConfigForTask(input: ExecutionRuleTaskContext): MilestoneConfig | undefined {
  const processCode = input.processCode || input.processBusinessCode
  const processNameZh = input.processNameZh || input.processBusinessName
  if (!processCode && !processNameZh) return undefined

  const factoryScope = resolveExecutionFactoryTypeScope(input)
  const taskScope = resolveExecutionTaskTypeScope(input)
  const candidates = milestoneConfigs
    .map(cloneConfig)
    .filter((config) => {
      if (processCode && config.processCode !== processCode) return false
      if (processNameZh && config.processNameZh !== processNameZh) return false
      return true
    })
    .map((config) => ({ config, score: scoreConfigMatch(config, factoryScope, taskScope) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score)

  return candidates[0]?.config
}

export function listMilestoneProcessOptions(): MilestoneProcessOption[] {
  const map = new Map<string, MilestoneProcessOption>()

  for (const config of milestoneConfigs) {
    map.set(config.processCode, {
      processCode: config.processCode,
      processNameZh: config.processNameZh,
    })
  }

  for (const task of processTasks) {
    if (!task.processCode || !task.processNameZh) continue
    if (map.has(task.processCode)) continue
    map.set(task.processCode, {
      processCode: task.processCode,
      processNameZh: task.processNameZh,
    })
  }

  return Array.from(map.values()).sort((a, b) =>
    a.processNameZh.localeCompare(b.processNameZh, 'zh-Hans-CN'),
  )
}

export function getMilestoneProofRequirementLabel(requirement: MilestoneProofRequirement): string {
  return MILESTONE_PROOF_REQUIREMENT_LABEL[requirement]
}

export function getFactoryTypeScopeLabel(scope: ExecutionFactoryTypeScope): string {
  return getExecutionFactoryTypeScopeLabel(scope)
}

export function getTaskTypeScopeLabel(scope: ExecutionTaskTypeScope): string {
  return getExecutionTaskTypeScopeLabel(scope)
}

export function getMilestoneStartRuleLabel(config: MilestoneConfig): string {
  if (!config.startRequired) return '不要求开工'
  return `要求开工，${config.startDueHours} 小时内确认`
}

export function getMilestoneRuleTypeLabel(ruleType: MilestoneRuleType): string {
  return MILESTONE_RULE_TYPE_LABEL[ruleType]
}

export function getMilestoneTargetUnitLabel(unit: MilestoneTargetUnit): string {
  return MILESTONE_TARGET_UNIT_LABEL[unit]
}

export function getMilestoneOverdueRuleLabel(config: MilestoneConfig): string {
  if (!config.enabled || !config.overdueExceptionEnabled) return '未启用超时异常'
  return `开工后 ${config.overdueHours} 小时未上报进异常`
}

export function createMilestoneConfig(
  payload: UpsertMilestoneConfigPayload,
  by: string,
): { ok: boolean; message: string; config?: MilestoneConfig } {
  if (
    getConfigIndexByScope(
      payload.processCode,
      payload.processNameZh,
      payload.factoryTypeScope,
      payload.taskTypeScope,
    ) >= 0
  ) {
    return { ok: false, message: '该工序工艺、工厂类型和任务类型已存在配置，请直接编辑现有配置' }
  }

  const targetQty = normalizeTargetQty(payload.targetQty)
  const targetUnit = getMilestoneTargetUnitByRuleType(payload.ruleType)
  const next: MilestoneConfig = {
    id: nextMilestoneConfigId(payload.processCode),
    processCode: payload.processCode,
    processNameZh: payload.processNameZh,
    factoryTypeScope: payload.factoryTypeScope,
    factoryTypeScopeLabel: getExecutionFactoryTypeScopeLabel(payload.factoryTypeScope),
    taskTypeScope: payload.taskTypeScope,
    taskTypeScopeLabel: getExecutionTaskTypeScopeLabel(payload.taskTypeScope),
    startRequired: payload.startRequired,
    startProofRequirement: payload.startProofRequirement,
    startProofRequirementLabel: getMilestoneProofRequirementLabel(payload.startProofRequirement),
    startDueHours: normalizeTargetQty(payload.startDueHours),
    enabled: payload.enabled,
    ruleType: payload.ruleType,
    targetQty,
    targetUnit,
    ruleLabel: buildMilestoneRuleLabel(payload.ruleType, targetQty, targetUnit),
    proofRequirement: payload.proofRequirement,
    proofRequirementLabel: getMilestoneProofRequirementLabel(payload.proofRequirement),
    overdueExceptionEnabled: payload.overdueExceptionEnabled,
    overdueHours: normalizeTargetQty(payload.overdueHours),
    exceptionSeverity: 'S2',
    updatedAt: nowTimestamp(),
    updatedBy: by,
    remark: payload.remark?.trim() || '',
  }

  milestoneConfigs.push(next)
  return { ok: true, message: '新增配置成功', config: cloneConfig(next) }
}

export function updateMilestoneConfig(
  id: string,
  payload: Partial<
    Pick<
      MilestoneConfig,
      | 'enabled'
      | 'factoryTypeScope'
      | 'taskTypeScope'
      | 'startRequired'
      | 'startProofRequirement'
      | 'startDueHours'
      | 'ruleType'
      | 'targetQty'
      | 'proofRequirement'
      | 'overdueExceptionEnabled'
      | 'overdueHours'
      | 'remark'
    >
  >,
  by: string,
): MilestoneConfig | undefined {
  const index = getConfigIndexById(id)
  if (index < 0) return undefined

  const current = milestoneConfigs[index]
  const ruleType = payload.ruleType || current.ruleType
  const targetQty = normalizeTargetQty(payload.targetQty ?? current.targetQty)
  const targetUnit = getMilestoneTargetUnitByRuleType(ruleType)
  const proofRequirement = payload.proofRequirement || current.proofRequirement
  const startProofRequirement = payload.startProofRequirement || current.startProofRequirement
  const factoryTypeScope = payload.factoryTypeScope || current.factoryTypeScope
  const taskTypeScope = payload.taskTypeScope || current.taskTypeScope
  const ruleChanged = payload.ruleType !== undefined || payload.targetQty !== undefined
  const next: MilestoneConfig = {
    ...current,
    ...payload,
    factoryTypeScope,
    factoryTypeScopeLabel: getExecutionFactoryTypeScopeLabel(factoryTypeScope),
    taskTypeScope,
    taskTypeScopeLabel: getExecutionTaskTypeScopeLabel(taskTypeScope),
    startProofRequirement,
    startProofRequirementLabel: getMilestoneProofRequirementLabel(startProofRequirement),
    startDueHours: normalizeTargetQty(payload.startDueHours ?? current.startDueHours),
    ruleType,
    targetQty,
    targetUnit,
    proofRequirement,
    proofRequirementLabel: getMilestoneProofRequirementLabel(proofRequirement),
    overdueHours: normalizeTargetQty(payload.overdueHours ?? current.overdueHours),
    ruleLabel: ruleChanged ? buildMilestoneRuleLabel(ruleType, targetQty, targetUnit) : current.ruleLabel,
    updatedAt: nowTimestamp(),
    updatedBy: by,
  }

  milestoneConfigs[index] = next
  return cloneConfig(next)
}

export function toggleMilestoneConfigEnabled(
  id: string,
  enabled: boolean,
  by: string,
): MilestoneConfig | undefined {
  return updateMilestoneConfig(id, { enabled }, by)
}
