import type { Factory } from './factory-types.ts'
import type { ProcessTask } from './process-tasks.ts'
import {
  normalizeProductionExecutionProcessCode,
  resolveMergedProductionTaskType,
  type MergedProductionTaskType,
} from './merged-production-task.ts'
export { isThirdPartyPdaRouteAllowed } from '../../router/pda-experience-paths.ts'

export type ThirdPartyPdaTaskMode = 'SEWING' | MergedProductionTaskType

type FactoryScope = Pick<Factory, 'factoryTier' | 'factoryType' | 'isTestFactory' | 'testFactoryScope'>
export type PdaTaskScope = Pick<ProcessTask, 'processCode'> & Partial<Pick<
  ProcessTask, 'processBusinessCode' | 'taskUnitType' | 'coveredProcesses' | 'defaultDocType'
>> & { mergedTaskType?: string; mergedIntoTaskId?: string; executionEnabled?: boolean }

/** Factory ownership is a business fact; display names and broad test abilities are not evidence. */
export function isThirdPartyPdaFactory(factory: FactoryScope | null | undefined): boolean {
  if (!factory || factory.isTestFactory || factory.testFactoryScope === 'ALL_PROCESS_CRAFT') return false
  return (factory.factoryTier === 'THIRD_PARTY' && factory.factoryType === 'THIRD_SEWING')
    || (factory.factoryTier === 'SATELLITE' && factory.factoryType === 'SATELLITE_SEWING')
}

export function isCentralPdaFactory(factory: FactoryScope | null | undefined): boolean {
  // Full-capability central prototype factories retain their current business ownership.
  return factory?.factoryTier === 'CENTRAL'
}

function canonicalCode(code: string | undefined): string {
  return normalizeProductionExecutionProcessCode(String(code ?? '').trim().toUpperCase().replace(/^PROC_/, ''))
}

/** Use the current task's frozen process scope, never a translated name or a substring match. */
export function getThirdPartyPdaTaskMode(task: PdaTaskScope | null | undefined): ThirdPartyPdaTaskMode | null {
  if (!task || task.executionEnabled === false || task.mergedIntoTaskId
    || task.taskUnitType === 'WHOLE_ORDER_TASK'
    || (task.defaultDocType && task.defaultDocType !== 'TASK')) return null

  const codes = task.coveredProcesses?.length
    ? task.coveredProcesses.map((item) => canonicalCode(item.processCode))
    : [canonicalCode(task.processBusinessCode || task.processCode)]
  if (codes.some((code) => code === 'UNKNOWN')) return null
  const unique = [...new Set(codes)]
  if (unique.length === 1 && unique[0] === 'SEWING') {
    return !task.mergedTaskType && task.taskUnitType !== 'MERGED_PRODUCTION_TASK'
      && canonicalCode(task.processBusinessCode || task.processCode) === 'SEWING' ? 'SEWING' : null
  }
  if (task.taskUnitType !== 'MERGED_PRODUCTION_TASK') return null
  const merged = resolveMergedProductionTaskType(unique.map((processCode) => ({ processCode })))
  if (!merged || (task.mergedTaskType && task.mergedTaskType !== merged)) return null
  if (task.processBusinessCode && canonicalCode(task.processBusinessCode) !== merged) return null
  return merged
}

/** The task is the recipient's actual sewing assignment. An upstream cutting
 * label alone must neither grant access nor hide a legitimate piece receipt. */
export function isThirdPartyPdaHandoverScope(
  head: { factoryId: string } | null | undefined,
  factoryId: string,
  task: PdaTaskScope | null | undefined,
): boolean {
  return !!head && head.factoryId === factoryId && getThirdPartyPdaTaskMode(task) !== null
}

