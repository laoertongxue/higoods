import { getFactoryMasterRecordById } from '../data/fcs/factory-master-store.ts'
import { getMobileExecutionTaskById, isMobileTaskVisibleForFactory } from '../data/fcs/mobile-execution-task-index.ts'
import { getThirdPartyPdaTaskMode, isThirdPartyPdaFactory, isThirdPartyPdaHandoverScope } from '../data/fcs/pda-experience-scope.ts'
import type { PdaHandoverHead } from '../data/fcs/pda-handover-events.ts'
import type { ProcessTask } from '../data/fcs/process-tasks.ts'
import { getPdaRuntimeContext } from './pda-runtime.ts'

export function currentThirdPartyPdaFactoryId(): string | undefined {
  const runtime = getPdaRuntimeContext()
  return runtime && isThirdPartyPdaFactory(getFactoryMasterRecordById(runtime.factoryId)) ? runtime.factoryId : undefined
}

export function isCurrentPdaHandoverInScope(head: PdaHandoverHead | undefined): boolean {
  const factoryId = currentThirdPartyPdaFactoryId()
  if (!factoryId) return true
  if (!head || head.factoryId !== factoryId) return false
  return isThirdPartyPdaHandoverScope(head, factoryId, getMobileExecutionTaskById(head.runtimeTaskId || head.taskId))
}

export function isCurrentPdaExecutionInScope(task: ProcessTask | null | undefined): boolean {
  const factoryId = currentThirdPartyPdaFactoryId()
  return !factoryId || !!task && getThirdPartyPdaTaskMode(task) !== null && isMobileTaskVisibleForFactory(task, factoryId)
}
