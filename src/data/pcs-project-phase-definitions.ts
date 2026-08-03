import { listProjectFlowStageContracts, type PcsProjectPhaseCode } from './pcs-project-domain-contract.ts'

export interface PcsProjectPhaseDefinition {
  phaseCode: PcsProjectPhaseCode
  phaseName: string
  phaseOrder: number
  description: string
  defaultOpenFlag: boolean
}

const PHASE_DEFINITIONS = listProjectFlowStageContracts().map((item) => ({
  phaseCode: item.phaseCode,
  phaseName: item.stepName,
  phaseOrder: item.sequence,
  description: item.description,
  defaultOpenFlag: item.sequence < 5,
}))

export function listProjectPhaseDefinitions(): PcsProjectPhaseDefinition[] {
  return PHASE_DEFINITIONS.map((item) => ({ ...item }))
}

export function getProjectPhaseDefinitionByCode(
  phaseCode: string,
): PcsProjectPhaseDefinition | null {
  const found = PHASE_DEFINITIONS.find((item) => item.phaseCode === phaseCode)
  return found ? { ...found } : null
}

export function getProjectPhaseNameByCode(phaseCode: string): string {
  return getProjectPhaseDefinitionByCode(phaseCode)?.phaseName ?? phaseCode
}
