export interface PcsProjectPhaseDefinition {
  phaseCode: string
  phaseName: string
  phaseOrder: number
  description: string
  defaultOpenFlag: boolean
}

export const PCS_PROJECT_PHASE_DEFINITIONS: PcsProjectPhaseDefinition[] = [
  {
    phaseCode: 'PHASE_01',
    phaseName: '立项获取',
    phaseOrder: 1,
    description: '完成商品项目立项、样衣获取和到样核对。',
    defaultOpenFlag: true,
  },
  {
    phaseCode: 'PHASE_02',
    phaseName: '样衣与评估',
    phaseOrder: 2,
    description: '完成样衣确认、核价和定价评估。',
    defaultOpenFlag: true,
  },
  {
    phaseCode: 'PHASE_03',
    phaseName: '市场测款',
    phaseOrder: 3,
    description: '完成短视频、直播和测款结论判定。',
    defaultOpenFlag: true,
  },
  {
    phaseCode: 'PHASE_04',
    phaseName: '开发推进',
    phaseOrder: 4,
    description: '完成档案生成、工程任务和渠道准备。',
    defaultOpenFlag: true,
  },
  {
    phaseCode: 'PHASE_05',
    phaseName: '项目收尾',
    phaseOrder: 5,
    description: '完成样衣留存评估和退回处理。',
    defaultOpenFlag: false,
  },
]

const LEGACY_PHASE_NAME_MAP: Record<string, string> = {
  立项阶段: 'PHASE_01',
  立项获取: 'PHASE_01',
  打样阶段: 'PHASE_02',
  评估定价: 'PHASE_02',
  样衣与评估: 'PHASE_02',
  市场测款: 'PHASE_03',
  测款阶段: 'PHASE_03',
  工程准备: 'PHASE_04',
  结论与推进: 'PHASE_04',
  开发推进: 'PHASE_04',
  资产处置: 'PHASE_05',
  项目收尾: 'PHASE_05',
}

function normalizePhaseAlias(name: string): string {
  return name.trim().replace(/^\d+\s*/, '').replace(/\s+/g, '')
}

export function listProjectPhaseDefinitions(): PcsProjectPhaseDefinition[] {
  return PCS_PROJECT_PHASE_DEFINITIONS.map((item) => ({ ...item }))
}

export function getProjectPhaseDefinitionByCode(
  phaseCode: string,
): PcsProjectPhaseDefinition | null {
  const found = PCS_PROJECT_PHASE_DEFINITIONS.find((item) => item.phaseCode === phaseCode)
  return found ? { ...found } : null
}

export function resolveProjectPhaseCodeFromLegacyName(name: string): string | null {
  const normalized = normalizePhaseAlias(name)
  const matched = Object.entries(LEGACY_PHASE_NAME_MAP).find(
    ([alias]) => normalizePhaseAlias(alias) === normalized,
  )
  return matched?.[1] ?? null
}

export function getProjectPhaseNameByCode(phaseCode: string): string {
  return getProjectPhaseDefinitionByCode(phaseCode)?.phaseName ?? phaseCode
}

