import { listProjectPhaseContracts, type PcsProjectPhaseCode } from './pcs-project-domain-contract.ts'

export interface PcsProjectPhaseDefinition {
  phaseCode: PcsProjectPhaseCode
  phaseName: string
  phaseOrder: number
  description: string
  defaultOpenFlag: boolean
}

const PHASE_DEFINITIONS = listProjectPhaseContracts().map((item) => ({
  phaseCode: item.phaseCode,
  phaseName: item.phaseName,
  phaseOrder: item.phaseOrder,
  description: item.description,
  defaultOpenFlag: item.defaultOpenFlag,
}))

const LEGACY_PHASE_NAME_MAP: Record<string, PcsProjectPhaseCode> = {
  立项阶段: 'PHASE_01',
  立项获取: 'PHASE_01',
  打样阶段: 'PHASE_02',
  评估定价: 'PHASE_02',
  样衣与评估: 'PHASE_02',
  市场测款: 'PHASE_03',
  商品上架与市场测款: 'PHASE_03',
  测款阶段: 'PHASE_03',
  工程准备: 'PHASE_04',
  结论与推进: 'PHASE_04',
  开发推进: 'PHASE_04',
  款式档案与开发推进: 'PHASE_04',
  资产处置: 'PHASE_05',
  项目收尾: 'PHASE_05',
}

function normalizePhaseAlias(name: string): string {
  return name.trim().replace(/^\d+\s*/, '').replace(/\s+/g, '')
}

export function listProjectPhaseDefinitions(): PcsProjectPhaseDefinition[] {
  return PHASE_DEFINITIONS.map((item) => ({ ...item }))
}

export function getProjectPhaseDefinitionByCode(
  phaseCode: string,
): PcsProjectPhaseDefinition | null {
  const found = PHASE_DEFINITIONS.find((item) => item.phaseCode === phaseCode)
  return found ? { ...found } : null
}

export function resolveProjectPhaseCodeFromLegacyName(name: string): PcsProjectPhaseCode | null {
  const normalized = normalizePhaseAlias(name)
  const matched = Object.entries(LEGACY_PHASE_NAME_MAP).find(
    ([alias]) => normalizePhaseAlias(alias) === normalized,
  )
  return matched?.[1] ?? null
}

export function getProjectPhaseNameByCode(phaseCode: string): string {
  return getProjectPhaseDefinitionByCode(phaseCode)?.phaseName ?? phaseCode
}

