import { processTasks } from './process-tasks'

export type MilestoneRuleType = 'AFTER_N_PIECES' | 'AFTER_N_YARD'
export type MilestoneTargetUnit = 'PIECE' | 'YARD'
export type MilestoneProofRequirement = 'NONE' | 'IMAGE' | 'VIDEO' | 'IMAGE_OR_VIDEO'
export type MilestoneExceptionSeverity = 'S1' | 'S2' | 'S3'

export interface MilestoneConfig {
  id: string
  processCode: string
  processNameZh: string
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

export interface UpsertMilestoneConfigPayload {
  processCode: string
  processNameZh: string
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

function cloneConfig(item: MilestoneConfig): MilestoneConfig {
  return { ...item }
}

function normalizeTargetQty(value: number): number {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.floor(value))
}

function getConfigIndexById(id: string): number {
  return milestoneConfigs.findIndex((config) => config.id === id)
}

function getConfigIndexByProcess(processCode: string, processNameZh: string): number {
  return milestoneConfigs.findIndex(
    (config) => config.processCode === processCode && config.processNameZh === processNameZh,
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
  if (getConfigIndexByProcess(payload.processCode, payload.processNameZh) >= 0) {
    return { ok: false, message: '该工序工艺已存在节点上报配置，请直接编辑现有配置' }
  }

  const targetQty = normalizeTargetQty(payload.targetQty)
  const targetUnit = getMilestoneTargetUnitByRuleType(payload.ruleType)
  const next: MilestoneConfig = {
    id: nextMilestoneConfigId(payload.processCode),
    processCode: payload.processCode,
    processNameZh: payload.processNameZh,
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
  const next: MilestoneConfig = {
    ...current,
    ...payload,
    ruleType,
    targetQty,
    targetUnit,
    proofRequirement,
    proofRequirementLabel: getMilestoneProofRequirementLabel(proofRequirement),
    overdueHours: normalizeTargetQty(payload.overdueHours ?? current.overdueHours),
    ruleLabel: buildMilestoneRuleLabel(ruleType, targetQty, targetUnit),
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
